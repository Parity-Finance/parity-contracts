use anchor_lang::prelude::*;

use crate::{GlobalConfig, PtStakingError};

#[derive(Accounts)]
pub struct InitiateUpdateGlobalConfigOwner<'info> {
    #[account(
        mut,
        seeds = [b"global-config"],
        bump,
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(mut, address = global_config.owner @ PtStakingError::InvalidOwner)]
    pub owner: Signer<'info>,
}

impl InitiateUpdateGlobalConfigOwner<'_> {
    pub fn handler(ctx: Context<InitiateUpdateGlobalConfigOwner>, new_owner: Pubkey) -> Result<()> {
        let global_config = &mut ctx.accounts.global_config;

        // Validate new owner
        if new_owner == Pubkey::default() {
            return err!(PtStakingError::InvalidParam); // Ensure new owner is not the default public key
        }

        // Ensure the current owner is the one initiating the update
        if ctx.accounts.owner.key() != global_config.owner {
            return err!(PtStakingError::InvalidOwner); // Ensure the caller is the current owner
        }

        // Check if the pending owner is already set
        if global_config.pending_owner != Pubkey::default() {
            return err!(PtStakingError::AlreadyInitialized); // Ensure the pending owner is not already set
        }

        global_config.pending_owner = new_owner;

        Ok(())
    }
}
