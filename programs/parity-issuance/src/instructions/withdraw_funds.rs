use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked},
};

use crate::{ParityIssuanceError, TokenManager};

#[derive(Accounts)]
pub struct WithdrawFunds<'info> {
    #[account(mut, seeds = [b"token-manager"], bump)]
    pub token_manager: Account<'info, TokenManager>,
    #[account(mut, seeds = [b"mint"], bump)]
    pub mint: Account<'info, Mint>,
    //  Quote Mint
    #[account(
        address = token_manager.quote_mint @ ParityIssuanceError::InvalidQuoteMintAddress
    )]
    pub quote_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = quote_mint,
        associated_token::authority = admin,
    )]
    pub authority_quote_mint_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = quote_mint,
        associated_token::authority = token_manager,
    )]
    pub vault: Account<'info, TokenAccount>,

    // Other
    #[account(mut, address = token_manager.admin @ ParityIssuanceError::InvalidAdmin)]
    pub admin: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<WithdrawFunds>) -> Result<()> {
    let token_manager = &mut ctx.accounts.token_manager;
    let mint = &ctx.accounts.mint;
    let pending_withdrawal_amount = token_manager.pending_withdrawal_amount;

    // Checks
    if token_manager.pending_withdrawal_amount == 0 {
        return err!(ParityIssuanceError::NoPendingWithdrawal);
    }

    let timestamp = Clock::get()?.unix_timestamp;

    if timestamp
        < token_manager
            .withdrawal_initiation_time
            .checked_add(token_manager.withdraw_time_lock)
            .ok_or(ParityIssuanceError::CalculationOverflow)?
    {
        return err!(ParityIssuanceError::WithdrawalNotReady);
    }

    if timestamp
        > token_manager
            .withdrawal_initiation_time
            .checked_add(token_manager.withdraw_time_lock)
            .ok_or(ParityIssuanceError::CalculationOverflow)?
            .checked_add(token_manager.withdraw_execution_window)
            .ok_or(ParityIssuanceError::CalculationOverflow)?
    {
        return err!(ParityIssuanceError::WithdrawalExpired);
    }

    let mut withdraw_amount = pending_withdrawal_amount;

    // Calculate max withdrawable amount
    let max_withdrawable_amount = token_manager.calculate_max_withdrawable_amount(mint.supply)?;

    if pending_withdrawal_amount > max_withdrawable_amount {
        msg!("Pending withdrawal amount: {}", pending_withdrawal_amount);
        msg!("Max withdrawable amount: {}", max_withdrawable_amount);
        withdraw_amount = max_withdrawable_amount;
    }

    // Withdraw
    let bump = token_manager.bump; // Corrected to be a slice of a slice of a byte slice
    let signer_seeds: &[&[&[u8]]] = &[&[b"token-manager", &[bump]]];

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.authority_quote_mint_ata.to_account_info(),
                mint: ctx.accounts.quote_mint.to_account_info(),
                authority: token_manager.to_account_info(),
            },
            signer_seeds,
        ),
        withdraw_amount,
        ctx.accounts.quote_mint.decimals,
    )?;

    // Update token_manager
    token_manager.total_collateral = token_manager
        .total_collateral
        .checked_sub(withdraw_amount)
        .ok_or(ParityIssuanceError::CalculationOverflow)?;

    token_manager.pending_withdrawal_amount = 0;
    token_manager.withdrawal_initiation_time = 0;

    Ok(())
}
