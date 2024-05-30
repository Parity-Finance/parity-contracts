import { keypairIdentity, Pda, PublicKey, publicKey, TransactionBuilder, createAmount } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { createAssociatedToken, createSplAssociatedTokenProgram, createSplTokenProgram, findAssociatedTokenPda, safeFetchToken, SPL_ASSOCIATED_TOKEN_PROGRAM_ID } from "@metaplex-foundation/mpl-toolbox"
import { Connection, Keypair, PublicKey as Web3JsPublicKey } from "@solana/web3.js";
import { createSoldIssuanceProgram, findTokenManagerPda, initialize, SOLD_ISSUANCE_PROGRAM_ID, mint, redeem, safeFetchTokenManager, getMerkleRoot, getMerkleProof, toggleActive, updateMerkleRoot, depositFunds, withdrawFunds, initializeStakePool, findStakePoolPda, safeFetchStakePool, stake, unstake } from "../clients/js/src"
import { ASSOCIATED_TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { fromWeb3JsKeypair, fromWeb3JsPublicKey, toWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { findMetadataPda } from "@metaplex-foundation/mpl-token-metadata";
import assert from 'assert';

describe.only("sold-staking", () => {
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
  let baseMint: PublicKey = umi.eddsa.findPda(SOLD_ISSUANCE_PROGRAM_ID, [Buffer.from("mint")])[0]
  let metadata: Pda = findMetadataPda(umi, { mint: baseMint })
  let userBase: PublicKey = findAssociatedTokenPda(umi, { owner: umi.identity.publicKey, mint: baseMint })[0]

  // Quote Mint and ATAs
  let xMint: PublicKey
  let userX: PublicKey
  let vault: Pda

  let stakePool: Pda

  // Test Controls
  const baseMintDecimals = 3;
  const xMintDecimals = 5;
  const initialExchangeRate = 1;

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

      const userUsdcInfo = await getOrCreateAssociatedTokenAccount(
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
        toWeb3JsPublicKey(userBase),
        userUsdcInfo.address,
        keypair.publicKey,
        100_000_000 * 10 ** baseMintDecimals,
        [],
        {
          commitment: "confirmed",
        },
        TOKEN_PROGRAM_ID
      );

      userBase = fromWeb3JsPublicKey(userUsdcInfo.address);
      baseMint = fromWeb3JsPublicKey(baseMintWeb3js)

      stakePool = findStakePoolPda(umi);
      vault = findAssociatedTokenPda(umi, { owner: stakePool[0], mint: baseMint });
    } catch (error) {
      console.log(error);
    }
  })

  it("Token manager is initialized!", async () => {
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

    await txBuilder.sendAndConfirm(umi);

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
    const quantity = 10000;

    let txBuilder = new TransactionBuilder();

    const userBaseAtaAcc = await safeFetchToken(umi, userBase)

    if (!userBaseAtaAcc) {
      txBuilder = txBuilder.add(createAssociatedToken(umi, {
        mint: baseMint,
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

    const expectedBaseMintAmount = BigInt(quantity * 10 ** baseMintDecimals);
    const expectedxMintAmount = BigInt(quantity * 10 ** xMintDecimals * initialExchangeRate);

    assert.equal(stakePoolAcc.baseBalance, _stakePoolAcc.baseBalance + expectedBaseMintAmount);
    assert.equal(stakePoolAcc.xSupply, _stakePoolAcc.xSupply + expectedxMintAmount);
    assert.equal(vaultAcc.amount, _vaultAcc.amount + expectedxMintAmount);
  })

  it("baseMint can be unstaked by redeeming xMint", async () => {
    const quantity = 1000;

    let txBuilder = new TransactionBuilder();

    const useBaseAtaAcc = await safeFetchToken(umi, userBase)

    if (!useBaseAtaAcc) {
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

    await txBuilder.sendAndConfirm(umi, { send: { skipPreflight: false } });

    const stakePoolAcc = await safeFetchStakePool(umi, stakePool);
    const vaultAcc = await safeFetchToken(umi, vault);

    const expectedBaseMintAmount = BigInt(quantity * 10 ** baseMintDecimals);
    const expectedxMintAmount = BigInt(quantity * 10 ** xMintDecimals * initialExchangeRate);

    assert.equal(stakePoolAcc.baseBalance, _stakePoolAcc.baseBalance - expectedBaseMintAmount);
    assert.equal(stakePoolAcc.xSupply, _stakePoolAcc.xSupply - expectedxMintAmount);
    assert.equal(vaultAcc.amount, _vaultAcc.amount - expectedxMintAmount);
  })
})
