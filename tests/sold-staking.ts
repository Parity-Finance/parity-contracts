import { keypairIdentity, Pda, PublicKey, publicKey, TransactionBuilder, createAmount } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { createAssociatedToken, createSplAssociatedTokenProgram, createSplTokenProgram, findAssociatedTokenPda, safeFetchToken, SPL_ASSOCIATED_TOKEN_PROGRAM_ID } from "@metaplex-foundation/mpl-toolbox"
import { Connection, Keypair, PublicKey as Web3JsPublicKey } from "@solana/web3.js";
import { createSoldIssuanceProgram, initializeStakePool, findStakePoolPda, safeFetchStakePool, stake, unstake, SOLD_STAKING_PROGRAM_ID } from "../clients/js/src"
import { ASSOCIATED_TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { fromWeb3JsKeypair, fromWeb3JsPublicKey, toWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { findMetadataPda } from "@metaplex-foundation/mpl-token-metadata";
import assert from 'assert';

describe("sold-staking", () => {
  let umi = createUmi("http://localhost:8899");
  umi.programs.add(createSplAssociatedTokenProgram());
  umi.programs.add(createSplTokenProgram());
  umi.programs.add(createSoldIssuanceProgram())

  const connection = new Connection("http://localhost:8899", { commitment: "finalized" })

  const keypair = Keypair.fromSecretKey(
    Uint8Array.from(require("../keys/test-kp.json"))
  );

  umi.use(keypairIdentity(fromWeb3JsKeypair(keypair)))

  // Stable Mint and ATAs
  let baseMint: PublicKey;
  let userBase: PublicKey;
  let vault: PublicKey;

  let stakePool = findStakePoolPda(umi)[0];

  // Quote Mint and ATAs
  let xMint: PublicKey = umi.eddsa.findPda(SOLD_STAKING_PROGRAM_ID, [Buffer.from("mint")])[0];
  let metadata: Pda = findMetadataPda(umi, { mint: xMint })
  let userX: PublicKey = findAssociatedTokenPda(umi, { owner: umi.identity.publicKey, mint: xMint })[0]

  // Test Controls
  const baseMintDecimals = 9;
  const xMintDecimals = 9;
  const initialExchangeRate = 5 * 10 ** xMintDecimals;
  const exchangeRateDecimals = xMintDecimals

  before(async () => {
    try {
      await umi.rpc.airdrop(umi.identity.publicKey, createAmount(100_000 * 10 ** 9, "SOL", 9), { commitment: "finalized" })

      const baseMintWeb3js = await createMint(
        connection,
        keypair,
        keypair.publicKey,
        keypair.publicKey,
        baseMintDecimals // Decimals
      );

      console.log("Created Base Mint: ", baseMintWeb3js.toBase58());

      const userBaseInfo = await getOrCreateAssociatedTokenAccount(
        connection,
        keypair,
        baseMintWeb3js,
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
        baseMintWeb3js,
        userBaseInfo.address,
        keypair.publicKey,
        100_000_000 * 10 ** baseMintDecimals,
        [],
        {
          commitment: "confirmed",
        },
        TOKEN_PROGRAM_ID
      );

      userBase = fromWeb3JsPublicKey(userBaseInfo.address);
      baseMint = fromWeb3JsPublicKey(baseMintWeb3js);
      vault = findAssociatedTokenPda(umi, { owner: stakePool, mint: baseMint })[0];
    } catch (error) {
      console.log(error);
    }
  })

  it("Stake Pool is initialized!", async () => {
    let txBuilder = new TransactionBuilder();

    txBuilder = txBuilder.add(initializeStakePool(umi, {
      stakePool,
      vault,
      metadata,
      baseMint,
      xMint,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      name: "xSOLD",
      symbol: "xSOLD",
      uri: "https://builderz.dev/_next/image?url=%2Fimages%2Fheader-gif.gif&w=3840&q=75",
      decimals: xMintDecimals,
      initialExchangeRate,
    }))

    await txBuilder.sendAndConfirm(umi, { send: { skipPreflight: false } });

    const stakePoolAcc = await safeFetchStakePool(umi, stakePool);

    assert.equal(stakePoolAcc.baseMint, baseMint);
    assert.equal(stakePoolAcc.baseMintDecimals, baseMintDecimals);
    assert.equal(stakePoolAcc.xMint, xMint);
    assert.equal(stakePoolAcc.xMintDecimals, xMintDecimals);
    assert.equal(stakePoolAcc.initialExchangeRate, initialExchangeRate);
    assert.equal(stakePoolAcc.baseBalance, 0);
    assert.equal(stakePoolAcc.xSupply, 0);
  });

  it("baseMint can be staked for xMint", async () => {
    const quantity = 10000 * 10 ** baseMintDecimals;

    let txBuilder = new TransactionBuilder();

    const userXAtaAcc = await safeFetchToken(umi, userX)

    if (!userXAtaAcc) {
      txBuilder = txBuilder.add(createAssociatedToken(umi, {
        mint: xMint,
      }))
    }

    const _stakePoolAcc = await safeFetchStakePool(umi, stakePool);
    const _vaultAcc = await safeFetchToken(umi, vault);

    txBuilder = txBuilder.add(stake(umi, {
      stakePool,
      baseMint,
      xMint,
      payerBaseMintAta: userBase,
      payerXMintAta: userX,
      vault,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      quantity,
    }))

    await txBuilder.sendAndConfirm(umi, { send: { skipPreflight: false } });

    const stakePoolAcc = await safeFetchStakePool(umi, stakePool);
    const vaultAcc = await safeFetchToken(umi, vault);

    const expectedBaseMintAmount = BigInt(quantity);

    const expectedxMintAmount = BigInt(quantity / 10 ** baseMintDecimals * initialExchangeRate / 10 ** exchangeRateDecimals * 10 ** xMintDecimals);

    assert.equal(stakePoolAcc.baseBalance, _stakePoolAcc.baseBalance + expectedBaseMintAmount, "Base Balance is not correct");
    assert.equal(vaultAcc.amount, _vaultAcc.amount + expectedBaseMintAmount, "Vault amount is not correct");
    assert.equal(stakePoolAcc.xSupply, _stakePoolAcc.xSupply + expectedxMintAmount, "xSupply is not correct");
  })

  it("baseMint can be unstaked by redeeming xMint", async () => {
    const quantity = 10000 * 10 ** baseMintDecimals;

    let txBuilder = new TransactionBuilder();

    const userXAtaAcc = await safeFetchToken(umi, userX)

    if (!userXAtaAcc) {
      txBuilder = txBuilder.add(createAssociatedToken(umi, {
        mint: baseMint,
      }))
    }

    const _stakePoolAcc = await safeFetchStakePool(umi, stakePool);
    const _vaultAcc = await safeFetchToken(umi, vault);

    txBuilder = txBuilder.add(unstake(umi, {
      stakePool,
      baseMint,
      xMint,
      payerBaseMintAta: userBase,
      payerXMintAta: userX,
      vault,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      quantity,
    }))

    await txBuilder.sendAndConfirm(umi, { send: { skipPreflight: true } });

    const stakePoolAcc = await safeFetchStakePool(umi, stakePool);
    const vaultAcc = await safeFetchToken(umi, vault);

    const expectedBaseMintAmount = BigInt(quantity);
    const expectedxMintAmount = BigInt((quantity / 10 ** baseMintDecimals) * initialExchangeRate / 10 ** exchangeRateDecimals * 10 ** xMintDecimals);

    assert.equal(stakePoolAcc.baseBalance, _stakePoolAcc.baseBalance - expectedBaseMintAmount, "Base Balance is not correct");
    assert.equal(vaultAcc.amount, _vaultAcc.amount - expectedBaseMintAmount, "Vault amount is not correct");
    assert.equal(stakePoolAcc.xSupply, _stakePoolAcc.xSupply - expectedxMintAmount, "xSupply is not correct");
  })
})
