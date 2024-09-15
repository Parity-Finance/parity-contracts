use crate::{error::ParityStakingError, PoolManager};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{burn, transfer_checked, Burn, Mint, Token, TokenAccount, TransferChecked},
};
use parity_issuance::{
    cpi::{accounts::MintAdminTokens, mint_admin},
    program::ParityIssuance,
};

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut, seeds = [b"pool-manager"], bump)]
    pub pool_manager: Account<'info, PoolManager>,
    /// CHECK: This account is checked in the mint_admin CPI call
    #[account(mut)]
    pub token_manager: UncheckedAccount<'info>,
    #[account(
        mut,
        mint::decimals = pool_manager.base_mint_decimals,
        address = pool_manager.base_mint,
    )]
    pub base_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = base_mint,
        associated_token::authority = payer,
    )]
    pub payer_base_mint_ata: Account<'info, TokenAccount>,

    //  Quote Mint
    #[account(
        mut,
        address = pool_manager.x_mint,
        seeds = [b"mint"],
        bump,
        mint::decimals = pool_manager.x_mint_decimals,
        mint::authority = pool_manager,
    )]
    pub x_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = x_mint,
        associated_token::authority = payer,
    )]
    pub payer_x_mint_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = base_mint,
        associated_token::authority = pool_manager,
    )]
    pub vault: Account<'info, TokenAccount>,

    // Other
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub parity_issuance_program: Program<'info, ParityIssuance>,
}

pub fn handler(ctx: Context<Unstake>, quantity: u64) -> Result<()> {
    let pool_manager = &mut ctx.accounts.pool_manager;
    let x_mint = &mut ctx.accounts.x_mint;
    

    let current_timestamp = Clock::get()?.unix_timestamp;
    let x_amount = quantity;

    let initial_x_mint_supply = x_mint.supply;

    // Burning
    let bump = pool_manager.bump; // Corrected to be a slice of a slice of a byte slice
    let signer_seeds: &[&[&[u8]]] = &[&[b"pool-manager", &[bump]]];

    burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                authority: ctx.accounts.payer.to_account_info(),
                from: ctx.accounts.payer_x_mint_ata.to_account_info(),
                mint: x_mint.to_account_info(),
            },
        ),
        x_amount,
    )?;

    // Mint Base into pool
    let vault_balance = ctx.accounts.vault.amount; // Get the actual vault balance
    let amount_to_mint =
        pool_manager.calculate_amount_to_mint(initial_x_mint_supply, current_timestamp, vault_balance)?;
    msg!("Amount to mint: {}", amount_to_mint);

    if amount_to_mint > 0 {
        let mint_context = CpiContext::new_with_signer(
            ctx.accounts.parity_issuance_program.to_account_info(),
            MintAdminTokens {
                token_manager: ctx.accounts.token_manager.to_account_info(),
                minter_mint_ata: ctx.accounts.vault.to_account_info(),
                minter: pool_manager.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
                associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
                mint: ctx.accounts.base_mint.to_account_info(),
            },
            signer_seeds,
        );

        mint_admin(mint_context, amount_to_mint)?;
    }

    // Update newly minted balance
    pool_manager.base_balance = pool_manager
        .base_balance
        .checked_add(amount_to_mint)
        .ok_or(ParityStakingError::CalculationOverflow)?;

    msg!("Base Balance2: {}", pool_manager.base_balance);

    let base_amount: u64 =
        pool_manager.calculate_output_amount(quantity, current_timestamp, false)?;

    msg!("Base amount: {}", base_amount);

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.payer_base_mint_ata.to_account_info(),
                mint: ctx.accounts.base_mint.to_account_info(),
                authority: pool_manager.to_account_info(),
            },
            signer_seeds,
        ),
        base_amount,
        pool_manager.base_mint_decimals,
    )?;

    // Update pool_manager
    pool_manager.base_balance = pool_manager
        .base_balance
        .checked_sub(base_amount)
        .ok_or(ParityStakingError::CalculationOverflow)?;

    Ok(())
}
