pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use error::*;
pub use instructions::*;
pub use state::*;

declare_id!("3ja6s1Pb55nhzhwYp4GY77n972iEQtWX55xoRwP2asCT");

#[program]
pub mod sold_issuance {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        metadata: InitializeParams,
        merkle_root: [u8; 32],
    ) -> Result<()> {
        initialize::handler(ctx, metadata, merkle_root)
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

    pub fn update_merkle_root(ctx: Context<UpdateMerkleRoot>, merkle_root: [u8; 32]) -> Result<()> {
        update_merkle_root::handler(ctx, merkle_root)
    }

    pub fn withdraw_funds(ctx: Context<WithdrawFunds>, quantity: u64) -> Result<()> {
        withdraw_funds::handler(ctx, quantity)
    }

    pub fn deposit_funds(ctx: Context<DepositFunds>, quantity: u64) -> Result<()> {
        deposit_funds::handler(ctx, quantity)
    }
}
