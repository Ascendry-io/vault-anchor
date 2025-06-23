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
import { getCollectionAddress, saveNftMintAddress } from '../utils/collection_store';
import { TEST_RPC_CONNECTION, TEST_NFT_INFO, METADATA_PROGRAM_ID, SEED_PDA_CONSTANTS } from './constants';
import { formatSOL } from './test-utils';

// Helper to log account information
const logAccountInfo = async (connection, account, label) => {
	try {
		const balance = await connection.getBalance(account);
		console.log(`${label}: ${account.toString()} (Balance: ${formatSOL(balance)})`);
	} catch (err) {
		console.log(`${label}: ${account.toString()} (Error fetching balance)`);
	}
};

describe('NFT Minting Integration Tests', () => {
	// Set up test banner for better visibility in logs
	before(() => {
		console.log('\n========================================');
		console.log('🧪 STARTING NFT MINTING INTEGRATION TESTS');
		console.log('========================================\n');
	});

	after(() => {
		console.log('\n========================================');
		console.log('✅ NFT MINTING INTEGRATION TESTS COMPLETED');
		console.log('========================================\n');
	});

	const ADMIN_KEYPAIR = PAYER_KEYPAIR;
	const OTHER_KEYPAIR = ALTERNATIVE_PAYER_KEYPAIR;

	const wallet = new anchor.Wallet(ADMIN_KEYPAIR);
	const provider = new anchor.AnchorProvider(TEST_RPC_CONNECTION, wallet, {
		preflightCommitment: 'confirmed',
	});

	anchor.setProvider(provider);
	const program = new anchor.Program<CollectibleVault>(idl as CollectibleVault, provider);

	let collectionMint: PublicKey;
	let metadataPDA: PublicKey;
	let masterEditionAddress: PublicKey;
	let collectionCounterPDA: PublicKey;

	before(async () => {
		console.log('\n📋 Setting up test accounts and PDAs...');

		// Get the existing collection address
		collectionMint = getCollectionAddress();
		console.log(`Collection Mint: ${collectionMint.toString()}`);

		// Log key information about test participants
		await logAccountInfo(TEST_RPC_CONNECTION, ADMIN_KEYPAIR.publicKey, 'Admin (Payer)');
		await logAccountInfo(TEST_RPC_CONNECTION, OTHER_KEYPAIR.publicKey, 'Alternative Payer');

		console.log(`\nProgram ID: ${program.programId.toString()}`);

		// Derive PDAs
		[metadataPDA] = await PublicKey.findProgramAddress(
			[Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), collectionMint.toBuffer()],
			METADATA_PROGRAM_ID
		);
		console.log(`Collection Metadata PDA: ${metadataPDA.toString()}`);

		[masterEditionAddress] = await PublicKey.findProgramAddress(
			[
				Buffer.from('metadata'),
				METADATA_PROGRAM_ID.toBuffer(),
				collectionMint.toBuffer(),
				Buffer.from('edition'),
			],
			METADATA_PROGRAM_ID
		);
		console.log(`Collection Master Edition PDA: ${masterEditionAddress.toString()}`);

		[collectionCounterPDA] = await PublicKey.findProgramAddress(
			[Buffer.from(SEED_PDA_CONSTANTS.COLLECTION_COUNTER)],
			program.programId
		);
		console.log(`Collection Counter PDA: ${collectionCounterPDA.toString()}`);

		// Fetch and log collection counter info
		try {
			const counterInfo = await program.account.collectionCounter.fetch(collectionCounterPDA);
			console.log(`Collection counter value: ${counterInfo.count.toString()}`);
			console.log(`Collection mint in counter: ${counterInfo.collectionMint.toString()}`);

			if (!counterInfo.collectionMint.equals(collectionMint)) {
				console.warn(
					"⚠️ WARNING: Collection mint in counter doesn't match expected collection mint!"
				);
			}
		} catch (err) {
			console.error('Error fetching collection counter:', err.message);
		}
	});

	it('admin wallet should be able to mint an NFT', async () => {
		console.log('\n🔨 TEST: Admin minting an NFT...');

		// Add compute budget instruction
		const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
			units: 300000,
		});
		console.log(`Compute budget set to 300,000 units`);

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
		console.log(`NFT Metadata PDA: ${metadataPDA.toString()}`);

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
		console.log(`NFT Master Edition PDA: ${masterEditionPDA.toString()}`);

		// Derive collection metadata PDA
		const [collectionMetadataPDA] = PublicKey.findProgramAddressSync(
			[Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), collectionMint.toBuffer()],
			METADATA_PROGRAM_ID
		);
		console.log(`Collection Metadata PDA: ${collectionMetadataPDA.toString()}`);

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
		console.log(`Collection Master Edition PDA: ${collectionMasterEditionPDA.toString()}`);

		// Get the associated token account for the owner
		const ownerTokenAccount = await getAssociatedTokenAddress(
			mint.publicKey,
			OTHER_KEYPAIR.publicKey // Using altPayer as the owner in this example
		);
		console.log(`Owner Token Account: ${ownerTokenAccount.toString()}`);

		const metadataUri = TEST_NFT_INFO.productDetailUri;
		console.log(`NFT Metadata URI: ${metadataUri}`);

		console.log('\nPreparing accounts for minting...');
		const accounts = {
			mint: mint.publicKey,
			metadata: metadataPDA,
			masterEdition: masterEditionPDA,
			owner: OTHER_KEYPAIR.publicKey,
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

		console.log('Executing mintNft transaction...');
		console.time('Minting Time');

		// Verify the owner received the NFT
		try {
			const tx = await program.methods
				.mintNft(TEST_NFT_INFO.productDetailUri)
				.accounts(accounts)
				.preInstructions([modifyComputeUnits])
				.signers([ADMIN_KEYPAIR, mint])
				.rpc();
			console.timeEnd('Minting Time');

			console.log(`\n✅ NFT Minted Successfully!`);
			console.log(`Transaction: ${tx}`);
			console.log(`Transaction Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
			console.log(`NFT Mint Address: ${mint.publicKey.toString()}`);
			console.log(
				`NFT Explorer: https://explorer.solana.com/address/${mint.publicKey.toString()}?cluster=devnet`
			);
			console.log(`Owner Address: ${OTHER_KEYPAIR.publicKey.toString()}`);
			const ownerTokenBalance = await TEST_RPC_CONNECTION.getTokenAccountBalance(ownerTokenAccount);
			console.log(`\nVerifying NFT ownership...`);
			console.log(`Token Account Balance: ${ownerTokenBalance.value.uiAmount} NFT`);
			assert.equal(ownerTokenBalance.value.uiAmount, 1, 'Owner should have received 1 NFT');
			console.log(`✅ Ownership verification successful`);
		} catch (err) {
			console.error(`❌ Token verification failed: ${err.message}`);
			throw err;
		}

		// Save NFT mint address for future use
		saveNftMintAddress(mint.publicKey.toString());
		console.log(`NFT mint address saved for future reference`);

		// Fetch updated collection counter value
		try {
			const counterInfo = await program.account.collectionCounter.fetch(collectionCounterPDA);
			console.log(`Updated collection counter value: ${counterInfo.count.toString()}`);
		} catch (err) {
			console.error('Error fetching updated collection counter:', err.message);
		}
	});

	it('other wallets should not be able to mint an NFT', async () => {
		console.log('\n🔒 TEST: Unauthorized wallet attempting to mint an NFT...');

		// Add compute budget instruction
		const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
			units: 300000,
		});

		// Generate a new mint keypair for the NFT
		const mint = Keypair.generate();
		console.log(`Generated new NFT mint for unauthorized test: ${mint.publicKey.toString()}`);

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

		// Get the associated token account for the payer
		const tokenAccount = await getAssociatedTokenAddress(mint.publicKey, OTHER_KEYPAIR.publicKey);
		console.log(`Unauthorized Owner Token Account: ${tokenAccount.toString()}`);

		console.log(`NFT Metadata URI: ${TEST_NFT_INFO.productDetailUri}`);

		console.log('\nPreparing accounts for unauthorized minting attempt...');
		const accounts = {
			mint: mint.publicKey,
			metadata: metadataPDA,
			masterEdition: masterEditionPDA,
			owner: OTHER_KEYPAIR.publicKey,
			ownerTokenAccount: tokenAccount,
			payer: OTHER_KEYPAIR.publicKey, // Using unauthorized payer
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

		console.log('Executing mintNft transaction with unauthorized wallet (expected to fail)...');
		try {
			console.time('Unauthorized Attempt Time');
			const tx = await program.methods
				.mintNft(TEST_NFT_INFO.productDetailUri)
				.accounts(accounts)
				.preInstructions([modifyComputeUnits])
				.signers([OTHER_KEYPAIR, mint])
				.rpc();
			console.timeEnd('Unauthorized Attempt Time');

			console.log(`❌ ERROR: Transaction should have failed but succeeded: ${tx}`);
			throw new Error('Test failed: transaction did not throw an error');
		} catch (err) {
			console.timeEnd('Unauthorized Attempt Time');
			console.log('\n✅ Expected error received from unauthorized mint attempt:');
			console.log('---------------------------------------');
			// console.log(err.message.slice(0, 500) + (err.message.length > 500 ? '...' : ''));
			console.log('---------------------------------------');

			// Check for the specific error
			if (!err.message.includes('UnauthorizedTransactionSigner')) {
				console.error(
					`❌ Unexpected error type. Expected 'UnauthorizedTransactionSigner' but got different error.`
				);
				throw new Error(`Unexpected error: ${err.message}`);
			}

			console.log('✅ Test passed: Unauthorized signer correctly rejected');
		}
	});
});
