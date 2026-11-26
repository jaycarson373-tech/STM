import { NextResponse } from 'next/server';
import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import nacl from 'tweetnacl';
import { sendRaw } from '@/lib/solana';
import { getLaunch, updateLaunch } from '@/lib/store';
import { buildRaydiumFirstBuy } from '@/lib/venues';

export const runtime = 'nodejs';
export const maxDuration = 60;
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const { launchId, signedTx } = await req.json().catch(() => ({}));
  if (typeof launchId !== 'string' || typeof signedTx !== 'string') return bad('Missing launch or transaction.');
  const launch = await getLaunch(launchId);
  if (!launch) return bad('Launch not found.', 404);
  if (launch.status === 'live') return NextResponse.json({ ok: true, mint: launch.mint, signature: launch.createSig });
  if (!launch.preparedMessage) return bad('This launch has no prepared transaction.', 409);

  const raw = Buffer.from(signedTx, 'base64');
  const expected = Buffer.from(launch.preparedMessage, 'base64');
  const user = new PublicKey(launch.wallet);

  // The wallet must have signed exactly the message STM built and co-signed.
  let message: Uint8Array, signature: Uint8Array | null = null;
  try {
    if (launch.venue === 'meteora') {
      const tx = Transaction.from(raw);
      message = tx.serializeMessage();
      signature = tx.signatures.find((s) => s.publicKey.equals(user))?.signature ?? null;
    } else {
      const tx = VersionedTransaction.deserialize(raw);
      message = tx.message.serialize();
      const i = tx.message.staticAccountKeys.findIndex((k) => k.equals(user));
      signature = i >= 0 ? tx.signatures[i] : null;
    }
  } catch {
    return bad('That is not a valid Solana transaction.');
  }
  if (!Buffer.from(message).equals(expected)) return bad('The signed transaction does not match the one STM prepared.', 409);
  if (!signature || !nacl.sign.detached.verify(message, signature, user.toBytes())) return bad('Your wallet signature is missing or invalid.', 409);

  let sig: string;
  try {
    sig = await sendRaw(raw);
  } catch (e) {
    await updateLaunch(launch.id, { status: 'failed' });
    return bad(`The launch transaction failed: ${(e as Error).message}`, 502);
  }
  await updateLaunch(launch.id, { status: 'live', createSig: sig });

  // Raydium with the engine on: the vault is the creator, so the user's first
  // buy goes in a second transaction now that the pool exists.
  let next: { tx: string; legacy: boolean } | null = null;
  const pending = Number(launch.extra?.pendingFirstBuySol || 0);
  if (launch.venue === 'raydium' && pending > 0) {
    try {
      const b = await buildRaydiumFirstBuy(user, launch.mint, pending);
      next = { tx: Buffer.from(b.tx).toString('base64'), legacy: false };
    } catch (e) {
      next = null;
      return NextResponse.json({ ok: true, mint: launch.mint, signature: sig, firstBuyError: (e as Error).message });
    }
  }
  return NextResponse.json({ ok: true, mint: launch.mint, signature: sig, next });
}
