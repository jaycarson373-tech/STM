// Launchpad adapters. Each builds real transactions with the venue's official
// SDK. The calls used here are the ones verified in src/lib/capabilities.ts.
import 'server-only';
import { createRequire } from 'node:module';
import {
  ComputeBudgetProgram, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, TransactionMessage, VersionedTransaction,
} from '@solana/web3.js';
import BN from 'bn.js';
import { connection } from './solana';
import type { Venue } from './store';

const req = createRequire(import.meta.url);
const pumpSdk = () => req('@pump-fun/pump-sdk') as typeof import('@pump-fun/pump-sdk');
const pumpAmm = () => req('@pump-fun/pump-swap-sdk') as typeof import('@pump-fun/pump-swap-sdk');
const raySdk = () => req('@raydium-io/raydium-sdk-v2') as typeof import('@raydium-io/raydium-sdk-v2');
const dbcSdk = () => req('@meteora-ag/dynamic-bonding-curve-sdk') as typeof import('@meteora-ag/dynamic-bonding-curve-sdk');
const cpAmm = () => req('@meteora-ag/cp-amm-sdk') as typeof import('@meteora-ag/cp-amm-sdk');

export const WSOL = new PublicKey('So11111111111111111111111111111111111111112');
const U64_MAX = new BN('18446744073709551615');
const lamports = (sol: number) => new BN(Math.round(sol * 1e9));

// ------------------------------------------------------------ availability
export function venueAvailability(v: Venue): { ok: boolean; reason?: string } {
  if (v === 'meteora' && !process.env.METEORA_DBC_CONFIG) {
    return { ok: false, reason: 'Meteora launches need STM’s own DBC config. Run `npm run meteora:config` and set METEORA_DBC_CONFIG.' };
  }
  return { ok: true };
}

export interface BuiltLaunch {
  /** Serialized, partially signed transaction for the user's wallet to sign. */
  tx: Uint8Array;
  /** Bytes of the message STM signed; the submitted transaction must match exactly. */
  message: Uint8Array;
  legacy: boolean;
  mint: string;
  extra: Record<string, unknown>;
}

interface LaunchArgs {
  user: PublicKey;
  feeCreator: PublicKey; // who earns creator fees: the engine vault, or the user
  vault: Keypair | null; // present when feeCreator is an engine vault that must co-sign
  name: string;
  symbol: string;
  uri: string;
  devBuySol: number;
}

