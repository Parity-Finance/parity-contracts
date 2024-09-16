use crate::{
    BaseYieldPhase, ExchangeRatePhase, GlobalConfig, PointsEarnedPhase, PtStakingError, INITIAL_GLOBAL_CONFIG_SIZE
};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

use parity_staking::PoolManager;

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct InitializeGlobalConfigParams {
    pub admin: Pubkey,
    pub baseline_yield_bps: u64,
    pub deposit_cap: u64,
    pub initial_exchange_rate: u64,
}

#[derive(Accounts)]
pub struct InitializeGlobalConfig<'info> {
    /// SPL Token Mint of the underlying token to be deposited for staking
    #[account(address = pool_manager.base_mint @ PtStakingError::InvalidMintAddress)]
    pub base_mint: Account<'info, Mint>,
    #[account(mut)]
    pub pool_manager: Account<'info, PoolManager>,
    #[account(
        init,
        seeds = [b"global-config"],
        bump,
        payer = user,
        space = INITIAL_GLOBAL_CONFIG_SIZE,
    )]
    pub global_config: Box<Account<'info, GlobalConfig>>,
    #[account(
        init,
        payer = user,
        associated_token::mint = base_mint,
        associated_token::authority = global_config,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl InitializeGlobalConfig<'_> {
    pub fn handler(
        ctx: Context<InitializeGlobalConfig>,
        params: InitializeGlobalConfigParams,
    ) -> Result<()> {
        let global_config = &mut ctx.accounts.global_config;
        let bump = ctx.bumps.global_config;

        // Authorities
        global_config.owner = ctx.accounts.user.key();
        global_config.admin = params.admin;
        global_config.bump = bump;

        //Token
        global_config.base_mint = ctx.accounts.base_mint.key();
        global_config.base_mint_decimals = ctx.accounts.base_mint.decimals;
        global_config.staking_vault = ctx.accounts.vault.key();

        //Other
        global_config.staked_supply = 0;
        global_config.deposit_cap = params.deposit_cap;

        // Histories
        // Initialize the exchange rate history with the initial exchange rate
        let initial_phase = ExchangeRatePhase {
            exchange_rate: params.initial_exchange_rate,
            start_date: Clock::get()?.unix_timestamp, // Current timestamp
            end_date: None,
            index: 0,
        };
        global_config.exchange_rate_history = vec![initial_phase];

        // Initialize the base yield history with the initial base yield rate
        let initial_base_yield_phase = BaseYieldPhase {
            base_yield_bps: params.baseline_yield_bps,
            start_date: Clock::get()?.unix_timestamp,
            end_date: None,
            index: 0,
        };
        global_config.base_yield_history = vec![initial_base_yield_phase];

        // Initialize the points history with the initial points earned
        let initial_points_earned_phase = PointsEarnedPhase {
            exchange_rate: params.initial_exchange_rate,
            points: 0,
            index: 0,
        };
        global_config.points_history = vec![initial_points_earned_phase];

        Ok(())
    }
}
