use anchor_lang::prelude::*;
// use anchor_spl::{
//     associated_token::AssociatedToken,
//     token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked},
// };

use crate::{SoldIssuanceError, TokenManager};

#[derive(Accounts)]
pub struct InitializeWithdrawFunds<'info> {
    #[account(mut, seeds = [b"token-manager"], bump)]
    pub token_manager: Account<'info, TokenManager>,
    // Other
    #[account(mut, address = token_manager.admin @ SoldIssuanceError::InvalidAdmin)]
    pub admin: Signer<'info>,
}

pub fn handler(ctx: Context<InitializeWithdrawFunds>, quantity: u64) -> Result<()> {
    let token_manager = &mut ctx.accounts.token_manager;

    let quote_amount = quantity;

    if quote_amount > token_manager.total_collateral {
        return err!(SoldIssuanceError::ExcessiveWithdrawal);
    }

    // Check if withdrawal amount exceeds threshold of the total collateral
    let min_required_collateral = token_manager
        .total_supply
        .checked_div(10u64.pow(token_manager.mint_decimals.into()))
        .ok_or(SoldIssuanceError::CalculationOverflow)?
        .checked_mul(token_manager.exchange_rate)
        .ok_or(SoldIssuanceError::CalculationOverflow)?
        .checked_div(10u64.pow(token_manager.mint_decimals.into()))
        .ok_or(SoldIssuanceError::CalculationOverflow)?
        .checked_mul(token_manager.emergency_fund_basis_points as u64)
        .ok_or(SoldIssuanceError::CalculationOverflow)?
        .checked_div(10000)
        .ok_or(SoldIssuanceError::CalculationOverflow)?
        .checked_mul(10u64.pow(token_manager.quote_mint_decimals.into()))
        .ok_or(SoldIssuanceError::CalculationOverflow)?;

    let new_total_collateral = token_manager
        .total_collateral
        .checked_sub(quote_amount)
        .ok_or(SoldIssuanceError::CalculationOverflow)?;

    if new_total_collateral < min_required_collateral {
        return err!(SoldIssuanceError::ExcessiveWithdrawal);
    }

    // Update token_manager
    token_manager.pending_withdrawal_amount = quote_amount;
    token_manager.withdrawal_initiation_time = Clock::get()?.unix_timestamp;

    Ok(())
}
