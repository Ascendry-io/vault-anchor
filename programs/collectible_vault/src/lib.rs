pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

use {
    anchor_lang::prelude::*, 
    instructions::asset_redemption::create_asset_redemption_request::*,
    instructions::asset_redemption::cancel_asset_redemption_request::*,
    instructions::asset_redemption::fulfill_asset_redemption_request::*,
    instructions::admin_operations::create_collection::*, 
    instructions::admin_operations::mint_nft::*, 
    instructions::loans::cancel_loan_request::*,
    instructions::loans::stake_nft_for_loan::*,
    instructions::loans::provide_loan_liquidity::*, 
    instructions::loans::repay_loan::*, 
    instructions::loans::claim_delinquent_nft::*,
};

declare_id!("DcLtM1NXbXH5ChXttabuWDw3sUCNo95Xt7LNBLx9Nfha");

#[program]
pub mod collectible_vault {
    use super::*;

    /**
     * Mints a new NFT with the provided product detail URI.
     * This instruction is used to create new NFTs in the vault.
     */
    pub fn mint_nft(ctx: Context<MintNFT>, product_detail_uri: String) -> Result<()> {
        instructions::admin_operations::mint_nft::handle(ctx, product_detail_uri)
    }

    /**
     * Creates a new collection for NFTs.
     * This instruction sets up the collection structure for organizing NFTs.
     */
    pub fn create_collection(ctx: Context<CreateCollection>) -> Result<()> {
        instructions::admin_operations::create_collection::handle(ctx)
    }

    /**
     * Creates a new asset redemption request for a digital collectible.
     * This instruction allows a user to create a redemption request for their digital collectible.
     */
    pub fn create_asset_redemption_request(ctx: Context<CreateAssetRedemptionRequest>) -> Result<()> {
        instructions::asset_redemption::create_asset_redemption_request::handle(ctx)
    }

    /**
     * Allows an NFT owner to cancel their asset redemption request.
     * This instruction allows a user to cancel their asset redemption request.
     */
    pub fn cancel_asset_redemption_request(ctx: Context<CancelAssetRedemptionRequest>) -> Result<()> {
        instructions::asset_redemption::cancel_asset_redemption_request::handle(ctx)
    }

    /**
     * Allows the admin to fulfill an asset redemption request.
     * This instruction allows the admin to fulfill an asset redemption request.
     */
    pub fn fulfill_asset_redemption_request(ctx: Context<FulfillAssetRedemptionRequest>) -> Result<()> {
        instructions::asset_redemption::fulfill_asset_redemption_request::handle(ctx)
    }

    /**
     * Allows an NFT owner to stake their NFT as collateral for a loan.
     * Parameters:
     * - loan_amount: The amount of lamports requested for the loan.
     * - interest_rate: The interest rate for the loan.
     * - duration: The duration of the loan in seconds.
     */
    pub fn stake_nft_for_loan(ctx: Context<StakeNftForLoan>, loan_amount: u64, interest_rate: u64, duration: i64) -> Result<()> {
        instructions::loans::stake_nft_for_loan::handle(ctx, loan_amount, interest_rate, duration)
    }

    /**
     * Allows a lender to provide liquidity for a loan request.
     * This instruction funds the loan and makes it active.
     */
    pub fn provide_loan_liquidity(ctx: Context<ProvideLoanLiquidity>) -> Result<()> {
        instructions::loans::provide_loan_liquidity::handle(ctx)
    }

    /**
     * Allows a borrower to repay their loan.
     * This instruction transfers the repayment amount to the lender.
     */
    pub fn repay_loan(ctx: Context<RepayLoan>) -> Result<()> {
        instructions::loans::repay_loan::handle(ctx)
    }

    /**
     * Allows a lender to claim an NFT when a loan becomes delinquent.
     * This instruction transfers the NFT to the lender if the loan terms are not met.
     */
    pub fn claim_delinquent_nft(ctx: Context<ClaimDelinquentNft>) -> Result<()> {
        instructions::loans::claim_delinquent_nft::handle(ctx)
    }

    /**
     * Allows a borrower to cancel their loan request before it's funded.
     * This instruction returns the staked NFT to the owner.
     */
    pub fn cancel_loan_request(ctx: Context<CancelLoanRequest>) -> Result<()> {
        instructions::loans::cancel_loan_request::handle(ctx)
    }
}
