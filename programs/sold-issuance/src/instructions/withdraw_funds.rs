use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked},
};

use crate::{SoldIssuanceError, TokenManager};

#[derive(Accounts)]
pub struct WithdrawFunds<'info> {
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
    #[account(mut, address = token_manager.admin @ SoldIssuanceError::InvalidAdmin)]
    pub admin: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<WithdrawFunds>, quantity: u64) -> Result<()> {
    let token_manager = &mut ctx.accounts.token_manager;

    // Check done in accounts struct
    // let _authority = &ctx.accounts.authority;

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
        quote_amount,
        ctx.accounts.quote_mint.decimals,
    )?;

    // Update token_manager
    token_manager.total_collateral = token_manager
        .total_collateral
        .checked_sub(quote_amount)
        .ok_or(SoldIssuanceError::CalculationOverflow)?;

    Ok(())
}
