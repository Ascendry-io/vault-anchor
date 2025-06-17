import * as anchor from '@coral-xyz/anchor';
import idl from '../target/idl/collectible_vault.json'; // Import the IDL JSON
import { CollectibleVault } from '../target/types/collectible_vault';
import {
	TOKEN_PROGRAM_ID,
	ASSOCIATED_TOKEN_PROGRAM_ID,
	getAccount,
	getAssociatedTokenAddress,
} from '@solana/spl-token';
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { expect } from 'chai';
import { PAYER_KEYPAIR, ALTERNATIVE_PAYER_KEYPAIR } from '../utils/testing-keypairs';
import { TEST_RPC_CONNECTION } from './constants';
import { mintNft } from './mint_nft_util';

describe('testing asset redemption', () => {
	const ADMIN_KEYPAIR = PAYER_KEYPAIR;
	const OTHER_KEYPAIR = ALTERNATIVE_PAYER_KEYPAIR;
	let nftMint: PublicKey;

	const wallet = new anchor.Wallet(ADMIN_KEYPAIR);
	const provider = new anchor.AnchorProvider(TEST_RPC_CONNECTION, wallet, {
		preflightCommitment: 'confirmed',
	});

	anchor.setProvider(provider);
	const program = new anchor.Program<CollectibleVault>(idl as CollectibleVault, provider);

	let ownerNftAccount: PublicKey;
	let vaultNftAccount: PublicKey;
	let assetRedemptionInfo: PublicKey;
	let vaultAuthority: PublicKey;

	before(async () => {
		// Mint a new NFT for testing
		nftMint = await mintNft(OTHER_KEYPAIR.publicKey);
		console.log(`Test NFT Mint: ${nftMint.toString()}`);

		// Find vault authority PDA
		[vaultAuthority] = PublicKey.findProgramAddressSync(
			[Buffer.from('asset_redemption_vault')],
			program.programId
		);

		// Find asset redemption info PDA
		[assetRedemptionInfo] = PublicKey.findProgramAddressSync(
			[Buffer.from('asset_redemption_info'), nftMint.toBuffer()],
			program.programId
		);

		// Find vault NFT account
		vaultNftAccount = await anchor.utils.token.associatedAddress({
			mint: nftMint,
			owner: vaultAuthority,
		});

		ownerNftAccount = await getAssociatedTokenAddress(nftMint, OTHER_KEYPAIR.publicKey);
		console.log(`Owner's NFT Account: ${ownerNftAccount.toString()}`);
	});

	describe('Testing createAssetRedemptionRequest', () => {
		it('Nft Owner can create asset redemption request and cancellation', async () => {
			const accounts = {
				assetRedemptionInfo: assetRedemptionInfo,
				nftMint: nftMint,
				ownerNftAccount: ownerNftAccount,
				assetRedemptionNftAccount: vaultNftAccount,
				assetRedemptionVault: vaultAuthority,
				owner: OTHER_KEYPAIR.publicKey,
				systemProgram: SystemProgram.programId,
				tokenProgram: TOKEN_PROGRAM_ID,
				associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
				rent: SYSVAR_RENT_PUBKEY,
			};

			try {
				console.log('Creating asset redemption request...');
				const tx = await program.methods
					.createAssetRedemptionRequest()
					.accounts(accounts)
					.signers([OTHER_KEYPAIR])
					.rpc();

				console.log('Waiting for transaction confirmation...');
				await provider.connection.confirmTransaction(tx);
				console.log('Transaction confirmed!');

				console.log('Checking vault account...');
				const vaultAccount1 = await getAccount(provider.connection, vaultNftAccount);
				console.log(`Vault account balance: ${vaultAccount1.amount.toString()}`);
				expect(vaultAccount1.amount.toString()).to.equal('1');

				console.log('Checking owner account...');
				const ownerAccount1 = await getAccount(provider.connection, ownerNftAccount);
				console.log(`Owner account balance: ${ownerAccount1.amount.toString()}`);
				expect(ownerAccount1.amount.toString()).to.equal('0');

				console.log('Checking redemption info...');
				const redemptionInfo1 = await program.account.assetRedemptionInfo.fetch(
					assetRedemptionInfo
				);
				console.log(`Redemption info: ${JSON.stringify(redemptionInfo1, null, 2)}`);
				expect(redemptionInfo1.nftMint.toString()).to.equal(nftMint.toString());
				expect(redemptionInfo1.nftOwner.toString()).to.equal(OTHER_KEYPAIR.publicKey.toString());
				expect(redemptionInfo1.requestTimestamp.toNumber()).to.be.greaterThan(0);
				expect(redemptionInfo1.isFulfilled).to.be.false;

				console.log('Cancelling asset redemption request...');
				const cancelRequestTx = await program.methods
					.cancelAssetRedemptionRequest()
					.accounts(accounts)
					.signers([OTHER_KEYPAIR])
					.rpc();

				console.log('Waiting for cancel transaction confirmation...');
				await provider.connection.confirmTransaction(cancelRequestTx);
				console.log('Cancel transaction confirmed!');

				// After cancellation, the vault account is closed, so we only check the owner's account
				console.log('Checking final owner account...');
				const ownerAccount2 = await getAccount(provider.connection, ownerNftAccount);
				console.log(`Final owner account balance: ${ownerAccount2.amount.toString()}`);
				expect(ownerAccount2.amount.toString()).to.equal('1');

				// Verify the redemption info account is closed
				try {
					await program.account.assetRedemptionInfo.fetch(assetRedemptionInfo);
					throw new Error('Redemption info account should be closed');
				} catch (e) {
					if (e.message === 'Redemption info account should be closed') {
						throw e;
					}
					// Account not found error is expected
					console.log('Redemption info account successfully closed');
				}
			} catch (error) {
				console.error('Test failed with error:', error);
				throw error;
			}
		});
	});
});
