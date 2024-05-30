use anchor_lang::prelude::*;

pub const STAKE_POOL_LENGTH: usize = 8 + 32 + 32 + 8 + 8;

#[account]
pub struct StakePool {
    pub base_mint: Pubkey, // SOLD token mint
    pub x_mint: Pubkey,    // xSOLD token mint
    pub inception_timestamp: i64,
    pub annual_yield_rate: u64, // Stored as basis points, e.g., 2000 for 20%
    pub base_balance: u64,
    pub x_supply: u64,
    pub authority: Pubkey,
    pub bump: u8,
    pub base_mint_decimals: u8,
    pub x_mint_decimals: u8,
    pub initial_exchange_rate: u64,
}

impl StakePool {
    pub fn calculate_exchange_rate(&self, current_timestamp: i64) -> f64 {
        let elapsed_time = current_timestamp - self.inception_timestamp;
        let years_elapsed = (elapsed_time as f64) / (60.0 * 60.0 * 24.0 * 365.25);
        let rate = (self.annual_yield_rate as f64) / 10000.0; // Convert basis points to decimal
        (1.0 + rate).powf(years_elapsed)
    }
}
