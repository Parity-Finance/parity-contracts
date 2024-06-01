use anchor_lang::prelude::*;

use crate::TokenManager;

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct UpdateParams {
    pub merkle_root: Option<[u8; 32]>,
    pub admin: Option<Pubkey>,
}

#[derive(Accounts)]
pub struct UpdateTokenManager<'info> {
    #[account(
        mut,
        seeds = [b"token-manager"],
        bump = token_manager.bump
    )]
    pub token_manager: Account<'info, TokenManager>,
    pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<UpdateTokenManager>, params: UpdateParams) -> Result<()> {
    let token_manager = &mut ctx.accounts.token_manager;

    // TODO: Authority Check
    let _authority = &ctx.accounts.authority;

    if let Some(merkle_root) = params.merkle_root {
        token_manager.merkle_root = merkle_root;
    }
    if let Some(admin) = params.admin {
        token_manager.admin = admin;
    }
    Ok(())
}
