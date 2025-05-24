use {
    crate::{
        constants::get_admin_account_pubkey,
        state::{AuditRequest, AuditSnapshot, AuditStatus},
    },
    anchor_lang::prelude::*,
    anchor_spl::token::Token,
};

/**
 * Allows the admin to provide an audit snapshot for an NFT.
 * This instruction updates the audit request status and creates an audit snapshot.
 */
#[derive(Accounts)]
pub struct ProvideAuditSnapshot<'info> {
    #[account(
        mut,
        constraint = audit_request.status == AuditStatus::Pending
    )]
    pub audit_request: Account<'info, AuditRequest>,

    #[account(
        init,
        payer = admin,
        space = AuditSnapshot::LEN,
        seeds = [
            b"audit_snapshot",
            audit_request.nft_mint.as_ref(),
            &[audit_request.audit_count]
        ],
        bump
    )]
    pub audit_snapshot: Account<'info, AuditSnapshot>,

    #[account(
        mut,
        constraint = admin.key() == get_admin_account_pubkey()
    )]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

pub fn handle(
    ctx: Context<ProvideAuditSnapshot>,
    image_urls: Vec<String>,
) -> Result<()> {
    // Update audit request status
    let audit_request = &mut ctx.accounts.audit_request;
    audit_request.status = AuditStatus::Completed;
    audit_request.completion_timestamp = Clock::get()?.unix_timestamp;

    // Initialize audit snapshot
    let audit_snapshot = &mut ctx.accounts.audit_snapshot;
    audit_snapshot.nft_mint = audit_request.nft_mint;
    audit_snapshot.audit_count = audit_request.audit_count;
    audit_snapshot.image_urls = image_urls;
    audit_snapshot.timestamp = Clock::get()?.unix_timestamp;

    Ok(())
} 