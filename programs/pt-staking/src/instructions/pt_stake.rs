use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked},
};

use crate::{GlobalConfig, PtStakingError, UserStake};

#[derive(Accounts)]
pub struct PtStake<'info> {
    #[account(
        mut,
        seeds = [b"global-config"],
        bump
    )]
    pub global_config: Account<'info, GlobalConfig>,
    #[account(
        mut,
        seeds = [b"user-stake"],
        bump
    )]
    pub user_stake: Account<'info, UserStake>,

    #[account(
        mut,
        mint::decimals = global_config.base_mint_decimals,
        address = global_config.base_mint,
    )]
    pub base_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = base_mint,
        associated_token::authority = user,
    )]
    pub user_base_mint_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
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

pub fn handler(ctx: Context<PtStake>, quantity: u64) -> Result<()> {
    let global_config = &mut ctx.accounts.global_config;
    let user_stake = &mut ctx.accounts.user_stake;
    let user_base_mint_ata = &ctx.accounts.user_base_mint_ata;
    let vault = &ctx.accounts.vault;

    let current_timestamp: i64 = Clock::get()?.unix_timestamp;
    let total_vault_amount = ctx.accounts.vault.amount;

    // Check if deposit exceeds the deposit cap or limit
    global_config.check_excessive_deposit(quantity, total_vault_amount)?;

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: user_base_mint_ata.to_account_info(),
                to: vault.to_account_info(),
                mint: ctx.accounts.base_mint.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        quantity,
        global_config.base_mint_decimals,
    )?;

    if user_stake.staking_timestamp == 0 {
        // First time staking, set the initial staking timestamp, no points calculated.
        user_stake.staking_timestamp = current_timestamp;
    } else {
        // Calculate points earned since the last stake/unstake.
        let duration = current_timestamp - user_stake.staking_timestamp;
        let points_earned_phases =
            global_config.calculate_points(user_stake.staked_amount, duration)?;

        // Update user's points history
        user_stake.update_points_history(points_earned_phases.clone());

        // Update global points history
        global_config.update_global_points(points_earned_phases);

        // Update the staking timestamp to the current time.
        user_stake.staking_timestamp = current_timestamp;
    }

    // Update the global staked supply
    global_config.staked_supply = global_config
        .staked_supply
        .checked_add(quantity)
        .ok_or(PtStakingError::CalculationOverflow)?;

    //Update the user's staked amount.
    user_stake.staked_amount = user_stake
        .staked_amount
        .checked_add(quantity)
        .ok_or(PtStakingError::CalculationOverflow)?;

    Ok(())
}
