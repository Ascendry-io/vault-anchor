use anchor_lang::prelude::Pubkey;
use std::str::FromStr;
pub const ADMIN_ACCOUNT_PUBLIC_KEY_STR: &str = "9eAekUa3P7QSvCmKTEyLFgaMLX7Zv9VLbeFfQEDuUBLr";
pub fn get_admin_account_pubkey() -> Pubkey {
    Pubkey::from_str(ADMIN_ACCOUNT_PUBLIC_KEY_STR).expect("Invalid public key")
}
