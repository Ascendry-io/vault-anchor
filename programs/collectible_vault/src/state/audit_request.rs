use anchor_lang::prelude::*;

/**
 * Stores information about an audit request.
 * This account tracks the details of a user's request for an NFT audit.
 */
#[account]
#[derive(Default)]
pub struct AuditRequest {
    /// The mint address of the NFT being audited.
    pub nft_mint: Pubkey,
    /// The public key of the user requesting the audit
    pub requester: Pubkey,
    /// The timestamp when the audit was requested
    pub request_timestamp: i64,
    /// The status of the audit request
    pub status: AuditStatus,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum AuditStatus {
    Pending,
    Completed,
    Rejected,
}

impl Default for AuditStatus {
    fn default() -> Self {
        AuditStatus::Pending
    }
}

impl AuditRequest {
    /// Calculates the initial space required for the AuditRequest account
    pub const INIT_SPACE: usize = 8 +    // discriminator
        32 +    // nft_mint (Pubkey)
        32 +    // requester (Pubkey)
        8 +     // request_timestamp (i64)
        1;     // status (enum)
} 