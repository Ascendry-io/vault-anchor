use {
    crate::{errors, state::AssetRedemptionInfo},
    anchor_lang::prelude::*,
    anchor_spl::{
        token::{Mint, Token, TokenAccount},
        associated_token::AssociatedToken,
    },
};

/**
 * Allows a user to create a redemption request for their digital collectible.
 * When a user wants to redeem their digital collectible for the physical asset sent, they call this instruction.
 * The digital collectible is sent to the program vault permanently; we do not burn the NFT (for archival, sustainability).
 * This instruction creates an AssetRedemptionInfo account and transfers the NFT from the user's token account to the program vault for safekeeping.
 */
#[derive(Accounts)]
pub struct CreateAssetRedemptionRequest<'info> {
    // PDA account to store loan information, derived from the NFT mint address
    #[account(
        init,
        payer = owner,
        space = AssetRedemptionInfo::INIT_SPACE,
        seeds = [b"redemption", nft_mint.key().as_ref()],
        bump
    )]
    pub asset_redemption_info: Account<'info, AssetRedemptionInfo>,

    // The NFT being used as collateral
    pub nft_mint: Account<'info, Mint>,

    // Owner's token account containing the NFT to be staked
    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = owner,
        constraint = owner_nft_account.amount == 1 @ errors::ErrorCode::InvalidNFTAccount
    )]
    pub owner_nft_account: Account<'info, TokenAccount>,

    // Program's vault token account where the NFT will be held during the loan
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = nft_mint,
        associated_token::authority = vault_authority,
    )]
    pub vault_nft_account: Account<'info, TokenAccount>,

    /// CHECK: PDA for vault authority
    #[account(
        seeds = [b"redemption_vault"],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle(ctx: Context<CreateAssetRedemptionRequest>) -> Result<()> {
    msg!("Creating asset redemption request for NFT: {}", ctx.accounts.nft_mint.key());
    msg!("Owner: {}", ctx.accounts.owner.key());

    // Create the AssetRedemptionInfo account
    let asset_redemption_info = &mut ctx.accounts.asset_redemption_info;
    asset_redemption_info.nft_mint = ctx.accounts.nft_mint.key();
    asset_redemption_info.nft_owner = ctx.accounts.owner.key();
    asset_redemption_info.request_timestamp = Clock::get()?.unix_timestamp;

    msg!("Transferring NFT {} to program vault...", ctx.accounts.nft_mint.key());
    
    // Transfer NFT from owner to program vault for safekeeping
    anchor_spl::token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::Transfer {
                from: ctx.accounts.owner_nft_account.to_account_info(),
                to: ctx.accounts.vault_nft_account.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        1,
    )?;

    msg!("NFT {} successfully transferred to program vault", ctx.accounts.nft_mint.key());

    Ok(())
}
