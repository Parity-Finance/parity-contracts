import { InstructionWithEphemeralSigners, PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import { Umi, publicKey } from "@metaplex-foundation/umi";
import { toWeb3JsInstruction } from "@metaplex-foundation/umi-web3js-adapters";
import { PublicKey } from "@solana/web3.js";
import { mint, MintInstructionAccounts, MintInstructionArgs } from "../generated";

export const fetchPriceUpdates = async (): Promise<string[]> => {
    const priceServiceConnection = new PriceServiceConnection(
        "https://hermes.pyth.network/",
        { priceFeedRequestConfig: { binary: true } }
    );

    const priceUpdateData: string[] = await priceServiceConnection.getLatestVaas([
        "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
    ]);

    return priceUpdateData;
};

export const sendMintTx = async (
    pythSolanaReceiver: PythSolanaReceiver,
    umi: Umi,
    instructionFields: Omit<MintInstructionAccounts & MintInstructionArgs, 'priceUpdate'>
): Promise<string[]> => {
    const priceUpdateData = await fetchPriceUpdates();

    // Set closeUpdateAccounts: true if you want to delete the price update account at
    // the end of the transaction to reclaim rent.
    const transactionBuilder = pythSolanaReceiver.newTransactionBuilder({
        closeUpdateAccounts: false,
    });
    await transactionBuilder.addPostPriceUpdates([priceUpdateData[0]]);

    // Use this function to add your application-specific instructions to the builder
    await transactionBuilder.addPriceConsumerInstructions(
        async (
            getPriceUpdateAccount: (priceFeedId: string) => any
        ): Promise<InstructionWithEphemeralSigners[]> => {
            // Generate instructions here that use the price updates posted above.
            // getPriceUpdateAccount(<price feed id>) will give you the account for each price update.
            const priceUpdateAccount: PublicKey = getPriceUpdateAccount("0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a");
            console.log("priceUpdateAccount", priceUpdateAccount.toBase58());

            const txBuilder = mint(umi, {
                ...instructionFields,
                priceUpdate: publicKey(priceUpdateAccount)
            })

            const ix = txBuilder.getInstructions()[0]

            const web3JsIx = toWeb3JsInstruction(ix)

            return [{
                instruction: web3JsIx,
                signers: [],
                computeUnits: 50000
            }];
        }
    );

    // Send the instructions in the builder in 1 or more transactions.
    // The builder will pack the instructions into transactions automatically.
    const sigs = await pythSolanaReceiver.provider.sendAll(
        await transactionBuilder.buildVersionedTransactions({
            computeUnitPriceMicroLamports: 50000,
        }),
        { skipPreflight: false, preflightCommitment: "processed" }
    );

    // const txs = await transactionBuilder.buildVersionedTransactions({
    //     computeUnitPriceMicroLamports: 50000,
    // });

    return sigs
};