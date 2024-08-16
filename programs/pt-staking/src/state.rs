use anchor_lang::prelude::*;

use crate::PtStakingError;

pub const GLOBAL_CONFIG_LENGTH: usize =
    8 + 1 + (32 * 5) + (1 * 2) + (8 * 3) + 4 * (8 + 8 + 1 + 4) + 4 * (8 + 8 + 4);

pub const USER_STAKE_LENGTH: usize = 8 + 32 + 8 + 8 + 8 + 4 * (8 + 8 + 4);

#[account]
pub struct GlobalConfig {
    pub bump: u8, // 1 byte

    // Authorities
    pub owner: Pubkey,         // 32 bytes
    pub pending_owner: Pubkey, // 32 bytes
    pub admin: Pubkey,         // 32 bytes

    pub base_mint: Pubkey,                             // 32 bytes
    pub staking_vault: Pubkey,                         // 32 bytes
    pub base_mint_decimals: u8,                        // 1 byte
    pub baseline_yield: u8,                            // 1 bytes
    pub staked_supply: u64,                            // 8 bytes
    pub total_points_issued: u64,                      // 8 bytes
    pub deposit_cap: u64,                              // 8 bytes
    pub exchange_rate_history: Vec<ExchangeRatePhase>, // 4 bytes (Vec length) + N * size of ExchangeRatePhase
    pub points_history: Vec<PointsEarnedPhase>, // 4 bytes (Vec length) + N * size of PointsEarnedPhase
}

