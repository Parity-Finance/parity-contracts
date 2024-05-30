use anchor_lang::prelude::*;

use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_metadata_accounts_v3, mpl_token_metadata::types::DataV2, CreateMetadataAccountsV3,
        Metadata as Metaplex,
    },
    token::{Mint, Token, TokenAccount},
};

use crate::{StakePool, STAKE_POOL_LENGTH};

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct InitializeStakePoolParams {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub decimals: u8,
    pub initial_exchange_rate: u64,
}

#[derive(Accounts)]
#[instruction(params: InitializeStakePoolParams)]
pub struct InitializeStakePool<'info> {
    /// SPL Token Mint of the underlying token to be deposited for staking
    pub base_mint: Account<'info, Mint>,
    pub x_mint: Account<'info, Mint>,
    /// CHECK: New Metaplex Account being created
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,
    #[account(
      init,
      seeds = [
        b"stake-pool",
      ],
      bump,
      payer = payer,
      space = STAKE_POOL_LENGTH,
    )]
    pub stake_pool: Account<'info, StakePool>,
    #[account(
        init,
        payer = payer,
        associated_token::mint = base_mint,
        associated_token::authority = stake_pool,
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub token_metadata_program: Program<'info, Metaplex>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<InitializeStakePool>, params: InitializeStakePoolParams) -> Result<()> {
    let stake_pool = &mut ctx.accounts.stake_pool;

    let bump = ctx.bumps.stake_pool; // Corrected to be a slice of a slice of a byte slice
    let signer_seeds: &[&[&[u8]]] = &[&[b"stake-pool", &[bump]]];

    let token_data: DataV2 = DataV2 {
        name: params.name,
        symbol: params.symbol,
        uri: params.uri,
        seller_fee_basis_points: 0,
        creators: None,
        collection: None,
        uses: None,
    };

    let metadata_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_metadata_program.to_account_info(),
        CreateMetadataAccountsV3 {
            payer: ctx.accounts.payer.to_account_info(),
            update_authority: stake_pool.to_account_info(),
            mint: ctx.accounts.base_mint.to_account_info(),
            metadata: ctx.accounts.metadata.to_account_info(),
            mint_authority: stake_pool.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
        },
        &signer_seeds,
    );

    create_metadata_accounts_v3(metadata_ctx, token_data, false, true, None)?;

    msg!("Token mint created successfully.");

    let stake_pool = &mut ctx.accounts.stake_pool;

    // Authorities
    stake_pool.authority = stake_pool.key();
    // Token
    stake_pool.base_mint = ctx.accounts.base_mint.key();
    stake_pool.base_mint_decimals = ctx.accounts.base_mint.decimals;
    stake_pool.x_mint = ctx.accounts.x_mint.key();
    stake_pool.x_mint_decimals = ctx.accounts.x_mint.decimals;
    stake_pool.initial_exchange_rate = params.initial_exchange_rate;
    // Other
    stake_pool.base_balance = 0;
    stake_pool.x_supply = 0;
    stake_pool.annual_yield_rate = 2000;

    let clock = Clock::get()?;
    let current_timestamp = clock.unix_timestamp;
    stake_pool.inception_timestamp = current_timestamp;

    Ok(())
}
