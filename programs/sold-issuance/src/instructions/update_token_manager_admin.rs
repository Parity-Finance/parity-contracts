use anchor_lang::prelude::*;

use crate::TokenManager;

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct UpdateTokenManagerAdminParams {
    pub new_merkle_root: Option<[u8; 32]>,
    pub new_gate_keepers: Option<Vec<Pubkey>>,
    pub new_mint_limit_per_slot: Option<u64>,
    pub new_redemption_limit_per_slot: Option<u64>,
}

#[derive(Accounts)]
pub struct UpdateTokenManagerAdmin<'info> {
    #[account(
        mut,
        seeds = [b"token-manager"],
        bump = token_manager.bump
    )]
    pub token_manager: Account<'info, TokenManager>,
    pub authority: Signer<'info>,
}

pub fn handler(
    ctx: Context<UpdateTokenManagerAdmin>,
    params: UpdateTokenManagerAdminParams,
) -> Result<()> {
    let token_manager = &mut ctx.accounts.token_manager;

    // TODO: Authority Check
    let _authority = &ctx.accounts.authority;

    if let Some(new_merkle_root) = params.new_merkle_root {
        token_manager.merkle_root = new_merkle_root;
    }
    if let Some(new_gate_keepers) = params.new_gate_keepers {
        token_manager.gate_keepers = new_gate_keepers;
    }
    if let Some(new_mint_limit_per_slot) = params.new_mint_limit_per_slot {
        token_manager.mint_limit_per_slot = new_mint_limit_per_slot;
    }
    if let Some(new_redemption_limit_per_slot) = params.new_redemption_limit_per_slot {
        token_manager.redemption_limit_per_slot = new_redemption_limit_per_slot;
    }
    Ok(())
}
