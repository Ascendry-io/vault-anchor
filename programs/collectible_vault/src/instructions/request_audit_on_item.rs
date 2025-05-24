use {
    crate::{constants::AUDIT_REQUEST_FEE, errors, state::{AuditRequest, AuditStatus}},
    anchor_lang::prelude::*,
    anchor_spl::{
        associated_token::AssociatedToken, token::{Mint, Token, TokenAccount, Transfer}
    },
};

/**
 * Allows users to request an audit for an NFT.
 * This instruction creates an audit request account that tracks the request status.
 */
#[derive(Accounts)]
pub struct RequestAuditOnItem<'info> {
    #[account(
        init,
        payer = requester,
        space = AuditRequest::INIT_SPACE,
        seeds = [
            b"audit_request",
            nft_mint.key().as_ref(),
            Clock::get()?.unix_timestamp.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub audit_request: Account<'info, AuditRequest>,

    // The NFT being audited
    pub nft_mint: Account<'info, Mint>,

    #[account(mut)]
    pub requester: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,

    #[account(
        mut,
        constraint = user_usdc_account.owner == requester.key(),
        constraint = user_usdc_account.mint == get_usdc_mint_pubkey()
    )]
    pub user_usdc_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = admin_usdc_account.owner == get_admin_account_pubkey(),
        constraint = admin_usdc_account.mint == get_usdc_mint_pubkey()
    )]
    pub admin_usdc_account: Account<'info, TokenAccount>,
}

pub fn handle(ctx: Context<RequestAuditOnItem>) -> Result<()> {
    // Initialize audit request
    let audit_request = &mut ctx.accounts.audit_request;
    audit_request.nft_mint = ctx.accounts.nft_mint.key();
    audit_request.requester = ctx.accounts.requester.key();
    audit_request.request_timestamp = Clock::get()?.unix_timestamp;
    audit_request.status = AuditStatus::Pending;

    // Transfer USDC fee to admin
    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.user_usdc_account.to_account_info(),
            to: ctx.accounts.admin_usdc_account.to_account_info(),
            authority: ctx.accounts.requester.to_account_info(),
        },
    );
    token::transfer(transfer_ctx, AUDIT_REQUEST_FEE)?;

    Ok(())
} 