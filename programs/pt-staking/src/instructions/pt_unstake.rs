use crate::{GlobalConfig, PtStakingError, UserStake};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked},
};

#[derive(Accounts)]
pub struct PtUnstake<'info> {
    #[account(
        mut,
        seeds = [b"global-config"],
        bump
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(
        mut,
        seeds = [b"user-stake",user.key().as_ref()],
        bump,
        constraint = user_stake.user_pubkey == user.key() @ PtStakingError::InvalidOwner,
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

pub fn handler(ctx: Context<PtUnstake>, quantity: u64) -> Result<()> {
    let global_config = &mut ctx.accounts.global_config;
    let user_stake = &mut ctx.accounts.user_stake;
    let user_base_mint_ata = &ctx.accounts.user_base_mint_ata;
    let vault = &ctx.accounts.vault;

    //Signing
    let bump = global_config.bump; // Corrected to be a slice of a slice of a byte slice
    let signer_seeds: &[&[&[u8]]] = &[&[b"global-config", &[bump]]];

    // Check if the user has enough staked tokens to unstake
    if user_stake.staked_amount < quantity {
        return Err(PtStakingError::InsufficientStakedAmount.into());
    }

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: vault.to_account_info(),
                to: user_base_mint_ata.to_account_info(),
                mint: ctx.accounts.base_mint.to_account_info(),
                authority: global_config.to_account_info(),
            },
            signer_seeds,
        ),
        quantity,
        global_config.base_mint_decimals,
    )?;

    // Calculate points earned until now
    let current_timestamp = Clock::get()?.unix_timestamp;
    let points_earned_phases = global_config.calculate_points(
        user_stake.staked_amount,
        user_stake.last_claim_timestamp,
        current_timestamp,
    )?;
    // Update user's points history
    user_stake.update_points_history(points_earned_phases.clone());

    // Update global points history
    global_config.update_global_points(points_earned_phases);

    // Update the global staked supply
    global_config.staked_supply = global_config
        .staked_supply
        .checked_sub(quantity)
        .ok_or(PtStakingError::CalculationOverflow)?;

    // Update user's staked amount
    user_stake.staked_amount = user_stake
        .staked_amount
        .checked_sub(quantity)
        .ok_or(PtStakingError::CalculationOverflow)?;

    // Update the staking timestamp to the current time
    user_stake.last_claim_timestamp = current_timestamp;

    // If all tokens are unstaked, reset the initial_staking_timestamp
    if user_stake.staked_amount == 0 {
        user_stake.initial_staking_timestamp = 0;
    } else {
        user_stake.initial_staking_timestamp = current_timestamp;
    }

    Ok(())
}
