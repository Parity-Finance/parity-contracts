use anchor_lang::prelude::*;

#[error_code]
pub enum ParityIssuanceError {
    #[msg("Invalid quote mint address")]
    InvalidQuoteMintAddress,
    #[msg("Invalid mint address")]
    InvalidMintAddress,
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
    #[msg("Slot limit exceeded")]
    SlotLimitExceeded,
    #[msg("Invalid admin")]
    InvalidAdmin,
    #[msg("Invalid owner")]
    InvalidOwner,
    #[msg("Invalid minter")]
    InvalidMinter,
    #[msg("Invalid toggle active authority")]
    InvalidToggleActiveAuthority,
    #[msg("No pending withdrawal")]
    NoPendingWithdrawal,
    #[msg("Withdrawal not ready")]
    WithdrawalNotReady,
    #[msg("Withdrawal expired")]
    WithdrawalExpired,
}