#[account]
pub struct UserStake {
    pub user_pubkey: Pubkey,                    // 32 bytes
    pub staked_amount: u64,                     // 8 bytes
    pub staking_timestamp: i64,                 // 8 bytes
    pub last_claim_timestamp: i64,              // 8 bytes
    pub points_history: Vec<PointsEarnedPhase>, // 4 bytes (Vec length) + N * size of PointsEarnedPhase
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ExchangeRatePhase {
    pub exchange_rate: u64,    // 8 bytes
    pub start_date: i64,       // 8 bytes
    pub end_date: Option<i64>, // 1 byte (Option) + 8 bytes (i64) = 9 bytes
    pub index: u32,            // 4 bytes
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PointsEarnedPhase {
    pub exchange_rate: u64, // 8 bytes
    pub points: u64,        // 8 bytes
    pub index: u32,         // 4 bytes
}

impl GlobalConfig {
    pub fn check_excessive_deposit(&self, quote_amount: u64, vault_amount: u64) -> Result<()> {
        let new_vault_amount = (vault_amount as u128)
            .checked_add(quote_amount as u128)
            .ok_or(PtStakingError::CalculationOverflow)?;

        msg!("quote_amount: {}", quote_amount);
        msg!("vault_amount: {}", vault_amount);
        msg!("deposit_cap: {}", self.deposit_cap);

        if new_vault_amount > self.deposit_cap as u128 {
            return err!(PtStakingError::DepositCapExceeded);
        }

        Ok(())
    }

    // Method to retrieve the current exchange rate from the global config.
    pub fn get_current_exchange_rate(&self) -> Result<u64> {
        match self.exchange_rate_history.last() {
            Some(rate_phase) => Ok(rate_phase.exchange_rate),
            None => err!(PtStakingError::NoExchangeRateAvailable),
        }
    }

    pub fn calculate_points(&self, staked_amount: u64, staking_duration: i64) -> Result<u64> {
        let mut total_points: u64 = 0;

        for rate_phase in &self.exchange_rate_history {
            let phase_start = rate_phase.start_date;
            let phase_end = rate_phase.end_date.unwrap_or(staking_duration);
            let phase_duration = phase_end - phase_start;

            let duration_in_years = (phase_duration as f64) / 31_536_000.0; // Convert seconds to years


            // Calculate points earned in this phase
            let points_for_phase = ((staked_amount as f64)
                * (self.baseline_yield as f64 / 100.0)
                * duration_in_years
                * rate_phase.exchange_rate as f64)
                .round() as u64;

            total_points = total_points
                .checked_add(points_for_phase)
                .ok_or(PtStakingError::CalculationOverflow)?;
        }

        Ok(total_points)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn default_global_config() -> GlobalConfig {
        GlobalConfig {
            bump: 0,
            owner: Pubkey::default(),
            pending_owner: Pubkey::default(),
            admin: Pubkey::default(),
            staking_vault: Pubkey::default(),
            baseline_yield: 5,
            staked_supply: 1_000_000,
            total_points_issued: 50_000,
            deposit_cap: 10_000_000,
            exchange_rate_history: create_default_exchange_rate_phases(),
            points_history: create_default_points_earned_phases(),
            base_mint: Pubkey::default(),
            base_mint_decimals: 6,
        }
    }

    fn default_user_stake() -> UserStake {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        UserStake {
            user_pubkey: Pubkey::new_unique(),
            staked_amount: 1_000_000,
            staking_timestamp: timestamp,
            last_claim_timestamp: timestamp,
            points_history: create_default_points_earned_phases(),
        }
    }

    fn create_default_exchange_rate_phases() -> Vec<ExchangeRatePhase> {
        vec![
            ExchangeRatePhase {
                exchange_rate: 20,
                start_date: 1_000_000,
                end_date: Some(2_000_000),
                index: 0,
            },
            ExchangeRatePhase {
                exchange_rate: 25,
                start_date: 2_000_000,
                end_date: Some(3_000_000),
                index: 1,
            },
        ]
    }

    fn create_default_points_earned_phases() -> Vec<PointsEarnedPhase> {
        vec![
            PointsEarnedPhase {
                exchange_rate: 20,
                points: 100,
                index: 0,
            },
            PointsEarnedPhase {
                exchange_rate: 25,
                points: 200,
                index: 1,
            },
        ]
    }

    #[test]
    fn test_initialize_global_config() {
        let global_config = default_global_config();

        // Assertions
        assert_eq!(global_config.staking_vault, Pubkey::default());
        assert_eq!(global_config.baseline_yield, 5);
        assert_eq!(global_config.staked_supply, 1_000_000);
        assert_eq!(global_config.total_points_issued, 50_000);
        assert_eq!(global_config.deposit_cap, 10_000_000);
        assert_eq!(global_config.exchange_rate_history.len(), 2);
        assert_eq!(global_config.points_history.len(), 2);

        // Additional assertions on history elements
        assert_eq!(global_config.exchange_rate_history[0].exchange_rate, 20);
        assert_eq!(global_config.exchange_rate_history[1].exchange_rate, 25);
        assert_eq!(global_config.points_history[0].points, 100);
        assert_eq!(global_config.points_history[1].points, 200);
    }

    #[test]
    fn test_initialize_user_stake() {
        let user_stake = default_user_stake();

        // Assertions
        assert_eq!(user_stake.staked_amount, 1_000_000);
        assert_eq!(user_stake.points_history.len(), 2);

        // Additional assertions on points history elements
        assert_eq!(user_stake.points_history[0].points, 100);
        assert_eq!(user_stake.points_history[1].points, 200);
    }

    #[test]
    fn test_update_global_config() {
        let mut global_config = default_global_config();

        // Update some fields
        global_config.baseline_yield = 7;
        global_config.staked_supply = 2_000_000;
        global_config.total_points_issued = 100_000;

        // Assertions after update
        assert_eq!(global_config.baseline_yield, 7);
        assert_eq!(global_config.staked_supply, 2_000_000);
        assert_eq!(global_config.total_points_issued, 100_000);
    }

    #[test]
    fn test_update_user_stake() {
        let mut user_stake = default_user_stake();

        // Update the staked amount and last claim timestamp
        user_stake.staked_amount += 500_000;
        user_stake.last_claim_timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        // Assertions after update
        assert_eq!(user_stake.staked_amount, 1_500_000);
        assert_eq!(
            user_stake.last_claim_timestamp,
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs() as i64
        );
    }

    #[test]
    fn test_check_excessive_deposit() {
        let global_config = default_global_config();

        // Valid deposit
        let result = global_config.check_excessive_deposit(500_000, 4_000_000);
        assert!(result.is_ok());

        // Excessive deposit
        let result = global_config.check_excessive_deposit(7_000_000, 4_000_000);
        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err(),
            PtStakingError::DepositCapExceeded.into()
        );
    }

    #[test]
    fn test_get_current_exchange_rate() {
        let global_config = default_global_config();

        // Get the current exchange rate (latest phase)
        let exchange_rate = global_config.get_current_exchange_rate();
        assert!(exchange_rate.is_ok());
        assert_eq!(exchange_rate.unwrap(), 25);

        // Test with empty exchange rate history
        let mut global_config_empty = default_global_config();
        global_config_empty.exchange_rate_history.clear();

        let exchange_rate = global_config_empty.get_current_exchange_rate();
        assert!(exchange_rate.is_err());
        assert_eq!(
            exchange_rate.unwrap_err(),
            PtStakingError::NoExchangeRateAvailable.into()
        );
    }

    #[test]
    fn test_calculate_points() {
        let global_config = default_global_config();
    
        // Calculate points for a given staked amount and duration
        let staked_amount = 1_000_000;
        let staking_duration = 3_000_000; // Matching the end_date of the last phase
    
        // Log the exchange rate history for debugging
        for (i, phase) in global_config.exchange_rate_history.iter().enumerate() {
            msg!(
                "Phase {}: start={}, end={:?}, rate={}",
                i,
                phase.start_date,
                phase.end_date,
                phase.exchange_rate
            );
        }

    
        let points = global_config.calculate_points(staked_amount, staking_duration);
        assert!(points.is_ok());
        
        let calculated_points = points.unwrap(); // Unwrap once and store in a variable
        msg!("Calculated Points: {}", calculated_points);
        assert_eq!(calculated_points, 71347); // Points calculation as per phases
    
        // Test with no exchange rate history
        let mut global_config_empty = default_global_config();
        global_config_empty.exchange_rate_history.clear();
    
        let points_empty = global_config_empty.calculate_points(staked_amount, staking_duration);
        assert!(points_empty.is_ok());
        
        let calculated_points_empty = points_empty.unwrap(); // Unwrap once for empty case
        assert_eq!(calculated_points_empty, 0); // No points should be earned
    }
    
}
