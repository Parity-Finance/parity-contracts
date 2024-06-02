use crate::{error::SoldStakingError, StakePool};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};
use sold_issuance::{
    cpi::{accounts::MintAdminTokens, mint_admin},
    program::SoldIssuance,
    TokenManager,
};

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct UpdateYieldParams {
    pub annual_yield_rate: u64,
}

#[derive(Accounts)]
pub struct UpdateAnnualYield<'info> {
    #[account(
        mut,
      seeds = [
        b"stake-pool",
      ],
      bump,
    )]
    pub stake_pool: Account<'info, StakePool>,
    #[account(mut)]
    pub token_manager: Account<'info, TokenManager>,
    #[account(
        mut,
        mint::decimals = stake_pool.base_mint_decimals,
        address = stake_pool.base_mint,
    )]
    pub base_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = base_mint,
        associated_token::authority = stake_pool,
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub sold_issuance_program: Program<'info, SoldIssuance>,
}

pub fn handler(ctx: Context<UpdateAnnualYield>, params: UpdateYieldParams) -> Result<()> {
    let stake_pool = &mut ctx.accounts.stake_pool;

    // TODO: Authority Check
    let _authority = &ctx.accounts.authority;

    let clock = Clock::get()?;
    let current_timestamp = clock.unix_timestamp;

    let exchange_rate = stake_pool
        .calculate_exchange_rate(current_timestamp)
        .ok_or(SoldStakingError::CalculationOverflow)?;

    msg!("Exchange Rate: {}", exchange_rate);

    // Mint Base into pool
    let bump = stake_pool.bump; // Corrected to be a slice of a slice of a byte slice
    let signer_seeds: &[&[&[u8]]] = &[&[b"stake-pool", &[bump]]];

    let base_decimals = 10u64.pow(stake_pool.base_mint_decimals.into());

    let x_supply_value = (stake_pool.x_supply as u128)
        .checked_mul(base_decimals as u128)
        .ok_or(SoldStakingError::CalculationOverflow)?
        .checked_div(exchange_rate as u128)
        .ok_or(SoldStakingError::CalculationOverflow)?;

    let base_balance = stake_pool.base_balance as u128;

    msg!("X Supply Value: {}", x_supply_value);
    msg!("Base Balance: {}", base_balance);

    let amount_to_mint = if x_supply_value > base_balance {
        x_supply_value
            .checked_sub(base_balance)
            .ok_or(SoldStakingError::CalculationOverflow)? as u64
    } else {
        0
    };

    msg!("Amount to mint: {}", amount_to_mint);

    if amount_to_mint > 0 {
        let mint_context = CpiContext::new_with_signer(
            ctx.accounts.sold_issuance_program.to_account_info(),
            MintAdminTokens {
                token_manager: ctx.accounts.token_manager.to_account_info(),
                admin_mint_ata: ctx.accounts.vault.to_account_info(),
                admin: stake_pool.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
                associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
                mint: ctx.accounts.base_mint.to_account_info(),
            },
            signer_seeds,
        );

        mint_admin(mint_context, amount_to_mint)?;
    }

    stake_pool.base_balance += amount_to_mint;
    stake_pool.last_yield_change_timestamp = current_timestamp;
    stake_pool.last_yield_change_exchange_rate = exchange_rate;
    stake_pool.annual_yield_rate = params.annual_yield_rate;

    Ok(())
}
