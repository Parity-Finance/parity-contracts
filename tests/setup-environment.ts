import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { keypairIdentity, Pda, PublicKey,createAmount, Umi } from "@metaplex-foundation/umi";
import { createSplAssociatedTokenProgram, createSplTokenProgram, findAssociatedTokenPda } from "@metaplex-foundation/mpl-toolbox";
import {
  createParityIssuanceProgram,
  createParityStakingProgram,
  createPtStakingProgram,
  findGlobalConfigPda,
  findPoolManagerPda,
  findTokenManagerPda,
  findUserStakePda,
  PARITY_ISSUANCE_PROGRAM_ID,
  PARITY_STAKING_PROGRAM_ID
} from "../clients/js/src";
import { Connection, Keypair, PublicKey as Web3JsPublicKey } from "@solana/web3.js";
import { fromWeb3JsKeypair, fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  findMetadataPda,
  safeFetchMetadata,
} from "@metaplex-foundation/mpl-token-metadata";

export type TestEnvironment = {
  umi: Umi;
  baseMint: Pda;
  baseMetadata: Pda;
  userBase: Pda;
  tokenManager: Pda;
  quoteMint: PublicKey;
  userQuote: PublicKey;
  vaultIssuance: Pda;
  poolManager: PublicKey;
  vaultStaking: Pda;
  xMint: PublicKey;
  xMetadata: Pda;
  userX: PublicKey;
  globalConfig: PublicKey;
  userStakePDA: Pda,
  vaultStakingPDA: Pda;
  baseMintDecimals: number;
  quoteMintDecimals: number;
  emergencyFundBasisPoints: number;
  exchangeRate: number;
  exchangeRateDecimals: number;
  limitPerSlot: number;
  withdrawExecutionWindow: number;
  withdrawTimeLock: number;
  allowedWallets: string[];
  keypair: Keypair;
  xMintDecimals: number;
  stakeExchangeRateDecimals: number;
  initialExchangeRateParityStaking: number;
  baselineYield: number;
  initialExchangeRatePtStaking: number;
  testDepositCapAmount: number;
};

