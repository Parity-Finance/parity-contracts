use crate::{Gatekeeper, ParityIssuanceError, TokenManager};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct RemoveGatekeeper<'info> {
    #[account(
        mut,
        seeds = [b"token-manager"],
        bump = token_manager.bump
    )]
    pub token_manager: Account<'info, TokenManager>,
    #[account(
        mut,
        close = admin,
        seeds = [b"gatekeeper", gatekeeper.wallet.as_ref()],
        bump
    )]
    pub gatekeeper: Account<'info, Gatekeeper>,
    #[account(address = token_manager.admin @ ParityIssuanceError::InvalidAdmin)]
    pub admin: Signer<'info>,
}
