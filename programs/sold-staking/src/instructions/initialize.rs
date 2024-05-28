use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct InitializeStakePool {
    // #[account(mut)]
    // pub payer: Signer<'info>,

    // /// Authority that can add rewards pools
    // /// CHECK: No check needed since this will be signer to `AddRewardPool`
    // pub authority: UncheckedAccount<'info>,

    // /// SPL Token Mint of the underlying token to be deposited for staking
    // pub mint: Account<'info, Mint>,

    // #[account(
    //   init,
    //   seeds = [
    //     &nonce.to_le_bytes(),
    //     mint.key().as_ref(),
    //     authority.key().as_ref(),
    //     b"stakePool",
    //   ],
    //   bump,
    //   payer = payer,
    //   space = 8 + StakePool::LEN,
    // )]
    // pub stake_pool: AccountLoader<'info, StakePool>,
    // pub vault: Account<'info, TokenAccount>,

    // pub token_program: Program<'info, Token>,
    // pub rent: Sysvar<'info, Rent>,
    // pub system_program: Program<'info, System>,
}

pub fn handler(_ctx: Context<InitializeStakePool>) -> Result<()> {
    Ok(())
}
