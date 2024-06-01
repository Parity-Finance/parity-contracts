use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{mint_to, transfer_checked, Mint, MintTo, Token, TokenAccount, TransferChecked},
};

use crate::{error::SoldStakingError, StakePool};

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut, seeds = [b"stake-pool"], bump)]
    pub stake_pool: Account<'info, StakePool>,
    #[account(
        mut,
        mint::decimals = stake_pool.base_mint_decimals,
        address = stake_pool.base_mint,
    )]
    // Stable Mint
    pub base_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = base_mint,
        associated_token::authority = payer,
    )]
    pub payer_base_mint_ata: Account<'info, TokenAccount>,

    //  Quote Mint
    #[account(
        mut,
        address = stake_pool.x_mint,
        seeds = [b"mint"],
        bump,
        mint::decimals = stake_pool.x_mint_decimals,
        mint::authority = stake_pool,
    )]
    pub x_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = x_mint,
        associated_token::authority = payer,
    )]
    pub payer_x_mint_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = base_mint,
        associated_token::authority = stake_pool,
    )]
    pub vault: Account<'info, TokenAccount>,

    // Other
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<Stake>, quantity: u64) -> Result<()> {
    let stake_pool = &mut ctx.accounts.stake_pool;

    let current_timestamp = Clock::get()?.unix_timestamp;
    let exchange_rate = stake_pool
        .calculate_exchange_rate(current_timestamp)
        .ok_or(SoldStakingError::CalculationOverflow)?;

    msg!("Exchange Rate: {}", exchange_rate);

    let base_decimals = 10u64.pow(stake_pool.base_mint_decimals.into());
    let x_amount = (quantity as u128)
        .checked_mul(exchange_rate as u128)
        .ok_or(SoldStakingError::CalculationOverflow)?
        .checked_div(base_decimals as u128)
        .ok_or(SoldStakingError::CalculationOverflow)? as u64;

    msg!("X amount: {}", x_amount);

    // Minting
    let bump = stake_pool.bump; // Corrected to be a slice of a slice of a byte slice
    let signer_seeds: &[&[&[u8]]] = &[&[b"stake-pool", &[bump]]];

    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                authority: stake_pool.to_account_info(),
                to: ctx.accounts.payer_x_mint_ata.to_account_info(),
                mint: ctx.accounts.x_mint.to_account_info(),
            },
            signer_seeds,
        ),
        x_amount,
    )?;

    let base_amount = quantity;

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.payer_base_mint_ata.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.base_mint.to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
            },
        ),
        base_amount,
        stake_pool.base_mint_decimals,
    )?;

    // Update token_manager
    stake_pool.base_balance += base_amount;
    stake_pool.x_supply += x_amount;

    Ok(())
}
