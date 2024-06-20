use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{burn, transfer_checked, Burn, Mint, Token, TokenAccount, TransferChecked},
};

use crate::{verify_merkle_proof, SoldIssuanceError, TokenManager};

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
    let empty_merkle_root = [0u8; 32];
    let merkle_root = &token_manager.merkle_root;

    if merkle_root == &empty_merkle_root {
        // If the Merkle root is from an empty array, allow all
    } else {
        // Allow List Check
        let leaf = solana_program::keccak::hashv(&[payer.key().to_string().as_bytes()]);
        // Proceed with normal verification
        if !verify_merkle_proof(proof, merkle_root, &leaf.0) {
            return err!(SoldIssuanceError::AddressNotFoundInAllowedList);
        }
    }

    // Block Limit check
    let current_slot = Clock::get()?.slot;
    if token_manager.current_slot == current_slot {
        if token_manager.current_slot_redemption_volume + quantity
            > token_manager.redemption_limit_per_slot
        {
            return err!(SoldIssuanceError::SlotLimitExceeded);
        }
    } else {
        token_manager.current_slot = current_slot;
        token_manager.current_slot_redemption_volume = 0;
    }

    // Burning
    let bump = token_manager.bump; // Corrected to be a slice of a slice of a byte slice
    let signer_seeds: &[&[&[u8]]] = &[&[b"token-manager", &[bump]]];

    let mint_amount = quantity;

    burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                authority: ctx.accounts.payer.to_account_info(),
                from: ctx.accounts.payer_mint_ata.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
            },
        ),
        mint_amount,
    )?;

    let mint_decimals = token_manager.mint_decimals as i32;
    let quote_mint_decimals = token_manager.quote_mint_decimals as i32;
    let decimal_difference = (mint_decimals - quote_mint_decimals).abs() as u32;

    let normalized_quantity = if mint_decimals > quote_mint_decimals {
        quantity
            .checked_div(10u64.pow(decimal_difference))
            .ok_or(SoldIssuanceError::CalculationOverflow)?
    } else if mint_decimals < quote_mint_decimals {
        quantity
            .checked_mul(10u64.pow(decimal_difference))
            .ok_or(SoldIssuanceError::CalculationOverflow)?
    } else {
        quantity
    };

    let quote_amount = normalized_quantity
        .checked_div(10u64.pow(token_manager.mint_decimals.into()))
        .ok_or(SoldIssuanceError::CalculationOverflow)?
        .checked_mul(token_manager.exchange_rate)
        .ok_or(SoldIssuanceError::CalculationOverflow)?;

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
    token_manager.total_supply = token_manager
        .total_supply
        .checked_sub(mint_amount)
        .ok_or(SoldIssuanceError::CalculationOverflow)?;
    token_manager.total_collateral = token_manager
        .total_collateral
        .checked_sub(quote_amount)
        .ok_or(SoldIssuanceError::CalculationOverflow)?;
    token_manager.current_slot_redemption_volume = token_manager
        .current_slot_redemption_volume
        .checked_add(mint_amount)
        .ok_or(SoldIssuanceError::CalculationOverflow)?;

    Ok(())
}
