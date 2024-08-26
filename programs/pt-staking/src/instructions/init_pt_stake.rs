use anchor_lang::prelude::*;

use crate::UserStake;

#[derive(Accounts)]
pub struct InitPtStake<'info> {
    #[account(
        init,
        seeds = [b"user-stake",user.key().as_ref()],
        bump,
        payer = user,
        space = 8 + UserStake::INIT_SPACE,
    )]
    pub user_stake: Account<'info, UserStake>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl InitPtStake<'_> {
    pub fn handler(ctx: Context<InitPtStake>) -> Result<()> {
        let user_stake = &mut ctx.accounts.user_stake;

        user_stake.user_pubkey = ctx.accounts.user.key();
        user_stake.staked_amount = 0;
        user_stake.initial_staking_timestamp = 0;
        user_stake.last_claim_timestamp = 0;
        user_stake.points_history = Vec::new();

        Ok(())
    }
}
