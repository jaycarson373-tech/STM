import Link from 'next/link';
import type { Metadata } from 'next';
import { eraOf } from '@/data/eras';
import TokenImage from '@/components/TokenImage';
import { loadArchive, loadLaunches } from '@/lib/eraData';
import { date, pct, usd } from '@/lib/format';

export const revalidate = 30;
export const metadata: Metadata = { title: 'Markets' };

type Q = { venue?: string; era?: string; kind?: string; sort?: string };

export default async function Markets({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams;
  const [launches, { relics, fetchedAt }] = await Promise.all([loadLaunches(500), loadArchive()]);
  let rows = launches;
  if (q.venue) rows = rows.filter((l) => l.venue === q.venue);
  if (q.era) rows = rows.filter((l) => String(l.era) === q.era);
  if (q.kind) rows = rows.filter((l) => l.kind === q.kind);
  const sort = q.sort || 'new';
  rows = [...rows].sort((a, b) =>
    sort === 'volume' ? (b.live?.volume24h ?? 0) - (a.live?.volume24h ?? 0)
      : sort === 'mcap' ? (b.live?.marketCap ?? 0) - (a.live?.marketCap ?? 0)
        : b.createdAt.localeCompare(a.createdAt));
  const hottest = [...relics].filter((r) => r.live).sort((a, b) => (b.live!.volume24h ?? 0) - (a.live!.volume24h ?? 0)).slice(0, 8);

  const chip = (key: keyof Q, value: string | undefined, label: string) => {
    const next = new URLSearchParams(Object.entries({ ...q, [key]: value }).filter(([, v]) => v) as [string, string][]);
    const on = (q[key] || undefined) === value;
    return <Link key={`${key}-${label}`} className={`pill${on ? ' era' : ''}`} href={`/markets${next.size ? `?${next}` : ''}`}>{label}</Link>;
  };

  return (
    <div className="wrap page">
      <div className="page-head">
        <div>
          <span className="label">Markets · discovery terminal</span>
          <h1>Everything launched through the machine.</h1>
          <p>Only launches confirmed on-chain appear here. Prices refresh every 30 seconds from DexScreener; a brand-new token can take a few minutes to be indexed.</p>
        </div>
        <Link className="btn btn-primary" href="/launch">Launch a token</Link>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="label" style={{ marginRight: 4 }}>Venue</span>
        {chip('venue', undefined, 'All')}{chip('venue', 'pump', 'Pump.fun')}{chip('venue', 'raydium', 'LaunchLab')}{chip('venue', 'meteora', 'Meteora')}
        <span className="label" style={{ margin: '0 4px 0 16px' }}>Type</span>
        {chip('kind', undefined, 'All')}{chip('kind', 'original', 'Original')}{chip('kind', 'inspired', 'Inspired')}{chip('kind', 'tribute', 'Tribute')}
        <span className="label" style={{ margin: '0 4px 0 16px' }}>Sort</span>
        {chip('sort', undefined, 'Newest')}{chip('sort', 'volume', '24h volume')}{chip('sort', 'mcap', 'Market cap')}
      </div>

      <div className="table-wrap" style={{ marginTop: 18 }}>
        <table className="table">
          <thead><tr><th>Token</th><th>Type</th><th>Venue</th><th>Engine</th><th className="num">Mcap</th><th className="num">Liquidity</th><th className="num">24h vol</th><th className="num">24h</th><th className="num">Launched</th></tr></thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9}><div className="empty">No STM launches match{q.venue || q.kind || q.era ? ' these filters' : ' yet'}. <Link href="/launch">Launch the first one.</Link></div></td></tr>
            )}
            {rows.map((l) => {
              const e = l.era ? eraOf(l.era) : null;
              return (
                <tr key={l.mint} style={e ? { ['--era' as string]: e.accent } : undefined}>
                  <td><Link className="tok" href={`/token/${l.mint}`}><TokenImage src={l.live?.imageUrl || l.imageUrl} symbol={l.symbol} className="" /><span>{l.name} <span className="mono dim">${l.symbol}</span></span></Link></td>
                  <td>{l.kind === 'tribute' ? <span className="pill warn">tribute</span> : l.kind === 'inspired' ? <span className="pill era">{l.era}</span> : <span className="pill">original</span>}</td>
                  <td className="mono">{l.venue}</td>
                  <td>{l.engine ? <span className="pill ok">on</span> : <span className="dim">off</span>}</td>
                  <td className="num">{usd(l.live?.marketCap ?? l.live?.fdv)}</td>
                  <td className="num">{usd(l.live?.liquidityUsd)}</td>
                  <td className="num">{usd(l.live?.volume24h)}</td>
                  <td className={`num ${(l.live?.change24h ?? 0) >= 0 ? 'up' : 'down'}`}>{pct(l.live?.change24h)}</td>
                  <td className="num dim">{date(l.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="section">
        <div className="section-head"><h2>Most active relics today</h2><span className="label">archive · {new Date(fetchedAt).toISOString().slice(11, 16)} UTC</span></div>
        <div className="relics">
          {hottest.map((r) => {
            const e = eraOf(r.year)!;
            return (
              <Link key={r.mint} href={`/token/${r.mint}`} className="relic" style={{ ['--era' as string]: e.accent }}>
                <TokenImage src={r.live?.imageUrl} symbol={r.symbol} />
                <div style={{ minWidth: 0 }}><div className="relic-name">{r.name}<span className="sym">${r.symbol}</span></div><div className="relic-note">{r.year} · {e.codename}</div></div>
                <div className="relic-num">{usd(r.live?.volume24h)}<small>24h volume</small></div>
                <div className={`relic-chg ${(r.live?.change24h ?? 0) >= 0 ? 'up' : 'down'}`}>{pct(r.live?.change24h)}</div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
