use anchor_lang::prelude::*;

use crate::{PoolManager, SoldStakingError};

#[derive(Accounts)]
pub struct UpdatePoolOwner<'info> {
    #[account(
        mut,
        seeds = [b"pool-manager"],
        bump = pool_manager.bump
    )]
    pub pool_manager: Account<'info, PoolManager>,
    #[account(address = pool_manager.pending_owner @ SoldStakingError::InvalidOwner)]
    pub new_owner: Signer<'info>,
}

pub fn handler(ctx: Context<UpdatePoolOwner>) -> Result<()> {
    let pool_manager = &mut ctx.accounts.pool_manager;

    pool_manager.owner = pool_manager.pending_owner;
    pool_manager.pending_owner = Pubkey::default();

    Ok(())
}
