use crate::{GlobalConfig, PtStakingError, UserStake, POINTS_EARNED_PHASE_SIZE};
use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked},
};

#[derive(Accounts)]
pub struct PtUnstake<'info> {
    #[account(
        mut,
        seeds = [b"global-config"],
        bump
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(
        mut,
        seeds = [b"user-stake",user.key().as_ref()],
        bump,
    )]
    pub user_stake: Account<'info, UserStake>,

    #[account(
        mut,
        mint::decimals = global_config.base_mint_decimals,
        address = global_config.base_mint,
    )]
    pub base_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = base_mint,
        associated_token::authority = user,
    )]
    pub user_base_mint_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = base_mint,
        associated_token::authority = global_config,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl PtUnstake<'_> {
    pub fn handler(ctx: Context<PtUnstake>, quantity: u64) -> Result<()> {
        let global_config = &mut ctx.accounts.global_config;
        let user_stake = &mut ctx.accounts.user_stake;
        let user_base_mint_ata = &ctx.accounts.user_base_mint_ata;
        let vault = &ctx.accounts.vault;

        //Signing
        let bump = global_config.bump; // Corrected to be a slice of a slice of a byte slice
        let signer_seeds: &[&[&[u8]]] = &[&[b"global-config", &[bump]]];

        // Check if the user has enough staked tokens to unstake
        if user_stake.staked_amount < quantity {
            return err!(PtStakingError::InsufficientStakedAmount);
        }

        // Transfer tokens from vault to user
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: vault.to_account_info(),
                    to: user_base_mint_ata.to_account_info(),
                    mint: ctx.accounts.base_mint.to_account_info(),
                    authority: global_config.to_account_info(),
                },
                signer_seeds,
            ),
            quantity,
            global_config.base_mint_decimals,
        )?;

        // Calculate points earned until now
        let current_timestamp = Clock::get()?.unix_timestamp;
        let points_earned_phases = global_config.calculate_points(
            user_stake.staked_amount,
            user_stake.last_claim_timestamp,
            current_timestamp,
        )?;
        msg!("points_earned_phases: {:?}", points_earned_phases);

        // Calculate how many new phases will be added
        let new_phases_count = points_earned_phases
            .iter()
            .filter(|&phase| {
                !user_stake
                    .points_history
                    .iter()
                    .any(|p| p.index == phase.index)
            })
            .count();

        msg!("new_phases_count: {}", new_phases_count);

        // Calculate required space
        let additional_space = new_phases_count
            .checked_mul(POINTS_EARNED_PHASE_SIZE)
            .unwrap();

        msg!("additional_space: {}", additional_space);

        let current_space = user_stake.to_account_info().data_len();
        let required_space = current_space.checked_add(additional_space).unwrap();
        msg!("required_space: {}", required_space);

        let rent = Rent::get()?;
        let new_minimum_balance = rent.minimum_balance(required_space);
        msg!("new_minimum_balance: {}", new_minimum_balance);

        let lamports_diff = new_minimum_balance.saturating_sub(user_stake.get_lamports());
        msg!("lamports_diff: {}", lamports_diff);

        if lamports_diff > 0 {
            transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.user.to_account_info(),
                        to: user_stake.to_account_info(),
                    },
                ),
                lamports_diff,
            )?;
        }

        // Realloc space
        user_stake
            .to_account_info()
            .realloc(required_space, false)?;
        // Update user's points history
        user_stake.update_points_history(points_earned_phases.clone());

        // Update global points history
        global_config.update_global_points(points_earned_phases);

        // Update the global staked supply
        global_config.staked_supply = global_config
            .staked_supply
            .checked_sub(quantity)
            .ok_or(PtStakingError::CalculationOverflow)?;

        // Update user's staked amount
        user_stake.staked_amount = user_stake
            .staked_amount
            .checked_sub(quantity)
            .ok_or(PtStakingError::CalculationOverflow)?;

        // Update the staking timestamp to the current time
        user_stake.last_claim_timestamp = current_timestamp;

        // If all tokens are unstaked, reset the initial_staking_timestamp
        if user_stake.staked_amount == 0 {
            user_stake.initial_staking_timestamp = 0;
        }

        Ok(())
    }
}
