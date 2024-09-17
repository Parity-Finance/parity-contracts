use anchor_lang::prelude::*;

#[error_code]
pub enum ParityStakingError {
    #[msg("Invalid x mint address")]
    InvalidXMintAddress,
    #[msg("Calculation overflow")]
    CalculationOverflow,
    #[msg("Invalid admin")]
    InvalidAdmin,
    #[msg("Invalid owner")]
    InvalidOwner,
    #[msg("Invalid yield rate")]
    InvalidYieldRate,
    #[msg("Deposit cap exceeded")]
    DepositCapExceeded,
    #[msg("Invalid Quantity")]
    InvalidQuantity,
    #[msg("Owner Already Set")]
    OwnerAlreadySet,
    #[msg("An Invalid Parameter was passed")]
    InvalidParam,
}
