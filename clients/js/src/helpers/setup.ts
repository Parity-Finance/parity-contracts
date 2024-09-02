import { publicKey, TransactionBuilder, Umi } from '@metaplex-foundation/umi';
import { findMetadataPda } from '@metaplex-foundation/mpl-token-metadata';
import {
  findAssociatedTokenPda,
  SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@metaplex-foundation/mpl-toolbox';
import {
  findGlobalConfigPda,
  findPoolManagerPda,
  findTokenManagerPda,
  initializeGlobalConfig,
  initializePoolManager,
  initializeTokenManager,
  PARITY_ISSUANCE_PROGRAM_ID,
  PARITY_STAKING_PROGRAM_ID,
} from '../generated';
import { getMerkleRoot } from '../utils';

export type SetupOptions = {
  baseMintDecimals: number;
  baseMintSymbol: string;
  baseMintName: string;
  baseMintUri: string;
  xMintSymbol: string;
  xMintName: string;
  xMintUri: string;
  quoteMint: string;
  exchangeRate: number;
  stakingInitialExchangeRate: number;
  emergencyFundBasisPoints: number;
  xMintDecimals: number;
  limitPerSlot: number;
  allowList: string[];
  withdrawExecutionWindow: number;
  withdrawTimeLock: number;
  intervalAprRate: number;
  secondsPerInterval: number;
  mintFeeBps: number;
  redeemFeeBps: number;
  depositCapParityStaking: number;
  baselineYieldBps: number;
  depositCapPtStaking: number;
  stakingInitialExchangeRatePtStaking: number;
};

export async function setup(umi: Umi, setupOptions: SetupOptions) {
  const baseMint = umi.eddsa.findPda(PARITY_ISSUANCE_PROGRAM_ID, [
    Buffer.from('mint'),
  ])[0];
  const xMint = umi.eddsa.findPda(PARITY_STAKING_PROGRAM_ID, [
    Buffer.from('mint'),
  ])[0];

  const tokenManager = findTokenManagerPda(umi)[0];
  const poolManager = findPoolManagerPda(umi)[0];
  const globalConfig = findGlobalConfigPda(umi)[0];

  const vaultIssuance = findAssociatedTokenPda(umi, {
    owner: tokenManager,
    mint: publicKey(setupOptions.quoteMint),
  });
  const vaultStaking = findAssociatedTokenPda(umi, {
    owner: poolManager,
    mint: baseMint,
  });


  const vaultPtStaking = findAssociatedTokenPda(umi, {
    owner: globalConfig,
    mint: baseMint,
  });

  const baseMetadata = findMetadataPda(umi, { mint: baseMint });
  const xMetadata = findMetadataPda(umi, { mint: xMint });

  // Check
  setupOptions.allowList.forEach((address) => {
    try {
      return publicKey(address);
    } catch (error) {
      throw new Error(`Invalid public key in allowList: ${address}`);
    }
  });

  const merkleRoot = getMerkleRoot(setupOptions.allowList);

  let txBuilder = new TransactionBuilder();

  txBuilder = txBuilder
    .add(
      initializeTokenManager(umi, {
        tokenManager,
        owner: umi.identity,
        vault: vaultIssuance,
        metadata: baseMetadata,
        mint: baseMint,
        quoteMint: publicKey(setupOptions.quoteMint),
        associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
        name: setupOptions.baseMintName,
        symbol: setupOptions.baseMintSymbol,
        uri: setupOptions.baseMintUri,
        decimals: setupOptions.baseMintDecimals,
        exchangeRate: setupOptions.exchangeRate,
        emergencyFundBasisPoints: setupOptions.emergencyFundBasisPoints,
        merkleRoot,
        admin: umi.identity.publicKey,
        minter: poolManager,
        limitPerSlot: setupOptions.limitPerSlot,
        withdrawExecutionWindow: setupOptions.withdrawExecutionWindow,
        withdrawTimeLock: setupOptions.withdrawTimeLock,
        mintFeeBps: setupOptions.mintFeeBps,
        redeemFeeBps: setupOptions.redeemFeeBps,
      })
    )
    .add(
      initializePoolManager(umi, {
        poolManager,
        vault: vaultStaking,
        metadata: xMetadata,
        baseMint,
        xMint,
        associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
        name: setupOptions.xMintName,
        symbol: setupOptions.xMintSymbol,
        uri: setupOptions.xMintUri,
        decimals: setupOptions.xMintDecimals,
        intervalAprRate: setupOptions.intervalAprRate,
        secondsPerInterval: setupOptions.secondsPerInterval,
        initialExchangeRate: setupOptions.stakingInitialExchangeRate,
        depositCap: setupOptions.depositCapParityStaking,
        owner: umi.identity,
        admin: umi.identity.publicKey,
      })
    ).add(
      initializeGlobalConfig(umi, {
        globalConfig,
        baseMint,
        vault: vaultPtStaking,
        user: umi.identity,
        associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
        admin: umi.identity.publicKey,
        baselineYieldBps: setupOptions.baselineYieldBps,
        depositCap: setupOptions.depositCapPtStaking,
        initialExchangeRate: setupOptions.stakingInitialExchangeRatePtStaking,
      })
    );

  return txBuilder;
}