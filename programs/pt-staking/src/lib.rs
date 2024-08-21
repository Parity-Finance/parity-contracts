use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod state;

pub use error::*;
pub use instructions::*;
pub use state::*;

declare_id!("5zWkamSdh3S4hELhV1ezx6gzyCinBVi38StJUdi8cfGa");

#[program]
pub mod pt_staking {
    use super::*;

    pub fn initialize_global_config(
        ctx: Context<InitializeGlobalConfig>,
        params: InitializeGlobalConfigParams,
    ) -> Result<()> {
        initialize_global_config::handler(ctx, params)
    }

    pub fn pt_stake(ctx: Context<PtStake>, quantity: u64) -> Result<()> {
        pt_stake::handler(ctx, quantity)
    }

    pub fn pt_unstake(ctx: Context<PtUnstake>, quantity: u64) -> Result<()> {
        pt_unstake::handler(ctx, quantity)
    }

    pub fn update_global_config(
        ctx: Context<UpdateGlobalConfig>,
        params: UpdateGlobalConfigParams,
    ) -> Result<()> {
        update_global_config::handler(ctx, params)
    }

    pub fn initiate_update_global_config_owner(
        ctx: Context<InitiateUpdateGlobalConfigOwner>,
        new_owner: Pubkey,
    ) -> Result<()> {
        initiate_update_global_config_owner::handler(ctx, new_owner)
    }

    pub fn update_global_config_owner(ctx: Context<UpdateGlobalConfigOwner>) -> Result<()> {
        update_global_config_owner::handler(ctx)
    }
}
