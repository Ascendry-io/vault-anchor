use {
    crate::{
        constants::{
            admin_constants::get_admin_account_pubkey, pda_constants::ASSET_REDEMPTION_INFO_SEED,
        },
        errors,
        state::AssetRedemptionInfo,
    },
    anchor_lang::prelude::*,
    anchor_spl::token::Mint,
};

/**
 * Allows the admin to fulfill a redemption request for their digital collectible.
 * When a user wants to redeem their digital collectible for the physical asset sent, they call this instruction.
 * The digital collectible is sent to the program vault permanently; we do not burn the NFT (for archival, sustainability).
 * The user must have already created a redemption request for the NFT.
 */
#[derive(Accounts)]
pub struct FulfillAssetRedemptionRequest<'info> {
    // PDA account to store loan information, derived from the NFT mint address
    #[account(
        mut,
        seeds = [ASSET_REDEMPTION_INFO_SEED, nft_mint.key().as_ref()],
        bump,
        constraint = !asset_redemption_info.is_fulfilled @ errors::ErrorCode::RedemptionRequestAlreadyFulfilled,
    )]
    pub asset_redemption_info: Account<'info, AssetRedemptionInfo>,

    // The NFT being used as collateral
    pub nft_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = admin.key() == get_admin_account_pubkey() @ errors::ErrorCode::UnauthorizedRedemptionRequest,
    )]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle(ctx: Context<FulfillAssetRedemptionRequest>) -> Result<()> {
    msg!(
        "Fulfilling asset redemption request for NFT: {}",
        ctx.accounts.nft_mint.key()
    );

    let asset_redemption_info = &mut ctx.accounts.asset_redemption_info;
    asset_redemption_info.is_fulfilled = true;

    msg!(
        "Marked asset redemption request for NFT {} as fulfilled",
        ctx.accounts.nft_mint.key()
    );

    Ok(())
}
