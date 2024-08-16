use anchor_lang::prelude::*;

use crate::{GlobalConfig, PtStakingError};

#[derive(Accounts)]
pub struct UpdateGlobalConfigOwner<'info> { 
    #[account(
        mut,
        seeds = [b"global-config"],
        bump
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(mut, address = global_config.pending_owner @ PtStakingError::InvalidOwner)]
    pub new_owner: Signer<'info>,
}

pub fn handler(ctx: Context<UpdateGlobalConfigOwner>) -> Result<()> { 
    let global_config = &mut ctx.accounts.global_config;

    global_config.owner = global_config.pending_owner;
    global_config.pending_owner = Pubkey::default();

    Ok(())
}