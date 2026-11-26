import Link from 'next/link';
import type { Metadata } from 'next';
import { archiveToken, eraOf } from '@/data/eras';
import Chart from '@/components/Chart';
import CopyText from '@/components/CopyText';
import TokenImage from '@/components/TokenImage';
import { liveTokens, tokenHistory } from '@/lib/market';
import { events, getLaunchByMint, publicLaunch } from '@/lib/store';
import { totals } from '@/lib/engine';
import { date, pct, short, sol, solscanAccount, solscanToken, solscanTx, usd } from '@/lib/format';
import { isAddress } from '@/lib/solana';

export const revalidate = 120;

export async function generateMetadata({ params }: { params: Promise<{ mint: string }> }): Promise<Metadata> {
  const { mint } = await params;
  const a = archiveToken(mint);
  return { title: a ? `${a.name} ($${a.symbol})` : `Token ${short(mint)}` };
}

export default async function TokenPage({ params }: { params: Promise<{ mint: string }> }) {
  const { mint } = await params;
  if (!isAddress(mint)) return <div className="wrap page"><div className="empty">That is not a Solana address.</div></div>;

  const relic = archiveToken(mint);
  const launchRow = await getLaunchByMint(mint);
  const launch = launchRow && launchRow.status === 'live' ? publicLaunch(launchRow) : null;
  const [liveMap, history, ledger] = await Promise.all([liveTokens([mint]), tokenHistory(mint), launch ? events({ mint, limit: 300 }) : Promise.resolve([])]);
  const live = liveMap.get(mint) ?? null;
  const era = eraOf(relic?.year ?? launch?.era ?? 2026)!;
  const name = relic?.name ?? launch?.name ?? live?.name ?? 'Unknown token';
  const symbol = relic?.symbol ?? launch?.symbol ?? live?.symbol ?? '???';
  const t = totals(ledger);
  const tributeOrig = launch?.tributeOf ? archiveToken(launch.tributeOf) : null;

  return (
    <div className="era-scope" data-mood={era.mood} style={{ ['--era' as string]: era.accent }}>
      <div className="wrap page">
        <div className="token-head">
          <TokenImage src={live?.imageUrl || launch?.imageUrl} symbol={symbol} className="" />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {relic && <span className="pill era">{relic.year} · {era.codename} relic</span>}
              {launch && <span className="pill era">Launched via STM · {launch.venue}</span>}
              {launch?.kind === 'tribute' && <span className="pill warn">Unofficial tribute</span>}
              {launch?.engine && <span className="pill ok">Liquidity Engine</span>}
              {!relic && !launch && <span className="pill">Not in the archive</span>}
            </div>
            <h1>{name} <span className="mono dim" style={{ fontSize: 18 }}>${symbol}</span></h1>
            <CopyText text={mint} display={`${relic ? 'Original CA' : 'CA'} ${short(mint, 6)}`} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {relic && <Link className="btn btn-era" href={`/launch?tribute=${mint}`}>Revive this narrative</Link>}
            <a className="btn" href={live?.pairUrl || `https://dexscreener.com/solana/${mint}`} target="_blank" rel="noreferrer">DexScreener</a>
            <a className="btn" href={solscanToken(mint)} target="_blank" rel="noreferrer">Solscan</a>
          </div>
        </div>

        {relic && <div className="note-box">{relic.note}</div>}
        {tributeOrig && (
          <div className="note-box">Unofficial tribute to <Link href={`/token/${tributeOrig.mint}`} className="up">{tributeOrig.name} (${tributeOrig.symbol})</Link>. Not affiliated with the original project.</div>
        )}

        <div className="kv">
          <div><span className="label">Price</span><span className="stat-v">{usd(live?.priceUsd)}</span><span className="stat-src">DexScreener, live</span></div>
          <div><span className="label">Market cap</span><span className="stat-v">{usd(live?.marketCap ?? live?.fdv)}</span><span className="stat-src">{pct(live?.change24h)} 24h</span></div>
          <div><span className="label">Liquidity</span><span className="stat-v">{usd(live?.liquidityUsd)}</span><span className="stat-src">deepest pair · {live?.dexId ?? '—'}</span></div>
          <div><span className="label">24h volume</span><span className="stat-v">{usd(live?.volume24h)}</span><span className="stat-src">DexScreener, live</span></div>
        </div>

        <div className="kv" style={{ marginTop: -1 }}>
          <div><span className="label">Earliest indexed pool</span><span className="stat-v" style={{ fontSize: 16 }}>{date(history.earliestPoolAt)}</span><span className="stat-src">GeckoTerminal, of {history.poolCount} pools</span></div>
          <div><span className="label">Chart window</span><span className="stat-v" style={{ fontSize: 16 }}>{history.windowFrom ? `${date(history.windowFrom)} → ${date(history.windowTo)}` : '—'}</span><span className="stat-src">daily candles, top pool</span></div>
          <div><span className="label">Peak in window</span><span className="stat-v" style={{ fontSize: 16 }}>{usd(history.peak?.price)}</span><span className="stat-src">{history.peak ? `daily high on ${date(history.peak.at)}` : 'not available'}</span></div>
          <div><span className="label">All-time peak mcap</span><span className="stat-v" style={{ fontSize: 16 }}>Not verifiable</span><span className="stat-src">see Docs: data honesty</span></div>
        </div>

        <div className="chart">
          <Chart candles={history.candles} accent={era.accent} />
          <div className="chart-foot">
            <span>Daily close (line) and high–low range (band), log scale.</span>
            <span>{history.poolAddress ? <>Pool {short(history.poolAddress)} · {history.poolDex}</> : 'No pool data'} · GeckoTerminal</span>
          </div>
        </div>

        {launch && (
          <section className="section">
            <div className="section-head"><h2>Launch record</h2><span className="label">from the STM registry</span></div>
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  <tr><td className="dim">Venue</td><td className="mono">{launch.venue}</td></tr>
                  <tr><td className="dim">Launched by</td><td className="mono"><a href={solscanAccount(launch.wallet)} target="_blank" rel="noreferrer">{short(launch.wallet, 6)}</a></td></tr>
                  <tr><td className="dim">Creator-fee recipient</td><td className="mono"><a href={solscanAccount(launch.feeCreator)} target="_blank" rel="noreferrer">{short(launch.feeCreator, 6)}</a> {launch.engine ? <span className="pill ok">engine vault</span> : <span className="pill">creator wallet</span>}</td></tr>
                  <tr><td className="dim">Create transaction</td><td className="mono">{launch.createSig ? <a href={solscanTx(launch.createSig)} target="_blank" rel="noreferrer">{short(launch.createSig, 8)}</a> : '—'}</td></tr>
                  <tr><td className="dim">Launched</td><td className="mono">{date(launch.createdAt)}</td></tr>
                  <tr><td className="dim">Type</td><td className="mono">{launch.kind}{launch.era ? ` · ${launch.era}` : ''}</td></tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {launch?.engine && (
          <section className="section">
            <div className="section-head"><h2>Liquidity Engine for ${symbol}</h2><Link className="label" href="/engine">full ledger →</Link></div>
            <div className="kv" style={{ marginTop: 0 }}>
              <div><span className="label">Fees claimed</span><span className="stat-v">{sol(t.claimed)}</span><span className="stat-src">confirmed claims</span></div>
              <div><span className="label">To treasury (20%)</span><span className="stat-v">{sol(t.treasury)}</span><span className="stat-src">confirmed transfers</span></div>
              <div><span className="label">Awaiting deployment</span><span className="stat-v">{sol(t.pending)}</span><span className="stat-src">held in the vault</span></div>
              <div><span className="label">Added to liquidity</span><span className="stat-v">{sol(t.deployed)}</span><span className="stat-src">{t.deposits} deposits · {t.locks} locks</span></div>
            </div>
            <EngineTable rows={ledger} />
          </section>
        )}
      </div>
    </div>
  );
}

function EngineTable({ rows }: { rows: Awaited<ReturnType<typeof events>> }) {
  if (!rows.length) return <div className="empty">No engine activity yet. Fees are claimed on a schedule once trading starts.</div>;
  return (
    <div className="table-wrap" style={{ marginTop: 10 }}>
      <table className="table">
        <thead><tr><th>When</th><th>Step</th><th className="num">SOL</th><th>LP status</th><th>Transaction</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="mono dim">{r.createdAt.slice(0, 16).replace('T', ' ')}</td>
              <td>{r.kind.replace('_', ' ')}<div className="hint">{r.note}</div></td>
              <td className="num">{sol(BigInt(r.lamports))}</td>
              <td>{r.lpStatus ? <span className="pill">{r.lpStatus.replaceAll('_', ' ')}</span> : <span className="dim">—</span>}</td>
              <td className="mono">{r.signature ? <a href={solscanTx(r.signature)} target="_blank" rel="noreferrer">{short(r.signature, 6)}</a> : <span className="dim">ledger entry</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