async function v0(payer: PublicKey, ixs: TransactionInstruction[], signers: Keypair[]): Promise<BuiltLaunch['tx'] & {}> {
  const { blockhash } = await connection().getLatestBlockhash('confirmed');
  const tx = new VersionedTransaction(new TransactionMessage({ payerKey: payer, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message());
  tx.sign(signers);
  return tx.serialize();
}

// ------------------------------------------------------------------- launch
export async function buildLaunch(venue: Venue, a: LaunchArgs): Promise<BuiltLaunch> {
  const mint = Keypair.generate();
  if (venue === 'pump') {
    const { OnlinePumpSdk, PUMP_SDK, getBuyTokenAmountFromSolAmount } = pumpSdk();
    const online = new OnlinePumpSdk(connection());
    const global = await online.fetchGlobal();
    let ixs: TransactionInstruction[];
    if (a.devBuySol > 0) {
      const feeConfig = await online.fetchFeeConfig();
      const solAmount = lamports(a.devBuySol);
      const amount = getBuyTokenAmountFromSolAmount({ global, feeConfig, mintSupply: null, bondingCurve: null, amount: solAmount, quoteMint: WSOL });
      ixs = await PUMP_SDK.createV2AndBuyInstructions({ global, mint: mint.publicKey, name: a.name, symbol: a.symbol, uri: a.uri, creator: a.feeCreator, user: a.user, amount, solAmount, mayhemMode: false });
    } else {
      ixs = [await PUMP_SDK.createV2Instruction({ mint: mint.publicKey, name: a.name, symbol: a.symbol, uri: a.uri, creator: a.feeCreator, user: a.user, mayhemMode: false })];
    }
    const raw = await v0(a.user, [ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }), ...ixs], [mint]);
    const tx = VersionedTransaction.deserialize(raw);
    return { tx: raw, message: tx.message.serialize(), legacy: false, mint: mint.publicKey.toBase58(), extra: {} };
  }

  if (venue === 'raydium') {
    const { Raydium, TxVersion, LAUNCHPAD_PROGRAM, LAUNCHPAD_PLATFORM, LAUNCHPAD_CONFIG } = raySdk();
    // The SDK's owner is the on-chain creator. With the engine on, that is the
    // vault (co-signed by STM) and the user's first buy becomes a second step.
    const owner = a.vault ? a.vault.publicKey : a.user;
    const raydium = await Raydium.load({ connection: connection(), owner, disableLoadToken: true, disableFeatureCheck: true, cluster: 'mainnet' });
    const createOnly = Boolean(a.vault) || a.devBuySol <= 0;
    const { transactions, extInfo } = await raydium.launchpad.createLaunchpad({
      programId: LAUNCHPAD_PROGRAM, mintA: mint.publicKey, decimals: 6, name: a.name, symbol: a.symbol, uri: a.uri,
      migrateType: 'cpmm', configId: LAUNCHPAD_CONFIG, platformId: LAUNCHPAD_PLATFORM,
      buyAmount: createOnly ? new BN(0) : lamports(a.devBuySol), createOnly, slippage: new BN(100),
      txVersion: TxVersion.V0, feePayer: a.user, extraSigners: [mint], creatorFeeOn: 0,
    });
    if (transactions.length !== 1) throw new Error(`LaunchLab returned ${transactions.length} transactions; expected 1.`);
    const tx = transactions[0] as VersionedTransaction;
    // Co-sign only with keys the program actually requires. In create-only mode
    // LaunchLab records the creator without its signature.
    const required = tx.message.staticAccountKeys.slice(0, tx.message.header.numRequiredSignatures);
    tx.sign([mint, ...(a.vault ? [a.vault] : [])].filter((k) => required.some((r) => r.equals(k.publicKey))));
    const poolId = (extInfo as any)?.address?.poolId?.toBase58?.() ?? null;
    return { tx: tx.serialize(), message: tx.message.serialize(), legacy: false, mint: mint.publicKey.toBase58(), extra: { poolId, pendingFirstBuySol: a.vault && a.devBuySol > 0 ? a.devBuySol : 0 } };
  }

  // meteora
  const config = process.env.METEORA_DBC_CONFIG;
  if (!config) throw new Error(venueAvailability('meteora').reason);
  const { DynamicBondingCurveClient, deriveDbcPoolAddress } = dbcSdk();
  const client = new DynamicBondingCurveClient(connection(), 'confirmed');
  const tx: Transaction = await client.creator.createPoolWithFirstBuy({
    createPoolParam: { name: a.name, symbol: a.symbol, uri: a.uri, payer: a.user, poolCreator: a.feeCreator, config: new PublicKey(config), baseMint: mint.publicKey },
    // Created and bought in the same transaction, so nobody can trade ahead of the first buy.
    firstBuyParam: a.devBuySol > 0 ? { buyer: a.user, buyAmount: lamports(a.devBuySol), minimumAmountOut: new BN(1), referralTokenAccount: null } : undefined,
  });
  const { blockhash } = await connection().getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = a.user;
  tx.partialSign(mint, ...(a.vault ? [a.vault] : []));
  const pool = deriveDbcPoolAddress(WSOL, mint.publicKey, new PublicKey(config)).toBase58();
  return { tx: tx.serialize({ requireAllSignatures: false }), message: tx.serializeMessage(), legacy: true, mint: mint.publicKey.toBase58(), extra: { pool, config } };
}

/** Raydium + engine: the user's first buy, built after the pool exists. */
export async function buildRaydiumFirstBuy(user: PublicKey, mint: string, sol: number): Promise<BuiltLaunch> {
  const { Raydium, TxVersion, LAUNCHPAD_PROGRAM } = raySdk();
  const raydium = await Raydium.load({ connection: connection(), owner: user, disableLoadToken: true, disableFeatureCheck: true, cluster: 'mainnet' });
  const { transaction } = await raydium.launchpad.buyToken({ programId: LAUNCHPAD_PROGRAM, mintA: new PublicKey(mint), buyAmount: lamports(sol), slippage: new BN(300), txVersion: TxVersion.V0 });
  const tx = transaction as VersionedTransaction;
  return { tx: tx.serialize(), message: tx.message.serialize(), legacy: false, mint, extra: {} };
}

// ------------------------------------------------------------ engine: fees
export interface EngineTx { tx: VersionedTransaction | Transaction; signers: Keypair[] }

