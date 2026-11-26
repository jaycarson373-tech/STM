import 'server-only';
import { ARCHIVE, ERAS, type ArchiveToken, type EraYear } from '@/data/eras';
import { liveTokens, type LiveToken } from './market';
import { liveLaunches, publicLaunch, type Launch } from './store';

export type LiveRelic = ArchiveToken & { live: LiveToken | null };
export type PublicLaunch = ReturnType<typeof publicLaunch> & { live: LiveToken | null };

export interface EraStats {
  year: EraYear;
  tracked: number;
  priced: number;
  marketCap: number;
  volume24h: number;
  stmLaunches: number;
  stmVolume24h: number;
  topMover: { symbol: string; change: number } | null;
}

export async function loadArchive(): Promise<{ relics: LiveRelic[]; fetchedAt: string }> {
  const live = await liveTokens(ARCHIVE.map((t) => t.mint));
  return { relics: ARCHIVE.map((t) => ({ ...t, live: live.get(t.mint) ?? null })), fetchedAt: new Date().toISOString() };
}

export async function loadLaunches(limit = 200): Promise<PublicLaunch[]> {
  const launches: Launch[] = await liveLaunches(limit);
  const live = launches.length ? await liveTokens(launches.map((l) => l.mint), 30) : new Map();
  return launches.map((l) => ({ ...publicLaunch(l), live: live.get(l.mint) ?? null }));
}

export function eraStats(relics: LiveRelic[], launches: PublicLaunch[]): EraStats[] {
  return ERAS.map((e) => {
    const rs = relics.filter((r) => r.year === e.year);
    const ls = launches.filter((l) => l.era === e.year || (e.year === 2026 && l.era === null));
    const priced = rs.filter((r) => r.live);
    const movers = priced.filter((r) => r.live!.change24h != null).sort((a, b) => Math.abs(b.live!.change24h!) - Math.abs(a.live!.change24h!));
    return {
      year: e.year,
      tracked: rs.length,
      priced: priced.length,
      marketCap: priced.reduce((a, r) => a + (r.live!.marketCap ?? r.live!.fdv ?? 0), 0),
      volume24h: priced.reduce((a, r) => a + (r.live!.volume24h ?? 0), 0),
      stmLaunches: ls.length,
      stmVolume24h: ls.reduce((a, l) => a + (l.live?.volume24h ?? 0), 0),
      topMover: movers[0] ? { symbol: movers[0].symbol, change: movers[0].live!.change24h! } : null,
    };
  });
}

/** Eras ranked by what their narratives trade today: archive volume + STM launches inspired by them. */
export function leaderboard(stats: EraStats[]) {
  return [...stats].map((s) => ({ ...s, activity: s.volume24h + s.stmVolume24h })).sort((a, b) => b.activity - a.activity);
}
