import { publicKey, TransactionBuilder, Umi } from "@metaplex-foundation/umi";
import { findMetadataPda } from "@metaplex-foundation/mpl-token-metadata";
import { findAssociatedTokenPda, SPL_ASSOCIATED_TOKEN_PROGRAM_ID } from "@metaplex-foundation/mpl-toolbox"
import { findPoolManagerPda, findTokenManagerPda, initializePoolManager, initializeTokenManager, SOLD_ISSUANCE_PROGRAM_ID, SOLD_STAKING_PROGRAM_ID } from "../generated";
import { getMerkleRoot } from "../utils";

export type SetupOptions = {
    baseMintDecimals: number,
    baseMintSymbol: string,
    baseMintName: string,
    baseMintUri: string,
    quoteMint: string,
    exchangeRate: number,
    stakingInitialExchangeRate: number,
    emergencyFundBasisPoints: number,
    xMintDecimals: number,
    mintLimitPerSlot: number,
    redemptionLimitPerSlot: number,
    allowList: string[],
    withdrawExecutionWindow: number,
    withdrawTimeLock: number
}

export async function setup(umi: Umi, setupOptions: SetupOptions) {
    const baseMint = umi.eddsa.findPda(SOLD_ISSUANCE_PROGRAM_ID, [Buffer.from("mint")])[0]
    const xMint = umi.eddsa.findPda(SOLD_STAKING_PROGRAM_ID, [Buffer.from("mint")])[0];

    const tokenManager = findTokenManagerPda(umi)[0];
    const poolManager = findPoolManagerPda(umi)[0];

    const vaultIssuance = findAssociatedTokenPda(umi, { owner: tokenManager, mint: publicKey(setupOptions.quoteMint) });
    const vaultStaking = findAssociatedTokenPda(umi, { owner: poolManager, mint: baseMint })

    const baseMetadata = findMetadataPda(umi, { mint: baseMint })
    const xMetadata = findMetadataPda(umi, { mint: xMint })

    // Check
    setupOptions.allowList.forEach((address) => {
        try {
            return publicKey(address);
        } catch (error) {
            throw new Error(`Invalid public key in allowList: ${address}`);
        }
    });

    const merkleRoot = getMerkleRoot(setupOptions.allowList);

    let txBuilder = new TransactionBuilder();

    txBuilder = txBuilder.add(initializeTokenManager(umi, {
        tokenManager,
        owner: umi.identity,
        vault: vaultIssuance,
        metadata: baseMetadata,
        mint: baseMint,
        quoteMint: publicKey(setupOptions.quoteMint),
        associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
        name: setupOptions.baseMintName,
        symbol: setupOptions.baseMintSymbol,
        uri: setupOptions.baseMintUri,
        decimals: setupOptions.baseMintDecimals,
        exchangeRate: setupOptions.exchangeRate,
        emergencyFundBasisPoints: setupOptions.emergencyFundBasisPoints,
        merkleRoot,
        admin: umi.identity.publicKey,
        minter: poolManager,
        gateKeepers: [],
        mintLimitPerSlot: setupOptions.mintLimitPerSlot,
        redemptionLimitPerSlot: setupOptions.redemptionLimitPerSlot,
        withdrawExecutionWindow: setupOptions.withdrawExecutionWindow,
        withdrawTimeLock: setupOptions.withdrawTimeLock
    })).add(initializePoolManager(umi, {
        poolManager,
        vault: vaultStaking,
        metadata: xMetadata,
        baseMint,
        xMint,
        associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
        name: "xSOLD",
        symbol: "xSOLD",
        uri: "https://builderz.dev/_next/image?url=%2Fimages%2Fheader-gif.gif&w=3840&q=75",
        decimals: setupOptions.xMintDecimals,
        initialExchangeRate: setupOptions.stakingInitialExchangeRate,
        owner: umi.identity,
        admin: umi.identity.publicKey,
    }));

    return txBuilder;
}