use anchor_lang::prelude::*;

pub mod state;
pub mod instructions;

pub use state::*;
pub use instructions::*;

declare_id!("5zWkamSdh3S4hELhV1ezx6gzyCinBVi38StJUdi8cfGa");

#[program]
pub mod pt_staking {
    use super::*;

   pub fn initialize_global_config(
    ctx: Context<InitializeGlobalConfig>,
    params: InitializeGlobalConfigParams,
   ) -> Result<()> {
    initialize_global_config::handler(ctx, params);
   }
}

