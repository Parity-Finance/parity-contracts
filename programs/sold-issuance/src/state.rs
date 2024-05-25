use anchor_lang::prelude::*;

pub const TOKEN_MANAGER_SIZE: usize = 8 + (32 * 3) + ((4 + 32 * 3) * 3) + 8 + 1 + 1 + 1;

#[account]
pub struct TokenManager {
    pub token_manager: Pubkey,                     // 32
    pub mint_redeem_authorities: Vec<Pubkey>,      // 4 +  32 * 3
    pub deposit_withdraw_authorities: Vec<Pubkey>, // 4 +  32 * 3
    pub pause_authorities: Vec<Pubkey>,            // 4 +  32 * 3
    pub mint: Pubkey,                              // 32
    pub mint_decimals: u8,                         // 1
    pub quote_mint: Pubkey,                        // 32
    pub total_supply: u64,                         // 8
    pub active: bool,                              // 1
    pub bump: u8,                                  // 1
}
