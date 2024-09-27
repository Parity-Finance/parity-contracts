use crate::{ParityIssuanceError, TokenManager, TOKEN_MANAGER_SIZE};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked},
};

#[derive(Accounts)]
pub struct WithdrawExcessIssuance<'info> {
    #[account(
        mut,
        seeds = [b"token-manager"],
        bump = token_manager.bump
    )]
    pub token_manager: Account<'info, TokenManager>,
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
    pub admin_quote_mint_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = quote_mint,
        associated_token::authority = token_manager,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(address = token_manager.admin @ ParityIssuanceError::InvalidAdmin)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<WithdrawExcessIssuance>) -> Result<()> {
    let token_manager = &ctx.accounts.token_manager;
    let vault = &ctx.accounts.vault;

    // Signing
    let bump = token_manager.bump; // Corrected to be a slice of a slice of a byte slice
    let signer_seeds: &[&[&[u8]]] = &[&[b"token-manager", &[bump]]];

     // Calculate the excess tokens
     let vault_amount = vault.amount;
     let total_collateral = token_manager.total_collateral;

      // Check if there is an excess
    if vault_amount > total_collateral { 
        let excess_amount = (vault_amount as u128)
        .checked_sub(total_collateral as u128)
        .ok_or(ParityIssuanceError::CalculationOverflow)?;

        // Transfer the excess tokens back to the admin
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.admin_quote_mint_ata.to_account_info(),
                    mint: ctx.accounts.quote_mint.to_account_info(),
                    authority: token_manager.to_account_info(),
                },
                signer_seeds,
            ),
            excess_amount as u64,
            token_manager.quote_mint_decimals,
        )?;
    }

    Ok(())
}
