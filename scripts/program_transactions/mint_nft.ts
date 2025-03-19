// Mint NFT
import * as anchor from "@coral-xyz/anchor";
import { 
    Keypair,
    PublicKey, 
    Connection,
    clusterApiUrl
} from "@solana/web3.js";
import { 
    TOKEN_PROGRAM_ID, 
    getAssociatedTokenAddress ,
    ASSOCIATED_TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import { getPayerKeypair } from "../utils";
import idl from "../../target/idl/collectible_vault.json"; // Import the IDL JSON
import { CollectibleVault } from "../../target/types/collectible_vault"; // Import TypeScript types
import { COLLECTION_METADATA_PUBLIC_KEY, METADATA_PROGRAM_ID } from "../constants";

const payerKeypair = getPayerKeypair();

// Solana connection
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(payerKeypair), {
    preflightCommitment: "confirmed",
});
anchor.setProvider(provider);

const program = new anchor.Program<CollectibleVault>(idl as CollectibleVault, provider);

// Creates Metaplex NFT Collection from anchor instruction.
async function createNft() {
    console.log("Creating individual NFT...");

    // Generate a new mint keypair for the collection
    const mint = Keypair.generate();

    // Derive PDA for metadata account
    const [metadataPDA] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("metadata"),
            new PublicKey(idl.instructions.find(i => i.name === "mint_nft")?.accounts.find(a => a.name === "token_metadata_program")?.address!).toBuffer(),
            mint.publicKey.toBuffer(),
        ],
        new PublicKey(idl.instructions.find(i => i.name === "mint_nft")?.accounts.find(a => a.name === "token_metadata_program")?.address!)
    );

    // Get the associated token account for the payer
    const tokenAccount = await getAssociatedTokenAddress(mint.publicKey, payerKeypair.publicKey);
    const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

    const accounts = {
        mint: mint.publicKey,
        metadata: metadataPDA,
        tokenAccount,
        payer: payerKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenMetadataProgram: METADATA_PROGRAM_ID, // Metaplex Token Metadata Program
        collection: COLLECTION_METADATA_PUBLIC_KEY,
    };

    const tx = await program.methods
    .mintNft("https://metadata.y00ts.com/y/6869.json")
    .accounts(accounts)
    .signers([payerKeypair, mint])
    .rpc();

    console.log(`✅ Individual NFT Created! TX: ${tx}`);
    console.log(`NFT Mint Address: ${mint.publicKey.toBase58()}`);
}

createNft().catch(console.error);