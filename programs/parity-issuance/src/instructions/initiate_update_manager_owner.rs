use anchor_lang::prelude::*;

use crate::{ParityIssuanceError, TokenManager};

#[derive(Accounts)]
pub struct InitiateUpdateManagerOwner<'info> {
    #[account(
        mut,
        seeds = [b"token-manager"],
        bump = token_manager.bump
    )]
    pub token_manager: Account<'info, TokenManager>,
    #[account(address = token_manager.owner @ ParityIssuanceError::InvalidOwner)]
    pub owner: Signer<'info>,
}

pub fn handler(ctx: Context<InitiateUpdateManagerOwner>, new_owner: Pubkey) -> Result<()> {
    let token_manager = &mut ctx.accounts.token_manager;

    // Validate new owner
    if new_owner == Pubkey::default() {
        return err!(ParityIssuanceError::InvalidParam);
    }

    // Ensure the token manager is in a valid state for updates
    if !token_manager.active {
        return err!(ParityIssuanceError::MintAndRedemptionsPaused);
    }

    // Ensure the current owner is the one initiating the update
    if ctx.accounts.owner.key() != token_manager.owner {
        return err!(ParityIssuanceError::InvalidOwner);
    }

    token_manager.pending_owner = new_owner;

    Ok(())
}
