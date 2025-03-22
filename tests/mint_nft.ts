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

export const METADATA_PROGRAM_ID: PublicKey = new PublicKey(
	'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
);
describe('integration tests for minting an NFT', () => {
	const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
	const payerKeypair = getPayerKeypair();
	const altPayerKeypair = getAlternativePayerKeypair();

	const wallet = new anchor.Wallet(payerKeypair);
	const provider = new anchor.AnchorProvider(connection, wallet, {
		preflightCommitment: 'confirmed',
	});

	anchor.setProvider(provider);
	const program = new anchor.Program<CollectibleVault>(idl as CollectibleVault, provider);

	let collectionMint: Keypair;
	let metadataPDA: PublicKey;
	let masterEditionAddress: PublicKey;
	let collectionCounterPDA: PublicKey;

	before(async () => {
		collectionMint = Keypair.generate();

		// Derive PDA for metadata and master edition
		const [metadata] = await PublicKey.findProgramAddress(
			[
				Buffer.from('metadata'),
				METADATA_PROGRAM_ID.toBuffer(),
				collectionMint.publicKey.toBuffer(),
			],
			METADATA_PROGRAM_ID
		);

		metadataPDA = metadata;

		const [masterEdition] = await PublicKey.findProgramAddress(
			[
				Buffer.from('metadata'),
				METADATA_PROGRAM_ID.toBuffer(),
				collectionMint.publicKey.toBuffer(),
				Buffer.from('edition'),
			],
			METADATA_PROGRAM_ID
		);
		masterEditionAddress = masterEdition;

		const [collectionCounter] = await PublicKey.findProgramAddress(
			[Buffer.from('collection_counter'), collectionMint.publicKey.toBuffer()],
			program.programId
		);
		collectionCounterPDA = collectionCounter;

		// Generate the associated token account for the mint
		const tokenAccount = await getAssociatedTokenAddress(
			collectionMint.publicKey,
			payerKeypair.publicKey
		);
		const tx = await program.rpc.createCollection({
			accounts: {
				mint: collectionMint.publicKey,
				metadata: metadataPDA,
				tokenAccount: tokenAccount,
				payer: payerKeypair.publicKey,
				systemProgram: SystemProgram.programId,
				tokenProgram: TOKEN_PROGRAM_ID,
				associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
				rent: anchor.web3.SYSVAR_RENT_PUBKEY,
				tokenMetadataProgram: METADATA_PROGRAM_ID,
				masterEdition: masterEditionAddress,
				collectionCounter: collectionCounterPDA,
			},
			signers: [collectionMint, payerKeypair],
		});

		console.log(`Collection created! Transaction: ${tx}`);
		console.log(`Collection Mint Address: ${collectionMint.publicKey.toString()}`);
		console.log(`Metadata Address: ${metadataPDA.toString()}`);
		console.log(`Master Edition Address: ${masterEditionAddress.toString()}`);
		console.log(`Collection Counter Address: ${collectionCounterPDA.toString()}`);
	});

	it('admin wallet should be able to mint an NFT', async () => {
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
			[
				Buffer.from('metadata'),
				METADATA_PROGRAM_ID.toBuffer(),
				collectionMint.publicKey.toBuffer(),
			],
			METADATA_PROGRAM_ID
		);

		// Derive collection master edition PDA
		const [collectionMasterEditionPDA] = PublicKey.findProgramAddressSync(
			[
				Buffer.from('metadata'),
				METADATA_PROGRAM_ID.toBuffer(),
				collectionMint.publicKey.toBuffer(),
				Buffer.from('edition'),
			],
			METADATA_PROGRAM_ID
		);

		// Get the associated token account for the payer
		const tokenAccount = await getAssociatedTokenAddress(mint.publicKey, payerKeypair.publicKey);

		const accounts = {
			mint: mint.publicKey,
			metadata: metadataPDA,
			masterEdition: masterEditionPDA,
			tokenAccount: tokenAccount,
			payer: payerKeypair.publicKey,
			systemProgram: SystemProgram.programId,
			tokenProgram: TOKEN_PROGRAM_ID,
			associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
			rent: SYSVAR_RENT_PUBKEY,
			tokenMetadataProgram: METADATA_PROGRAM_ID,
			collection: collectionMetadataPDA, // This is the same as collectionMetadata if you refactored
			collectionMint: collectionMint.publicKey,
			collectionMetadata: collectionMetadataPDA,
			collectionMasterEdition: collectionMasterEditionPDA,
			collectionCounter: collectionCounterPDA,
		};

		const tx = await program.methods
			.mintNft('https://metadata.y00ts.com/y/6869.json')
			.accounts(accounts)
			.preInstructions([modifyComputeUnits])
			.signers([payerKeypair, mint])
			.rpc();

		console.log(`✅ Individual NFT Created! TX: ${tx}`);
		console.log(`NFT Mint Address: ${mint.publicKey.toBase58()}`);
	});

	it('admin wallet should be able to mint an NFT', async () => {
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
			[
				Buffer.from('metadata'),
				METADATA_PROGRAM_ID.toBuffer(),
				collectionMint.publicKey.toBuffer(),
			],
			METADATA_PROGRAM_ID
		);

		// Derive collection master edition PDA
		const [collectionMasterEditionPDA] = PublicKey.findProgramAddressSync(
			[
				Buffer.from('metadata'),
				METADATA_PROGRAM_ID.toBuffer(),
				collectionMint.publicKey.toBuffer(),
				Buffer.from('edition'),
			],
			METADATA_PROGRAM_ID
		);

		// Get the associated token account for the payer
		const tokenAccount = await getAssociatedTokenAddress(mint.publicKey, altPayerKeypair.publicKey);

		const accounts = {
			mint: mint.publicKey,
			metadata: metadataPDA,
			masterEdition: masterEditionPDA,
			tokenAccount: tokenAccount,
			payer: altPayerKeypair.publicKey,
			systemProgram: SystemProgram.programId,
			tokenProgram: TOKEN_PROGRAM_ID,
			associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
			rent: SYSVAR_RENT_PUBKEY,
			tokenMetadataProgram: METADATA_PROGRAM_ID,
			collection: collectionMetadataPDA, // This is the same as collectionMetadata if you refactored
			collectionMint: collectionMint.publicKey,
			collectionMetadata: collectionMetadataPDA,
			collectionMasterEdition: collectionMasterEditionPDA,
			collectionCounter: collectionCounterPDA,
		};

		try {
			const tx = await program.methods
				.mintNft('https://metadata.y00ts.com/y/6869.json')
				.accounts(accounts)
				.preInstructions([modifyComputeUnits])
				.signers([altPayerKeypair, mint])
				.rpc();

			console.log(`✅ Individual NFT Created! TX: ${tx}`);
			console.log(`NFT Mint Address: ${mint.publicKey.toBase58()}`);

			// If it does not throw, fail the test
			throw new Error('Test failed: transaction did not throw an error');
		} catch (err) {
			console.log('Expected error:', err);

			// Ensure the error matches the expected UnauthorizedTransactionSigner error
			if (!err.message.includes('UnauthorizedTransactionSigner')) {
				throw new Error(`Unexpected error: ${err.message}`);
			}
		}
	});
});
