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
    #[msg("Deposit cap exceeded")]
    DepositCapExceeded,
    #[msg("No exchange rate avaliable")]
    NoExchangeRateAvailable,
    #[msg("Insufficient staked amount")]
    InsufficientStakedAmount
}
