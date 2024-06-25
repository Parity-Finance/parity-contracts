pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use error::*;
pub use instructions::*;
pub use state::*;

declare_id!("BmyPBNiuBnKrjcHPmGDkgmiYNgQA2s6ygKNR38CXSaxW");

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

    pub fn update_xmint_metadata(
        ctx: Context<UpdateXmintMetadata>,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        update_xmint_metadata::handler(ctx, name, symbol, uri)
    }

    pub fn update_pool_owner(ctx: Context<UpdatePoolOwner>) -> Result<()> {
        update_pool_owner::handler(ctx)
    }

    pub fn initiate_update_pool_owner(
        ctx: Context<InitiateUpdatePoolOwner>,
        new_owner: Pubkey,
    ) -> Result<()> {
        initiate_update_pool_owner::handler(ctx, new_owner)
    }
}
