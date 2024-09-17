use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked},
};

use crate::{ParityIssuanceError, TokenManager};

#[derive(Accounts)]
pub struct DepositFunds<'info> {
    #[account(mut, seeds = [b"token-manager"], bump)]
    pub token_manager: Account<'info, TokenManager>,
    #[account(
        mint::authority = token_manager,
        mint::decimals = token_manager.mint_decimals,
        address = token_manager.mint,
    )]
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

pub fn handler(ctx: Context<DepositFunds>, quantity: u64) -> Result<()> {
    let token_manager = &mut ctx.accounts.token_manager;
    let quote_mint = &ctx.accounts.quote_mint;
    let mint = &ctx.accounts.mint;

    let quote_amount = quantity;

    // Check if the quantity to deposit is greater than zero
    if quote_amount == 0 {
        return err!(ParityIssuanceError::InvalidQuantity);
    }

    // Check if deposit exceeds 100% collateral
    token_manager.check_excessive_deposit(quote_amount, mint.supply)?;

    // Deposit
    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.authority_quote_mint_ata.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                mint: quote_mint.to_account_info(),
                authority: ctx.accounts.admin.to_account_info(),
            },
        ),
        quote_amount,
        ctx.accounts.quote_mint.decimals,
    )?;

    // Update token_manager
    token_manager.total_collateral = token_manager
        .total_collateral
        .checked_add(quote_amount)
        .ok_or(ParityIssuanceError::CalculationOverflow)?;
    Ok(())
}
