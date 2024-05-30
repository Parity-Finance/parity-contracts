pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("F9pkhuLyu1usfS5p6RCuXxeS2TQsAVqANo1M2iC8ze1t");

#[program]
pub mod sold_staking {
    use super::*;

    pub fn initialize_stake_pool(
        ctx: Context<InitializeStakePool>,
        params: InitializeStakePoolParams,
    ) -> Result<()> {
        initialize_stake_pool::handler(ctx, params)
    }

    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        stake::handler(ctx, amount)
    }

    pub fn unstake(ctx: Context<Unstake>, amount: u64) -> Result<()> {
        unstake::handler(ctx, amount)
    }
}
