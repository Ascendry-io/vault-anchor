use anchor_lang::prelude::*;

/// Custom error codes for the Collectible Vault program
/// These errors are used to provide clear feedback when operations fail
#[error_code]
pub enum ErrorCode {
    /// Thrown when attempting to use an NFT that doesn't belong to the specified collection
    #[msg("Collection mint does not match")]
    CollectionMintDoesNotMatch,

    /// Thrown when a non-admin account attempts to perform admin-only operations
    #[msg("Only Administrative Account can directly interact with this program")]
    UnauthorizedTransactionSigner,

    /// Thrown when attempting to activate a loan that is already active
    #[msg("Loan is already active")]
    LoanAlreadyActive,
    
    /// Thrown when the specified loan duration is invalid (e.g., too short or too long)
    #[msg("Invalid loan duration")]
    InvalidLoanDuration,
    
    /// Thrown when the specified interest rate is invalid (e.g., too high or negative)
    #[msg("Invalid interest rate")]
    InvalidInterestRate,

    /// Thrown when the provided NFT account is invalid or doesn't exist
    #[msg("Invalid NFT account")]
    InvalidNFTAccount,
    
    /// Thrown when the lender doesn't have enough funds to provide the requested loan
    #[msg("Insufficient funds for loan")]
    InsufficientFunds,
    
    /// Thrown when the borrower's account doesn't match the loan's borrower
    #[msg("Invalid borrower")]
    InvalidBorrower,

    /// Thrown when attempting to perform an operation that requires an active loan
    #[msg("Loan is not active")]
    LoanNotActive,
    
    /// Thrown when attempting to perform an operation on an expired loan
    #[msg("Loan has expired")]
    LoanExpired,
    
    /// Thrown when the lender's account doesn't match the loan's lender
    #[msg("Invalid lender")]
    InvalidLender,

    /// Thrown when attempting to claim a delinquent NFT before the loan has expired
    #[msg("Loan has not expired yet")]
    LoanNotExpired,

    /// Thrown when a mathematical calculation fails (e.g., overflow)
    #[msg("Calculation error")]
    CalculationError,

    /// Thrown when attempting to cancel a loan that has already been funded
    #[msg("Cannot cancel loan that has already been funded")]
    LoanAlreadyFunded,
    
    /// Thrown when a non-owner attempts to cancel a loan request
    #[msg("Only the loan owner can cancel the loan request")]
    UnauthorizedLoanCancellation,
}
