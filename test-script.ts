import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { createSplAssociatedTokenProgram, createSplTokenProgram } from "@metaplex-foundation/mpl-toolbox"
import { createSoldIssuanceProgram, createSoldStakingProgram, createTestQuote, setup, SetupOptions } from "./clients/js/src";
import { createAmount, keypairIdentity, publicKey } from "@metaplex-foundation/umi";

const exec = async () => {
    let umi = createUmi("http://localhost:8899");
    umi.programs.add(createSplAssociatedTokenProgram());
    umi.programs.add(createSplTokenProgram());
    umi.programs.add(createSoldIssuanceProgram())

    const keypair = umi.eddsa.createKeypairFromSecretKey(
        Uint8Array.from(require("./keys/test-kp.json"))
    );

    umi.use(keypairIdentity(keypair))

    await umi.rpc.airdrop(umi.identity.publicKey, createAmount(100_000 * 10 ** 9, "SOL", 9), { commitment: "finalized" })

    console.log("Received SOL airdrop");

    let setupOptions: SetupOptions = {
        baseMintName: "SOLD",
        baseMintSymbol: "SOLD",
        baseMintUri: "https://builderz.dev/_next/image?url=%2Fimages%2Fheader-gif.gif&w=3840&q=75",
        baseMintDecimals: 6,
        xMintDecimals: 6,
        quoteMint: null, // Update later
        exchangeRate: 1.0,
        stakingInitialExchangeRate: 1.0,
        emergencyFundBasisPoints: 100,
        mintLimitPerSlot: 1000,
        redemptionLimitPerSlot: 1000,
        allowList: []
    }

    const { mint, txBuilder } = await createTestQuote(umi, setupOptions.baseMintDecimals);

    const resCreateQuote = await txBuilder.sendAndConfirm(umi);

    console.log(resCreateQuote);

    setupOptions.quoteMint = mint.publicKey;

    console.log(setupOptions);

    const txBuilderSetup = await setup(umi, setupOptions)

    const resSetup = await txBuilderSetup.sendAndConfirm(umi);

    console.log(resSetup);
}

exec();