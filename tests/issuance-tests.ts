import { Umi, Pda, PublicKey, publicKey, createAmount, keypairIdentity, some, } from "@metaplex-foundation/umi";
import { Connection, Keypair } from "@solana/web3.js";
import { TransactionBuilder } from "@metaplex-foundation/umi";
import { addGatekeeper, depositFunds, findGatekeeperPda, initializeTokenManager, initializeWithdrawFunds, initiateUpdateManagerOwner, mint, mintAdmin, PARITY_ISSUANCE_PROGRAM_ID, redeem, removeGatekeeper, safeFetchGatekeeper, safeFetchTokenManager, setup, SetupOptions, toggleActive, updateManagerOwner, updateMintMetadata, updateTokenManagerAdmin, updateTokenManagerOwner, withdrawFunds } from "../clients/js/src";
import { getMerkleProof, getMerkleRoot } from "../clients/js/src/utils";
import { SPL_ASSOCIATED_TOKEN_PROGRAM_ID, safeFetchToken, safeFetchMint, createAssociatedToken, } from "@metaplex-foundation/mpl-toolbox";
import {
  fromWeb3JsKeypair,
  fromWeb3JsPublicKey,
  toWeb3JsKeypair,
} from "@metaplex-foundation/umi-web3js-adapters";
import {
  findMetadataPda,
  safeFetchMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import assert from "assert";
import { TestEnvironment } from "./setup-environment";
import { calculateMaxWithdrawableAmount } from "../clients/js/src/utils/maxWithdrawable";
import { createMint } from "@solana/spl-token";


export async function runIssuanceTests(getEnv: () => TestEnvironment) {
  let env: TestEnvironment;

  before(function () {
    env = getEnv();
  });

  it.only("Token manager is initialized!", async () => {
    let umi = env.umi;
    let tokenManager = env.tokenManager;
    let baseMint = env.baseMint;
    let baseMintDecimals = env.baseMintDecimals;
    const merkleRoot = getMerkleRoot(env.allowedWallets);

    const tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    const baseMintAcc = await safeFetchMint(umi, baseMint);

    const expectedMerkleRoot =
      merkleRoot.length === 0 ? new Array(32).fill(0) : Array.from(merkleRoot);

    assert.deepStrictEqual(
      tokenManagerAcc.merkleRoot,
      Uint8Array.from(expectedMerkleRoot),
      "Merkle root in token manager account should match expected merkle root"
    );
    assert.equal(
      tokenManagerAcc.mint,
      baseMint[0],
      "Token manager's mint should match the base mint"
    );
    assert.equal(
      tokenManagerAcc.mintDecimals,
      baseMintDecimals,
      "Token manager's mint decimals should match base mint decimals"
    );
    assert.equal(
      tokenManagerAcc.quoteMint,
      env.quoteMint,
      "Token manager's quote mint should match the provided quote mint"
    );
    assert.equal(
      tokenManagerAcc.quoteMintDecimals,
      env.quoteMintDecimals,
      "Token manager's quote mint decimals should match the provided quote mint decimals"
    );
    assert.equal(
      tokenManagerAcc.exchangeRate,
      BigInt(env.exchangeRate),
      "Token manager's exchange rate should match the provided exchange rate"
    );
    assert.equal(
      tokenManagerAcc.emergencyFundBasisPoints,
      env.emergencyFundBasisPoints,
      "Token manager's emergency fund basis points should match the provided value"
    );
    assert.equal(
      tokenManagerAcc.active,
      true,
      "Token manager should be active"
    );
    assert.equal(
      baseMintAcc.supply,
      0,
      "Token manager's total supply should be zero"
    );
    assert.equal(
      tokenManagerAcc.totalCollateral,
      0,
      "Token manager's total collateral should be zero"
    );
    assert.equal(
      tokenManagerAcc.mintFeeBps,
      50,
      "Token manager's mint fee should be 50"
    );
    assert.equal(
      tokenManagerAcc.redeemFeeBps,
      50,
      "Token manager's redeem fee should be 50"
    );
  });


  it.only("pUSD can be minted for USDC", async () => {
    const quantity = BigInt(10000 * 10 ** env.baseMintDecimals);

    const proof = getMerkleProof(env.allowedWallets, env.umi.identity.publicKey.toString());

    let txBuilder = new TransactionBuilder();

    const userBaseAtaAcc = await safeFetchToken(env.umi, env.userBase);

    if (!userBaseAtaAcc) {
      txBuilder = txBuilder.add(
        createAssociatedToken(env.umi, {
          mint: env.baseMint,
        })
      );
    }

    const _tokenManagerAcc = await safeFetchTokenManager(env.umi, env.tokenManager);
    const _vaultAcc = await safeFetchToken(env.umi, env.vaultIssuance);
    const _baseMintAcc = await safeFetchMint(env.umi, env.baseMint);

    txBuilder = txBuilder.add(
      mint(env.umi, {
        tokenManager: env.tokenManager,
        mint: env.baseMint,
        quoteMint: env.quoteMint,
        payerMintAta: env.userBase,
        payerQuoteMintAta: env.userQuote,
        vault: env.vaultIssuance,
        associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
        quantity,
        proof,
      })
    );

    await txBuilder.sendAndConfirm(env.umi, {
      send: { skipPreflight: false },
    });

    const tokenManagerAcc = await safeFetchTokenManager(env.umi, env.tokenManager);
    const vaultAcc = await safeFetchToken(env.umi, env.vaultIssuance);
    const baseMintAcc = await safeFetchMint(env.umi, env.baseMint);

    const mintFeeBps = tokenManagerAcc.mintFeeBps;
    const feeAmount = (quantity * BigInt(mintFeeBps)) / BigInt(10000);
    const expectedMintAmount = quantity - feeAmount;
    const powerDifference = env.quoteMintDecimals - env.baseMintDecimals;

    // Adjust quantity by the power difference before converting to BigInt
    let adjustedQuantity;
    if (powerDifference > 0) {
      adjustedQuantity = quantity * BigInt(10 ** powerDifference);
    } else if (powerDifference < 0) {
      adjustedQuantity = quantity / BigInt(10 ** -powerDifference);
    } else {
      adjustedQuantity = quantity;
    }

    // Calculate the expected quote amount
    const expectedQuoteAmount =
      (adjustedQuantity * BigInt(env.exchangeRate)) /
      BigInt(10 ** env.exchangeRateDecimals);

    assert.equal(
      baseMintAcc.supply,
      _baseMintAcc.supply + expectedMintAmount,
      "Total supply should be correct"
    );
    assert.equal(
      tokenManagerAcc.totalCollateral,
      _tokenManagerAcc.totalCollateral + expectedQuoteAmount,
      "Total collateral should be correct"
    );
    assert.equal(
      vaultAcc.amount,
      _vaultAcc.amount + expectedQuoteAmount,
      "Vault amount should be correct"
    );
  });

  it("pUSD can be redeemed for Quote", async () => {
    const quantity = 1000 * 10 ** env.baseMintDecimals;

    const proof = getMerkleProof(env.allowedWallets, env.keypair.publicKey.toBase58());

    let txBuilder = new TransactionBuilder();

    const userQuoteAtaAcc = await safeFetchToken(env.umi, env.userQuote);

    if (!userQuoteAtaAcc) {
      txBuilder = txBuilder.add(
        createAssociatedToken(env.umi, {
          mint: env.userQuote,
        })
      );
    }

    const _tokenManagerAcc = await safeFetchTokenManager(env.umi, env.tokenManager);
    const _vaultAcc = await safeFetchToken(env.umi, env.vaultIssuance);
    const _baseMintAcc = await safeFetchMint(env.umi, env.baseMint);

    txBuilder = txBuilder.add(
      redeem(env.umi, {
        tokenManager: env.tokenManager,
        mint: env.baseMint,
        quoteMint: env.quoteMint,
        payerMintAta: env.userBase,
        payerQuoteMintAta: env.userQuote,
        vault: env.vaultIssuance,
        associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
        quantity,
        proof
      })
    );

    await txBuilder.sendAndConfirm(env.umi, {
      send: { skipPreflight: false },
    });

    const tokenManagerAcc = await safeFetchTokenManager(env.umi, env.tokenManager);
    const vaultAcc = await safeFetchToken(env.umi, env.vaultIssuance);
    const baseMintAcc = await safeFetchMint(env.umi, env.baseMint);

    const expectedQuoteAmount =
      (((BigInt(quantity) / BigInt(10 ** env.baseMintDecimals)) *
        BigInt(env.exchangeRate)) /
        BigInt(10 ** env.exchangeRateDecimals)) *
      BigInt(10 ** env.quoteMintDecimals);
    const redeemFeeBps = tokenManagerAcc.redeemFeeBps;
    const feeAmount = (BigInt(quantity) * BigInt(redeemFeeBps)) / BigInt(10000);
    const expectedQuoteAmountAfterFees = expectedQuoteAmount - feeAmount;

    assert.equal(
      baseMintAcc.supply,
      _baseMintAcc.supply - BigInt(quantity),
      "Total supply should be correct"
    );
    assert.equal(
      tokenManagerAcc.totalCollateral,
      _tokenManagerAcc.totalCollateral - expectedQuoteAmountAfterFees,
      "Total collateral should be correct"
    );
    assert.equal(
      vaultAcc.amount,
      _vaultAcc.amount - expectedQuoteAmountAfterFees,
      "Vault amount should be correct"
    );
  });

  it("should add and remove a gatekeeper and check unpause permissions", async () => {
    const newGatekeeper = env.umi.eddsa.generateKeypair();

    await env.umi.rpc.airdrop(
      newGatekeeper.publicKey,
      createAmount(100_000 * 10 ** 9, "SOL", 9),
      { commitment: "finalized" }
    );

    const gatekeeper = findGatekeeperPda(env.umi, {
      wallet: newGatekeeper.publicKey,
    });

    // Add the new gatekeeper
    let txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(
      addGatekeeper(env.umi, {
        tokenManager: env.tokenManager,
        newGatekeeper: newGatekeeper.publicKey,
        admin: env.umi.identity,
        gatekeeper,
      })
    );
    await txBuilder.sendAndConfirm(env.umi);

    // Verify the gatekeeper was added
    let gatekeeperAcc = await safeFetchGatekeeper(env.umi, gatekeeper);
    assert.equal(
      gatekeeperAcc.wallet,
      newGatekeeper.publicKey,
      "Gatekeeper should be added"
    );

    // Pause the token manager with new gatekeeper
    let umi = env.umi.use(keypairIdentity(newGatekeeper));
    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(
      toggleActive(umi, { tokenManager: env.tokenManager, gatekeeper, active: false })
    );
    await txBuilder.sendAndConfirm(umi);

    let tokenManagerAcc = await safeFetchTokenManager(umi, env.tokenManager);
    assert.strictEqual(tokenManagerAcc.active, false);

    // Attempt to unpause the token manager as the new gatekeeper
    umi.use(keypairIdentity(fromWeb3JsKeypair(env.keypair))); // Switch back to admin
    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(
      toggleActive(umi, { tokenManager: env.tokenManager, active: true })
    );
    await txBuilder.sendAndConfirm(umi);

    tokenManagerAcc = await safeFetchTokenManager(umi, env.tokenManager);
    assert.strictEqual(
      tokenManagerAcc.active,
      true,
      "Token manager should be unpaused by gatekeeper"
    );

    // Remove the gatekeeper
    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(
      removeGatekeeper(umi, {
        tokenManager: env.tokenManager,
        gatekeeper,
        admin: umi.identity,
      })
    );
    await txBuilder.sendAndConfirm(umi);

    // Verify the gatekeeper was removed
    const gatekeeperAccAfterRemoval = await safeFetchGatekeeper(
      umi,
      gatekeeper
    );
    assert.strictEqual(
      gatekeeperAccAfterRemoval,
      null,
      "Expected gatekeeper account to be null"
    );

    // Attempt to unpause the token manager as the removed gatekeeper
    umi = umi.use(keypairIdentity(newGatekeeper));
    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(
      toggleActive(umi, { tokenManager: env.tokenManager, active: false })
    );
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
    let umi = env.umi.use(keypairIdentity(fromWeb3JsKeypair(env.keypair))); // Switch back to admin

    let txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(
      toggleActive(umi, {
        tokenManager: env.tokenManager,
        authority: umi.identity,
        active: false,
      })
    );
    await txBuilder.sendAndConfirm(umi);

    let tokenManagerAcc = await safeFetchTokenManager(umi, env.tokenManager);
    assert.strictEqual(tokenManagerAcc.active, false);

    // Attempt to mint tokens
    txBuilder = new TransactionBuilder();
    let userBaseAtaAcc = await safeFetchToken(umi, env.userBase);

    if (!userBaseAtaAcc) {
      txBuilder = txBuilder.add(
        createAssociatedToken(umi, {
          mint: env.baseMint,
        })
      );
    }
    txBuilder = txBuilder.add(
      mint(umi, {
        tokenManager: env.tokenManager,
        mint: env.baseMint,
        quoteMint: env.quoteMint,
        payerMintAta: env.userBase,
        payerQuoteMintAta: env.userQuote,
        vault: env.vaultIssuance,
        associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
        quantity: 1000,
        proof: getMerkleProof(env.allowedWallets, env.keypair.publicKey.toBase58()),
      })
    );

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
    userBaseAtaAcc = await safeFetchToken(umi, env.userBase);

    if (!userBaseAtaAcc) {
      txBuilder = txBuilder.add(
        createAssociatedToken(umi, {
          mint: env.baseMint,
        })
      );
    }
    txBuilder = txBuilder.add(
      redeem(umi, {
        tokenManager: env.tokenManager,
        mint: env.baseMint,
        quoteMint: env.quoteMint,
        payerMintAta: env.userBase,
        payerQuoteMintAta: env.userQuote,
        vault: env.vaultIssuance,
        associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
        quantity: 1000,
        proof: getMerkleProof(env.allowedWallets, env.keypair.publicKey.toBase58()),
      })
    );

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
    txBuilder = txBuilder.add(
      toggleActive(umi, { tokenManager: env.tokenManager, active: false })
    );
    await assert.rejects(
      async () => {
        await txBuilder.sendAndConfirm(umi);
      },
      (err) => {
        return (err as Error).message.includes(
          "Token manager status unchanged"
        );
      },
      "Expected failure due to no change in token manager status"
    );

    // Try unpause and test if working;
    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(
      toggleActive(umi, { tokenManager: env.tokenManager, active: true })
    );
    await txBuilder.sendAndConfirm(umi);

    tokenManagerAcc = await safeFetchTokenManager(umi, env.tokenManager);
    assert.equal(tokenManagerAcc.active, true);
  });

  it("should enforce allowList changes", async () => {
    const newAllowedWallets = ["BLDRZQiqt4ESPz12L9mt4XTBjeEfjoBopGPDMA36KtuZ"];

    let tokenManagerAcc = await safeFetchTokenManager(env.umi, env.tokenManager);
    const originalMerkleRoot = tokenManagerAcc.merkleRoot;
    const newMerkleRoot = getMerkleRoot(newAllowedWallets);

    // Update the allowList to a new set of wallets
    let txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(
      updateTokenManagerAdmin(env.umi, {
        tokenManager: env.tokenManager,
        newMerkleRoot: some(newMerkleRoot),
        newLimitPerSlot: null,
        isWhitelistEnabled: null,
        admin: env.umi.identity,
      })
    );
    await txBuilder.sendAndConfirm(env.umi);

    tokenManagerAcc = await safeFetchTokenManager(env.umi, env.tokenManager);
    assert.deepStrictEqual(
      new Uint8Array(tokenManagerAcc.merkleRoot),
      new Uint8Array(newMerkleRoot)
    );

    // Attempt to mint with the original wallet, which is no longer allowed
    txBuilder = new TransactionBuilder();
    let proof = getMerkleProof(env.allowedWallets, env.keypair.publicKey.toBase58());
    txBuilder = txBuilder.add(
      mint(env.umi, {
        tokenManager: env.tokenManager,
        mint: env.baseMint,
        quoteMint: env.quoteMint,
        payerMintAta: env.userBase,
        payerQuoteMintAta: env.userQuote,
        vault: env.vaultIssuance,
        associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
        quantity: 1000,
        proof,
      })
    );

    await assert.rejects(
      async () => {
        await txBuilder.sendAndConfirm(env.umi);
      },
      (err) => {
        return (err as Error).message.includes(
          "Address not found in allowed list"
        );
      },
      "Expected minting to fail with old wallet not in the new allowList"
    );

    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(
      redeem(env.umi, {
        tokenManager: env.tokenManager,
        mint: env.baseMint,
        quoteMint: env.quoteMint,
        payerMintAta: env.userBase,
        payerQuoteMintAta: env.userQuote,
        vault: env.vaultIssuance,
        associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
        quantity: 1000,
        proof,
      })
    );

    await assert.rejects(
      async () => {
        await txBuilder.sendAndConfirm(env.umi);
      },
      (err) => {
        return (err as Error).message.includes(
          "Address not found in allowed list"
        );
      },
      "Expected redemptions to fail with old wallet not in the new allowList"
    );

    // Restore the original allowList
    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(
      updateTokenManagerAdmin(env.umi, {
        tokenManager: env.tokenManager,
        admin: env.umi.identity,
        // Params
        newMerkleRoot: some(originalMerkleRoot),
        newLimitPerSlot: null,
        isWhitelistEnabled: null,
      })
    );
    await txBuilder.sendAndConfirm(env.umi);

    tokenManagerAcc = await safeFetchTokenManager(env.umi, env.tokenManager);

    assert.deepStrictEqual(
      new Uint8Array(tokenManagerAcc.merkleRoot),
      new Uint8Array(originalMerkleRoot)
    );

    // Attempt to mint again with the original wallet
    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(
      mint(env.umi, {
        tokenManager: env.tokenManager,
        mint: env.baseMint,
        quoteMint: env.quoteMint,
        payerMintAta: env.userBase,
        payerQuoteMintAta: env.userQuote,
        vault: env.vaultIssuance,
        associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
        quantity: 1000,
        proof,
      })
    );

    await assert.doesNotReject(async () => {
      await txBuilder.sendAndConfirm(env.umi);
    }, "Expected minting to succeed with wallet back in the allowList");

    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(
      redeem(env.umi, {
        tokenManager: env.tokenManager,
        mint: env.baseMint,
        quoteMint: env.quoteMint,
        payerMintAta: env.userBase,
        payerQuoteMintAta: env.userQuote,
        vault: env.vaultIssuance,
        associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
        quantity: 1000,
        proof,
      })
    );

    await assert.doesNotReject(async () => {
      await txBuilder.sendAndConfirm(env.umi);
    }, "Expected redemptions to succeed with wallet back in the allowList");
  });

  it("deposit and withdraw funds from the vaultIssuance", async () => {
    let umi = env.umi
    let tokenManager = env.tokenManager
    let _tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    let _vaultAcc = await safeFetchToken(umi, env.vaultIssuance);
    let _baseMintAcc = await safeFetchMint(umi, env.baseMint);
    let wrongMint = env.wrongMint

    // Higher than total collateral amount
    let quantity = Number(_tokenManagerAcc.totalCollateral) + 1; // Amount to deposit
    // console.log("Quantity to Withdraw higher than collateral: ", quantity);
    // console.log("TotalSupply: ", Number(_tokenManagerAcc.totalSupply / BigInt(10 ** baseMintDecimals)));
    // console.log("TotalCollateral: ", Number(_tokenManagerAcc.totalCollateral / BigInt(10 ** quoteMintDecimals)));

    // Process withdraw without one being initialized
    let txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(
      withdrawFunds(umi, {
        tokenManager,
        mint: env.baseMint,
        quoteMint: env.quoteMint,
        vault: env.vaultIssuance,
        authorityQuoteMintAta: env.userQuote,
        associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
        admin: umi.identity,
      })
    );

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
    txBuilder = txBuilder.add(
      initializeWithdrawFunds(umi, {
        tokenManager,
        mint: env.baseMint,
        vault: env.vaultIssuance,
        quantity,
        admin: umi.identity,
      })
    );

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
    txBuilder = txBuilder.add(
      initializeWithdrawFunds(umi, {
        tokenManager,
        quantity,
        mint: env.baseMint,
        vault: env.vaultIssuance,
        admin: umi.identity,
      })
    );

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
    txBuilder = txBuilder.add(
      initializeWithdrawFunds(umi, {
        tokenManager,
        quantity,
        mint: env.baseMint,
        admin: umi.identity,
        vault: env.vaultIssuance,
      })
    );

    await txBuilder.sendAndConfirm(umi);

    let tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    let vaultAcc = await safeFetchToken(umi, env.vaultIssuance);
    let baseMintAcc = await safeFetchMint(umi, env.baseMint);

    assert.equal(
      tokenManagerAcc.pendingWithdrawalAmount,
      quantity,
      "Pending withdrawal amount should have changed"
    );

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

    // Now attempt to initiate a second withdrawal
    //which should fail because a pending withrawal already exists
    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(
      initializeWithdrawFunds(umi, {
        tokenManager,
        quantity,
        mint: env.baseMint,
        admin: umi.identity,
        vault: env.vaultIssuance,
      })
    );

    await assert.rejects(
      async () => {
        await txBuilder.sendAndConfirm(umi);
      },
      (err) => {
        return (err as Error).message.includes("Pending Withdrawal Exists.");
      },
      "Expected withdrawal to fail because a pending withdrawal already exists"
    );


    // Test for wrong mint address
    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(
      withdrawFunds(umi, {
        tokenManager,
        mint: wrongMint, // Pass the wrong mint address
        quoteMint: env.quoteMint,
        vault: env.vaultIssuance,
        authorityQuoteMintAta: env.userQuote,
        associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
        admin: umi.identity,
      })
    );


    await assert.rejects(
      async () => {
        await txBuilder.sendAndConfirm(umi);
      },
      (err) => {
        return (err as Error).message.includes("A seeds constraint was violated.");
      },
      "Expected withdrawal to fail due to invalid mint address"
    );

    // Should work after an hour or specified time
    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(
      withdrawFunds(umi, {
        tokenManager,
        mint: env.baseMint,
        quoteMint: env.quoteMint,
        vault: env.vaultIssuance,
        authorityQuoteMintAta: env.userQuote,
        associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
        admin: umi.identity,
      })
    );
    await txBuilder.sendAndConfirm(umi);

    tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    vaultAcc = await safeFetchToken(umi, env.vaultIssuance);
    baseMintAcc = await safeFetchMint(umi, env.baseMint);
    let expectedChange = BigInt(quantity);

    // assert.equal(tokenManagerAcc.totalCollateral, _tokenManagerAcc.totalCollateral - expectedChange, "TokenManager totalCollateral should be equal to the initial totalCollateral minus withdrawed amount");
    // assert.equal(vaultAcc.amount, _vaultAcc.amount - expectedChange, "Vault balance should be equal to the initial vaultIssuance minus withdrawed amount");

    // Deposit excessive
    quantity =
      Number(
        ((baseMintAcc.supply / BigInt(10 ** env.baseMintDecimals)) *
          BigInt(env.exchangeRate)) /
        BigInt(10 ** env.exchangeRateDecimals) -
        tokenManagerAcc.totalCollateral / BigInt(10 ** env.quoteMintDecimals)
      ) *
      10 ** env.quoteMintDecimals +
      1;
    if (quantity < 0) {
      quantity = 1;
    } else {
      quantity += 1;
    }
    // console.log("Quantity to Deposit not allowed: ", quantity);
    // console.log("TotalSupply: ", Number(baseMintAcc.supply / BigInt(10 ** baseMintDecimals)));
    // console.log("TotalCollateral: ", Number(tokenManagerAcc.totalCollateral / BigInt(10 ** quoteMintDecimals)));

    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(
      depositFunds(umi, {
        tokenManager,
        mint: env.baseMint,
        quoteMint: env.quoteMint,
        vault: env.vaultIssuance,
        authorityQuoteMintAta: env.userQuote,
        associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
        quantity,
        admin: umi.identity,
      })
    );

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

    quantity =
      Number(
        ((baseMintAcc.supply / BigInt(10 ** env.baseMintDecimals)) *
          BigInt(env.exchangeRate)) /
        BigInt(10 ** env.exchangeRateDecimals) -
        tokenManagerAcc.totalCollateral / BigInt(10 ** env.quoteMintDecimals)
      ) *
      10 ** env.quoteMintDecimals;

    const maxCollateral = Number(
      (baseMintAcc.supply / BigInt(10 ** env.baseMintDecimals)) *
      BigInt(env.exchangeRate)
    );
    quantity = maxCollateral - Number(_tokenManagerAcc.totalCollateral);
    // console.log("Max Collateral: ", maxCollateral);
    // console.log("TotalSupply: ", Number(_baseMintAcc.supply));
    // console.log("TotalCollateral: ", Number(_tokenManagerAcc.totalCollateral));
    // console.log("Quantity deposit allowed: ", quantity);

    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(
      depositFunds(umi, {
        tokenManager,
        mint: env.baseMint,
        quoteMint: env.quoteMint,
        vault: env.vaultIssuance,
        authorityQuoteMintAta: env.userQuote,
        associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
        quantity,
        admin: umi.identity,
      })
    );

    await txBuilder.sendAndConfirm(umi);

    tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    vaultAcc = await safeFetchToken(umi, env.vaultIssuance);

    expectedChange = BigInt(quantity);
    assert.equal(
      tokenManagerAcc.totalCollateral,
      _tokenManagerAcc.totalCollateral + expectedChange,
      "TokenManager totalCollateral should be equal to the initial totalCollateral plus deposited amount"
    );
    assert.equal(
      vaultAcc.amount,
      _vaultAcc.amount + expectedChange,
      "Vault balance should be equal to the initial vaultIssuance plus deposited amount"
    );
  });

  it("should initiate and accept manager owner update", async () => {
    let umi = env.umi
    let tokenManager = env.tokenManager
    const newAdmin = umi.eddsa.generateKeypair();

    await umi.rpc.airdrop(
      newAdmin.publicKey,
      createAmount(100_000 * 10 ** 9, "SOL", 9),
      {
        commitment: "finalized",
      }
    );
    umi.use(keypairIdentity(fromWeb3JsKeypair(env.keypair))); // Switch to new admin

    // Initiate update of tokenManager owner
    let txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(
      initiateUpdateManagerOwner(umi, {
        tokenManager,
        newOwner: newAdmin.publicKey,
        owner: umi.identity,
      })
    );
    await txBuilder.sendAndConfirm(umi);

    // Check if the update initiation was successful
    let tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);

    assert.equal(
      tokenManagerAcc.pendingOwner,
      newAdmin.publicKey,
      "Pending owner should be set to new admin"
    );

    // Accept update of manager owner
    umi.use(keypairIdentity(newAdmin)); // Switch to new admin
    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(
      updateManagerOwner(umi, {
        tokenManager,
        newOwner: umi.identity,
      })
    );
    await txBuilder.sendAndConfirm(umi);

    // Verify the new admin is set
    tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    assert.equal(
      tokenManagerAcc.owner,
      newAdmin.publicKey,
      "owner should be updated to new owner"
    );
    assert.equal(
      tokenManagerAcc.pendingOwner,
      publicKey("11111111111111111111111111111111"),
      "Pending owner should be set to default pubkey"
    );

    // Change back
    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(
      initiateUpdateManagerOwner(umi, {
        tokenManager,
        newOwner: fromWeb3JsKeypair(env.keypair).publicKey,
        owner: umi.identity,
      })
    );
    await txBuilder.sendAndConfirm(umi);

    // Accept update back to original admin
    umi.use(keypairIdentity(fromWeb3JsKeypair(env.keypair))); // Switch back to original admin
    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(
      updateManagerOwner(umi, {
        tokenManager,
        newOwner: umi.identity,
      })
    );
    await txBuilder.sendAndConfirm(umi);

    // Verify the admin is set back to original
    tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    assert.equal(
      tokenManagerAcc.admin,
      publicKey(env.keypair.publicKey),
      "Admin should be reverted back to original admin"
    );
  });

  it("should update base mint metadata of issuance program", async () => {
    const name = "TEST";
    const symbol = "TEST";
    const uri = "https://example.com/new-xmint-info.json";
    let umi = env.umi;
    let tokenManager = env.tokenManager;
    let baseMetadata = env.baseMetadata

    let txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(
      updateMintMetadata(umi, {
        tokenManager,
        metadataAccount: baseMetadata,
        name,
        symbol,
        uri,
        owner: umi.identity,
      })
    );

    await txBuilder.sendAndConfirm(umi);

    const mintMetadata = await safeFetchMetadata(umi, baseMetadata);
    assert.equal(mintMetadata.name, name, "Name should be updated");
    assert.equal(mintMetadata.symbol, symbol, "Symbol should be updated");
    assert.equal(mintMetadata.uri, uri, "Uri should be updated");
  });

  it("should mint tokens to admin and update token  minter", async () => {
    let umi = env.umi;
    let tokenManager = env.tokenManager;
    let baseMintDecimals = env.baseMintDecimals;
    let baseMint = env.baseMint;
    let userBase = env.userBase;

    const newMinter = env.umi.eddsa.generateKeypair();

    await env.umi.rpc.airdrop(
      newMinter.publicKey,
      createAmount(100_000 * 10 ** 9, "SOL", 9),
      { commitment: "finalized" }
    );

    const quantity = 10000 * 10 ** baseMintDecimals;

    // Attempt to mint tokens with the wrong minter
    umi.use(keypairIdentity(newMinter));
    let txBuilder = new TransactionBuilder();

    const userBaseAtaAcc = await safeFetchToken(umi, userBase);

    if (!userBaseAtaAcc) {
      txBuilder = txBuilder.add(
        createAssociatedToken(umi, {
          mint: baseMint,
        })
      );
    }

    txBuilder = new TransactionBuilder().add(
      mintAdmin(umi, {
        tokenManager,
        mint: baseMint,
        minterMintAta: userBase,
        minter: umi.identity,
        associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
        quantity: quantity,
      })
    );

    await assert.rejects(
      async () => {
        await txBuilder.sendAndConfirm(umi);
      },
      (err) => {
        return (err as Error).message.includes("A token owner constraint was violated.");
      },
      "Expected minting to fail cause wrong minter was passed"
    );

    // Change the token manager minter
    umi.use(keypairIdentity(fromWeb3JsKeypair(env.keypair)));
    txBuilder = new TransactionBuilder().add(
      updateTokenManagerOwner(umi, {
        tokenManager,
        owner: umi.identity,
        newAdmin: null,
        newMinter: some(umi.identity.publicKey),
        emergencyFundBasisPoints: null,
        newWithdrawTimeLock: null,
        newWithdrawExecutionWindow: null,
        newMintFeeBps: null,
        newRedeemFeeBps: null,
        newExchangeRate: null,
      })
    );

    await txBuilder.sendAndConfirm(umi);

    const tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);

    assert.deepStrictEqual(
      tokenManagerAcc.minter,
      umi.identity.publicKey,
      "Token manager's minter should be updated"
    );

    //Now try minting with the newMinter
    const _baseMintAcc = await safeFetchMint(umi, baseMint);

    txBuilder = new TransactionBuilder().add(
      mintAdmin(umi, {
        tokenManager,
        mint: baseMint,
        minterMintAta: userBase,
        minter: umi.identity,
        associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
        quantity: quantity,
      })
    );

    await txBuilder.sendAndConfirm(umi);

    const baseMintAcc = await safeFetchMint(umi, baseMint);
    const expectedMintAmount = BigInt(quantity);

    assert.deepStrictEqual(
      baseMintAcc.supply,
      _baseMintAcc.supply + expectedMintAmount,
      "Total supply should be correct"
    );
  });

  it("should update the mint and redeem fee with an higher amount", async () => {
    let umi = env.umi;
    let tokenManager = env.tokenManager;
    let vaultIssuance = env.vaultIssuance;
    let baseMintDecimals = env.baseMintDecimals;
    let baseMint = env.baseMint;
    let userBase = env.userBase;
    let quoteMint = env.quoteMint;
    let userQuote = env.userQuote;
    let quoteMintDecimals = env.quoteMintDecimals;
    let exchangeRate = env.exchangeRate;
    let exchangeRateDecimals = env.exchangeRateDecimals;

    let txBuilder = new TransactionBuilder().add(
      updateTokenManagerOwner(umi, {
        tokenManager,
        owner: umi.identity,
        newAdmin: null,
        newMinter: null,
        emergencyFundBasisPoints: null,
        newWithdrawTimeLock: null,
        newWithdrawExecutionWindow: null,
        newMintFeeBps: 80,
        newRedeemFeeBps: 80,
        newExchangeRate: null,
      })
    );

    let res = await txBuilder.sendAndConfirm(umi, {
      send: { skipPreflight: false },
    });

    let tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);

    assert.deepStrictEqual(
      tokenManagerAcc.mintFeeBps,
      80,
      "Token manager's mint fee should be 80"
    );
    assert.deepStrictEqual(
      tokenManagerAcc.redeemFeeBps,
      80,
      "Token manager's redeem fee should be 80"
    );

    //Test the  minting with the new fees set

    let quantity = 10000 * 10 ** baseMintDecimals;
    const proof = getMerkleProof(env.allowedWallets, env.keypair.publicKey.toBase58());

    const userBaseAtaAcc = await safeFetchToken(umi, userBase);

    txBuilder = new TransactionBuilder();

    if (!userBaseAtaAcc) {
      txBuilder = txBuilder.add(
        createAssociatedToken(umi, {
          mint: baseMint,
        })
      );
    }

    let _tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    let _vaultAcc = await safeFetchToken(umi, vaultIssuance);
    let _baseMintAcc = await safeFetchMint(umi, baseMint);

    txBuilder = txBuilder.add(
      mint(umi, {
        tokenManager,
        mint: baseMint,
        quoteMint: quoteMint,
        payerMintAta: userBase,
        payerQuoteMintAta: userQuote,
        vault: vaultIssuance,
        associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
        quantity,
        proof,
      })
    );

    res = await txBuilder.sendAndConfirm(umi, {
      send: { skipPreflight: false },
    });

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
      adjustedQuantity = BigInt(quantity) / BigInt(10 ** -powerDifference);
    } else {
      adjustedQuantity = BigInt(quantity);
    }

    // Calculate the expected quote amount
    let expectedQuoteAmount =
      (adjustedQuantity * BigInt(exchangeRate)) /
      BigInt(10 ** exchangeRateDecimals);

    assert.equal(
      baseMintAcc.supply,
      _baseMintAcc.supply + expectedMintAmount,
      "Total supply should be correct"
    );
    assert.equal(
      tokenManagerAcc.totalCollateral,
      _tokenManagerAcc.totalCollateral + expectedQuoteAmount,
      "Total collateral should be correct"
    );
    assert.equal(
      vaultAcc.amount,
      _vaultAcc.amount + expectedQuoteAmount,
      "Vault amount should be correct"
    );

    //Test the  redeeming with the new fees set

    //new quantity to be redeemed
    quantity = 1000 * 10 ** baseMintDecimals;

    const userQuoteAtaAcc = await safeFetchToken(umi, userQuote);

    txBuilder = new TransactionBuilder();

    if (!userQuoteAtaAcc) {
      txBuilder = txBuilder.add(
        createAssociatedToken(umi, {
          mint: userQuote,
        })
      );
    }

    _tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    _vaultAcc = await safeFetchToken(umi, vaultIssuance);
    _baseMintAcc = await safeFetchMint(umi, baseMint);

    txBuilder = txBuilder.add(
      redeem(umi, {
        tokenManager,
        mint: baseMint,
        quoteMint: quoteMint,
        payerMintAta: userBase,
        payerQuoteMintAta: userQuote,
        vault: vaultIssuance,
        payer: umi.identity,
        associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
        quantity,
        proof,
      })
    );

    res = await txBuilder.sendAndConfirm(umi, {
      send: { skipPreflight: false },
    });

    tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    vaultAcc = await safeFetchToken(umi, vaultIssuance);
    baseMintAcc = await safeFetchMint(umi, baseMint);

    expectedQuoteAmount =
      (((BigInt(quantity) / BigInt(10 ** baseMintDecimals)) *
        BigInt(exchangeRate)) /
        BigInt(10 ** exchangeRateDecimals)) *
      BigInt(10 ** quoteMintDecimals);
    const redeemFeeBps = tokenManagerAcc.redeemFeeBps;
    feeAmount = (BigInt(quantity) * BigInt(redeemFeeBps)) / BigInt(10000);
    const expectedQuoteAmountAfterFees = expectedQuoteAmount - feeAmount;

    assert.equal(
      baseMintAcc.supply,
      _baseMintAcc.supply - BigInt(quantity),
      "Total supply should be correct"
    );
    assert.equal(
      tokenManagerAcc.totalCollateral,
      _tokenManagerAcc.totalCollateral - expectedQuoteAmountAfterFees,
      "Total collateral should be correct"
    );
    assert.equal(
      vaultAcc.amount,
      _vaultAcc.amount - expectedQuoteAmountAfterFees,
      "Vault amount should be correct"
    );
  });

  it("should update the mint and redeem fee with zero ", async () => {

    let umi = env.umi;
    let tokenManager = env.tokenManager;
    let vaultIssuance = env.vaultIssuance;
    let baseMintDecimals = env.baseMintDecimals;
    let baseMint = env.baseMint;
    let userBase = env.userBase;
    let quoteMint = env.quoteMint;
    let userQuote = env.userQuote;
    let quoteMintDecimals = env.quoteMintDecimals;
    let exchangeRate = env.exchangeRate;
    let exchangeRateDecimals = env.exchangeRateDecimals;

    //set mint fee and redeem fee of zero
    let txBuilder = new TransactionBuilder().add(
      updateTokenManagerOwner(umi, {
        tokenManager,
        owner: umi.identity,
        newAdmin: null,
        newMinter: null,
        emergencyFundBasisPoints: null,
        newWithdrawTimeLock: null,
        newWithdrawExecutionWindow: null,
        newMintFeeBps: 0,
        newRedeemFeeBps: 0,
        newExchangeRate: null,
      })
    );

    let res = await txBuilder.sendAndConfirm(umi, {
      send: { skipPreflight: false },
    });

    let tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);

    assert.deepStrictEqual(
      tokenManagerAcc.mintFeeBps,
      0,
      "Token manager's mint fee should be 0"
    );
    assert.deepStrictEqual(
      tokenManagerAcc.redeemFeeBps,
      0,
      "Token manager's redeem fee should be 0"
    );

    //Test the  minting with the new fees set

    let quantity = 10000 * 10 ** baseMintDecimals;
    const proof = getMerkleProof(env.allowedWallets, env.keypair.publicKey.toBase58());

    const userBaseAtaAcc = await safeFetchToken(umi, userBase);

    txBuilder = new TransactionBuilder();

    if (!userBaseAtaAcc) {
      txBuilder = txBuilder.add(
        createAssociatedToken(umi, {
          mint: baseMint,
        })
      );
    }

    let _tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    let _vaultAcc = await safeFetchToken(umi, vaultIssuance);
    let _baseMintAcc = await safeFetchMint(umi, baseMint);

    txBuilder = txBuilder.add(
      mint(umi, {
        tokenManager,
        mint: baseMint,
        quoteMint: quoteMint,
        payerMintAta: userBase,
        payerQuoteMintAta: userQuote,
        vault: vaultIssuance,
        associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
        quantity,
        proof,
      })
    );

    res = await txBuilder.sendAndConfirm(umi, {
      send: { skipPreflight: false },
    });

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
      adjustedQuantity = BigInt(quantity) / BigInt(10 ** -powerDifference);
    } else {
      adjustedQuantity = BigInt(quantity);
    }

    // Calculate the expected quote amount
    let expectedQuoteAmount =
      (adjustedQuantity * BigInt(exchangeRate)) /
      BigInt(10 ** exchangeRateDecimals);

    assert.equal(
      baseMintAcc.supply,
      _baseMintAcc.supply + expectedMintAmount,
      "Total supply should be correct"
    );
    assert.equal(
      tokenManagerAcc.totalCollateral,
      _tokenManagerAcc.totalCollateral + expectedQuoteAmount,
      "Total collateral should be correct"
    );
    assert.equal(
      vaultAcc.amount,
      _vaultAcc.amount + expectedQuoteAmount,
      "Vault amount should be correct"
    );

    //Test the  redeeming with the new fees set

    //new quantity to be redeemed
    quantity = 1000 * 10 ** baseMintDecimals;

    const userQuoteAtaAcc = await safeFetchToken(umi, userQuote);

    txBuilder = new TransactionBuilder();

    if (!userQuoteAtaAcc) {
      txBuilder = txBuilder.add(
        createAssociatedToken(umi, {
          mint: userQuote,
        })
      );
    }

    _tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    _vaultAcc = await safeFetchToken(umi, vaultIssuance);
    _baseMintAcc = await safeFetchMint(umi, baseMint);

    txBuilder = txBuilder.add(
      redeem(umi, {
        tokenManager,
        mint: baseMint,
        quoteMint: quoteMint,
        payerMintAta: userBase,
        payerQuoteMintAta: userQuote,
        vault: vaultIssuance,
        payer: umi.identity,
        associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
        quantity,
        proof,
      })
    );

    res = await txBuilder.sendAndConfirm(umi, {
      send: { skipPreflight: false },
    });

    tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    vaultAcc = await safeFetchToken(umi, vaultIssuance);
    baseMintAcc = await safeFetchMint(umi, baseMint);

    expectedQuoteAmount =
      (((BigInt(quantity) / BigInt(10 ** baseMintDecimals)) *
        BigInt(exchangeRate)) /
        BigInt(10 ** exchangeRateDecimals)) *
      BigInt(10 ** quoteMintDecimals);
    const redeemFeeBps = tokenManagerAcc.redeemFeeBps;
    feeAmount = (BigInt(quantity) * BigInt(redeemFeeBps)) / BigInt(10000);
    const expectedQuoteAmountAfterFees = expectedQuoteAmount - feeAmount;

    assert.equal(
      baseMintAcc.supply,
      _baseMintAcc.supply - BigInt(quantity),
      "Total supply should be correct"
    );
    assert.equal(
      tokenManagerAcc.totalCollateral,
      _tokenManagerAcc.totalCollateral - expectedQuoteAmountAfterFees,
      "Total collateral should be correct"
    );
    assert.equal(
      vaultAcc.amount,
      _vaultAcc.amount - expectedQuoteAmountAfterFees,
      "Vault amount should be correct"
    );
  });
}