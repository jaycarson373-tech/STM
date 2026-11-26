// Launch registry and Liquidity Engine ledger.
// Postgres when DATABASE_URL is set; a local JSON file in development; and a
// clear "not configured" error anywhere else, so nothing is silently lost.
import 'server-only';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type postgres from 'postgres';

export type Venue = 'pump' | 'raydium' | 'meteora';
export type LaunchKind = 'original' | 'inspired' | 'tribute';
export type LaunchStatus = 'prepared' | 'live' | 'failed';

export interface Launch {
  id: string;
  mint: string;
  venue: Venue;
  name: string;
  symbol: string;
  description: string;
  imageUrl: string | null;
  metadataUri: string;
  wallet: string; // the user who launched and paid
  feeCreator: string; // address that receives creator fees on-chain
  engine: boolean;
  vaultAddress: string | null;
  vaultSealed: string | null; // AES-GCM sealed secret, never sent to clients
  era: number | null;
  kind: LaunchKind;
  tributeOf: string | null; // original mint for tributes
  status: LaunchStatus;
  createSig: string | null;
  preparedMessage: string | null; // base64 message bytes the server signed
  extra: Record<string, unknown>;
  createdAt: string;
}

export type EngineEventKind = 'claim' | 'treasury' | 'reserve' | 'swap' | 'add_liquidity' | 'lock';
export interface EngineEvent {
  id: number;
  mint: string;
  venue: Venue;
  kind: EngineEventKind;
  lamports: string; // SOL moved, as a decimal string of lamports
  tokenAmount: string | null;
  lpAmount: string | null;
  lpStatus: string | null; // 'held_by_vault' | 'locked_burn_earn' | 'permanently_locked' | null
  signature: string | null; // null only for dry-run rows
  mode: 'live' | 'dry-run';
  note: string | null;
  createdAt: string;
}

export const storeConfigured = () => Boolean(process.env.DATABASE_URL) || !process.env.VERCEL;
export class StoreNotConfigured extends Error {
  constructor() { super('The launch registry is not configured. Set DATABASE_URL to a Postgres database.'); }
}

// ------------------------------------------------------------------ postgres
let sqlClient: ReturnType<typeof postgres> | null = null;
let schemaReady: Promise<void> | null = null;
async function sql() {
  if (!sqlClient) {
    const pg = (await import('postgres')).default;
    sqlClient = pg(process.env.DATABASE_URL!, { max: 3, idle_timeout: 20, prepare: false });
  }
  if (!schemaReady) {
    const s = sqlClient;
    schemaReady = (async () => {
      await s`create table if not exists stm_launches (
        id text primary key, mint text unique not null, venue text not null, name text not null, symbol text not null,
        description text not null default '', image_url text, metadata_uri text not null, wallet text not null,
        fee_creator text not null, engine boolean not null, vault_address text, vault_sealed text, era int,
        kind text not null, tribute_of text, status text not null, create_sig text, prepared_message text,
        extra jsonb not null default '{}', created_at timestamptz not null default now())`;
      await s`create table if not exists stm_engine_events (
        id serial primary key, mint text not null, venue text not null, kind text not null, lamports numeric not null default 0,
        token_amount text, lp_amount text, lp_status text, signature text unique, mode text not null, note text,
        created_at timestamptz not null default now())`;
      await s`create index if not exists stm_engine_events_mint on stm_engine_events (mint)`;
    })();
  }
  await schemaReady;
  return sqlClient;
}

const rowToLaunch = (r: Record<string, any>): Launch => ({
  id: r.id, mint: r.mint, venue: r.venue, name: r.name, symbol: r.symbol, description: r.description, imageUrl: r.image_url,
  metadataUri: r.metadata_uri, wallet: r.wallet, feeCreator: r.fee_creator, engine: r.engine, vaultAddress: r.vault_address,
  vaultSealed: r.vault_sealed, era: r.era, kind: r.kind, tributeOf: r.tribute_of, status: r.status, createSig: r.create_sig,
  preparedMessage: r.prepared_message, extra: r.extra || {}, createdAt: new Date(r.created_at).toISOString(),
});
const rowToEvent = (r: Record<string, any>): EngineEvent => ({
  id: r.id, mint: r.mint, venue: r.venue, kind: r.kind, lamports: String(r.lamports), tokenAmount: r.token_amount,
  lpAmount: r.lp_amount, lpStatus: r.lp_status, signature: r.signature, mode: r.mode, note: r.note, createdAt: new Date(r.created_at).toISOString(),
});

// ---------------------------------------------------------------- file store
type FileDb = { launches: Launch[]; events: EngineEvent[] };
const FILE = join(process.cwd(), '.data', 'stm.json');
function readFile(): FileDb {
  if (!existsSync(FILE)) return { launches: [], events: [] };
  return JSON.parse(readFileSync(FILE, 'utf8'));
}
function writeFile(db: FileDb) {
  mkdirSync(join(process.cwd(), '.data'), { recursive: true });
  writeFileSync(FILE, JSON.stringify(db, null, 2));
}

