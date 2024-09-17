use crate::{Gatekeeper, ParityIssuanceError, TokenManager};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(new_gatekeeper: Pubkey)]
pub struct AddGatekeeper<'info> {
    #[account(mut, seeds = [b"token-manager"], bump)]
    pub token_manager: Account<'info, TokenManager>,
    #[account(
        init,
        payer = admin,
        space = 8 + 32,
        seeds = [b"gatekeeper", new_gatekeeper.key().as_ref()],
        bump
    )]
    pub gatekeeper: Account<'info, Gatekeeper>,
    #[account(mut, address = token_manager.admin @ ParityIssuanceError::InvalidAdmin)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<AddGatekeeper>, new_gatekeeper: Pubkey) -> Result<()> {
    let gatekeeper = &mut ctx.accounts.gatekeeper;
    gatekeeper.wallet = new_gatekeeper;
    Ok(())
}
