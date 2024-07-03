use anchor_lang::prelude::*;

use crate::{error::SoldStakingError, PoolManager};

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct UpdatePoolManagerParams {
    pub new_owner: Option<Pubkey>,
    pub new_admin: Option<Pubkey>,
}

#[derive(Accounts)]
pub struct UpdatePoolManager<'info> {
    #[account(
        mut,
        seeds = [b"pool-manager"],
        bump = pool_manager.bump
    )]
    pub pool_manager: Account<'info, PoolManager>,
    #[account(mut, address = pool_manager.owner @ SoldStakingError::InvalidOwner)]
    pub owner: Signer<'info>,
}

pub fn handler(ctx: Context<UpdatePoolManager>, params: UpdatePoolManagerParams) -> Result<()> {
    let pool_manager = &mut ctx.accounts.pool_manager;

    if let Some(new_owner) = params.new_owner {
        pool_manager.owner = new_owner;
    }
    if let Some(new_admin) = params.new_admin {
        pool_manager.admin = new_admin;
    }
    Ok(())
}
