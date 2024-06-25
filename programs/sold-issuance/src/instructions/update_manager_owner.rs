use anchor_lang::prelude::*;

use crate::{SoldIssuanceError, TokenManager};

#[derive(Accounts)]
pub struct UpdateManagerOwner<'info> {
    #[account(
        mut,
        seeds = [b"token-manager"],
        bump = token_manager.bump
    )]
    pub token_manager: Account<'info, TokenManager>,
    #[account(address = token_manager.pending_owner @ SoldIssuanceError::InvalidOwner)]
    pub new_owner: Signer<'info>,
}

pub fn handler(ctx: Context<UpdateManagerOwner>) -> Result<()> {
    let token_manager = &mut ctx.accounts.token_manager;

    token_manager.owner = token_manager.pending_owner;
    token_manager.pending_owner = Pubkey::default();

    Ok(())
}
