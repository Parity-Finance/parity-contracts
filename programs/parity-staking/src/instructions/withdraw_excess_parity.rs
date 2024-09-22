use crate::{error::ParityStakingError, PoolManager};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked},
};

#[derive(Accounts)]
pub struct WithdrawExcessParity<'info> {
    #[account(mut, seeds = [b"pool-manager"], bump)]
    pub pool_manager: Account<'info, PoolManager>,

    #[account(
        mut,
        associated_token::mint = base_mint,
        associated_token::authority = pool_manager,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        mint::decimals = pool_manager.base_mint_decimals,
        address = pool_manager.base_mint,
    )]
    pub base_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = base_mint,
        associated_token::authority = admin,
    )]
    pub admin_base_mint_ata: Account<'info, TokenAccount>,

    #[account(address = pool_manager.admin @ ParityStakingError::InvalidAdmin)]
    pub admin: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<WithdrawExcessParity>) -> Result<()> {
    let pool_manager = &mut ctx.accounts.pool_manager;
    let vault = &ctx.accounts.vault;

    //Signing
    let bump = pool_manager.bump; // Corrected to be a slice of a slice of a byte slice
    let signer_seeds: &[&[&[u8]]] = &[&[b"pool-manager", &[bump]]];

    // Calculate the excess tokens
    let vault_amount = vault.amount;
    let base_balance = pool_manager.base_balance;

    // Check if there is an excess
    if vault_amount > base_balance {
        let excess_amount = (vault_amount as u128)
            .checked_sub(base_balance as u128)
            .ok_or(ParityStakingError::CalculationOverflow)?;

        // Transfer the excess tokens back to the admin
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.admin_base_mint_ata.to_account_info(),
                    mint: ctx.accounts.base_mint.to_account_info(),
                    authority: pool_manager.to_account_info(),
                },
                signer_seeds,
            ),
            excess_amount as u64,
            pool_manager.base_mint_decimals,
        )?;
    }

    Ok(())
}
