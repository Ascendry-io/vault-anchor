pub mod state;
pub mod errors;
pub mod constants;
pub mod instructions;
 
use {
    anchor_lang::prelude::*,
    instructions::create_collection::*,
    instructions::mint_nft::*,
    instructions::burn_nft::*,
    mpl_token_metadata::{
        instructions::{
            CreateMasterEditionV3, CreateMasterEditionV3InstructionArgs, CreateMetadataAccountV3,
            CreateMetadataAccountV3InstructionArgs, VerifySizedCollectionItem,
        },
        types::{Collection, CollectionDetails, Creator, DataV2, UseMethod, Uses},
    }
};

declare_id!("2iaNEJN6GhTknsfLzdcc8yEZzYCSoiU1fiJNd5wywGNL");

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