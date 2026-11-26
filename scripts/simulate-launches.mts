// Builds real launch transactions with STM's own code for every supported
// venue (engine on and off) and simulates them against mainnet. Nothing is
// signed by your wallet or sent.
//
//   SIMULATE_WALLET=<any funded mainnet address> MASTER_KEY=<32+ chars> \
//   NODE_OPTIONS=--conditions=react-server npx tsx scripts/simulate-launches.mts
import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { buildLaunch } from '../src/lib/venues';
import { newVault, RPC_URL } from '../src/lib/solana';

const wallet = process.env.SIMULATE_WALLET;
if (!wallet) throw new Error('Set SIMULATE_WALLET to a funded mainnet address (it only pays in simulation).');
const user = new PublicKey(wallet);
const conn = new Connection(RPC_URL, 'confirmed');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

for (const [venue, engine] of [['pump', false], ['pump', true], ['raydium', false], ['raydium', true]] as const) {
  const vault = engine ? newVault() : null;
  const b = await buildLaunch(venue, { user, feeCreator: vault ? vault.keypair.publicKey : user, vault: vault?.keypair ?? null, name: 'STM Simulation', symbol: 'STMSIM', uri: 'https://example.com/metadata.json', devBuySol: 0.01 });
  const tx = VersionedTransaction.deserialize(b.tx);
  const r = await conn.simulateTransaction(tx, { sigVerify: false, replaceRecentBlockhash: true });
  console.log(`${venue.padEnd(8)} engine=${String(engine).padEnd(5)} ${r.value.err ? 'FAILED ' + JSON.stringify(r.value.err) : 'OK'}  ${r.value.unitsConsumed} CU`);
  if (r.value.err) console.log((r.value.logs || []).slice(-6).join('\n'));
  await sleep(2500);
}
console.log('\nMeteora: run `npm run meteora:config` (dry run) to simulate STM’s DBC config.');
