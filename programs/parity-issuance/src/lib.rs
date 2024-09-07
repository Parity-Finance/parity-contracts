pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use error::*;
pub use instructions::*;
pub use state::*;

declare_id!("7hkMsfmcxQmJERtzpGTGUn9jmREBZkxYRF2rZ9BRWkZU");

#[program]
pub mod parity_issuance {
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

    pub fn initialize_withdraw_funds(
        ctx: Context<InitializeWithdrawFunds>,
        quantity: u64,
    ) -> Result<()> {
        initialize_withdraw_funds::handler(ctx, quantity)
    }

    pub fn withdraw_funds(ctx: Context<WithdrawFunds>) -> Result<()> {
        withdraw_funds::handler(ctx)
    }

    pub fn deposit_funds(ctx: Context<DepositFunds>, quantity: u64) -> Result<()> {
        deposit_funds::handler(ctx, quantity)
    }

    pub fn mint_admin(ctx: Context<MintAdminTokens>, quantity: u64) -> Result<()> {
        mint_admin::handler(ctx, quantity)
    }

    pub fn update_mint_metadata(
        ctx: Context<UpdateMintMetadata>,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        update_mint_metadata::handler(ctx, name, symbol, uri)
    }

    pub fn update_manager_owner(ctx: Context<UpdateManagerOwner>) -> Result<()> {
        update_manager_owner::handler(ctx)
    }

    pub fn initiate_update_manager_owner(
        ctx: Context<InitiateUpdateManagerOwner>,
        new_owner: Pubkey,
    ) -> Result<()> {
        initiate_update_manager_owner::handler(ctx, new_owner)
    }

    pub fn add_gatekeeper(ctx: Context<AddGatekeeper>, new_gatekeeper: Pubkey) -> Result<()> {
        add_gatekeeper::handler(ctx, new_gatekeeper)
    }

    pub fn remove_gatekeeper(_ctx: Context<RemoveGatekeeper>) -> Result<()> {
        Ok(())
    }
}
