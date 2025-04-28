use {
    crate::{errors, state::LoanInfo},
    anchor_lang::prelude::*,
    anchor_spl::{
        token::{Mint, Token, TokenAccount},
        associated_token::AssociatedToken,
    },
};

/// Allows lenders to claim the NFT collateral when a loan is not repaid on time
#[derive(Accounts)]
pub struct ClaimDelinquentNft<'info> {
    // Loan account that will be closed after claiming the NFT
    #[account(
        mut,
        seeds = [b"loan", nft_mint.key().as_ref()],
        bump,
        constraint = loan_info.is_active @ errors::ErrorCode::LoanNotActive,
        constraint = lender.key() == loan_info.lender.unwrap() @ errors::ErrorCode::InvalidLender,
        constraint = Clock::get()?.unix_timestamp > loan_info.start_time.unwrap() + loan_info.duration @ errors::ErrorCode::LoanNotExpired,
        close = lender // Close the loan account and return rent to lender
    )]
    pub loan_info: Account<'info, LoanInfo>,

    // The NFT that was used as collateral
    pub nft_mint: Account<'info, Mint>,

    // Program's vault token account holding the NFT
    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = vault_authority
    )]
    pub vault_nft_account: Account<'info, TokenAccount>,

    // Lender's token account where the NFT will be transferred
    #[account(
        init_if_needed,
        payer = lender,
        associated_token::mint = nft_mint,
        associated_token::authority = lender
    )]
    pub lender_nft_account: Account<'info, TokenAccount>,

    /// CHECK: PDA for vault authority
    #[account(
        seeds = [b"vault"],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    // Lender's account that will receive the NFT
    #[account(mut)]
    pub lender: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle(ctx: Context<ClaimDelinquentNft>) -> Result<()> {
    // Transfer NFT from vault to lender
    let vault_bump = ctx.bumps.vault_authority;
    let nft_seeds = &[
        b"vault".as_ref(),
        &[vault_bump]
    ];
    let signer = &[&nft_seeds[..]];

    anchor_spl::token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::Transfer {
                from: ctx.accounts.vault_nft_account.to_account_info(),
                to: ctx.accounts.lender_nft_account.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
            signer,
        ),
        1,
    )?;

    Ok(())
} 