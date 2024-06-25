use anchor_lang::prelude::*;

use crate::{SoldIssuanceError, TokenManager};

#[derive(Accounts)]
pub struct InitiateUpdateManagerOwner<'info> {
    #[account(
        mut,
        seeds = [b"token-manager"],
        bump = token_manager.bump
    )]
    pub token_manager: Account<'info, TokenManager>,
    #[account(address = token_manager.owner @ SoldIssuanceError::InvalidOwner)]
    pub owner: Signer<'info>,
}

pub fn handler(ctx: Context<InitiateUpdateManagerOwner>, new_owner: Pubkey) -> Result<()> {
    let token_manager = &mut ctx.accounts.token_manager;

    token_manager.pending_owner = new_owner;

    Ok(())
}
