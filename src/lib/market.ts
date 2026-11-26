// Live market data. Every number shown on the site comes from here, with its
// source and retrieval time, and is never stored as if it were history.
import 'server-only';

const DEX = 'https://api.dexscreener.com';
const GECKO = 'https://api.geckoterminal.com/api/v2';

export interface LiveToken {
  mint: string;
  symbol: string;
  name: string;
  priceUsd: number | null;
  marketCap: number | null;
  fdv: number | null;
  liquidityUsd: number | null;
  volume24h: number | null;
  change24h: number | null;
  imageUrl: string | null;
  pairUrl: string | null;
  dexId: string | null;
  pairAddress: string | null;
}

export interface Candle { t: number; o: number; h: number; l: number; c: number; v: number }

export interface History {
  poolAddress: string | null;
  poolDex: string | null;
  earliestPoolAt: string | null; // ISO; earliest pool GeckoTerminal indexes for this mint
  poolCount: number;
  candles: Candle[];
  peak: { price: number; at: number } | null; // within the candles window only
  windowFrom: number | null;
  windowTo: number | null;
}

async function getJson<T>(url: string, revalidate: number): Promise<T | null> {
  try {
    const r = await fetch(url, { next: { revalidate }, headers: { accept: 'application/json' } });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

type DexPair = {
  baseToken: { address: string; symbol: string; name: string };
  priceUsd?: string;
  marketCap?: number;
  fdv?: number;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  priceChange?: { h24?: number };
  info?: { imageUrl?: string };
  url?: string;
  dexId?: string;
  pairAddress?: string;
};

/** Live stats for up to N mints, batched 30 per DexScreener call (its limit). */
export async function liveTokens(mints: string[], revalidate = 60): Promise<Map<string, LiveToken>> {
  const out = new Map<string, LiveToken>();
  const unique = [...new Set(mints)];
  for (let i = 0; i < unique.length; i += 30) {
    const batch = unique.slice(i, i + 30);
    const pairs = await getJson<DexPair[]>(`${DEX}/tokens/v1/solana/${batch.join(',')}`, revalidate);
    for (const p of pairs || []) {
      const mint = p.baseToken.address;
      const prev = out.get(mint);
      // keep the deepest pair per mint
      if (prev && (prev.liquidityUsd ?? 0) >= (p.liquidity?.usd ?? 0)) continue;
      out.set(mint, {
        mint,
        symbol: p.baseToken.symbol.trim().replace(/^\$/, ''),
        name: p.baseToken.name.trim(),
        priceUsd: p.priceUsd ? Number(p.priceUsd) : null,
        marketCap: p.marketCap ?? null,
        fdv: p.fdv ?? null,
        liquidityUsd: p.liquidity?.usd ?? null,
        volume24h: p.volume?.h24 ?? null,
        change24h: p.priceChange?.h24 ?? null,
        imageUrl: p.info?.imageUrl ?? null,
        pairUrl: p.url ?? null,
        dexId: p.dexId ?? null,
        pairAddress: p.pairAddress ?? null,
      });
    }
  }
  return out;
}

type GeckoPools = { data: { attributes: { address: string; pool_created_at: string; reserve_in_usd: string }; relationships: { dex: { data: { id: string } } } }[] };
type GeckoOhlcv = { data: { attributes: { ohlcv_list: [number, number, number, number, number, number][] } } };

/**
 * Chart history and the earliest pool GeckoTerminal knows about. The free API
 * returns a limited window of daily candles, so `peak` is "highest daily high
 * inside this window", never an all-time high.
 */
export async function tokenHistory(mint: string): Promise<History> {
  const empty: History = { poolAddress: null, poolDex: null, earliestPoolAt: null, poolCount: 0, candles: [], peak: null, windowFrom: null, windowTo: null };
  const pools = await getJson<GeckoPools>(`${GECKO}/networks/solana/tokens/${mint}/pools?page=1`, 6 * 3600);
  if (!pools?.data?.length) return empty;
  const top = pools.data[0];
  const earliest = pools.data.map((p) => p.attributes.pool_created_at).filter(Boolean).sort()[0] ?? null;
  const ohlcv = await getJson<GeckoOhlcv>(`${GECKO}/networks/solana/pools/${top.attributes.address}/ohlcv/day?limit=1000&currency=usd&token=base`, 6 * 3600);
  const candles = (ohlcv?.data?.attributes?.ohlcv_list || [])
    .map(([t, o, h, l, c, v]) => ({ t: t * 1000, o, h, l, c, v }))
    .sort((a, b) => a.t - b.t);
  const peak = candles.reduce<{ price: number; at: number } | null>((best, c) => (!best || c.h > best.price ? { price: c.h, at: c.t } : best), null);
  return {
    poolAddress: top.attributes.address,
    poolDex: top.relationships?.dex?.data?.id ?? null,
    earliestPoolAt: earliest,
    poolCount: pools.data.length,
    candles,
    peak,
    windowFrom: candles[0]?.t ?? null,
    windowTo: candles.at(-1)?.t ?? null,
  };
}

export interface TrendingPool { name: string; mint: string; volume24h: number | null; fdv: number | null; change24h: number | null; poolAddress: string }
type GeckoTrending = { data: { attributes: { name: string; address: string; volume_usd?: { h24?: string }; fdv_usd?: string; price_change_percentage?: { h24?: string } }; relationships: { base_token: { data: { id: string } } } }[] };

/** What Solana is trading right now (GeckoTerminal trending pools). */
export async function trendingSolana(limit = 10): Promise<TrendingPool[]> {
  const j = await getJson<GeckoTrending>(`${GECKO}/networks/solana/trending_pools?page=1`, 300);
  return (j?.data || []).slice(0, limit).map((p) => ({
    name: p.attributes.name,
    mint: p.relationships.base_token.data.id.replace(/^solana_/, ''),
    volume24h: p.attributes.volume_usd?.h24 ? Number(p.attributes.volume_usd.h24) : null,
    fdv: p.attributes.fdv_usd ? Number(p.attributes.fdv_usd) : null,
    change24h: p.attributes.price_change_percentage?.h24 ? Number(p.attributes.price_change_percentage.h24) : null,
    poolAddress: p.attributes.address,
  }));
}
