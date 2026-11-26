import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import { archiveToken, eraOf } from '@/data/eras';
import { uploadMetadata } from '@/lib/metadata';
import { isAddress, newVault, vaultsEnabled } from '@/lib/solana';
import { saveLaunch, storeConfigured, type LaunchKind, type Venue } from '@/lib/store';
import { buildLaunch, venueAvailability } from '@/lib/venues';

export const runtime = 'nodejs';
export const maxDuration = 60;

const VENUES: Venue[] = ['pump', 'raydium', 'meteora'];
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  if (!storeConfigured()) return bad('The launch registry is not configured (DATABASE_URL).', 503);
  const f = await req.formData();
  const s = (k: string) => String(f.get(k) ?? '').trim();

  const venue = s('venue') as Venue;
  const wallet = s('wallet');
  const name = s('name');
  const symbol = s('symbol').toUpperCase().replace(/^\$/, '');
  let description = s('description');
  const devBuySol = Number(s('devBuySol') || 0);
  const engine = s('engine') === 'true';
  const kind = (s('kind') || 'original') as LaunchKind;
  const era = s('era') ? Number(s('era')) : null;
  const tributeOf = s('tributeOf') || null;
  const image = f.get('image');

  if (!VENUES.includes(venue)) return bad('Choose Pump.fun, Raydium LaunchLab or Meteora.');
  const avail = venueAvailability(venue);
  if (!avail.ok) return bad(avail.reason!, 409);
  if (!isAddress(wallet)) return bad('Connect a Solana wallet first.');
  if (name.length < 2 || name.length > 32) return bad('Name must be 2 to 32 characters.');
  if (!/^[A-Z0-9]{2,10}$/.test(symbol)) return bad('Ticker must be 2 to 10 letters or digits.');
  if (description.length > 500) return bad('Description must be 500 characters or fewer.');
  if (!Number.isFinite(devBuySol) || devBuySol < 0 || devBuySol > 10) return bad('First buy must be between 0 and 10 SOL.');
  if (!['original', 'inspired', 'tribute'].includes(kind)) return bad('Unknown launch type.');
  if (era !== null && !eraOf(era)) return bad('Unknown era.');
  if (engine && !vaultsEnabled()) return bad('The Liquidity Engine is not configured on this deployment (MASTER_KEY).', 409);
  if (!(image instanceof File) || !IMAGE_TYPES.includes(image.type)) return bad('Add a PNG, JPEG, WebP or GIF image.');
  if (image.size > 2 * 1024 * 1024) return bad('Image must be 2 MB or smaller.');

  // Tributes are always labelled as unofficial and can't reuse the original ticker or name.
  if (kind === 'tribute') {
    const orig = tributeOf ? archiveToken(tributeOf) : null;
    if (!orig) return bad('Pick the historical token this is a tribute to.');
    if (symbol === orig.symbol.toUpperCase()) return bad(`A tribute can't use the original ticker $${orig.symbol}.`);
    if (name.toLowerCase() === orig.name.toLowerCase()) return bad(`A tribute can't use the original name "${orig.name}".`);
    description = `Unofficial tribute to ${orig.name} ($${orig.symbol}, CA ${orig.mint}). Not affiliated with the original project. ${description}`.trim().slice(0, 500);
  }

  let uri: string, imageUrl: string;
  try {
    const up = await uploadMetadata({
      name, symbol, description,
      image: { bytes: Buffer.from(await image.arrayBuffer()), type: image.type },
      twitter: s('twitter'), telegram: s('telegram'), website: s('website'),
    });
    uri = up.uri;
    imageUrl = up.image;
  } catch (e) {
    return bad((e as Error).message, 502);
  }

  const user = new PublicKey(wallet);
  const vault = engine ? newVault() : null;
  const feeCreator = vault ? vault.keypair.publicKey : user;
  try {
    const built = await buildLaunch(venue, { user, feeCreator, vault: vault?.keypair ?? null, name, symbol, uri, devBuySol });
    const id = randomUUID();
    await saveLaunch({
      id, mint: built.mint, venue, name, symbol, description, imageUrl, metadataUri: uri, wallet,
      feeCreator: feeCreator.toBase58(), engine, vaultAddress: vault?.address ?? null, vaultSealed: vault?.sealed ?? null,
      era: kind === 'original' ? null : era, kind, tributeOf: kind === 'tribute' ? tributeOf : null, status: 'prepared', createSig: null,
      preparedMessage: Buffer.from(built.message).toString('base64'), extra: built.extra, createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ launchId: id, mint: built.mint, tx: Buffer.from(built.tx).toString('base64'), legacy: built.legacy, feeCreator: feeCreator.toBase58() });
  } catch (e) {
    return bad(`Could not build the ${venue} launch transaction: ${(e as Error).message}`, 502);
  }
}
