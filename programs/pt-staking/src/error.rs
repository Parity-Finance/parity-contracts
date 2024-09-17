use anchor_lang::prelude::*;

#[error_code]
pub enum PtStakingError {
    #[msg("Calculation overflow")]
    CalculationOverflow,
    #[msg("Invalid admin")]
    InvalidAdmin,
    #[msg("Invalid owner")]
    InvalidOwner,
    #[msg("Invalid yield rate")]
    InvalidYieldRate,
    #[msg("Invalid Quantity")]
    InvalidQuantity,
    #[msg("Deposit cap exceeded")]
    DepositCapExceeded,
    #[msg("No exchange rate avaliable")]
    NoExchangeRateAvailable,
    #[msg("Insufficient staked amount")]
    InsufficientStakedAmount,
    #[msg("Already Initialized")]
    AlreadyInitialized,
    #[msg("Not Initialized")]
    NotInitialized,
    #[msg("Invalid Mint Address")]
    InvalidMintAddress,
    #[msg("Owner Already Set")]
    OwnerAlreadySet,
    #[msg("An Invalid Parameter was passed")]
    InvalidParam,
}
