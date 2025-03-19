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
import { getPayerKeypair } from "./utils";
import idl from "../target/idl/collectible_vault.json"; // Import the IDL JSON
import { CollectibleVault } from "../target/types/collectible_vault"; // Import TypeScript types

const payerKeypair = getPayerKeypair();

// Solana connection
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(payerKeypair), {
    preflightCommitment: "confirmed",
});
anchor.setProvider(provider);

const program = new anchor.Program<CollectibleVault>(idl as CollectibleVault, provider);

// Creates Metaplex NFT Collection from anchor instruction.
async function createCollection() {
    console.log("Creating collection NFT...");

    // Generate a new mint keypair for the collection
    const mint = Keypair.generate();

    // Derive PDA for metadata account
    const [metadataPDA] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("metadata"),
            new PublicKey(idl.instructions.find(i => i.name === "create_collection")?.accounts.find(a => a.name === "token_metadata_program")?.address!).toBuffer(),
            mint.publicKey.toBuffer(),
        ],
        new PublicKey(idl.instructions.find(i => i.name === "create_collection")?.accounts.find(a => a.name === "token_metadata_program")?.address!)
    );

    // Get the associated token account for the payer
    const tokenAccount = await getAssociatedTokenAddress(mint.publicKey, payerKeypair.publicKey);

    // Transaction to create the collection NFT
    const tx = await program.rpc.createCollection({
        accounts: {
            mint: mint.publicKey,
            metadata: metadataPDA,
            tokenAccount,
            payer: payerKeypair.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            tokenMetadataProgram: new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"), // Metaplex Token Metadata Program
        },
        signers: [payerKeypair, mint],
    });

    console.log(`✅ Collection Created! TX: ${tx}`);
    console.log(`Collection Mint Address: ${mint.publicKey.toBase58()}`);
}

createCollection().catch(console.error);