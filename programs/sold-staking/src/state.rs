use anchor_lang::prelude::*;

pub const STAKE_POOL_LENGTH: usize = 8 + 1 + (32 * 4) + 1 + 1 + (8 * 7);

#[account]
pub struct StakePool {
    pub bump: u8, // 1 byte

    // Authorities
    pub owner: Pubkey, // 32 bytes
    pub admin: Pubkey, // 32 bytes

    // Tokens
    pub base_mint: Pubkey,      // 32 bytes - SOLD token mint
    pub x_mint: Pubkey,         // 32 bytes - xSOLD token mint
    pub base_mint_decimals: u8, // 1 byte
    pub x_mint_decimals: u8,    // 1 byte

    // Yield
    pub annual_yield_rate: u64, // 8 bytes - Stored as basis points, e.g., 2000 for 20%
    pub initial_exchange_rate: u64, // 8 bytes
    pub last_yield_change_exchange_rate: u64, // 8 bytes
    pub inception_timestamp: i64, // 8 bytes // A bit useless
    pub last_yield_change_timestamp: i64, // 8 bytes

    // Other
    pub base_balance: u64, // 8 bytes
    pub x_supply: u64,     // 8 bytes
}

impl StakePool {
    // Constants for scaling
    const SCALE_FACTOR: u64 = 31_536_000;
    const SECONDS_PER_YEAR: u64 = 31_536_000; // 60 * 60 * 24 * 365

    pub fn calculate_exchange_rate(&mut self, current_timestamp: i64) -> Option<u64> {
        if current_timestamp == self.last_yield_change_timestamp {
            return Some(self.last_yield_change_exchange_rate);
        }

        let elapsed_time = current_timestamp.checked_sub(self.last_yield_change_timestamp)?;
        msg!("Elapsed time: {}", elapsed_time);

        let years_elapsed = (elapsed_time as u128)
            .checked_mul(Self::SCALE_FACTOR as u128)?
            .checked_div(Self::SECONDS_PER_YEAR as u128)?;
        msg!("Years elapsed: {}", years_elapsed);

        let rate = (self.annual_yield_rate as u128)
            .checked_mul(Self::SCALE_FACTOR as u128)?
            .checked_div(10_000)?;
        msg!("Scaled annual rate: {}", rate);

        let effective_rate = rate
            .checked_mul(years_elapsed)?
            .checked_div(Self::SCALE_FACTOR as u128)?;
        msg!("Effective rate for the elapsed time: {}", effective_rate);

        // Apply the effective rate to the latest exchange rate
        let compounded_rate = (self.last_yield_change_exchange_rate as u128)
            .checked_mul(Self::SCALE_FACTOR as u128)?
            .checked_div(Self::SCALE_FACTOR as u128 + effective_rate)?;
        msg!("Compounded rate: {}", compounded_rate);

        msg!("Last computed exchange rate: {}", compounded_rate);

        Some(compounded_rate as u64)
    }
}
