use {
    crate::{errors, state::LoanInfo},
    anchor_lang::prelude::*,
    anchor_spl::{
        token::{Mint, Token, TokenAccount},
        associated_token::AssociatedToken,
    },
};

#[derive(Accounts)]
pub struct StakeNftForLoan<'info> {
    // Initialize loan info account
    #[account(
        init,
        payer = owner,
        space = LoanInfo::INIT_SPACE,
        seeds = [b"loan", nft_mint.key().as_ref()],
        bump
    )]
    pub loan_info: Account<'info, LoanInfo>,

    // NFT mint account
    pub nft_mint: Account<'info, Mint>,

    // Owner's NFT token account (where NFT currently is)
    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = owner,
        constraint = owner_nft_account.amount == 1 @ errors::ErrorCode::InvalidNFTAccount
    )]
    pub owner_nft_account: Account<'info, TokenAccount>,

    // Program's vault token account (where NFT will be transferred)
    #[account(
        init_if_needed,
        payer = owner,
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

    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle(
    ctx: Context<StakeNftForLoan>,
    loan_amount: u64,
    interest_amount: u64,
    duration: i64,
) -> Result<()> {
    require!(duration > 0, errors::ErrorCode::InvalidLoanDuration);

    // Initialize loan info
    let loan_info = &mut ctx.accounts.loan_info;
    loan_info.nft_mint = ctx.accounts.nft_mint.key();
    loan_info.nft_owner = ctx.accounts.owner.key();
    loan_info.loan_amount = loan_amount;
    loan_info.interest_amount = interest_amount;
    loan_info.duration = duration;
    loan_info.start_time = None;
    loan_info.lender = None;
    loan_info.is_active = false;

    // Transfer NFT to vault
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

    Ok(())
} 