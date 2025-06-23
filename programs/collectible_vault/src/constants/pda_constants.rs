/**
 * Seed for the asset redemption vault PDA
 * This is used consistently across asset redemption instructions
 */
pub const ASSET_REDEMPTION_VAULT_SEED: &[u8] = b"asset_redemption_vault";

/**
 * Seed for the asset redemption info PDA
 * This is used consistently across asset redemption instructions
 */
pub const ASSET_REDEMPTION_INFO_SEED: &[u8] = b"asset_redemption_info";

/**
 * Seed for the vault collection counter PDA
 * This is used to track the number of collections in the vault
 */
pub const VAULT_COLLECTION_COUNTER_SEED: &[u8] = b"vault_collection_counter";

/**
 * Seed for the loan info PDA
 * This is used to track the loan information
 */
pub const LOAN_INFO_SEED: &[u8] = b"loan";

/**
 * Seed for the vault PDA
 * This is used to track the vault information
 */
pub const VAULT_SEED: &[u8] = b"vault";
