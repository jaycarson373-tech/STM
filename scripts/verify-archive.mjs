// Re-checks every archive mint against DexScreener and fails if any is missing
// or its symbol changed. Run before editing src/data/eras.ts.
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/data/eras.ts', import.meta.url), 'utf8');
const rows = [...src.matchAll(/mint: '([1-9A-HJ-NP-Za-km-z]{32,44})', symbol: '([^']+)'/g)].map((m) => ({ mint: m[1], symbol: m[2] }));
const norm = (s) => s.trim().toUpperCase().replace(/^\$/, '');

let bad = 0;
for (let i = 0; i < rows.length; i += 30) {
  const batch = rows.slice(i, i + 30);
  const r = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${batch.map((b) => b.mint).join(',')}`);
  const pairs = await r.json();
  for (const { mint, symbol } of batch) {
    const p = pairs.find((x) => x.baseToken.address === mint);
    if (!p) { console.log(`MISSING  ${symbol} ${mint}`); bad++; continue; }
    const ok = norm(p.baseToken.symbol) === norm(symbol);
    if (!ok) bad++;
    console.log(`${ok ? 'OK      ' : 'SYMBOL? '} ${symbol.padEnd(9)} dexscreener=${p.baseToken.symbol} (${p.baseToken.name})`);
  }
}
console.log(bad ? `\n${bad} problem(s)` : `\nAll ${rows.length} archive mints verified.`);
process.exit(bad ? 1 : 0);
