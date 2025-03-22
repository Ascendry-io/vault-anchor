use anchor_lang::prelude::*;

/**
 * Collection Counter Account:
 *   - collection_mint: Pubkey: The mint of the collection
 *   - count: u64: The number of NFTs in the collection
 */
#[account]
#[derive(InitSpace)]
pub struct CollectionCounter {
    pub collection_mint: Pubkey,
    pub count: u64,
}

impl CollectionCounter {
    pub const INIT_SPACE: usize = 8 +    // discriminator
        32 +    // collection_mint (Pubkey)
        8;      // count (u64)
}