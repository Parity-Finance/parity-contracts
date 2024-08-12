use anchor_lang::prelude::*;

use crate::{from_decimal, pow, to_decimal, ParityStakingError, PRECISION};

pub const POOL_MANAGER_LENGTH: usize = 8 + 1 + (32 * 5) + 1 + 1 + (8 * 8) + 4;

#[account]
pub struct PoolManager {
    pub bump: u8, // 1 byte

    // Authorities
    pub owner: Pubkey,         // 32 bytes
    pub pending_owner: Pubkey, // 32 bytes
    pub admin: Pubkey,         // 32 bytes

    // Tokens
    pub base_mint: Pubkey,      // 32 bytes - pUSD token mint
    pub x_mint: Pubkey,         // 32 bytes - spUSD token mint
    pub base_mint_decimals: u8, // 1 byte
    pub x_mint_decimals: u8,    // 1 byte

    // Yield
    pub interval_apr_rate: u64, // 8 bytes - Stored as basis points, e.g., 2000 for 20%
    pub seconds_per_interval: i32, // 4 bytes
    pub initial_exchange_rate: u64, // 8 bytes
    pub last_yield_change_exchange_rate: u64, // 8 bytes
    pub inception_timestamp: i64, // 8 bytes // A bit useless
    pub last_yield_change_timestamp: i64, // 8 bytes

    // Other
    pub base_balance: u64, // 8 bytes
    // Deposit cap
    pub deposit_cap: u64, // 8 bytes
}

impl PoolManager {
    pub fn calculate_exchange_rate(&mut self, current_timestamp: i64) -> Option<u64> {
        if current_timestamp == self.last_yield_change_timestamp {
            return Some(self.last_yield_change_exchange_rate);
        }

        let elapsed_time = current_timestamp.checked_sub(self.last_yield_change_timestamp)?;
        msg!("Elapsed time: {}", elapsed_time);

        let interval_amounts = elapsed_time.checked_div(self.seconds_per_interval as i64)?;
        let remaining_seconds = elapsed_time.checked_rem(self.seconds_per_interval as i64)?;
        msg!("intervals: {}", interval_amounts);
        msg!("Remaining seconds: {}", remaining_seconds);

        let interval_rate = self.interval_apr_rate as u128;
        msg!("Interval Rate: {}", interval_rate);

        let compounded_rate = to_decimal(
            pow(
                from_decimal(interval_rate).unwrap(),
                interval_amounts as i32,
            )
            .unwrap(),
        )
        .unwrap();
        msg!("Compounded rate: {}", compounded_rate);

        // Calculate the linear yield for the remaining seconds
        let linear_yield = (interval_rate as u128)
            .checked_sub(PRECISION)
            .unwrap()
            .checked_mul(remaining_seconds as u128)
            .unwrap()
            .checked_div(self.seconds_per_interval as u128)
            .unwrap();
        msg!("Linear yield: {}", linear_yield);

        // Add the linear yield to the compounded rate
        let total_rate = compounded_rate.checked_add(linear_yield).unwrap();
        msg!("Total rate: {}", total_rate);

        // Multiply the current exchange rate with the total rate
        let new_exchange_rate = (self.last_yield_change_exchange_rate as u128)
            .checked_mul(total_rate)
            .unwrap()
            .checked_div(PRECISION as u128)
            .unwrap() as u64;

        msg!("New exchange rate: {}", new_exchange_rate);

        Some(new_exchange_rate as u64)
    }

    pub fn calculate_normalized_quantity(
        &self,
        quantity: u64,
        from_decimals: u8,
        to_decimals: u8,
    ) -> Result<u64> {
        let decimal_difference = (from_decimals as i32 - to_decimals as i32).abs() as u32;

        if from_decimals > to_decimals {
            (quantity as u128)
                .checked_div(10u128.pow(decimal_difference))
                .ok_or(ParityStakingError::CalculationOverflow.into())
                .map(|result| result as u64)
        } else if from_decimals < to_decimals {
            (quantity as u128)
                .checked_mul(10u128.pow(decimal_difference))
                .ok_or(ParityStakingError::CalculationOverflow.into())
                .map(|result| result as u64)
        } else {
            Ok(quantity)
        }
    }

