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
import { assert } from 'chai';
import { getCollectionAddress, saveNftMintAddress } from '../utils/collection_store';

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

	let collectionMint: PublicKey;
	let metadataPDA: PublicKey;
	let masterEditionAddress: PublicKey;
	let collectionCounterPDA: PublicKey;

	before(async () => {
		// Get the existing collection address
		collectionMint = getCollectionAddress();

		// Derive PDAs
		[metadataPDA] = await PublicKey.findProgramAddress(
			[Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), collectionMint.toBuffer()],
			METADATA_PROGRAM_ID
		);

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
			.mintNft(
				'https://metadata.y00ts.com/y/6869.json',
			)
			.accounts(accounts)
			.preInstructions([modifyComputeUnits])
			.signers([payerKeypair, mint])
			.rpc();

		console.log(`✅ Individual NFT Created! TX: ${tx}`);
		console.log(`NFT Mint Address: ${mint.publicKey.toBase58()}`);
		console.log(`Owner Address: ${altPayerKeypair.publicKey.toBase58()}`);

		// Verify the owner received the NFT
		const ownerTokenBalance = await connection.getTokenAccountBalance(ownerTokenAccount);
		assert.equal(ownerTokenBalance.value.uiAmount, 1);
		saveNftMintAddress(mint.publicKey.toBase58());

	});

	it('other wallets should not be able to mint an NFT', async () => {
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

		// Get the associated token account for the payer
		const tokenAccount = await getAssociatedTokenAddress(mint.publicKey, altPayerKeypair.publicKey);

		const accounts = {
			mint: mint.publicKey,
			metadata: metadataPDA,
			masterEdition: masterEditionPDA,
			owner: altPayerKeypair.publicKey,      // The recipient of the NFT
			ownerTokenAccount: tokenAccount,  // Where the NFT will be sent
			payer: altPayerKeypair.publicKey,
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
