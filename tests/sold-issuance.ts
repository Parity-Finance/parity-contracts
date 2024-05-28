import { keypairIdentity, Pda, PublicKey, publicKey, TransactionBuilder, createAmount } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { createAssociatedToken, createSplAssociatedTokenProgram, createSplTokenProgram, findAssociatedTokenPda, safeFetchToken, SPL_ASSOCIATED_TOKEN_PROGRAM_ID } from "@metaplex-foundation/mpl-toolbox"
import { Connection, Keypair, PublicKey as Web3JsPublicKey } from "@solana/web3.js";
import { createSoldIssuanceProgram, findTokenManagerPda, initialize, SOLD_ISSUANCE_PROGRAM_ID, mint, redeem, safeFetchTokenManager } from "../clients/js/src"
import { ASSOCIATED_TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { fromWeb3JsKeypair, fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { findMetadataPda } from "@metaplex-foundation/mpl-token-metadata";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

describe("sold-contract", () => {
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

  // USDC Mint and ATAs
  let usdcMint: PublicKey
  let userUSDC: PublicKey
  let vault: Pda

  let tokenManager: Pda

  const usdcDecimal = 6;

  before(async () => {
    try {
      await umi.rpc.airdrop(umi.identity.publicKey, createAmount(100_000 * 10 ** 9, "SOL", 9), { commitment: "finalized" })

      const usdcMintWeb3js = await createMint(
        connection,
        keypair,
        keypair.publicKey,
        keypair.publicKey,
        6 // Decimals
      );

      console.log("Created USDC: ", usdcMintWeb3js.toBase58());

      const userUsdcInfo = await getOrCreateAssociatedTokenAccount(
        connection,
        keypair,
        usdcMintWeb3js,
        keypair.publicKey,
        false,
        "confirmed",
        {
          commitment: "confirmed",
        },
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      console.log("Created user usdc ata");


      await mintTo(
        connection,
        keypair,
        usdcMintWeb3js,
        userUsdcInfo.address,
        keypair.publicKey,
        100_000_000 * 10 ** usdcDecimal,
        [],
        {
          commitment: "confirmed",
        },
        TOKEN_PROGRAM_ID
      );

      console.log("Minted USDC to user");

      userUSDC = fromWeb3JsPublicKey(userUsdcInfo.address);
      usdcMint = fromWeb3JsPublicKey(usdcMintWeb3js)

      tokenManager = findTokenManagerPda(umi);
      vault = findAssociatedTokenPda(umi, { owner: tokenManager[0], mint: usdcMint });
    } catch (error) {
      console.log(error);
    }
  })

  it("Token manager is initialized!", async () => {
    let txBuilder = new TransactionBuilder();

    txBuilder = txBuilder.add(initialize(umi, {
      tokenManager,
      vault,
      metadata,
      mint: stableMint,
      quoteMint: usdcMint,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      name: "SOLD",
      symbol: "SOLD",
      uri: "https://builderz.dev/_next/image?url=%2Fimages%2Fheader-gif.gif&w=3840&q=75",
      decimals: 6
    }))

    const sig = await txBuilder.sendAndConfirm(umi);

    console.log(bs58.encode(sig.signature));

    const tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    console.log("Token Manager: ", tokenManagerAcc);
  });

  it("Sold can be minted for USDC", async () => {
    let txBuilder = new TransactionBuilder();

    const userStableAtaAcc = await safeFetchToken(umi, userStable)

    if (!userStableAtaAcc) {
      txBuilder = txBuilder.add(createAssociatedToken(umi, {
        mint: stableMint,
      }))
    }

    txBuilder = txBuilder.add(mint(umi, {
      tokenManager,
      mint: stableMint,
      quoteMint: usdcMint,
      payerMintAta: userStable,
      payerQuoteMintAta: userUSDC,
      vault,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      quantity: 1000
    }))

    const sig = await txBuilder.sendAndConfirm(umi, { send: { skipPreflight: false } });

    console.log(bs58.encode(sig.signature));

    const tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    console.log(tokenManagerAcc);

  })

  it("Sold can be redeemed for USDC", async () => {
    let txBuilder = new TransactionBuilder();

    const userQuoteAtaAcc = await safeFetchToken(umi, userUSDC)

    if (!userQuoteAtaAcc) {
      txBuilder = txBuilder.add(createAssociatedToken(umi, {
        mint: userUSDC,
      }))
    }

    txBuilder = txBuilder.add(redeem(umi, {
      tokenManager,
      mint: stableMint,
      quoteMint: usdcMint,
      payerMintAta: userStable,
      payerQuoteMintAta: userUSDC,
      vault,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      quantity: 1000
    }))

    const sig = await txBuilder.sendAndConfirm(umi, { send: { skipPreflight: false } });

    console.log(bs58.encode(sig.signature));

    const tokenManagerAcc = await safeFetchTokenManager(umi, tokenManager);
    console.log(tokenManagerAcc);

  })
});