    pub fn calculate_amount_to_mint(
        &mut self,
        x_mint_supply: u64,
        current_timestamp: i64,
    ) -> Result<u64> {
        // Normalize the x_mint_supply to the base_mint decimals
        let base_decimals = 10u64.pow(self.base_mint_decimals.into());
        let normalized_x_mint_supply = self.calculate_normalized_quantity(
            x_mint_supply,
            self.x_mint_decimals,
            self.base_mint_decimals,
        )?;

        let exchange_rate = self
            .calculate_exchange_rate(current_timestamp)
            .ok_or(ParityStakingError::CalculationOverflow)?;

        // Calculate the x_supply_value
        let x_supply_value = (normalized_x_mint_supply as u128)
            .checked_mul(exchange_rate as u128)
            .ok_or(ParityStakingError::CalculationOverflow)?
            .checked_div(base_decimals as u128)
            .ok_or(ParityStakingError::CalculationOverflow)?;

        let base_balance = self.base_balance as u128;

        msg!("X Supply Value: {}", x_supply_value);
        msg!("Base Balance: {}", base_balance);

        // Calculate the amount to mint
        let amount_to_mint = if x_supply_value > base_balance {
            x_supply_value
                .checked_sub(base_balance)
                .ok_or(ParityStakingError::CalculationOverflow)? as u64
        } else {
            0
        };

        msg!("Amount to mint: {}", amount_to_mint);

        Ok(amount_to_mint)
    }

    pub fn calculate_output_amount(
        &mut self,
        quantity: u64,
        current_timestamp: i64,
        is_base_to_x: bool, // true if converting from baseMint to xMint, false otherwise
    ) -> Result<u64> {
        let (from_decimals, to_decimals) = if is_base_to_x {
            (self.base_mint_decimals, self.x_mint_decimals)
        } else {
            (self.x_mint_decimals, self.base_mint_decimals)
        };

        let exchange_rate = self
            .calculate_exchange_rate(current_timestamp)
            .ok_or(ParityStakingError::CalculationOverflow)?;

        // Normalize the input quantity
        let normalized_quantity =
            self.calculate_normalized_quantity(quantity, from_decimals, to_decimals)?;

        msg!("Normalized quantity: {}", normalized_quantity);

        // Calculate the output amount based on the direction of conversion
        let output_amount = if is_base_to_x {
            // Converting from baseMint to xMint
            (normalized_quantity as u128)
                .checked_mul(10u128.pow(to_decimals.into()))
                .ok_or(ParityStakingError::CalculationOverflow)?
                .checked_div(exchange_rate as u128)
                .ok_or(ParityStakingError::CalculationOverflow)?
        } else {
            // Converting from xMint to baseMint
            (normalized_quantity as u128)
                .checked_mul(exchange_rate as u128)
                .ok_or(ParityStakingError::CalculationOverflow)?
                .checked_div(10u128.pow(to_decimals.into()))
                .ok_or(ParityStakingError::CalculationOverflow)?
        } as u64;

        msg!("Output amount: {}", output_amount);

        Ok(output_amount)
    }

