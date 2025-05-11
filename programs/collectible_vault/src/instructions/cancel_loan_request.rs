use {
    crate::{errors, state::LoanInfo},
    anchor_lang::prelude::*,
    anchor_spl::{
        token::{Mint, Token, TokenAccount},
        associated_token::AssociatedToken,
    },
};

/**
 * Allows a borrower to cancel their loan request before it's funded.
 * This instruction returns the staked NFT to the owner.
 */
#[derive(Accounts)]
pub struct CancelLoanRequest<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"loan", nft_mint.key().as_ref()],
        bump,
        constraint = loan_info.nft_owner == owner.key() @ errors::ErrorCode::UnauthorizedLoanCancellation,
        constraint = loan_info.lender.is_none() @ errors::ErrorCode::LoanAlreadyFunded,
        constraint = !loan_info.is_active @ errors::ErrorCode::LoanAlreadyActive,
        close = owner
    )]
    pub loan_info: Account<'info, LoanInfo>,

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
        associated_token::authority = vault_authority,
    )]
    pub vault_nft_account: Account<'info, TokenAccount>,

    /// CHECK: PDA for vault authority
    #[account(
        seeds = [b"vault"],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle(ctx: Context<CancelLoanRequest>) -> Result<()> {
    let vault_bump = ctx.bumps.vault_authority;
    let seeds = &[
        b"vault".as_ref(),
        &[vault_bump]
    ];
    let signer = &[&seeds[..]];

    // Transfer NFT back to owner
    anchor_spl::token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::Transfer {
                from: ctx.accounts.vault_nft_account.to_account_info(),
                to: ctx.accounts.owner_nft_account.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
            signer,
        ),
        1,
    )?;

    // Close the vault's token account
    anchor_spl::token::close_account(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::CloseAccount {
                account: ctx.accounts.vault_nft_account.to_account_info(),
                destination: ctx.accounts.owner.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
            signer,
        ),
    )?;

    Ok(())
} 