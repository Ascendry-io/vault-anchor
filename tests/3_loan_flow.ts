import * as anchor from '@coral-xyz/anchor';
import { Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import {
	TOKEN_PROGRAM_ID,
	getAssociatedTokenAddress,
	ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { PAYER_KEYPAIR, ALTERNATIVE_PAYER_KEYPAIR } from '../utils/testing-keypairs';
import { CollectibleVault } from '../target/types/collectible_vault';
import { assert } from 'chai';
import { getCollectionAddress, getNftAddress } from '../utils/collection_store';
import { formatSOL, logBalances, getBalances, logBalanceChanges } from './test-utils';
import { TEST_RPC_CONNECTION } from './constants';

async function stakeNftForLoan(
	program: anchor.Program<CollectibleVault>,
	{
		nftOwner,
		nftMint,
		ownerNftAccount,
		vaultNftAccount,
		vaultAuthority,
		loanInfoPDA,
		loanAmount = new anchor.BN(1 * anchor.web3.LAMPORTS_PER_SOL),
		interestAmount = new anchor.BN(0.25 * anchor.web3.LAMPORTS_PER_SOL),
		duration = new anchor.BN(24 * 60 * 60), // 1 day default
	}: {
		nftOwner: Keypair;
		nftMint: PublicKey;
		ownerNftAccount: PublicKey;
		vaultNftAccount: PublicKey;
		vaultAuthority: PublicKey;
		loanInfoPDA: PublicKey;
		loanAmount?: anchor.BN;
		interestAmount?: anchor.BN;
		duration?: anchor.BN;
	}
) {
	console.log('\nStaking NFT for loan...');
	console.log(`Loan Amount: ${formatSOL(loanAmount)}`);
	console.log(`Interest Amount: ${formatSOL(interestAmount)}`);
	console.log(`Duration: ${duration.toString()} seconds`);

	await program.methods
		.stakeNftForLoan(loanAmount, interestAmount, duration)
		.accounts({
			loanInfo: loanInfoPDA,
			nftMint: nftMint,
			ownerNftAccount: ownerNftAccount,
			vaultNftAccount: vaultNftAccount,
			vaultAuthority,
			owner: nftOwner.publicKey,
			systemProgram: SystemProgram.programId,
			tokenProgram: TOKEN_PROGRAM_ID,
			associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
			rent: SYSVAR_RENT_PUBKEY,
		})
		.signers([nftOwner])
		.rpc();

	// Verify NFT is in vault
	const vaultAccount = await program.provider.connection.getTokenAccountBalance(vaultNftAccount);
	console.log(`NFT tokens in vault: ${vaultAccount.value.uiAmount}`);
	assert.equal(vaultAccount.value.uiAmount, 1, 'NFT should be in the vault');
}

async function provideLoanLiquidity(
	program: anchor.Program<CollectibleVault>,
	{
		lender,
		borrower,
		loanInfoPDA,
	}: {
		lender: Keypair;
		borrower: PublicKey;
		loanInfoPDA: PublicKey;
	}
) {
	console.log('\nProviding loan liquidity...');

	// Log balances before
	const balancesBefore = await getBalances(program, [
		{ key: borrower, label: 'Borrower' },
		{ key: lender.publicKey, label: 'Lender' },
	]);

	await program.methods
		.provideLoanLiquidity()
		.accounts({
			loanInfo: loanInfoPDA,
			lender: lender.publicKey,
			borrower: borrower,
			systemProgram: SystemProgram.programId,
		})
		.signers([lender])
		.rpc();

	// Log balances after
	const balancesAfter = await getBalances(program, [
		{ key: borrower, label: 'Borrower' },
		{ key: lender.publicKey, label: 'Lender' },
	]);

	// Log changes
	logBalanceChanges(balancesBefore, balancesAfter);
}

describe('NFT Loan Flow Tests', () => {
	// Set up test banner for better visibility in logs
	before(() => {
		console.log('\n========================================');
		console.log('🧪 STARTING NFT LOAN FLOW TESTS');
		console.log('========================================\n');
	});

	after(() => {
		console.log('\n========================================');
		console.log('✅ NFT LOAN FLOW TESTS COMPLETED');
		console.log('========================================\n');
	});

	const nftOwner = ALTERNATIVE_PAYER_KEYPAIR; // NFT owner who wants a loan
	const lender = PAYER_KEYPAIR; // Person providing the loan

	// Log key information about test participants
	console.log('Test participants:');
	console.log(`NFT Owner: ${nftOwner.publicKey.toString()}`);
	console.log(`Lender: ${lender.publicKey.toString()}`);

	const wallet = new anchor.Wallet(nftOwner);
	const provider = new anchor.AnchorProvider(TEST_RPC_CONNECTION, wallet, {});
	anchor.setProvider(provider);

	const program = anchor.workspace.CollectibleVault as anchor.Program<CollectibleVault>;
	console.log(`Program ID: ${program.programId.toString()}`);

	let nftMint: PublicKey;
	let ownerNftAccount: PublicKey;
	let vaultNftAccount: PublicKey;
	let lenderNftAccount: PublicKey;
	let vaultAuthority: PublicKey;
	let loanInfoPDA: PublicKey;
	let collectionMint: PublicKey;

	before(async () => {
		console.log('\n📋 Setting up test accounts and PDAs...');

		// Get existing collection
		collectionMint = getCollectionAddress();
		console.log(`Collection Mint: ${collectionMint.toString()}`);

		// Create NFT
		nftMint = getNftAddress();
		console.log(`NFT Mint: ${nftMint.toString()}`);

		ownerNftAccount = await getAssociatedTokenAddress(nftMint, nftOwner.publicKey);
		console.log(`Owner's NFT Account: ${ownerNftAccount.toString()}`);

		// Derive vault authority PDA
		[vaultAuthority] = await PublicKey.findProgramAddressSync(
			[Buffer.from('vault')],
			program.programId
		);
		console.log(`Vault Authority PDA: ${vaultAuthority.toString()}`);

		// Derive vault NFT account
		vaultNftAccount = await getAssociatedTokenAddress(nftMint, vaultAuthority, true);
		console.log(`Vault NFT Account: ${vaultNftAccount.toString()}`);

		// Derive lender's NFT account
		lenderNftAccount = await getAssociatedTokenAddress(nftMint, lender.publicKey);
		console.log(`Lender's NFT Account: ${lenderNftAccount.toString()}`);

		// Derive loan info PDA
		[loanInfoPDA] = await PublicKey.findProgramAddressSync(
			[Buffer.from('loan'), nftMint.toBuffer()],
			program.programId
		);
		console.log(`Loan Info PDA: ${loanInfoPDA.toString()}`);

		// Log initial balances
		await logBalances(
			TEST_RPC_CONNECTION,
			[nftOwner.publicKey, lender.publicKey],
			['NFT Owner', 'Lender']
		);
	});

	/**
	 * Test: Stake NFT for loan and then cancel it
	 * Flow:
	 * 1. NFT owner stakes their NFT for a loan
	 * 2. NFT owner cancels the loan request
	 * 3. Verify NFT is returned to owner
	 * 4. Verify loan and vault accounts are closed
	 */
	it('should stake NFT for loan and then cancel it', async () => {
		await stakeNftForLoan(program, {
			nftOwner,
			nftMint,
			ownerNftAccount,
			vaultNftAccount,
			vaultAuthority,
			loanInfoPDA,
		});

		// Then cancel the loan request
		console.log('\n❌ TEST: Canceling loan request...');
		await program.methods
			.cancelLoanRequest()
			.accounts({
				owner: nftOwner.publicKey,
				loanInfo: loanInfoPDA,
				nftMint: nftMint,
				ownerNftAccount: ownerNftAccount,
				vaultNftAccount: vaultNftAccount,
				vaultAuthority,
				tokenProgram: TOKEN_PROGRAM_ID,
				associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
				systemProgram: SystemProgram.programId,
			})
			.signers([nftOwner])
			.rpc();

		// Verify NFT returned and accounts closed
		const ownerAccount = await provider.connection.getTokenAccountBalance(ownerNftAccount);
		console.log(`NFT tokens in owner's account after cancel: ${ownerAccount.value.uiAmount}`);
		assert.equal(ownerAccount.value.uiAmount, 1, 'NFT should be returned to owner');

		// Verify loan account is closed
		try {
			await program.account.loanInfo.fetch(loanInfoPDA);
			assert.fail('Loan account should be closed');
		} catch (error) {
			assert.include(error.message, 'Account does not exist', 'Expected loan account to be closed');
		}

		// Verify vault account is closed
		try {
			await provider.connection.getTokenAccountBalance(vaultNftAccount);
			assert.fail('Vault token account should be closed');
		} catch (error) {
			assert.include(
				error.message,
				'failed to get token account balance',
				'Expected vault token account to be closed'
			);
		}

		console.log('✅ Loan request successfully canceled');
	});

	/**
	 * Test: Provide loan liquidity
	 * Flow:
	 * 1. NFT owner stakes their NFT for a loan
	 * 2. Lender provides the loan amount
	 * 3. Verify balances are updated correctly
	 */
	it('should provide loan liquidity', async () => {
		await stakeNftForLoan(program, {
			nftOwner,
			nftMint,
			ownerNftAccount,
			vaultNftAccount,
			vaultAuthority,
			loanInfoPDA,
		});

		await provideLoanLiquidity(program, {
			lender,
			borrower: nftOwner.publicKey,
			loanInfoPDA,
		});
	});

	/**
	 * Test: Repay loan and return NFT
	 * Flow:
	 * 1. Check initial balances
	 * 2. Lender attempt to claim NFT before repayment (should fail)
	 * 3. NFT owner repays the loan (principal + interest)
	 * 4. Verify lender receives correct amount
	 * 5. Verify NFT is returned to owner
	 */
	it('should repay loan and return NFT', async () => {
		console.log('\n💸 TEST: Repaying loan and returning NFT...');

		// Check balances before repayment
		console.log('Balances before loan repayment:');
		const lenderBalanceBefore = await provider.connection.getBalance(lender.publicKey);
		const borrowerBalanceBefore = await provider.connection.getBalance(nftOwner.publicKey);
		console.log(`Lender: ${formatSOL(lenderBalanceBefore)}`);
		console.log(`NFT Owner (Borrower): ${formatSOL(borrowerBalanceBefore)}`);

		// Try to claim NFT before repayment (should fail)
		console.log('\nAttempting to claim NFT before repayment (should fail)...');
		try {
			await program.methods
				.claimDelinquentNft()
				.accounts({
					loanInfo: loanInfoPDA,
					nftMint: nftMint,
					vaultNftAccount,
					lenderNftAccount,
					vaultAuthority,
					lender: lender.publicKey,
					tokenProgram: TOKEN_PROGRAM_ID,
					associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
					systemProgram: SystemProgram.programId,
					rent: SYSVAR_RENT_PUBKEY,
				})
				.signers([lender])
				.rpc();

			assert.fail('Should have thrown an error when trying to claim NFT before expiration');
		} catch (error) {
			assert.include(error.message, 'LoanNotExpired', 'Should throw LoanNotExpired error');
			console.log('✅ Successfully prevented early NFT claim');
		}

		console.log('Executing repayLoan transaction...');
		await program.methods
			.repayLoan()
			.accounts({
				loanInfo: loanInfoPDA,
				nftMint: nftMint,
				vaultNftAccount,
				borrowerNftAccount: ownerNftAccount,
				vaultAuthority,
				borrower: nftOwner.publicKey,
				lender: lender.publicKey,
				tokenProgram: TOKEN_PROGRAM_ID,
				associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
				systemProgram: SystemProgram.programId,
				rent: SYSVAR_RENT_PUBKEY,
			})
			.signers([nftOwner])
			.rpc();

		// Check balances after repayment
		console.log('Balances after loan repayment:');
		const lenderBalanceAfter = await provider.connection.getBalance(lender.publicKey);
		const borrowerBalanceAfter = await provider.connection.getBalance(nftOwner.publicKey);
		console.log(`Lender: ${formatSOL(lenderBalanceAfter)}`);
		console.log(`NFT Owner (Borrower): ${formatSOL(borrowerBalanceAfter)}`);

		// Calculate differences
		const lenderBalanceDifference = lenderBalanceAfter - lenderBalanceBefore;
		const borrowerBalanceDifference = borrowerBalanceAfter - borrowerBalanceBefore;

		console.log(`Lender balance change: ${formatSOL(lenderBalanceDifference)}`);
		console.log(`Borrower balance change: ${formatSOL(borrowerBalanceDifference)}`);

		// Expected repayment: 1 SOL principal + 0.25 SOL interest = 1.25 SOL
		const minExpectedRepayment = 1.24 * anchor.web3.LAMPORTS_PER_SOL;
		const maxExpectedRepayment = 1.26 * anchor.web3.LAMPORTS_PER_SOL;

		// Assert that lender received 1.25 SOL (accounting for small variations due to rent)
		assert.isTrue(
			lenderBalanceDifference >= minExpectedRepayment &&
				lenderBalanceDifference <= maxExpectedRepayment,
			`Lender should receive 1.25 SOL back but got ${formatSOL(lenderBalanceDifference)}`
		);

		// Verify NFT is back with owner
		const ownerAccount = await provider.connection.getTokenAccountBalance(ownerNftAccount);
		console.log(`NFT tokens in owner's account: ${ownerAccount.value.uiAmount}`);
		assert.equal(ownerAccount.value.uiAmount, 1, 'NFT should be returned to owner');

		console.log('✅ Loan successfully repaid and NFT returned');
	});

	/**
	 * Test: Claim delinquent NFT after loan expires
	 * Flow:
	 * 1. NFT owner stakes NFT for a very short loan (1 second)
	 * 2. Lender provides loan amount
	 * 3. Wait for loan to expire
	 * 4. Lender claims the delinquent NFT
	 * 5. Verify NFT is transferred to lender
	 */
	it('should allow lender to claim NFT after loan expires', async () => {
		console.log('\n⏱️ TEST: Claiming NFT after loan expiration...');

		// First stake NFT again
		const loanAmount = new anchor.BN(1 * anchor.web3.LAMPORTS_PER_SOL);
		const interestAmount = new anchor.BN(0.25 * anchor.web3.LAMPORTS_PER_SOL);
		const duration = new anchor.BN(1); // 1 second duration for testing

		console.log(`Setting up quick-expiring loan (${duration} second duration)...`);
		console.log(`Loan Amount: ${formatSOL(loanAmount)}`);
		console.log(`Interest Amount: ${formatSOL(interestAmount)}`);

		console.log('Executing stakeNftForLoan transaction...');
		await program.methods
			.stakeNftForLoan(loanAmount, interestAmount, duration)
			.accounts({
				loanInfo: loanInfoPDA,
				nftMint: nftMint,
				ownerNftAccount: ownerNftAccount,
				vaultNftAccount: vaultNftAccount,
				vaultAuthority,
				owner: nftOwner.publicKey,
				systemProgram: SystemProgram.programId,
				tokenProgram: TOKEN_PROGRAM_ID,
				associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
				rent: SYSVAR_RENT_PUBKEY,
			})
			.signers([nftOwner])
			.rpc();

		// Provide liquidity
		console.log('Executing provideLoanLiquidity transaction...');
		await program.methods
			.provideLoanLiquidity()
			.accounts({
				loanInfo: loanInfoPDA,
				lender: lender.publicKey,
				borrower: nftOwner.publicKey,
				systemProgram: SystemProgram.programId,
			})
			.signers([lender])
			.rpc();

		// Wait for loan to expire
		const waitTimeMs = 2000; // 2 seconds
		console.log(`Waiting ${waitTimeMs / 1000} seconds for loan to expire...`);
		await new Promise((resolve) => setTimeout(resolve, waitTimeMs));
		console.log('Loan period has expired');

		// Check NFT ownership before claim
		try {
			const vaultAccountBefore = await provider.connection.getTokenAccountBalance(vaultNftAccount);
			console.log(`NFT tokens in vault before claim: ${vaultAccountBefore.value.uiAmount}`);
		} catch (err) {
			console.log('Could not read vault NFT account - it may not exist yet');
		}

		// Claim NFT
		console.log('Executing claimDelinquentNft transaction...');
		const res = await program.methods
			.claimDelinquentNft()
			.accounts({
				loanInfo: loanInfoPDA,
				nftMint: nftMint,
				vaultNftAccount,
				lenderNftAccount,
				vaultAuthority,
				lender: lender.publicKey,
				tokenProgram: TOKEN_PROGRAM_ID,
				associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
				systemProgram: SystemProgram.programId,
				rent: SYSVAR_RENT_PUBKEY,
			})
			.signers([lender])
			.rpc();
		console.log(res);
		// Verify NFT is with lender
		const lenderAccount = await provider.connection.getTokenAccountBalance(lenderNftAccount);
		console.log(`NFT tokens in lender's account: ${lenderAccount.value.uiAmount}`);
		assert.equal(lenderAccount.value.uiAmount, 1, 'Lender should have claimed the NFT');

		console.log('✅ Delinquent NFT successfully claimed by lender');

		// Final balances
		await logBalances(
			TEST_RPC_CONNECTION,
			[nftOwner.publicKey, lender.publicKey],
			['NFT Owner', 'Lender']
		);

		console.log('Sending NFT back to original owner...');
	});
});
