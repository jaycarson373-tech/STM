import Link from 'next/link';
import { ERAS, YEARS, eraOf, relicOfTheDay, type EraYear } from '@/data/eras';
import TimeMachine from '@/components/TimeMachine';
import TokenImage from '@/components/TokenImage';
import { eraStats, leaderboard, loadArchive, loadLaunches } from '@/lib/eraData';
import { trendingSolana } from '@/lib/market';
import { pct, usd } from '@/lib/format';

export const revalidate = 60;

export default async function Home({ searchParams }: { searchParams: Promise<{ y?: string }> }) {
  const { y } = await searchParams;
  const initialYear = (YEARS.includes(Number(y) as EraYear) ? Number(y) : 2021) as EraYear;
  const [{ relics, fetchedAt }, launches, trending] = await Promise.all([loadArchive(), loadLaunches(), trendingSolana(6)]);
  const stats = eraStats(relics, launches);
  const board = leaderboard(stats);
  const relic = relicOfTheDay();
  const relicLive = relics.find((r) => r.mint === relic.mint)?.live ?? null;
  const relicEra = eraOf(relic.year)!;
  const maxActivity = Math.max(1, ...board.map((b) => b.activity));

  return (
    <>
      <TimeMachine eras={ERAS} relics={relics} stats={stats} launches={launches} trending={trending} fetchedAt={fetchedAt} initialYear={initialYear} />

      <div className="wrap">
        <section className="section" style={{ ['--era' as string]: relicEra.accent }}>
          <div className="section-head">
            <h2>Relic of the day</h2>
            <span className="label">{new Date().toISOString().slice(0, 10)} · same for everyone</span>
          </div>
          <div className="featured">
            <TokenImage src={relicLive?.imageUrl} symbol={relic.symbol} className="" />
            <div>
              <span className="pill era">{relic.year} · {relicEra.codename}</span>
              <h3>{relic.name} <span className="mono dim" style={{ fontSize: 16 }}>${relic.symbol}</span></h3>
              <p>{relic.note}</p>
              <p className="mono dim" style={{ fontSize: 12.5 }}>
                {relicLive ? `${usd(relicLive.priceUsd)} · mcap ${usd(relicLive.marketCap ?? relicLive.fdv)} · 24h ${pct(relicLive.change24h)}` : 'No live market right now'}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link className="btn" href={`/token/${relic.mint}`}>Open profile</Link>
              <Link className="btn btn-era" href={`/launch?tribute=${relic.mint}`}>Revive the narrative</Link>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <h2>Era leaderboard</h2>
            <span className="label">ranked by today&rsquo;s trading activity</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>#</th><th>Era</th><th>Activity</th><th className="num">Relics 24h vol</th><th className="num">STM launches</th><th className="num">STM 24h vol</th></tr>
              </thead>
              <tbody>
                {board.map((b, i) => {
                  const e = eraOf(b.year)!;
                  return (
                    <tr key={b.year} style={{ ['--era' as string]: e.accent }}>
                      <td className="mono dim">{String(i + 1).padStart(2, '0')}</td>
                      <td><Link href={`/eras/${b.year}`}><span className="serif" style={{ fontSize: 18 }}>{e.codename}</span> <span className="mono dim">{b.year}</span></Link></td>
                      <td style={{ width: '28%' }}><div className="bar"><i style={{ width: `${(b.activity / maxActivity) * 100}%` }} /></div></td>
                      <td className="num">{b.year === 2026 ? '—' : usd(b.volume24h)}</td>
                      <td className="num">{b.stmLaunches}</td>
                      <td className="num">{usd(b.stmVolume24h)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="hint" style={{ marginTop: 12 }}>Activity is the 24h DexScreener volume of each era&rsquo;s archived tokens plus the STM launches inspired by that era. Original launches without an era count toward 2026.</p>
        </section>
      </div>
    </>
  );
}
