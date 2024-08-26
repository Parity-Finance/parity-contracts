use anchor_lang::prelude::*;

use crate::PtStakingError;


#[account]
#[derive(InitSpace, Debug)]
pub struct GlobalConfig {
    pub bump: u8, 

    // Authorities
    pub owner: Pubkey,         
    pub pending_owner: Pubkey, 
    pub admin: Pubkey,         

    pub base_mint: Pubkey,                            
    pub staking_vault: Pubkey,                        
    pub base_mint_decimals: u8,                        
    pub baseline_yield_bps: u64,                       
    pub staked_supply: u64,                            
    pub total_points_issued: u64,                     
    pub deposit_cap: u64,
    #[max_len(10)]                              
    pub exchange_rate_history: Vec<ExchangeRatePhase>, 
    #[max_len(10)] 
    pub points_history: Vec<PointsEarnedPhase>, 
}

#[account]
#[derive(InitSpace, Debug)]
pub struct UserStake {
    pub user_pubkey: Pubkey, 
    pub staked_amount: u64,                  
    pub initial_staking_timestamp: i64,                
    pub last_claim_timestamp: i64,              
    #[max_len(10)] 
    pub points_history: Vec<PointsEarnedPhase>, 
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, InitSpace)]
pub struct ExchangeRatePhase {
    pub exchange_rate: u64,   
    pub start_date: i64,      
    pub end_date: Option<i64>,
    pub index: u32,            
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, InitSpace)]
pub struct PointsEarnedPhase {
    pub exchange_rate: u64,
    pub points: u64,      
    pub index: u32,        
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

    pub fn calculate_points(
        &self,
        staked_amount: u64,
        staking_timestamp: i64,
        current_timestamp: i64,
    ) -> Result<Vec<PointsEarnedPhase>> {
        const SECONDS_PER_YEAR: u128 = 31_536_000;
        const PRECISION: u128 = 1_000_000_000_000;

        let mut points_history = Vec::new();
        let mut remaining_duration = current_timestamp.saturating_sub(staking_timestamp);

        for phase in self.exchange_rate_history.iter().rev() {
            if remaining_duration <= 0 {
                break;
            }

            let phase_end = phase.end_date.unwrap_or(current_timestamp);
            let phase_duration = phase_end.saturating_sub(phase.start_date);
            let applicable_duration = remaining_duration.min(phase_duration);

            msg!(
                "Applicable duration for phase index {}: {}",
                phase.index,
                applicable_duration
            );

            let duration_in_years = (applicable_duration as u128)
                .checked_mul(PRECISION)
                .unwrap()
                .checked_div(SECONDS_PER_YEAR)
                .unwrap();

            let points = (staked_amount as u128)
                .checked_mul(self.baseline_yield_bps as u128)
                .unwrap()
                .checked_mul(duration_in_years)
                .unwrap()
                .checked_mul(phase.exchange_rate as u128)
                .unwrap()
                .checked_div(PRECISION)
                .unwrap()
                .checked_div(10000)
                .unwrap()
                .checked_div(10u128.pow(self.base_mint_decimals as u32)) // Divide by base_mint_decimals to account for the decimal places in exchange_rate
                .unwrap();

            points_history.push(PointsEarnedPhase {
                exchange_rate: phase.exchange_rate,
                points: points as u64,
                index: phase.index,
            });

            remaining_duration -= applicable_duration;
        }

        Ok(points_history)
    }

    pub fn update_global_points(&mut self, points_history: Vec<PointsEarnedPhase>) {
        for new_phase in points_history {
            if let Some(existing_phase) = self
                .points_history
                .iter_mut()
                .find(|p| p.index == new_phase.index)
            {
                existing_phase.points =
                    existing_phase.points.checked_add(new_phase.points).unwrap();

                //store the global total points
                self.total_points_issued = self
                    .total_points_issued
                    .checked_add(new_phase.points)
                    .unwrap();
            } else {
                self.points_history.push(new_phase.clone());

                //store the global total points
                self.total_points_issued = self
                    .total_points_issued
                    .checked_add(new_phase.points)
                    .unwrap();
            }
        }
    }
}

impl UserStake {

