import * as anchor from "@coral-xyz/anchor";
import { 
    Keypair,
    PublicKey, 
    Connection,
    clusterApiUrl
} from "@solana/web3.js";
import { getPayerKeypair } from "../utils";
import idl from "../../target/idl/collectible_vault.json"; // Import the IDL JSON
import { CollectibleVault } from "../../target/types/collectible_vault"; // Import TypeScript types
import { METADATA_PROGRAM_ID } from "../constants";

const payerKeypair = getPayerKeypair();

// Solana connection
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(payerKeypair), {
    preflightCommitment: "confirmed",
});
anchor.setProvider(provider);

const program = new anchor.Program<CollectibleVault>(idl as CollectibleVault, provider);

async function verifyNftCollection(
    program: anchor.Program,           // Anchor Program instance
    payer: Keypair,                    // Solana Keypair
    nftMint: PublicKey,                // PublicKey of the NFT's mint
    collectionMint: PublicKey          // PublicKey of the collection's mint
  ) {
    // Derive the metadata account for the NFT
    const [nftMetadata] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        METADATA_PROGRAM_ID.toBuffer(),
        nftMint.toBuffer(),
      ],
      METADATA_PROGRAM_ID
    );
    
    // Derive metadata account for the collection
    const [collectionMetadata] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        METADATA_PROGRAM_ID.toBuffer(),
        collectionMint.toBuffer(),
      ],
      METADATA_PROGRAM_ID
    );
    
    // Derive master edition for the collection
    const [collectionMasterEdition] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        METADATA_PROGRAM_ID.toBuffer(),
        collectionMint.toBuffer(),
        Buffer.from("edition"),
      ],
      METADATA_PROGRAM_ID
    );
    
    // Verify the collection membership
    const tx = await program.methods.verifyCollection()
      .accounts({
        metadata: nftMetadata,
        collectionAuthority: payer.publicKey,
        payer: payer.publicKey,
        collectionMint: collectionMint,
        collectionMetadata: collectionMetadata,
        collectionMasterEdition: collectionMasterEdition,
        tokenMetadataProgram: METADATA_PROGRAM_ID,
      })
      .signers([payer])
      .rpc();
    
    console.log(`✅ Collection membership verified! TX: ${tx}`);
    return tx;
}

const NFT_MINT = new PublicKey('')
const COLLECTION_MINT = new PublicKey('')
  
verifyNftCollection(program, payerKeypair, NFT_MINT, COLLECTION_MINT).then((tx) => {
    console.log(`✅ Collection membership verified! TX: ${tx}`);
});
