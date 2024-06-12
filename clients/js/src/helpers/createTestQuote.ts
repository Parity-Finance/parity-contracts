import { generateSigner, TransactionBuilder, Umi } from "@metaplex-foundation/umi";
import { createAssociatedToken, createMint, findAssociatedTokenPda, mintTokensToChecked } from "@metaplex-foundation/mpl-toolbox"

export async function createTestQuote(umi: Umi, decimals: number) {
    const mint = generateSigner(umi);
    const token = findAssociatedTokenPda(umi, { mint: mint.publicKey, owner: umi.identity.publicKey })

    let txBuilder = new TransactionBuilder();

    txBuilder = txBuilder.add(
        createMint(umi, {
            mint,
            mintAuthority: umi.identity.publicKey,
            decimals,
        }).add(
            createAssociatedToken(umi, {
                mint: mint.publicKey
            })
        ).add(
            mintTokensToChecked(umi, {
                mint: mint.publicKey,
                amount: 100_000_000 * 10 ** decimals,
                token,
                mintAuthority: umi.identity,
                decimals,
            })
        )
    )

    return { mint, txBuilder };
}