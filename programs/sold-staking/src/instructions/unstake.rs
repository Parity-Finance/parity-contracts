use crate::{error::SoldStakingError, PoolManager};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{burn, transfer_checked, Burn, Mint, Token, TokenAccount, TransferChecked},
};
use sold_issuance::{
    cpi::{accounts::MintAdminTokens, mint_admin},
    program::SoldIssuance,
    TokenManager,
};

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut, seeds = [b"pool-manager"], bump)]
    pub pool_manager: Account<'info, PoolManager>,
    #[account(mut)]
    pub token_manager: Account<'info, TokenManager>,
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
    pub sold_issuance_program: Program<'info, SoldIssuance>,
}

pub fn handler(ctx: Context<Unstake>, quantity: u64) -> Result<()> {
    let pool_manager = &mut ctx.accounts.pool_manager;
    let x_mint = &mut ctx.accounts.x_mint;

    let current_timestamp = Clock::get()?.unix_timestamp;
    // let exchange_rate = pool_manager
    //     .calculate_exchange_rate(current_timestamp)
    //     .ok_or(SoldStakingError::CalculationOverflow)?;

    // msg!("Exchange Rate: {}", exchange_rate);

    let x_amount = quantity;

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
    let amount_to_mint = pool_manager.calculate_amount_to_mint(x_mint.supply, current_timestamp)?;

    // let base_decimals = 10u64.pow(pool_manager.base_mint_decimals.into());
    // let x_supply_value = (x_mint.supply as u128)
    //     .checked_mul(base_decimals as u128)
    //     .ok_or(SoldStakingError::CalculationOverflow)?
    //     .checked_div(exchange_rate as u128)
    //     .ok_or(SoldStakingError::CalculationOverflow)?;

    // let base_balance = pool_manager.base_balance as u128;

    // msg!("X Supply Value: {}", x_supply_value);
    // msg!("Base Balance: {}", base_balance);

    // let amount_to_mint = if x_supply_value > base_balance {
    //     x_supply_value
    //         .checked_sub(base_balance)
    //         .ok_or(SoldStakingError::CalculationOverflow)? as u64
    // } else {
    //     0
    // };

    msg!("Amount to mint: {}", amount_to_mint);

    if amount_to_mint > 0 {
        let mint_context = CpiContext::new_with_signer(
            ctx.accounts.sold_issuance_program.to_account_info(),
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
        .ok_or(SoldStakingError::CalculationOverflow)?;

    msg!("Base Balance2: {}", pool_manager.base_balance);

    // let base_amount = (quantity as u128)
    //     .checked_mul(base_decimals as u128)
    //     .ok_or(SoldStakingError::CalculationOverflow)?
    //     .checked_div(exchange_rate as u128)
    //     .ok_or(SoldStakingError::CalculationOverflow)? as u64;

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

    // Update token_manager
    pool_manager.base_balance = pool_manager
        .base_balance
        .checked_sub(base_amount)
        .ok_or(SoldStakingError::CalculationOverflow)?;

    Ok(())
}
