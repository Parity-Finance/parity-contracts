use anchor_lang::prelude::*;

use crate::{ExchangeRatePhase, GlobalConfig, PtStakingError};

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct UpdateGlobalConfigParams {
    pub new_baseline_yield_bps: Option<u64>,
    pub new_exchange_rate: Option<u64>,
    pub new_deposit_cap: Option<u64>,
}

#[derive(Accounts)]
pub struct UpdateGlobalConfig<'info> {
    #[account(
        mut,
        seeds = [b"global-config"],
        bump
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(mut, address = global_config.owner @ PtStakingError::InvalidOwner)]
    pub owner: Signer<'info>,
}

pub fn handler(ctx: Context<UpdateGlobalConfig>, params: UpdateGlobalConfigParams) -> Result<()> {
    let global_config = &mut ctx.accounts.global_config;

    // Update the baseline yield if provided
    if let Some(new_yield) = params.new_baseline_yield_bps {
        global_config.baseline_yield_bps = new_yield;
    }

    // Update the deposit cap if provided
    if let Some(new_deposit_cap) = params.new_deposit_cap {
        global_config.deposit_cap = new_deposit_cap;
    }

    // Update the exchange rate if provided
    if let Some(new_rate) = params.new_exchange_rate {
        let current_timestamp = Clock::get()?.unix_timestamp;

        // Close the current phase by setting the end_date
        if let Some(last_phase) = global_config.exchange_rate_history.last_mut() {
            last_phase.end_date = Some(current_timestamp);
        }

        // Add a new phase to the exchange_rate_history
        let new_phase = ExchangeRatePhase {
            exchange_rate: new_rate,
            start_date: current_timestamp,
            end_date: None, // Open-ended for the new phase
            index: global_config.exchange_rate_history.len() as u32,
        };

        // Push the new phase to the exchange_rate_history
        global_config.exchange_rate_history.push(new_phase);
    }

    Ok(())
}
