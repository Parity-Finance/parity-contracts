use anchor_lang::prelude::*;

use crate::{SoldIssuanceError, TokenManager};

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct UpdateTokenManagerAdminParams {
    pub new_merkle_root: Option<[u8; 32]>,
    pub new_limit_per_slot: Option<u64>,
}

#[derive(Accounts)]
pub struct UpdateTokenManagerAdmin<'info> {
    #[account(
        mut,
        seeds = [b"token-manager"],
        bump = token_manager.bump
    )]
    pub token_manager: Account<'info, TokenManager>,
    #[account(address = token_manager.owner @ SoldIssuanceError::InvalidAdmin)]
    pub admin: Signer<'info>,
}

pub fn handler(
    ctx: Context<UpdateTokenManagerAdmin>,
    params: UpdateTokenManagerAdminParams,
) -> Result<()> {
    let token_manager = &mut ctx.accounts.token_manager;

    if let Some(new_merkle_root) = params.new_merkle_root {
        token_manager.merkle_root = new_merkle_root;
    }
    if let Some(new_limit_per_slot) = params.new_limit_per_slot {
        token_manager.limit_per_slot = new_limit_per_slot;
    }
    Ok(())
}
