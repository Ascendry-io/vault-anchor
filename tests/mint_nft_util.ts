import * as anchor from '@coral-xyz/anchor';
import {
	Keypair,
	PublicKey,
	SystemProgram,
	ComputeBudgetProgram,
	SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import {
	TOKEN_PROGRAM_ID,
	getAssociatedTokenAddress,
	ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { PAYER_KEYPAIR, ALTERNATIVE_PAYER_KEYPAIR } from '../utils/testing-keypairs';
import idl from '../target/idl/collectible_vault.json'; // Import the IDL JSON
import { CollectibleVault } from '../target/types/collectible_vault'; // Import TypeScript types
import { assert } from 'chai';
import { getCollectionAddress } from '../utils/collection_store';
import { TEST_RPC_CONNECTION, TEST_NFT_INFO, METADATA_PROGRAM_ID } from './constants';

/**
 * Mint a new NFT for testing
 * @param owner - The owner of the NFT
 * @returns The mint address of the NFT
 */
export async function mintNft(owner: PublicKey): Promise<PublicKey> {
	const ADMIN_KEYPAIR = PAYER_KEYPAIR;
	const OTHER_KEYPAIR = ALTERNATIVE_PAYER_KEYPAIR;

	const wallet = new anchor.Wallet(ADMIN_KEYPAIR);
	const provider = new anchor.AnchorProvider(TEST_RPC_CONNECTION, wallet, {
		preflightCommitment: 'confirmed',
	});

	anchor.setProvider(provider);
	const program = new anchor.Program<CollectibleVault>(idl as CollectibleVault, provider);

	let collectionMint: PublicKey = getCollectionAddress();
	console.log(`Collection Mint: ${collectionMint.toString()}`);

	const [collectionCounterPDA] = await PublicKey.findProgramAddress(
		[Buffer.from('vault_collection_counter')],
		program.programId
	);

	// Fetch and log collection counter info
	try {
		const counterInfo = await program.account.collectionCounter.fetch(collectionCounterPDA);

		if (!counterInfo.collectionMint.equals(collectionMint)) {
			console.warn(
				"⚠️ WARNING: Collection mint in counter doesn't match expected collection mint!"
			);
		}
	} catch (err) {
		console.error('Error fetching collection counter:', err.message);
	}

	// Add compute budget instruction
	const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
		units: 300000,
	});

	// Generate a new mint keypair for the NFT
	const mint = Keypair.generate();
	console.log(`Generated new NFT mint: ${mint.publicKey.toString()}`);

	// Derive PDA for metadata account
	const [metadataPDA] = PublicKey.findProgramAddressSync(
		[
			Buffer.from('metadata'),
			new PublicKey(
				idl.instructions
					.find((i) => i.name === 'mint_nft')
					?.accounts.find((a) => a.name === 'token_metadata_program')?.address!
			).toBuffer(),
			mint.publicKey.toBuffer(),
		],
		new PublicKey(
			idl.instructions
				.find((i) => i.name === 'mint_nft')
				?.accounts.find((a) => a.name === 'token_metadata_program')?.address!
		)
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
		[Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), collectionMint.toBuffer()],
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
		OTHER_KEYPAIR.publicKey // Using altPayer as the owner in this example
	);

	const accounts = {
		mint: mint.publicKey,
		metadata: metadataPDA,
		masterEdition: masterEditionPDA,
		owner: owner,
		ownerTokenAccount: ownerTokenAccount,
		payer: ADMIN_KEYPAIR.publicKey,
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

	// Verify the owner received the NFT
	try {
		const tx = await program.methods
			.mintNft(TEST_NFT_INFO.productDetailUri)
			.accounts(accounts)
			.preInstructions([modifyComputeUnits])
			.signers([ADMIN_KEYPAIR, mint])
			.rpc();

		console.log(`Test NFT: ${mint.publicKey.toString()} minted to owner: ${owner.toString()}`);
		const ownerTokenBalance = await TEST_RPC_CONNECTION.getTokenAccountBalance(ownerTokenAccount);
		assert.equal(ownerTokenBalance.value.uiAmount, 1, 'Owner should have received 1 NFT');
		return mint.publicKey;
	} catch (err) {
		console.error(`❌ Token verification failed: ${err.message}`);
		throw err;
	}
}
