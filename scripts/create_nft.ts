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
import { IrysService } from './services/irys.service';
import { NftService } from './services/nft.service';
import { METADATA_PROGRAM_ID, IMAGE_PATH, CERTIFICATE_PATH } from './config/constants';
import { getCollectionAddress } from '../utils/collection_store';
import idl from '../target/idl/collectible_vault.json';
import { CollectibleVault } from '../target/types/collectible_vault';

class NftMinter {
	private readonly connection: Connection;
	private readonly program: anchor.Program<CollectibleVault>;
	private readonly irysService: IrysService;
	private readonly nftService: NftService;
	private readonly wallet: anchor.Wallet;

	constructor(
		private readonly payer: Keypair,
		private readonly altPayer: Keypair
	) {
		this.connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
		this.wallet = new anchor.Wallet(payer);
		
		const provider = new anchor.AnchorProvider(
			this.connection,
			this.wallet,
			{ preflightCommitment: 'confirmed' }
		);
		anchor.setProvider(provider);

		this.program = new anchor.Program<CollectibleVault>(idl as CollectibleVault, provider);

		this.irysService = new IrysService(payer, this.connection.rpcEndpoint);
		this.nftService = new NftService(this.irysService, this.wallet);
	}

	private async deriveAccounts(mint: Keypair): Promise<any> {
		const collectionMint = getCollectionAddress();

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

		// Collection PDAs
		const [collectionMetadataPDA] = PublicKey.findProgramAddressSync(
			[
				Buffer.from('metadata'),
				METADATA_PROGRAM_ID.toBuffer(),
				collectionMint.toBuffer(),
			],
			METADATA_PROGRAM_ID
		);

		const [collectionMasterEditionPDA] = PublicKey.findProgramAddressSync(
			[
				Buffer.from('metadata'),
				METADATA_PROGRAM_ID.toBuffer(),
				collectionMint.toBuffer(),
				Buffer.from('edition'),
			],
			METADATA_PROGRAM_ID
		);

		const [collectionCounterPDA] = PublicKey.findProgramAddressSync(
			[Buffer.from('vault_collection_counter')],
			this.program.programId
		);

		const ownerTokenAccount = await getAssociatedTokenAddress(
			mint.publicKey,
			this.altPayer.publicKey
		);

		console.log("owner address", this.altPayer.publicKey.toBase58());
		console.log("payer address", this.payer.publicKey.toBase58());

		return {
			mint: mint.publicKey,
			metadata: metadataPDA,
			masterEdition: masterEditionPDA,
			owner: this.altPayer.publicKey,
			ownerTokenAccount,
			payer: this.payer.publicKey,
			systemProgram: SystemProgram.programId,
			tokenProgram: TOKEN_PROGRAM_ID,
			associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
			rent: SYSVAR_RENT_PUBKEY,
			tokenMetadataProgram: METADATA_PROGRAM_ID,
			collection: collectionMetadataPDA,
			collectionMint,
			collectionMetadata: collectionMetadataPDA,
			collectionMasterEdition: collectionMasterEditionPDA,
			collectionCounter: collectionCounterPDA,
		};
	}

	private async getCollectionCounter(): Promise<number> {
		const [collectionCounterPDA] = PublicKey.findProgramAddressSync(
			[Buffer.from('vault_collection_counter')],
			this.program.programId
		);

		const counterAccount = await this.program.account.collectionCounter.fetch(collectionCounterPDA);

		console.log("collection counter", counterAccount.count.toNumber());
		return counterAccount.count.toNumber();
	}

	async mintNft(): Promise<void> {
		try {
			// Get current counter value
			const currentCount = await this.getCollectionCounter();
			const nextItemNumber = currentCount + 1; // Since it will be incremented in the mint instruction

			// Initialize Irys
			await this.irysService.initialize();
			console.log(`Current irys balance: ${await this.irysService.getBalance()} SOL`);

			// Upload image and metadata with the next item number
			const imageUrl = await this.nftService.uploadImage(IMAGE_PATH);
			console.log(`Image uploaded to: ${imageUrl}`);

			const certificateUrl = await this.nftService.uploadImage(CERTIFICATE_PATH);
			console.log(`Certificate uploaded to: ${certificateUrl}`);

			const metadataUrl = await this.nftService.uploadMetadata(
				imageUrl, 
				[certificateUrl, imageUrl],
				nextItemNumber
			);
			console.log(`Metadata uploaded to: ${metadataUrl}`);

			// Rest of the minting process...
			const mint = Keypair.generate();
			const accounts = await this.deriveAccounts(mint);

			const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
				units: 300000,
			});

			const tx = await this.program.methods
				.mintNft(metadataUrl)
				.accounts(accounts)
				.preInstructions([modifyComputeUnits])
				.signers([this.payer, mint])
				.rpc();

			this.logSuccess(tx, mint.publicKey, nextItemNumber);
		} catch (error) {
			console.error('Error in mintNft:', error);
			throw error;
		}
	}

	private logSuccess(tx: string, mintPubkey: PublicKey, itemNumber: number): void {
		console.log('✅ NFT Minted Successfully!');
		console.log(`Transaction: ${tx}`);
		console.log(`NFT Mint Address: ${mintPubkey.toBase58()}`);
		console.log(`Owner Address: ${this.altPayer.publicKey.toBase58()}`);
		console.log(`Item Number: ${itemNumber}`);
	}
}

async function main() {
	try {
		const minter = new NftMinter(
			getPayerKeypair(),
			getAlternativePayerKeypair()
		);
		await minter.mintNft();
	} catch (error) {
		console.error('Failed to mint NFT:', error);
		process.exit(1);
	}
}

main();
