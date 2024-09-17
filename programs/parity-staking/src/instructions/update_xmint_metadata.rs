use crate::{state::PoolManager, ParityStakingError};

use anchor_lang::prelude::*;
use anchor_spl::metadata::{
    mpl_token_metadata::types::DataV2, update_metadata_accounts_v2, Metadata,
    UpdateMetadataAccountsV2,
};

#[derive(Accounts)]
pub struct UpdateXmintMetadata<'info> {
    #[account(
        mut,
        seeds = [b"pool-manager"],
        bump = pool_manager.bump
    )]
    pub pool_manager: Account<'info, PoolManager>,
    #[account(address = pool_manager.owner @ ParityStakingError::InvalidOwner)]
    pub owner: Signer<'info>,
    /// CHECK: Handled by metadata program
    #[account(mut)]
    pub metadata_account: UncheckedAccount<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<UpdateXmintMetadata>,
    name: String,
    symbol: String,
    uri: String,
) -> Result<()> {
    let pool_manager = &ctx.accounts.pool_manager;

    // Check if the name is not empty
    if name.is_empty() {
        return err!(ParityStakingError::InvalidParam); // Ensure name is not empty
    }

    // Check if the symbol is not empty
    if symbol.is_empty() {
        return err!(ParityStakingError::InvalidParam); // Ensure symbol is not empty
    }

    // Check if the URI is not empty
    if uri.is_empty() {
        return err!(ParityStakingError::InvalidParam); // Ensure URI is not empty
    }

    let bump = pool_manager.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[b"pool-manager", &[bump]]];

    let data = DataV2 {
        name,
        symbol,
        uri,
        seller_fee_basis_points: 0,
        creators: None,
        collection: None,
        uses: None,
    };

    let cpi_accounts = UpdateMetadataAccountsV2 {
        metadata: ctx.accounts.metadata_account.to_account_info(),
        update_authority: pool_manager.to_account_info(),
    };
    let ctx = CpiContext::new_with_signer(
        ctx.accounts.token_metadata_program.to_account_info(),
        cpi_accounts,
        &signer_seeds,
    );
    update_metadata_accounts_v2(ctx, None, Some(data), None, Some(true))?;

    Ok(())
}
