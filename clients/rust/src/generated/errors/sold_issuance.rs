//! This code was AUTOGENERATED using the kinobi library.
//! Please DO NOT EDIT THIS FILE, instead use visitors
//! to add features, then rerun kinobi to update it.
//!
//! [https://github.com/metaplex-foundation/kinobi]
//!

use num_derive::FromPrimitive;
use thiserror::Error;

#[derive(Clone, Debug, Eq, Error, FromPrimitive, PartialEq)]
pub enum SoldIssuanceError {
    /// 6000 (0x1770) - Invalid quote mint address
    #[error("Invalid quote mint address")]
    InvalidQuoteMintAddress,
    /// 6001 (0x1771) - Mint and redemptions paused
    #[error("Mint and redemptions paused")]
    MintAndRedemptionsPaused,
    /// 6002 (0x1772) - Address not found in allowed list
    #[error("Address not found in allowed list")]
    AddressNotFoundInAllowedList,
    /// 6003 (0x1773) - Missing allowed list proof
    #[error("Missing allowed list proof")]
    MissingAllowedListProof,
    /// 6004 (0x1774) - Token manager status unchanged
    #[error("Token manager status unchanged")]
    TokenManagerStatusUnchanged,
    /// 6005 (0x1775) - Excessive Deposit, collateral shouldn't exceed 100%
    #[error("Excessive Deposit, collateral shouldn't exceed 100%")]
    ExcessiveDeposit,
    /// 6006 (0x1776) - Excessive Withdrawal, collateral shouldn't be less than collateral threshold
    #[error("Excessive Withdrawal, collateral shouldn't be less than collateral threshold")]
    ExcessiveWithdrawal,
    /// 6007 (0x1777) - Calculation overflow
    #[error("Calculation overflow")]
    CalculationOverflow,
    /// 6008 (0x1778) - Invalid admin address
    #[error("Invalid admin address")]
    InvalidAdminAddress,
}

impl solana_program::program_error::PrintProgramError for SoldIssuanceError {
    fn print<E>(&self) {
        solana_program::msg!(&self.to_string());
    }
}
