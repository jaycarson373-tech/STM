// The Retro Liquidity Engine.
//
// For every STM launch with the engine on, the coin's creator fees accrue to
// a dedicated engine vault. Each run:
//   1. claims the vault's creator fees (claim)
//   2. sends 20% of what arrived to the STM treasury (treasury)
//   3. books the other 80% as that token's liquidity reserve (reserve)
//   4. once the token has graduated to an AMM, turns the reserve into
//      liquidity: buys the token with half, deposits both halves, and locks
//      the position where the venue supports it (swap, add_liquidity, lock)
//
// Modes: off | dry-run | live. In dry-run every transaction is built and
// simulated, and nothing is written to the public ledger. In live mode only
// confirmed transactions are recorded, each with its signature.
import 'server-only';
import { Keypair, PublicKey } from '@solana/web3.js';
import { ENGINE_SPLIT } from './capabilities';
import { connection, lamportDelta, open, operator, sendRaw, simulate, solBalance, treasury } from './solana';
import { addEvent, engineLaunches, events, type EngineEvent, type Launch, type Venue } from './store';
import { buildClaim, buildTransfer, finalize, graduation, planDeploy, type EngineTx } from './venues';

export type EngineMode = 'off' | 'dry-run' | 'live';
export const engineMode = (): EngineMode => (['off', 'dry-run', 'live'].includes(process.env.ENGINE_MODE || '') ? (process.env.ENGINE_MODE as EngineMode) : 'dry-run');
const liveVenues = () => new Set((process.env.ENGINE_LIVE_VENUES || 'pump').split(',').map((s) => s.trim()));

const MIN_CLAIM = 2_000_000n; // 0.002 SOL; below this a claim costs more than it moves
const MIN_DEPLOY = 50_000_000n; // 0.05 SOL reserve before buying into the pool
const VAULT_FLOOR = 3_000_000n; // keep rent + ATA headroom in the vault

export interface StepResult { mint: string; step: string; ok: boolean; mode: EngineMode; signature?: string; detail: string; logs?: string[] }

async function execute(e: EngineTx, mode: EngineMode, venue: Venue): Promise<{ ok: boolean; signature?: string; detail: string; logs?: string[] }> {
  const raw = await finalize(e);
  if (mode === 'live' && liveVenues().has(venue)) {
    const signature = await sendRaw(raw);
    return { ok: true, signature, detail: 'confirmed' };
  }
  const sim = await simulate(e.tx);
  return { ok: sim.ok, detail: sim.ok ? `simulated OK (${sim.units} CU)` : `simulation failed: ${JSON.stringify(sim.err)}`, logs: sim.ok ? undefined : sim.logs.slice(-6) };
}

/** Reserve still waiting to become liquidity, from the ledger. */
export function reserveOf(evts: EngineEvent[]): bigint {
  let r = 0n;
  for (const e of evts) {
    if (e.mode !== 'live') continue;
    if (e.kind === 'reserve') r += BigInt(e.lamports);
    if (e.kind === 'swap' || e.kind === 'add_liquidity') r -= BigInt(e.lamports);
  }
  return r > 0n ? r : 0n;
}

export async function runEngine(): Promise<{ mode: EngineMode; results: StepResult[]; skipped?: string }> {
  const mode = engineMode();
  if (mode === 'off') return { mode, results: [], skipped: 'ENGINE_MODE=off' };
  const op = operator();
  const tre = treasury();
  if (!op || !tre) return { mode, results: [], skipped: 'Set STM_OPERATOR_SECRET and STM_TREASURY_WALLET to run the engine.' };

  const results: StepResult[] = [];
  for (const launch of await engineLaunches()) {
    try {
      results.push(...(await runOne(launch, op, tre, mode)));
    } catch (err) {
      results.push({ mint: launch.mint, step: 'run', ok: false, mode, detail: (err as Error).message });
    }
  }
  return { mode, results };
}

