use anchor_lang::prelude::*;

use crate::{PoolManager, ParityStakingError};

#[derive(Accounts)]
pub struct InitiateUpdatePoolOwner<'info> {
    #[account(
        mut,
        seeds = [b"pool-manager"],
        bump = pool_manager.bump
    )]
    pub pool_manager: Account<'info, PoolManager>,
    #[account(address = pool_manager.owner @ ParityStakingError::InvalidOwner)]
    pub owner: Signer<'info>,
}

pub fn handler(ctx: Context<InitiateUpdatePoolOwner>, new_owner: Pubkey) -> Result<()> {
    let pool_manager = &mut ctx.accounts.pool_manager;

    pool_manager.pending_owner = new_owner;

    Ok(())
}