async function toV0(payer: Keypair, ixs: TransactionInstruction[], signers: Keypair[]): Promise<EngineTx> {
  const { blockhash } = await connection().getLatestBlockhash('confirmed');
  const tx = new VersionedTransaction(new TransactionMessage({ payerKey: payer.publicKey, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message());
  return { tx, signers: [payer, ...signers] };
}

/** Claim the vault's creator fees into the vault. Operator pays the network fee. */
export async function buildClaim(venue: Venue, vault: Keypair, op: Keypair, launch: { mint: string; extra: Record<string, unknown> }): Promise<EngineTx> {
  if (venue === 'pump') {
    const { OnlinePumpSdk } = pumpSdk();
    const ixs = await new OnlinePumpSdk(connection()).collectCoinCreatorFeeInstructions(vault.publicKey, op.publicKey);
    return toV0(op, ixs, []); // permissionless: the creator does not sign
  }
  if (venue === 'raydium') {
    const { Raydium, TxVersion, LAUNCHPAD_PROGRAM } = raySdk();
    const raydium = await Raydium.load({ connection: connection(), owner: vault.publicKey, disableLoadToken: true, disableFeatureCheck: true, cluster: 'mainnet' });
    const { transaction } = await raydium.launchpad.claimCreatorFee({ programId: LAUNCHPAD_PROGRAM, mintB: WSOL, txVersion: TxVersion.V0, feePayer: op.publicKey });
    return { tx: transaction as unknown as VersionedTransaction, signers: [op, vault] };
  }
  const { DynamicBondingCurveClient } = dbcSdk();
  const pool = String(launch.extra.pool || '');
  if (!pool) throw new Error('Meteora launch has no pool address recorded.');
  const tx = await new DynamicBondingCurveClient(connection(), 'confirmed').creator.claimCreatorTradingFee({
    creator: vault.publicKey, payer: op.publicKey, pool: new PublicKey(pool), maxBaseAmount: U64_MAX, maxQuoteAmount: U64_MAX,
  });
  return { tx, signers: [op, vault] };
}

/** How much the vault can claim right now, in lamports, where the venue exposes it. */
export async function claimable(venue: Venue, vault: PublicKey): Promise<bigint | null> {
  if (venue === 'pump') {
    const { OnlinePumpSdk } = pumpSdk();
    return BigInt((await new OnlinePumpSdk(connection()).getCreatorVaultBalanceBothPrograms(vault)).toString());
  }
  return null; // LaunchLab / DBC: measured from the claim transaction instead
}

export async function buildTransfer(from: Keypair, op: Keypair, to: PublicKey, lamports: bigint): Promise<EngineTx> {
  return toV0(op, [SystemProgram.transfer({ fromPubkey: from.publicKey, toPubkey: to, lamports })], [from]);
}

// ------------------------------------------------------- engine: graduation
export interface Graduation { migrated: boolean; pool: string | null; detail: string }

export async function graduation(venue: Venue, mint: string, extra: Record<string, unknown>): Promise<Graduation> {
  if (venue === 'pump') {
    const { OnlinePumpSdk, canonicalPumpPoolPda } = pumpSdk();
    const bc = await new OnlinePumpSdk(connection()).fetchBondingCurve(mint);
    if (!bc.complete) return { migrated: false, pool: null, detail: 'On the bonding curve' };
    const pool = canonicalPumpPoolPda(new PublicKey(mint));
    const info = await connection().getAccountInfo(pool);
    return info ? { migrated: true, pool: pool.toBase58(), detail: 'Graduated to PumpSwap' } : { migrated: false, pool: null, detail: 'Curve complete, migration pending' };
  }
  if (venue === 'raydium') {
    const { Raydium } = raySdk();
    const raydium = await Raydium.load({ connection: connection(), disableLoadToken: true, disableFeatureCheck: true, cluster: 'mainnet' });
    const pools = await raydium.api.fetchPoolByMints({ mint1: mint, mint2: WSOL.toBase58() });
    const cpmm = (pools as any)?.data?.find?.((p: any) => p.programId === 'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C');
    return cpmm ? { migrated: true, pool: cpmm.id, detail: 'Migrated to Raydium CPMM' } : { migrated: false, pool: null, detail: 'On the LaunchLab curve' };
  }
  const { DynamicBondingCurveClient, deriveDammV2PoolAddress } = dbcSdk();
  const client = new DynamicBondingCurveClient(connection(), 'confirmed');
  const pool = await client.state.getPool(String(extra.pool));
  if (!pool || !(pool as any).isMigrated) return { migrated: false, pool: null, detail: 'On the bonding curve' };
  const cfg = await client.state.getPoolConfig((pool as any).config);
  const dammConfig = (cfg as any)?.migrationDammV2ConfigKey ?? null;
  const damm = dammConfig ? deriveDammV2PoolAddress(dammConfig, new PublicKey(mint), WSOL).toBase58() : null;
  return { migrated: Boolean(damm), pool: damm, detail: damm ? 'Migrated to DAMM v2' : 'Migrated (pool address not derivable from config)' };
}

// ------------------------------------------------------ engine: liquidity
export interface DeployPlan { steps: { kind: 'swap' | 'add_liquidity' | 'lock'; build: () => Promise<EngineTx> }[]; lpStatus: string }

/**
 * Turn `sol` lamports of reserve into liquidity: buy the token with half,
 * deposit both halves, and lock where the venue supports it.
 */
export function planDeploy(venue: Venue, vault: Keypair, op: Keypair, mint: string, pool: string, sol: bigint): DeployPlan {
  const half = new BN((sol / 2n).toString());
  const slippagePct = 3;
  if (venue === 'pump') {
    const { OnlinePumpAmmSdk, PUMP_AMM_SDK } = pumpAmm();
    const amm = new OnlinePumpAmmSdk(connection());
    const poolKey = new PublicKey(pool);
    return {
      lpStatus: 'held_by_vault',
      steps: [
        { kind: 'swap', build: async () => toV0(op, await PUMP_AMM_SDK.buyQuoteInput(await amm.swapSolanaState(poolKey, vault.publicKey), half, slippagePct), [vault]) },
        {
          kind: 'add_liquidity',
          build: async () => {
            const state = await amm.liquiditySolanaState(poolKey, vault.publicKey);
            const { lpToken } = PUMP_AMM_SDK.depositAutocompleteBaseAndLpTokenFromQuote(state, half, slippagePct);
            return toV0(op, await PUMP_AMM_SDK.depositInstructions(state, lpToken, slippagePct), [vault]);
          },
        },
      ],
    };
  }
  if (venue === 'raydium') {
    const { Raydium, TxVersion, Percent, CurveCalculator } = raySdk() as any;
    const load = () => Raydium.load({ connection: connection(), owner: vault.publicKey, disableFeatureCheck: true, cluster: 'mainnet' });
    const poolInfo = async (raydium: any) => {
      const info = (await raydium.api.fetchPoolById({ ids: pool }))[0];
      const keys = await raydium.cpmm.getCpmmPoolKeys(pool);
      const rpc = await raydium.cpmm.getRpcPoolInfo(pool, true);
      return { info, keys, rpc };
    };
    return {
      lpStatus: 'locked_burn_earn',
      steps: [
        {
          kind: 'swap',
          build: async () => {
            const raydium = await load();
            const { info, keys, rpc } = await poolInfo(raydium);
            const baseIn = info.mintA.address === WSOL.toBase58();
            const swapResult = CurveCalculator.swapBaseInput(half, baseIn ? rpc.baseReserve : rpc.quoteReserve, baseIn ? rpc.quoteReserve : rpc.baseReserve, rpc.configInfo.tradeFeeRate, rpc.configInfo.creatorFeeRate, rpc.configInfo.protocolFeeRate, rpc.configInfo.fundFeeRate, rpc.feeOn === 0 || (rpc.feeOn === 1 && baseIn) || (rpc.feeOn === 2 && !baseIn));
            const { transaction } = await raydium.cpmm.swap({ poolInfo: info, poolKeys: keys, inputAmount: half, swapResult, slippage: slippagePct / 100, baseIn, txVersion: TxVersion.V0, feePayer: op.publicKey });
            return { tx: transaction, signers: [op, vault] };
          },
        },
        {
          kind: 'add_liquidity',
          build: async () => {
            const raydium = await load();
            await raydium.account.fetchWalletTokenAccounts();
            const { info, keys } = await poolInfo(raydium);
            const { transaction } = await raydium.cpmm.addLiquidity({ poolInfo: info, poolKeys: keys, inputAmount: half, baseIn: info.mintA.address === WSOL.toBase58(), slippage: new Percent(slippagePct, 100), txVersion: TxVersion.V0, feePayer: op.publicKey });
            return { tx: transaction, signers: [op, vault] };
          },
        },
        {
          kind: 'lock',
          build: async () => {
            const raydium = await load();
            const { info, keys } = await poolInfo(raydium);
            const lp = await raydium.account.fetchWalletTokenAccounts();
            const lpAcct = raydium.account.tokenAccounts.find((t: any) => t.mint.toBase58() === info.lpMint.address);
            if (!lpAcct || lpAcct.amount.isZero()) throw new Error('No LP tokens in the vault to lock.');
            void lp;
            const { transaction } = await raydium.cpmm.lockLp({ poolInfo: info, poolKeys: keys, lpAmount: lpAcct.amount, withMetadata: true, feeNftOwner: vault.publicKey, txVersion: TxVersion.V0, feePayer: op.publicKey });
            return { tx: transaction, signers: [op, vault] };
          },
        },
      ],
    };
  }
  // meteora: DAMM v2 position, then permanently lock it
  const { CpAmm, getTokenProgram } = cpAmm() as any;
  const cp = new CpAmm(connection());
  const positionNft = Keypair.generate();
  return {
    lpStatus: 'permanently_locked',
    steps: [
      {
        kind: 'swap',
        build: async () => {
          const st = await cp.fetchPoolState(new PublicKey(pool));
          const aIsSol = st.tokenAMint.equals(WSOL);
          const quote = cp.getQuote({ inAmount: half, inputTokenMint: WSOL, slippage: slippagePct, poolState: st, currentTime: Math.floor(Date.now() / 1000), currentSlot: await connection().getSlot(), tokenADecimal: aIsSol ? 9 : 6, tokenBDecimal: aIsSol ? 6 : 9 });
          const tx = await cp.swap({ payer: vault.publicKey, pool: new PublicKey(pool), inputTokenMint: WSOL, outputTokenMint: aIsSol ? st.tokenBMint : st.tokenAMint, amountIn: half, minimumAmountOut: quote.minSwapOutAmount, tokenAMint: st.tokenAMint, tokenBMint: st.tokenBMint, tokenAVault: st.tokenAVault, tokenBVault: st.tokenBVault, tokenAProgram: getTokenProgram(st.tokenAFlag), tokenBProgram: getTokenProgram(st.tokenBFlag), referralTokenAccount: null });
          tx.feePayer = op.publicKey;
          return { tx, signers: [op, vault] };
        },
      },
      {
        kind: 'add_liquidity',
        build: async () => {
          const st = await cp.fetchPoolState(new PublicKey(pool));
          const aIsSol = st.tokenAMint.equals(WSOL);
          const dq = cp.getDepositQuote({ inAmount: half, isTokenA: aIsSol, minSqrtPrice: st.sqrtMinPrice, maxSqrtPrice: st.sqrtMaxPrice, sqrtPrice: st.sqrtPrice });
          const tx = await cp.createPositionAndAddLiquidity({
            owner: vault.publicKey, pool: new PublicKey(pool), positionNft: positionNft.publicKey, liquidityDelta: dq.liquidityDelta,
            maxAmountTokenA: aIsSol ? half : dq.outputAmount, maxAmountTokenB: aIsSol ? dq.outputAmount : half,
            tokenAAmountThreshold: aIsSol ? half : dq.outputAmount, tokenBAmountThreshold: aIsSol ? dq.outputAmount : half,
            tokenAMint: st.tokenAMint, tokenBMint: st.tokenBMint, tokenAProgram: getTokenProgram(st.tokenAFlag), tokenBProgram: getTokenProgram(st.tokenBFlag),
          });
          tx.feePayer = op.publicKey;
          return { tx, signers: [op, vault, positionNft] };
        },
      },
      {
        kind: 'lock',
        build: async () => {
          const [pos] = await cp.getUserPositionByPool(new PublicKey(pool), vault.publicKey);
          if (!pos) throw new Error('Vault has no DAMM v2 position to lock.');
          const tx = await cp.permanentLockPosition({ owner: vault.publicKey, position: pos.position, positionNftAccount: pos.positionNftAccount, pool: new PublicKey(pool), unlockedLiquidity: pos.positionState.unlockedLiquidity });
          tx.feePayer = op.publicKey;
          return { tx, signers: [op, vault] };
        },
      },
    ],
  };
}

/** Sign an engine transaction with fresh blockhash. */
export async function finalize(e: EngineTx): Promise<Uint8Array> {
  const { blockhash } = await connection().getLatestBlockhash('confirmed');
  if (e.tx instanceof VersionedTransaction) {
    e.tx.message.recentBlockhash = blockhash;
    e.tx.sign(e.signers);
    return e.tx.serialize();
  }
  e.tx.recentBlockhash = blockhash;
  e.tx.feePayer = e.signers[0].publicKey;
  e.tx.sign(...e.signers);
  return e.tx.serialize();
}
