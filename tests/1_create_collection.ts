import * as anchor from '@coral-xyz/anchor';
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import {
	TOKEN_PROGRAM_ID,
	getAssociatedTokenAddress,
	ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { PAYER_KEYPAIR, ALTERNATIVE_PAYER_KEYPAIR } from '../utils/testing-keypairs';
import idl from '../target/idl/collectible_vault.json';
import { CollectibleVault } from '../target/types/collectible_vault';
import { saveCollectionAddress, getCollectionAddress } from '../utils/collection_store';
import { METADATA_PROGRAM_ID, TEST_RPC_CONNECTION } from './constants';

describe('Create Collection', () => {
	const wallet = new anchor.Wallet(PAYER_KEYPAIR);
	const provider = new anchor.AnchorProvider(TEST_RPC_CONNECTION, wallet, {
		preflightCommitment: 'confirmed',
	});

	anchor.setProvider(provider);
	const program = new anchor.Program<CollectibleVault>(idl as CollectibleVault, provider);

	let mint: Keypair;
	let metadataPDA: PublicKey;
	let masterEditionAddress: PublicKey;
	let collectionCounterPDA: PublicKey;
	let collectionExists = false;

	before(async () => {
		console.log('\n========================================');
		console.log('🔍 CHECKING FOR EXISTING COLLECTION');
		console.log('========================================\n');

		// Check if collection PDA already exists
		try {
			// Try to get the existing collection address
			const existingCollection = getCollectionAddress();
			if (existingCollection) {
				console.log(`Existing collection found: ${existingCollection.toString()}`);

				// Check if the collection counter PDA exists on-chain
				[collectionCounterPDA] = await PublicKey.findProgramAddress(
					[Buffer.from('vault_collection_counter')],
					program.programId
				);

				try {
					const collectionCounterAccount = await program.account.collectionCounter.fetch(
						collectionCounterPDA
					);
					console.log('Collection counter account exists on-chain.');
					console.log(`Collection counter value: ${collectionCounterAccount.count}`);
					console.log(`Collection mint: ${collectionCounterAccount.collectionMint.toString()}`);
					collectionExists = true;
				} catch (err) {
					console.log('Collection counter PDA not found on-chain, will proceed with tests.');
					collectionExists = false;
				}
			}
		} catch (err) {
			console.log('No existing collection found in store, will create a new one.');
		}

		if (!collectionExists) {
			// Set up for new collection creation
			mint = Keypair.generate();
			console.log(`Generated new collection mint: ${mint.publicKey.toString()}`);

			// Derive PDA for metadata and master edition
			const [metadata] = await PublicKey.findProgramAddress(
				[Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), mint.publicKey.toBuffer()],
				METADATA_PROGRAM_ID
			);
			metadataPDA = metadata;

			const [masterEdition] = await PublicKey.findProgramAddress(
				[
					Buffer.from('metadata'),
					METADATA_PROGRAM_ID.toBuffer(),
					mint.publicKey.toBuffer(),
					Buffer.from('edition'),
				],
				METADATA_PROGRAM_ID
			);
			masterEditionAddress = masterEdition;

			[collectionCounterPDA] = await PublicKey.findProgramAddress(
				[Buffer.from('vault_collection_counter')],
				program.programId
			);
		}
	});

	// it('should fail to create a collection with UnauthorizedTransactionSigner', async function () {
	// 	// Skip test if collection already exists
	// 	if (collectionExists) {
	// 		console.log('Skipping unauthorized signer test as collection already exists');
	// 		this.skip();
	// 		return;
	// 	}

	// 	const tokenAccount = await getAssociatedTokenAddress(
	// 		mint.publicKey,
	// 		ALTERNATIVE_PAYER_KEYPAIR.publicKey
	// 	);

	// 	try {
	// 		await program.methods
	// 			.createCollection()
	// 			.accounts({
	// 				mint: mint.publicKey,
	// 				metadata: metadataPDA,
	// 				tokenAccount: tokenAccount,
	// 				payer: ALTERNATIVE_PAYER_KEYPAIR.publicKey, // This is an unauthorized payer
	// 				systemProgram: SystemProgram.programId,
	// 				tokenProgram: TOKEN_PROGRAM_ID,
	// 				associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
	// 				rent: anchor.web3.SYSVAR_RENT_PUBKEY,
	// 				tokenMetadataProgram: METADATA_PROGRAM_ID,
	// 				masterEdition: masterEditionAddress,
	// 				collectionCounter: collectionCounterPDA,
	// 			})
	// 			.signers([mint, ALTERNATIVE_PAYER_KEYPAIR])
	// 			.rpc();

	// 		// If it does not throw, fail the test
	// 		throw new Error('Test failed: transaction did not throw an error');
	// 	} catch (err) {
	// 		// Ensure the error matches the expected UnauthorizedTransactionSigner error
	// 		if (!err.message.includes('UnauthorizedTransactionSigner')) {
	// 			throw new Error(`Unexpected error: ${err.message}`);
	// 		}

	// 		console.log('✅ Test passed: Unauthorized signer correctly rejected');
	// 	}
	// });

	it('should create a collection', async function () {
		// Skip test if collection already exists
		if (collectionExists) {
			console.log('Skipping collection creation test as collection already exists');
			this.skip();
			return;
		}

		console.log('\n========================================');
		console.log('🔨 CREATING NEW COLLECTION');
		console.log('========================================\n');

		// Generate the associated token account for the mint
		const tokenAccount = await getAssociatedTokenAddress(mint.publicKey, PAYER_KEYPAIR.publicKey);

		console.log('Submitting createCollection transaction...');
		try {

			const tx = await program.methods
				.createCollection()
				.accounts({
					mint: mint.publicKey,
					metadata: metadataPDA,
					tokenAccount: tokenAccount,
					payer: PAYER_KEYPAIR.publicKey,
					systemProgram: SystemProgram.programId,
					tokenProgram: TOKEN_PROGRAM_ID,
					associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
					rent: anchor.web3.SYSVAR_RENT_PUBKEY,
					tokenMetadataProgram: METADATA_PROGRAM_ID,
					masterEdition: masterEditionAddress,
					collectionCounter: collectionCounterPDA,
				})
				.signers([mint, PAYER_KEYPAIR])
				.rpc();

			console.log(`✅ Collection created successfully!`);
			console.log(`Transaction: ${tx}`);
			console.log(`Collection Mint Address: ${mint.publicKey.toString()}`);
			console.log(`Metadata Address: ${metadataPDA.toString()}`);
			console.log(`Master Edition Address: ${masterEditionAddress.toString()}`);
			console.log(`Collection Counter Address: ${collectionCounterPDA.toString()}`);

			// Save collection address for other tests
			saveCollectionAddress(mint.publicKey.toString());

			// Verify collection counter account was created
			const collectionCounterAccount = await program.account.collectionCounter.fetch(
				collectionCounterPDA
			);
			console.log(
				`✅ Collection counter initialized with count: ${collectionCounterAccount.count}`
			);
			console.log(
				`Collection mint stored in counter: ${collectionCounterAccount.collectionMint.toString()}`
			);

			// Verify the stored mint matches our mint
			if (!collectionCounterAccount.collectionMint.equals(mint.publicKey)) {
				console.warn("⚠️ Warning: Collection mint in counter doesn't match the mint we created!");
			}
		} catch (err) {
			console.error('❌ Failed to fetch collection counter account:', err);
			throw err;
		}
	});

	// Add a summary test that always runs
	it('should provide collection information', function () {
		try {
			const existingCollection = getCollectionAddress();
			console.log('\n========================================');
			console.log('ℹ️ COLLECTION INFORMATION');
			console.log('========================================');
			console.log(`Collection Mint Address: ${existingCollection.toString()}`);

			if (collectionExists) {
				console.log('Status: Collection already existed before this test run');
			} else {
				console.log('Status: Collection was created during this test run');
			}
			console.log('========================================\n');
		} catch (err) {
			console.error('❌ Failed to get collection information:', err);
		}
	});
});
