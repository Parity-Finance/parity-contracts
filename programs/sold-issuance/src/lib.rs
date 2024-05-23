pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("3ja6s1Pb55nhzhwYp4GY77n972iEQtWX55xoRwP2asCT");

#[program]
pub mod sold_issuance {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
        initialize::handler(ctx, params)
    }

    pub fn mint(ctx: Context<MintTokens>, quantity: u64) -> Result<()> {
        mint::handler(ctx, quantity)
    }
}
