use anchor_lang::prelude::*;

pub const STAKE_POOL_LENGTH: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 32 + 1 + 1 + 1 + 8;

#[account]
pub struct StakePool {
    pub base_mint: Pubkey,          // 32 bytes - SOLD token mint
    pub x_mint: Pubkey,             // 32 bytes - xSOLD token mint
    pub inception_timestamp: i64,   // 8 bytes
    pub annual_yield_rate: u64,     // 8 bytes - Stored as basis points, e.g., 2000 for 20%
    pub base_balance: u64,          // 8 bytes
    pub x_supply: u64,              // 8 bytes
    pub authority: Pubkey,          // 32 bytes
    pub bump: u8,                   // 1 byte
    pub base_mint_decimals: u8,     // 1 byte
    pub x_mint_decimals: u8,        // 1 byte
    pub initial_exchange_rate: u64, // 8 bytes
}

impl StakePool {
    pub fn calculate_exchange_rate(&self, current_timestamp: i64) -> f64 {
        let elapsed_time = current_timestamp - self.inception_timestamp;
        let years_elapsed = (elapsed_time as f64) / (60.0 * 60.0 * 24.0 * 365.25);
        let rate = (self.annual_yield_rate as f64) / 10000.0; // Convert basis points to decimal
        (1.0 + rate).powf(years_elapsed)
    }
}
