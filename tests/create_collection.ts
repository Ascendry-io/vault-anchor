import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { CollectibleVault } from "../target/types/collectible_vault";
import { 
    Keypair, 
    SystemProgram, 
    SYSVAR_RENT_PUBKEY, 
    PublicKey 
} from "@solana/web3.js";
import { 
    TOKEN_PROGRAM_ID, 
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress 
} from "@solana/spl-token";
import { 
    MPL_TOKEN_METADATA_PROGRAM_ID 
} from "@metaplex-foundation/mpl-token-metadata";

async function main() {
    const provider = anchor.AnchorProvider.env()
    anchor.setProvider(provider)
    
    const program = anchor.workspace.CollectibleVault as Program<CollectibleVault>;

        // Generate new keypair for the mint
        const mintKeypair = Keypair.generate();

        // Derive the metadata PDA
        const [metadataAddress] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("metadata"),
                new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID).toBuffer(),
                mintKeypair.publicKey.toBuffer(),
            ],
            new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID)
        );

        // Get the token account address
        const tokenAccount = await getAssociatedTokenAddress(
            mintKeypair.publicKey,
            provider.wallet.publicKey
        );

        console.log("Mint:", mintKeypair.publicKey.toString());
        console.log("Metadata:", metadataAddress.toString());
        console.log("Token Account:", tokenAccount.toString());

        const createCollectionAccounts = {
            mint: mintKeypair.publicKey,
            metadata: metadataAddress,
            tokenAccount: tokenAccount,
            payer: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
            tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
        };
        // Create collection
        const tx = await program.methods
            .createCollection()
            .accounts(createCollectionAccounts)
            .signers([mintKeypair])
            .rpc();

        console.log("Transaction signature:", tx);
}

main().then(() => {
    console.log("Done");
}).catch((error) => {
    console.error("Error:", error);
});