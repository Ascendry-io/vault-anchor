import * as anchor from '@coral-xyz/anchor';
import {
    clusterApiUrl,
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import {
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { getPayerKeypair, getAlternativePayerKeypair } from '../utils/utils';
import { CollectibleVault } from '../target/types/collectible_vault';
import { assert } from 'chai';
import { getCollectionAddress, getNftAddress } from '../utils/collection_store';

describe('NFT Loan Flow Tests', () => {
	const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
	const nftOwner = getAlternativePayerKeypair();  // NFT owner who wants a loan
	const lender = getPayerKeypair();    // Person providing the loan

	const wallet = new anchor.Wallet(nftOwner);
	const provider = new anchor.AnchorProvider(connection, wallet, {});
	anchor.setProvider(provider);

	const program = anchor.workspace.CollectibleVault as anchor.Program<CollectibleVault>;

	let nftMint: PublicKey;
	let ownerNftAccount: PublicKey;
	let vaultNftAccount: PublicKey;
	let lenderNftAccount: PublicKey;
	let vaultAuthority: PublicKey;
	let loanInfoPDA: PublicKey;
	let collectionMint: PublicKey;

	before(async () => {
		// Get existing collection
		collectionMint = getCollectionAddress();

		// Create NFT
		nftMint = getNftAddress();

		ownerNftAccount = await getAssociatedTokenAddress(
			nftMint,
			nftOwner.publicKey
		);

		// Derive vault authority PDA
		[vaultAuthority] = await PublicKey.findProgramAddressSync(
			[Buffer.from('vault')],
			program.programId
		);

		// Derive vault NFT account
		vaultNftAccount = await getAssociatedTokenAddress(
			nftMint,
			vaultAuthority,
			true
		);

		// Derive lender's NFT account
		lenderNftAccount = await getAssociatedTokenAddress(
			nftMint,
			lender.publicKey
		);


		// Derive loan info PDA
		[loanInfoPDA] = await PublicKey.findProgramAddressSync(
			[Buffer.from('loan'), nftMint.toBuffer()],
			program.programId
		);
	});

	it('should stake NFT for loan', async () => {
		const loanAmount = new anchor.BN(1 * anchor.web3.LAMPORTS_PER_SOL);
		const interestRate = new anchor.BN(500); // 5%
		const duration = new anchor.BN(24 * 60 * 60); // 1 day in seconds

		await program.methods.stakeNftForLoan(
			loanAmount,
			interestRate,
			duration
		)
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
		const vaultAccount = await provider.connection.getTokenAccountBalance(vaultNftAccount);
		assert.equal(vaultAccount.value.uiAmount, 1);
	});

	it('should provide loan liquidity', async () => {
		const nftOwnerBalanceBefore = await provider.connection.getBalance(nftOwner.publicKey);
		const lenderBalanceBefore = await provider.connection.getBalance(lender.publicKey);
        console.log("ownerBalanceBefore", nftOwnerBalanceBefore);
		console.log("lenderBalanceBefore", lenderBalanceBefore);

		await program.methods.provideLoanLiquidity()
			.accounts({
				loanInfo: loanInfoPDA,
				lender: lender.publicKey,
				borrower: nftOwner.publicKey,
				systemProgram: SystemProgram.programId,
			})
			.signers([lender])
			.rpc();

		const ownerBalanceAfter = await provider.connection.getBalance(nftOwner.publicKey);
		const lenderBalanceAfter = await provider.connection.getBalance(lender.publicKey);
        console.log("ownerBalanceAfter", ownerBalanceAfter);
		console.log("lenderBalanceAfter", lenderBalanceAfter);
        
        // Check that balance increased by at least 1 SOL
        const ownerBalanceDifference = ownerBalanceAfter - nftOwnerBalanceBefore;
        assert.isTrue(
            ownerBalanceDifference >= 0.99 * anchor.web3.LAMPORTS_PER_SOL,
            `Balance difference (${ownerBalanceDifference}) should be at least 1 SOL`
        );

		const lenderBalanceDifference = lenderBalanceAfter - lenderBalanceBefore;
		assert.isTrue(
			lenderBalanceDifference >= -1 * anchor.web3.LAMPORTS_PER_SOL,
			`Balance difference (${lenderBalanceDifference}) should be at least 1 SOL`
		);
	});

	it('should repay loan and return NFT', async () => {
		await program.methods.repayLoan()
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

		// Verify NFT is back with owner
		const ownerAccount = await provider.connection.getTokenAccountBalance(ownerNftAccount);
		assert.equal(ownerAccount.value.uiAmount, 1);
	});

	it('should allow lender to claim NFT after loan expires', async () => {
		// First stake NFT again
		const loanAmount = new anchor.BN(1 * anchor.web3.LAMPORTS_PER_SOL);
		const interestRate = new anchor.BN(500);
		const duration = new anchor.BN(1); // 1 second duration for testing

		await program.methods.stakeNftForLoan(
			loanAmount,
			interestRate,
			duration
		)
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
		await program.methods.provideLoanLiquidity()
			.accounts({
				loanInfo: loanInfoPDA,
				lender: lender.publicKey,
				borrower: nftOwner.publicKey,
				systemProgram: SystemProgram.programId,
			})
			.signers([lender])
			.rpc();

		// Wait for loan to expire
		await new Promise(resolve => setTimeout(resolve, 2000));

		// Claim NFT
		await program.methods.claimDelinquentNft()
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

		// Verify NFT is with lender
		const lenderAccount = await provider.connection.getTokenAccountBalance(lenderNftAccount);
		assert.equal(lenderAccount.value.uiAmount, 1);
	});
}); 