pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use error::*;
pub use instructions::*;
pub use state::*;

declare_id!("F9pkhuLyu1usfS5p6RCuXxeS2TQsAVqANo1M2iC8ze1t");

#[program]
pub mod sold_staking {
    use super::*;

    pub fn initialize_pool_manager(
        ctx: Context<InitializePoolManager>,
        params: InitializePoolManagerParams,
    ) -> Result<()> {
        initialize_pool_manager::handler(ctx, params)
    }

    pub fn stake(ctx: Context<Stake>, quantity: u64) -> Result<()> {
        stake::handler(ctx, quantity)
    }

    pub fn unstake(ctx: Context<Unstake>, quantity: u64) -> Result<()> {
        unstake::handler(ctx, quantity)
    }

    pub fn update_annual_yield(
        ctx: Context<UpdateAnnualYield>,
        params: UpdateYieldParams,
    ) -> Result<()> {
        update_annual_yield::handler(ctx, params)
    }

    pub fn update_pool_manager(
        ctx: Context<UpdatePoolManager>,
        params: UpdatePoolManagerParams,
    ) -> Result<()> {
        update_pool_manager::handler(ctx, params)
    }
}
