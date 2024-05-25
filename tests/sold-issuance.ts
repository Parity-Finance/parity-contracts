import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SoldIssuance } from "../target/types/sold_issuance";
import { PublicKey, publicKey, TransactionBuilder } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { findAssociatedTokenPda } from "@metaplex-foundation/mpl-toolbox"

import { findTokenManagerPda, initialize } from "../clients/js/src"

describe("sold-contract", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.SoldIssuance as Program<SoldIssuance>;

  let usdcMint: PublicKey

  let umi = createUmi("http://localhost:8080")

  before(async () => {
    const txBuilder = new TransactionBuilder()

  })

  it("Token manager is initialized!", async () => {
    // Add your test here.
    const txBuilderz = new TransactionBuilder()

    const tokenManager = findTokenManagerPda(umi);
    // const vault = findAssociatedTokenPda(umi, { owner: tokenManager, mint: usdcMint })

    // txBuilderz.add(
    //   initialize(umi, {
    //     tokenManager,

    //   }).sendAndConfirm(umi)
    // )
    // console.log("Your transaction signature", tx);
  });
});
