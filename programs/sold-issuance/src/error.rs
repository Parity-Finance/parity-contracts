use anchor_lang::prelude::*;

#[error_code]
pub enum SoldIssuanceError {
    #[msg("Invalid quote mint address")]
    InvalidQuoteMintAddress,
}
