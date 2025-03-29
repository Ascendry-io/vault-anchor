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
import { getCollectionAddress } from '../utils/collection_store';
import { METADATA_PROGRAM_ID } from './create_collection';

describe('NFT Loan Flow Tests', () => {
	const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    const payerKeypair = getPayerKeypair();
    const borrowerKeypair = getAlternativePayerKeypair();
    const lenderKeypair = Keypair.generate();

    const wallet = new anchor.Wallet(payerKeypair);
    const provider = new anchor.AnchorProvider(connection, wallet, {});
    anchor.setProvider(provider);

    const program = anchor.workspace.CollectibleVault as anchor.Program<CollectibleVault>;

    let nftMint: Keypair;
    let borrowerNftAccount: PublicKey;
    let vaultNftAccount: PublicKey;
    let lenderNftAccount: PublicKey;
    let vaultAuthority: PublicKey;
    let loanInfoPDA: PublicKey;
    let collectionMint: PublicKey;

    before(async () => {
        // Fund lender wallet
        const fundTx = await provider.connection.requestAirdrop(
            lenderKeypair.publicKey,
            2 * anchor.web3.LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(fundTx);

        // Get existing collection
        collectionMint = getCollectionAddress();

        // Create NFT
        nftMint = Keypair.generate();
        const [metadataPDA] = await PublicKey.findProgramAddressSync(
            [Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), nftMint.publicKey.toBuffer()],
            METADATA_PROGRAM_ID
        );

        const [masterEditionPDA] = await PublicKey.findProgramAddressSync(
            [
                Buffer.from('metadata'),
                METADATA_PROGRAM_ID.toBuffer(),
                nftMint.publicKey.toBuffer(),
                Buffer.from('edition'),
            ],
            METADATA_PROGRAM_ID
        );

        borrowerNftAccount = await getAssociatedTokenAddress(
            nftMint.publicKey,
            borrowerKeypair.publicKey
        );

        // Derive vault authority PDA
        [vaultAuthority] = await PublicKey.findProgramAddressSync(
            [Buffer.from('vault')],
            program.programId
        );

        // Derive vault NFT account
        vaultNftAccount = await getAssociatedTokenAddress(
            nftMint.publicKey,
            vaultAuthority,
            true
        );

        // Derive lender's NFT account
        lenderNftAccount = await getAssociatedTokenAddress(
            nftMint.publicKey,
            lenderKeypair.publicKey
        );

        // Mint NFT to borrower
        await program.methods.mintNft("https://example.com/nft")
            .accounts({
                mint: nftMint.publicKey,
                metadata: metadataPDA,
                masterEdition: masterEditionPDA,
                owner: borrowerKeypair.publicKey,
                ownerTokenAccount: borrowerNftAccount,
                payer: payerKeypair.publicKey,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                rent: SYSVAR_RENT_PUBKEY,
                tokenMetadataProgram: METADATA_PROGRAM_ID,
                collection: collectionMint,
                collectionMetadata: metadataPDA,
                collectionMasterEdition: masterEditionPDA,
            })
            .signers([nftMint, payerKeypair])
            .rpc();

        // Derive loan info PDA
        [loanInfoPDA] = await PublicKey.findProgramAddressSync(
            [Buffer.from('loan'), nftMint.publicKey.toBuffer()],
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
            nftMint: nftMint.publicKey,
            ownerNftAccount: borrowerNftAccount,
            vaultNftAccount: vaultNftAccount,
            vaultAuthority,
            owner: borrowerKeypair.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([borrowerKeypair])
        .rpc();

        // Verify NFT is in vault
        const vaultAccount = await provider.connection.getTokenAccountBalance(vaultNftAccount);
        assert.equal(vaultAccount.value.uiAmount, 1);
    });

    it('should provide loan liquidity', async () => {
        const borrowerBalanceBefore = await provider.connection.getBalance(borrowerKeypair.publicKey);

        await program.methods.provideLoanLiquidity()
            .accounts({
                loanInfo: loanInfoPDA,
                lender: lenderKeypair.publicKey,
                borrower: borrowerKeypair.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .signers([lenderKeypair])
            .rpc();

        const borrowerBalanceAfter = await provider.connection.getBalance(borrowerKeypair.publicKey);
        assert.equal(
            borrowerBalanceAfter - borrowerBalanceBefore,
            1 * anchor.web3.LAMPORTS_PER_SOL
        );
    });

    it('should repay loan and return NFT', async () => {
        await program.methods.repayLoan()
            .accounts({
                loanInfo: loanInfoPDA,
                nftMint: nftMint.publicKey,
                vaultNftAccount,
                borrowerNftAccount,
                vaultAuthority,
                borrower: borrowerKeypair.publicKey,
                lender: lenderKeypair.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .signers([borrowerKeypair])
            .rpc();

        // Verify NFT is back with borrower
        const borrowerAccount = await provider.connection.getTokenAccountBalance(borrowerNftAccount);
        assert.equal(borrowerAccount.value.uiAmount, 1);
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
            nftMint: nftMint.publicKey,
            ownerNftAccount: borrowerNftAccount,
            vaultNftAccount: vaultNftAccount,
            vaultAuthority,
            owner: borrowerKeypair.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([borrowerKeypair])
        .rpc();

        // Provide liquidity
        await program.methods.provideLoanLiquidity()
            .accounts({
                loanInfo: loanInfoPDA,
                lender: lenderKeypair.publicKey,
                borrower: borrowerKeypair.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .signers([lenderKeypair])
            .rpc();

        // Wait for loan to expire
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Claim NFT
        await program.methods.claimDelinquentNft()
            .accounts({
                loanInfo: loanInfoPDA,
                nftMint: nftMint.publicKey,
                vaultNftAccount,
                lenderNftAccount,
                vaultAuthority,
                lender: lenderKeypair.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .signers([lenderKeypair])
            .rpc();

        // Verify NFT is with lender
        const lenderAccount = await provider.connection.getTokenAccountBalance(lenderNftAccount);
        assert.equal(lenderAccount.value.uiAmount, 1);
    });
}); 