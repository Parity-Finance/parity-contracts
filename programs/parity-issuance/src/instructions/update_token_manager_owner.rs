use anchor_lang::prelude::*;

use crate::{ParityIssuanceError, TokenManager};

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct UpdateTokenManagerOwnerParams {
    pub new_admin: Option<Pubkey>,
    pub new_minter: Option<Pubkey>,
    pub emergency_fund_basis_points: Option<u16>,
    pub new_withdraw_time_lock: Option<i64>,
    pub new_withdraw_execution_window: Option<i64>,
    pub new_mint_fee_bps: Option<u16>,
    pub new_redeem_fee_bps: Option<u16>,
}

#[derive(Accounts)]
pub struct UpdateTokenManagerOwner<'info> {
    #[account(
        mut,
        seeds = [b"token-manager"],
        bump = token_manager.bump
    )]
    pub token_manager: Account<'info, TokenManager>,
    #[account(address = token_manager.owner @ ParityIssuanceError::InvalidOwner)]
    pub owner: Signer<'info>,
}

pub fn handler(
    ctx: Context<UpdateTokenManagerOwner>,
    params: UpdateTokenManagerOwnerParams,
) -> Result<()> {
    let token_manager = &mut ctx.accounts.token_manager;

    if let Some(new_admin) = params.new_admin {
        if new_admin == Pubkey::default() {
            return err!(ParityIssuanceError::InvalidParam);
        }
        token_manager.admin = new_admin;
    }

    if let Some(new_minter) = params.new_minter {
        if new_minter == Pubkey::default() {
            return err!(ParityIssuanceError::InvalidParam);
        }
        token_manager.minter = new_minter;
    }

    if let Some(emergency_fund_basis_points) = params.emergency_fund_basis_points {
        if emergency_fund_basis_points > 10000 {
            return err!(ParityIssuanceError::InvalidParam);
        }
        token_manager.emergency_fund_basis_points = emergency_fund_basis_points;
    }

    if let Some(withdraw_time_lock) = params.new_withdraw_time_lock {
        if withdraw_time_lock < 0 {
            return err!(ParityIssuanceError::InvalidParam);
        }
        token_manager.withdraw_time_lock = withdraw_time_lock;
    }

    if let Some(withdraw_execution_window) = params.new_withdraw_execution_window {
        if withdraw_execution_window < 0 {
            return err!(ParityIssuanceError::InvalidParam);
        }
        token_manager.withdraw_execution_window = withdraw_execution_window;
    }

    if let Some(mint_fee_bps) = params.new_mint_fee_bps {
        if mint_fee_bps > 10000 {
            return err!(ParityIssuanceError::InvalidParam);
        }
        token_manager.mint_fee_bps = mint_fee_bps;
    }

    if let Some(redeem_fee_bps) = params.new_redeem_fee_bps {
        if redeem_fee_bps > 10000 {
            return err!(ParityIssuanceError::InvalidParam);
        }
        token_manager.redeem_fee_bps = redeem_fee_bps;
    }

    Ok(())
}
