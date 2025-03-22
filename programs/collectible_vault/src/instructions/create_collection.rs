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
pub struct CreateCollection<'info> {
    #[account(
        init,
        payer = payer,
        mint::decimals = 0,
        mint::authority = payer.key(),
        mint::freeze_authority = payer.key(),
    )]
    pub mint: Account<'info, Mint>,

    /// CHECK: Metaplex will create this account
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer,
    )]
    pub token_account: Account<'info, TokenAccount>,

    #[account(mut, constraint = payer.key() == get_admin_account_pubkey() @ errors::ErrorCode::UnauthorizedTransactionSigner)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,

    /// CHECK: Validated in CPI
    #[account(address = mpl_token_metadata::ID)]
    pub token_metadata_program: UncheckedAccount<'info>,

    /// CHECK: Metaplex master edition validation handles this
    #[account(mut)]
    pub master_edition: UncheckedAccount<'info>,

    #[account(
        init,
        seeds = [b"collection_counter", mint.key().as_ref()],
        payer = payer,
        bump,
        space = CollectionCounter::INIT_SPACE
    )]
    pub collection_counter: Account<'info, CollectionCounter>,
}