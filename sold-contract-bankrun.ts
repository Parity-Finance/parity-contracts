import { keypairIdentity, Pda, PublicKey, publicKey, TransactionBuilder, createAmount, some } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { createAssociatedToken, createSplAssociatedTokenProgram, createSplTokenProgram, findAssociatedTokenPda, safeFetchToken, SPL_ASSOCIATED_TOKEN_PROGRAM_ID } from "@metaplex-foundation/mpl-toolbox"
import { Connection, Keypair, PublicKey as Web3JsPublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { createSoldIssuanceProgram, findTokenManagerPda, initializeTokenManager, SOLD_ISSUANCE_PROGRAM_ID, mint, redeem, safeFetchTokenManager, getMerkleRoot, getMerkleProof, toggleActive, updatePoolManager, depositFunds, withdrawFunds, initializePoolManager, SOLD_STAKING_PROGRAM_ID, calculateExchangeRate, stake, unstake, updateAnnualYield, findPoolManagerPda, updateTokenManagerAdmin, safeFetchPoolManager, initializeWithdrawFunds } from "./clients/js/src"
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction, createInitializeMintInstruction, createMint, getMinimumBalanceForRentExemptMint, getOrCreateAssociatedTokenAccount, MINT_SIZE, mintTo, TOKEN_PROGRAM_ID, createMintToCheckedInstruction } from "@solana/spl-token";
import { fromWeb3JsKeypair, fromWeb3JsPublicKey, toWeb3JsTransaction } from "@metaplex-foundation/umi-web3js-adapters";
import { findMetadataPda } from "@metaplex-foundation/mpl-token-metadata";
import assert from 'assert';
import chai, { assert as chaiAssert } from 'chai';
import { BanksClient, ProgramTestContext, start } from "solana-bankrun";

const umiBankrun = (context: ProgramTestContext) => {
  const client = context.banksClient;
  console.log(context.payer);
  console.log(context.lastBlockhash);

  const umi = createUmi("http://localhost:8899");
  umi.programs.add(createSplAssociatedTokenProgram());
  umi.programs.add(createSplTokenProgram());
  umi.programs.add(createSoldIssuanceProgram())

  umi.use(keypairIdentity(fromWeb3JsKeypair(context.payer)))

  return { umi, client };
}

