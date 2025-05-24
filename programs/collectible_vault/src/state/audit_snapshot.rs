use anchor_lang::prelude::*;

/**
 * Stores information about an audit snapshot of an NFT.
 * This account contains the audit information and file URL for a specific NFT audit.
 */
#[account]
#[derive(Default)]
pub struct AuditSnapshot {
    /// The mint address of the NFT being audited.
    pub nft_mint: Pubkey,
    /// PDA for the audit request made.
    pub audit_request_pda: Pubkey,
    /// The sequence number of this audit snapshot for the NFT
    pub sequence: u64,
    /// The URL of the audit file (max 100 characters).
    pub audit_file_url: String,
}

impl AuditSnapshot {
    /// Maximum length of the audit file URL
    pub const MAX_URL_LENGTH: usize = 100;

    /// Calculates the initial space required for the AuditSnapshot account
    pub const INIT_SPACE: usize = 8 +    // discriminator
        32 +    // nft_mint (Pubkey)
        32 +    // audit_request_pda (Pubkey)
        8 +     // sequence (u64)
        4 +     // string length (4 bytes)
        Self::MAX_URL_LENGTH;  // maximum URL length
} 