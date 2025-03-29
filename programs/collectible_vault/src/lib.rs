pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

use {
    anchor_lang::prelude::*, instructions::burn_nft::*, instructions::create_collection::*,
    instructions::mint_nft::*,
};

declare_id!("A45MQouCDPocVAwjraBheaXGpupySU4fhVvu3oB5GxxT");

#[program]
pub mod collectible_vault {
    use super::*;

    pub fn mint_nft(ctx: Context<MintNFT>, product_detail_uri: String) -> Result<()> {
        instructions::mint_nft::handle(ctx, product_detail_uri)
    }

    pub fn create_collection(ctx: Context<CreateCollection>) -> Result<()> {
        instructions::create_collection::handle(ctx)
    }

    pub fn burn_nft(ctx: Context<BurnNFT>) -> Result<()> {
        instructions::burn_nft::handle(ctx)
    }
}
