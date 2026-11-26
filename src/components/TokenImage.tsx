/* eslint-disable @next/next/no-img-element */
// Token artwork, loaded from the source the market data points to (DexScreener's
// CDN or the token's own metadata). Falls back to the ticker initials.
export default function TokenImage({ src, symbol, className = 'relic-img', size }: { src?: string | null; symbol: string; className?: string; size?: number }) {
  const style = size ? { width: size, height: size } : undefined;
  if (!src) return <span className={`${className} ph`} style={style} aria-hidden>{symbol.slice(0, 2)}</span>;
  return <img className={className} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" style={style} />;
}
