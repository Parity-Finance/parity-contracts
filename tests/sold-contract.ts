import { keypairIdentity, Pda, PublicKey, publicKey, TransactionBuilder, createAmount, some } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { createAssociatedToken, createSplAssociatedTokenProgram, createSplTokenProgram, findAssociatedTokenPda, safeFetchMint, safeFetchToken, SPL_ASSOCIATED_TOKEN_PROGRAM_ID } from "@metaplex-foundation/mpl-toolbox"
import { Connection, Keypair, PublicKey as Web3JsPublicKey } from "@solana/web3.js";
import { createSoldIssuanceProgram, findTokenManagerPda, initializeTokenManager, SOLD_ISSUANCE_PROGRAM_ID, mint, redeem, safeFetchTokenManager, getMerkleRoot, getMerkleProof, toggleActive, updatePoolManager, depositFunds, withdrawFunds, initializePoolManager, SOLD_STAKING_PROGRAM_ID, calculateExchangeRate, stake, unstake, updateAnnualYield, findPoolManagerPda, updateTokenManagerAdmin, safeFetchPoolManager, initializeWithdrawFunds, initiateUpdatePoolOwner, updatePoolOwner, updateManagerOwner, initiateUpdateManagerOwner, updateXmintMetadata, updateMintMetadata, addGatekeeper, safeFetchGatekeeper, removeGatekeeper, findGatekeeperPda, calculateIntervalRate, mintAdmin, updateTokenManagerOwner } from "../clients/js/src"
import { ASSOCIATED_TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { fromWeb3JsKeypair, fromWeb3JsPublicKey, toWeb3JsKeypair } from "@metaplex-foundation/umi-web3js-adapters";
import { findMetadataPda, safeFetchMetadata } from "@metaplex-foundation/mpl-token-metadata";
import assert from 'assert';
import chai, { assert as chaiAssert } from 'chai';
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { calculateMaxWithdrawableAmount } from "../clients/js/src/utils/maxWithdrawable";

describe.only("sold-issuance", () => {
  let umi = createUmi("http://localhost:8899");
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
  const baseMintDecimals = 6;
  const quoteMintDecimals = 6;
  const emergencyFundBasisPoints = 1200; // 12% have to stay in the vaultIssuance
  const exchangeRate = 1 * 10 ** quoteMintDecimals; // Exchange rate is exactly how many quoteMint you will get for 1 baseMint. That's why quote mint decimals have to be considered
  const exchangeRateDecimals = quoteMintDecimals
  const intervalAprRate = 1000166517567; // 1,2 ^ (1 / 1095) for 20% annual APY ^ 1 / auto-compounding intervals per year (8 hourly compounding)
  const secondsPerInterval = 8 * 60 * 60; // 8 hours

  const limitPerSlot = 100000 * 10 ** baseMintDecimals;

  const withdrawExecutionWindow = 3600;
  const withdrawTimeLock = 0;

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
  const initialExchangeRate = 1 * 10 ** stakeExchangeRateDecimals;
  const allowedWallets = [keypair.publicKey.toBase58()]

  before(async () => {
    try {
      await umi.rpc.airdrop(umi.identity.publicKey, createAmount(100_000 * 10 ** 9, "SOL", 9), { commitment: "finalized" })

      const quoteMintWeb3js = await createMint(
        connection,
        keypair,
        keypair.publicKey,
        keypair.publicKey,
        quoteMintDecimals // Decimals
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
      quoteMint = fromWeb3JsPublicKey(quoteMintWeb3js)

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
      limitPerSlot,
      withdrawExecutionWindow,
      withdrawTimeLock,
      mintFeeBps: 50,
      redeemFeeBps: 50
    }))

    await txBuilder.sendAndConfirm(umi);

    const tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    const baseMintAcc = await safeFetchMint(umi, baseMint);

    const expectedMerkleRoot = merkleRoot.length === 0 ?
      new Array(32).fill(0) :
      Array.from(merkleRoot);

    assert.deepStrictEqual(
      tokenManagerAcc.merkleRoot,
      Uint8Array.from(expectedMerkleRoot),
      "Merkle root in token manager account should match expected merkle root"
    );
    assert.equal(tokenManagerAcc.mint, baseMint[0], "Token manager's mint should match the base mint");
    assert.equal(tokenManagerAcc.mintDecimals, baseMintDecimals, "Token manager's mint decimals should match base mint decimals");
    assert.equal(tokenManagerAcc.quoteMint, quoteMint, "Token manager's quote mint should match the provided quote mint");
    assert.equal(tokenManagerAcc.quoteMintDecimals, quoteMintDecimals, "Token manager's quote mint decimals should match the provided quote mint decimals");
    assert.equal(tokenManagerAcc.exchangeRate, BigInt(exchangeRate), "Token manager's exchange rate should match the provided exchange rate");
    assert.equal(tokenManagerAcc.emergencyFundBasisPoints, emergencyFundBasisPoints, "Token manager's emergency fund basis points should match the provided value");
    assert.equal(tokenManagerAcc.active, true, "Token manager should be active");
    assert.equal(baseMintAcc.supply, 0, "Token manager's total supply should be zero");
    assert.equal(tokenManagerAcc.totalCollateral, 0, "Token manager's total collateral should be zero");
    assert.equal(tokenManagerAcc.mintFeeBps, 50,"Token manager's mint fee should be 50");
    assert.equal(tokenManagerAcc.redeemFeeBps, 50,"Token manager's redeem fee should be 50");
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
      secondsPerInterval,
      intervalAprRate,
      owner: umi.identity,
      admin: umi.identity.publicKey,
    }))

    await txBuilder.sendAndConfirm(umi, { send: { skipPreflight: true } });

    const stakePoolAcc = await safeFetchPoolManager(umi, poolManager);
    const xMintAcc = await safeFetchMint(umi, xMint);

    assert.equal(stakePoolAcc.baseMint, baseMint[0]);
    assert.equal(stakePoolAcc.baseMintDecimals, baseMintDecimals);
    assert.equal(stakePoolAcc.xMint, xMint);
    assert.equal(stakePoolAcc.xMintDecimals, xMintDecimals);
    assert.equal(stakePoolAcc.initialExchangeRate, BigInt(initialExchangeRate));
    assert.equal(stakePoolAcc.baseBalance, 0n);
    assert.equal(xMintAcc.supply, 0n);
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
    const _baseMintAcc = await safeFetchMint(umi, baseMint);


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

    const res = await txBuilder.sendAndConfirm(umi, { send: { skipPreflight: false } });
    // console.log(bs58.encode(res.signature));

    const tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    const vaultAcc = await safeFetchToken(umi, vaultIssuance);
    const baseMintAcc = await safeFetchMint(umi, baseMint);

    //const mintFeeBps = _tokenManagerAcc.mintFeeBps;
    const mintFeeBps = tokenManagerAcc.mintFeeBps;
    const feeAmount = (BigInt(quantity) * BigInt(mintFeeBps)) / BigInt(10000);
    const expectedMintAmount = BigInt(quantity) - feeAmount;
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

    assert.equal(baseMintAcc.supply, _baseMintAcc.supply + expectedMintAmount, "Total supply should be correct");
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
    const _baseMintAcc = await safeFetchMint(umi, baseMint);

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

    const res = await txBuilder.sendAndConfirm(umi, { send: { skipPreflight: false } });
    // console.log(bs58.encode(res.signature));

    const tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    const vaultAcc = await safeFetchToken(umi, vaultIssuance);
    const baseMintAcc = await safeFetchMint(umi, baseMint);

    const expectedQuoteAmount = (BigInt(quantity) / BigInt(10 ** baseMintDecimals) * BigInt(exchangeRate) / BigInt(10 ** exchangeRateDecimals)) * BigInt(10 ** quoteMintDecimals);
    const redeemFeeBps = tokenManagerAcc.redeemFeeBps;
    const feeAmount = (BigInt(quantity) * BigInt(redeemFeeBps)) / BigInt(10000);
    const expectedQuoteAmountAfterFees = expectedQuoteAmount - feeAmount;

    assert.equal(baseMintAcc.supply, _baseMintAcc.supply - BigInt(quantity), "Total supply should be correct");
    assert.equal(tokenManagerAcc.totalCollateral, _tokenManagerAcc.totalCollateral - expectedQuoteAmountAfterFees, "Total collateral should be correct");
    assert.equal(vaultAcc.amount, _vaultAcc.amount - expectedQuoteAmountAfterFees, "Vault amount should be correct");
  });

  it("should add and remove a gatekeeper and check unpause permissions", async () => {
    const newGatekeeper = umi.eddsa.generateKeypair();

    await umi.rpc.airdrop(newGatekeeper.publicKey, createAmount(100_000 * 10 ** 9, "SOL", 9), { commitment: "finalized" })

    const gatekeeper = findGatekeeperPda(umi, { wallet: newGatekeeper.publicKey });

    // Add the new gatekeeper
    let txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(addGatekeeper(umi, {
      tokenManager,
      newGatekeeper: newGatekeeper.publicKey,
      admin: umi.identity,
      gatekeeper
    }));
    await txBuilder.sendAndConfirm(umi);

    // Verify the gatekeeper was added
    let gatekeeperAcc = await safeFetchGatekeeper(umi, gatekeeper);
    assert.equal(gatekeeperAcc.wallet, newGatekeeper.publicKey, "Gatekeeper should be added");

    // Pause the token manager with new gatekeeper
    umi = umi.use(keypairIdentity(newGatekeeper));
    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(toggleActive(umi, { tokenManager, gatekeeper, active: false }));
    await txBuilder.sendAndConfirm(umi);

    let tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    assert.strictEqual(tokenManagerAcc.active, false);

    // Attempt to unpause the token manager as the new gatekeeper
    umi.use(keypairIdentity(fromWeb3JsKeypair(keypair))); // Switch back to admin
    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(toggleActive(umi, { tokenManager, active: true }));
    await txBuilder.sendAndConfirm(umi);

    tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    assert.strictEqual(tokenManagerAcc.active, true, "Token manager should be unpaused by gatekeeper");

    // Remove the gatekeeper
    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(removeGatekeeper(umi, {
      tokenManager,
      gatekeeper,
      admin: umi.identity,
    }));
    await txBuilder.sendAndConfirm(umi);

    // Verify the gatekeeper was removed
    const gatekeeperAccAfterRemoval = await safeFetchGatekeeper(umi, gatekeeper);
    assert.strictEqual(gatekeeperAccAfterRemoval, null, "Expected gatekeeper account to be null");

    // Attempt to unpause the token manager as the removed gatekeeper
    umi = umi.use(keypairIdentity(newGatekeeper));
    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(toggleActive(umi, { tokenManager, active: false }));
    await assert.rejects(
      async () => {
        await txBuilder.sendAndConfirm(umi);
      },
      (err) => {
        return (err as Error).message.includes("InvalidToggleActiveAuthority");
      },
      "Expected unpause to fail as the gatekeeper was removed"
    );
  });

  it("should prevent minting when paused", async () => {
    // Pause the token manager
    umi = umi.use(keypairIdentity(fromWeb3JsKeypair(keypair))); // Switch back to admin

    let txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(toggleActive(umi, { tokenManager, authority: umi.identity, active: false }));
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
      newLimitPerSlot: null,
      admin: umi.identity
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
      admin: umi.identity,
      // Params
      newMerkleRoot: some(originalMerkleRoot),
      newLimitPerSlot: null,
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
    let _baseMintAcc = await safeFetchMint(umi, baseMint);

    // Higher than total collateral amount
    let quantity = Number(_tokenManagerAcc.totalCollateral) + 1; // Amount to deposit
    // console.log("Quantity to Withdraw higher than collateral: ", quantity);
    // console.log("TotalSupply: ", Number(_tokenManagerAcc.totalSupply / BigInt(10 ** baseMintDecimals)));
    // console.log("TotalCollateral: ", Number(_tokenManagerAcc.totalCollateral / BigInt(10 ** quoteMintDecimals)));


    // Process withdraw without one being initialized
    let txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(withdrawFunds(umi, {
      tokenManager,
      mint: baseMint,
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
      mint: baseMint,
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
      "Expected withdrawal to fail because of excessive withdrawal - Higher than total collateral amount"
    );

    // Higher than the threshold amount amount
    // Calculate the maximum withdrawable amount based on mint supply
    const maxWithdrawableAmount = calculateMaxWithdrawableAmount(
      BigInt(_baseMintAcc.supply),
      BigInt(_tokenManagerAcc.exchangeRate),
      _tokenManagerAcc.mintDecimals,
      _tokenManagerAcc.quoteMintDecimals,
      _tokenManagerAcc.emergencyFundBasisPoints,
      BigInt(_tokenManagerAcc.totalCollateral)
    );

    // Higher than the threshold amount amount
    quantity = Number(maxWithdrawableAmount) + 1; // Amount to deposit
    // console.log("Quantity to Withdraw, higher than threshold: ", quantity);
    // console.log("TotalCollateral: ", Number(_tokenManagerAcc.totalCollateral / BigInt(10 ** quoteMintDecimals)));
    // console.log("Mint supply: ", Number(_baseMintAcc.supply / BigInt(10 ** baseMintDecimals)));


    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(initializeWithdrawFunds(umi, {
      tokenManager,
      quantity,
      mint: baseMint,
      admin: umi.identity
    }));

    await assert.rejects(
      async () => {
        await txBuilder.sendAndConfirm(umi);
      },
      (err) => {
        return (err as Error).message.includes("Excessive Withdrawal");
      },
      "Expected withdrawal to fail because of excessive withdrawal - Higher than threshold amount"
    );

    // Withdraw within allowed
    quantity = Number(maxWithdrawableAmount); // Amount to deposit
    // console.log("Quantity to Withdraw allowed: ", quantity);
    // console.log("TotalSupply: ", Number(_baseMintAcc.supply / BigInt(10 ** baseMintDecimals)));
    // console.log("TotalCollateral: ", Number(_tokenManagerAcc.totalCollateral / BigInt(10 ** quoteMintDecimals)));

    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(initializeWithdrawFunds(umi, {
      tokenManager,
      quantity,
      mint: baseMint,
      admin: umi.identity
    }));

    await txBuilder.sendAndConfirm(umi)

    let tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    let vaultAcc = await safeFetchToken(umi, vaultIssuance);
    let baseMintAcc = await safeFetchMint(umi, baseMint);

    assert.equal(tokenManagerAcc.pendingWithdrawalAmount, quantity, "Pending withdrawal amount should have changed")

    // Fails because of timelock
    // txBuilder = new TransactionBuilder();
    // txBuilder = txBuilder.add(withdrawFunds(umi, {
    //   tokenManager,
    //   mint: baseMint,
    //   quoteMint: quoteMint,
    //   vault: vaultIssuance,
    //   authorityQuoteMintAta: userQuote,
    //   associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
    //   admin: umi.identity
    // }));

    // await assert.rejects(
    //   async () => {
    //     await txBuilder.sendAndConfirm(umi);
    //   },
    //   (err) => {
    //     return (err as Error).message.includes("Withdrawal not ready");
    //   },
    //   "Expected withdrawal to fail because of timelock"
    // );

    // Should work after an hour or specified time
    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(withdrawFunds(umi, {
      tokenManager,
      mint: baseMint,
      quoteMint: quoteMint,
      vault: vaultIssuance,
      authorityQuoteMintAta: userQuote,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      admin: umi.identity
    }));
    await txBuilder.sendAndConfirm(umi);

    tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    vaultAcc = await safeFetchToken(umi, vaultIssuance);
    baseMintAcc = await safeFetchMint(umi, baseMint);
    let expectedChange = BigInt(quantity);

    // assert.equal(tokenManagerAcc.totalCollateral, _tokenManagerAcc.totalCollateral - expectedChange, "TokenManager totalCollateral should be equal to the initial totalCollateral minus withdrawed amount");
    // assert.equal(vaultAcc.amount, _vaultAcc.amount - expectedChange, "Vault balance should be equal to the initial vaultIssuance minus withdrawed amount");

    // Deposit excessive
    quantity = Number(((baseMintAcc.supply / BigInt(10 ** baseMintDecimals)) * BigInt(exchangeRate) / BigInt(10 ** exchangeRateDecimals)) - (tokenManagerAcc.totalCollateral / BigInt(10 ** quoteMintDecimals))) * 10 ** quoteMintDecimals + 1;
    if (quantity < 0) {
      quantity = 1;
    } else {
      quantity += 1;
    }
    // console.log("Quantity to Deposit not allowed: ", quantity);
    // console.log("TotalSupply: ", Number(baseMintAcc.supply / BigInt(10 ** baseMintDecimals)));
    // console.log("TotalCollateral: ", Number(tokenManagerAcc.totalCollateral / BigInt(10 ** quoteMintDecimals)));

    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(depositFunds(umi, {
      tokenManager,
      mint: baseMint,
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
    _baseMintAcc = baseMintAcc;

    quantity = Number(((baseMintAcc.supply / BigInt(10 ** baseMintDecimals)) * BigInt(exchangeRate) / BigInt(10 ** exchangeRateDecimals)) - (tokenManagerAcc.totalCollateral / BigInt(10 ** quoteMintDecimals))) * 10 ** quoteMintDecimals;

    const maxCollateral = Number(((baseMintAcc.supply / BigInt(10 ** baseMintDecimals)) * BigInt(exchangeRate)));
    quantity = maxCollateral - Number(_tokenManagerAcc.totalCollateral);
    // console.log("Max Collateral: ", maxCollateral);
    // console.log("TotalSupply: ", Number(_baseMintAcc.supply));
    // console.log("TotalCollateral: ", Number(_tokenManagerAcc.totalCollateral));
    // console.log("Quantity deposit allowed: ", quantity);

    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(depositFunds(umi, {
      tokenManager,
      mint: baseMint,
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
  it.only("baseMint can be staked for xMint", async () => {
    const quantity = 1000 * 10 ** baseMintDecimals;

    let txBuilder = new TransactionBuilder();

    const userXAtaAcc = await safeFetchToken(umi, userX)

    if (!userXAtaAcc) {
      txBuilder = txBuilder.add(createAssociatedToken(umi, {
        mint: xMint,
      }))
    }

    const _stakePoolAcc = await safeFetchPoolManager(umi, poolManager);
    const _xMintAcc = await safeFetchMint(umi, xMint);
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
      Number(_stakePoolAcc.intervalAprRate),
      Number(_stakePoolAcc.lastYieldChangeExchangeRate),
      Number(_stakePoolAcc.secondsPerInterval)
    );
    // console.log("Exchange Rate: ", exchangeRate);

    await txBuilder.sendAndConfirm(umi, { send: { skipPreflight: true } });

    const stakePoolAcc = await safeFetchPoolManager(umi, poolManager);
    const xMintAcc = await safeFetchMint(umi, xMint);
    const vaultAcc = await safeFetchToken(umi, vaultStaking);

    const expectedBaseMintAmount = BigInt(quantity);

    const expectedxMintAmount = BigInt(Math.floor(quantity / exchangeRate * 10 ** baseMintDecimals));
    // console.log("Expected xMint Amount: ", Number(expectedxMintAmount));
    // console.log("xMint Supply start: ", Number(_xMintAcc.supply));
    // console.log("xMint Supply end: ", Number(xMintAcc.supply));

    assert.equal(stakePoolAcc.baseBalance, _stakePoolAcc.baseBalance + expectedBaseMintAmount, "Base Balance is not correct");
    assert.equal(vaultAcc.amount, _vaultAcc.amount + expectedBaseMintAmount, "Vault amount is not correct");
    chaiAssert.closeTo(Number(xMintAcc.supply), Number(_xMintAcc.supply) + Number(expectedxMintAmount), 300000, "xSupply is not correct");
  })

  it.only("baseMint can be unstaked by redeeming xMint", async () => {
    // const quantity = 10000 * 10 ** baseMintDecimals;
    let txBuilder = new TransactionBuilder();

    const userBaseAtaAcc = await safeFetchToken(umi, userBase)

    if (!userBaseAtaAcc) {
      txBuilder = txBuilder.add(createAssociatedToken(umi, {
        mint: baseMint,
      }))
    }

    const _stakePoolAcc = await safeFetchPoolManager(umi, poolManager);
    const _xMintAcc = await safeFetchMint(umi, xMint);
    const _vaultAcc = await safeFetchToken(umi, vaultStaking);

    const quantity = Number(_xMintAcc.supply);
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
      Number(_stakePoolAcc.intervalAprRate),
      Number(_stakePoolAcc.lastYieldChangeExchangeRate),
      Number(_stakePoolAcc.secondsPerInterval)
    );
    // console.log("Exchange Rate: ", exchangeRate);

    await txBuilder.sendAndConfirm(umi, { send: { skipPreflight: true } });

    const stakePoolAcc = await safeFetchPoolManager(umi, poolManager);
    const xMintAcc = await safeFetchMint(umi, xMint);
    const vaultAcc = await safeFetchToken(umi, vaultStaking);

    const expectedBaseMintAmount = BigInt(Math.floor((quantity * exchangeRate) / 10 ** baseMintDecimals));
    // console.log("Expected Base Mint Amount: ", Number(expectedBaseMintAmount));
    // console.log("Base Balance Start: ", Number(_stakePoolAcc.baseBalance));
    // console.log("Base Balance end: ", Number(stakePoolAcc.baseBalance));

    const expectedxMintAmount = BigInt(quantity);

    chaiAssert.equal(Number(stakePoolAcc.baseBalance), 0, "Base Balance is not correct");
    chaiAssert.equal(Number(vaultAcc.amount), 0, "Vault amount is not correct");
    chaiAssert.equal(xMintAcc.supply, _xMintAcc.supply - expectedxMintAmount, "xSupply is not correct");
  })

  it("should update the annual yield rate of the stake pool", async function () {
    const annualYieldRate = 2500; // in Basis points
    const intervalSeconds = 60 * 60 * 8 // 8 hour interval

    const intervalRate = calculateIntervalRate(annualYieldRate, intervalSeconds);
    // console.log("Interval Rate: ", Number(intervalRate));

    let txBuilder = new TransactionBuilder();

    txBuilder = txBuilder.add(updateAnnualYield(umi, {
      poolManager,
      admin: umi.identity,
      intervalAprRate: intervalRate,
      tokenManager,
      xMint,
      soldIssuanceProgram: SOLD_ISSUANCE_PROGRAM_ID,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      vault: vaultStaking,
      baseMint: baseMint,
    }))

    await txBuilder.sendAndConfirm(umi);

    const stakePoolAcc = await safeFetchPoolManager(umi, poolManager);

    assert.equal(stakePoolAcc.intervalAprRate, intervalRate, "Annual yield rate should be updated to 25.00%");
  });

  it("should initiate and accept pool owner update", async () => {
    const newAdmin = umi.eddsa.generateKeypair();

    await umi.rpc.airdrop(newAdmin.publicKey, createAmount(100_000 * 10 ** 9, "SOL", 9), {
      commitment: "finalized",
    });

    // Initiate update of pool owner
    let txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(initiateUpdatePoolOwner(umi, {
      poolManager,
      newOwner: newAdmin.publicKey,
      owner: umi.identity
    }));
    await txBuilder.sendAndConfirm(umi);

    // Check if the update initiation was successful
    let poolManagerAcc = await safeFetchPoolManager(umi, poolManager);
    assert.equal(poolManagerAcc.pendingOwner, newAdmin.publicKey, "Pending owner should be set to new admin");

    // Accept update of pool owner
    umi.use(keypairIdentity(newAdmin)); // Switch to new admin
    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(updatePoolOwner(umi, {
      poolManager,
      newOwner: umi.identity
    }));
    await txBuilder.sendAndConfirm(umi);

    // Verify the new admin is set
    poolManagerAcc = await safeFetchPoolManager(umi, poolManager);

    assert.equal(poolManagerAcc.owner, newAdmin.publicKey, "owner should be updated to new owner");
    assert.equal(poolManagerAcc.pendingOwner, publicKey("11111111111111111111111111111111"), "Pending owner should be set to default pubkey");

    // Change back
    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(initiateUpdatePoolOwner(umi, {
      poolManager,
      newOwner: fromWeb3JsKeypair(keypair).publicKey,
      owner: umi.identity
    }));
    await txBuilder.sendAndConfirm(umi);


    // Accept update back to original admin
    umi.use(keypairIdentity(fromWeb3JsKeypair(keypair))); // Switch to new admin

    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(updatePoolOwner(umi, {
      poolManager,
      newOwner: umi.identity
    }));
    await txBuilder.sendAndConfirm(umi);

    // Verify the admin is set back to original
    poolManagerAcc = await safeFetchPoolManager(umi, poolManager);
    assert.equal(poolManagerAcc.admin, keypair.publicKey.toBase58(), "Admin should be reverted back to original admin");
  });

  it("should initiate and accept manager owner update", async () => {
    const newAdmin = umi.eddsa.generateKeypair();

    await umi.rpc.airdrop(newAdmin.publicKey, createAmount(100_000 * 10 ** 9, "SOL", 9), {
      commitment: "finalized",
    });
    umi.use(keypairIdentity(fromWeb3JsKeypair(keypair))); // Switch to new admin

    // Initiate update of tokenManager owner
    let txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(initiateUpdateManagerOwner(umi, {
      tokenManager,
      newOwner: newAdmin.publicKey,
      owner: umi.identity
    }));
    await txBuilder.sendAndConfirm(umi);

    // Check if the update initiation was successful
    let tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);

    assert.equal(tokenManagerAcc.pendingOwner, newAdmin.publicKey, "Pending owner should be set to new admin");

    // Accept update of manager owner
    umi.use(keypairIdentity(newAdmin)); // Switch to new admin
    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(updateManagerOwner(umi, {
      tokenManager,
      newOwner: umi.identity
    }));
    await txBuilder.sendAndConfirm(umi);

    // Verify the new admin is set
    tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    assert.equal(tokenManagerAcc.owner, newAdmin.publicKey, "owner should be updated to new owner");
    assert.equal(tokenManagerAcc.pendingOwner, publicKey("11111111111111111111111111111111"), "Pending owner should be set to default pubkey");

    // Change back
    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(initiateUpdateManagerOwner(umi, {
      tokenManager,
      newOwner: fromWeb3JsKeypair(keypair).publicKey,
      owner: umi.identity
    }));
    await txBuilder.sendAndConfirm(umi);

    // Accept update back to original admin
    umi.use(keypairIdentity(fromWeb3JsKeypair(keypair))); // Switch back to original admin
    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(updateManagerOwner(umi, {
      tokenManager,
      newOwner: umi.identity
    }));
    await txBuilder.sendAndConfirm(umi);

    // Verify the admin is set back to original
    tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    assert.equal(tokenManagerAcc.admin, publicKey(keypair.publicKey), "Admin should be reverted back to original admin");
  });

  it("should accept pool manager update", async () => {
    const newOwner = umi.eddsa.generateKeypair();
    const newAdmin = umi.eddsa.generateKeypair();

    await umi.rpc.airdrop(newAdmin.publicKey, createAmount(100_000 * 10 ** 9, "SOL", 9), {
      commitment: "finalized",
    });

    await umi.rpc.airdrop(newOwner.publicKey, createAmount(100_000 * 10 ** 9, "SOL", 9), {
      commitment: "finalized",
    });


    //Attempt trying to change pool manager with the wrong previous owner

    umi.use(keypairIdentity(newOwner));
    
    let txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(updatePoolManager(umi, {
      poolManager,
      owner: umi.identity,
      newOwner: newOwner.publicKey,
      newAdmin: newAdmin.publicKey,
    }));

   await assert.rejects(
      async () => {
        await txBuilder.sendAndConfirm(umi);
      },
      (err) => {
        return (err as Error).message.includes("Invalid owner");
      },
      "Expected updating pool manager to fail because of Invalid owner"
    );

    //Attempt trying to change pool manager with the right owner
    
    umi.use(keypairIdentity(fromWeb3JsKeypair(keypair)));

     txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(updatePoolManager(umi, {
      poolManager,
      owner: umi.identity,
      newOwner: newOwner.publicKey,
      newAdmin: newAdmin.publicKey,
    }));

    await txBuilder.sendAndConfirm(umi);

     // Verify the new admin and owner is set
    let poolManagerAcc = await safeFetchPoolManager(umi, poolManager);

    assert.equal(poolManagerAcc.admin, newAdmin.publicKey, "admin should be updated to new admin");
    assert.equal(poolManagerAcc.owner, newOwner.publicKey, "owner should be updated to new owner");


    //Change the owner and admin back

    umi.use(keypairIdentity(newOwner))

    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(updatePoolManager(umi, {
      poolManager,
      owner: umi.identity,
      newOwner: keypair.publicKey,
      newAdmin: keypair.publicKey,
    }));

    await txBuilder.sendAndConfirm(umi);

    // Verify the owner and admin is set back to original
     poolManagerAcc = await safeFetchPoolManager(umi, poolManager);

    assert.equal(poolManagerAcc.admin, keypair.publicKey, "admin should be updated to new admin");
    assert.equal(poolManagerAcc.owner, keypair.publicKey, "owner should be updated to new owner");
    umi.use(keypairIdentity(fromWeb3JsKeypair(keypair)));

  })

  it("should update xMint metadata of stake program", async () => {
    const name = "TEST";
    const symbol = "TEST"
    const uri = "https://example.com/new-xmint-info.json"

    let txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(updateXmintMetadata(umi, {
      poolManager,
      metadataAccount: xMetadata,
      name,
      symbol,
      uri,
      owner: umi.identity
    }));

    await txBuilder.sendAndConfirm(umi);

    const xMintMetadata = await safeFetchMetadata(umi, xMetadata);
    assert.equal(xMintMetadata.name, name, "Name should be updated");
    assert.equal(xMintMetadata.symbol, symbol, "Symbol should be updated");
    assert.equal(xMintMetadata.uri, uri, "Uri should be updated");
  });

  it("should update base mint metadata of issuance program", async () => {
    const name = "TEST";
    const symbol = "TEST"
    const uri = "https://example.com/new-xmint-info.json"

    let txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(updateMintMetadata(umi, {
      tokenManager,
      metadataAccount: baseMetadata,
      name,
      symbol,
      uri,
      owner: umi.identity
    }));

    await txBuilder.sendAndConfirm(umi);

    const mintMetadata = await safeFetchMetadata(umi, baseMetadata);
    assert.equal(mintMetadata.name, name, "Name should be updated");
    assert.equal(mintMetadata.symbol, symbol, "Symbol should be updated");
    assert.equal(mintMetadata.uri, uri, "Uri should be updated");
  });

  it("should mint tokens to admin and update token  minter", async () => {
    const quantity = 10000 * 10 ** baseMintDecimals;
  

    // Attempt to mint tokens with the wrong minter 
   let txBuilder = new TransactionBuilder();

   const userBaseAtaAcc = await safeFetchToken(umi, userBase)

   if (!userBaseAtaAcc) {
     txBuilder = txBuilder.add(createAssociatedToken(umi, {
       mint: baseMint,
     }))
   }


     txBuilder = new TransactionBuilder().add(mintAdmin(umi, {
     tokenManager,
      mint: baseMint,
      minterMintAta: userBase,
      minter: umi.identity,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      quantity: quantity, 
    }));

        await assert.rejects(
          async () => {
            await txBuilder.sendAndConfirm(umi);
          },
          (err) => {
            return (err as Error).message.includes("Invalid minter");
          },
          "Expected minting to fail cause wrong minter was passed"
        );
      

        // Change the token manager minter
         txBuilder = new TransactionBuilder().add(updateTokenManagerOwner(umi, {
          tokenManager,
          owner: umi.identity,
          newAdmin: null,
          newMinter: some(umi.identity.publicKey),
          emergencyFundBasisPoints: null,
          newWithdrawTimeLock: null,
          newWithdrawExecutionWindow: null,
          newMintFeeBps: null,
          newRedeemFeeBps: null,
        }));
    
        await txBuilder.sendAndConfirm(umi);

        const tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);

        assert.deepStrictEqual(
          tokenManagerAcc.minter,
          umi.identity.publicKey,
          "Token manager's minter should be updated"
        );


        //Now try minting with the newMinter

          const _baseMintAcc = await safeFetchMint(umi, baseMint);

          txBuilder = new TransactionBuilder().add(mintAdmin(umi, {
            tokenManager,
             mint: baseMint,
             minterMintAta: userBase,
             minter: umi.identity,
             associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
             quantity: quantity, 
           }));

           await txBuilder.sendAndConfirm(umi);

          const baseMintAcc = await safeFetchMint(umi, baseMint);
          const expectedMintAmount = BigInt(quantity);

          assert.deepStrictEqual(baseMintAcc.supply, _baseMintAcc.supply + expectedMintAmount, "Total supply should be correct");

  })

    it("should update the mint and redeem fee with an higher amount", async () => {
    
          let txBuilder = new TransactionBuilder().add(updateTokenManagerOwner(umi, {
              tokenManager,
              owner: umi.identity,
              newAdmin: null,
              newMinter: null,
              emergencyFundBasisPoints: null,
              newWithdrawTimeLock: null,
              newWithdrawExecutionWindow: null,
              newMintFeeBps: 80,
              newRedeemFeeBps: 80,
            }));
        
            let res = await txBuilder.sendAndConfirm(umi, { send: { skipPreflight: false } });

    
            let tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    
            assert.deepStrictEqual(tokenManagerAcc.mintFeeBps, 80,"Token manager's mint fee should be 80");
            assert.deepStrictEqual(tokenManagerAcc.redeemFeeBps, 80,"Token manager's redeem fee should be 80");

            //Test the  minting with the new fees set

              let quantity = 10000 * 10 ** baseMintDecimals;
              const proof = getMerkleProof(allowedWallets, keypair.publicKey.toBase58());

              const userBaseAtaAcc = await safeFetchToken(umi, userBase)

              txBuilder = new TransactionBuilder();

              if (!userBaseAtaAcc) {
                      txBuilder = txBuilder.add(createAssociatedToken(umi, {
                       mint: baseMint,
                    }))
                }

            let _tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
            let _vaultAcc = await safeFetchToken(umi, vaultIssuance);
            let _baseMintAcc = await safeFetchMint(umi, baseMint);

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

               res = await txBuilder.sendAndConfirm(umi, { send: { skipPreflight: false } });

             tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
             let vaultAcc = await safeFetchToken(umi, vaultIssuance);
             let baseMintAcc = await safeFetchMint(umi, baseMint);
         
             //const mintFeeBps = _tokenManagerAcc.mintFeeBps;
             const mintFeeBps = tokenManagerAcc.mintFeeBps;
             let feeAmount = (BigInt(quantity) * BigInt(mintFeeBps)) / BigInt(10000);
             const expectedMintAmount = BigInt(quantity) - feeAmount;
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
             let expectedQuoteAmount = adjustedQuantity * BigInt(exchangeRate) / BigInt(10 ** exchangeRateDecimals);
         
             assert.equal(baseMintAcc.supply, _baseMintAcc.supply + expectedMintAmount, "Total supply should be correct");
             assert.equal(tokenManagerAcc.totalCollateral, _tokenManagerAcc.totalCollateral + expectedQuoteAmount, "Total collateral should be correct");
             assert.equal(vaultAcc.amount, _vaultAcc.amount + expectedQuoteAmount, "Vault amount should be correct");
 
           //Test the  redeeming with the new fees set

           //new quantity to be redeemed
            quantity = 1000 * 10 ** baseMintDecimals;

             const userQuoteAtaAcc = await safeFetchToken(umi, userQuote)

             txBuilder = new TransactionBuilder();

             if (!userQuoteAtaAcc) {
               txBuilder = txBuilder.add(createAssociatedToken(umi, {
               mint: userQuote,
               }))
              }

     _tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
     _vaultAcc = await safeFetchToken(umi, vaultIssuance);
     _baseMintAcc = await safeFetchMint(umi, baseMint);

    txBuilder = txBuilder.add(redeem(umi, {
      tokenManager,
      mint: baseMint,
      quoteMint: quoteMint,
      payerMintAta: userBase,
      payerQuoteMintAta: userQuote,
      vault: vaultIssuance,
      payer: umi.identity,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      quantity,
      proof
    }))

     res = await txBuilder.sendAndConfirm(umi, { send: { skipPreflight: false } });

     tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
     vaultAcc = await safeFetchToken(umi, vaultIssuance);
     baseMintAcc = await safeFetchMint(umi, baseMint);

    expectedQuoteAmount = (BigInt(quantity) / BigInt(10 ** baseMintDecimals) * BigInt(exchangeRate) / BigInt(10 ** exchangeRateDecimals)) * BigInt(10 ** quoteMintDecimals);
    const redeemFeeBps = tokenManagerAcc.redeemFeeBps;
     feeAmount = (BigInt(quantity) * BigInt(redeemFeeBps)) / BigInt(10000);
    const expectedQuoteAmountAfterFees = expectedQuoteAmount - feeAmount;

    assert.equal(baseMintAcc.supply, _baseMintAcc.supply - BigInt(quantity), "Total supply should be correct");
    assert.equal(tokenManagerAcc.totalCollateral, _tokenManagerAcc.totalCollateral - expectedQuoteAmountAfterFees, "Total collateral should be correct");
    assert.equal(vaultAcc.amount, _vaultAcc.amount - expectedQuoteAmountAfterFees, "Vault amount should be correct");
 
        })


        it("should update the mint and redeem fee with zero ", async () => {
    
          //set mint fee and redeem fee of zero
          let txBuilder = new TransactionBuilder().add(updateTokenManagerOwner(umi, {
              tokenManager,
              owner: umi.identity,
              newAdmin: null,
              newMinter: null,
              emergencyFundBasisPoints: null,
              newWithdrawTimeLock: null,
              newWithdrawExecutionWindow: null,
              newMintFeeBps: 0,
              newRedeemFeeBps: 0,
            }));
        
            let res = await txBuilder.sendAndConfirm(umi, { send: { skipPreflight: false } });

    
            let tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    
            assert.deepStrictEqual(tokenManagerAcc.mintFeeBps, 0,"Token manager's mint fee should be 0");
            assert.deepStrictEqual(tokenManagerAcc.redeemFeeBps, 0,"Token manager's redeem fee should be 0");

            //Test the  minting with the new fees set

              let quantity = 10000 * 10 ** baseMintDecimals;
              const proof = getMerkleProof(allowedWallets, keypair.publicKey.toBase58());

              const userBaseAtaAcc = await safeFetchToken(umi, userBase)

              txBuilder = new TransactionBuilder();

              if (!userBaseAtaAcc) {
                      txBuilder = txBuilder.add(createAssociatedToken(umi, {
                       mint: baseMint,
                    }))
                }

            let _tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
            let _vaultAcc = await safeFetchToken(umi, vaultIssuance);
            let _baseMintAcc = await safeFetchMint(umi, baseMint);

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

               res = await txBuilder.sendAndConfirm(umi, { send: { skipPreflight: false } });

             tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
             let vaultAcc = await safeFetchToken(umi, vaultIssuance);
             let baseMintAcc = await safeFetchMint(umi, baseMint);
         
             //const mintFeeBps = _tokenManagerAcc.mintFeeBps;
             const mintFeeBps = tokenManagerAcc.mintFeeBps;
             let feeAmount = (BigInt(quantity) * BigInt(mintFeeBps)) / BigInt(10000);
             const expectedMintAmount = BigInt(quantity) - feeAmount;
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
             let expectedQuoteAmount = adjustedQuantity * BigInt(exchangeRate) / BigInt(10 ** exchangeRateDecimals);
         
             assert.equal(baseMintAcc.supply, _baseMintAcc.supply + expectedMintAmount, "Total supply should be correct");
             assert.equal(tokenManagerAcc.totalCollateral, _tokenManagerAcc.totalCollateral + expectedQuoteAmount, "Total collateral should be correct");
             assert.equal(vaultAcc.amount, _vaultAcc.amount + expectedQuoteAmount, "Vault amount should be correct");
 
           //Test the  redeeming with the new fees set

           //new quantity to be redeemed
            quantity = 1000 * 10 ** baseMintDecimals;

             const userQuoteAtaAcc = await safeFetchToken(umi, userQuote)

             txBuilder = new TransactionBuilder();

             if (!userQuoteAtaAcc) {
               txBuilder = txBuilder.add(createAssociatedToken(umi, {
               mint: userQuote,
               }))
              }

     _tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
     _vaultAcc = await safeFetchToken(umi, vaultIssuance);
     _baseMintAcc = await safeFetchMint(umi, baseMint);

    txBuilder = txBuilder.add(redeem(umi, {
      tokenManager,
      mint: baseMint,
      quoteMint: quoteMint,
      payerMintAta: userBase,
      payerQuoteMintAta: userQuote,
      vault: vaultIssuance,
      payer: umi.identity,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      quantity,
      proof
    }))

     res = await txBuilder.sendAndConfirm(umi, { send: { skipPreflight: false } });

     tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
     vaultAcc = await safeFetchToken(umi, vaultIssuance);
     baseMintAcc = await safeFetchMint(umi, baseMint);

    expectedQuoteAmount = (BigInt(quantity) / BigInt(10 ** baseMintDecimals) * BigInt(exchangeRate) / BigInt(10 ** exchangeRateDecimals)) * BigInt(10 ** quoteMintDecimals);
    const redeemFeeBps = tokenManagerAcc.redeemFeeBps;
     feeAmount = (BigInt(quantity) * BigInt(redeemFeeBps)) / BigInt(10000);
    const expectedQuoteAmountAfterFees = expectedQuoteAmount - feeAmount;

    assert.equal(baseMintAcc.supply, _baseMintAcc.supply - BigInt(quantity), "Total supply should be correct");
    assert.equal(tokenManagerAcc.totalCollateral, _tokenManagerAcc.totalCollateral - expectedQuoteAmountAfterFees, "Total collateral should be correct");
    assert.equal(vaultAcc.amount, _vaultAcc.amount - expectedQuoteAmountAfterFees, "Vault amount should be correct");
 
        })

  });