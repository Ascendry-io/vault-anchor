use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct CollectionCounter {
    pub collection_mint: Pubkey,
    pub count: u64,
}

impl CollectionCounter {
    pub const INIT_SPACE: usize = 8 +    // discriminator
        32 +    // collection_mint (Pubkey)
        8; // count (u64)
}

#[account]
#[derive(Default)]
pub struct LoanInfo {
    pub nft_mint: Pubkey,            // The NFT being used as collateral
    pub nft_owner: Pubkey,           // Original owner of the NFT
    pub loan_amount: u64,            // Requested loan amount in lamports
    pub interest_amount: u64,        // Changed from interest_rate
    pub duration: i64,               // Loan duration in seconds
    pub start_time: Option<i64>,     // When the loan starts (set when funded)
    pub lender: Option<Pubkey>,      // Address of the lender (set when funded)
    pub is_active: bool,             // Whether the loan is currently active
}

impl LoanInfo {
    pub const INIT_SPACE: usize = 8 +    // discriminator
        32 +    // nft_mint
        32 +    // nft_owner
        8 +     // loan_amount
        8 +     // interest_rate
        8 +     // duration
        9 +     // start_time (Option)
        33 +    // lender (Option)
        1;      // is_active
}
