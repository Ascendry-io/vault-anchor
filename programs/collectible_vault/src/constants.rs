use anchor_lang::prelude::Pubkey;
use std::str::FromStr;

/**
 * The public key string of the administrative account
 * This account has special privileges in the program, such as minting NFTs, or creating new collections.
 */
pub const ADMIN_ACCOUNT_PUBLIC_KEY_STR: &str = "9eAekUa3P7QSvCmKTEyLFgaMLX7Zv9VLbeFfQEDuUBLr";

/**
 * Returns the Pubkey of the administrative account
 * This function converts the string representation of the public key into a Pubkey type
 * # Panics
 * Panics if the public key string is invalid
 */
pub fn get_admin_account_pubkey() -> Pubkey {
    Pubkey::from_str(ADMIN_ACCOUNT_PUBLIC_KEY_STR).expect("Invalid public key")
}
