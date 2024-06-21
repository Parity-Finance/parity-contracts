use crate::{PoolManager, SoldStakingError};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ClosePoolManager<'info> {
    #[account(
        mut,
        close = owner,
        seeds = [b"pool-manager"],
        bump = pool_manager.bump
    )]
    pub pool_manager: Account<'info, PoolManager>,
    #[account(mut, address = pool_manager.owner @ SoldStakingError::InvalidOwner)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClosePoolManager>) -> Result<()> {
    msg!("Closing pool manager account");
    Ok(())
}
