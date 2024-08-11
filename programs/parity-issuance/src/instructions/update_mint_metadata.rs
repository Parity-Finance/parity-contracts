use crate::{state::TokenManager, ParityIssuanceError};

use anchor_lang::prelude::*;
use anchor_spl::metadata::{
    mpl_token_metadata::types::DataV2, update_metadata_accounts_v2, Metadata,
    UpdateMetadataAccountsV2,
};

#[derive(Accounts)]
pub struct UpdateMintMetadata<'info> {
    #[account(
        mut,
        seeds = [b"token-manager"],
        bump = token_manager.bump
    )]
    pub token_manager: Account<'info, TokenManager>,
    #[account(address = token_manager.owner @ ParityIssuanceError::InvalidOwner)]
    pub owner: Signer<'info>,
    /// CHECK: Handled by metadata program
    #[account(mut)]
    pub metadata_account: UncheckedAccount<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<UpdateMintMetadata>,
    name: String,
    symbol: String,
    uri: String,
) -> Result<()> {
    let token_manager = &ctx.accounts.token_manager;

    let bump = token_manager.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[b"token-manager", &[bump]]];

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
        update_authority: token_manager.to_account_info(),
    };
    let ctx = CpiContext::new_with_signer(
        ctx.accounts.token_metadata_program.to_account_info(),
        cpi_accounts,
        &signer_seeds,
    );
    update_metadata_accounts_v2(ctx, None, Some(data), None, Some(true))?;

    Ok(())
}
