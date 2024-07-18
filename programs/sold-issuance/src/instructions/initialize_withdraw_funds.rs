use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::{SoldIssuanceError, TokenManager};

#[derive(Accounts)]
pub struct InitializeWithdrawFunds<'info> {
    #[account(mut, seeds = [b"token-manager"], bump)]
    pub token_manager: Account<'info, TokenManager>,
    #[account(
        mint::authority = token_manager,
        mint::decimals = token_manager.mint_decimals,
        address = token_manager.mint,
    )]
    pub mint: Account<'info, Mint>,
    // Other
    #[account(mut, address = token_manager.admin @ SoldIssuanceError::InvalidAdmin)]
    pub admin: Signer<'info>,
}

pub fn handler(ctx: Context<InitializeWithdrawFunds>, quantity: u64) -> Result<()> {
    let token_manager = &mut ctx.accounts.token_manager;
    let mint = &mut ctx.accounts.mint;

    let quote_amount = quantity;

    if quote_amount > token_manager.total_collateral {
        return err!(SoldIssuanceError::ExcessiveWithdrawal);
    }

    let max_withdrawable_amount = token_manager.calculate_max_withdrawable_amount(mint.supply)?;
    msg!("Max withdrawable amount: {}", max_withdrawable_amount);
    msg!("Quote amount: {}", quote_amount);
    msg!("Mint supply: {}", mint.supply);

    if quote_amount > max_withdrawable_amount {
        return err!(SoldIssuanceError::ExcessiveWithdrawal);
    }

    // Update token_manager
    token_manager.pending_withdrawal_amount = quote_amount;
    token_manager.withdrawal_initiation_time = Clock::get()?.unix_timestamp;

    Ok(())
}
