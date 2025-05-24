use anchor_lang::prelude::*;

/**
 * Tracks the number of NFTs minted in a collection.
 * This account is used to maintain a counter for NFTs in a specific collection.
 */
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
        8;      // count (u64)
} 