use {
    crate::{
        constants::pda_constants::{ASSET_REDEMPTION_INFO_SEED, ASSET_REDEMPTION_VAULT_SEED},
        errors,
        state::AssetRedemptionInfo,
    },
    anchor_lang::prelude::*,
    anchor_spl::{
        associated_token::AssociatedToken,
        token::{Mint, Token, TokenAccount},
    },
};

/**
 * Allows a borrower to cancel their loan request before it's funded.
 * This instruction returns the staked NFT to the owner.
 */
#[derive(Accounts)]
pub struct CancelAssetRedemptionRequest<'info> {
    // PDA account to store loan information, derived from the NFT mint address
    #[account(
        mut,
        seeds = [ASSET_REDEMPTION_INFO_SEED, nft_mint.key().as_ref()],
        bump,
        constraint = asset_redemption_info.nft_owner == owner.key() @ errors::ErrorCode::UnauthorizedRedemptionRequest,
        constraint = !asset_redemption_info.is_fulfilled @ errors::ErrorCode::RedemptionRequestAlreadyFulfilled,
        close = owner
    )]
    pub asset_redemption_info: Account<'info, AssetRedemptionInfo>,

    pub nft_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = owner,
    )]
    pub owner_nft_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = asset_redemption_vault,
    )]
    pub asset_redemption_nft_account: Account<'info, TokenAccount>,

    /// CHECK: PDA for asset redemption authority
    #[account(
        seeds = [ASSET_REDEMPTION_VAULT_SEED],
        bump
    )]
    pub asset_redemption_vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handle(ctx: Context<CancelAssetRedemptionRequest>) -> Result<()> {
    let asset_redemption_bump = ctx.bumps.asset_redemption_vault;
    let seeds = &[ASSET_REDEMPTION_VAULT_SEED, &[asset_redemption_bump]];
    let signer = &[&seeds[..]];

    // Transfer NFT back to owner
    anchor_spl::token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::Transfer {
                from: ctx.accounts.asset_redemption_nft_account.to_account_info(),
                to: ctx.accounts.owner_nft_account.to_account_info(),
                authority: ctx.accounts.asset_redemption_vault.to_account_info(),
            },
            signer,
        ),
        1,
    )?;

    msg!(
        "Transferring NFT {} back to owner...",
        ctx.accounts.nft_mint.key()
    );

    // Close the vault's token account
    anchor_spl::token::close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        anchor_spl::token::CloseAccount {
            account: ctx.accounts.asset_redemption_nft_account.to_account_info(),
            destination: ctx.accounts.owner.to_account_info(),
            authority: ctx.accounts.asset_redemption_vault.to_account_info(),
        },
        signer,
    ))?;

    msg!("Closed asset redemption account");

    Ok(())
}
