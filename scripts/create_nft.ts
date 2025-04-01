import * as anchor from '@coral-xyz/anchor';
import {
	Keypair,
	PublicKey,
	Connection,
	clusterApiUrl,
	SystemProgram,
	ComputeBudgetProgram,
	SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import {
	TOKEN_PROGRAM_ID,
	getAssociatedTokenAddress,
	ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { getAlternativePayerKeypair, getPayerKeypair } from '../utils/utils';
import idl from '../target/idl/collectible_vault.json'; // Import the IDL JSON
import { CollectibleVault } from '../target/types/collectible_vault'; // Import TypeScript types
import { getCollectionAddress } from '../utils/collection_store';
import Irys from "@irys/sdk";
import fs from 'fs';
  
// NFT Metadata interface
interface NftMetadata {
name: string;
symbol: string;
description: string;
seller_fee_basis_points: number;
image: string;
attributes: {
    trait_type: string;
    value: string;
}[];
properties: {
    files: {
    uri: string;
    type: string;
    }[];
    category: string;
    creators: {
    address: string;
    share: number;
    }[];
};
}

/**
 * Main function to handle the complete NFT creation flow:
 * 1. Upload image to Arweave via Bundlr (paying with SOL)
 * 2. Create and upload metadata to Arweave
 * 3. Mint NFT via your Anchor program using the Arweave URIs
 */
async function generateNftMetadataFile(): Promise<string> {
    try {
        // ===== SETUP CONNECTION & WALLET =====
        const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
        const payerKeypair = getPayerKeypair();

        // Create an anchor wallet adapter
        const wallet = new anchor.Wallet(payerKeypair);
        
        // ===== SETUP BUNDLR FOR ARWEAVE UPLOADS =====
        console.log("Initializing Bundlr...");
        // Solana devnet
        const irys = new Irys({
            url: "https://devnet.irys.xyz",
            network: "solana",
            token: "solana",
            key: payerKeypair.secretKey,
            config: {
                providerUrl: connection.rpcEndpoint
            }
        })
        await irys.ready();
        // Check your bundlr balance
        const balance = await irys.getLoadedBalance();
        console.log(`Current irys balance: ${irys.utils.unitConverter(balance).toNumber()} SOL`);
        
        // ===== 1. UPLOAD IMAGE TO ARWEAVE =====
        console.log("Uploading image to Arweave...");
        
        // Read image file
        const imagePath = './scripts/assets/images/123.png'; // Adjust to your image path
        const imageData = fs.readFileSync(imagePath);
        const imageType = "image/png"; // Adjust according to your file type
        
        // Calculate upload cost
        const imageSize = imageData.length;
        const imageCost = await irys.getPrice(imageSize);
        console.log(`Cost to upload image: ${irys.utils.unitConverter(imageCost).toNumber()} SOL`);
        
        // Fund bundlr if needed
        if (balance.isLessThan(imageCost)) {
            console.log(`Funding bundlr with ${irys.utils.unitConverter(imageCost.minus(balance)).toNumber()} SOL`);
            await irys.fund(imageCost);
        }
        
        // Upload image
        const imageUploadResponse = await irys.upload(imageData, {
            tags: [{ name: "Content-Type", value: imageType }]
        });
        console.log(imageUploadResponse);
        const imageUrl = `https://arweave.net/${imageUploadResponse.id}`;
        console.log(`Image uploaded to: ${imageUrl}`);
        
        // ===== 2. CREATE & UPLOAD METADATA =====
        console.log("Creating and uploading metadata...");
        
        // Create metadata JSON
        const metadata: NftMetadata = {
        name: "Sample NFT", // Will be overridden by your program's "Banked Item #X" name
        symbol: "BT",
        description: "A sample NFT created for Arweave testnet",
        seller_fee_basis_points: 500,
        image: imageUrl, // Use the Arweave image URL
        attributes: [
            { trait_type: "Wata ID", value: "607149-001" },
            { trait_type: "Country of Origin", value: "Japan" },
            { trait_type: "Overall Grade", value: "9.0" },
            { trait_type: "Seal Grade", value: "9.0" },
            { trait_type: "Game Name", value: "Super Mario Bros. 3" },
            { trait_type: "Platform", value: "NES" },
            { trait_type: "Authentication Date", value: "3/25/2025" }
        ],
        properties: {
            files: [
            {
                uri: imageUrl,
                type: imageType
            }
            ],
            category: "image",
            creators: [
            {
                address: wallet.publicKey.toString(),
                share: 100
            }
            ]
        }
        };
        
        // Calculate metadata upload cost
        const metadataStr = JSON.stringify(metadata);
        const metadataSize = Buffer.from(metadataStr).length;
        const metadataCost = await irys.getPrice(metadataSize);
        console.log(`Cost to upload metadata: ${irys.utils.unitConverter(metadataCost).toNumber()} SOL`);
        
        // Fund bundlr if needed
        const newBalance = await irys.getLoadedBalance();
        if (newBalance.isLessThan(metadataCost)) {
            console.log(`Funding bundlr with ${irys.utils.unitConverter(metadataCost.minus(newBalance)).toNumber()} SOL`);
            await irys.fund(metadataCost.minus(newBalance));
        }
        
        // Upload metadata
        const metadataUploadResponse = await irys.upload(metadataStr, {
        tags: [{ name: "Content-Type", value: "application/json" }]
        });
        
        const metadataUrl = `https://arweave.net/${metadataUploadResponse.id}`;
        console.log(`Metadata uploaded to: ${metadataUrl}`);

        return metadataUrl;

    } catch (error) {
        console.error('Error generating NFT metadata:', error);
        throw error;
    }
}

async function mintNft(metadataUrl: string): Promise<void> {
    const METADATA_PROGRAM_ID: PublicKey = new PublicKey(
        'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
    );
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
	const payerKeypair = getPayerKeypair();
	const altPayerKeypair = getAlternativePayerKeypair();

	const wallet = new anchor.Wallet(payerKeypair);
	const provider = new anchor.AnchorProvider(connection, wallet, {
		preflightCommitment: 'confirmed',
	});

	anchor.setProvider(provider);
	const program = new anchor.Program<CollectibleVault>(idl as CollectibleVault, provider);

	let collectionMint: PublicKey;
	let masterEditionAddress: PublicKey;
	let collectionCounterPDA: PublicKey;

    // Get the existing collection address
    collectionMint = getCollectionAddress();

    [masterEditionAddress] = await PublicKey.findProgramAddress(
        [
            Buffer.from('metadata'),
            METADATA_PROGRAM_ID.toBuffer(),
            collectionMint.toBuffer(),
            Buffer.from('edition'),
        ],
        METADATA_PROGRAM_ID
    );

    [collectionCounterPDA] = await PublicKey.findProgramAddress(
        [Buffer.from('vault_collection_counter')],
        program.programId
    );

    // Add compute budget instruction
    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
        units: 300000,
    });

    // Generate a new mint keypair for the collection
    const mint = Keypair.generate();

    // Derive PDA for metadata account
    const [metadataPDA] = PublicKey.findProgramAddressSync(
        [
            Buffer.from('metadata'),
            METADATA_PROGRAM_ID.toBuffer(),
            mint.publicKey.toBuffer(),
        ],
        METADATA_PROGRAM_ID
    );

    // Derive PDA for master edition account
    const [masterEditionPDA] = PublicKey.findProgramAddressSync(
        [
            Buffer.from('metadata'),
            METADATA_PROGRAM_ID.toBuffer(),
            mint.publicKey.toBuffer(),
            Buffer.from('edition'),
        ],
        METADATA_PROGRAM_ID
    );

    // Derive collection metadata PDA
    const [collectionMetadataPDA] = PublicKey.findProgramAddressSync(
        [
            Buffer.from('metadata'),
            METADATA_PROGRAM_ID.toBuffer(),
            collectionMint.toBuffer(),
        ],
        METADATA_PROGRAM_ID
    );

    // Derive collection master edition PDA
    const [collectionMasterEditionPDA] = PublicKey.findProgramAddressSync(
        [
            Buffer.from('metadata'),
            METADATA_PROGRAM_ID.toBuffer(),
            collectionMint.toBuffer(),
            Buffer.from('edition'),
        ],
        METADATA_PROGRAM_ID
    );

    // Get the associated token account for the owner
    const ownerTokenAccount = await getAssociatedTokenAddress(
        mint.publicKey,
        altPayerKeypair.publicKey  // Using altPayer as the owner in this example
    );

    const accounts = {
        mint: mint.publicKey,
        metadata: metadataPDA,
        masterEdition: masterEditionPDA,
        owner: altPayerKeypair.publicKey,      // The recipient of the NFT
        ownerTokenAccount: ownerTokenAccount,  // Where the NFT will be sent
        payer: payerKeypair.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
        tokenMetadataProgram: METADATA_PROGRAM_ID,
        collection: collectionMetadataPDA,
        collectionMint: collectionMint,
        collectionMetadata: collectionMetadataPDA,
        collectionMasterEdition: collectionMasterEditionPDA,
        collectionCounter: collectionCounterPDA,
    };

    const tx = await program.methods
        .mintNft(metadataUrl)
        .accounts(accounts)
        .preInstructions([modifyComputeUnits])
        .signers([payerKeypair, mint])
        .rpc();

    console.log(`✅ Individual NFT Created! TX: ${tx}`);
    console.log(`NFT Mint Address: ${mint.publicKey.toBase58()}`);
    console.log(`Owner Address: ${altPayerKeypair.publicKey.toBase58()}`);
}

generateNftMetadataFile().then(async (metadataUrl) => {
    console.log(`Metadata URL: ${metadataUrl}`);
    await mintNft(metadataUrl);
});
