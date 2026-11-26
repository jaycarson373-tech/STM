// Token metadata upload. Pinata when PINATA_JWT is set; otherwise pump.fun's
// public IPFS endpoint (the same one pump.fun's own UI uses). Both return a
// standard Metaplex-style JSON that every launchpad accepts.
import 'server-only';

export interface MetadataInput {
  name: string;
  symbol: string;
  description: string;
  image: { bytes: Buffer; type: string };
  twitter?: string;
  telegram?: string;
  website?: string;
}

export async function uploadMetadata(m: MetadataInput): Promise<{ uri: string; image: string }> {
  if (process.env.PINATA_JWT) return pinata(m);
  return pumpIpfs(m);
}

async function pumpIpfs(m: MetadataInput) {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(m.image.bytes)], { type: m.image.type }), 'image');
  form.append('name', m.name);
  form.append('symbol', m.symbol);
  form.append('description', m.description);
  form.append('twitter', m.twitter || '');
  form.append('telegram', m.telegram || '');
  form.append('website', m.website || '');
  form.append('showName', 'true');
  const r = await fetch('https://pump.fun/api/ipfs', { method: 'POST', body: form });
  if (!r.ok) throw new Error(`Metadata upload failed (${r.status}). Set PINATA_JWT to use Pinata instead.`);
  const j = await r.json();
  if (!j.metadataUri) throw new Error('Metadata upload returned no URI.');
  return { uri: j.metadataUri as string, image: (j.metadata?.image as string) || '' };
}

async function pinata(m: MetadataInput) {
  const auth = { Authorization: `Bearer ${process.env.PINATA_JWT}` };
  const f = new FormData();
  f.append('file', new Blob([new Uint8Array(m.image.bytes)], { type: m.image.type }), `${m.symbol}.${m.image.type.split('/')[1] || 'png'}`);
  const img = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', { method: 'POST', headers: auth, body: f });
  if (!img.ok) throw new Error(`Pinata image upload failed (${img.status}).`);
  const image = `https://ipfs.io/ipfs/${(await img.json()).IpfsHash}`;
  const json = {
    name: m.name, symbol: m.symbol, description: m.description, image,
    showName: true, createdOn: 'Solana Time Machine',
    ...(m.twitter ? { twitter: m.twitter } : {}), ...(m.telegram ? { telegram: m.telegram } : {}), ...(m.website ? { website: m.website } : {}),
  };
  const meta = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST', headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ pinataContent: json, pinataMetadata: { name: `${m.symbol}-metadata` } }),
  });
  if (!meta.ok) throw new Error(`Pinata metadata upload failed (${meta.status}).`);
  return { uri: `https://ipfs.io/ipfs/${(await meta.json()).IpfsHash}`, image };
}
