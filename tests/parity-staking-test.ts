import { TestEnvironment } from "./setup-environment";
import { calculateExchangeRate, calculateIntervalRate, initiateUpdatePoolOwner, PARITY_ISSUANCE_PROGRAM_ID, safeFetchPoolManager, setup, SetupOptions, stake, unstake, updateAnnualYield, updatePoolManager, updatePoolOwner, updateXmintMetadata } from "../clients/js/src";
import {
  createAssociatedToken,
  safeFetchMint,
  safeFetchToken,
  SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@metaplex-foundation/mpl-toolbox";
import {
  keypairIdentity,
  publicKey,
  TransactionBuilder,
  createAmount,
} from "@metaplex-foundation/umi";
import assert from "assert";
import { assert as chaiAssert } from "chai";
import { fromWeb3JsKeypair } from "@metaplex-foundation/umi-web3js-adapters";
import {
  safeFetchMetadata,
} from "@metaplex-foundation/mpl-token-metadata";


export async function runParityStakingTests(getEnv: () => TestEnvironment) {
  describe("Parity staking Tests", function () {
    let umi, poolManager, tokenManager, keypair, xMint, xMintDecimals, baseMint, baseMintDecimals, userX, userBase, vaultStaking, testDepositCapAmount, xMetadata, initialExchangeRateParityStaking;

    before(function () {
      const env = getEnv();

      umi = env.umi;
      poolManager = env.poolManager;
      tokenManager = env.tokenManager;
      keypair = env.keypair;
      xMint = env.xMint;
      xMintDecimals = env.xMintDecimals;
      baseMint = env.baseMint;
      baseMintDecimals = env.baseMintDecimals;
      userX = env.userX;
      userBase = env.userBase;
      vaultStaking = env.vaultStaking;
      testDepositCapAmount = env.testDepositCapAmount;
      xMetadata = env.xMetadata;
      initialExchangeRateParityStaking = env.initialExchangeRateParityStaking;
    });

    it.only("Stake Pool is initialized!", async () => {
      const stakePoolAcc = await safeFetchPoolManager(umi, poolManager);
      const xMintAcc = await safeFetchMint(umi, xMint);

      assert.equal(stakePoolAcc.baseMint, baseMint[0]);
      assert.equal(stakePoolAcc.baseMintDecimals, baseMintDecimals);
      assert.equal(stakePoolAcc.xMint, xMint);
      assert.equal(stakePoolAcc.xMintDecimals, xMintDecimals);
      assert.equal(
        stakePoolAcc.initialExchangeRate,
        BigInt(initialExchangeRateParityStaking)
      );
      assert.equal(stakePoolAcc.baseBalance, 0n);
      assert.equal(xMintAcc.supply, 0n);
    });

    it.only("baseMint can be staked for xMint", async () => {
      let quantity = 1000 * 10 ** baseMintDecimals;

      let txBuilder = new TransactionBuilder();

      const userXAtaAcc = await safeFetchToken(umi, userX);

      if (!userXAtaAcc) {
        txBuilder = txBuilder.add(
          createAssociatedToken(umi, {
            mint: xMint,
          })
        );
      }

      const _stakePoolAcc = await safeFetchPoolManager(umi, poolManager);
      const _xMintAcc = await safeFetchMint(umi, xMint);
      const _vaultAcc = await safeFetchToken(umi, vaultStaking);

      txBuilder = txBuilder.add(
        stake(umi, {
          poolManager,
          baseMint,
          xMint,
          payerBaseMintAta: userBase,
          payerXMintAta: userX,
          vault: vaultStaking,
          associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
          quantity,
        })
      );

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

      await txBuilder.sendAndConfirm(umi);
      //await txBuilder.sendAndConfirm(umi, { send: { skipPreflight: true } });

      const stakePoolAcc = await safeFetchPoolManager(umi, poolManager);
      const xMintAcc = await safeFetchMint(umi, xMint);
      const vaultAcc = await safeFetchToken(umi, vaultStaking);

      const expectedBaseMintAmount = BigInt(quantity);

      const expectedxMintAmount = BigInt(
        Math.floor((quantity / exchangeRate) * 10 ** baseMintDecimals)
      );
      // console.log("Expected xMint Amount: ", Number(expectedxMintAmount));
      // console.log("xMint Supply start: ", Number(_xMintAcc.supply));
      // console.log("xMint Supply end: ", Number(xMintAcc.supply));

      assert.equal(
        stakePoolAcc.baseBalance,
        _stakePoolAcc.baseBalance + expectedBaseMintAmount,
        "Base Balance is not correct"
      );
      assert.equal(
        vaultAcc.amount,
        _vaultAcc.amount + expectedBaseMintAmount,
        "Vault amount is not correct"
      );
      chaiAssert.closeTo(
        Number(xMintAcc.supply),
        Number(_xMintAcc.supply) + Number(expectedxMintAmount),
        300000,
        "xSupply is not correct"
      );

      quantity = 1001 * 10 ** baseMintDecimals;
      //Attempt to try and stake again which should fail because of deposit cap reached
      txBuilder = new TransactionBuilder();

      txBuilder = txBuilder.add(
        stake(umi, {
          poolManager,
          baseMint,
          xMint,
          payerBaseMintAta: userBase,
          payerXMintAta: userX,
          vault: vaultStaking,
          associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
          quantity,
        })
      );

      await assert.rejects(
        async () => {
          await txBuilder.sendAndConfirm(umi);
        },
        (err) => {
          return (err as Error).message.includes("Deposit cap exceeded");
        },
        "Expected staking to fail because Deposit cap exceeded"
      );
    });

    it.only("baseMint can be unstaked by redeeming xMint", async () => {
      // const quantity = 10000 * 10 ** baseMintDecimals;
      let txBuilder = new TransactionBuilder();

      const userBaseAtaAcc = await safeFetchToken(umi, userBase);

      if (!userBaseAtaAcc) {
        txBuilder = txBuilder.add(
          createAssociatedToken(umi, {
            mint: baseMint,
          })
        );
      }

      const _stakePoolAcc = await safeFetchPoolManager(umi, poolManager);
      const _xMintAcc = await safeFetchMint(umi, xMint);
      const _vaultAcc = await safeFetchToken(umi, vaultStaking);

      const quantity = Number(_xMintAcc.supply);
      // console.log("Quantity: ", quantity);

      txBuilder = txBuilder.add(
        unstake(umi, {
          poolManager,
          baseMint,
          xMint,
          payerBaseMintAta: userBase,
          payerXMintAta: userX,
          vault: vaultStaking,
          associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
          quantity,
          tokenManager,
          parityIssuanceProgram: PARITY_ISSUANCE_PROGRAM_ID,
        })
      );

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

      await txBuilder.sendAndConfirm(umi, { send: { skipPreflight: false } });

      const stakePoolAcc = await safeFetchPoolManager(umi, poolManager);
      const xMintAcc = await safeFetchMint(umi, xMint);
      const vaultAcc = await safeFetchToken(umi, vaultStaking);

      const expectedBaseMintAmount = BigInt(
        Math.floor((quantity * exchangeRate) / 10 ** baseMintDecimals)
      );
      // console.log("Expected Base Mint Amount: ", Number(expectedBaseMintAmount));
      // console.log("Base Balance Start: ", Number(_stakePoolAcc.baseBalance));
      // console.log("Base Balance end: ", Number(stakePoolAcc.baseBalance));

      const expectedxMintAmount = BigInt(quantity);

      chaiAssert.equal(
        Number(stakePoolAcc.baseBalance),
        0,
        "Base Balance is not correct"
      );
      chaiAssert.equal(Number(vaultAcc.amount), 0, "Vault amount is not correct");
      chaiAssert.equal(
        xMintAcc.supply,
        _xMintAcc.supply - expectedxMintAmount,
        "xSupply is not correct"
      );
    });

    it.only("should update the annual yield rate of the stake pool", async function () {
      const annualYieldRate = 2500; // in Basis points
      const intervalSeconds = 60 * 60 * 8; // 8 hour interval

      const intervalRate = calculateIntervalRate(
        annualYieldRate,
        intervalSeconds
      );
      // console.log("Interval Rate: ", Number(intervalRate));

      let txBuilder = new TransactionBuilder();

      txBuilder = txBuilder.add(
        updateAnnualYield(umi, {
          poolManager,
          admin: umi.identity,
          intervalAprRate: intervalRate,
          tokenManager,
          xMint,
          parityIssuanceProgram: PARITY_ISSUANCE_PROGRAM_ID,
          associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
          vault: vaultStaking,
          baseMint: baseMint,
        })
      );

      await txBuilder.sendAndConfirm(umi);

      const stakePoolAcc = await safeFetchPoolManager(umi, poolManager);

      assert.equal(
        stakePoolAcc.intervalAprRate,
        intervalRate,
        "Annual yield rate should be updated to 25.00%"
      );
    });

    it.only("should initiate and accept pool owner update", async () => {
      const newAdmin = umi.eddsa.generateKeypair();

      await umi.rpc.airdrop(
        newAdmin.publicKey,
        createAmount(100_000 * 10 ** 9, "SOL", 9),
        {
          commitment: "finalized",
        }
      );

      // Initiate update of pool owner
      let txBuilder = new TransactionBuilder();
      txBuilder = txBuilder.add(
        initiateUpdatePoolOwner(umi, {
          poolManager,
          newOwner: newAdmin.publicKey,
          owner: umi.identity,
        })
      );
      await txBuilder.sendAndConfirm(umi);

      // Check if the update initiation was successful
      let poolManagerAcc = await safeFetchPoolManager(umi, poolManager);
      assert.equal(
        poolManagerAcc.pendingOwner,
        newAdmin.publicKey,
        "Pending owner should be set to new admin"
      );

      // Accept update of pool owner
      umi.use(keypairIdentity(newAdmin)); // Switch to new admin
      txBuilder = new TransactionBuilder();
      txBuilder = txBuilder.add(
        updatePoolOwner(umi, {
          poolManager,
          newOwner: umi.identity,
        })
      );
      await txBuilder.sendAndConfirm(umi);

      // Verify the new admin is set
      poolManagerAcc = await safeFetchPoolManager(umi, poolManager);

      assert.equal(
        poolManagerAcc.owner,
        newAdmin.publicKey,
        "owner should be updated to new owner"
      );
      assert.equal(
        poolManagerAcc.pendingOwner,
        publicKey("11111111111111111111111111111111"),
        "Pending owner should be set to default pubkey"
      );

      // Change back
      txBuilder = new TransactionBuilder();
      txBuilder = txBuilder.add(
        initiateUpdatePoolOwner(umi, {
          poolManager,
          newOwner: fromWeb3JsKeypair(keypair).publicKey,
          owner: umi.identity,
        })
      );
      await txBuilder.sendAndConfirm(umi);

      // Accept update back to original admin
      umi.use(keypairIdentity(fromWeb3JsKeypair(keypair))); // Switch to new admin

      txBuilder = new TransactionBuilder();
      txBuilder = txBuilder.add(
        updatePoolOwner(umi, {
          poolManager,
          newOwner: umi.identity,
        })
      );
      await txBuilder.sendAndConfirm(umi);

      // Verify the admin is set back to original
      poolManagerAcc = await safeFetchPoolManager(umi, poolManager);
      assert.equal(
        poolManagerAcc.admin,
        keypair.publicKey.toBase58(),
        "Admin should be reverted back to original admin"
      );
    });

    it.only("should update deposit cap parity staking", async () => {
      const notOwner = umi.eddsa.generateKeypair();
      const newDespositCap = testDepositCapAmount;

      await umi.rpc.airdrop(
        notOwner.publicKey,
        createAmount(100_000 * 10 ** 9, "SOL", 9),
        {
          commitment: "finalized",
        }
      );

      //Attempt trying to update deposit cap with a signer that's not the Owner
      umi.use(keypairIdentity(notOwner));

      let txBuilder = new TransactionBuilder();
      txBuilder = txBuilder.add(
        updatePoolManager(umi, {
          poolManager,
          owner: umi.identity,
          newAdmin: null,
          newDepositCap: newDespositCap,
        })
      );

      await assert.rejects(
        async () => {
          await txBuilder.sendAndConfirm(umi);
        },
        (err) => {
          return (err as Error).message.includes("Invalid owner");
        },
        "Expected updating pool manager to fail because of Invalid owner"
      );

      //Attempt trying to change update deposit cap with the right Owner

      umi.use(keypairIdentity(fromWeb3JsKeypair(keypair)));

      txBuilder = new TransactionBuilder();
      txBuilder = txBuilder.add(
        updatePoolManager(umi, {
          poolManager,
          owner: umi.identity,
          newAdmin: null,
          newDepositCap: newDespositCap,
        })
      );

      await txBuilder.sendAndConfirm(umi);

      //verify the updated deposit cap is set
      let poolManagerAcc = await safeFetchPoolManager(umi, poolManager);

      assert.equal(
        poolManagerAcc.depositCap,
        newDespositCap,
        "deposit cap should be updated "
      );

      let quantity = 1000 * 10 ** baseMintDecimals;

      //Attempt  staking to test if it works
      //This should work since deposit cap variable has been increased
      txBuilder = new TransactionBuilder();

      const userXAtaAcc = await safeFetchToken(umi, userX);

      if (!userXAtaAcc) {
        txBuilder = txBuilder.add(
          createAssociatedToken(umi, {
            mint: xMint,
          })
        );
      }

      txBuilder = txBuilder.add(
        stake(umi, {
          poolManager,
          baseMint,
          xMint,
          payerBaseMintAta: userBase,
          payerXMintAta: userX,
          vault: vaultStaking,
          associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
          quantity,
        })
      );

      await txBuilder.sendAndConfirm(umi);

      //Attempt to try and stake again which should fail because of deposit cap reached
      quantity = 1001 * 10 ** baseMintDecimals;

      txBuilder = new TransactionBuilder();

      txBuilder = txBuilder.add(
        stake(umi, {
          poolManager,
          baseMint,
          xMint,
          payerBaseMintAta: userBase,
          payerXMintAta: userX,
          vault: vaultStaking,
          associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
          quantity,
        })
      );

      await assert.rejects(
        async () => {
          await txBuilder.sendAndConfirm(umi);
        },
        (err) => {
          return (err as Error).message.includes("Deposit cap exceeded");
        },
        "Expected staking to fail because Deposit cap exceeded"
      );
    });

    it.only("should accept pool manager update", async () => {
      const newOwner = umi.eddsa.generateKeypair();
      const newAdmin = umi.eddsa.generateKeypair();

      await umi.rpc.airdrop(
        newAdmin.publicKey,
        createAmount(100_000 * 10 ** 9, "SOL", 9),
        {
          commitment: "finalized",
        }
      );

      await umi.rpc.airdrop(
        newOwner.publicKey,
        createAmount(100_000 * 10 ** 9, "SOL", 9),
        {
          commitment: "finalized",
        }
      );

      //Attempt trying to change pool manager with the wrong previous owner

      umi.use(keypairIdentity(newOwner));

      let txBuilder = new TransactionBuilder();
      txBuilder = txBuilder.add(
        updatePoolManager(umi, {
          poolManager,
          owner: umi.identity,
          newAdmin: newAdmin.publicKey,
          newDepositCap: null,
        })
      );

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
      txBuilder = txBuilder.add(
        updatePoolManager(umi, {
          poolManager,
          owner: umi.identity,
          newAdmin: newAdmin.publicKey,
          newDepositCap: null,
        })
      );

      await txBuilder.sendAndConfirm(umi);

      // Verify the new admin and owner is set
      let poolManagerAcc = await safeFetchPoolManager(umi, poolManager);

      assert.equal(
        poolManagerAcc.admin,
        newAdmin.publicKey,
        "admin should be updated to new admin"
      );

      // Change the owner and admin back
      umi.use(keypairIdentity(fromWeb3JsKeypair(keypair)));

      txBuilder = new TransactionBuilder();
      txBuilder = txBuilder.add(
        updatePoolManager(umi, {
          poolManager,
          owner: umi.identity,
          newAdmin: fromWeb3JsKeypair(keypair).publicKey,
          newDepositCap: null,
        })
      );

      await txBuilder.sendAndConfirm(umi);

      // Verify the owner and admin is set back to original
      poolManagerAcc = await safeFetchPoolManager(umi, poolManager);

      assert.equal(
        poolManagerAcc.admin,
        keypair.publicKey,
        "admin should be updated to new admin"
      );
    });

    it.only("should update xMint metadata of stake program", async () => {
      const name = "TEST";
      const symbol = "TEST";
      const uri = "https://example.com/new-xmint-info.json";

      let txBuilder = new TransactionBuilder();
      txBuilder = txBuilder.add(
        updateXmintMetadata(umi, {
          poolManager,
          metadataAccount: xMetadata,
          name,
          symbol,
          uri,
          owner: umi.identity,
        })
      );

      await txBuilder.sendAndConfirm(umi);

      const xMintMetadata = await safeFetchMetadata(umi, xMetadata);
      assert.equal(xMintMetadata.name, name, "Name should be updated");
      assert.equal(xMintMetadata.symbol, symbol, "Symbol should be updated");
      assert.equal(xMintMetadata.uri, uri, "Uri should be updated");
    });
  });
}