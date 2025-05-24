use anchor_lang::prelude::Pubkey;
use std::str::FromStr;

/**
 * The public key string of the administrative account
 * This account has special privileges in the program, such as minting NFTs, or creating new collections.
 */
pub const ADMIN_ACCOUNT_PUBLIC_KEY_STR: &str = "9eAekUa3P7QSvCmKTEyLFgaMLX7Zv9VLbeFfQEDuUBLr";

/**
 * The public key string of the USDC mint on mainnet
 * This is the mint address of the USDC token on mainnet
 */
pub const MAINNET_USDC_MINT: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/**
 * The public key string of the USDC mint on devnet
 * This is the mint address of the USDC token on devnet
 */
pub const DEVNET_USDC_MINT: &str = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

/**
 * The audit request fee in USDC (10 USDC = $10)
 */
pub const AUDIT_REQUEST_FEE: u64 = 10_000_000; // 10 USDC (6 decimals)

/**
 * Returns the Pubkey of the administrative account
 * This function converts the string representation of the public key into a Pubkey type
 * # Panics
 * Panics if the public key string is invalid
 */
pub fn get_admin_account_pubkey() -> Pubkey {
    Pubkey::from_str(ADMIN_ACCOUNT_PUBLIC_KEY_STR).expect("Invalid public key")
}

/**
 * Returns the Pubkey of the USDC mint based on the current cluster
 * This function returns the appropriate USDC mint address for the current network
 * # Panics
 * Panics if the public key string is invalid
 */
pub fn get_usdc_mint_pubkey() -> Pubkey {
    Pubkey::from_str(DEVNET_USDC_MINT).expect("Invalid devnet USDC mint")
}

/**
 * The audit request fee in USDC (10 USDC = $10)
 */
pub const AUDIT_REQUEST_FEE: u64 = 10_000_000; // 10 USDC (6 decimals)