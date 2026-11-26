import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ERAS, eraOf } from '@/data/eras';
import TokenImage from '@/components/TokenImage';
import { eraStats, loadArchive, loadLaunches } from '@/lib/eraData';
import { trendingSolana } from '@/lib/market';
import { pct, short, usd } from '@/lib/format';

export const revalidate = 120;
export function generateStaticParams() { return ERAS.map((e) => ({ year: String(e.year) })); }
export async function generateMetadata({ params }: { params: Promise<{ year: string }> }): Promise<Metadata> {
  const e = eraOf(Number((await params).year));
  return { title: e ? `${e.year} · ${e.codename}` : 'Era' };
}

export default async function EraPage({ params }: { params: Promise<{ year: string }> }) {
  const year = Number((await params).year);
  const era = eraOf(year);
  if (!era) notFound();
  const [{ relics, fetchedAt }, launches, trending] = await Promise.all([loadArchive(), loadLaunches(), year === 2026 ? trendingSolana(10) : Promise.resolve([])]);
  const st = eraStats(relics, launches).find((s) => s.year === year)!;
  const mine = relics.filter((r) => r.year === year).sort((a, b) => (b.live?.marketCap ?? 0) - (a.live?.marketCap ?? 0));
  const inspired = launches.filter((l) => l.era === year || (year === 2026 && l.era === null));
  const i = ERAS.findIndex((e) => e.year === year);
  const prev = ERAS[i - 1], next = ERAS[i + 1];

  return (
    <div className="era-scope" data-mood={era.mood} style={{ ['--era' as string]: era.accent }}>
      <div className="wrap page">
        <div className="era-kicker"><span className="dot" /><span className="label">Era {String(i + 1).padStart(2, '0')} / 06 · {era.year}</span></div>
        <h1 className="era-title">{era.codename}<em>.</em></h1>
        <p className="era-tagline">{era.tagline}</p>
        <p className="era-narrative">{era.narrative}</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 26, flexWrap: 'wrap' }}>
          <Link className="btn btn-era" href={`/launch?era=${year}`}>Launch something inspired by {year}</Link>
          <Link className="btn" href={`/?y=${year}`}>View in the Time Machine</Link>
        </div>

        <div className="kv">
          <div><span className="label">Relics</span><span className="stat-v">{st.tracked}</span><span className="stat-src">verified mints</span></div>
          <div><span className="label">Combined mcap</span><span className="stat-v">{year === 2026 ? '—' : usd(st.marketCap)}</span><span className="stat-src">today, DexScreener</span></div>
          <div><span className="label">24h volume</span><span className="stat-v">{year === 2026 ? usd(st.stmVolume24h) : usd(st.volume24h)}</span><span className="stat-src">today, DexScreener</span></div>
          <div><span className="label">STM launches</span><span className="stat-v">{st.stmLaunches}</span><span className="stat-src">inspired by this era</span></div>
        </div>

        {era.events.length > 0 && (
          <section className="section">
            <div className="section-head"><h2>What happened</h2><span className="label">editorial · month precision</span></div>
            <ol className="events" style={{ marginTop: 22 }}>
              {era.events.map((ev) => (<li key={ev.title}><span className="m">{ev.month}</span><span className="t">{ev.title}</span><span className="d">{ev.detail}</span></li>))}
            </ol>
          </section>
        )}

        {mine.length > 0 && (
          <section className="section">
            <div className="section-head"><h2>Relics of {year}</h2><span className="label">live · {new Date(fetchedAt).toISOString().slice(11, 16)} UTC</span></div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Token</th><th>Contract</th><th className="num">Price</th><th className="num">Mcap</th><th className="num">Liquidity</th><th className="num">24h vol</th><th className="num">24h</th><th /></tr></thead>
                <tbody>
                  {mine.map((r) => (
                    <tr key={r.mint}>
                      <td><Link href={`/token/${r.mint}`} className="tok"><TokenImage src={r.live?.imageUrl} symbol={r.symbol} className="" /><span>{r.name} <span className="mono dim">${r.symbol}</span></span></Link></td>
                      <td className="mono dim">{short(r.mint)}</td>
                      <td className="num">{usd(r.live?.priceUsd)}</td>
                      <td className="num">{usd(r.live?.marketCap ?? r.live?.fdv)}</td>
                      <td className="num">{usd(r.live?.liquidityUsd)}</td>
                      <td className="num">{usd(r.live?.volume24h)}</td>
                      <td className={`num ${(r.live?.change24h ?? 0) >= 0 ? 'up' : 'down'}`}>{pct(r.live?.change24h)}</td>
                      <td className="num"><Link className="btn btn-sm" href={`/launch?tribute=${r.mint}`}>Revive</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="section">
          <div className="section-head"><h2>{year === 2026 ? 'Launched through STM' : `Inspired by ${year}`}</h2><span className="label">confirmed on-chain</span></div>
          {inspired.length === 0 ? (
            <div className="empty">Nothing yet. <Link href={`/launch?era=${year}`}>Launch the first one.</Link></div>
          ) : (
            <div className="relics">
              {inspired.map((l) => (
                <Link key={l.mint} href={`/token/${l.mint}`} className="relic">
                  <TokenImage src={l.live?.imageUrl || l.imageUrl} symbol={l.symbol} />
                  <div style={{ minWidth: 0 }}><div className="relic-name">{l.name}<span className="sym">${l.symbol}</span></div><div className="relic-note">{l.kind} · {l.venue}</div></div>
                  <div className="relic-num">{usd(l.live?.marketCap ?? l.live?.fdv)}<small>mcap</small></div>
                  <div className={`relic-chg ${(l.live?.change24h ?? 0) >= 0 ? 'up' : 'down'}`}>{pct(l.live?.change24h)}</div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {year === 2026 && (
          <section className="section">
            <div className="section-head"><h2>Trending on Solana now</h2><span className="label">GeckoTerminal</span></div>
            {trending.length === 0 ? <div className="empty">GeckoTerminal did not respond. Try again shortly.</div> : (
              <div className="relics">
                {trending.map((t) => (
                  <a key={t.poolAddress} href={`https://www.geckoterminal.com/solana/pools/${t.poolAddress}`} target="_blank" rel="noreferrer" className="relic">
                    <TokenImage symbol={t.name.split(' / ')[0] || '?'} />
                    <div style={{ minWidth: 0 }}><div className="relic-name">{t.name}</div><div className="relic-note mono">{short(t.mint)}</div></div>
                    <div className="relic-num">{usd(t.volume24h)}<small>24h volume</small></div>
                    <div className={`relic-chg ${(t.change24h ?? 0) >= 0 ? 'up' : 'down'}`}>{pct(t.change24h)}</div>
                  </a>
                ))}
              </div>
            )}
          </section>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 64 }}>
          {prev ? <Link className="btn" href={`/eras/${prev.year}`}>← {prev.year} {prev.codename}</Link> : <span />}
          {next ? <Link className="btn" href={`/eras/${next.year}`}>{next.year} {next.codename} →</Link> : <span />}
        </div>
      </div>
    </div>
  );
}
