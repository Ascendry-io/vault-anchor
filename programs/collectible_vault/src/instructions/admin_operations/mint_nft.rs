use {
    crate::{
        constants::{
            admin_constants::get_admin_account_pubkey, pda_constants::VAULT_COLLECTION_COUNTER_SEED,
        },
        errors,
        state::CollectionCounter,
    },
    anchor_lang::prelude::*,
    anchor_spl::{
        associated_token::AssociatedToken,
        token::{Mint, Token, TokenAccount},
    },
    mpl_token_metadata::{
        instructions::{
            CreateMasterEditionV3, CreateMasterEditionV3InstructionArgs, CreateMetadataAccountV3,
            CreateMetadataAccountV3InstructionArgs, VerifySizedCollectionItem,
        },
        types::{Collection, Creator, DataV2},
    },
};

/**
 * Allows the admin to mint a new NFT.
 * This instruction creates a new NFT with the provided product detail URI.
 */
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

    #[account(mut, constraint = payer.key() == get_admin_account_pubkey() @ errors::ErrorCode::UnauthorizedTransactionSigner)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,

    /// CHECK: Metaplex program ID check
    #[account(address = mpl_token_metadata::ID)]
    pub token_metadata_program: UncheckedAccount<'info>,

    /// CHECK: Metaplex will validate the collection account
    #[account(mut)]
    pub collection: UncheckedAccount<'info>,

    /// CHECK: Collection mint
    pub collection_mint: Account<'info, Mint>,

    /// CHECK: Collection metadata account
    #[account(mut)]
    pub collection_metadata: UncheckedAccount<'info>,

    /// CHECK: Collection master edition
    pub collection_master_edition: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [VAULT_COLLECTION_COUNTER_SEED],
        bump,
        constraint = collection_counter.collection_mint == collection_mint.key() @ errors::ErrorCode::CollectionMintDoesNotMatch
    )]
    pub collection_counter: Account<'info, CollectionCounter>,

    /// CHECK: Just used as a parameter for token account
    pub owner: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = owner,
    )]
    pub owner_token_account: Account<'info, TokenAccount>,
}

pub fn handle(ctx: Context<MintNFT>, product_detail_uri: String) -> Result<()> {
    let collection_counter = &mut ctx.accounts.collection_counter;
    collection_counter.count += 1;

    let name: String = format!("Ascendry Item #{}", collection_counter.count);

    let data = DataV2 {
        name: name,
        symbol: "ASC".to_string(),
        uri: product_detail_uri,
        seller_fee_basis_points: 500,
        creators: Some(vec![Creator {
            address: ctx.accounts.payer.key(),
            verified: false,
            share: 100,
        }]),
        collection: Some(Collection {
            verified: false,
            key: ctx.accounts.collection_mint.key(),
        }),
        uses: None,
    };

    // Create Instruction Arguments
    let args = CreateMetadataAccountV3InstructionArgs {
        data: data.clone(),
        is_mutable: false,
        collection_details: None,
    };

    // Create metadata
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

    // Create metadata with CPI
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

    // Mint token to the owner's token account instead of payer's
    anchor_spl::token::mint_to(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.owner_token_account.to_account_info(), // Changed to owner's token account
                authority: ctx.accounts.payer.to_account_info(),
            },
        ),
        1,
    )?;

    // Create master edition
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
        max_supply: Some(0), // 0 means unique (non-fungible)
    });

    // Create master edition with CPI
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

    // Now verify the collection membership
    let verify_ix = VerifySizedCollectionItem {
        metadata: ctx.accounts.metadata.key(),
        collection_authority: ctx.accounts.payer.key(),
        payer: ctx.accounts.payer.key(),
        collection_mint: ctx.accounts.collection_mint.key(),
        collection: ctx.accounts.collection_metadata.key(),
        collection_master_edition_account: ctx.accounts.collection_master_edition.key(),
        collection_authority_record: None,
    }
    .instruction();

    // Verify collection with CPI
    anchor_lang::solana_program::program::invoke(
        &verify_ix,
        &[
            ctx.accounts.metadata.to_account_info(),
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.payer.to_account_info(), // Collection authority is the payer
            ctx.accounts.collection_mint.to_account_info(),
            ctx.accounts.collection_metadata.to_account_info(),
            ctx.accounts.collection_master_edition.to_account_info(),
            ctx.accounts.token_metadata_program.to_account_info(),
        ],
    )?;

    Ok(())
}