    pub fn update_points_history(&mut self, points_history: Vec<PointsEarnedPhase>) {
        for new_phase in points_history {
            if let Some(existing_phase) = self
                .points_history
                .iter_mut()
                .find(|p| p.index == new_phase.index)
            {
                existing_phase.points =
                    existing_phase.points.checked_add(new_phase.points).unwrap();
            } else {
                self.points_history.push(new_phase);
            }
        }
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
            baseline_yield_bps: 5,
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
            initial_staking_timestamp: timestamp,
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
        assert_eq!(global_config.baseline_yield_bps, 5);
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
        global_config.baseline_yield_bps = 7;
        global_config.staked_supply = 2_000_000;
        global_config.total_points_issued = 100_000;

        // Assertions after update
        assert_eq!(global_config.baseline_yield_bps, 7);
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
        let mut global_config = default_global_config();
        global_config.baseline_yield_bps = 2000; // 20% annual yield

        // Update exchange rate history for the test
        global_config.exchange_rate_history = vec![
            ExchangeRatePhase {
                exchange_rate: 20_000_000, // 1 / 0.05 = 20 (50M FDV)
                start_date: 0,
                end_date: Some(1_000_000),
                index: 0,
            },
            ExchangeRatePhase {
                exchange_rate: 16_666_667, // ~1 / 0.06 ≈ 16.67 (rounded to 17 for simplicity) (60M FDV)
                start_date: 1_000_000,
                end_date: None,
                index: 1,
            },
        ];

        // Test case 1: Staking across multiple phases

        //         Phase 1 (60M FDV):
        // Exchange rate: 16,666,667
        // Duration: 500,000 seconds
        // Duration in years: 500,000 / 31,536,000 ≈ 0.015855
        // Points = (1000 * 0.2 * 0.015855) * 16.666667 ≈ 52.85 points

        // Phase 0 (50M FDV):
        // Exchange rate: 20,000,000
        // Duration: 500,000 seconds
        // Duration in years: 500,000 / 31,536,000 ≈ 0.015855
        // Points = (1000 * 0.2 * 0.015855) * 20 ≈ 63.42 points

        // Total points: 52.85 + 63.42 ≈ 116.27 points
        let staked_amount = 1_000_000_000; // 1000 Tokens with 6 decimals
        let staking_timestamp = 500_000;
        let current_timestamp = 1_500_000;

        let points = global_config
            .calculate_points(staked_amount, staking_timestamp, current_timestamp)
            .unwrap();

        // Log the points array
        msg!("Calculated points: {:?}", points);

        assert_eq!(points.len(), 2);

        // Phase 1 (most recent)
        assert_eq!(points[0].index, 1);
        assert_eq!(points[0].points, 52849654); // ~52.84 points

        // Phase 0 (older)
        assert_eq!(points[1].index, 0);
        assert_eq!(points[1].points, 63419583); // ~63.42 points

        // Test case 2: Staking within a single phase

        //         Phase 1 (60M FDV):
        // Exchange rate: 16,666,667
        // Duration: 300,000 seconds
        // Duration in years: 300,000 / 31,536,000 ≈ 0.009513
        // Points = (1000 * 0.2 * 0.009513) * 16.666667 ≈ 31.71 points
        let staking_timestamp = 1_200_000;
        let current_timestamp = 1_500_000;

        let points = global_config
            .calculate_points(staked_amount, staking_timestamp, current_timestamp)
            .unwrap();

        assert_eq!(points.len(), 1);
        assert_eq!(points[0].index, 1);
        assert_eq!(points[0].points, 31709792); // ~31.71 points

        // Test case 3: Staking for exactly one week in each phase

        //         Phase 1 (60M FDV):
        // Exchange rate: 16,666,667
        // Duration: 604,800 seconds (1 week)
        // Duration in years: 604,800 / 31,536,000 ≈ 0.019178
        // Points = (1000 * 0.2 * 0.019178) * 16.666667 ≈ 63.93 points

        // Phase 0 (50M FDV):
        // Exchange rate: 20,000,000
        // Duration: 604,800 seconds (1 week)
        // Duration in years: 604,800 / 31,536,000 ≈ 0.019178
        // Points = (1000 * 0.2 * 0.019178) * 20 ≈ 76.71 points

        // Total points: 63.93 + 76.71 ≈ 140.64 points
        let staking_timestamp = 395_200; // 1,000,000 - 604,800
        let current_timestamp = 1_604_800; // 1,000,000 + 604,800

        let points = global_config
            .calculate_points(staked_amount, staking_timestamp, current_timestamp)
            .unwrap();

        assert_eq!(points.len(), 2);

        // Phase 1 (60M FDV, one week)
        assert_eq!(points[0].index, 1);
        assert_eq!(points[0].points, 63926941); // ~63.93 points

        // Phase 0 (50M FDV, one week)
        assert_eq!(points[1].index, 0);
        assert_eq!(points[1].points, 76712328); // ~76.71 points

        // Total points
        let total_points = points[0].points + points[1].points;
        assert_eq!(total_points, 140639269); // ~140.64 points
    }

    #[test]
    fn test_user_stake_update_points_history() {
        let mut user_stake = default_user_stake();

        let new_points = vec![
            PointsEarnedPhase {
                exchange_rate: 25,
                points: 50,
                index: 1,
            },
            PointsEarnedPhase {
                exchange_rate: 30,
                points: 100,
                index: 2,
            },
        ];

        user_stake.update_points_history(new_points);

        // Check that points were updated correctly
        assert_eq!(user_stake.points_history.len(), 3);
        assert_eq!(user_stake.points_history[1].points, 250); // Updated existing phase
        assert_eq!(user_stake.points_history[2].points, 100); // New phase added
    }

    #[test]
    fn test_global_config_update_global_points() {
        let mut global_config = default_global_config();

        let new_points = vec![
            PointsEarnedPhase {
                exchange_rate: 25,
                points: 100,
                index: 1,
            },
            PointsEarnedPhase {
                exchange_rate: 30,
                points: 150,
                index: 2,
            },
        ];

        global_config.update_global_points(new_points);

        // Check that global points were updated correctly
        assert_eq!(global_config.points_history.len(), 3);
        assert_eq!(global_config.points_history[1].points, 300); // Updated existing phase
        assert_eq!(global_config.points_history[2].points, 150); // New phase added
    }
}
