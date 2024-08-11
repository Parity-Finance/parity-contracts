use anchor_lang::prelude::*;

use crate::{GlobalConfig, GLOBAL_CONFIG_LENGTH};

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
 pub struct InitializeGlobalConfigParams {
    pub admin: Pubkey,
    pub baseline_yield: u8,
    pub deposit_cap: u64,
}


#[derive(Accounts)]
pub struct InitializeGlobalConfig<'info> {
    /// SPL Token Mint of the underlying token to be deposited for staking
    pub base_mint: Account<'info, Mint>,
    #[account(
        init,
        seeds = [b"global-config"],
        bump,
        payer = owner,
        space = GLOBAL_CONFIG_LENGTH,
    )]
    pub global_config: Box<Account<'info, GlobalConfig>>,
    #[account(
        init,
        payer = owner,
        associated_token::mint = base_mint,
        associated_token::authority = global_config,
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
 }


 pub fn handler(
    ctx: Context<InitializeGlobalConfig>,
    params: InitializeGlobalConfigParams,
 ) -> Result<()> {
    let global_config = &mut ctx.accounts.global_config;
    let bump = ctx.bumps.global_config;

    // Authorities
    global_config.owner = ctx.accounts.owner.key();
    global_config.admin = params.admin;
    global_config.bump = bump;

    //Token
    global_config.base_mint = ctx.accounts.base_mint.key();
    global_config.base_mint_decimals = ctx.accounts.base_mint.decimals;
    global_config.staking_vault = ctx.accounts.vault.key();

    //Other 
    global_config.baseline_yield = params.baseline_yield;
    global_config.staked_supply = 0;
    global_config.total_points_issued = 0;
    global_config.deposit_cap = params.deposit_cap;
    global_config.exchange_rate_history = Vec::new();
    global_config.points_history = Vec::new();

    Ok(())
 }