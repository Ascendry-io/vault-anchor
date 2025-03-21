use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Collection mint does not match")]
    CollectionMintDoesNotMatch,

    #[msg("Only Administrative Account can directly interact with this program")]
    UnauthorizedTransactionSigner,
}
