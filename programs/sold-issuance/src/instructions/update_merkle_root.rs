use anchor_lang::prelude::*;

use crate::TokenManager;

#[derive(Accounts)]
pub struct UpdateMerkleRoot<'info> {
    #[account(
        mut,
        seeds = [b"token-manager"],
        bump = token_manager.bump
    )]
    pub token_manager: Account<'info, TokenManager>,
    pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<UpdateMerkleRoot>, merkle_root: [u8; 32]) -> Result<()> {
    let token_manager = &mut ctx.accounts.token_manager;

    // TODO: Authority Check
    let authority = &ctx.accounts.authority;

    token_manager.merkle_root = merkle_root;
    Ok(())
}
