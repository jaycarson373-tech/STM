import type { Candle } from '@/lib/market';

// Daily close chart with a high/low band. Server-rendered SVG; no client JS.
export default function Chart({ candles, accent = '#a78bfa' }: { candles: Candle[]; accent?: string }) {
  if (candles.length < 2) return <div className="empty">No chart data available from GeckoTerminal for this pool.</div>;
  const W = 1000, H = 220, P = 6;
  const lo = Math.min(...candles.map((c) => c.l)), hi = Math.max(...candles.map((c) => c.h));
  const logLo = Math.log(lo > 0 ? lo : 1e-12), logHi = Math.log(hi > 0 ? hi : 1e-12);
  const x = (i: number) => P + (i / (candles.length - 1)) * (W - 2 * P);
  const y = (v: number) => {
    const t = logHi === logLo ? 0.5 : (Math.log(Math.max(v, 1e-12)) - logLo) / (logHi - logLo);
    return H - P - t * (H - 2 * P);
  };
  const close = candles.map((c, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(c.c).toFixed(1)}`).join(' ');
  const band = [...candles.map((c, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(c.h).toFixed(1)}`), ...candles.map((c, i) => [i, c] as const).reverse().map(([i, c]) => `L${x(i).toFixed(1)},${y(c.l).toFixed(1)}`)].join(' ') + 'Z';
  const area = `${close} L${x(candles.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;
  const id = `g${Math.round(lo * 1e9) % 9973}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Daily price chart">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0.22" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((t) => <line key={t} x1="0" x2={W} y1={H * t} y2={H * t} stroke="rgba(255,255,255,0.05)" />)}
      <path d={band} fill={accent} fillOpacity="0.07" />
      <path d={area} fill={`url(#${id})`} />
      <path d={close} fill="none" stroke={accent} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
