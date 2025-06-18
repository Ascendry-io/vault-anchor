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
			const createAssetRedemptionRequestAccounts = {
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

			console.log('Creating asset redemption request...');
			const createAssetRedemptionRequestTx = await program.methods
				.createAssetRedemptionRequest()
				.accounts(createAssetRedemptionRequestAccounts)
				.signers([OTHER_KEYPAIR])
				.rpc();

			await provider.connection.confirmTransaction(createAssetRedemptionRequestTx);

			const vaultAccount_state1 = await getAccount(provider.connection, vaultNftAccount);
			expect(vaultAccount_state1.amount.toString()).to.equal('1');

			const ownerAccount_state1 = await getAccount(provider.connection, ownerNftAccount);
			expect(ownerAccount_state1.amount.toString()).to.equal('0');

			const redemptionInfo_state1 = await program.account.assetRedemptionInfo.fetch(
				assetRedemptionInfo
			);
			expect(redemptionInfo_state1.nftMint.toString()).to.equal(nftMint.toString());
			expect(redemptionInfo_state1.nftOwner.toString()).to.equal(OTHER_KEYPAIR.publicKey.toString());
			expect(redemptionInfo_state1.requestTimestamp.toNumber()).to.be.greaterThan(0);
			expect(redemptionInfo_state1.isFulfilled).to.be.false;

			// STATE 2: Fulfill Asset Redemption Request - Fails because not admin.
			console.log('Fulfilling asset redemption request (should fail)...');

			const fulfillAssetRedemptionRequestAccounts = {
				assetRedemptionInfo: assetRedemptionInfo,
				nftMint: nftMint,
				admin: OTHER_KEYPAIR.publicKey,
				systemProgram: SystemProgram.programId,
			};
			try {
				const fulfillAssetRedemptionRequestTx = await program.methods
					.fulfillAssetRedemptionRequest()
					.accounts(fulfillAssetRedemptionRequestAccounts)
					.signers([OTHER_KEYPAIR])
					.rpc();
				await provider.connection.confirmTransaction(fulfillAssetRedemptionRequestTx);
				throw new Error('Test should have failed');
			} catch (error) {
				// Fulfilling asset redemption request should fail because not admin.
				expect(error.message).to.include('UnauthorizedRedemptionRequest.');
				console.log('✅ Test passed: Unauthorized signer correctly rejected');
			}

			const cancelAssetRedemptionRequestTx = await program.methods
				.cancelAssetRedemptionRequest()
				.accounts(createAssetRedemptionRequestAccounts)
				.signers([OTHER_KEYPAIR])
				.rpc();

			await provider.connection.confirmTransaction(cancelAssetRedemptionRequestTx);

			// After cancellation, the vault account is closed, so we only check the owner's account
			const ownerAccount_state2 = await getAccount(provider.connection, ownerNftAccount);
			expect(ownerAccount_state2.amount.toString()).to.equal('1');

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
		});
	});

	describe('Testing Asset Redemption Fulfillment', () => {
		it('NFT owner cannot cancel redemption request after fulfillment', async () => {
			const createRedemptionRequestAccounts = {
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
					.accounts(createRedemptionRequestAccounts)
					.signers([OTHER_KEYPAIR])
					.rpc();

				await provider.connection.confirmTransaction(tx);

				// STATE 1: Asset Redemption Request Created
				const vaultAccount_state1 = await getAccount(provider.connection, vaultNftAccount);
				expect(vaultAccount_state1.amount.toString()).to.equal('1');

				const ownerAccount_state1 = await getAccount(provider.connection, ownerNftAccount);
				expect(ownerAccount_state1.amount.toString()).to.equal('0');

				const redemptionInfo_state1 = await program.account.assetRedemptionInfo.fetch(
					assetRedemptionInfo
				);
				expect(redemptionInfo_state1.nftMint.toString()).to.equal(nftMint.toString());
				expect(redemptionInfo_state1.nftOwner.toString()).to.equal(OTHER_KEYPAIR.publicKey.toString());
				expect(redemptionInfo_state1.requestTimestamp.toNumber()).to.be.greaterThan(0);
				expect(redemptionInfo_state1.isFulfilled).to.be.false;

				console.log('Fulfilling asset redemption request...');
				const fulfillAssetRedemptionRequestAccounts = {
					assetRedemptionInfo: assetRedemptionInfo,
					nftMint: nftMint,
					owner: OTHER_KEYPAIR.publicKey,
					systemProgram: SystemProgram.programId,
				};
				const fulfillRequestTx = await program.methods
					.fulfillAssetRedemptionRequest()
					.accounts(fulfillAssetRedemptionRequestAccounts)
					.signers([ADMIN_KEYPAIR])
					.rpc();
				await provider.connection.confirmTransaction(fulfillRequestTx);

				// STATE 2: Asset Redemption Request Fulfilled
				const vaultAccount_state2 = await getAccount(provider.connection, vaultNftAccount);
				expect(vaultAccount_state2.amount.toString()).to.equal('1');

				const ownerAccount_state2 = await getAccount(provider.connection, ownerNftAccount);
				expect(ownerAccount_state2.amount.toString()).to.equal('0');
				const redemptionInfo_state2 = await program.account.assetRedemptionInfo.fetch(
					assetRedemptionInfo
				);
				expect(redemptionInfo_state2.nftMint.toString()).to.equal(nftMint.toString());
				expect(redemptionInfo_state2.nftOwner.toString()).to.equal(OTHER_KEYPAIR.publicKey.toString());
				expect(redemptionInfo_state2.requestTimestamp.toNumber()).to.be.greaterThan(0);
				expect(redemptionInfo_state2.isFulfilled).to.be.true;

				// STATE 3: Asset Redemption Request Cancelled - SHOULD FAIL.
				console.log('Cancelling asset redemption request (should fail)...');
				const cancelRequestTx = await program.methods
					.cancelAssetRedemptionRequest()
					.accounts(createRedemptionRequestAccounts)
					.signers([OTHER_KEYPAIR])
					.rpc();

				await provider.connection.confirmTransaction(cancelRequestTx);

				throw new Error('Test should have failed');
			} catch (error) {
				// Cancelling asset redemption request should fail because the request is already fulfilled.
				expect(error.message).to.include('RedemptionRequestAlreadyFulfilled.');
			}
		});
	});
});
