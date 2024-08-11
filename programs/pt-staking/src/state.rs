use anchor_lang::prelude::*;

pub const GLOBAL_CONFIG_LENGTH: usize =
    8 + 1 + (32 * 5) + (1 * 2) + (8 * 3) + 4 * (8 + 8 + 1 + 4) + 4 * (8 + 8 + 4);

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

#[cfg(test)]
mod tests {
    use super::*;

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
        // Create a default GlobalConfig
        let bump = 0;
        let owner = Pubkey::default();
        let pending_owner = Pubkey::default();
        let admin = Pubkey::default();
        let staking_vault = Pubkey::default();
        let base_mint = Pubkey::default();
        let baseline_yield = 5;
        let staked_supply = 1_000_000;
        let total_points_issued = 50_000;
        let deposit_cap = 10_000_000;
        let exchange_rate_history = create_default_exchange_rate_phases();
        let points_history = create_default_points_earned_phases();

        let global_config = GlobalConfig {
            bump,
            owner,
            pending_owner,
            admin,
            staking_vault,
            baseline_yield,
            staked_supply,
            total_points_issued,
            deposit_cap,
            exchange_rate_history: exchange_rate_history.clone(),
            points_history: points_history.clone(),
            base_mint,
            base_mint_decimals: 6, // Add this line, adjust the value as needed
        };

        // Assertions
        assert_eq!(global_config.staking_vault, staking_vault);
        assert_eq!(global_config.baseline_yield, baseline_yield);
        assert_eq!(global_config.staked_supply, staked_supply);
        assert_eq!(global_config.total_points_issued, total_points_issued);
        assert_eq!(global_config.deposit_cap, deposit_cap);
        assert_eq!(
            global_config.exchange_rate_history.len(),
            exchange_rate_history.len()
        );
        assert_eq!(global_config.points_history.len(), points_history.len());

        // Additional assertions on history elements
        assert_eq!(global_config.exchange_rate_history[0].exchange_rate, 20);
        assert_eq!(global_config.exchange_rate_history[1].exchange_rate, 25);
        assert_eq!(global_config.points_history[0].points, 100);
        assert_eq!(global_config.points_history[1].points, 200);
    }

    #[test]
    fn test_update_global_config() {
        // Create a default GlobalConfig
        let mut global_config = GlobalConfig {
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
        };

        // Update some fields
        global_config.baseline_yield = 7;
        global_config.staked_supply = 2_000_000;
        global_config.total_points_issued = 100_000;

        // Assertions after update
        assert_eq!(global_config.baseline_yield, 7);
        assert_eq!(global_config.staked_supply, 2_000_000);
        assert_eq!(global_config.total_points_issued, 100_000);
    }
}
