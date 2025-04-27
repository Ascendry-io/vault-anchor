pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

use {
    anchor_lang::prelude::*, 
    instructions::burn_nft::*, 
    instructions::cancel_loan_request::*,
    instructions::create_collection::*, 
    instructions::mint_nft::*, 
    instructions::stake_nft_for_loan::*,
    instructions::provide_loan_liquidity::*, 
    instructions::repay_loan::*, 
    instructions::claim_delinquent_nft::*,
};

declare_id!("Bk73CJxtKr2Z9X9sKUwEvoafHXSnX7xPpLUhT9ujLXwU");

#[program]
pub mod collectible_vault {
    use super::*;

    /// Mints a new NFT with the provided product detail URI
    /// This instruction is used to create new NFTs in the vault
    pub fn mint_nft(ctx: Context<MintNFT>, product_detail_uri: String) -> Result<()> {
        instructions::mint_nft::handle(ctx, product_detail_uri)
    }

    /// Creates a new collection for NFTs
    /// This instruction sets up the collection structure for organizing NFTs
    pub fn create_collection(ctx: Context<CreateCollection>) -> Result<()> {
        instructions::create_collection::handle(ctx)
    }

    /// Burns an existing NFT
    /// This instruction permanently removes an NFT from circulation
    pub fn burn_nft(ctx: Context<BurnNFT>) -> Result<()> {
        instructions::burn_nft::handle(ctx)
    }

    /// Allows an NFT owner to stake their NFT as collateral for a loan
    /// Parameters:
    /// - loan_amount: The amount of lamports requested for the loan
    /// - interest_rate: The interest rate for the loan
    /// - duration: The duration of the loan in seconds
    pub fn stake_nft_for_loan(ctx: Context<StakeNftForLoan>, loan_amount: u64, interest_rate: u64, duration: i64) -> Result<()> {
        instructions::stake_nft_for_loan::handle(ctx, loan_amount, interest_rate, duration)
    }

    /// Allows a lender to provide liquidity for a loan request
    /// This instruction funds the loan and makes it active
    pub fn provide_loan_liquidity(ctx: Context<ProvideLoanLiquidity>) -> Result<()> {
        instructions::provide_loan_liquidity::handle(ctx)
    }

    /// Allows a borrower to repay their loan
    /// This instruction transfers the repayment amount to the lender
    pub fn repay_loan(ctx: Context<RepayLoan>) -> Result<()> {
        instructions::repay_loan::handle(ctx)
    }

    /// Allows a lender to claim an NFT when a loan becomes delinquent
    /// This instruction transfers the NFT to the lender if the loan terms are not met
    pub fn claim_delinquent_nft(ctx: Context<ClaimDelinquentNft>) -> Result<()> {
        instructions::claim_delinquent_nft::handle(ctx)
    }

    /// Allows a borrower to cancel their loan request before it's funded
    /// This instruction returns the staked NFT to the owner
    pub fn cancel_loan_request(ctx: Context<CancelLoanRequest>) -> Result<()> {
        instructions::cancel_loan_request::handle(ctx)
    }
}