const usePg = () => Boolean(process.env.DATABASE_URL);
function guard() { if (!storeConfigured()) throw new StoreNotConfigured(); }

// ------------------------------------------------------------------- public
export async function saveLaunch(l: Launch): Promise<void> {
  guard();
  if (usePg()) {
    const s = await sql();
    await s`insert into stm_launches ${s({
      id: l.id, mint: l.mint, venue: l.venue, name: l.name, symbol: l.symbol, description: l.description, image_url: l.imageUrl,
      metadata_uri: l.metadataUri, wallet: l.wallet, fee_creator: l.feeCreator, engine: l.engine, vault_address: l.vaultAddress,
      vault_sealed: l.vaultSealed, era: l.era, kind: l.kind, tribute_of: l.tributeOf, status: l.status, create_sig: l.createSig,
      prepared_message: l.preparedMessage, extra: s.json(l.extra as any),
    })}`;
    return;
  }
  const db = readFile();
  db.launches.push(l);
  writeFile(db);
}

export async function updateLaunch(id: string, patch: Partial<Pick<Launch, 'status' | 'createSig' | 'extra'>>): Promise<void> {
  guard();
  if (usePg()) {
    const s = await sql();
    if (patch.status) await s`update stm_launches set status = ${patch.status} where id = ${id}`;
    if (patch.createSig) await s`update stm_launches set create_sig = ${patch.createSig} where id = ${id}`;
    if (patch.extra) await s`update stm_launches set extra = ${s.json(patch.extra as any)} where id = ${id}`;
    return;
  }
  const db = readFile();
  const l = db.launches.find((x) => x.id === id);
  if (l) Object.assign(l, patch);
  writeFile(db);
}

export async function getLaunch(id: string): Promise<Launch | null> {
  if (!storeConfigured()) return null;
  if (usePg()) {
    const s = await sql();
    const [r] = await s`select * from stm_launches where id = ${id}`;
    return r ? rowToLaunch(r) : null;
  }
  return readFile().launches.find((x) => x.id === id) ?? null;
}

export async function getLaunchByMint(mint: string): Promise<Launch | null> {
  if (!storeConfigured()) return null;
  if (usePg()) {
    const s = await sql();
    const [r] = await s`select * from stm_launches where mint = ${mint}`;
    return r ? rowToLaunch(r) : null;
  }
  return readFile().launches.find((x) => x.mint === mint) ?? null;
}

/** Only launches confirmed on-chain. Prepared-but-unsigned launches never show publicly. */
export async function liveLaunches(limit = 200): Promise<Launch[]> {
  if (!storeConfigured()) return [];
  if (usePg()) {
    const s = await sql();
    return (await s`select * from stm_launches where status = 'live' order by created_at desc limit ${limit}`).map(rowToLaunch);
  }
  return readFile().launches.filter((l) => l.status === 'live').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export async function engineLaunches(): Promise<Launch[]> {
  return (await liveLaunches(1000)).filter((l) => l.engine && l.vaultSealed);
}

export async function addEvent(e: Omit<EngineEvent, 'id' | 'createdAt'>): Promise<void> {
  guard();
  if (usePg()) {
    const s = await sql();
    await s`insert into stm_engine_events ${s({ mint: e.mint, venue: e.venue, kind: e.kind, lamports: e.lamports, token_amount: e.tokenAmount, lp_amount: e.lpAmount, lp_status: e.lpStatus, signature: e.signature, mode: e.mode, note: e.note })} on conflict (signature) do nothing`;
    return;
  }
  const db = readFile();
  if (e.signature && db.events.some((x) => x.signature === e.signature)) return;
  db.events.push({ ...e, id: db.events.length + 1, createdAt: new Date().toISOString() });
  writeFile(db);
}

export async function events(opts: { mint?: string; limit?: number } = {}): Promise<EngineEvent[]> {
  if (!storeConfigured()) return [];
  const limit = opts.limit ?? 200;
  if (usePg()) {
    const s = await sql();
    const rows = opts.mint
      ? await s`select * from stm_engine_events where mint = ${opts.mint} order by created_at desc limit ${limit}`
      : await s`select * from stm_engine_events order by created_at desc limit ${limit}`;
    return rows.map(rowToEvent);
  }
  return readFile().events.filter((e) => !opts.mint || e.mint === opts.mint).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

/** Public view of a launch: strips the sealed vault key and the prepared message. */
export function publicLaunch(l: Launch) {
  const { vaultSealed, preparedMessage, ...rest } = l;
  return rest;
}
