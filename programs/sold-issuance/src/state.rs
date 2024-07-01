use anchor_lang::prelude::*;

use crate::SoldIssuanceError;

pub const TOKEN_MANAGER_SIZE: usize = 8 + 4 + (32 * 12) + (8 * 8) + 2 + (1 * 4);

#[account]
pub struct TokenManager {
    pub bump: u8, // 1
    // Authorities
    pub owner: Pubkey,             // 32
    pub pending_owner: Pubkey,     // 32
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
    pub limit_per_slot: u64,              // 8
    pub current_slot: u64,                // 8
    pub current_slot_volume: u64,         // 8
    pub active: bool,                     // 1
    pub emergency_fund_basis_points: u16, // 2

    // Withdrawal
    pub pending_withdrawal_amount: u64,  // 8
    pub withdrawal_initiation_time: i64, // 8
    pub withdraw_time_lock: i64,         // 8
    pub withdraw_execution_window: i64,  // 8

    // Other
    pub total_collateral: u64, // 8
}

impl TokenManager {
    pub fn calculate_normalized_quantity(&self, quantity: u64) -> Result<u64> {
        // Calculate the absolute difference in decimals between mint and quote mint
        let decimal_difference =
            (self.mint_decimals as i32 - self.quote_mint_decimals as i32).abs() as u32;

        // If mint decimals are greater, divide the quantity by 10^decimal_difference
        if self.mint_decimals > self.quote_mint_decimals {
            (quantity as u128)
                .checked_div(10u128.pow(decimal_difference))
                .ok_or(SoldIssuanceError::CalculationOverflow.into())
                .map(|result| result as u64)
        // If mint decimals are lesser, multiply the quantity by 10^decimal_difference
        } else if self.mint_decimals < self.quote_mint_decimals {
            (quantity as u128)
                .checked_mul(10u128.pow(decimal_difference))
                .ok_or(SoldIssuanceError::CalculationOverflow.into())
                .map(|result| result as u64)
        // If decimals are equal, return the quantity as is
        } else {
            Ok(quantity)
        }
    }

    pub fn calculate_quote_amount(&self, normalized_quantity: u64) -> Result<u64> {
        // Multiply the normalized quantity by the exchange rate
        (normalized_quantity as u128)
            .checked_mul(self.exchange_rate as u128)
            .ok_or(SoldIssuanceError::CalculationOverflow.into())
            .and_then(|result| {
                result
                    .checked_div(10u128.pow(self.quote_mint_decimals.into()))
                    .ok_or(SoldIssuanceError::CalculationOverflow.into())
            })
            .map(|result| result as u64)
    }

    pub fn check_block_limit(&mut self, quantity: u64) -> Result<()> {
        // Get the current slot from the clock
        let current_slot = Clock::get()?.slot;

        // If the current slot matches the stored slot
        if self.current_slot == current_slot {
            // Check if adding the quantity exceeds the mint limit per slot
            if self.current_slot_volume + quantity > self.limit_per_slot {
                return Err(SoldIssuanceError::SlotLimitExceeded.into());
            }
        } else {
            if quantity > self.limit_per_slot {
                return Err(SoldIssuanceError::SlotLimitExceeded.into());
            }
            // If the slot has changed, reset the current slot and mint volume
            self.current_slot = current_slot;
            self.current_slot_volume = quantity;
        }

        Ok(())
    }

