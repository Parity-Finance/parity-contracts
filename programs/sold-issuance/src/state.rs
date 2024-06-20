use anchor_lang::prelude::*;

pub const TOKEN_MANAGER_SIZE: usize = 8 + 4 + (32 * 11) + (8 * 9) + 2 + (1 * 4);

#[account]
pub struct TokenManager {
    pub bump: u8, // 1
    // Authorities
    pub owner: Pubkey,             // 32
    pub admin: Pubkey,             // 32
    pub minter: Pubkey,            // 32
    pub gate_keepers: Vec<Pubkey>, // 4 +  32 * 5
    pub merkle_root: [u8; 32],     // 32

    // Tokens
    pub mint: Pubkey,            // 32
    pub mint_decimals: u8,       // 1
    pub quote_mint: Pubkey,      // 32
    pub quote_mint_decimals: u8, // 1
    pub exchange_rate: u64,      // 8

    // Circuit breaks
    pub mint_limit_per_slot: u64,            // 8
    pub redemption_limit_per_slot: u64,      // 8
    pub current_slot: u64,                   // 8
    pub current_slot_mint_volume: u64,       // 8
    pub current_slot_redemption_volume: u64, // 8
    pub active: bool,                        // 1
    pub emergency_fund_basis_points: u16,    // 2

    // Withdrawal
    pub pending_withdrawal_amount: u64,  // 8
    pub withdrawal_initiation_time: i64, // 8

    // Other
    pub total_supply: u64,     // 8
    pub total_collateral: u64, // 8
}

pub fn verify_merkle_proof(proof: Vec<[u8; 32]>, root: &[u8; 32], leaf: &[u8; 32]) -> bool {
    let mut computed_hash = *leaf;
    for proof_element in proof.iter() {
        if computed_hash <= *proof_element {
            computed_hash = solana_program::keccak::hashv(&[&computed_hash, proof_element]).0
        } else {
            computed_hash = solana_program::keccak::hashv(&[proof_element, &computed_hash]).0;
        }
    }
    computed_hash == *root
}
