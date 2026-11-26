# Solana Time Machine (STM)

**The past has a future.**

STM brings six years of Solana culture back to life: an archive of the memecoins that defined each year from 2021 to 2026, a multi-launchpad for Pump.fun, Raydium LaunchLab and Meteora, and the Retro Liquidity Engine, which sends 80% of eligible creator fees back into each token's own liquidity and 20% to the STM treasury.

## Pages

| Page | What it does |
|---|---|
| Time Machine (`/`) | Interactive timeline across six eras with live stats for each era's relics, the daily featured relic and the era leaderboard. |
| Explore Eras (`/eras`, `/eras/[year]`) | Each year's narrative, events, relics (verified contract addresses) and launches inspired by it. |
| Token (`/token/[mint]`) | Historical profile: original contract address, live market data, daily chart, earliest indexed pool and the Revive button. For STM launches, also the launch record and that token's engine ledger. |
| Launch (`/launch`) | Original, era-inspired or tribute tokens on Pump.fun, Raydium LaunchLab or Meteora, signed in your wallet. |
| Markets (`/markets`) | Discovery terminal for tokens launched through STM, filterable by venue, type and sort. |
| Liquidity Engine (`/engine`) | Public dashboard: fees claimed, treasury share, reserve awaiting deployment, liquidity added, LP status and every transaction. |
| Docs (`/docs`) | How it works, the verified integration matrix, data-honesty rules, security and self-hosting. |

## What is verified, and how

Before integrating, every launchpad call used here was built with the venue's official SDK and simulated against Solana mainnet, or confirmed from the SDK's types and IDL. The full matrix is on `/docs#integrations` (source: `src/lib/capabilities.ts`). In short:

- **Pump.fun**: launch with first buy, fee recipient separate from the payer, permissionless creator-fee claiming (bonding curve and PumpSwap), graduation detection, and PumpSwap buy and deposit, all simulated. PumpSwap has no LP lock, so engine LP is shown as held by the vault.
- **Raydium LaunchLab**: launch with first buy simulated; with the engine on, launch is create-only (the vault is recorded as creator without signing) and the user's first buy is a second transaction. Creator-fee claim reached the program in simulation. CPMM add-liquidity and the Burn & Earn lock are typed only.
- **Meteora DBC**: launch with first buy and creator-fee claim simulated on live accounts; STM's own SOL-quoted config simulated (`npm run meteora:config`). DAMM v2 add-liquidity and permanent lock are typed only. Meteora launches stay disabled until `METEORA_DBC_CONFIG` is set.
- **During bonding curves** no venue lets anyone add liquidity, so the 80% share is held as a reserve until graduation.

Re-run the launch simulations yourself:

```bash
SIMULATE_WALLET=<funded mainnet address> MASTER_KEY=<32+ chars> \
NODE_OPTIONS=--conditions=react-server npx tsx scripts/simulate-launches.mts
```

## Data honesty

- Archive mints are checked against DexScreener: `npm run verify:archive`. POPCAT and MOODENG are not in the archive because their addresses could not be verified.
- Prices, market caps, liquidity and volume are live (DexScreener) and labelled as today's. No historical statistics are stored or estimated.
- Charts use GeckoTerminal daily candles for the top pool. The free API covers a limited window, so "peak" is the highest daily high inside that window. All-time peak market cap is shown as not verifiable.
- "Earliest indexed pool" (GeckoTerminal) stands in for the launch date and is labelled that way.
- The engine dashboard only counts confirmed transactions. In `dry-run` mode, steps are simulated and nothing is recorded.

## Run it

```bash
npm install
cp .env.example .env.local   # fill in at least SOLANA_RPC_URL and MASTER_KEY
npm run dev                  # http://localhost:3000
```

Without `DATABASE_URL`, local development stores launches in `.data/stm.json`. In production (Vercel), set `DATABASE_URL` to Postgres; the tables are created automatically.

## Deploy (Vercel)

1. Import the repo; framework is detected as Next.js.
2. Set the environment variables from `.env.example`. Required: `SOLANA_RPC_URL` (use a paid RPC), `DATABASE_URL`, `MASTER_KEY`.
3. For the engine: `STM_TREASURY_WALLET`, `STM_OPERATOR_SECRET` (lightly funded; it pays engine network fees), `CRON_SECRET`, `ENGINE_MODE` (`dry-run` first, then `live`), `ENGINE_LIVE_VENUES`. `vercel.json` runs it every 30 minutes.
4. For Meteora: `METEORA_ADMIN_SECRET=… STM_TREASURY_WALLET=… npm run meteora:config -- --send`, then set `METEORA_DBC_CONFIG`.

**Back up `MASTER_KEY`.** Engine vault keys are encrypted with it; without it, the vaults and their fees cannot be recovered.

## Layout

```
src/app/                 pages and API routes (launch/prepare, launch/submit, engine/run, launches)
src/components/          Time Machine, launch form, wallet button, chart
src/data/eras.ts         the archive: eras, events, verified mints
src/lib/venues.ts        Pump.fun, LaunchLab and Meteora adapters (official SDKs)
src/lib/engine.ts        the Retro Liquidity Engine
src/lib/capabilities.ts  the verified integration matrix
src/lib/market.ts        DexScreener + GeckoTerminal
src/lib/store.ts         Postgres / local registry and engine ledger
scripts/                 archive verification, launch simulation, Meteora config
```

Code reused from the VIBER project: the AES-GCM key vault, transaction confirmation and the pump.fun metadata upload.