export const setupTestEnvironment = async () => {
  const umi = createUmi("http://localhost:8899");
  umi.programs.add(createSplAssociatedTokenProgram());
  umi.programs.add(createSplTokenProgram());
  umi.programs.add(createParityIssuanceProgram());
  umi.programs.add(createParityStakingProgram());
  umi.programs.add(createPtStakingProgram());

  const connection = new Connection("http://localhost:8899", {
    commitment: "finalized",
  });

  const keypair = Keypair.fromSecretKey(
    Uint8Array.from(require("../keys/test-kp.json"))
  );

  umi.use(keypairIdentity(fromWeb3JsKeypair(keypair)));

  // Base Mint Universal
  const baseMint: Pda = umi.eddsa.findPda(PARITY_ISSUANCE_PROGRAM_ID, [
    Buffer.from("mint"),
  ]);
  const baseMetadata: Pda = findMetadataPda(umi, { mint: baseMint[0] });
  const userBase = findAssociatedTokenPda(umi, {
    owner: umi.identity.publicKey,
    mint: baseMint[0],
  });

  // Quote Mint Issuance
  let quoteMint: PublicKey;
  let userQuote: PublicKey;
  let vaultIssuance: Pda;

  // Test Controls
  const baseMintDecimals = 6;
  const quoteMintDecimals = 6;
  const emergencyFundBasisPoints = 1200;
  const exchangeRate = 1 * 10 ** quoteMintDecimals;
  const exchangeRateDecimals = quoteMintDecimals;
  const limitPerSlot = 100000 * 10 ** baseMintDecimals;
  const withdrawExecutionWindow = 3600;
  const withdrawTimeLock = 0;

  const tokenManager = findTokenManagerPda(umi);
  const poolManager = findPoolManagerPda(umi)[0];
  const vaultStaking = findAssociatedTokenPda(umi, {
    owner: poolManager,
    mint: baseMint[0],
  });
  const xMint: PublicKey = umi.eddsa.findPda(PARITY_STAKING_PROGRAM_ID, [
    Buffer.from("mint"),
  ])[0];

  const xMetadata: Pda = findMetadataPda(umi, { mint: xMint });
  const userX: PublicKey = findAssociatedTokenPda(umi, {
    owner: umi.identity.publicKey,
    mint: xMint,
  })[0];
  const globalConfig = findGlobalConfigPda(umi)[0];
  const userStakePDA = findUserStakePda(umi, {
    user: umi.identity.publicKey,
  });
  const vaultStakingPDA = findAssociatedTokenPda(umi, {
    owner: globalConfig,
    mint: baseMint[0],
  });

  const xMintDecimals = 6;
  const stakeExchangeRateDecimals = xMintDecimals;
  const initialExchangeRateParityStaking = 1 * 10 ** stakeExchangeRateDecimals;
  const baselineYield = 2000; // For 20%
  const initialExchangeRatePtStaking = 20 * 10 ** baseMintDecimals;
  const testDepositCapAmount = 2000 * 10 ** baseMintDecimals;

  try {
    await umi.rpc.airdrop(
      umi.identity.publicKey,
      createAmount(100_000 * 10 ** 9, "SOL", 9),
      { commitment: "finalized" }
    );

    const quoteMintWeb3js = await createMint(
      connection,
      keypair,
      keypair.publicKey,
      keypair.publicKey,
      quoteMintDecimals
    );

    console.log("Created USDC: ", quoteMintWeb3js.toBase58());

    const userUsdcInfo = await getOrCreateAssociatedTokenAccount(
      connection,
      keypair,
      quoteMintWeb3js,
      keypair.publicKey,
      false,
      "confirmed",
      {
        commitment: "confirmed",
      },
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    await mintTo(
      connection,
      keypair,
      quoteMintWeb3js,
      userUsdcInfo.address,
      keypair.publicKey,
      100_000_000 * 10 ** quoteMintDecimals,
      [],
      {
        commitment: "confirmed",
      },
      TOKEN_PROGRAM_ID
    );

    userQuote = fromWeb3JsPublicKey(userUsdcInfo.address);
    quoteMint = fromWeb3JsPublicKey(quoteMintWeb3js);

    vaultIssuance = findAssociatedTokenPda(umi, {
      owner: tokenManager[0],
      mint: quoteMint,
    });

    // console.log("quoteMint:", quoteMint.toString());
    // console.log("userQuote:", userQuote.toString());
    // console.log("vaultIssuance:", vaultIssuance.toString());

  } catch (error) {
    console.log(error);
  }

  const allowedWallets = [keypair.publicKey.toBase58()];

  const env: TestEnvironment = {
    umi,
    baseMint,
    baseMetadata,
    userBase,
    tokenManager,
    quoteMint,
    userQuote,
    vaultIssuance,
    baseMintDecimals,
    quoteMintDecimals,
    emergencyFundBasisPoints,
    exchangeRate,
    exchangeRateDecimals,
    limitPerSlot,
    withdrawExecutionWindow,
    withdrawTimeLock,
    allowedWallets,
    keypair,
    poolManager,
    vaultStaking,
    xMint,
    xMetadata,
    userX,
    globalConfig,
    userStakePDA,
    vaultStakingPDA,
    xMintDecimals,
    stakeExchangeRateDecimals,
    initialExchangeRateParityStaking,
    baselineYield,
    initialExchangeRatePtStaking,
    testDepositCapAmount,
  };

  // Log everything being exported
  // console.log("Exporting environment:");
  // Object.entries(env).forEach(([key, value]) => {
  //   if (value instanceof Keypair) {
  //     console.log(`${key}: [Keypair]`);
  //   } else if (value instanceof Web3JsPublicKey || (value as any).publicKey) {
  //     console.log(`${key}: ${value.toString()}`);
  //   } else {
  //     console.log(`${key}:`, value);
  //   }
  // });

  return env;
};


















