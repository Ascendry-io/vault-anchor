use anchor_lang::prelude::*;

/**
 * Stores information about an asset redemption request.
 * This account tracks the details of a redemption request, which includes freezing the NFT indefinitely when asset redemption is fulfilled.
 */
#[account]
#[derive(Default)]
pub struct AssetRedemptionInfo {
    /// The mint address of the NFT being used as collateral.
    pub nft_mint: Pubkey,
    /// The public key of the original owner of the NFT.    
    pub nft_owner: Pubkey,
    /// The timestamp when the redemption request was made.
    pub request_timestamp: i64,
    /// Indicates whether the redemption request has been fulfilled.
    pub is_fulfilled: bool,
}

impl AssetRedemptionInfo {
    /// Calculates the initial space required for the AssetRedemptionInfo account
    pub const INIT_SPACE: usize = 8 +    // discriminator
        32 +    // nft_mint
        32 +    // nft_owner
        8 +     // request_timestamp
        1; // is_fulfilled
}
