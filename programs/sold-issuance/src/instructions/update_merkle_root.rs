use anchor_lang::prelude::*;

use crate::TokenManager;

#[derive(Accounts)]
pub struct UpdateMerkleRoot<'info> {
    #[account(mut)]
    pub token_manager: Account<'info, TokenManager>,
    pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<UpdateMerkleRoot>, merkle_root: [u8; 32]) -> Result<()> {
    let token_manager = &mut ctx.accounts.token_manager;
    // Here you might want to add some authorization logic to ensure that only
    // authorized users can update the Merkle root
    token_manager.merkle_root = merkle_root;
    Ok(())
}
