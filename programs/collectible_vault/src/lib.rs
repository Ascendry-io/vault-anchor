pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

use {
    anchor_lang::prelude::*, instructions::burn_nft::*, instructions::create_collection::*,
    instructions::mint_nft::*, instructions::stake_nft_for_loan::*, instructions::provide_loan_liquidity::*,
    instructions::repay_loan::*, instructions::claim_delinquent_nft::*,
};

declare_id!("J9pUU7y7TLsoVJAy44XayjPGFsRnxVe34NtrfTbF9hjM");

#[program]
pub mod collectible_vault {
    use super::*;

    pub fn mint_nft(ctx: Context<MintNFT>, product_detail_uri: String) -> Result<()> {
        instructions::mint_nft::handle(ctx, product_detail_uri)
    }

    pub fn create_collection(ctx: Context<CreateCollection>) -> Result<()> {
        instructions::create_collection::handle(ctx)
    }

    pub fn burn_nft(ctx: Context<BurnNFT>) -> Result<()> {
        instructions::burn_nft::handle(ctx)
    }

    pub fn stake_nft_for_loan(ctx: Context<StakeNftForLoan>, loan_amount: u64, interest_rate: u64, duration: i64) -> Result<()> {
        instructions::stake_nft_for_loan::handle(ctx, loan_amount, interest_rate, duration)
    }

    pub fn provide_loan_liquidity(ctx: Context<ProvideLoanLiquidity>) -> Result<()> {
        instructions::provide_loan_liquidity::handle(ctx)
    }

    pub fn repay_loan(ctx: Context<RepayLoan>) -> Result<()> {
        instructions::repay_loan::handle(ctx)
    }

    pub fn claim_delinquent_nft(ctx: Context<ClaimDelinquentNft>) -> Result<()> {
        instructions::claim_delinquent_nft::handle(ctx)
    }
}
