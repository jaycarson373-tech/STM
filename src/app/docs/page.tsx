import type { Metadata } from 'next';
import { CAPABILITIES, ENGINE_SPLIT, VENUES, type Verify } from '@/lib/capabilities';

export const metadata: Metadata = { title: 'Documentation' };

const BADGE: Record<Verify, [string, string]> = { simulated: ['ok', 'simulated on mainnet'], typed: ['warn', 'SDK types only'], unsupported: ['no', 'not supported'] };

export default function Docs() {
  return (
    <div className="wrap page">
      <div className="page-head">
        <div>
          <span className="label">Documentation</span>
          <h1>How the machine works.</h1>
          <p>What STM does, what it signs, where every number comes from, and what each launchpad can and cannot do today.</p>
        </div>
      </div>
      <div className="docs">
        <nav aria-label="Sections">
          {[['overview', 'Overview'], ['launching', 'Launching'], ['tributes', 'Tributes'], ['engine', 'Liquidity Engine'], ['integrations', 'Integrations'], ['data', 'Data honesty'], ['security', 'Security'], ['self-host', 'Self-hosting']].map(([id, t]) => <a key={id} href={`#${id}`}>{t}</a>)}
        </nav>
        <article className="prose">
          <h2 id="overview">Overview</h2>
          <p>Solana Time Machine is three things: an archive of six years of Solana memecoin culture (2021 to 2026), a launchpad that can launch on Pump.fun, Raydium LaunchLab or Meteora, and the Retro Liquidity Engine, which routes creator fees back into each token&rsquo;s own liquidity.</p>

          <h2 id="launching">Launching</h2>
          <p>Every launch is a transaction built on the server with the venue&rsquo;s official SDK, then signed by you in your wallet. STM generates the new mint keypair and co-signs with it. With the engine on, the token&rsquo;s engine vault is set as the creator-fee recipient; it co-signs only where the venue requires the recipient&rsquo;s signature (Meteora), since Pump.fun and LaunchLab&rsquo;s create-only path record it without one. Before broadcasting, the server checks that the transaction you signed is byte-for-byte the one it prepared.</p>
          <ul>
            <li><b>Pump.fun</b>: one transaction creates the coin and runs your first buy.</li>
            <li><b>Raydium LaunchLab</b>: one transaction, or two with the engine on (the vault is the on-chain creator, so your first buy follows the create).</li>
            <li><b>Meteora DBC</b>: one transaction with the first buy, on STM&rsquo;s own SOL-quoted config. Disabled until that config exists.</li>
          </ul>
          <p>A token appears in Markets only after its create transaction is confirmed. Prepared-but-unsigned launches are never shown.</p>

          <h2 id="tributes">Tributes and revivals</h2>
          <p>The Revive button on a historical token starts a tribute. Tributes are new, unrelated tokens. STM enforces that a tribute cannot reuse the original ticker or name, and prepends this to its on-chain description: &ldquo;Unofficial tribute to NAME ($TICKER, CA …). Not affiliated with the original project.&rdquo; Tributes are labelled as such everywhere on the site.</p>

          <h2 id="engine">Retro Liquidity Engine</h2>
          <p>With the engine on, a dedicated vault becomes the coin&rsquo;s creator-fee recipient. On a schedule the engine claims the vault&rsquo;s fees, transfers {ENGINE_SPLIT.treasuryBps / 100}% to the STM treasury, and books {ENGINE_SPLIT.liquidityBps / 100}% as that token&rsquo;s liquidity reserve. Bonding curves have no pool, so the reserve waits until the token graduates. It then buys the token with half the reserve, deposits both halves, and locks the position where the venue supports locking.</p>
          <h3>What counts as eligible</h3>
          <p>Creator fees of tokens launched through STM with the engine on. Partner or platform fees that a venue pays STM directly are separate and are not part of the 80/20 split.</p>
          <h3>Modes</h3>
          <ul>
            <li><code>dry-run</code> (default): every claim, transfer, swap and deposit is built and simulated; nothing is sent and nothing is recorded.</li>
            <li><code>live</code>: steps are sent only for venues listed in <code>ENGINE_LIVE_VENUES</code>. Each confirmed step is recorded with its signature.</li>
            <li><code>off</code>: the engine does nothing.</li>
          </ul>
          <h3>Distinctions the dashboard keeps</h3>
          <ul>
            <li><b>Reinvested fees</b>: reserve that was actually swapped and deposited, each with a transaction.</li>
            <li><b>LP ownership</b>: who holds the resulting LP. On PumpSwap the vault holds it, because PumpSwap has no lock.</li>
            <li><b>Locked liquidity</b>: Raydium Burn &amp; Earn or a Meteora permanent lock. Nobody can withdraw it, STM included.</li>
          </ul>

          <h2 id="integrations">Integrations</h2>
          <p>Each capability was checked before it was built: either a transaction was built with the SDK and simulated against mainnet, or the call was confirmed from the SDK&rsquo;s types and IDL. Anything not supported is marked as such.</p>
          <div className="table-wrap" style={{ margin: '18px 0' }}>
            <table className="table">
              <thead><tr><th>Capability</th>{(['pump', 'raydium', 'meteora'] as const).map((v) => <th key={v}>{VENUES[v].name}</th>)}</tr></thead>
              <tbody>
                {CAPABILITIES.map((c) => (
                  <tr key={c.label}>
                    <td style={{ minWidth: 180 }}>{c.label}</td>
                    {(['pump', 'raydium', 'meteora'] as const).map((v) => (
                      <td key={v} style={{ minWidth: 220 }}>
                        <span className={`pill ${BADGE[c[v].status][0]}`}>{BADGE[c[v].status][1]}</span>
                        <div className="hint" style={{ marginTop: 6 }}>{c[v].note}</div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul>
            {(['pump', 'raydium', 'meteora'] as const).map((v) => <li key={v}><b>{VENUES[v].name}</b>: <code>{VENUES[v].sdk}</code>, program <code>{VENUES[v].program}</code>, graduates to {VENUES[v].amm}.</li>)}
          </ul>
          <p>Observed, not asserted: a graduated PumpSwap pool checked during verification had an LP supply of a fraction of one token against over $1M of reserves, consistent with migration LP being burned. Verify any pool yourself on Solscan.</p>

          <h2 id="data">Data honesty</h2>
          <ul>
            <li>Every archive mint is checked against DexScreener (<code>npm run verify:archive</code>). Two tokens were left out because their addresses could not be verified.</li>
            <li>Prices, market caps, liquidity and volume are fetched live from DexScreener and labelled &ldquo;today&rdquo;. Nothing historical is stored or estimated.</li>
            <li>Charts are GeckoTerminal daily candles for the token&rsquo;s top pool. The free API returns a limited window, so &ldquo;peak&rdquo; means the highest daily high inside that window, never an all-time high.</li>
            <li>All-time peak market cap is shown as not verifiable: circulating supply changes over time and no free source publishes it reliably.</li>
            <li>&ldquo;Earliest indexed pool&rdquo; is the oldest pool GeckoTerminal lists for the mint. It is a close proxy for launch date, not the mint&rsquo;s creation time.</li>
            <li>Narratives and events are editorial and kept to month precision.</li>
          </ul>

          <h2 id="security">Security</h2>
          <ul>
            <li>STM never sees your wallet keys. You sign in your wallet; the server only co-signs the new mint and, where a venue requires it, the token&rsquo;s engine vault.</li>
            <li>Engine vault keys are generated server-side and stored AES-256-GCM encrypted under <code>MASTER_KEY</code>. They are never sent to the browser.</li>
            <li>The engine is custodial for creator fees by design: someone has to claim and reinvest them. Locked liquidity is not custodial; it cannot be withdrawn.</li>
            <li>The cron endpoint requires <code>CRON_SECRET</code>.</li>
          </ul>

          <h2 id="self-host">Self-hosting</h2>
          <p>Next.js app, deployable to Vercel. Copy <code>.env.example</code> and set at least <code>SOLANA_RPC_URL</code> (a paid RPC), <code>DATABASE_URL</code> (Postgres) and <code>MASTER_KEY</code>. For the engine, add <code>STM_TREASURY_WALLET</code>, <code>STM_OPERATOR_SECRET</code> and <code>CRON_SECRET</code>; <code>vercel.json</code> schedules it every 30 minutes. For Meteora, create STM&rsquo;s config once with <code>npm run meteora:config</code> and set <code>METEORA_DBC_CONFIG</code>.</p>
        </article>
      </div>
    </div>
  );
}
