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
