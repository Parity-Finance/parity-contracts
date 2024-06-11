use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};

use crate::{SoldIssuanceError, TokenManager};

#[derive(Accounts)]
pub struct MintAdminTokens<'info> {
    #[account(mut, seeds = [b"token-manager"], bump)]
    pub token_manager: Account<'info, TokenManager>,
    #[account(
        mut,
        seeds = [b"mint"],
        bump,
        mint::authority = token_manager,
        mint::decimals = token_manager.mint_decimals,
        address = token_manager.mint,
    )]
    // Stable Mint
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = admin,
    )]
    pub admin_mint_ata: Account<'info, TokenAccount>,
    // Other
    #[account(address = token_manager.minter @ SoldIssuanceError::InvalidAdminAddress)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<MintAdminTokens>, quantity: u64) -> Result<()> {
    let token_manager = &mut ctx.accounts.token_manager;
    let _admin = &ctx.accounts.admin;

    // Minting
    let bump = token_manager.bump; // Corrected to be a slice of a slice of a byte slice
    let signer_seeds: &[&[&[u8]]] = &[&[b"token-manager", &[bump]]];

    let mint_amount = quantity;

    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                authority: token_manager.to_account_info(),
                to: ctx.accounts.admin_mint_ata.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
            },
            signer_seeds,
        ),
        mint_amount,
    )?;

    // Update token_manager
    token_manager.total_supply = token_manager
        .total_supply
        .checked_add(mint_amount)
        .ok_or(SoldIssuanceError::CalculationOverflow)?;

    Ok(())
}