async function runOne(launch: Launch, op: Keypair, tre: PublicKey, mode: EngineMode): Promise<StepResult[]> {
  const out: StepResult[] = [];
  const vault = open(launch.vaultSealed!);
  const v = launch.venue;
  const live = mode === 'live' && liveVenues().has(v);
  const record = (r: StepResult) => { out.push(r); return r; };

  // 1 + 2 + 3: claim, then split what actually arrived
  const before = BigInt(await solBalance(vault.publicKey.toBase58()));
  const claim = await execute(await buildClaim(v, vault, op, launch), mode, v);
  record({ mint: launch.mint, step: 'claim', mode, ...claim });
  if (claim.ok && claim.signature) {
    const received = await lamportDelta(claim.signature, vault.publicKey.toBase58());
    if (received > 0n) {
      await addEvent({ mint: launch.mint, venue: v, kind: 'claim', lamports: received.toString(), tokenAmount: null, lpAmount: null, lpStatus: null, signature: claim.signature, mode: 'live', note: 'Creator fees claimed into the engine vault' });
      if (received >= MIN_CLAIM) {
        const toTreasury = (received * BigInt(ENGINE_SPLIT.treasuryBps)) / 10_000n;
        const t = await execute(await buildTransfer(vault, op, tre, toTreasury), mode, v);
        record({ mint: launch.mint, step: 'treasury', mode, ...t });
        if (t.ok && t.signature) {
          await addEvent({ mint: launch.mint, venue: v, kind: 'treasury', lamports: toTreasury.toString(), tokenAmount: null, lpAmount: null, lpStatus: null, signature: t.signature, mode: 'live', note: `${ENGINE_SPLIT.treasuryBps / 100}% to the STM treasury` });
          const toReserve = received - toTreasury;
          await addEvent({ mint: launch.mint, venue: v, kind: 'reserve', lamports: toReserve.toString(), tokenAmount: null, lpAmount: null, lpStatus: null, signature: null, mode: 'live', note: `${ENGINE_SPLIT.liquidityBps / 100}% booked to this token's liquidity reserve; it stays in the vault until deployed` });
        }
      }
    }
  }

  // 4: deploy the reserve once the token trades on an AMM
  const grad = await graduation(v, launch.mint, launch.extra);
  record({ mint: launch.mint, step: 'graduation', ok: true, mode, detail: grad.detail });
  if (!grad.migrated || !grad.pool) return out;

  const ledger = await events({ mint: launch.mint, limit: 1000 });
  let reserve = reserveOf(ledger);
  if (!live) {
    // dry-run: simulate a deployment of what the vault holds above its floor
    const bal = BigInt(await solBalance(vault.publicKey.toBase58()));
    reserve = bal > VAULT_FLOOR ? bal - VAULT_FLOOR : 0n;
  }
  const vaultBal = BigInt(await solBalance(vault.publicKey.toBase58()));
  const spendable = vaultBal > VAULT_FLOOR ? vaultBal - VAULT_FLOOR : 0n;
  const amount = reserve < spendable ? reserve : spendable;
  if (amount < MIN_DEPLOY) {
    record({ mint: launch.mint, step: 'deploy', ok: true, mode, detail: `Reserve ${Number(amount) / 1e9} SOL is below the ${Number(MIN_DEPLOY) / 1e9} SOL deploy minimum` });
    return out;
  }

  const plan = planDeploy(v, vault, op, launch.mint, grad.pool, amount);
  for (const step of plan.steps) {
    let r;
    try {
      r = await execute(await step.build(), mode, v);
    } catch (err) {
      record({ mint: launch.mint, step: step.kind, ok: false, mode, detail: (err as Error).message });
      break;
    }
    record({ mint: launch.mint, step: step.kind, mode, ...r });
    if (!r.ok) break;
    if (r.signature) {
      const spent = step.kind === 'lock' ? 0n : amount / 2n;
      await addEvent({
        mint: launch.mint, venue: v, kind: step.kind, lamports: spent.toString(), tokenAmount: null, lpAmount: null,
        lpStatus: step.kind === 'add_liquidity' || step.kind === 'lock' ? plan.lpStatus : null,
        signature: r.signature, mode: 'live',
        note: step.kind === 'swap' ? 'Bought the token side with half the reserve' : step.kind === 'add_liquidity' ? `Deposited into ${grad.pool}` : 'Liquidity locked',
      });
    }
  }
  return out;
}

/** Totals for the public dashboard, from confirmed ledger rows only. */
export function totals(evts: EngineEvent[]) {
  const live = evts.filter((e) => e.mode === 'live');
  const sum = (k: EngineEvent['kind']) => live.filter((e) => e.kind === k).reduce((a, e) => a + BigInt(e.lamports), 0n);
  return {
    claimed: sum('claim'),
    treasury: sum('treasury'),
    reserved: sum('reserve'),
    deployed: sum('swap') + sum('add_liquidity'),
    pending: reserveOf(live),
    deposits: live.filter((e) => e.kind === 'add_liquidity').length,
    locks: live.filter((e) => e.kind === 'lock').length,
  };
}

export const _conn = connection;
