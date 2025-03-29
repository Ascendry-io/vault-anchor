use {
    crate::{constants::get_admin_account_pubkey, errors, state::CollectionCounter},
    anchor_lang::prelude::*,
    anchor_spl::{
        associated_token::AssociatedToken,
        token::{Mint, Token, TokenAccount},
    },
    mpl_token_metadata::{
        instructions::{
            CreateMasterEditionV3, CreateMasterEditionV3InstructionArgs, CreateMetadataAccountV3,
            CreateMetadataAccountV3InstructionArgs,
        },
        types::{CollectionDetails, Creator, DataV2},
    },
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
        seeds = [b"vault_collection_counter"],
        payer = payer,
        bump,
        space = CollectionCounter::INIT_SPACE,
        constraint = payer.key() == get_admin_account_pubkey() @ errors::ErrorCode::UnauthorizedTransactionSigner
    )]
    pub collection_counter: Account<'info, CollectionCounter>,
}

pub fn handle(ctx: Context<CreateCollection>) -> Result<()> {
    // Initialize collection counter
    ctx.accounts.collection_counter.count = 0;
    ctx.accounts.collection_counter.collection_mint = ctx.accounts.mint.key();

    // Create metadata for the collection
    let data = DataV2 {
        name: "Bank Things".to_string(),
        symbol: "BANK".to_string(),
        uri: "https://bank-things.com".to_string(),
        seller_fee_basis_points: 100,
        creators: Some(vec![Creator {
            address: ctx.accounts.payer.key(),
            verified: false,
            share: 100,
        }]),
        collection: None,
        uses: None,
    };

    let args = CreateMetadataAccountV3InstructionArgs {
        data,
        is_mutable: false,
        collection_details: Some(CollectionDetails::V1 { size: 0 }), // This marks it as a collection
    };

    let metadata_ix = CreateMetadataAccountV3 {
        metadata: ctx.accounts.metadata.key(),
        mint: ctx.accounts.mint.key(),
        mint_authority: ctx.accounts.payer.key(),
        update_authority: (ctx.accounts.payer.key(), true),
        payer: ctx.accounts.payer.key(),
        system_program: ctx.accounts.system_program.key(),
        rent: Some(ctx.accounts.rent.key()),
    }
    .instruction(args);

    anchor_lang::solana_program::program::invoke(
        &metadata_ix,
        &[
            ctx.accounts.metadata.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
            ctx.accounts.token_metadata_program.to_account_info(),
        ],
    )?;

    // Mint one token for the collection
    anchor_spl::token::mint_to(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
            },
        ),
        1,
    )?;

    // Create master edition for the collection
    let master_edition_ix = CreateMasterEditionV3 {
        edition: ctx.accounts.master_edition.key(),
        mint: ctx.accounts.mint.key(),
        update_authority: ctx.accounts.payer.key(),
        mint_authority: ctx.accounts.payer.key(),
        payer: ctx.accounts.payer.key(),
        metadata: ctx.accounts.metadata.key(),
        token_program: ctx.accounts.token_program.key(),
        system_program: ctx.accounts.system_program.key(),
        rent: Some(ctx.accounts.rent.key()),
    }
    .instruction(CreateMasterEditionV3InstructionArgs {
        max_supply: Some(0), // 0 means unlimited editions for collection
    });

    // Creating master edition with CPI
    anchor_lang::solana_program::program::invoke(
        &master_edition_ix,
        &[
            ctx.accounts.master_edition.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.metadata.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
            ctx.accounts.token_metadata_program.to_account_info(),
        ],
    )?;

    Ok(())
}
