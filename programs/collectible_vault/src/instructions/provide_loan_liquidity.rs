use {
    crate::{errors, state::LoanInfo},
    anchor_lang::prelude::*,
};

#[derive(Accounts)]
pub struct ProvideLoanLiquidity<'info> {
    #[account(
        mut,
        seeds = [b"loan", loan_info.nft_mint.as_ref()],
        bump,
        constraint = !loan_info.is_active @ errors::ErrorCode::LoanAlreadyActive,
        constraint = loan_info.loan_amount <= lender.lamports() @ errors::ErrorCode::InsufficientFunds
    )]
    pub loan_info: Account<'info, LoanInfo>,

    #[account(mut)]
    pub lender: Signer<'info>,

    #[account(
        mut,
        constraint = borrower.key() == loan_info.nft_owner @ errors::ErrorCode::InvalidBorrower
    )]
    /// CHECK: We verify this is the NFT owner in the constraint
    pub borrower: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle(ctx: Context<ProvideLoanLiquidity>) -> Result<()> {
    let loan_info = &mut ctx.accounts.loan_info;
    
    // Transfer loan amount from lender to borrower
    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.lender.to_account_info(),
                to: ctx.accounts.borrower.to_account_info(),
            },
        ),
        loan_info.loan_amount,
    )?;

    // Update loan info
    loan_info.start_time = Some(Clock::get()?.unix_timestamp);
    loan_info.lender = Some(ctx.accounts.lender.key());
    loan_info.is_active = true;

    Ok(())
} 