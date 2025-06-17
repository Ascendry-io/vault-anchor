use {
    crate::{errors, state::LoanInfo},
    anchor_lang::prelude::*,
    anchor_spl::{
        token::{Mint, Token, TokenAccount},
        associated_token::AssociatedToken,
    },
};

/**
 * Allows borrowers to repay their loan and retrieve their NFT.
 * This instruction closes the loan account and returns the NFT to the borrower.
 */
#[derive(Accounts)]
pub struct RepayLoan<'info> {
    // Loan account that will be closed after repayment
    #[account(
        mut,
        seeds = [b"loan", nft_mint.key().as_ref()],
        bump,
        constraint = loan_info.is_active @ errors::ErrorCode::LoanNotActive,
        constraint = borrower.key() == loan_info.nft_owner @ errors::ErrorCode::InvalidBorrower,
        constraint = Clock::get()?.unix_timestamp <= loan_info.start_time.unwrap() + loan_info.duration @ errors::ErrorCode::LoanExpired,
        close = borrower // Close the loan account and return rent to borrower
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

    // Borrower's token account where the NFT will be returned
    #[account(
        init_if_needed,
        payer = borrower,
        associated_token::mint = nft_mint,
        associated_token::authority = borrower
    )]
    pub borrower_nft_account: Account<'info, TokenAccount>,

    /// CHECK: PDA for vault authority
    #[account(
        seeds = [b"vault"],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    // Borrower's account that will repay the loan
    #[account(mut)]
    pub borrower: Signer<'info>,

    // Lender's account that will receive the repayment
    #[account(
        mut,
        constraint = lender.key() == loan_info.lender.unwrap() @ errors::ErrorCode::InvalidLender
    )]
    /// CHECK: We verify this is the lender in the constraint
    pub lender: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle(ctx: Context<RepayLoan>) -> Result<()> {
    let loan_info = &ctx.accounts.loan_info;

    // Calculate total repayment amount (principal + interest)
    let total_repayment = loan_info.loan_amount.checked_add(loan_info.interest_amount)
        .ok_or(errors::ErrorCode::CalculationError)?;

    // Transfer repayment amount from borrower to lender
    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.borrower.to_account_info(),
                to: ctx.accounts.lender.to_account_info(),
            },
        ),
        total_repayment,
    )?;

    // Transfer NFT from vault back to borrower
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
                to: ctx.accounts.borrower_nft_account.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
            signer,
        ),
        1,
    )?;

    Ok(())
} 