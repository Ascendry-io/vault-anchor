pub mod state;
pub mod errors;
pub mod constants;
use anchor_lang::prelude::*;
use constants::get_admin_account_pubkey;
use mpl_token_metadata::{
    instructions::{
        CreateMasterEditionV3, CreateMasterEditionV3InstructionArgs, CreateMetadataAccountV3,
        CreateMetadataAccountV3InstructionArgs, VerifySizedCollectionItem,
    },
    types::{Collection, CollectionDetails, Creator, DataV2, UseMethod, Uses},
};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};
use state::CollectionCounter;

declare_id!("79294eodprTU1vDDD5UcbEFhw57kyewDMKRyLMK2EQK3");

#[program]
pub mod collectible_vault {
    use super::*;

    pub fn mint_nft(ctx: Context<MintNFT>, product_detail_uri: String) -> Result<()> {
        let collection_counter = &mut ctx.accounts.collection_counter;
        collection_counter.count += 1;

        let name = format!("Banked Item #{}", collection_counter.count);


        let data = DataV2 {
            name: name,
            symbol: "BT".to_string(),
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
            uses: Some(Uses {
                use_method: UseMethod::Burn,
                remaining: 1,
                total: 1,
            }),
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

        // Creating metadata with CPI
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

        // Mint token
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
        // In the mint_nft function, replace the verify_collection part with this:
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

    pub fn create_collection(ctx: Context<CreateCollection>) -> Result<()> {
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

    pub fn burn_nft(ctx: Context<BurnNFT>) -> Result<()> {
        // Burn the token
        anchor_spl::token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Burn {
                    mint: ctx.accounts.mint.to_account_info(),
                    from: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            1,
        )?;

        Ok(())
    }
}

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

#[derive(Accounts)]
pub struct BurnNFT<'info> {
    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = owner,
    )]
    pub token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

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