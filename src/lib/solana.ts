// Server-side Solana helpers: RPC, the engine key vault, sending and reading
// confirmed transactions. The vault code is carried over from VIBER's chain.js.
import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Connection, Keypair, PublicKey, VersionedTransaction, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

export const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
let conn: Connection | null = null;
export const connection = () => (conn ??= new Connection(RPC_URL, 'confirmed'));

// ------------------------------------------------------------------ vault
function masterKey(): Buffer {
  const k = process.env.MASTER_KEY;
  if (!k || k.length < 32) throw new Error('MASTER_KEY (32+ characters) is required to create or open engine vaults.');
  return createHash('sha256').update(k).digest();
}
export const vaultsEnabled = () => Boolean(process.env.MASTER_KEY && process.env.MASTER_KEY.length >= 32);

export function seal(secretKey: Uint8Array): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', masterKey(), iv);
  const enc = Buffer.concat([c.update(Buffer.from(secretKey)), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}
export function open(sealed: string): Keypair {
  const [iv, tag, enc] = sealed.split('.').map((s) => Buffer.from(s, 'base64'));
  const d = createDecipheriv('aes-256-gcm', masterKey(), iv);
  d.setAuthTag(tag);
  return Keypair.fromSecretKey(new Uint8Array(Buffer.concat([d.update(enc), d.final()])));
}
export function newVault() {
  const kp = Keypair.generate();
  return { keypair: kp, address: kp.publicKey.toBase58(), sealed: seal(kp.secretKey) };
}

export function operator(): Keypair | null {
  const s = process.env.STM_OPERATOR_SECRET;
  if (!s) return null;
  return Keypair.fromSecretKey(bs58.decode(s));
}
export const treasury = () => (process.env.STM_TREASURY_WALLET ? new PublicKey(process.env.STM_TREASURY_WALLET) : null);

export const isAddress = (s: unknown): s is string => {
  if (typeof s !== 'string' || s.length < 32 || s.length > 44) return false;
  try { new PublicKey(s); return true; } catch { return false; }
};

// ------------------------------------------------------------------- sending
export async function sendRaw(raw: Uint8Array): Promise<string> {
  const c = connection();
  const sig = await c.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 3 });
  const bh = await c.getLatestBlockhash('confirmed');
  const res = await c.confirmTransaction({ signature: sig, ...bh }, 'confirmed');
  if (res.value.err) throw new Error(`Transaction failed on-chain: ${JSON.stringify(res.value.err)}`);
  return sig;
}

export async function simulate(tx: VersionedTransaction | Transaction) {
  const c = connection();
  const r = tx instanceof VersionedTransaction
    ? await c.simulateTransaction(tx, { sigVerify: false, replaceRecentBlockhash: true })
    : await c.simulateTransaction(tx);
  return { ok: !r.value.err, err: r.value.err, logs: r.value.logs ?? [], units: r.value.unitsConsumed ?? 0 };
}

/** SOL balance change of `owner` in a confirmed transaction, in lamports. */
export async function lamportDelta(signature: string, owner: string): Promise<bigint> {
  const tx = await connection().getTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' });
  if (!tx?.meta) return 0n;
  const keys = tx.transaction.message.getAccountKeys({ accountKeysFromLookups: tx.meta.loadedAddresses }).staticAccountKeys.map((k) => k.toBase58());
  const i = keys.indexOf(owner);
  return i < 0 ? 0n : BigInt(tx.meta.postBalances[i] - tx.meta.preBalances[i]);
}

export async function solBalance(address: string): Promise<number> {
  return connection().getBalance(new PublicKey(address));
}

export const LAMPORTS = LAMPORTS_PER_SOL;
