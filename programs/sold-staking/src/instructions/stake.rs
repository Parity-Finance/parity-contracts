use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{mint_to, transfer_checked, Mint, MintTo, Token, TokenAccount, TransferChecked},
};

use crate::{error::SoldStakingError, PoolManager};

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut, seeds = [b"pool-manager"], bump)]
    pub pool_manager: Account<'info, PoolManager>,
    #[account(
        mut,
        mint::decimals = pool_manager.base_mint_decimals,
        address = pool_manager.base_mint,
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
        address = pool_manager.x_mint,
        seeds = [b"mint"],
        bump,
        mint::decimals = pool_manager.x_mint_decimals,
        mint::authority = pool_manager,
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
        associated_token::authority = pool_manager,
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
    let pool_manager = &mut ctx.accounts.pool_manager;

    let current_timestamp: i64 = Clock::get()?.unix_timestamp;
    let total_vault_amount = ctx.accounts.vault.amount;

    // Check if deposit exceeds the deposit cap or limit
    pool_manager.check_excessive_deposit(quantity, total_vault_amount)?;
    

    let x_amount = pool_manager.calculate_output_amount(quantity, current_timestamp, true)?;
    msg!("X amount: {}", x_amount);

    // Minting
    let bump = pool_manager.bump; // Corrected to be a slice of a slice of a byte slice
    let signer_seeds: &[&[&[u8]]] = &[&[b"pool-manager", &[bump]]];

    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                authority: pool_manager.to_account_info(),
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
        pool_manager.base_mint_decimals,
    )?;

    // Update token_manager
    pool_manager.base_balance = pool_manager
        .base_balance
        .checked_add(base_amount)
        .ok_or(SoldStakingError::CalculationOverflow)?;

    Ok(())
}
