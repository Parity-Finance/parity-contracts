pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use error::*;
pub use instructions::*;
pub use state::*;

declare_id!("77xdxhr4M3Y4tizBUp3yNpw9NfqpfxDaHxVdS4DqrDf2");

#[program]
pub mod sold_issuance {
    use super::*;

    pub fn initialize_token_manager(
        ctx: Context<InitializeTokenManager>,
        params: InitializeTokenManagerParams,
    ) -> Result<()> {
        initialize_token_manager::handler(ctx, params)
    }

    pub fn mint(ctx: Context<MintTokens>, quantity: u64, proof: Vec<[u8; 32]>) -> Result<()> {
        mint::handler(ctx, quantity, proof)
    }

    pub fn redeem(ctx: Context<RedeemTokens>, quantity: u64, proof: Vec<[u8; 32]>) -> Result<()> {
        redeem::handler(ctx, quantity, proof)
    }

    pub fn toggle_active(ctx: Context<ToggleActive>, active: bool) -> Result<()> {
        toggle_active::handler(ctx, active)
    }

    pub fn update_token_manager_admin(
        ctx: Context<UpdateTokenManagerAdmin>,
        params: UpdateTokenManagerAdminParams,
    ) -> Result<()> {
        update_token_manager_admin::handler(ctx, params)
    }

    pub fn update_token_manager_owner(
        ctx: Context<UpdateTokenManagerOwner>,
        params: UpdateTokenManagerOwnerParams,
    ) -> Result<()> {
        update_token_manager_owner::handler(ctx, params)
    }

    pub fn withdraw_funds(ctx: Context<WithdrawFunds>, quantity: u64) -> Result<()> {
        withdraw_funds::handler(ctx, quantity)
    }

    pub fn deposit_funds(ctx: Context<DepositFunds>, quantity: u64) -> Result<()> {
        deposit_funds::handler(ctx, quantity)
    }

    pub fn mint_admin(ctx: Context<MintAdminTokens>, quantity: u64) -> Result<()> {
        mint_admin::handler(ctx, quantity)
    }
}