    pub fn verify_merkle_proof(&self, proof: Vec<[u8; 32]>, leaf: &[u8; 32]) -> Result<()> {
        let empty_merkle_root = [0u8; 32];

        // If the Merkle root is empty, allow all
        if self.merkle_root == empty_merkle_root {
            Ok(())
        } else {
            // Allow List Check
            let mut computed_hash = *leaf;
            for proof_element in proof.iter() {
                // Compute the hash based on the proof elements
                if computed_hash <= *proof_element {
                    computed_hash =
                        solana_program::keccak::hashv(&[&computed_hash, proof_element]).0
                } else {
                    computed_hash =
                        solana_program::keccak::hashv(&[proof_element, &computed_hash]).0;
                }
            }
            // Check if the computed hash matches the stored Merkle root
            if computed_hash == self.merkle_root {
                Ok(())
            } else {
                return Err(SoldIssuanceError::AddressNotFoundInAllowedList.into());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_normalized_quantity() {
        let token_manager = TokenManager {
            bump: 0,
            owner: Pubkey::default(),
            pending_owner: Pubkey::default(),
            admin: Pubkey::default(),
            minter: Pubkey::default(),
            gate_keepers: vec![],
            merkle_root: [0u8; 32],
            mint: Pubkey::default(),
            mint_decimals: 6,
            quote_mint: Pubkey::default(),
            quote_mint_decimals: 6,
            exchange_rate: 1000000,
            limit_per_slot: 0,
            current_slot: 0,
            current_slot_volume: 0,
            active: true,
            emergency_fund_basis_points: 0,
            pending_withdrawal_amount: 0,
            withdrawal_initiation_time: 0,
            withdraw_time_lock: 0,
            withdraw_execution_window: 0,
            total_collateral: 0,
        };

        // Test case where token decimals are equal
        let result = token_manager
            .calculate_normalized_quantity(1000000)
            .unwrap();
        assert_eq!(result, 1000000);

        // Test case where mint decimals are less than quote mint decimals
        let token_manager = TokenManager {
            mint_decimals: 6,
            quote_mint_decimals: 9,
            ..token_manager
        };
        let result = token_manager
            .calculate_normalized_quantity(1000000)
            .unwrap();
        assert_eq!(result, 1000000000);

        // Test case where mint decimals are more than quote mint decimals
        let token_manager = TokenManager {
            mint_decimals: 9,
            quote_mint_decimals: 6,
            ..token_manager
        };
        let result = token_manager
            .calculate_normalized_quantity(1000000000)
            .unwrap();
        assert_eq!(result, 1000000);
    }

    #[test]
    fn test_calculate_quote_amount() {
        let token_manager = TokenManager {
            bump: 0,
            owner: Pubkey::default(),
            pending_owner: Pubkey::default(),
            admin: Pubkey::default(),
            minter: Pubkey::default(),
            gate_keepers: vec![],
            merkle_root: [0u8; 32],
            mint: Pubkey::default(),
            mint_decimals: 6,
            quote_mint: Pubkey::default(),
            quote_mint_decimals: 6,
            exchange_rate: 2000000,
            limit_per_slot: 0,
            current_slot: 0,
            current_slot_volume: 0,
            active: true,
            emergency_fund_basis_points: 0,
            pending_withdrawal_amount: 0,
            withdrawal_initiation_time: 0,
            withdraw_time_lock: 0,
            withdraw_execution_window: 0,
            total_collateral: 0,
        };

        // Test case where normalized quantity is correctly converted to quote amount
        let result = token_manager.calculate_quote_amount(10000).unwrap();
        assert_eq!(result, 20000);

        // Test case where normalized quantity is zero
        let result = token_manager.calculate_quote_amount(0).unwrap();
        assert_eq!(result, 0);

        // Test case where normalized quantity is large
        let result = token_manager.calculate_quote_amount(1000000000).unwrap();
        assert_eq!(result, 2000000000);
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn test_check_block_limit() {
            let mut token_manager = TokenManager {
                bump: 0,
                owner: Pubkey::default(),
                pending_owner: Pubkey::default(),
                admin: Pubkey::default(),
                minter: Pubkey::default(),
                gate_keepers: vec![],
                merkle_root: [0u8; 32],
                mint: Pubkey::default(),
                mint_decimals: 6,
                quote_mint: Pubkey::default(),
                quote_mint_decimals: 6,
                exchange_rate: 1000000,
                limit_per_slot: 100,
                current_slot: 0,
                current_slot_volume: 0,
                active: true,
                emergency_fund_basis_points: 0,
                pending_withdrawal_amount: 0,
                withdrawal_initiation_time: 0,
                withdraw_time_lock: 0,
                withdraw_execution_window: 0,
                total_collateral: 0,
            };

            // Mock the Clock to return a specific slot
            let mut mock_slot = 1;

            // Test case where the current slot is the same and within limit
            token_manager.current_slot = mock_slot;
            token_manager.current_slot_volume = 50;
            assert!(token_manager.check_block_limit(30).is_ok());
            assert_eq!(token_manager.current_slot_volume, 80);

            // Test case where the current slot is the same and exceeds limit
            assert!(token_manager.check_block_limit(30).is_err());

            // Test case where the slot has changed
            mock_slot = 2;
            assert!(token_manager.check_block_limit(30).is_ok());
            assert_eq!(token_manager.current_slot, mock_slot + 1);
            assert_eq!(token_manager.current_slot_volume, 30);
        }
    }
}
