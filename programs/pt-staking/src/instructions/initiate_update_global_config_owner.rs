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

        global_config.pending_owner = new_owner;

        Ok(())
    }
}
