use anchor_lang::prelude::*;

#[error_code]
pub enum SoldIssuanceError {
    #[msg("Invalid quote mint address")]
    InvalidQuoteMintAddress,
    #[msg("Mint and redemptions paused")]
    MintAndRedemptionsPaused,
    #[msg("Address not found in allowed list")]
    AddressNotFoundInAllowedList,
    #[msg("Missing allowed list proof")]
    MissingAllowedListProof,
    #[msg("Token manager status unchanged")]
    TokenManagerStatusUnchanged,
    #[msg("Excessive Deposit, collateral shouldn't exceed 100%")]
    ExcessiveDeposit,
    #[msg("Excessive Withdrawal, collateral shouldn't be less than collateral threshold")]
    ExcessiveWithdrawal,
    #[msg("Calculation overflow")]
    CalculationOverflow,
}
