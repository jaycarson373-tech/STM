import Link from 'next/link';
import type { Metadata } from 'next';
import { ERAS } from '@/data/eras';
import { eraStats, loadArchive, loadLaunches } from '@/lib/eraData';
import { usd } from '@/lib/format';

export const revalidate = 120;
export const metadata: Metadata = { title: 'Explore Eras' };

export default async function Eras() {
  const [{ relics }, launches] = await Promise.all([loadArchive(), loadLaunches()]);
  const stats = eraStats(relics, launches);
  return (
    <div className="wrap page">
      <div className="page-head">
        <div>
          <span className="label">Explore eras</span>
          <h1>Six years, six moods.</h1>
          <p>Every year of Solana had its own memes, its own disasters and its own way of launching a coin. Open one to see its relics, events and what they trade at today.</p>
        </div>
      </div>
      <div>
        {ERAS.map((e) => {
          const s = stats.find((x) => x.year === e.year)!;
          return (
            <Link key={e.year} href={`/eras/${e.year}`} className="era-row" style={{ ['--era' as string]: e.accent }}>
              <span className="mono dim">{e.year}</span>
              <span className="era-row-title serif">{e.codename}<em>.</em></span>
              <span className="muted era-row-tag">{e.tagline}</span>
              <span className="mono era-row-num">{e.year === 2026 ? `${s.stmLaunches} STM launches` : `${s.tracked} relics · ${usd(s.volume24h)} 24h`}</span>
              <span className="era-row-arrow" aria-hidden>→</span>
            </Link>
          );
        })}
      </div>
      <style>{`
        .era-row { display: grid; grid-template-columns: 64px minmax(0, 1fr) minmax(0, 1fr) auto 24px; gap: 24px; align-items: center; padding: 26px 4px; border-bottom: 1px solid var(--line); transition: padding .35s var(--ease), background .3s; }
        .era-row:first-child { border-top: 1px solid var(--line); }
        .era-row:hover { padding-left: 16px; background: linear-gradient(90deg, color-mix(in srgb, var(--era) 7%, transparent), transparent 60%); }
        .era-row-title { font-size: 36px; line-height: 1; }
        .era-row-title em { color: var(--era); }
        .era-row-num { font-size: 13px; color: var(--muted); text-align: right; }
        .era-row-arrow { color: var(--era); transition: transform .3s var(--ease); }
        .era-row:hover .era-row-arrow { transform: translateX(4px); }
        @media (max-width: 760px) { .era-row { grid-template-columns: 52px 1fr 20px; } .era-row-tag, .era-row-num { display: none; } .era-row-title { font-size: 28px; } }
      `}</style>
    </div>
  );
}
