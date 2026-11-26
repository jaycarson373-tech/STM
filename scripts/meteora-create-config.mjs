// Creates STM's Meteora Dynamic Bonding Curve config (SOL quote) once.
//
//   node scripts/meteora-create-config.mjs            # build + simulate only
//   node scripts/meteora-create-config.mjs --send     # send with METEORA_ADMIN_SECRET
//
// Env: SOLANA_RPC_URL, STM_TREASURY_WALLET (partner fee claimer + leftover
// receiver), METEORA_ADMIN_SECRET (base58, pays rent; only needed with --send).
// Prints the config address to put in METEORA_DBC_CONFIG.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const bs58 = require('bs58').default ?? require('bs58');
const {
  DynamicBondingCurveClient, buildCurveWithMarketCap, ActivationType, BaseFeeMode, CollectFeeMode, MigrationFeeOption,
  MigrationOption, TokenAuthorityOption, TokenDecimal, TokenType,
} = require('@meteora-ag/dynamic-bonding-curve-sdk');

const send = process.argv.includes('--send');
const rpc = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const treasury = process.env.STM_TREASURY_WALLET;
if (!treasury) throw new Error('Set STM_TREASURY_WALLET.');
const admin = process.env.METEORA_ADMIN_SECRET ? Keypair.fromSecretKey(bs58.decode(process.env.METEORA_ADMIN_SECRET)) : null;
if (send && !admin) throw new Error('Set METEORA_ADMIN_SECRET to send.');
// For a dry build, simulate with a funded wallet so the program actually runs.
const payer = admin ? admin.publicKey : new PublicKey(process.env.SIMULATE_PAYER || treasury);

const WSOL = new PublicKey('So11111111111111111111111111111111111111112');
const curve = buildCurveWithMarketCap({
  token: { tokenType: TokenType.SPLToken, tokenBaseDecimal: TokenDecimal.SIX, tokenQuoteDecimal: 9, tokenAuthorityOption: TokenAuthorityOption.Immutable, totalTokenSupply: 1_000_000_000, leftover: 0 },
  fee: {
    baseFeeParams: { baseFeeMode: BaseFeeMode.FeeSchedulerLinear, feeSchedulerParam: { startingFeeBps: 100, endingFeeBps: 100, numberOfPeriod: 0, totalDuration: 0 } },
    dynamicFeeEnabled: true,
    collectFeeMode: CollectFeeMode.QuoteToken,
    // Of the trading fee left after Meteora's protocol cut, the pool creator
    // (the token's engine vault) gets this share; the partner (STM treasury) the rest.
    creatorTradingFeePercentage: 80,
    poolCreationFee: 0,
    enableFirstSwapWithMinFee: false,
  },
  migration: { migrationOption: MigrationOption.MET_DAMM_V2, migrationFeeOption: MigrationFeeOption.FixedBps100, migrationFee: { feePercentage: 0, creatorFeePercentage: 0 } },
  // All migrated liquidity is permanently locked, half to the partner and half to the creator.
  liquidityDistribution: { partnerPermanentLockedLiquidityPercentage: 50, partnerLiquidityPercentage: 0, creatorPermanentLockedLiquidityPercentage: 50, creatorLiquidityPercentage: 0 },
  lockedVesting: { totalLockedVestingAmount: 0, numberOfVestingPeriod: 0, cliffUnlockAmount: 0, totalVestingDuration: 0, cliffDurationFromMigrationTime: 0 },
  activationType: ActivationType.Timestamp,
  initialMarketCap: 30,   // in SOL
  migrationMarketCap: 400, // in SOL
});

const connection = new Connection(rpc, 'confirmed');
const client = new DynamicBondingCurveClient(connection, 'confirmed');
const config = Keypair.generate();
const tx = await client.partner.createConfig({ ...curve, config: config.publicKey, feeClaimer: new PublicKey(treasury), leftoverReceiver: new PublicKey(treasury), quoteMint: WSOL, payer });
tx.feePayer = payer;
tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

if (!send) {
  tx.partialSign(config);
  const sim = await connection.simulateTransaction(tx);
  console.log('simulation err:', JSON.stringify(sim.value.err));
  console.log((sim.value.logs || []).filter((l) => /Program log|failed|Error/.test(l)).slice(-8).join('\n'));
  console.log('\nThis was a dry run. Re-run with --send and METEORA_ADMIN_SECRET to create it.');
} else {
  tx.sign(admin, config);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, 'confirmed');
  console.log('created', sig);
  console.log(`METEORA_DBC_CONFIG=${config.publicKey.toBase58()}`);
}
