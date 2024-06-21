use crate::{SoldIssuanceError, TokenManager};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CloseTokenManager<'info> {
    #[account(
        mut,
        close = owner,
        seeds = [b"token-manager"],
        bump = token_manager.bump
    )]
    pub token_manager: Account<'info, TokenManager>,
    #[account(mut, address = token_manager.owner @ SoldIssuanceError::InvalidOwner)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CloseTokenManager>) -> Result<()> {
    msg!("Closing token manager account");
    Ok(())
}
