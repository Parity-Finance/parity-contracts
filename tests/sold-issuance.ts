import { keypairIdentity, Pda, PublicKey, publicKey, TransactionBuilder, createAmount } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { createAssociatedToken, createSplAssociatedTokenProgram, createSplTokenProgram, findAssociatedTokenPda, safeFetchToken, SPL_ASSOCIATED_TOKEN_PROGRAM_ID } from "@metaplex-foundation/mpl-toolbox"
import { Connection, Keypair, PublicKey as Web3JsPublicKey } from "@solana/web3.js";
import { createSoldIssuanceProgram, findTokenManagerPda, initialize, SOLD_ISSUANCE_PROGRAM_ID, mint, redeem, safeFetchTokenManager, getMerkleRoot, getMerkleProof, toggleActive, updateMerkleRoot, depositFunds, withdrawFunds } from "../clients/js/src"
import { ASSOCIATED_TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { fromWeb3JsKeypair, fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { findMetadataPda } from "@metaplex-foundation/mpl-token-metadata";
import assert from 'assert';

describe.only("sold-contract", () => {
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
  let stableMint: Pda = umi.eddsa.findPda(SOLD_ISSUANCE_PROGRAM_ID, [Buffer.from("mint")])
  let metadata: Pda = findMetadataPda(umi, { mint: stableMint[0] })
  let userStable = findAssociatedTokenPda(umi, { owner: umi.identity.publicKey, mint: stableMint[0] })

  // Quote Mint and ATAs
  let quoteMint: PublicKey
  let userUSDC: PublicKey
  let vault: Pda

  let tokenManager: Pda

  // Test Controls
  const mintDecimals = 6;
  const quoteMintDecimals = 5;
  const emergencyFundBasisPoints = 800; // 10% have to stay in the vault
  const exchangeRate = 1;

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

      userUSDC = fromWeb3JsPublicKey(userUsdcInfo.address);
      quoteMint = fromWeb3JsPublicKey(quoteMintWeb3js)

      tokenManager = findTokenManagerPda(umi);
      vault = findAssociatedTokenPda(umi, { owner: tokenManager[0], mint: quoteMint });
    } catch (error) {
      console.log(error);
    }
  })

  it("Token manager is initialized!", async () => {
    const merkleRoot = getMerkleRoot(allowedWallets);

    let txBuilder = new TransactionBuilder();

    txBuilder = txBuilder.add(initialize(umi, {
      tokenManager,
      vault,
      metadata,
      mint: stableMint,
      quoteMint: quoteMint,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      name: "SOLD",
      symbol: "SOLD",
      uri: "https://builderz.dev/_next/image?url=%2Fimages%2Fheader-gif.gif&w=3840&q=75",
      decimals: mintDecimals,
      exchangeRate,
      emergencyFundBasisPoints,
      merkleRoot
    }))

    await txBuilder.sendAndConfirm(umi);

    const tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);

    assert.deepStrictEqual(
      new Uint8Array(tokenManagerAcc.merkleRoot),
      new Uint8Array(merkleRoot)
    );
    assert.equal(tokenManagerAcc.mint.toString(), stableMint[0].toString());
    assert.equal(tokenManagerAcc.mintDecimals, mintDecimals);
    assert.equal(tokenManagerAcc.quoteMint.toString(), quoteMint.toString());
    assert.equal(tokenManagerAcc.quoteMintDecimals, quoteMintDecimals);
    assert.equal(tokenManagerAcc.exchangeRate, exchangeRate);
    assert.equal(tokenManagerAcc.emergencyFundBasisPoints, emergencyFundBasisPoints);
    assert.equal(tokenManagerAcc.active, true);
    assert.equal(tokenManagerAcc.totalSupply, 0);
    assert.equal(tokenManagerAcc.totalCollateral, 0);
  });

  it("Sold can be minted for USDC", async () => {
    const quantity = 10000;

    const proof = getMerkleProof(allowedWallets, keypair.publicKey.toBase58());

    let txBuilder = new TransactionBuilder();

    const userStableAtaAcc = await safeFetchToken(umi, userStable)

    if (!userStableAtaAcc) {
      txBuilder = txBuilder.add(createAssociatedToken(umi, {
        mint: stableMint,
      }))
    }

    const _tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    const _vaultAcc = await safeFetchToken(umi, vault);

    txBuilder = txBuilder.add(mint(umi, {
      tokenManager,
      mint: stableMint,
      quoteMint: quoteMint,
      payerMintAta: userStable,
      payerQuoteMintAta: userUSDC,
      vault,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      quantity,
      proof
    }))

    await txBuilder.sendAndConfirm(umi, { send: { skipPreflight: false } });

    const tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    const vaultAcc = await safeFetchToken(umi, vault);

    const expectedMintAmount = BigInt(quantity * 10 ** mintDecimals);
    const expectedQuoteAmount = BigInt(quantity * 10 ** quoteMintDecimals * exchangeRate);

    assert.equal(tokenManagerAcc.totalSupply, _tokenManagerAcc.totalSupply + expectedMintAmount);
    assert.equal(tokenManagerAcc.totalCollateral, _tokenManagerAcc.totalCollateral + expectedQuoteAmount);
    assert.equal(vaultAcc.amount, _vaultAcc.amount + expectedQuoteAmount);
  })

  it("Sold can be redeemed for Quote", async () => {
    const quantity = 1000;

    const proof = getMerkleProof(allowedWallets, keypair.publicKey.toBase58());

    let txBuilder = new TransactionBuilder();

    const userQuoteAtaAcc = await safeFetchToken(umi, userUSDC)

    if (!userQuoteAtaAcc) {
      txBuilder = txBuilder.add(createAssociatedToken(umi, {
        mint: userUSDC,
      }))
    }

    const _tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    const _vaultAcc = await safeFetchToken(umi, vault);

    txBuilder = txBuilder.add(redeem(umi, {
      tokenManager,
      mint: stableMint,
      quoteMint: quoteMint,
      payerMintAta: userStable,
      payerQuoteMintAta: userUSDC,
      vault,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      quantity,
      proof
    }))

    await txBuilder.sendAndConfirm(umi, { send: { skipPreflight: false } });

    const tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    const vaultAcc = await safeFetchToken(umi, vault);

    const expectedMintAmount = BigInt(quantity * 10 ** mintDecimals);
    const expectedQuoteAmount = BigInt(quantity * 10 ** quoteMintDecimals * exchangeRate);

    assert.equal(tokenManagerAcc.totalSupply, _tokenManagerAcc.totalSupply - expectedMintAmount);
    assert.equal(tokenManagerAcc.totalCollateral, _tokenManagerAcc.totalCollateral - expectedQuoteAmount);
    assert.equal(vaultAcc.amount, _vaultAcc.amount - expectedQuoteAmount);
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
    let userStableAtaAcc = await safeFetchToken(umi, userStable)

    if (!userStableAtaAcc) {
      txBuilder = txBuilder.add(createAssociatedToken(umi, {
        mint: stableMint,
      }))
    }
    txBuilder = txBuilder.add(mint(umi, {
      tokenManager,
      mint: stableMint,
      quoteMint: quoteMint,
      payerMintAta: userStable,
      payerQuoteMintAta: userUSDC,
      vault,
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
    userStableAtaAcc = await safeFetchToken(umi, userStable)

    if (!userStableAtaAcc) {
      txBuilder = txBuilder.add(createAssociatedToken(umi, {
        mint: stableMint,
      }))
    }
    txBuilder = txBuilder.add(redeem(umi, {
      tokenManager,
      mint: stableMint,
      quoteMint: quoteMint,
      payerMintAta: userStable,
      payerQuoteMintAta: userUSDC,
      vault,
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
    txBuilder = txBuilder.add(updateMerkleRoot(umi, {
      tokenManager,
      merkleRoot: newMerkleRoot
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
      mint: stableMint,
      quoteMint: quoteMint,
      payerMintAta: userStable,
      payerQuoteMintAta: userUSDC,
      vault,
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
      mint: stableMint,
      quoteMint: quoteMint,
      payerMintAta: userStable,
      payerQuoteMintAta: userUSDC,
      vault,
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
    txBuilder = txBuilder.add(updateMerkleRoot(umi, {
      tokenManager,
      merkleRoot: originalMerkleRoot
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
      mint: stableMint,
      quoteMint: quoteMint,
      payerMintAta: userStable,
      payerQuoteMintAta: userUSDC,
      vault,
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
      mint: stableMint,
      quoteMint: quoteMint,
      payerMintAta: userStable,
      payerQuoteMintAta: userUSDC,
      vault,
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

  it("deposit and withdraw funds from the vault", async () => {
    let _tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    let _vaultAcc = await safeFetchToken(umi, vault);

    // Higher than total collateral amount
    let quantity = Number(_tokenManagerAcc.totalCollateral / BigInt(10 ** quoteMintDecimals)) + 1; // Amount to deposit
    // console.log("Quantity to Withdraw higher than collateral: ", quantity);
    // console.log("TotalSupply: ", Number(_tokenManagerAcc.totalSupply / BigInt(10 ** mintDecimals)));
    // console.log("TotalCollateral: ", Number(_tokenManagerAcc.totalCollateral / BigInt(10 ** quoteMintDecimals)));

    let txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(withdrawFunds(umi, {
      tokenManager,
      quoteMint: quoteMint,
      vault,
      authorityQuoteMintAta: userUSDC,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      quantity,
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
    quantity = (Number(_tokenManagerAcc.totalCollateral / BigInt(10 ** quoteMintDecimals)) * (1 - emergencyFundBasisPoints / 10000)) + 1; // Amount to deposit
    // console.log("Quantity to Withdraw, higher than threshhold: ", quantity);
    // console.log("TotalSupply: ", Number(_tokenManagerAcc.totalSupply / BigInt(10 ** mintDecimals)));
    // console.log("TotalCollateral: ", Number(_tokenManagerAcc.totalCollateral / BigInt(10 ** quoteMintDecimals)));

    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(withdrawFunds(umi, {
      tokenManager,
      quoteMint: quoteMint,
      vault,
      authorityQuoteMintAta: userUSDC,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      quantity,
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
    quantity = (Number(_tokenManagerAcc.totalCollateral / BigInt(10 ** quoteMintDecimals)) * (1 - emergencyFundBasisPoints / 10000)); // Amount to withdraw
    // console.log("Quantity to Withdraw allowed: ", quantity);
    // console.log("TotalSupply: ", Number(_tokenManagerAcc.totalSupply / BigInt(10 ** mintDecimals)));
    // console.log("TotalCollateral: ", Number(_tokenManagerAcc.totalCollateral / BigInt(10 ** quoteMintDecimals)));

    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(withdrawFunds(umi, {
      tokenManager,
      quoteMint: quoteMint,
      vault,
      authorityQuoteMintAta: userUSDC,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      quantity,
    }));
    await txBuilder.sendAndConfirm(umi);

    let tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    let vaultAcc = await safeFetchToken(umi, vault);

    let expectedChange = BigInt(quantity * 10 ** quoteMintDecimals)
    assert.equal(tokenManagerAcc.totalCollateral, _tokenManagerAcc.totalCollateral - expectedChange, "TokenManager totalCollateral should be equal to the initial totalCollateral minus withdrawed amount");
    assert.equal(vaultAcc.amount, _vaultAcc.amount - expectedChange, "Vault balance should be equal to the initial vault minus withdrawed amount");

    // Deposit excessive
    quantity = Number(((tokenManagerAcc.totalSupply / BigInt(10 ** mintDecimals)) * BigInt(exchangeRate)) - (tokenManagerAcc.totalCollateral / BigInt(10 ** quoteMintDecimals))) + 1;
    // console.log("Quantity to Deposit not allowed: ", quantity);
    // console.log("TotalSupply: ", Number(tokenManagerAcc.totalSupply / BigInt(10 ** mintDecimals)));
    // console.log("TotalCollateral: ", Number(tokenManagerAcc.totalCollateral / BigInt(10 ** quoteMintDecimals)));

    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(depositFunds(umi, {
      tokenManager,
      quoteMint: quoteMint,
      vault,
      authorityQuoteMintAta: userUSDC,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      quantity,
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

    quantity = Number(((tokenManagerAcc.totalSupply / BigInt(10 ** mintDecimals)) * BigInt(exchangeRate)) - (tokenManagerAcc.totalCollateral / BigInt(10 ** quoteMintDecimals)));
    // console.log("Quantity deposit allowed: ", quantity);
    // console.log("TotalSupply: ", Number(tokenManagerAcc.totalSupply / BigInt(10 ** mintDecimals)));
    // console.log("TotalCollateral: ", Number(tokenManagerAcc.totalCollateral / BigInt(10 ** quoteMintDecimals)));

    txBuilder = new TransactionBuilder();
    txBuilder = txBuilder.add(depositFunds(umi, {
      tokenManager,
      quoteMint: quoteMint,
      vault,
      authorityQuoteMintAta: userUSDC,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      quantity,
    }));

    await txBuilder.sendAndConfirm(umi);

    tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    vaultAcc = await safeFetchToken(umi, vault);

    expectedChange = BigInt(quantity * 10 ** quoteMintDecimals)
    assert.equal(tokenManagerAcc.totalCollateral, _tokenManagerAcc.totalCollateral + expectedChange, "TokenManager totalCollateral should be equal to the initial totalCollateral plus deposited amount");
    assert.equal(vaultAcc.amount, _vaultAcc.amount + expectedChange, "Vault balance should be equal to the initial vault plus deposited amount");
  });
});
