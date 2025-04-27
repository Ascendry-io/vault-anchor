use anchor_lang::prelude::*;

/// Tracks the number of NFTs minted in a collection
/// This account is used to maintain a counter for NFTs in a specific collection
#[account]
#[derive(InitSpace)]
pub struct CollectionCounter {
    /// The mint address of the collection
    pub collection_mint: Pubkey,
    /// The current count of NFTs in the collection
    pub count: u64,
}

impl CollectionCounter {
    /// Calculates the initial space required for the CollectionCounter account
    pub const INIT_SPACE: usize = 8 +    // discriminator
        32 +    // collection_mint (Pubkey)
        8; // count (u64)
}

/// Stores information about a loan request or active loan
/// This account tracks all the details of a loan using an NFT as collateral
#[account]
#[derive(Default)]
pub struct LoanInfo {
    /// The mint address of the NFT being used as collateral
    pub nft_mint: Pubkey,
    /// The public key of the original owner of the NFT
    pub nft_owner: Pubkey,
    /// The amount of lamports requested for the loan
    pub loan_amount: u64,
    /// The interest amount to be paid on the loan
    pub interest_amount: u64,
    /// The duration of the loan in seconds
    pub duration: i64,
    /// The timestamp when the loan becomes active (None if not yet funded)
    pub start_time: Option<i64>,
    /// The public key of the lender (None if not yet funded)
    pub lender: Option<Pubkey>,
    /// Indicates whether the loan is currently active
    pub is_active: bool,
}

impl LoanInfo {
    /// Calculates the initial space required for the LoanInfo account
    pub const INIT_SPACE: usize = 8 +    // discriminator
        32 +    // nft_mint
        32 +    // nft_owner
        8 +     // loan_amount
        8 +     // interest_amount
        8 +     // duration
        9 +     // start_time (Option)
        33 +    // lender (Option)
        1;      // is_active
}
