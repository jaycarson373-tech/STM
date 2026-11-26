'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Era, EraYear } from '@/data/eras';
import type { EraStats, LiveRelic, PublicLaunch } from '@/lib/eraData';
import type { TrendingPool } from '@/lib/market';
import { pct, usd } from '@/lib/format';
import TokenImage from './TokenImage';

interface Props {
  eras: Era[];
  relics: LiveRelic[];
  stats: EraStats[];
  launches: PublicLaunch[];
  trending: TrendingPool[];
  fetchedAt: string;
  initialYear: EraYear;
}

export default function TimeMachine({ eras, relics, stats, launches, trending, fetchedAt, initialYear }: Props) {
  const [year, setYear] = useState<EraYear>(initialYear);
  const [shown, setShown] = useState<EraYear>(initialYear);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idx = eras.findIndex((e) => e.year === shown);
  const era = eras[idx];
  const st = stats.find((s) => s.year === shown)!;

  const travel = useCallback((to: EraYear) => {
    if (to === year) return;
    setYear(to);
    setLeaving(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { setShown(to); setLeaving(false); }, 260);
    const url = new URL(window.location.href);
    url.searchParams.set('y', String(to));
    window.history.replaceState(null, '', url);
  }, [year]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return;
      const i = eras.findIndex((x) => x.year === year);
      if (e.key === 'ArrowRight' && i < eras.length - 1) travel(eras[i + 1].year);
      if (e.key === 'ArrowLeft' && i > 0) travel(eras[i - 1].year);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [eras, year, travel]);

  const target = eras.find((e) => e.year === year)!;
  const progress = ((eras.findIndex((e) => e.year === year) + 0.5) / eras.length) * 100;
  const yearRelics = relics.filter((r) => r.year === shown).sort((a, b) => (b.live?.marketCap ?? 0) - (a.live?.marketCap ?? 0));
  const isNow = shown === 2026;

  return (
    <div className="era-scope machine" data-mood={target.mood} style={{ ['--era' as string]: target.accent }}>
      <div className="wrap">
        <div className="rail" role="group" aria-label="Choose a year">
          <div className="rail-track" style={{ ['--progress' as string]: `${progress}%` }}>
            <span className="rail-ticks" />
            {eras.map((e) => (
              <button key={e.year} className="rail-year" aria-pressed={e.year === year} onClick={() => travel(e.year)}>
                <span className="y">{e.year}</span>
                <span className="c">{e.codename}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={`machine-grid era-stage${leaving ? ' is-leaving' : ''}`}>
          <section aria-live="polite">
            <div className="era-kicker">
              <span className="dot" />
              <span className="label">Era {String(idx + 1).padStart(2, '0')} / 06 · {era.year}</span>
            </div>
            <h1 className="era-title">{era.codename}<em>.</em></h1>
            <p className="era-tagline">{era.tagline}</p>
            <p className="era-narrative">{era.narrative}</p>
            {era.events.length > 0 && (
              <ol className="events">
                {era.events.map((ev) => (
                  <li key={ev.title}>
                    <span className="m">{ev.month}</span>
                    <span className="t">{ev.title}</span>
                    <span className="d">{ev.detail}</span>
                  </li>
                ))}
              </ol>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 30, flexWrap: 'wrap' }}>
              <Link className="btn btn-era" href={`/launch?era=${era.year}`}>Launch from {era.year}</Link>
              <Link className="btn" href={`/eras/${era.year}`}>Open the {era.codename} archive</Link>
            </div>
          </section>

          <section>
            <div className="era-stats">
              {isNow ? (
                <>
                  <div><span className="label">STM launches</span><span className="stat-v">{launches.length}</span><span className="stat-src">confirmed on-chain</span></div>
                  <div><span className="label">Their 24h volume</span><span className="stat-v">{usd(launches.reduce((a, l) => a + (l.live?.volume24h ?? 0), 0))}</span><span className="stat-src">DexScreener, live</span></div>
                  <div><span className="label">Trending pools</span><span className="stat-v">{trending.length}</span><span className="stat-src">GeckoTerminal, live</span></div>
                </>
              ) : (
                <>
                  <div><span className="label">Relics tracked</span><span className="stat-v">{st.tracked}</span><span className="stat-src">{st.priced} with a live market</span></div>
                  <div><span className="label">Combined mcap today</span><span className="stat-v">{usd(st.marketCap)}</span><span className="stat-src">DexScreener, live</span></div>
                  <div><span className="label">24h volume today</span><span className="stat-v">{usd(st.volume24h)}</span><span className="stat-src">{st.topMover ? `top mover ${st.topMover.symbol} ${pct(st.topMover.change)}` : 'DexScreener, live'}</span></div>
                </>
              )}
            </div>

            {isNow ? (
              <NowPanel launches={launches} trending={trending} />
            ) : (
              <div className="relics">
                {yearRelics.map((r) => (
                  <Link key={r.mint} href={`/token/${r.mint}`} className="relic">
                    <TokenImage src={r.live?.imageUrl} symbol={r.symbol} />
                    <div style={{ minWidth: 0 }}>
                      <div className="relic-name">{r.name}<span className="sym">${r.symbol}</span></div>
                      <div className="relic-note">{r.note}</div>
                    </div>
                    <div className="relic-num">{usd(r.live?.marketCap ?? r.live?.fdv)}<small>mcap today</small></div>
                    <div className={`relic-chg ${(r.live?.change24h ?? 0) >= 0 ? 'up' : 'down'}`}>{pct(r.live?.change24h)}</div>
                  </Link>
                ))}
              </div>
            )}
            <p className="hint" style={{ marginTop: 14 }}>Live figures fetched {new Date(fetchedAt).toISOString().slice(11, 16)} UTC. Historical figures are never stored or estimated. Use ← → to travel.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

function NowPanel({ launches, trending }: { launches: PublicLaunch[]; trending: TrendingPool[] }) {
  return (
    <div className="relics">
      <div className="label" style={{ padding: '16px 4px 6px' }}>Launched through STM</div>
      {launches.length === 0 && (
        <div className="empty">No tokens have launched through the Time Machine yet. <Link href="/launch">Be the first.</Link></div>
      )}
      {launches.slice(0, 6).map((l) => (
        <Link key={l.mint} href={`/token/${l.mint}`} className="relic">
          <TokenImage src={l.live?.imageUrl || l.imageUrl} symbol={l.symbol} />
          <div style={{ minWidth: 0 }}>
            <div className="relic-name">{l.name}<span className="sym">${l.symbol}</span></div>
            <div className="relic-note">{l.kind === 'tribute' ? 'Unofficial tribute' : l.kind === 'inspired' ? `Inspired by ${l.era}` : 'Original'} · {l.venue}{l.engine ? ' · Liquidity Engine' : ''}</div>
          </div>
          <div className="relic-num">{usd(l.live?.marketCap ?? l.live?.fdv)}<small>mcap</small></div>
          <div className={`relic-chg ${(l.live?.change24h ?? 0) >= 0 ? 'up' : 'down'}`}>{pct(l.live?.change24h)}</div>
        </Link>
      ))}
      <div className="label" style={{ padding: '22px 4px 6px' }}>Trending on Solana right now</div>
      {trending.length === 0 && <div className="empty">GeckoTerminal did not respond. Try again in a minute.</div>}
      {trending.map((t) => (
        <a key={t.poolAddress} href={`https://www.geckoterminal.com/solana/pools/${t.poolAddress}`} target="_blank" rel="noreferrer" className="relic">
          <TokenImage symbol={t.name.split(' / ')[0] || '?'} />
          <div style={{ minWidth: 0 }}><div className="relic-name">{t.name}</div><div className="relic-note">GeckoTerminal trending pool</div></div>
          <div className="relic-num">{usd(t.volume24h)}<small>24h volume</small></div>
          <div className={`relic-chg ${(t.change24h ?? 0) >= 0 ? 'up' : 'down'}`}>{pct(t.change24h)}</div>
        </a>
      ))}
    </div>
  );
}
