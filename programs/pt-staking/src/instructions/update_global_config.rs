use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};

use crate::{
    BaseYieldPhase, ExchangeRatePhase, GlobalConfig, PtStakingError, BASE_YIELD_PHASE_SIZE,
    EXCHANGE_RATE_PHASE_SIZE, POINTS_EARNED_PHASE_SIZE,
};

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
        bump,
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(mut, address = global_config.owner @ PtStakingError::InvalidOwner)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl UpdateGlobalConfig<'_> {
    pub fn handler(
        ctx: Context<UpdateGlobalConfig>,
        params: UpdateGlobalConfigParams,
    ) -> Result<()> {
        let global_config = &mut ctx.accounts.global_config;
        let current_timestamp = Clock::get()?.unix_timestamp;

        // Update the deposit cap if provided
        if let Some(new_deposit_cap) = params.new_deposit_cap {
            global_config.deposit_cap = new_deposit_cap;
        }

        let mut additional_space = 0;

        // Update the baseline yield if provided
        let new_base_yield_phase = if let Some(new_yield) = params.new_baseline_yield_bps {
            // Close the current base yield phase by setting the end_date
            if let Some(last_phase) = global_config.base_yield_history.last_mut() {
                last_phase.end_date = Some(current_timestamp);
            }

            additional_space += BASE_YIELD_PHASE_SIZE;

            // Prepare new phase (will be pushed after reallocation)
            Some(BaseYieldPhase {
                base_yield_bps: new_yield,
                start_date: current_timestamp,
                end_date: None,
                index: global_config.base_yield_history.len() as u16,
            })
        } else {
            None
        };

        // Update the exchange rate if provided
        let new_exchange_rate_phase = if let Some(new_rate) = params.new_exchange_rate {
            // Close the current phase by setting the end_date
            if let Some(last_phase) = global_config.exchange_rate_history.last_mut() {
                last_phase.end_date = Some(current_timestamp);
            }

            additional_space += EXCHANGE_RATE_PHASE_SIZE + POINTS_EARNED_PHASE_SIZE;

            // Prepare new phase (will be pushed after reallocation)
            Some(ExchangeRatePhase {
                exchange_rate: new_rate,
                start_date: current_timestamp,
                end_date: None,
                index: global_config.exchange_rate_history.len() as u16,
            })
        } else {
            None
        };

        // Reallocate space if needed
        if additional_space > 0 {
            let current_space = global_config.to_account_info().data_len();
            let required_space = current_space.checked_add(additional_space).unwrap();

            let rent = Rent::get()?;
            let new_minimum_balance = rent.minimum_balance(required_space);

            let lamports_diff =
                new_minimum_balance.saturating_sub(global_config.to_account_info().lamports());

            if lamports_diff > 0 {
                transfer(
                    CpiContext::new(
                        ctx.accounts.system_program.to_account_info(),
                        Transfer {
                            from: ctx.accounts.owner.to_account_info(),
                            to: global_config.to_account_info(),
                        },
                    ),
                    lamports_diff,
                )?;
            }

            global_config
                .to_account_info()
                .realloc(required_space, false)?;
        }

        // Push new phases if they were created
        if let Some(new_base_yield_phase) = new_base_yield_phase {
            global_config.base_yield_history.push(new_base_yield_phase);
        }

        if let Some(new_exchange_rate_phase) = new_exchange_rate_phase {
            global_config
                .exchange_rate_history
                .push(new_exchange_rate_phase);
        }

        Ok(())
    }
}
