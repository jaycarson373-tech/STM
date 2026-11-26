import Link from 'next/link';
import type { Metadata } from 'next';
import { ENGINE_SPLIT } from '@/lib/capabilities';
import { engineMode, totals } from '@/lib/engine';
import { events, liveLaunches } from '@/lib/store';
import { date, short, sol, solscanAccount, solscanTx } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Liquidity Engine' };

const LP_LABEL: Record<string, string> = {
  held_by_vault: 'LP held by engine vault (not locked)',
  locked_burn_earn: 'Locked forever (Raydium Burn & Earn)',
  permanently_locked: 'Permanently locked (Meteora DAMM v2)',
};

export default async function Engine() {
  const [ledger, launches] = await Promise.all([events({ limit: 500 }), liveLaunches(1000)]);
  const engineTokens = launches.filter((l) => l.engine);
  const all = totals(ledger);
  const mode = engineMode();

  return (
    <div className="wrap page">
      <div className="page-head">
        <div>
          <span className="label">Retro Liquidity Engine</span>
          <h1>Fees back into the pool.</h1>
          <p>
            Early Raydium-era coins grew by adding liquidity, not by paying it out. For STM launches that turn the engine on, {ENGINE_SPLIT.liquidityBps / 100}% of the
            creator fees go back into that token&rsquo;s own liquidity and {ENGINE_SPLIT.treasuryBps / 100}% fund the STM treasury. Every number below is the sum of confirmed transactions you can open on Solscan.
          </p>
        </div>
        <span className={`pill ${mode === 'live' ? 'ok' : 'warn'}`}>engine mode: {mode}</span>
      </div>

      <div className="kv" style={{ marginTop: 0 }}>
        <div><span className="label">Fees claimed</span><span className="stat-v">{sol(all.claimed)}</span><span className="stat-src">{ledger.filter((e) => e.kind === 'claim').length} confirmed claims</span></div>
        <div><span className="label">Treasury ({ENGINE_SPLIT.treasuryBps / 100}%)</span><span className="stat-v">{sol(all.treasury)}</span><span className="stat-src">confirmed transfers</span></div>
        <div><span className="label">Reserve awaiting deployment</span><span className="stat-v">{sol(all.pending)}</span><span className="stat-src">held in token vaults</span></div>
        <div><span className="label">Reinvested into liquidity</span><span className="stat-v">{sol(all.deployed)}</span><span className="stat-src">{all.deposits} deposits · {all.locks} locks</span></div>
      </div>
      {mode !== 'live' && (
        <div className="note-box">
          The engine is in <b>{mode}</b> mode on this deployment. It builds and simulates every claim, transfer and deposit but sends nothing, and simulated steps are never added to these totals.
        </div>
      )}

      <section className="section">
        <div className="section-head"><h2>How the money moves</h2><span className="label">per token</span></div>
        <ol className="events" style={{ marginTop: 22 }}>
          <li><span className="m">At launch</span><span className="t">A dedicated engine vault becomes the coin&rsquo;s creator-fee recipient</span><span className="d">The user still launches and pays from their own wallet. The vault only ever receives that coin&rsquo;s creator fees.</span></li>
          <li><span className="m">Every 30 min</span><span className="t">Claim</span><span className="d">The engine claims the vault&rsquo;s creator fees. The amount recorded is what the claim transaction actually moved.</span></li>
          <li><span className="m">Same run</span><span className="t">Split 80 / 20</span><span className="d">20% is transferred to the STM treasury in its own transaction. 80% is booked to that token&rsquo;s liquidity reserve and stays in its vault.</span></li>
          <li><span className="m">After graduation</span><span className="t">Reinvest</span><span className="d">Bonding curves have no pool to add to, so the reserve waits. Once the token trades on PumpSwap, Raydium CPMM or Meteora DAMM v2, half buys the token and both halves are deposited.</span></li>
          <li><span className="m">Then</span><span className="t">Lock where the venue allows it</span><span className="d">Raydium: Burn &amp; Earn, locked forever. Meteora: permanently locked position. PumpSwap has no lock, so that LP stays in the vault and is labelled as held, not locked.</span></li>
        </ol>
      </section>

      <section className="section">
        <div className="section-head"><h2>Tokens with the engine on</h2><span className="label">{engineTokens.length}</span></div>
        {engineTokens.length === 0 ? <div className="empty">No launches have turned the engine on yet. <Link href="/launch">Launch one with it.</Link></div> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Token</th><th>Venue</th><th>Engine vault</th><th className="num">Claimed</th><th className="num">Treasury</th><th className="num">Reserve</th><th className="num">Reinvested</th><th>LP</th></tr></thead>
              <tbody>
                {engineTokens.map((l) => {
                  const rows = ledger.filter((e) => e.mint === l.mint);
                  const t = totals(rows);
                  const lp = rows.find((e) => e.lpStatus)?.lpStatus;
                  return (
                    <tr key={l.mint}>
                      <td><Link href={`/token/${l.mint}`}>{l.name} <span className="mono dim">${l.symbol}</span></Link></td>
                      <td className="mono">{l.venue}</td>
                      <td className="mono"><a href={solscanAccount(l.vaultAddress!)} target="_blank" rel="noreferrer">{short(l.vaultAddress!)}</a></td>
                      <td className="num">{sol(t.claimed)}</td>
                      <td className="num">{sol(t.treasury)}</td>
                      <td className="num">{sol(t.pending)}</td>
                      <td className="num">{sol(t.deployed)}</td>
                      <td>{lp ? <span className="pill">{LP_LABEL[lp] ?? lp}</span> : <span className="dim">none yet</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head"><h2>Transaction ledger</h2><span className="label">newest first</span></div>
        {ledger.length === 0 ? <div className="empty">No engine transactions yet.</div> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Token</th><th>Step</th><th className="num">SOL</th><th>LP</th><th>Transaction</th></tr></thead>
              <tbody>
                {ledger.map((e) => {
                  const l = launches.find((x) => x.mint === e.mint);
                  return (
                    <tr key={e.id}>
                      <td className="mono dim">{date(e.createdAt)}</td>
                      <td><Link href={`/token/${e.mint}`}>{l ? `$${l.symbol}` : short(e.mint)}</Link></td>
                      <td>{e.kind.replace('_', ' ')}<div className="hint">{e.note}</div></td>
                      <td className="num">{sol(BigInt(e.lamports))}</td>
                      <td>{e.lpStatus ? <span className="pill">{LP_LABEL[e.lpStatus] ?? e.lpStatus}</span> : <span className="dim">—</span>}</td>
                      <td className="mono">{e.signature ? <a href={solscanTx(e.signature)} target="_blank" rel="noreferrer">{short(e.signature, 6)}</a> : <span className="dim">ledger entry, no transfer</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head"><h2>Ownership, plainly</h2></div>
        <div className="prose" style={{ marginTop: 14 }}>
          <ul>
            <li><b>Creator fees</b> belong to the engine vault for that token. The vault keys are generated by STM and stored encrypted; STM operates them only to claim, split and reinvest.</li>
            <li><b>Reserve</b> is SOL already claimed and booked for liquidity but not yet deposited. It sits in the vault and is shown as &ldquo;awaiting deployment&rdquo;.</li>
            <li><b>Reinvested fees</b> are reserve that was swapped and deposited into the token&rsquo;s AMM pool, each step with its own transaction.</li>
            <li><b>LP ownership</b>: on PumpSwap the vault holds the LP tokens (no lock exists there). On Raydium they are locked forever via Burn &amp; Earn; on Meteora the position is permanently locked. Locked liquidity cannot be withdrawn by anyone, STM included.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
