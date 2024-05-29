use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked},
};

use crate::{SoldIssuanceError, TokenManager};

#[derive(Accounts)]
pub struct DepositFunds<'info> {
    #[account(mut, seeds = [b"token-manager"], bump)]
    pub token_manager: Account<'info, TokenManager>,
    //  Quote Mint
    #[account(
        address = token_manager.quote_mint @ SoldIssuanceError::InvalidQuoteMintAddress
    )]
    pub quote_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = quote_mint,
        associated_token::authority = authority,
    )]
    pub authority_quote_mint_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = quote_mint,
        associated_token::authority = token_manager,
    )]
    pub vault: Account<'info, TokenAccount>,

    // Other
    #[account(mut)]
    pub authority: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<DepositFunds>, quantity: u64) -> Result<()> {
    let token_manager = &mut ctx.accounts.token_manager;
    let quote_mint = &ctx.accounts.quote_mint;

    // TODO: Authority Check
    let authority = &ctx.accounts.authority;

    let quote_amount = quantity
        .checked_mul(10u64.pow(quote_mint.decimals.into()))
        .ok_or(SoldIssuanceError::CalculationOverflow)?;

    // Check if deposit exceeds 100% collateral
    let new_total_collateral = token_manager
        .total_collateral
        .checked_add(quote_amount)
        .ok_or(SoldIssuanceError::CalculationOverflow)?;
    let max_collateral = token_manager
        .total_supply
        .checked_div(10u64.pow(token_manager.mint_decimals.into()))
        .ok_or(SoldIssuanceError::CalculationOverflow)?
        .checked_mul(token_manager.exchange_rate)
        .ok_or(SoldIssuanceError::CalculationOverflow)?
        .checked_mul(10u64.pow(token_manager.quote_mint_decimals.into()))
        .ok_or(SoldIssuanceError::CalculationOverflow)?;

    if new_total_collateral > max_collateral {
        return err!(SoldIssuanceError::ExcessiveDeposit);
    }

    // Deposit
    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.authority_quote_mint_ata.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                mint: quote_mint.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        ),
        quote_amount,
        ctx.accounts.quote_mint.decimals,
    )?;

    // Update token_manager
    token_manager.total_collateral += quote_amount;

    Ok(())
}