    pub fn check_excessive_deposit(&self, quote_amount: u64, vault_amount: u64) -> Result<()> {
        let new_vault_amount = (vault_amount as u128)
            .checked_add(quote_amount as u128)
            .ok_or(ParityStakingError::CalculationOverflow)?;

        msg!("quote_amount: {}", quote_amount);
        msg!("vault_amount: {}", vault_amount);
        msg!("deposit_cap: {}", self.deposit_cap);

        if new_vault_amount > self.deposit_cap as u128 {
            return err!(ParityStakingError::DepositCapExceeded);
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn default_pool_manager() -> PoolManager {
        PoolManager {
            bump: 0,
            owner: Pubkey::default(),
            pending_owner: Pubkey::default(),
            admin: Pubkey::default(),
            base_mint: Pubkey::default(),
            x_mint: Pubkey::default(),
            base_mint_decimals: 6,
            x_mint_decimals: 6,
            interval_apr_rate: 1000166517567, // Interval APR rate without considering zeros
            seconds_per_interval: 8 * 60 * 60, // 8 hours / Can be changed
            initial_exchange_rate: 1000000,
            last_yield_change_exchange_rate: 1000000,
            inception_timestamp: 0,
            last_yield_change_timestamp: 0,
            base_balance: 0,
            deposit_cap: 500000,
        }
    }

    #[test]
    fn test_calculate_exchange_rate() {
        let mut pool_manager = default_pool_manager();

        // Test case where current_timestamp is equal to last_yield_change_timestamp
        pool_manager.last_yield_change_timestamp = 1_000_000;
        pool_manager.last_yield_change_exchange_rate = 1_000_000;
        let result = pool_manager.calculate_exchange_rate(1_000_000).unwrap();
        assert_eq!(result, 1_000_000);

        // Test case where one year has passed
        pool_manager.last_yield_change_timestamp = 0;
        let current_timestamp = 31_536_000; // One year in seconds
        let result = pool_manager
            .calculate_exchange_rate(current_timestamp)
            .unwrap();
        println!("One year has passed: {}", result);
        assert_eq!(result, 1_199_999); // The exchange rate should have increased

        // Test case where half a year has passed
        pool_manager.last_yield_change_timestamp = 0;
        let result = pool_manager
            .calculate_exchange_rate(current_timestamp / 2)
            .unwrap();
        assert_eq!(result, 1_095_437); // The exchange rate should have increased but less than 20%
    }

    #[test]
    fn test_calculate_normalized_quantity() {
        let pool_manager = default_pool_manager();

        // Test case where token decimals are equal
        let result = pool_manager
            .calculate_normalized_quantity(1000000, 6, 6)
            .unwrap();
        assert_eq!(result, 1000000);

        // Test case where base mint decimals are less than x mint decimals
        let result = pool_manager
            .calculate_normalized_quantity(1000000, 6, 9)
            .unwrap();
        assert_eq!(result, 1000000000);

        // Test case where base mint decimals are more than x mint decimals
        let result = pool_manager
            .calculate_normalized_quantity(1000000000, 9, 6)
            .unwrap();
        assert_eq!(result, 1000000);
    }

    #[test]
    fn test_calculate_amount_to_mint() {
        let mut pool_manager = default_pool_manager();

        // Set up the conditions
        pool_manager.base_balance = 1000_000_000; // 500 base tokens
        let x_mint_supply = 1000_000_000; // 1,000 xMint tokens
        let current_timestamp = 31_536_000; // One year in seconds

        // Calculate the amount to mint for one year
        let amount_to_mint = pool_manager
            .calculate_amount_to_mint(x_mint_supply, current_timestamp)
            .unwrap();

        // Verify the result for one year
        assert_eq!(amount_to_mint, 199999000); // Needs to mint 200 base tokens

        // Calculate the amount to mint for half a year
        let half_year_timestamp = current_timestamp / 2; // Half a year in seconds
        let amount_to_mint_half_year = pool_manager
            .calculate_amount_to_mint(x_mint_supply, half_year_timestamp)
            .unwrap();

        // Verify the result for half a year
        assert_eq!(amount_to_mint_half_year, 95437000); // Needs to mint 100 base tokens
    }

    #[test]
    fn test_calculate_output_amount() {
        let mut pool_manager = default_pool_manager();

        // Set up the conditions
        let current_timestamp = 31_536_000; // One year in seconds

        // Test conversion from baseMint to xMint
        let base_quantity = 1000_000_000; // 1000 baseMint token
        let x_mint_amount = pool_manager
            .calculate_output_amount(base_quantity, current_timestamp, true)
            .unwrap();
        assert_eq!(x_mint_amount, 833_334_027); // Expected xMint amount after one year

        // Test conversion from xMint to baseMint
        let x_quantity = 100_000_000; // 1 xMint token
        let base_mint_amount = pool_manager
            .calculate_output_amount(x_quantity, current_timestamp, false)
            .unwrap();
        assert_eq!(base_mint_amount, 119_999_900); // Expected baseMint amount after one year
    }

    #[test]
    fn test_check_excessive_deposit() {
        let mut pool_manager = default_pool_manager();
        pool_manager.deposit_cap = 1000000;

        // Test case where deposit is within limit
        let result = pool_manager.check_excessive_deposit(500000, 500000);
        assert!(result.is_ok());

        // Test case where deposit exceeds limit
        let result = pool_manager.check_excessive_deposit(500000, 1000000);
        assert!(result.is_err());
    }
}
