use crate::TokenManager;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        mut,
        seeds = [b"token-manager"],
    )]
    pub token_manager: Account<'info, TokenManager>,
}

pub fn handler(ctx: Context<Initialize>, metadata: InitializeParams) -> Result<()> {
    let token_manager = &mut ctx.accounts.token_manager;

    token_manager.active = false;

    Ok(())
}
