import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { CollectibleVault } from "../target/types/collectible_vault";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { expect } from "chai";

describe("testing asset redemption", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.CollectibleVault as Program<CollectibleVault>;
  const wallet = provider.wallet as anchor.Wallet;

  let nftMint: PublicKey;
  let ownerNftAccount: PublicKey;
  let vaultNftAccount: PublicKey;
  let assetRedemptionInfo: PublicKey;
  let vaultAuthority: PublicKey;

  before(async () => {
    // Create NFT mint
    nftMint = await createMint(
      provider.connection,
      wallet.payer,
      wallet.publicKey,
      wallet.publicKey,
      0
    );

    // Create owner's NFT token account
    ownerNftAccount = await createAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      nftMint,
      wallet.publicKey
    );

    // Mint 1 NFT to owner
    await mintTo(
      provider.connection,
      wallet.payer,
      nftMint,
      ownerNftAccount,
      wallet.publicKey,
      1
    );

    // Find vault authority PDA
    [vaultAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("redemption_vault")],
      program.programId
    );

    // Find asset redemption info PDA
    [assetRedemptionInfo] = PublicKey.findProgramAddressSync(
      [Buffer.from("redemption"), nftMint.toBuffer()],
      program.programId
    );

    // Find vault NFT account
    vaultNftAccount = await anchor.utils.token.associatedAddress({
      mint: nftMint,
      owner: vaultAuthority,
    });
  });

  it("Creates asset redemption request", async () => {
    const tx = await program.methods
      .createAssetRedemptionRequest()
      .accounts({
        assetRedemptionInfo,
        nftMint,
        ownerNftAccount,
        vaultNftAccount,
        vaultAuthority,
        owner: wallet.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    // Verify NFT was transferred to vault
    const vaultAccount = await getAccount(provider.connection, vaultNftAccount);
    expect(vaultAccount.amount.toString()).to.equal("1");

    // Verify owner's NFT account is empty
    const ownerAccount = await getAccount(provider.connection, ownerNftAccount);
    expect(ownerAccount.amount.toString()).to.equal("0");

    // Verify asset redemption info account was created with correct data
    const redemptionInfo = await program.account.assetRedemptionInfo.fetch(
      assetRedemptionInfo
    );
    expect(redemptionInfo.nftMint.toString()).to.equal(nftMint.toString());
    expect(redemptionInfo.nftOwner.toString()).to.equal(
      wallet.publicKey.toString()
    );
    expect(redemptionInfo.requestTimestamp).to.be.greaterThan(0);
  });
}); 