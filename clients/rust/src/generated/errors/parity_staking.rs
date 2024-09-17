//! This code was AUTOGENERATED using the kinobi library.
//! Please DO NOT EDIT THIS FILE, instead use visitors
//! to add features, then rerun kinobi to update it.
//!
//! [https://github.com/metaplex-foundation/kinobi]
//!

use num_derive::FromPrimitive;
use thiserror::Error;

#[derive(Clone, Debug, Eq, Error, FromPrimitive, PartialEq)]
pub enum ParityStakingError {
    /// 6000 (0x1770) - Invalid x mint address
    #[error("Invalid x mint address")]
    InvalidXMintAddress,
    /// 6001 (0x1771) - Calculation overflow
    #[error("Calculation overflow")]
    CalculationOverflow,
    /// 6002 (0x1772) - Invalid admin
    #[error("Invalid admin")]
    InvalidAdmin,
    /// 6003 (0x1773) - Invalid owner
    #[error("Invalid owner")]
    InvalidOwner,
    /// 6004 (0x1774) - Invalid yield rate
    #[error("Invalid yield rate")]
    InvalidYieldRate,
    /// 6005 (0x1775) - Deposit cap exceeded
    #[error("Deposit cap exceeded")]
    DepositCapExceeded,
    /// 6006 (0x1776) - Deposit cap less than the previous
    #[error("Deposit cap less than the previous")]
    DepositCapTooLow,
    /// 6007 (0x1777) - Invalid Quantity
    #[error("Invalid Quantity")]
    InvalidQuantity,
    /// 6008 (0x1778) - Owner Already Set
    #[error("Owner Already Set")]
    OwnerAlreadySet,
    /// 6009 (0x1779) - An Invalid Parameter was passed
    #[error("An Invalid Parameter was passed")]
    InvalidParam,
}

impl solana_program::program_error::PrintProgramError for ParityStakingError {
    fn print<E>(&self) {
        solana_program::msg!(&self.to_string());
    }
}
