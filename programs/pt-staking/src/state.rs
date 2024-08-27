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
    // pub baseline_yield_bps: u64,
    pub staked_supply: u64,
    pub total_points_issued: u64,
    pub deposit_cap: u64,
    #[max_len(10)]
    pub exchange_rate_history: Vec<ExchangeRatePhase>,
    #[max_len(10)]
    pub points_history: Vec<PointsEarnedPhase>,
    #[max_len(10)]
    pub base_yield_history: Vec<BaseYieldPhase>,
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

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, InitSpace)]
pub struct BaseYieldPhase {
    pub base_yield_bps: u64,
    pub start_date: i64,
    pub end_date: Option<i64>,
    pub index: u32,
}

enum CombinedPhase<'a> {
    ExchangeRate(&'a ExchangeRatePhase),
    BaseYield(&'a BaseYieldPhase),
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
        let mut current_time = staking_timestamp;
        let mut accumulated_points: u128 = 0;

        // Combine both histories and sort by start_date
        let mut combined_phases: Vec<(i64, CombinedPhase)> = self
            .exchange_rate_history
            .iter()
            .map(|phase| (phase.start_date, CombinedPhase::ExchangeRate(phase)))
            .chain(
                self.base_yield_history
                    .iter()
                    .map(|phase| (phase.start_date, CombinedPhase::BaseYield(phase))),
            )
            .collect();
        combined_phases.sort_by_key(|&(date, _)| date);

        let mut current_exchange_rate = self.exchange_rate_history.first().unwrap();
        let mut current_base_yield = self.base_yield_history.first().unwrap();

        for &(phase_start, ref phase) in combined_phases.iter() {
            if phase_start >= current_timestamp {
                break;
            }

            if phase_start <= current_time {
                match phase {
                    CombinedPhase::ExchangeRate(er) => {
                        // When exchange rate changes, push accumulated points and reset
                        if accumulated_points > 0 {
                            points_history.push(PointsEarnedPhase {
                                exchange_rate: current_exchange_rate.exchange_rate,
                                points: accumulated_points as u64,
                                index: current_exchange_rate.index,
                            });
                            accumulated_points = 0;
                        }
                        current_exchange_rate = er;
                    }
                    CombinedPhase::BaseYield(by) => current_base_yield = by,
                }
                continue;
            }

            let phase_end = phase_start.min(current_timestamp);
            let applicable_duration = phase_end - current_time;

            let duration_in_years = (applicable_duration as u128)
                .checked_mul(PRECISION)
                .unwrap()
                .checked_div(SECONDS_PER_YEAR)
                .unwrap();

            let points = (staked_amount as u128)
                .checked_mul(current_base_yield.base_yield_bps as u128)
                .unwrap()
                .checked_mul(duration_in_years)
                .unwrap()
                .checked_mul(current_exchange_rate.exchange_rate as u128)
                .unwrap()
                .checked_div(PRECISION)
                .unwrap()
                .checked_div(10000)
                .unwrap()
                .checked_div(10u128.pow(self.base_mint_decimals as u32))
                .unwrap();

            accumulated_points += points;

            current_time = phase_start;

            match phase {
                CombinedPhase::ExchangeRate(er) => {
                    // When exchange rate changes, push accumulated points and reset
                    points_history.push(PointsEarnedPhase {
                        exchange_rate: current_exchange_rate.exchange_rate,
                        points: accumulated_points as u64,
                        index: current_exchange_rate.index,
                    });
                    accumulated_points = 0;
                    current_exchange_rate = er;
                }
                CombinedPhase::BaseYield(by) => current_base_yield = by,
            }
        }

        // Calculate points for the final phase
        if current_time < current_timestamp {
            let applicable_duration = current_timestamp - current_time;

            let duration_in_years = (applicable_duration as u128)
                .checked_mul(PRECISION)
                .unwrap()
                .checked_div(SECONDS_PER_YEAR)
                .unwrap();

            let points = (staked_amount as u128)
                .checked_mul(current_base_yield.base_yield_bps as u128)
                .unwrap()
                .checked_mul(duration_in_years)
                .unwrap()
                .checked_mul(current_exchange_rate.exchange_rate as u128)
                .unwrap()
                .checked_div(PRECISION)
                .unwrap()
                .checked_div(10000)
                .unwrap()
                .checked_div(10u128.pow(self.base_mint_decimals as u32))
                .unwrap();

            accumulated_points += points;
        }

        // Push the final accumulated points
        if accumulated_points > 0 {
            points_history.push(PointsEarnedPhase {
                exchange_rate: current_exchange_rate.exchange_rate,
                points: accumulated_points as u64,
                index: current_exchange_rate.index,
            });
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

    fn assert_points_within_tolerance(actual: u64, expected: u64, tolerance: u64) {
        assert!(
            (actual as i64 - expected as i64).abs() <= tolerance as i64,
            "Points outside tolerance range. Expected close to {}, got {}",
            expected,
            actual
        );
    }

    fn default_global_config() -> GlobalConfig {
        GlobalConfig {
            bump: 0,
            owner: Pubkey::default(),
            pending_owner: Pubkey::default(),
            admin: Pubkey::default(),
            staking_vault: Pubkey::default(),
            base_yield_history: vec![BaseYieldPhase {
                base_yield_bps: 5,
                start_date: 0,
                end_date: None,
                index: 0,
            }],
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
        assert_eq!(global_config.base_yield_history[0].base_yield_bps, 5);
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
        global_config.base_yield_history.push(BaseYieldPhase {
            base_yield_bps: 7,
            start_date: 0,
            end_date: None,
            index: 1,
        });
        global_config.staked_supply = 2_000_000;
        global_config.total_points_issued = 100_000;

        // Assertions after update
        assert_eq!(global_config.base_yield_history[1].base_yield_bps, 7);
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
        global_config.base_yield_history.push(BaseYieldPhase {
            base_yield_bps: 2000, // 20% annual yield
            start_date: 0,
            end_date: None,
            index: 0,
        });

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
        assert_eq!(points[1].index, 1);
        assert_eq!(points[1].points, 52849654); // ~52.84 points

        // Phase 0 (older)
        assert_eq!(points[0].index, 0);
        assert_eq!(points[0].points, 63419583); // ~63.42 points

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
        assert_eq!(points[1].index, 1);
        assert_eq!(points[1].points, 63926941); // ~63.93 points

        // Phase 0 (50M FDV, one week)
        assert_eq!(points[0].index, 0);
        assert_eq!(points[0].points, 76712328); // ~76.71 points

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

    // NEW
    #[test]
    fn test_calculate_points_with_phases() {
        let mut global_config = default_global_config();

        // Set up exchange rate history
        global_config.exchange_rate_history = vec![
            ExchangeRatePhase {
                exchange_rate: 20_000_000, // 1 / 0.05 = 20 (50M FDV)
                start_date: 0,
                end_date: Some(604_800), // One week
                index: 0,
            },
            ExchangeRatePhase {
                exchange_rate: 16_666_667, // ~1 / 0.06 ≈ 16.67 (60M FDV)
                start_date: 604_800,
                end_date: None,
                index: 1,
            },
        ];

        // Set up base yield history
        global_config.base_yield_history = vec![BaseYieldPhase {
            base_yield_bps: 1000, // 10% annual yield
            start_date: 0,
            end_date: None,
            index: 0,
        }];

        // staked_amount: 1,000,000,000 (1000 tokens with 6 decimals)
        // base_yield_bps: 1000 (10% annual yield)
        // duration: 604,800 seconds (1 week)
        // exchange_rate: 20,000,000 (for the first phase)

        // Step 1: Calculate duration in years
        // duration_in_years = 604,800 / 31,536,000 = 0.01917808219 years

        // Step 2: Calculate points
        // points = 1000 * 0.1 * 0.01917808219 * 20 = 38.35616438

        // Test case: Staking for two weeks across two phases
        let staked_amount = 1_000_000_000; // 1000 Tokens with 9 decimals
        let staking_timestamp = 0;
        let current_timestamp = 1_209_600; // Two weeks

        let points = global_config
            .calculate_points(staked_amount, staking_timestamp, current_timestamp)
            .unwrap();

        assert_eq!(points.len(), 2);

        // Phase 1 (50M FDV, one week)
        assert_eq!(points[0].index, 0);
        assert_eq!(points[0].points, 38356164); // ~38.36 points

        // Phase 2 (60M FDV, one week)
        assert_eq!(points[1].index, 1);
        assert_eq!(points[1].points, 31963470); // ~31.96 points

        // Total points
        let total_points = points[0].points + points[1].points;
        assert_eq!(total_points, 70319634); // ~70.32 points
    }

    #[test]
    fn test_calculate_points_with_yield_change() {
        let mut global_config = default_global_config();

        // Set up exchange rate history
        global_config.exchange_rate_history = vec![ExchangeRatePhase {
            exchange_rate: 20_000_000, // 1 / 0.05 = 20 (50M FDV)
            start_date: 0,
            end_date: None,
            index: 0,
        }];

        // Set up base yield history with a change
        global_config.base_yield_history = vec![
            BaseYieldPhase {
                base_yield_bps: 1000, // 10% annual yield
                start_date: 0,
                end_date: Some(604_800), // One week
                index: 0,
            },
            BaseYieldPhase {
                base_yield_bps: 1500, // 15% annual yield
                start_date: 604_800,
                end_date: None,
                index: 1,
            },
        ];

        // Test case: Staking for two weeks with yield change after one week

        // Staked amount: 1,000 tokens
        // Duration: 2 weeks (1,209,600 seconds)
        // Exchange rate: 20 (constant throughout)

        // Week 1:
        // Base yield: 10% annual (1000 bps)
        // Duration: 1 week (604,800 seconds)
        // Duration in years: 604,800 / 31,536,000 ≈ 0.01917808219 years
        // Points = 1000 * 0.1 * 0.01917808219 * 20 ≈ 38.35616438 points

        // Week 2:
        // Base yield: 15% annual (1500 bps)
        // Duration: 1 week (604,800 seconds)
        // Duration in years: 604,800 / 31,536,000 ≈ 0.01917808219 years
        // Points = 1000 * 0.15 * 0.01917808219 * 20 ≈ 57.53424657 points

        // Total points: 38.35616438 + 57.53424657 ≈ 95.89041095 points
        let staked_amount = 1_000_000_000; // 1000 Tokens with 9 decimals
        let staking_timestamp = 0;
        let current_timestamp = 1_209_600; // Two weeks

        let points = global_config
            .calculate_points(staked_amount, staking_timestamp, current_timestamp)
            .unwrap();

        assert_eq!(points.len(), 1);

        // First week (10% yield)
        assert_eq!(points[0].index, 0);
        assert_eq!(points[0].points, 95890410); // ~95.89 points (combined for both weeks)
    }

    #[test]
    fn test_calculate_points_with_multiple_changes() {
        let mut global_config = default_global_config();

        // Set up exchange rate history
        global_config.exchange_rate_history = vec![
            ExchangeRatePhase {
                exchange_rate: 20_000_000, // 1 / 0.05 = 20 (50M FDV)
                start_date: 0,
                end_date: Some(432_000), // 5 days
                index: 0,
            },
            ExchangeRatePhase {
                exchange_rate: 16_666_667, // ~1 / 0.06 ≈ 16.67 (60M FDV)
                start_date: 432_000,
                end_date: Some(864_000), // 10 days
                index: 1,
            },
            ExchangeRatePhase {
                exchange_rate: 14_285_714, // ~1 / 0.07 ≈ 14.29 (70M FDV)
                start_date: 864_000,
                end_date: None,
                index: 2,
            },
        ];

        // Set up base yield history
        global_config.base_yield_history = vec![
            BaseYieldPhase {
                base_yield_bps: 1000, // 10% annual yield
                start_date: 0,
                end_date: Some(259_200), // 3 days
                index: 0,
            },
            BaseYieldPhase {
                base_yield_bps: 1500, // 15% annual yield
                start_date: 259_200,
                end_date: Some(691_200), // 8 days
                index: 1,
            },
            BaseYieldPhase {
                base_yield_bps: 2000, // 20% annual yield
                start_date: 691_200,
                end_date: None,
                index: 2,
            },
        ];

        // Staked amount: 1,000 tokens
        // Total duration: 14 days (1,209,600 seconds)

        // Phase 1: 0 to 3 days (259,200 seconds)
        // Yield: 10% annual (1000 bps)
        // Exchange rate: 20
        // Duration in years: 259,200 / 31,536,000 ≈ 0.00821917808 years
        // Points = 1000 * 0.1 * 0.00821917808 * 20 ≈ 16.43835616 points

        // Phase 2: 3 to 5 days (172,800 seconds)
        // Yield: 15% annual (1500 bps)
        // Exchange rate: 20
        // Duration in years: 172,800 / 31,536,000 ≈ 0.00547945205 years
        // Points = 1000 * 0.15 * 0.00547945205 * 20 ≈ 16.43835616 points

        // Phase 3: 5 to 8 days (259,200 seconds)
        // Yield: 15% annual (1500 bps)
        // Exchange rate: 16.67
        // Duration in years: 259,200 / 31,536,000 ≈ 0.00821917808 years
        // Points = 1000 * 0.15 * 0.00821917808 * 16.67 ≈ 20.54794521 points

        // Phase 4: 8 to 10 days (172,800 seconds)
        // Yield: 20% annual (2000 bps)
        // Exchange rate: 16.67
        // Duration in years: 172,800 / 31,536,000 ≈ 0.00547945205 years
        // Points = 1000 * 0.2 * 0.00547945205 * 16.67 ≈ 18.26484018 points

        // Phase 5: 10 to 14 days (345,600 seconds)
        // Yield: 20% annual (2000 bps)
        // Exchange rate: 14.29
        // Duration in years: 345,600 / 31,536,000 ≈ 0.01095890411 years
        // Points = 1000 * 0.2 * 0.01095890411 * 14.29 ≈ 31.3205479464 points

        // Total points: 16.43835616 + 16.43835616 + 20.54794521 + 18.26484018 + 31.31506849 ≈ 103.00456620 points

        let staked_amount = 1_000_000_000; // 1000 Tokens with 6 decimals
        let staking_timestamp = 0;
        let current_timestamp = 1_209_600; // 14 days

        let points = global_config
            .calculate_points(staked_amount, staking_timestamp, current_timestamp)
            .unwrap();

        msg!("Points: {:?}", points);

        // Perform assertions based on the calculated points
        assert_eq!(points.len(), 3);

        assert_eq!(points[0].points, 32876712); // ~32.88 points (16.44 + 16.44)
        assert_eq!(points[1].points, 38812785); // ~38.81 points (20.55 + 18.26)
        assert_points_within_tolerance(points[2].points, 31315068, 5000);
    }
}
