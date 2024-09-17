use anchor_lang::prelude::*;

use crate::{ParityIssuanceError, TokenManager};

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
    #[account(address = token_manager.admin @ ParityIssuanceError::InvalidAdmin)]
    pub admin: Signer<'info>,
}

pub fn handler(
    ctx: Context<UpdateTokenManagerAdmin>,
    params: UpdateTokenManagerAdminParams,
) -> Result<()> {
    let token_manager = &mut ctx.accounts.token_manager;

    if let Some(new_merkle_root) = params.new_merkle_root {
        //  Ensure the new Merkle root is not all zeros
        if new_merkle_root.iter().all(|&byte| byte == 0) {
            return err!(ParityIssuanceError::InvalidParam);
        }
        token_manager.merkle_root = new_merkle_root;
    }

    if let Some(new_limit_per_slot) = params.new_limit_per_slot {
        // Ensure limit per slot is non-zero
        if new_limit_per_slot == 0 {
            return err!(ParityIssuanceError::InvalidParam);
        }
        // Example bounds check: Ensure the limit per slot is within a reasonable range
        if new_limit_per_slot > 1_000_000_000_000 {
            return err!(ParityIssuanceError::InvalidParam);
        }
        token_manager.limit_per_slot = new_limit_per_slot;
    }

    Ok(())
}
