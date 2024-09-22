import { calculatePoints, initiateUpdateGlobalConfigOwner, initPtStake, ptStake, ptUnstake, safeFetchGlobalConfig, safeFetchUserStake, updateGlobalConfig, updateGlobalConfigOwner, withdrawExcessPt } from "../clients/js/src";
import { TestEnvironment } from "./setup-environment";
import assert from "assert";
import {
    keypairIdentity,
    Pda,
    PublicKey,
    publicKey,
    TransactionBuilder,
    createAmount,
} from "@metaplex-foundation/umi";
import {
    safeFetchToken,
    SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
    transferTokens
} from "@metaplex-foundation/mpl-toolbox";
import { fromWeb3JsKeypair } from "@metaplex-foundation/umi-web3js-adapters";

export async function runPtStakingTests(getEnv: () => TestEnvironment) {

    describe("Pt-staking Tests", function () {
        let umi, globalConfig, userStakePDA, userBase, vaultStakingPDA, baseMint, baseMintDecimals, baselineYieldBps, testDepositCapAmount, initialExchangeRatePtStaking, keypair

        before(function () {
            const env = getEnv();

            umi = env.umi;
            globalConfig = env.globalConfig;
            userStakePDA = env.userStakePDA;
            userBase = env.userBase;
            vaultStakingPDA = env.vaultStakingPDA;
            baseMint = env.baseMint;
            baseMintDecimals = env.baseMintDecimals;
            baselineYieldBps = env.baselineYieldBps;
            testDepositCapAmount = env.testDepositCapAmount;
            initialExchangeRatePtStaking = env.initialExchangeRatePtStaking
            keypair = env.keypair
        });

        it.only("Global Config is initialized", async () => {
            const globalConfigAcc = await safeFetchGlobalConfig(umi, globalConfig);

            assert.equal(
                globalConfigAcc.baseMint,
                baseMint[0],
                "Base mint mismatch: expected " + baseMint[0] + ", got " + globalConfigAcc.baseMint
            );

            assert.equal(
                globalConfigAcc.baseMintDecimals,
                baseMintDecimals,
                "Base mint decimals mismatch: expected " + baseMintDecimals + ", got " + globalConfigAcc.baseMintDecimals
            );

            assert.equal(
                globalConfigAcc.baseYieldHistory[0].baseYieldBps,
                baselineYieldBps,
                "Base yield mismatch: expected " + baselineYieldBps + ", got " + globalConfigAcc.baseYieldHistory[0].baseYieldBps
            );

            assert.equal(
                globalConfigAcc.admin,
                umi.identity.publicKey,
                "Admin mismatch: expected " + umi.identity.publicKey + ", got " + globalConfigAcc.admin
            );

            assert.equal(
                globalConfigAcc.depositCap,
                testDepositCapAmount,
                "Deposit cap mismatch: expected " + testDepositCapAmount + ", got " + globalConfigAcc.depositCap
            );

            assert.equal(
                globalConfigAcc.exchangeRateHistory[0].exchangeRate,
                initialExchangeRatePtStaking,
                "Initial exchange rate mismatch: expected " + initialExchangeRatePtStaking + ", got " + globalConfigAcc.exchangeRateHistory[0].exchangeRate
            );

            assert.equal(
                globalConfigAcc.stakedSupply,
                0,
                "Staked supply mismatch: expected 0, got " + globalConfigAcc.stakedSupply
            );
        });

        it.only("baseMint can be staked in PT Staking", async () => {
            let quantity = 1000 * 10 ** baseMintDecimals;

            // Attempt staking without creating the userStake acccount
            // This should fail
            let txBuilder = new TransactionBuilder();

            txBuilder = txBuilder.add(
                ptStake(umi, {
                    globalConfig,
                    userStake: userStakePDA,
                    baseMint: baseMint,
                    userBaseMintAta: userBase,
                    user: umi.identity,
                    vault: vaultStakingPDA,
                    associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
                    quantity: quantity,
                })
            );

            await assert.rejects(
                async () => {
                    await txBuilder.sendAndConfirm(umi);
                },
                (err) => {
                    return (err as Error).message.includes(
                        "The program expected this account to be already initialized."
                    );
                },
                "Expected staking to fail because account isnt initialized"
            );

            // Create userStake acccount
            txBuilder = new TransactionBuilder();

            txBuilder = txBuilder.add(
                initPtStake(umi, {
                    userStake: userStakePDA,
                    user: umi.identity,
                })
            );

            await txBuilder.sendAndConfirm(umi);

            const _userStakeAcc = await safeFetchUserStake(umi, userStakePDA);

            assert.equal(_userStakeAcc.userPubkey, umi.identity.publicKey);
            assert.equal(_userStakeAcc.stakedAmount, 0, "Staked amount should be zero");
            assert.equal(
                _userStakeAcc.initialStakingTimestamp,
                0,
                "initial staking time should be zero"
            );

            // Attempt staking after userStake acccount has been created
            // This should succeed
            txBuilder = new TransactionBuilder();

            txBuilder = txBuilder.add(
                ptStake(umi, {
                    globalConfig,
                    userStake: userStakePDA,
                    baseMint: baseMint,
                    userBaseMintAta: userBase,
                    user: umi.identity,
                    vault: vaultStakingPDA,
                    associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
                    quantity: quantity,
                })
            );

            await txBuilder.sendAndConfirm(umi);

            const globalConfigAcc = await safeFetchGlobalConfig(umi, globalConfig);
            const userStakeAcc = await safeFetchUserStake(umi, userStakePDA);
            const vaultAcc = await safeFetchToken(umi, vaultStakingPDA);

            // console.log("ptstaking last claim timestamp", userStakeAcc.lastClaimTimestamp);
            // console.log("Vault Acc: ", vaultAcc);
            // console.log("User Stake Acc: ", userStakeAcc);
            // console.log("Global Config Acc: ", globalConfigAcc);

            assert.equal(vaultAcc.amount, quantity);
            assert.equal(userStakeAcc.stakedAmount, quantity);
            assert.equal(globalConfigAcc.stakedSupply, quantity);
            assert.equal(globalConfigAcc.stakingVault, vaultAcc.publicKey);
        });

        it.only("baseMint can be unstaked in PT Staking", async () => {
            let quantity = 1000 * 10 ** baseMintDecimals;

            // Fetch accounts before unstaking
            const globalConfigAcc = await safeFetchGlobalConfig(umi, globalConfig);
            const userStakeAcc = await safeFetchUserStake(umi, userStakePDA);
            const vaultAcc = await safeFetchToken(umi, vaultStakingPDA);
            const userBaseAcc = await safeFetchToken(umi, userBase);

            let txBuilder = new TransactionBuilder();

            txBuilder = txBuilder.add(
                ptUnstake(umi, {
                    globalConfig,
                    userStake: userStakePDA,
                    baseMint: baseMint,
                    userBaseMintAta: userBase,
                    user: umi.identity,
                    vault: vaultStakingPDA,
                    associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
                    quantity,
                })
            );

            const res = await txBuilder.sendAndConfirm(umi);
            // console.log(bs58.encode(res.signature));

            // Fetch accounts after unstaking
            const _globalConfigAcc = await safeFetchGlobalConfig(umi, globalConfig);
            const _userStakeAcc = await safeFetchUserStake(umi, userStakePDA);
            const _vaultAcc = await safeFetchToken(umi, vaultStakingPDA);
            const _userBaseAcc = await safeFetchToken(umi, userBase);

            // console.log(_userStakeAcc);
            // console.log(_globalConfigAcc);

            const pointsHistory = _userStakeAcc.pointsHistory;

            // console.log("Points History: ", pointsHistory[0].points);
            // console.log("Points History full: ", pointsHistory);

            // We are using the updated lastclain timestamp as the current time 
            const expectedPoints = calculatePoints(
                _globalConfigAcc,
                BigInt(quantity),
                Number(userStakeAcc.lastClaimTimestamp),
                Number(_userStakeAcc.lastClaimTimestamp)
            );

            // console.log("expected points", expectedPoints[0].points)
            // console.log("expected points full", expectedPoints);

            // Assert the changes
            assert.equal(
                _vaultAcc.amount,
                vaultAcc.amount - BigInt(quantity),
                "Vault balance should decrease by unstaked amount"
            );
            assert.equal(
                _userStakeAcc.stakedAmount,
                userStakeAcc.stakedAmount - BigInt(quantity),
                "User staked amount should decrease"
            );
            assert.equal(
                _globalConfigAcc.stakedSupply,
                globalConfigAcc.stakedSupply - BigInt(quantity),
                "Global staked supply should decrease"
            );

            // Assert calculated points
            assert.equal(
                pointsHistory[0].points,
                expectedPoints[0].points,
                "Calculated points should match the points in history"
            );

            // Check if user received the unstaked tokens
            const expectedUserBalance = userBaseAcc.amount + BigInt(quantity);
            assert.equal(
                _userBaseAcc.amount,
                expectedUserBalance,
                "User should receive unstaked tokens"
            );

            // // TODO: Add assertions for points calculation if applicable
            // Check that the points were calculated within a single phase
            assert.equal(pointsHistory.length, 1, "Only one phase should be involved");
            assert.equal(
                pointsHistory[0].index,
                0,
                "The phase index should be 0 (initial phase)"
            );

            // Attempt unstaking with a user thats not the owner
            // which should fail
            const newUser = umi.eddsa.generateKeypair();

            await umi.rpc.airdrop(
                newUser.publicKey,
                createAmount(100_000 * 10 ** 9, "SOL", 9),
                {
                    commitment: "finalized",
                }
            );

            umi.use(keypairIdentity(newUser));

            txBuilder = new TransactionBuilder();

            txBuilder = txBuilder.add(
                ptUnstake(umi, {
                    globalConfig,
                    userStake: userStakePDA,
                    baseMint: baseMint,
                    userBaseMintAta: userBase,
                    user: umi.identity,
                    vault: vaultStakingPDA,
                    associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
                    quantity,
                })
            );

            await assert.rejects(
                async () => {
                    await txBuilder.sendAndConfirm(umi);
                },
                (err) => {
                    return (err as Error).message.includes(
                        " A seeds constraint was violated"
                    );
                },
                "Expected unstaking error as user isnt the owner of PDA"
            );

            umi.use(keypairIdentity(fromWeb3JsKeypair(keypair))); // Switch back to  admin
        });

        it("should initiate and accept global config owner update", async () => {
            const newOwner = umi.eddsa.generateKeypair();

            await umi.rpc.airdrop(
                newOwner.publicKey,
                createAmount(100_000 * 10 ** 9, "SOL", 9),
                {
                    commitment: "finalized",
                }
            );
            umi.use(keypairIdentity(fromWeb3JsKeypair(keypair))); // Switch to new admin

            // Initiate update of tokenManager owner
            let txBuilder = new TransactionBuilder();
            txBuilder = txBuilder.add(
                initiateUpdateGlobalConfigOwner(umi, {
                    globalConfig,
                    newOwner: newOwner.publicKey,
                    owner: umi.identity,
                })
            );
            await txBuilder.sendAndConfirm(umi);

            // Check if the update initiation was successful
            let globalConfigAcc = await safeFetchGlobalConfig(umi, globalConfig);

            assert.equal(
                globalConfigAcc.pendingOwner,
                newOwner.publicKey,
                "Pending owner should be set to new admin"
            );

            // Accept update of manager owner
            umi.use(keypairIdentity(newOwner)); // Switch to new admin
            txBuilder = new TransactionBuilder();
            txBuilder = txBuilder.add(
                updateGlobalConfigOwner(umi, {
                    globalConfig,
                    newOwner: umi.identity,
                })
            );
            await txBuilder.sendAndConfirm(umi);

            // Verify the new owner is set
            globalConfigAcc = await safeFetchGlobalConfig(umi, globalConfig);
            assert.equal(
                globalConfigAcc.owner,
                newOwner.publicKey,
                "owner should be updated to new owner"
            );
            assert.equal(
                globalConfigAcc.pendingOwner,
                publicKey("11111111111111111111111111111111"),
                "Pending owner should be set to default pubkey"
            );

            // Change back
            txBuilder = new TransactionBuilder();
            txBuilder = txBuilder.add(
                initiateUpdateGlobalConfigOwner(umi, {
                    globalConfig,
                    newOwner: fromWeb3JsKeypair(keypair).publicKey,
                    owner: umi.identity,
                })
            );
            await txBuilder.sendAndConfirm(umi);

            // Accept update back to original admin
            umi.use(keypairIdentity(fromWeb3JsKeypair(keypair))); // Switch back to original admin
            txBuilder = new TransactionBuilder();
            txBuilder = txBuilder.add(
                updateGlobalConfigOwner(umi, {
                    globalConfig,
                    newOwner: umi.identity,
                })
            );
            await txBuilder.sendAndConfirm(umi);

            // Verify the admin is set back to original
            globalConfigAcc = await safeFetchGlobalConfig(umi, globalConfig);
            assert.equal(
                globalConfigAcc.admin,
                publicKey(keypair.publicKey),
                "Admin should be reverted back to original admin"
            );
        });

        it("should update Pt Staking global config", async () => {
            const notOwner = umi.eddsa.generateKeypair();
            const newBaselineYield = 5000; // For 50%
            const newExchangeRatePtStaking = 30 * 10 ** baseMintDecimals;
            const newDespositCap = testDepositCapAmount;

            await umi.rpc.airdrop(
                notOwner.publicKey,
                createAmount(100_000 * 10 ** 9, "SOL", 9),
                {
                    commitment: "finalized",
                }
            );

            // Attempt trying to update with a signer that's not the Owner
            umi.use(keypairIdentity(notOwner));

            let txBuilder = new TransactionBuilder();
            txBuilder = txBuilder.add(
                updateGlobalConfig(umi, {
                    globalConfig,
                    owner: umi.identity,
                    newBaselineYieldBps: newBaselineYield,
                    newExchangeRate: newExchangeRatePtStaking,
                    newDepositCap: newDespositCap,
                    vault: vaultStakingPDA,
                })
            );

            await assert.rejects(
                async () => {
                    await txBuilder.sendAndConfirm(umi);
                },
                (err) => {
                    return (err as Error).message.includes("Invalid owner");
                },
                "Expected updating global config to fail because of Invalid owner"
            );

            // Attempt trying to change update  with the right Owner
            umi.use(keypairIdentity(fromWeb3JsKeypair(keypair)));

            txBuilder = new TransactionBuilder();
            txBuilder = txBuilder.add(
                updateGlobalConfig(umi, {
                    globalConfig,
                    owner: umi.identity,
                    newBaselineYieldBps: newBaselineYield,
                    newExchangeRate: newExchangeRatePtStaking,
                    newDepositCap: newDespositCap,
                    vault: vaultStakingPDA,
                })
            );

            const res = await txBuilder.sendAndConfirm(umi);
            // console.log(bs58.encode(res.signature));

            // Verify the updated global config is set
            const globalConfigAcc = await safeFetchGlobalConfig(umi, globalConfig);

            assert.equal(
                globalConfigAcc.baseYieldHistory[globalConfigAcc.baseYieldHistory.length - 1].baseYieldBps,
                newBaselineYield,
                "base line yield should be updated"
            );
            assert.equal(
                globalConfigAcc.depositCap,
                newDespositCap,
                "deposit cap should be updated"
            );
            assert.equal(
                globalConfigAcc.exchangeRateHistory[globalConfigAcc.exchangeRateHistory.length - 1].exchangeRate,
                newExchangeRatePtStaking,
                "exchange rate should be updated"
            );

            let quantity = 1000 * 10 ** baseMintDecimals;

            // Attempt  staking to test if deposit cap works
            // This should work since deposit cap variable has been increased
            txBuilder = new TransactionBuilder();

            txBuilder = txBuilder.add(
                ptStake(umi, {
                    globalConfig,
                    userStake: userStakePDA,
                    baseMint: baseMint,
                    userBaseMintAta: userBase,
                    user: umi.identity,
                    vault: vaultStakingPDA,
                    associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
                    quantity: quantity,
                })
            );

            await txBuilder.sendAndConfirm(umi);

            //Attempt to try and stake again which should fail because of deposit cap reached
            quantity = 1001 * 10 ** baseMintDecimals;

            txBuilder = new TransactionBuilder();

            txBuilder = txBuilder.add(
                ptStake(umi, {
                    globalConfig,
                    userStake: userStakePDA,
                    baseMint: baseMint,
                    userBaseMintAta: userBase,
                    user: umi.identity,
                    vault: vaultStakingPDA,
                    associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
                    quantity: quantity,
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

        it("dynamically increases account size for exchange rate and points history, and verifies PT staking reallocation", async () => {
            const maxPhases = 5;
            let quantity = 100 * 10 ** baseMintDecimals;

            let globalConfigAcc = await safeFetchGlobalConfig(umi, globalConfig);

            // We first of all increase the deposit cap
            let newDepositCap = testDepositCapAmount * 100;
            let txBuilder = new TransactionBuilder();
            txBuilder = txBuilder.add(
                updateGlobalConfig(umi, {
                    globalConfig,
                    owner: umi.identity,
                    newBaselineYieldBps: null,
                    newExchangeRate: null,
                    newDepositCap: newDepositCap,
                    vault: vaultStakingPDA,
                })
            );

            await txBuilder.sendAndConfirm(umi);

            // Stake amount
            txBuilder = new TransactionBuilder();
            txBuilder = txBuilder.add(
                ptStake(umi, {
                    globalConfig,
                    userStake: userStakePDA,
                    baseMint: baseMint,
                    userBaseMintAta: userBase,
                    user: umi.identity,
                    vault: vaultStakingPDA,
                    associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
                    quantity: quantity,
                })
            );

            await txBuilder.sendAndConfirm(umi);

            let preUserStakeAcc = await safeFetchUserStake(umi, userStakePDA);

            // const _globalConfigAcc = await safeFetchGlobalConfig(umi, globalConfig);
            // const _globalUserStake = await safeFetchUserStake(umi, userStakePDA);
            // console.log("Original global points:", _globalConfigAcc.pointsHistory);
            // console.log("Original global user points:", _globalUserStake.pointsHistory);

            // Function to create a new exchange rate phase
            const createExchangeRatePhase = (index: number) =>
                (20 - index) * 10 ** baseMintDecimals; // Increase exchange rate each time

            // Function to create a new baseline yield rate
            const createBaselineYieldRate = (index: number) => {
                const baseRate = 2000; // 20% as basis points
                const increment = 300; // 3% increment as basis points
                return baseRate + (index * increment);
            };

            // Add phases 
            for (let i = globalConfigAcc.exchangeRateHistory.length; i < maxPhases; i++) {
                const newExchangeRate = createExchangeRatePhase(i);
                const newBaselineYieldBps = createBaselineYieldRate(i);

                // Update global config (exchange rate)
                let updateConfigTxBuilder = new TransactionBuilder();
                updateConfigTxBuilder = updateConfigTxBuilder.add(
                    updateGlobalConfig(umi, {
                        globalConfig,
                        owner: umi.identity,
                        newBaselineYieldBps: newBaselineYieldBps,
                        newExchangeRate: newExchangeRate,
                        newDepositCap: null,
                        vault: vaultStakingPDA,
                    })
                );
                await updateConfigTxBuilder.sendAndConfirm(umi);

                // Add a delay to ensure clock advances
                await new Promise((resolve) => setTimeout(resolve, 10000));

                // Fetch and log global config after update
                globalConfigAcc = await safeFetchGlobalConfig(umi, globalConfig);

                console.log(
                    `Phase ${i} added. Current exchange rate history size:`,
                    globalConfigAcc.exchangeRateHistory.length
                );
                // console.log("Last exchange rate phase:", globalConfigAcc.exchangeRateHistory[i]);
                // console.log("Last base yield phase:", globalConfigAcc.baseYieldHistory[globalConfigAcc.baseYieldHistory.length - 1]);

                // Add another delay after staking
                await new Promise((resolve) => setTimeout(resolve, 10000));

                // Assertions
                assert.strictEqual(globalConfigAcc.exchangeRateHistory.length - 1, i);
                assert.strictEqual(
                    Number(globalConfigAcc.exchangeRateHistory[i].exchangeRate),
                    newExchangeRate
                );

                assert.strictEqual(Number(globalConfigAcc.baseYieldHistory[globalConfigAcc.baseYieldHistory.length - 1].baseYieldBps), newBaselineYieldBps);
            }

            // Confirmation
            let postGlobalConfigAcc = await safeFetchGlobalConfig(umi, globalConfig);
            // console.log("post global points:", postGlobalConfigAcc.pointsHistory.sort((a, b) => a.index - b.index));
            let postUserStakeAcc = await safeFetchUserStake(umi, userStakePDA);
            // console.log("post user points:", postUserStakeAcc.pointsHistory.sort((a, b) => a.index - b.index));

            const points = calculatePoints(
                postGlobalConfigAcc,
                postUserStakeAcc.stakedAmount,
                Number(postUserStakeAcc.lastClaimTimestamp),
                Math.round(Date.now() / 1000)
            );

            console.log("Points calculated:", points);

            // Create arrays with expected global and user points
            const expectedGlobalPoints = [...postGlobalConfigAcc.pointsHistory, ...points].reduce((acc, phase) => {
                const existingPhase = acc.find(p => p.index === phase.index);
                if (existingPhase) {
                    existingPhase.points += phase.points;
                } else {
                    acc.push({ ...phase });
                }
                return acc;
            }, []).sort((a, b) => a.index - b.index);

            const expectedUserPoints = [...postUserStakeAcc.pointsHistory, ...points].reduce((acc, phase) => {
                const existingPhase = acc.find(p => p.index === phase.index);
                if (existingPhase) {
                    existingPhase.points += phase.points;
                } else {
                    acc.push({ ...phase });
                }
                return acc;
            }, []).sort((a, b) => a.index - b.index);

            console.log("Expected Global Points:", expectedGlobalPoints);
            console.log("Expected User Points:", expectedUserPoints);

            // Perform unstaking
            txBuilder = new TransactionBuilder();
            txBuilder = txBuilder.add(
                ptUnstake(umi, {
                    globalConfig,
                    userStake: userStakePDA,
                    baseMint: baseMint,
                    userBaseMintAta: userBase,
                    user: umi.identity,
                    vault: vaultStakingPDA,
                    associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
                    quantity: quantity,
                })
            );
            await txBuilder.sendAndConfirm(umi);

            // Final checks
            const finalGlobalConfigAcc = await safeFetchGlobalConfig(umi, globalConfig);
            const finalUserStakeAcc = await safeFetchUserStake(umi, userStakePDA);

            console.log("Final global points", finalGlobalConfigAcc.pointsHistory);
            console.log("Final user stake acc", finalUserStakeAcc.pointsHistory);
            // Compare expected points with actual points
            expectedGlobalPoints.forEach((phase, index) => {
                const actualPhasePoints = finalGlobalConfigAcc.pointsHistory.find(p => p.index === phase.index).points

                assert.ok(
                    BigInt(phase.points) === actualPhasePoints,
                    `Global points mismatch at index ${index}. Expected: ${phase.points}, Actual: ${actualPhasePoints}`
                );
            });

            expectedUserPoints.forEach((phase, index) => {
                const actualPhasePoints = finalUserStakeAcc.pointsHistory.find(p => p.index === phase.index).points

                assert.ok(
                    BigInt(phase.points) === actualPhasePoints,
                    `User points mismatch at index ${index}. Expected: ${phase.points}, Actual: ${actualPhasePoints}`
                );
            });

            // console.log(
            //   "Final exchange rate history:",
            //   finalGlobalConfigAcc.exchangeRateHistory.map((phase, index) => {
            //     const timeElapsed = unwrapOption(phase.endDate) ? unwrapOption(phase.endDate) - phase.startDate : 0;
            //     return {
            //       ...phase,
            //       index,
            //       timeElapsed,
            //     };
            //   })
            // );
            // console.log("Final points history user:", finalUserStakeAcc.pointsHistory.sort((a, b) => a.index - b.index));
            // console.log("Final points history global:", finalGlobalConfigAcc.pointsHistory.sort((a, b) => a.index - b.index));
        });

        it("should handle multiple deposits in PT Staking and multiple exchange rates, confirming recent claims", async () => {
            const initialDeposit = 1000 * 10 ** baseMintDecimals;
            const smallDeposit = 1 * 10 ** baseMintDecimals;
            const delay = 1000; // 10 seconds delay

            let previousStakeTimestamp: number;
            let finalDepositTimestamp: number;

            // Create userStake acccount
            let txBuilder = new TransactionBuilder();

            txBuilder = txBuilder.add(
                initPtStake(umi, {
                    userStake: userStakePDA,
                    user: umi.identity,
                })
            );

            await txBuilder.sendAndConfirm(umi);

            // Increase the deposit cap
            let newDepositCap = testDepositCapAmount * 100;
            txBuilder = new TransactionBuilder();
            txBuilder = txBuilder.add(
                updateGlobalConfig(umi, {
                    globalConfig,
                    owner: umi.identity,
                    newBaselineYieldBps: null,
                    newExchangeRate: null,
                    newDepositCap: newDepositCap,
                    vault: vaultStakingPDA,
                })
            );
            await txBuilder.sendAndConfirm(umi);

            // Initial deposit
            txBuilder = new TransactionBuilder();
            txBuilder = txBuilder.add(
                ptStake(umi, {
                    globalConfig,
                    userStake: userStakePDA,
                    baseMint: baseMint,
                    userBaseMintAta: userBase,
                    user: umi.identity,
                    vault: vaultStakingPDA,
                    associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
                    quantity: initialDeposit,
                })
            );
            await txBuilder.sendAndConfirm(umi);

            let userStakeAcc = await safeFetchUserStake(umi, userStakePDA);
            previousStakeTimestamp = Number(userStakeAcc.lastClaimTimestamp);
            // console.log("Initial stake timestamp:", previousStakeTimestamp);

            // Function to update exchange rate and perform a small deposit
            const updateRateAndDeposit = async (newRate: number) => {
                // Update exchange rate
                let updateTxBuilder = new TransactionBuilder();
                updateTxBuilder = updateTxBuilder.add(
                    updateGlobalConfig(umi, {
                        globalConfig,
                        owner: umi.identity,
                        newBaselineYieldBps: null,
                        newExchangeRate: newRate,
                        newDepositCap: null,
                        vault: vaultStakingPDA,
                    })
                );
                await updateTxBuilder.sendAndConfirm(umi);

                // Perform small deposit
                let stakeTxBuilder = new TransactionBuilder();
                stakeTxBuilder = stakeTxBuilder.add(
                    ptStake(umi, {
                        globalConfig,
                        userStake: userStakePDA,
                        baseMint: baseMint,
                        userBaseMintAta: userBase,
                        user: umi.identity,
                        vault: vaultStakingPDA,
                        associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
                        quantity: smallDeposit,
                    })
                );
                await stakeTxBuilder.sendAndConfirm(umi);
            };

            // Perform multiple small deposits with delays and rate changes
            const newRates = [25 * 10 ** baseMintDecimals, 30 * 10 ** baseMintDecimals, 35 * 10 ** baseMintDecimals];
            for (let i = 0; i < 3; i++) {
                await new Promise(resolve => setTimeout(resolve, delay));
                await updateRateAndDeposit(newRates[i]);
                userStakeAcc = await safeFetchUserStake(umi, userStakePDA);
                finalDepositTimestamp = Number(userStakeAcc.lastClaimTimestamp);
                console.log(`Deposit ${i + 1} timestamp:`, finalDepositTimestamp);

                if (i < 2) {
                    previousStakeTimestamp = finalDepositTimestamp;
                }
            }

            // Final check after deposits
            userStakeAcc = await safeFetchUserStake(umi, userStakePDA);
            console.log("Previous stake timestamp:", previousStakeTimestamp);
            console.log("Final deposit timestamp:", finalDepositTimestamp);

            // Calculate expected staked amount
            const expectedStakedAmount = BigInt(initialDeposit) + BigInt(smallDeposit) * 3n;
            assert.equal(userStakeAcc.stakedAmount, expectedStakedAmount, "Staked amount should match total deposits");

            // Verify points calculation
            const globalConfigAcc = await safeFetchGlobalConfig(umi, globalConfig);
            const points = calculatePoints(
                globalConfigAcc,
                expectedStakedAmount,
                previousStakeTimestamp,
                finalDepositTimestamp
            );

            console.log("Calculated points:", points);
            console.log("User stake points history:", userStakeAcc.pointsHistory);

            // Check if the points in history match the calculated points
            if (userStakeAcc.pointsHistory.length > 0) {
                const lastPointsEntry = userStakeAcc.pointsHistory[userStakeAcc.pointsHistory.length - 1];
                const calculatedLastPointsEntry = points[points.length - 1];
                const difference = Math.abs(Number(lastPointsEntry.points) - Number(calculatedLastPointsEntry.points));
                const tolerance = Math.max(1, Math.floor(Number(calculatedLastPointsEntry.points) * 0.01)); // 1% tolerance or at least 1 point
                assert.ok(
                    difference <= tolerance,
                    `Last points entry (${lastPointsEntry.points}) should be close to calculated points (${calculatedLastPointsEntry.points}). Difference: ${difference}, Tolerance: ${tolerance}`
                );
            }

            // Assert that we have multiple phases in the points history
            assert.ok(
                userStakeAcc.pointsHistory.length > 1,
                "There should be multiple phases in the points history"
            );

            // Assert that the exchange rates in the points history match the ones we set
            const expectedRates = [20 * 10 ** baseMintDecimals, ...newRates]; // Include initial rate
            for (let i = 0; i < userStakeAcc.pointsHistory.length; i++) {
                assert.equal(
                    userStakeAcc.pointsHistory[i].exchangeRate,
                    BigInt(expectedRates[i]),
                    `Exchange rate for phase ${i} should match the set rate`
                );
            }
        });

        it("should handle multiple deposits in PT Staking, with a single exchange rate", async () => {
            const initialDeposit = 1000 * 10 ** baseMintDecimals;
            const smallDeposit = 1 * 10 ** baseMintDecimals;
            const delay = 1000; // 10 seconds delay

            let previousStakeTimestamp: number;
            let finalDepositTimestamp: number;

            // Create userStake acccount
            let txBuilder = new TransactionBuilder();

            txBuilder = txBuilder.add(
                initPtStake(umi, {
                    userStake: userStakePDA,
                    user: umi.identity,
                })
            );

            await txBuilder.sendAndConfirm(umi);

            // Increase the deposit cap
            let newDepositCap = testDepositCapAmount * 100;
            txBuilder = new TransactionBuilder();
            txBuilder = txBuilder.add(
                updateGlobalConfig(umi, {
                    globalConfig,
                    owner: umi.identity,
                    newBaselineYieldBps: null,
                    newExchangeRate: null,
                    newDepositCap: newDepositCap,
                    vault: vaultStakingPDA,
                })
            );
            await txBuilder.sendAndConfirm(umi);

            // Get initial exchange rate
            let globalConfigAcc = await safeFetchGlobalConfig(umi, globalConfig);
            const exchangeRate = globalConfigAcc.exchangeRateHistory[0].exchangeRate;

            // Initial deposit
            txBuilder = new TransactionBuilder();
            txBuilder = txBuilder.add(
                ptStake(umi, {
                    globalConfig,
                    userStake: userStakePDA,
                    baseMint: baseMint,
                    userBaseMintAta: userBase,
                    user: umi.identity,
                    vault: vaultStakingPDA,
                    associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
                    quantity: initialDeposit,
                })
            );
            await txBuilder.sendAndConfirm(umi);

            let userStakeAcc = await safeFetchUserStake(umi, userStakePDA);
            previousStakeTimestamp = Number(userStakeAcc.lastClaimTimestamp);
            // console.log("Initial stake timestamp:", previousStakeTimestamp);

            // Function to perform a small deposit
            const performSmallDeposit = async () => {
                let stakeTxBuilder = new TransactionBuilder();
                stakeTxBuilder = stakeTxBuilder.add(
                    ptStake(umi, {
                        globalConfig,
                        userStake: userStakePDA,
                        baseMint: baseMint,
                        userBaseMintAta: userBase,
                        user: umi.identity,
                        vault: vaultStakingPDA,
                        associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
                        quantity: smallDeposit,
                    })
                );
                await stakeTxBuilder.sendAndConfirm(umi);
            };

            // Perform multiple small deposits with delays
            for (let i = 0; i < 3; i++) {
                await new Promise(resolve => setTimeout(resolve, delay));
                await performSmallDeposit();
                userStakeAcc = await safeFetchUserStake(umi, userStakePDA);
                finalDepositTimestamp = Number(userStakeAcc.lastClaimTimestamp);
                console.log(`Deposit ${i + 1} timestamp:`, finalDepositTimestamp);
            }

            // Final check after deposits
            userStakeAcc = await safeFetchUserStake(umi, userStakePDA);
            console.log("Previous stake timestamp:", previousStakeTimestamp);
            console.log("Final deposit timestamp:", finalDepositTimestamp);

            // Calculate expected staked amount
            const expectedStakedAmount = BigInt(initialDeposit) + BigInt(smallDeposit) * 3n;
            assert.equal(userStakeAcc.stakedAmount, expectedStakedAmount, "Staked amount should match total deposits");

            // Verify points calculation
            globalConfigAcc = await safeFetchGlobalConfig(umi, globalConfig);

            const points = calculatePoints(
                globalConfigAcc,
                expectedStakedAmount,
                previousStakeTimestamp,
                finalDepositTimestamp
            );

            console.log("Calculated points:", points);
            console.log("User stake points history:", userStakeAcc.pointsHistory);

            // Assert that we only have one phase in the points history
            assert.equal(
                userStakeAcc.pointsHistory.length,
                1,
                "There should be only one phase in the points history"
            );

            // Check if the points in history match the calculated points
            const pointsEntry = userStakeAcc.pointsHistory[0];
            const calculatedPoints = points[0].points;
            const difference = Math.abs(Number(pointsEntry.points) - Number(calculatedPoints));
            const tolerance = Math.max(1, Math.floor(Number(calculatedPoints) * 0.01)); // 1% tolerance or at least 1 point

            assert.ok(
                difference <= tolerance,
                `Points entry (${pointsEntry.points}) should be close to calculated points (${calculatedPoints}). Difference: ${difference}, Tolerance: ${tolerance}`
            );

            // Assert that the exchange rate in the points history matches the initial rate
            assert.equal(
                pointsEntry.exchangeRate,
                exchangeRate,
                "Exchange rate in points history should match the initial rate"
            );
        });

        it.only("should allow admin to withdraw excess tokens in PT Staking", async () => {
            // Stake tokens
            const stakeAmount = 1000 * 10 ** baseMintDecimals;

            let txBuilder = new TransactionBuilder();
            txBuilder = txBuilder.add(
                ptStake(umi, {
                    globalConfig,
                    userStake: userStakePDA,
                    baseMint: baseMint,
                    userBaseMintAta: userBase,
                    user: umi.identity,
                    vault: vaultStakingPDA,
                    associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
                    quantity: stakeAmount,
                })
            );

            await txBuilder.sendAndConfirm(umi);

            const userBaseAtaAccBeforeTransfer = await safeFetchToken(umi, userBase);
            // Deposit extra tokens into the vault account
            const extraTokens = 500 * 10 ** baseMintDecimals;

            // Transfer transaction to deposit extra tokens into the vault
            const res = await transferTokens(umi, {
                source: userBase,
                destination: vaultStakingPDA,
                amount: extraTokens
            }).sendAndConfirm(umi);

            const userBaseAtaAccAfterTransfer = await safeFetchToken(umi, userBase);

            // Withdraw excess tokens
            let withdrawTxBuilder = new TransactionBuilder();
            withdrawTxBuilder = withdrawTxBuilder.add(
                withdrawExcessPt(umi, {
                    globalConfig,
                    adminBaseMintAta: userBase,
                    baseMint,
                    admin: umi.identity,
                    vault: vaultStakingPDA,
                    associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
                })
            );

            await withdrawTxBuilder.sendAndConfirm(umi);

            // Assertions
            const updatedVaultAcc = await safeFetchToken(umi, vaultStakingPDA);
            const updatedGlobalConfigAcc = await safeFetchGlobalConfig(umi, globalConfig);

            // Calculate expected vault amount after withdrawal
            const expectedVaultAmount = stakeAmount; 

            // Assert that the vault amount is now equal to the expected amount
            assert.equal(updatedVaultAcc.amount, expectedVaultAmount, "Vault amount should be updated correctly");
            assert.equal(updatedGlobalConfigAcc.stakedSupply, expectedVaultAmount, "Staked supply should be updated correctly");
            assert.equal(userBaseAtaAccBeforeTransfer.amount, Number(userBaseAtaAccAfterTransfer.amount) + extraTokens, "User Base balance should be updated correctly");
        });

    })

}