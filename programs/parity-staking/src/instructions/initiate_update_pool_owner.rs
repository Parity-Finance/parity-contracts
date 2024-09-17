use anchor_lang::prelude::*;

use crate::{ParityStakingError, PoolManager};

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

    // Validate new owner
    if new_owner == Pubkey::default() {
        return err!(ParityStakingError::InvalidParam); // Ensure new owner is not the default public key
    }

    // Ensure the current owner is the one initiating the update
    if ctx.accounts.owner.key() != pool_manager.owner {
        return err!(ParityStakingError::InvalidOwner);
    }

     // Check if the pending owner is already set to the new owner
     if pool_manager.pending_owner == new_owner {
        return err!(ParityStakingError::OwnerAlreadySet); // Ensure the new owner is not already pending
    }

    pool_manager.pending_owner = new_owner;

    Ok(())
}
