use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Collection mint does not match")]
    CollectionMintDoesNotMatch,

    #[msg("Only Administrative Account can directly interact with this program")]
    UnauthorizedTransactionSigner,

    #[msg("Loan is already active")]
    LoanAlreadyActive,
    
    #[msg("Invalid loan duration")]
    InvalidLoanDuration,
    
    #[msg("Invalid interest rate")]
    InvalidInterestRate,

    #[msg("Invalid NFT account")]
    InvalidNFTAccount,
    
    #[msg("Insufficient funds for loan")]
    InsufficientFunds,
    
    #[msg("Invalid borrower")]
    InvalidBorrower,

    #[msg("Loan is not active")]
    LoanNotActive,
    
    #[msg("Loan has expired")]
    LoanExpired,
    
    #[msg("Invalid lender")]
    InvalidLender,

    #[msg("Loan has not expired yet")]
    LoanNotExpired,

    #[msg("Calculation error")]
    CalculationError,
}
