export const short = (addr: string, n = 4) => (addr.length > 2 * n + 1 ? `${addr.slice(0, n)}…${addr.slice(-n)}` : addr);

export function usd(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  if (a >= 1) return `$${v.toFixed(digits)}`;
  if (a === 0) return '$0';
  // small prices: keep 3 significant digits
  return `$${v.toPrecision(3)}`;
}

export function pct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
}

export function sol(lamports: number | bigint | null | undefined, digits = 4): string {
  if (lamports == null) return '—';
  return `${(Number(lamports) / 1e9).toFixed(digits)} SOL`;
}

export const date = (ms: number | string | null | undefined) => {
  if (ms == null) return '—';
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? '—' : d.toISOString().slice(0, 10);
};

export const solscanTx = (sig: string) => `https://solscan.io/tx/${sig}`;
export const solscanAccount = (a: string) => `https://solscan.io/account/${a}`;
export const solscanToken = (a: string) => `https://solscan.io/token/${a}`;
