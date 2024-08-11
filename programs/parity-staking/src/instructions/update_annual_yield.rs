use crate::{error::ParityStakingError, PoolManager};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};
use parity_issuance::{
    cpi::{accounts::MintAdminTokens, mint_admin},
    program::ParityIssuance,
    TokenManager,
};

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct UpdateYieldParams {
    pub interval_apr_rate: u64,
}

#[derive(Accounts)]
pub struct UpdateAnnualYield<'info> {
    #[account(
        mut,
      seeds = [
        b"pool-manager",
      ],
      bump,
    )]
    pub pool_manager: Account<'info, PoolManager>,
    #[account(mut)]
    pub token_manager: Account<'info, TokenManager>,
    #[account(
        mut,
        mint::decimals = pool_manager.base_mint_decimals,
        address = pool_manager.base_mint,
    )]
    pub base_mint: Account<'info, Mint>,
    #[account(
        mint::authority = pool_manager,
        mint::decimals = pool_manager.x_mint_decimals,
        address = pool_manager.x_mint,
    )]
    pub x_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = base_mint,
        associated_token::authority = pool_manager,
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, address = pool_manager.admin @ ParityStakingError::InvalidAdmin)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub parity_issuance_program: Program<'info, ParityIssuance>,
}

pub fn handler(ctx: Context<UpdateAnnualYield>, params: UpdateYieldParams) -> Result<()> {
    // What check to make?
    // if params.interval_apr_rate > 20000 {
    //     return err!(ParityStakingError::InvalidYieldRate);
    // }

    let pool_manager = &mut ctx.accounts.pool_manager;
    let x_mint = &mut ctx.accounts.x_mint;

    let clock = Clock::get()?;
    let current_timestamp = clock.unix_timestamp;

    let exchange_rate = pool_manager
        .calculate_exchange_rate(current_timestamp)
        .ok_or(ParityStakingError::CalculationOverflow)?;

    msg!("Exchange Rate: {}", exchange_rate);

    // Mint Base into pool
    let bump = pool_manager.bump; // Corrected to be a slice of a slice of a byte slice
    let signer_seeds: &[&[&[u8]]] = &[&[b"pool-manager", &[bump]]];

    let amount_to_mint = pool_manager.calculate_amount_to_mint(x_mint.supply, current_timestamp)?;

    msg!("Amount to mint: {}", amount_to_mint);

    if amount_to_mint > 0 {
        let mint_context = CpiContext::new_with_signer(
            ctx.accounts.parity_issuance_program.to_account_info(),
            MintAdminTokens {
                token_manager: ctx.accounts.token_manager.to_account_info(),
                minter_mint_ata: ctx.accounts.vault.to_account_info(),
                minter: pool_manager.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
                associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
                mint: ctx.accounts.base_mint.to_account_info(),
            },
            signer_seeds,
        );

        mint_admin(mint_context, amount_to_mint)?;
    }

    pool_manager.base_balance = pool_manager
        .base_balance
        .checked_add(amount_to_mint)
        .ok_or(ParityStakingError::CalculationOverflow)?;
    pool_manager.last_yield_change_timestamp = current_timestamp;
    pool_manager.last_yield_change_exchange_rate = exchange_rate;
    pool_manager.interval_apr_rate = params.interval_apr_rate;

    Ok(())
}
