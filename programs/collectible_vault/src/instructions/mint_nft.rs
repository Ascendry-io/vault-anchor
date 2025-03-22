use anchor_lang::prelude::*;
use anchor_spl::{
    token::{Mint, Token, TokenAccount},
    associated_token::AssociatedToken,
};
use crate::{
    state::CollectionCounter,
    errors,
    constants::get_admin_account_pubkey,
};

#[derive(Accounts)]
pub struct MintNFT<'info> {
    #[account(
        init,
        payer = payer,
        mint::decimals = 0,
        mint::authority = payer.key(),
        mint::freeze_authority = payer.key(),
    )]
    pub mint: Account<'info, Mint>,

    // Metadata account
    /// CHECK: Metaplex metadata validation handles this.
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// CHECK: Metaplex master edition validation handles this.
    #[account(mut)]
    pub master_edition: UncheckedAccount<'info>,

    // User token account
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer,
    )]
    pub token_account: Account<'info, TokenAccount>,

    #[account(mut, constraint = payer.key() == get_admin_account_pubkey() @ errors::ErrorCode::UnauthorizedTransactionSigner)]
    // Payer account
    pub payer: Signer<'info>,
    // System programs
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,

    //Metaplex program
    /// CHECK: Metaplex program ID check
    #[account(address = mpl_token_metadata::ID)]
    pub token_metadata_program: UncheckedAccount<'info>,

    // Metaplex collection that already exists
    #[account(mut)]
    /// CHECK: Metaplex will validate the collection account
    pub collection: UncheckedAccount<'info>,

    // Collection accounts
    /// CHECK: Collection mint
    pub collection_mint: Account<'info, Mint>,

    /// CHECK: Collection metadata account
    #[account(mut)]
    pub collection_metadata: UncheckedAccount<'info>,

    /// CHECK: Collection master edition
    pub collection_master_edition: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"collection_counter", collection_mint.key().as_ref()],
        bump,
        constraint = collection_counter.collection_mint == collection_mint.key() @ errors::ErrorCode::CollectionMintDoesNotMatch
    )]
    pub collection_counter: Account<'info, CollectionCounter>,
}