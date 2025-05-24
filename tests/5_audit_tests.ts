import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { CollectibleVault } from "../target/types/collectible_vault";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";

describe("audit-tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.CollectibleVault as Program<CollectibleVault>;
  
  // Test accounts
  const user = Keypair.generate();
  const admin = Keypair.generate();
  const nftMint = Keypair.generate();
  
  // PDA for audit request
  const [auditRequestPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("audit_request"),
      nftMint.publicKey.toBuffer(),
      Buffer.from(new anchor.BN(Date.now() / 1000).toArray("le", 8)),
    ],
    program.programId
  );

  // PDA for audit snapshot
  const [auditSnapshotPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("audit_snapshot"),
      nftMint.publicKey.toBuffer(),
      Buffer.from([0]), // First audit
    ],
    program.programId
  );

  // USDC mint and accounts
  let usdcMint: PublicKey;
  let userUsdcAccount: PublicKey;
  let adminUsdcAccount: PublicKey;

  before(async () => {
    // Airdrop SOL to test accounts
    await provider.connection.requestAirdrop(user.publicKey, 2 * LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(admin.publicKey, 2 * LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(nftMint.publicKey, 2 * LAMPORTS_PER_SOL);

    // Create USDC mint
    usdcMint = await createMint(
      provider.connection,
      user,
      user.publicKey,
      null,
      6
    );

    // Create USDC token accounts
    userUsdcAccount = await createAssociatedTokenAccount(
      provider.connection,
      user,
      usdcMint,
      user.publicKey
    );

    adminUsdcAccount = await createAssociatedTokenAccount(
      provider.connection,
      user,
      usdcMint,
      admin.publicKey
    );

    // Mint USDC to user
    await mintTo(
      provider.connection,
      user,
      usdcMint,
      userUsdcAccount,
      user,
      100_000_000 // 100 USDC
    );
  });

  it("Requests an audit for an NFT", async () => {
    try {
      await program.methods
        .requestAuditOnItem()
        .accounts({
          auditRequest: auditRequestPda,
          nftMint: nftMint.publicKey,
          requester: user.publicKey,
          userUsdcAccount,
          adminUsdcAccount,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([user])
        .rpc();

      // Verify audit request was created
      const auditRequest = await program.account.auditRequest.fetch(auditRequestPda);
      assert.ok(auditRequest.nftMint.equals(nftMint.publicKey));
      assert.ok(auditRequest.requester.equals(user.publicKey));
      assert.equal(auditRequest.status, { pending: {} });

      // Verify USDC transfer
      const userUsdcBalance = await getAccount(provider.connection, userUsdcAccount);
      const adminUsdcBalance = await getAccount(provider.connection, adminUsdcAccount);
      assert.equal(Number(userUsdcBalance.amount), 90_000_000); // 90 USDC remaining
      assert.equal(Number(adminUsdcBalance.amount), 10_000_000); // 10 USDC received
    } catch (err) {
      console.error(err);
      throw err;
    }
  });

  it("Admin provides audit snapshot", async () => {
    const imageUrls = ["https://example.com/audit1.jpg", "https://example.com/audit2.jpg"];

    try {
      await program.methods
        .provideAuditSnapshot(imageUrls)
        .accounts({
          auditRequest: auditRequestPda,
          auditSnapshot: auditSnapshotPda,
          admin: admin.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([admin])
        .rpc();

      // Verify audit snapshot was created
      const auditSnapshot = await program.account.auditSnapshot.fetch(auditSnapshotPda);
      assert.ok(auditSnapshot.nftMint.equals(nftMint.publicKey));
      assert.ok(auditSnapshot.auditRequestPda.equals(auditRequestPda));
      assert.equal(auditSnapshot.sequence, 0);
      assert.equal(auditSnapshot.auditFileUrl, imageUrls[0]);

      // Verify audit request was updated
      const auditRequest = await program.account.auditRequest.fetch(auditRequestPda);
      assert.equal(auditRequest.status, { completed: {} });
    } catch (err) {
      console.error(err);
      throw err;
    }
  });

  it("Non-admin cannot provide audit snapshot", async () => {
    const imageUrls = ["https://example.com/audit1.jpg"];

    try {
      await program.methods
        .provideAuditSnapshot(imageUrls)
        .accounts({
          auditRequest: auditRequestPda,
          auditSnapshot: auditSnapshotPda,
          admin: user.publicKey, // Using user instead of admin
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      assert.fail("Expected error but got success");
    } catch (err) {
      assert.include(err.message, "Error: 2003: failed to send transaction");
    }
  });
}); 