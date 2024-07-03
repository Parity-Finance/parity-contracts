use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{burn, transfer_checked, Burn, Mint, Token, TokenAccount, TransferChecked},
};

use crate::{SoldIssuanceError, TokenManager};

#[derive(Accounts)]
pub struct RedeemTokens<'info> {
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
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = payer,
    )]
    pub payer_mint_ata: Account<'info, TokenAccount>,
    #[account(
        address = token_manager.quote_mint @ SoldIssuanceError::InvalidQuoteMintAddress
    )]
    pub quote_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = quote_mint,
        associated_token::authority = payer,
    )]
    pub payer_quote_mint_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = quote_mint,
        associated_token::authority = token_manager,
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<RedeemTokens>, quantity: u64, proof: Vec<[u8; 32]>) -> Result<()> {
    let token_manager = &mut ctx.accounts.token_manager;
    let payer = &ctx.accounts.payer;

    // Pause Check
    if !token_manager.active {
        return err!(SoldIssuanceError::MintAndRedemptionsPaused);
    }

    // Allow List Check
    let leaf: solana_program::keccak::Hash =
        solana_program::keccak::hashv(&[payer.key().to_string().as_bytes()]);
    token_manager.verify_merkle_proof(proof, &leaf.0)?;

    // Block Limit check
    let current_slot: u64 = Clock::get()?.slot;
    token_manager.check_block_limit(quantity, current_slot)?;

    // Burning
    let bump = token_manager.bump; // Corrected to be a slice of a slice of a byte slice
    let signer_seeds: &[&[&[u8]]] = &[&[b"token-manager", &[bump]]];

    let burn_amount = quantity;
    msg!("Burn amount: {}", burn_amount);

    burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                authority: ctx.accounts.payer.to_account_info(),
                from: ctx.accounts.payer_mint_ata.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
            },
        ),
        burn_amount,
    )?;

    ctx.accounts.mint.reload()?;

    let normalized_quantity = token_manager.calculate_normalized_quantity(quantity)?;
    msg!("Normalized quantity: {}", normalized_quantity);
    let quote_amount = token_manager.calculate_quote_amount(normalized_quantity)?;
    msg!("Quote amount: {}", quote_amount);

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.payer_quote_mint_ata.to_account_info(),
                mint: ctx.accounts.quote_mint.to_account_info(),
                authority: token_manager.to_account_info(),
            },
            signer_seeds,
        ),
        quote_amount,
        token_manager.quote_mint_decimals,
    )?;

    // Update token_manager
    token_manager.total_collateral = token_manager
        .total_collateral
        .checked_sub(quote_amount)
        .ok_or(SoldIssuanceError::CalculationOverflow)?;
    token_manager.current_slot_volume = token_manager
        .current_slot_volume
        .checked_add(burn_amount)
        .ok_or(SoldIssuanceError::CalculationOverflow)?;

    Ok(())
}
