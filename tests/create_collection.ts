import * as anchor from '@coral-xyz/anchor';
import { Keypair, PublicKey, Connection, clusterApiUrl, SystemProgram } from '@solana/web3.js';
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
describe('Create Collection', () => {
	const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
	const payerWallet = getPayerKeypair();
	const altPayerKeypair = getAlternativePayerKeypair();

	const wallet = new anchor.Wallet(payerWallet);
	const provider = new anchor.AnchorProvider(connection, wallet, {
		preflightCommitment: 'confirmed',
	});

	anchor.setProvider(provider);
	const program = new anchor.Program<CollectibleVault>(idl as CollectibleVault, provider);

	let mint: Keypair;
	let metadataPDA: PublicKey;
	let masterEditionAddress: PublicKey;
	let collectionCounterPDA: PublicKey;

	before(async () => {
		mint = Keypair.generate();

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

		const [collectionCounter] = await PublicKey.findProgramAddress(
			[Buffer.from('collection_counter'), mint.publicKey.toBuffer()],
			program.programId
		);
		collectionCounterPDA = collectionCounter;
	});

	it('should fail to create a collection with UnauthorizedTransactionSigner', async () => {
		const tokenAccount = await getAssociatedTokenAddress(mint.publicKey, altPayerKeypair.publicKey);

		try {
			await program.rpc.createCollection({
				accounts: {
					mint: mint.publicKey,
					metadata: metadataPDA,
					tokenAccount: tokenAccount,
					payer: altPayerKeypair.publicKey, // This is an unauthorized payer
					systemProgram: SystemProgram.programId,
					tokenProgram: TOKEN_PROGRAM_ID,
					associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
					rent: anchor.web3.SYSVAR_RENT_PUBKEY,
					tokenMetadataProgram: METADATA_PROGRAM_ID,
					masterEdition: masterEditionAddress,
					collectionCounter: collectionCounterPDA,
				},
				signers: [mint, altPayerKeypair],
			});

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

	it('should create a collection', async () => {
		// Generate the associated token account for the mint
		const tokenAccount = await getAssociatedTokenAddress(mint.publicKey, payerWallet.publicKey);
		const tx = await program.rpc.createCollection({
			accounts: {
				mint: mint.publicKey,
				metadata: metadataPDA,
				tokenAccount: tokenAccount,
				payer: payerWallet.publicKey,
				systemProgram: SystemProgram.programId,
				tokenProgram: TOKEN_PROGRAM_ID,
				associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
				rent: anchor.web3.SYSVAR_RENT_PUBKEY,
				tokenMetadataProgram: METADATA_PROGRAM_ID,
				masterEdition: masterEditionAddress,
				collectionCounter: collectionCounterPDA,
			},
			signers: [mint, payerWallet],
		});

		console.log(`Collection created! Transaction: ${tx}`);
		console.log(`Collection Mint Address: ${mint.publicKey.toString()}`);
		console.log(`Metadata Address: ${metadataPDA.toString()}`);
		console.log(`Master Edition Address: ${masterEditionAddress.toString()}`);
		console.log(`Collection Counter Address: ${collectionCounterPDA.toString()}`);
	});
});
