use crate::{error::PtStakingError, GlobalConfig};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked},
};

#[derive(Accounts)]
pub struct WithdrawExcessPT<'info> {
    #[account(
        mut,
        seeds = [b"global-config"],
        bump
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(
        mut,
        mint::decimals = global_config.base_mint_decimals,
        address = global_config.base_mint,
    )]
    pub base_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = base_mint,
        associated_token::authority = admin,
    )]
    pub admin_base_mint_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = base_mint,
        associated_token::authority = global_config,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(address = global_config.admin @ PtStakingError::InvalidAdmin)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<WithdrawExcessPT>) -> Result<()> {
    let global_config = &ctx.accounts.global_config;
    let vault = &ctx.accounts.vault;

    //Signing
    let bump = global_config.bump; // Corrected to be a slice of a slice of a byte slice
    let signer_seeds: &[&[&[u8]]] = &[&[b"global-config", &[bump]]];

    // Calculate the excess tokens
    let vault_amount = vault.amount;
    let staked_supply = global_config.staked_supply;

    // Check if there is an excess
    if vault_amount > staked_supply {
        let excess_amount = (vault_amount as u128)
            .checked_sub(staked_supply as u128)
            .ok_or(PtStakingError::CalculationOverflow)?;

        // Transfer the excess tokens back to the admin
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.admin_base_mint_ata.to_account_info(),
                    mint: ctx.accounts.base_mint.to_account_info(),
                    authority: global_config.to_account_info(),
                },
                signer_seeds,
            ),
            excess_amount as u64,
            global_config.base_mint_decimals,
        )?;
    }
    Ok(())
}