describe("sold-issuance", () => {
  let umi = createUmi("http://localhost:8899");
  let client: BanksClient;
  umi.programs.add(createSplAssociatedTokenProgram());
  umi.programs.add(createSplTokenProgram());
  umi.programs.add(createSoldIssuanceProgram())

  const connection = new Connection("http://localhost:8899", { commitment: "finalized" })

  const keypair = Keypair.fromSecretKey(
    Uint8Array.from(require("../keys/test-kp.json"))
  );

  umi.use(keypairIdentity(fromWeb3JsKeypair(keypair)))

  // Base Mint Universal
  let baseMint: Pda = umi.eddsa.findPda(SOLD_ISSUANCE_PROGRAM_ID, [Buffer.from("mint")])
  let baseMetadata: Pda = findMetadataPda(umi, { mint: baseMint[0] })
  let userBase = findAssociatedTokenPda(umi, { owner: umi.identity.publicKey, mint: baseMint[0] })

  // Quote Mint Issuance
  let quoteMint: PublicKey
  let userQuote: PublicKey
  let vaultIssuance: Pda

  // Test Controls
  const baseMintDecimals = 9;
  const quoteMintDecimals = 9;
  const emergencyFundBasisPoints = 1200; // 12% have to stay in the vaultIssuance
  const exchangeRate = 250 * 10 ** baseMintDecimals;
  const exchangeRateDecimals = baseMintDecimals

  const mintLimitPerSlot = 5000 * 10 ** baseMintDecimals;
  const redemptionLimitPerSlot = 5000 * 10 ** baseMintDecimals;

  const withdrawExecutionWindow = 3600;
  const withdrawTimeLock = 3600;

  // Staking Program
  let poolManager = findPoolManagerPda(umi)[0];
  let tokenManager = findTokenManagerPda(umi);
  let vaultStaking = findAssociatedTokenPda(umi, { owner: poolManager, mint: baseMint[0] })

  // xMint Mint and ATAs
  let xMint: PublicKey = umi.eddsa.findPda(SOLD_STAKING_PROGRAM_ID, [Buffer.from("mint")])[0];
  let xMetadata: Pda = findMetadataPda(umi, { mint: xMint })
  let userX: PublicKey = findAssociatedTokenPda(umi, { owner: umi.identity.publicKey, mint: xMint })[0]

  // Stake Pool Controls
  const xMintDecimals = 6;
  const stakeExchangeRateDecimals = xMintDecimals
  const initialExchangeRate = 2 * 10 ** exchangeRateDecimals;
  const allowedWallets = [keypair.publicKey.toBase58()]

  before(async () => {
    try {
      const context = await start([{ name: "sold_issuance", programId: new Web3JsPublicKey("JCLA8ET4DCCsJsvNcaNBhpY8ZudFfAbpgspPBnni1NQy") }, { name: "sold_staking", programId: new Web3JsPublicKey("EuhcfekB1smmCcNqr38FvXtmWGkDy3rx8u9L1hf7ee3E") }], []);

      const { umi: umiWithBankrunPayer, client: bankrunClient } = umiBankrun(context);
      umi = umiWithBankrunPayer
      client = bankrunClient

      // console.log("Requsting Airdrop");

      // await umi.rpc.airdrop(umi.identity.publicKey, createAmount(100_000 * 10 ** 9, "SOL", 9), { commitment: "finalized" })

      // console.log("Requested Airdrop");

      // const quoteMintWeb3js = await createMint(
      //   connection,
      //   keypair,
      //   keypair.publicKey,
      //   keypair.publicKey,
      //   quoteMintDecimals // Decimals
      // );

      const quoteMintWeb3Js = Keypair.generate().publicKey
      const userQuoteMint = getAssociatedTokenAddressSync(quoteMintWeb3Js, context.payer.publicKey, false)

      let tx = new Transaction();

      tx = tx.add(SystemProgram.createAccount({
        fromPubkey: context.payer.publicKey,
        newAccountPubkey: Keypair.generate().publicKey,
        space: MINT_SIZE,
        lamports: await getMinimumBalanceForRentExemptMint(connection),
        programId: TOKEN_PROGRAM_ID,
      })).add(createInitializeMintInstruction(
        quoteMintWeb3Js,
        quoteMintDecimals,
        context.payer.publicKey,
        context.payer.publicKey
      )).add(
        createAssociatedTokenAccountInstruction(
          context.payer.publicKey,
          userQuoteMint,
          context.payer.publicKey,
          quoteMintWeb3Js,
        )
      ).add(
        createMintToCheckedInstruction(
          quoteMintWeb3Js,
          context.payer.publicKey,
          context.payer.publicKey,
          100_000_000 * 10 ** quoteMintDecimals,
          quoteMintDecimals
        )
      )

      console.log("Created USDC: ", quoteMintWeb3Js.toBase58());

      // const userUsdcInfo = await getOrCreateAssociatedTokenAccount(
      //   connection,
      //   keypair,
      //   quoteMintWeb3js,
      //   keypair.publicKey,
      //   false,
      //   "confirmed",
      //   {
      //     commitment: "confirmed",
      //   },
      //   TOKEN_PROGRAM_ID,
      //   ASSOCIATED_TOKEN_PROGRAM_ID
      // );

      // await mintTo(
      //   connection,
      //   keypair,
      //   quoteMintWeb3js,
      //   userUsdcInfo.address,
      //   keypair.publicKey,
      //   100_000_000 * 10 ** quoteMintDecimals,
      //   [],
      //   {
      //     commitment: "confirmed",
      //   },
      //   TOKEN_PROGRAM_ID
      // );

      userQuote = publicKey(userQuoteMint)
      quoteMint = publicKey(quoteMintWeb3Js)

      vaultIssuance = findAssociatedTokenPda(umi, { owner: tokenManager[0], mint: quoteMint });
    } catch (error) {
      console.log(error);
    }
  })

  it.only("Token manager is initialized!", async () => {
    const merkleRoot = getMerkleRoot(allowedWallets);

    let txBuilder = new TransactionBuilder();

    txBuilder = txBuilder.add(initializeTokenManager(umi, {
      tokenManager,
      owner: umi.identity,
      vault: vaultIssuance,
      metadata: baseMetadata,
      mint: baseMint,
      quoteMint: quoteMint,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      name: "SOLD",
      symbol: "SOLD",
      uri: "https://builderz.dev/_next/image?url=%2Fimages%2Fheader-gif.gif&w=3840&q=75",
      decimals: baseMintDecimals,
      exchangeRate,
      emergencyFundBasisPoints,
      merkleRoot,
      admin: umi.identity.publicKey,
      minter: poolManager,
      gateKeepers: [],
      mintLimitPerSlot,
      redemptionLimitPerSlot,
      withdrawExecutionWindow,
      withdrawTimeLock
    }))

    // TODO:
    // const web3Tx = toWeb3JsTransaction()

    // const res = await client.processTransaction()
    // console.log(res);


    // await txBuilder.sendAndConfirm(umi);

    const tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);

    assert.deepStrictEqual(
      new Uint8Array(tokenManagerAcc.merkleRoot),
      new Uint8Array(merkleRoot),
      "Merkle root in token manager account should match expected merkle root"
    );
    assert.equal(tokenManagerAcc.mint, baseMint[0], "Token manager's mint should match the base mint");
    assert.equal(tokenManagerAcc.mintDecimals, baseMintDecimals, "Token manager's mint decimals should match base mint decimals");
    assert.equal(tokenManagerAcc.quoteMint, quoteMint, "Token manager's quote mint should match the provided quote mint");
    assert.equal(tokenManagerAcc.quoteMintDecimals, quoteMintDecimals, "Token manager's quote mint decimals should match the provided quote mint decimals");
    assert.equal(tokenManagerAcc.exchangeRate, BigInt(exchangeRate), "Token manager's exchange rate should match the provided exchange rate");
    assert.equal(tokenManagerAcc.emergencyFundBasisPoints, emergencyFundBasisPoints, "Token manager's emergency fund basis points should match the provided value");
    assert.equal(tokenManagerAcc.active, true, "Token manager should be active");
    assert.equal(tokenManagerAcc.totalSupply, 0, "Token manager's total supply should be zero");
    assert.equal(tokenManagerAcc.totalCollateral, 0, "Token manager's total collateral should be zero");
  });

  it.only("Stake Pool is initialized!", async () => {
    let txBuilder = new TransactionBuilder();

    txBuilder = txBuilder.add(initializePoolManager(umi, {
      poolManager,
      vault: vaultStaking,
      metadata: xMetadata,
      baseMint: baseMint,
      xMint,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      name: "xSOLD",
      symbol: "xSOLD",
      uri: "https://builderz.dev/_next/image?url=%2Fimages%2Fheader-gif.gif&w=3840&q=75",
      decimals: xMintDecimals,
      initialExchangeRate,
      owner: umi.identity,
      admin: umi.identity.publicKey,
    }))

    await txBuilder.sendAndConfirm(umi, { send: { skipPreflight: true } });

    const stakePoolAcc = await safeFetchPoolManager(umi, poolManager);

    assert.equal(stakePoolAcc.baseMint, baseMint[0]);
    assert.equal(stakePoolAcc.baseMintDecimals, baseMintDecimals);
    assert.equal(stakePoolAcc.xMint, xMint);
    assert.equal(stakePoolAcc.xMintDecimals, xMintDecimals);
    assert.equal(stakePoolAcc.initialExchangeRate, BigInt(initialExchangeRate));
    assert.equal(stakePoolAcc.baseBalance, 0n);
    assert.equal(stakePoolAcc.xSupply, 0n);
  });

  it.only("Sold can be minted for USDC", async () => {
    const quantity = 10000 * 10 ** baseMintDecimals;

    const proof = getMerkleProof(allowedWallets, keypair.publicKey.toBase58());

    let txBuilder = new TransactionBuilder();

    const userBaseAtaAcc = await safeFetchToken(umi, userBase)

    if (!userBaseAtaAcc) {
      txBuilder = txBuilder.add(createAssociatedToken(umi, {
        mint: baseMint,
      }))
    }

    const _tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    const _vaultAcc = await safeFetchToken(umi, vaultIssuance);

    txBuilder = txBuilder.add(mint(umi, {
      tokenManager,
      mint: baseMint,
      quoteMint: quoteMint,
      payerMintAta: userBase,
      payerQuoteMintAta: userQuote,
      vault: vaultIssuance,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      quantity,
      proof
    }))

    await txBuilder.sendAndConfirm(umi, { send: { skipPreflight: false } });

    const tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    const vaultAcc = await safeFetchToken(umi, vaultIssuance);

    const expectedMintAmount = BigInt(quantity);
    const powerDifference = quoteMintDecimals - baseMintDecimals;

    // Adjust quantity by the power difference before converting to BigInt
    let adjustedQuantity;
    if (powerDifference > 0) {
      adjustedQuantity = BigInt(quantity) * BigInt(10 ** powerDifference);
    } else if (powerDifference < 0) {
      adjustedQuantity = BigInt(quantity) / BigInt(10 ** (-powerDifference));
    } else {
      adjustedQuantity = BigInt(quantity);
    }

    // Calculate the expected quote amount
    const expectedQuoteAmount = adjustedQuantity * BigInt(exchangeRate) / BigInt(10 ** exchangeRateDecimals);

    assert.equal(tokenManagerAcc.totalSupply, _tokenManagerAcc.totalSupply + expectedMintAmount, "Total supply should be correct");
    assert.equal(tokenManagerAcc.totalCollateral, _tokenManagerAcc.totalCollateral + expectedQuoteAmount, "Total collateral should be correct");
    assert.equal(vaultAcc.amount, _vaultAcc.amount + expectedQuoteAmount, "Vault amount should be correct");
  })

  it.only("Sold can be redeemed for Quote", async () => {
    const quantity = 1000 * 10 ** baseMintDecimals;

    const proof = getMerkleProof(allowedWallets, keypair.publicKey.toBase58());

    let txBuilder = new TransactionBuilder();

    const userQuoteAtaAcc = await safeFetchToken(umi, userQuote)

    if (!userQuoteAtaAcc) {
      txBuilder = txBuilder.add(createAssociatedToken(umi, {
        mint: userQuote,
      }))
    }

    const _tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    const _vaultAcc = await safeFetchToken(umi, vaultIssuance);

    txBuilder = txBuilder.add(redeem(umi, {
      tokenManager,
      mint: baseMint,
      quoteMint: quoteMint,
      payerMintAta: userBase,
      payerQuoteMintAta: userQuote,
      vault: vaultIssuance,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      quantity,
      proof
    }))

    await txBuilder.sendAndConfirm(umi, { send: { skipPreflight: false } });

    const tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    const vaultAcc = await safeFetchToken(umi, vaultIssuance);

    const expectedMintAmount = BigInt(quantity);
    const expectedQuoteAmount = (BigInt(quantity) / BigInt(10 ** baseMintDecimals) * BigInt(exchangeRate) / BigInt(10 ** exchangeRateDecimals)) * BigInt(10 ** quoteMintDecimals);

    assert.equal(tokenManagerAcc.totalSupply, _tokenManagerAcc.totalSupply - expectedMintAmount, "Total supply should be correct");
    assert.equal(tokenManagerAcc.totalCollateral, _tokenManagerAcc.totalCollateral - expectedQuoteAmount, "Total collateral should be correct");
    assert.equal(vaultAcc.amount, _vaultAcc.amount - expectedQuoteAmount, "Vault amount should be correct");
  });

  it("should prevent minting when paused", async () => {
    // Pause the token manager
    let txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(toggleActive(umi, { tokenManager, active: false }));
    await txBuilder.sendAndConfirm(umi);

    let tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    assert.strictEqual(tokenManagerAcc.active, false);

    // Attempt to mint tokens
    txBuilder = new TransactionBuilder();
    let userBaseAtaAcc = await safeFetchToken(umi, userBase)

    if (!userBaseAtaAcc) {
      txBuilder = txBuilder.add(createAssociatedToken(umi, {
        mint: baseMint,
      }))
    }
    txBuilder = txBuilder.add(mint(umi, {
      tokenManager,
      mint: baseMint,
      quoteMint: quoteMint,
      payerMintAta: userBase,
      payerQuoteMintAta: userQuote,
      vault: vaultIssuance,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      quantity: 1000,
      proof: getMerkleProof(allowedWallets, keypair.publicKey.toBase58())
    }));

    await assert.rejects(
      async () => {
        await txBuilder.sendAndConfirm(umi);
      },
      (err) => {
        return (err as Error).message.includes("Mint and redemptions paused");
      },
      "Expected minting to fail when paused"
    );

    // Attempt to redeem tokens
    txBuilder = new TransactionBuilder();
    userBaseAtaAcc = await safeFetchToken(umi, userBase)

    if (!userBaseAtaAcc) {
      txBuilder = txBuilder.add(createAssociatedToken(umi, {
        mint: baseMint,
      }))
    }
    txBuilder = txBuilder.add(redeem(umi, {
      tokenManager,
      mint: baseMint,
      quoteMint: quoteMint,
      payerMintAta: userBase,
      payerQuoteMintAta: userQuote,
      vault: vaultIssuance,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      quantity: 1000,
      proof: getMerkleProof(allowedWallets, keypair.publicKey.toBase58())
    }));

    await assert.rejects(
      async () => {
        await txBuilder.sendAndConfirm(umi);
      },
      (err) => {
        return (err as Error).message.includes("Mint and redemptions paused");
      },
      "Expected redemption to fail when paused"
    );

    // Try to set the same pause status again, which should fail
    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(toggleActive(umi, { tokenManager, active: false }));
    await assert.rejects(
      async () => {
        await txBuilder.sendAndConfirm(umi);
      },
      (err) => {
        return (err as Error).message.includes("Token manager status unchanged");
      },
      "Expected failure due to no change in token manager status"
    );

    // Try unpause and test if working;
    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(toggleActive(umi, { tokenManager, active: true }));
    await txBuilder.sendAndConfirm(umi);

    tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    assert.equal(tokenManagerAcc.active, true);
  });

  it("should enforce allowList changes", async () => {
    const newAllowedWallets = ["BLDRZQiqt4ESPz12L9mt4XTBjeEfjoBopGPDMA36KtuZ"];

    let tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    const originalMerkleRoot = tokenManagerAcc.merkleRoot;
    const newMerkleRoot = getMerkleRoot(newAllowedWallets);

    // Update the allowList to a new set of wallets
    let txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(updateTokenManagerAdmin(umi, {
      tokenManager,
      newMerkleRoot: some(newMerkleRoot),
      newGateKeepers: null,
      newMintLimitPerSlot: null,
      newRedemptionLimitPerSlot: null,
      admin: null,
    }));
    await txBuilder.sendAndConfirm(umi);

    tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    assert.deepStrictEqual(
      new Uint8Array(tokenManagerAcc.merkleRoot),
      new Uint8Array(newMerkleRoot)
    );

    // Attempt to mint with the original wallet, which is no longer allowed
    txBuilder = new TransactionBuilder();
    let proof = getMerkleProof(allowedWallets, keypair.publicKey.toBase58());
    txBuilder = txBuilder.add(mint(umi, {
      tokenManager,
      mint: baseMint,
      quoteMint: quoteMint,
      payerMintAta: userBase,
      payerQuoteMintAta: userQuote,
      vault: vaultIssuance,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      quantity: 1000,
      proof
    }));

    await assert.rejects(
      async () => {
        await txBuilder.sendAndConfirm(umi);
      },
      (err) => {
        return (err as Error).message.includes("Address not found in allowed list");
      },
      "Expected minting to fail with old wallet not in the new allowList"
    );

    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(redeem(umi, {
      tokenManager,
      mint: baseMint,
      quoteMint: quoteMint,
      payerMintAta: userBase,
      payerQuoteMintAta: userQuote,
      vault: vaultIssuance,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      quantity: 1000,
      proof
    }));

    await assert.rejects(
      async () => {
        await txBuilder.sendAndConfirm(umi);
      },
      (err) => {
        return (err as Error).message.includes("Address not found in allowed list");
      },
      "Expected redemptions to fail with old wallet not in the new allowList"
    );

    // Restore the original allowList
    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(updateTokenManagerAdmin(umi, {
      tokenManager,
      newMerkleRoot: some(originalMerkleRoot),
      newGateKeepers: null,
      newMintLimitPerSlot: null,
      newRedemptionLimitPerSlot: null,
      admin: null
    }));
    await txBuilder.sendAndConfirm(umi);

    tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);

    assert.deepStrictEqual(
      new Uint8Array(tokenManagerAcc.merkleRoot),
      new Uint8Array(originalMerkleRoot)
    );

    // Attempt to mint again with the original wallet
    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(mint(umi, {
      tokenManager,
      mint: baseMint,
      quoteMint: quoteMint,
      payerMintAta: userBase,
      payerQuoteMintAta: userQuote,
      vault: vaultIssuance,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      quantity: 1000,
      proof
    }));

    await assert.doesNotReject(
      async () => {
        await txBuilder.sendAndConfirm(umi);
      },
      "Expected minting to succeed with wallet back in the allowList"
    );

    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(redeem(umi, {
      tokenManager,
      mint: baseMint,
      quoteMint: quoteMint,
      payerMintAta: userBase,
      payerQuoteMintAta: userQuote,
      vault: vaultIssuance,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      quantity: 1000,
      proof
    }));

    await assert.doesNotReject(
      async () => {
        await txBuilder.sendAndConfirm(umi);
      },
      "Expected redemptions to succeed with wallet back in the allowList"
    );
  });

  it("deposit and withdraw funds from the vaultIssuance", async () => {
    let _tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    let _vaultAcc = await safeFetchToken(umi, vaultIssuance);

    // Higher than total collateral amount
    let quantity = Number(_tokenManagerAcc.totalCollateral) + 1; // Amount to deposit
    // console.log("Quantity to Withdraw higher than collateral: ", quantity);
    // console.log("TotalSupply: ", Number(_tokenManagerAcc.totalSupply / BigInt(10 ** baseMintDecimals)));
    // console.log("TotalCollateral: ", Number(_tokenManagerAcc.totalCollateral / BigInt(10 ** quoteMintDecimals)));


    // Process withdraw without one being initialized
    let txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(withdrawFunds(umi, {
      tokenManager,
      quoteMint: quoteMint,
      vault: vaultIssuance,
      authorityQuoteMintAta: userQuote,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      admin: umi.identity
    }));

    await assert.rejects(
      async () => {
        await txBuilder.sendAndConfirm(umi);
      },
      (err) => {
        return (err as Error).message.includes("No pending withdrawal");
      },
      "Expected withdrawal to fail because of no pending withdrawal"
    );

    // Initiate withdraw
    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(initializeWithdrawFunds(umi, {
      tokenManager,
      quantity,
      admin: umi.identity
    }));

    await assert.rejects(
      async () => {
        await txBuilder.sendAndConfirm(umi);
      },
      (err) => {
        return (err as Error).message.includes("Excessive Withdrawal");
      },
      "Expected withdrawal to fail because of excessive withdrawal"
    );

    // Higher than the threshold amount amount
    quantity = (Number(_tokenManagerAcc.totalCollateral) * (1 - emergencyFundBasisPoints / 10000)) + 1; // Amount to deposit
    // console.log("Quantity to Withdraw, higher than threshhold: ", quantity);
    // console.log("TotalSupply: ", Number(_tokenManagerAcc.totalSupply / BigInt(10 ** baseMintDecimals)));
    // console.log("TotalCollateral: ", Number(_tokenManagerAcc.totalCollateral / BigInt(10 ** quoteMintDecimals)));

    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(initializeWithdrawFunds(umi, {
      tokenManager,
      quantity,
      admin: umi.identity
    }));

    await assert.rejects(
      async () => {
        await txBuilder.sendAndConfirm(umi);
      },
      (err) => {
        return (err as Error).message.includes("Excessive Withdrawal");
      },
      "Expected withdrawal to fail because of excessive withdrawal"
    );

    // Withdraw within allowed
    quantity = (Number(_tokenManagerAcc.totalCollateral) * (1 - emergencyFundBasisPoints / 10000)); // Amount to withdraw
    // console.log("Quantity to Withdraw allowed: ", quantity);
    // console.log("TotalSupply: ", Number(_tokenManagerAcc.totalSupply / BigInt(10 ** baseMintDecimals)));
    // console.log("TotalCollateral: ", Number(_tokenManagerAcc.totalCollateral / BigInt(10 ** quoteMintDecimals)));

    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(initializeWithdrawFunds(umi, {
      tokenManager,
      quantity,
      admin: umi.identity
    }));

    await txBuilder.sendAndConfirm(umi)

    let tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    let vaultAcc = await safeFetchToken(umi, vaultIssuance);

    assert.equal(tokenManagerAcc.pendingWithdrawalAmount, quantity, "Pending withdrawal amount should have changed")

    // Fails because of timelock
    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(withdrawFunds(umi, {
      tokenManager,
      quoteMint: quoteMint,
      vault: vaultIssuance,
      authorityQuoteMintAta: userQuote,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      admin: umi.identity
    }));

    await assert.rejects(
      async () => {
        await txBuilder.sendAndConfirm(umi);
      },
      (err) => {
        return (err as Error).message.includes("Withdrawal not ready");
      },
      "Expected withdrawal to fail because of timelock"
    );


    // // Should work after an hour
    // txBuilder = new TransactionBuilder();
    // txBuilder = txBuilder.add(withdrawFunds(umi, {
    //   tokenManager,
    //   quoteMint: quoteMint,
    //   vault: vaultIssuance,
    //   authorityQuoteMintAta: userQuote,
    //   associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
    //   admin: umi.identity
    // }));
    // await txBuilder.sendAndConfirm(umi);

    tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    vaultAcc = await safeFetchToken(umi, vaultIssuance);
    let expectedChange = BigInt(quantity);

    // assert.equal(tokenManagerAcc.totalCollateral, _tokenManagerAcc.totalCollateral - expectedChange, "TokenManager totalCollateral should be equal to the initial totalCollateral minus withdrawed amount");
    // assert.equal(vaultAcc.amount, _vaultAcc.amount - expectedChange, "Vault balance should be equal to the initial vaultIssuance minus withdrawed amount");

    // Deposit excessive
    quantity = Number(((tokenManagerAcc.totalSupply / BigInt(10 ** baseMintDecimals)) * BigInt(exchangeRate) / BigInt(10 ** exchangeRateDecimals)) - (tokenManagerAcc.totalCollateral / BigInt(10 ** quoteMintDecimals))) * 10 ** quoteMintDecimals + 1;
    // console.log("Quantity to Deposit not allowed: ", quantity);
    // console.log("TotalSupply: ", Number(tokenManagerAcc.totalSupply / BigInt(10 ** baseMintDecimals)));
    // console.log("TotalCollateral: ", Number(tokenManagerAcc.totalCollateral / BigInt(10 ** quoteMintDecimals)));

    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(depositFunds(umi, {
      tokenManager,
      quoteMint: quoteMint,
      vault: vaultIssuance,
      authorityQuoteMintAta: userQuote,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      quantity,
      admin: umi.identity
    }));

    await assert.rejects(
      async () => {
        await txBuilder.sendAndConfirm(umi);
      },
      (err) => {
        return (err as Error).message.includes("Excessive Deposit");
      },
      "Expected deposit to fail because of excessive deposit"
    );

    // Deposit allowed
    _tokenManagerAcc = tokenManagerAcc;
    _vaultAcc = vaultAcc;

    quantity = Number(((tokenManagerAcc.totalSupply / BigInt(10 ** baseMintDecimals)) * BigInt(exchangeRate) / BigInt(10 ** exchangeRateDecimals)) - (tokenManagerAcc.totalCollateral / BigInt(10 ** quoteMintDecimals))) * 10 ** quoteMintDecimals;
    // console.log("Quantity deposit allowed: ", quantity);
    // console.log("TotalSupply: ", Number(tokenManagerAcc.totalSupply / BigInt(10 ** baseMintDecimals)));
    // console.log("TotalCollateral: ", Number(tokenManagerAcc.totalCollateral / BigInt(10 ** quoteMintDecimals)));

    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(depositFunds(umi, {
      tokenManager,
      quoteMint: quoteMint,
      vault: vaultIssuance,
      authorityQuoteMintAta: userQuote,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      quantity,
      admin: umi.identity
    }));

    await txBuilder.sendAndConfirm(umi);

    tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    vaultAcc = await safeFetchToken(umi, vaultIssuance);

    expectedChange = BigInt(quantity)
    assert.equal(tokenManagerAcc.totalCollateral, _tokenManagerAcc.totalCollateral + expectedChange, "TokenManager totalCollateral should be equal to the initial totalCollateral plus deposited amount");
    assert.equal(vaultAcc.amount, _vaultAcc.amount + expectedChange, "Vault balance should be equal to the initial vaultIssuance plus deposited amount");
  });

  // Stake Program
  it("baseMint can be staked for xMint", async () => {
    const quantity = 1000 * 10 ** baseMintDecimals;

    let txBuilder = new TransactionBuilder();

    const userXAtaAcc = await safeFetchToken(umi, userX)

    if (!userXAtaAcc) {
      txBuilder = txBuilder.add(createAssociatedToken(umi, {
        mint: xMint,
      }))
    }

    const _stakePoolAcc = await safeFetchPoolManager(umi, poolManager);
    const _vaultAcc = await safeFetchToken(umi, vaultStaking);

    txBuilder = txBuilder.add(stake(umi, {
      poolManager,
      baseMint,
      xMint,
      payerBaseMintAta: userBase,
      payerXMintAta: userX,
      vault: vaultStaking,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      quantity,
    }))

    // console.log("Inception Timestamp:", Number(_stakePoolAcc.inceptionTimestamp));
    // console.log("Current Timestamp:", Math.floor(Date.now() / 1000));
    // console.log("Annual Yield Rate:", Number(_stakePoolAcc.annualYieldRate));
    // console.log("Initial Exchange Rate:", Number(_stakePoolAcc.initialExchangeRate));

    const exchangeRate = calculateExchangeRate(
      Number(_stakePoolAcc.lastYieldChangeTimestamp),
      Math.floor(Date.now() / 1000),
      Number(_stakePoolAcc.annualYieldRate),
      Number(_stakePoolAcc.lastYieldChangeExchangeRate)
    );

    await txBuilder.sendAndConfirm(umi, { send: { skipPreflight: true } });

    const stakePoolAcc = await safeFetchPoolManager(umi, poolManager);

    const vaultAcc = await safeFetchToken(umi, vaultStaking);

    const expectedBaseMintAmount = BigInt(quantity);

    const expectedxMintAmount = BigInt(Math.floor(quantity * exchangeRate / 10 ** baseMintDecimals));
    // console.log("Expected xMint Amount: ", Number(expectedxMintAmount));

    assert.equal(stakePoolAcc.baseBalance, _stakePoolAcc.baseBalance + expectedBaseMintAmount, "Base Balance is not correct");
    assert.equal(vaultAcc.amount, _vaultAcc.amount + expectedBaseMintAmount, "Vault amount is not correct");
    chaiAssert.closeTo(Number(stakePoolAcc.xSupply), Number(_stakePoolAcc.xSupply) + Number(expectedxMintAmount), 300000, "xSupply is not correct");
  })

  it("baseMint can be unstaked by redeeming xMint", async () => {
    // const quantity = 10000 * 10 ** baseMintDecimals;
    let txBuilder = new TransactionBuilder();

    const userBaseAtaAcc = await safeFetchToken(umi, userBase)

    if (!userBaseAtaAcc) {
      txBuilder = txBuilder.add(createAssociatedToken(umi, {
        mint: baseMint,
      }))
    }

    const _stakePoolAcc = await safeFetchPoolManager(umi, poolManager);
    const _vaultAcc = await safeFetchToken(umi, vaultStaking);

    const quantity = Number(_stakePoolAcc.xSupply);
    // console.log("Quantity: ", quantity);

    txBuilder = txBuilder.add(unstake(umi, {
      poolManager,
      baseMint,
      xMint,
      payerBaseMintAta: userBase,
      payerXMintAta: userX,
      vault: vaultStaking,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      quantity,
      tokenManager,
      soldIssuanceProgram: SOLD_ISSUANCE_PROGRAM_ID,
    }))

    // console.log("Inception Timestamp:", Number(_stakePoolAcc.inceptionTimestamp));
    // console.log("Current Timestamp:", Math.floor(Date.now() / 1000));
    // console.log("Annual Yield Rate:", Number(_stakePoolAcc.annualYieldRate));
    // console.log("Initial Exchange Rate:", Number(_stakePoolAcc.initialExchangeRate));

    const exchangeRate = calculateExchangeRate(
      Number(_stakePoolAcc.lastYieldChangeTimestamp),
      Math.floor(Date.now() / 1000),
      Number(_stakePoolAcc.annualYieldRate),
      Number(_stakePoolAcc.lastYieldChangeExchangeRate)
    );
    // console.log("Exchange Rate: ", exchangeRate);

    await txBuilder.sendAndConfirm(umi, { send: { skipPreflight: true } });

    const stakePoolAcc = await safeFetchPoolManager(umi, poolManager);

    const vaultAcc = await safeFetchToken(umi, vaultStaking);

    const expectedBaseMintAmount = BigInt(Math.floor((quantity / exchangeRate) * 10 ** baseMintDecimals));
    // console.log("Expected Base Mint Amount: ", Number(expectedBaseMintAmount));
    // console.log("Base Balance: ", Number(stakePoolAcc.baseBalance));

    const expectedxMintAmount = BigInt(quantity);

    chaiAssert.closeTo(Number(stakePoolAcc.baseBalance), Number(_stakePoolAcc.baseBalance) - Number(expectedBaseMintAmount), 200000, "Base Balance is not correct");
    chaiAssert.closeTo(Number(vaultAcc.amount), Number(_vaultAcc.amount) - Number(expectedBaseMintAmount), 200000, "Vault amount is not correct");
    chaiAssert.equal(stakePoolAcc.xSupply, _stakePoolAcc.xSupply - expectedxMintAmount, "xSupply is not correct");
  })

  it("should update the annual yield rate of the stake pool", async function () {
    const annualYieldRate = 2500;

    let txBuilder = new TransactionBuilder();

    txBuilder = txBuilder.add(updateAnnualYield(umi, {
      poolManager,
      admin: umi.identity,
      annualYieldRate,
      tokenManager,
      soldIssuanceProgram: SOLD_ISSUANCE_PROGRAM_ID,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      vault: vaultStaking,
      baseMint: baseMint,
    }))

    await txBuilder.sendAndConfirm(umi);

    const stakePoolAcc = await safeFetchPoolManager(umi, poolManager);

    assert.equal(stakePoolAcc.annualYieldRate, 2500, "Annual yield rate should be updated to 25.00%");
  });
});
