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
}

pub fn handler(ctx: Context<ToggleActive>, active: bool) -> Result<()> {
    let token_manager = &mut ctx.accounts.token_manager;

    if token_manager.active == active {
        return err!(SoldIssuanceError::TokenManagerStatusUnchanged);
    }

    token_manager.active = active;
    Ok(())
}
