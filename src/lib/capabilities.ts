// What each launchpad can actually do, as verified against its SDK source and
// mainnet simulation before this integration was written. Rendered on the
// Docs page. "simulated" = a transaction was built with the SDK and simulated
// against mainnet; "typed" = confirmed from SDK types/IDL only.

export type Verify = 'simulated' | 'typed' | 'unsupported';

export interface Capability {
  label: string;
  pump: { status: Verify; note: string };
  raydium: { status: Verify; note: string };
  meteora: { status: Verify; note: string };
}

export const VENUES = {
  pump: { name: 'Pump.fun', sdk: '@pump-fun/pump-sdk 4.3.1 + @pump-fun/pump-swap-sdk 2.2.0', program: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P', amm: 'PumpSwap (pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA)' },
  raydium: { name: 'Raydium LaunchLab', sdk: '@raydium-io/raydium-sdk-v2 0.2.87-alpha', program: 'LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj', amm: 'Raydium CPMM (CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C)' },
  meteora: { name: 'Meteora DBC', sdk: '@meteora-ag/dynamic-bonding-curve-sdk 2.0.1 + @meteora-ag/cp-amm-sdk 1.5.1', program: 'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN', amm: 'Meteora DAMM v2' },
} as const;

export const CAPABILITIES: Capability[] = [
  {
    label: 'Create token from the user’s wallet',
    pump: { status: 'simulated', note: 'create_v2 + first buy in one transaction. User pays; mint keypair co-signed by STM.' },
    raydium: { status: 'simulated', note: 'LaunchLab initializeV2 with first buy. Mint keypair co-signed by STM.' },
    meteora: { status: 'simulated', note: 'createPool(+first buy) on a DBC config. Needs STM’s own SOL config (METEORA_DBC_CONFIG).' },
  },
  {
    label: 'Fee recipient different from the payer',
    pump: { status: 'simulated', note: '`creator` is an instruction argument; it does not sign.' },
    raydium: { status: 'simulated', note: 'payer and creator are separate. In create-only mode the creator does not sign, so the engine vault is set without signing; the user\u2019s first buy follows as a second transaction.' },
    meteora: { status: 'simulated', note: 'payer and poolCreator are separate; poolCreator signs: STM co-signs with the engine vault.' },
  },
  {
    label: 'Claim creator fees (bonding curve)',
    pump: { status: 'simulated', note: 'collect_creator_fee is permissionless; fees land in the creator account.' },
    raydium: { status: 'typed', note: 'claimCreatorFee: creator signs. Simulation reached the program; a wallet with no fee vault fails as expected.' },
    meteora: { status: 'simulated', note: 'claimCreatorTradingFee: creator signs. Simulated on a live pool.' },
  },
  {
    label: 'Claim creator fees after graduation',
    pump: { status: 'simulated', note: 'The same call also collects the PumpSwap coin-creator vault.' },
    raydium: { status: 'typed', note: 'Only if the launch set a CPMM creator fee (creatorFeeOn). STM launches set it off by default.' },
    meteora: { status: 'typed', note: 'Fees on the creator’s migrated DAMM v2 position: claimPositionFee.' },
  },
  {
    label: 'Detect graduation',
    pump: { status: 'simulated', note: 'bondingCurve.complete, then the canonical PumpSwap pool PDA.' },
    raydium: { status: 'typed', note: 'LaunchLab pool status; the CPMM pool is looked up through Raydium’s API.' },
    meteora: { status: 'simulated', note: 'virtualPool.isMigrated / migrationProgress.' },
  },
  {
    label: 'Add liquidity after graduation',
    pump: { status: 'simulated', note: 'PumpSwap deposit. Accounts resolve; the vault must hold both sides first (it buys half).' },
    raydium: { status: 'typed', note: 'cpmm.addLiquidity. Build verified up to the vault’s token account; not simulated end to end.' },
    meteora: { status: 'typed', note: 'cp-amm createPositionAndAddLiquidity. Not simulated end to end.' },
  },
  {
    label: 'Lock added liquidity',
    pump: { status: 'unsupported', note: 'PumpSwap has no LP lock. LP tokens stay in the engine vault and are shown as held, not locked.' },
    raydium: { status: 'typed', note: 'cpmm.lockLp (Burn & Earn): LP locked forever, fee-key NFT to the vault.' },
    meteora: { status: 'typed', note: 'cp-amm permanentLockPosition.' },
  },
  {
    label: 'Liquidity during the bonding curve',
    pump: { status: 'unsupported', note: 'No pool exists yet. The 80% share is held as a reserve until graduation.' },
    raydium: { status: 'unsupported', note: 'Same: reserved until migration.' },
    meteora: { status: 'unsupported', note: 'Same: reserved until migration.' },
  },
];

export const ENGINE_SPLIT = { liquidityBps: 8000, treasuryBps: 2000 } as const;
