use crate::{SoldIssuanceError, TokenManager};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ToggleActive<'info> {
    #[account(
        mut,
        seeds = [b"token-manager"],
        bump = token_manager.bump
    )]
    pub token_manager: Account<'info, TokenManager>,
    pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<ToggleActive>, active: bool) -> Result<()> {
    let token_manager = &mut ctx.accounts.token_manager;

    if token_manager.active == active {
        return err!(SoldIssuanceError::TokenManagerStatusUnchanged);
    }

    let authority = &ctx.accounts.authority;

    if active {
        // If activating, authority must be the admin
        require_keys_eq!(
            token_manager.admin,
            authority.key(),
            SoldIssuanceError::InvalidToggleActiveAuthority
        );
    } else {
        // If deactivating, authority can be either the admin or a gatekeeper
        let is_admin = token_manager.admin == authority.key();
        let is_gate_keeper = token_manager
            .gate_keepers
            .iter()
            .any(|&k| k == authority.key());
        require!(
            is_admin || is_gate_keeper,
            SoldIssuanceError::InvalidToggleActiveAuthority
        );
    }

    token_manager.active = active;
    Ok(())
}
