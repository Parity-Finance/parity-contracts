use anchor_lang::prelude::*;

use crate::ParityIssuanceError;

pub const TOKEN_MANAGER_SIZE: usize = 8 + (32 * 7) + (8 * 9) + (2 * 3) + (1 * 5);

#[account]
pub struct TokenManager {
    pub bump: u8, // 1
    // Authorities
    pub owner: Pubkey,              // 32
    pub pending_owner: Pubkey,      // 32
    pub admin: Pubkey,              // 32
    pub minter: Pubkey,             // 32
    pub merkle_root: [u8; 32],      // 32
    pub is_whitelist_enabled: bool, // 1

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
    pub mint_fee_bps: u16,     // 2
    pub redeem_fee_bps: u16,   // 2
}

#[account]
pub struct Gatekeeper {
    pub wallet: Pubkey,
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
                .ok_or(ParityIssuanceError::CalculationOverflow.into())
                .map(|result| result as u64)
        // If mint decimals are lesser, multiply the quantity by 10^decimal_difference
        } else if self.mint_decimals < self.quote_mint_decimals {
            (quantity as u128)
                .checked_mul(10u128.pow(decimal_difference))
                .ok_or(ParityIssuanceError::CalculationOverflow.into())
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
            .ok_or(ParityIssuanceError::CalculationOverflow.into())
            .and_then(|result| {
                result
                    .checked_div(10u128.pow(self.quote_mint_decimals.into()))
                    .ok_or(ParityIssuanceError::CalculationOverflow.into())
            })
            .map(|result| result as u64)
    }

    pub fn check_block_limit(&mut self, quantity: u64, current_slot: u64) -> Result<()> {
        // If the current slot matches the stored slot
        if self.current_slot == current_slot {
            // Check if adding the quantity exceeds the mint limit per slot
            if self.current_slot_volume + quantity > self.limit_per_slot {
                return err!(ParityIssuanceError::SlotLimitExceeded);
            }
        } else {
            if quantity > self.limit_per_slot {
                return err!(ParityIssuanceError::SlotLimitExceeded);
            }
            // If the slot has changed, reset the current slot
            self.current_slot = current_slot;
        }

        Ok(())
    }

    pub fn verify_merkle_proof(&self, proof: Vec<[u8; 32]>, leaf: &[u8; 32]) -> Result<()> {
        // If whitelisting is not enabled, allow all
        if !self.is_whitelist_enabled {
            return Ok(());
        }
        // Allow List Check
        let mut computed_hash = *leaf;
        for proof_element in proof.iter() {
            // Compute the hash based on the proof elements
            if computed_hash <= *proof_element {
                computed_hash = solana_program::keccak::hashv(&[&computed_hash, proof_element]).0
            } else {
                computed_hash = solana_program::keccak::hashv(&[proof_element, &computed_hash]).0;
            }
        }
        // Check if the computed hash matches the stored Merkle root
        if computed_hash == self.merkle_root {
            Ok(())
        } else {
            return err!(ParityIssuanceError::AddressNotFoundInAllowedList);
        }
    }

    pub fn check_excessive_deposit(&self, quote_amount: u64, mint_supply: u64) -> Result<()> {
        let new_total_collateral = (self.total_collateral as u128)
            .checked_add(quote_amount as u128)
            .ok_or(ParityIssuanceError::CalculationOverflow)?;
        let max_collateral = (mint_supply as u128)
            .checked_div(10u128.pow(self.mint_decimals.into()))
            .ok_or(ParityIssuanceError::CalculationOverflow)?
            .checked_mul(self.exchange_rate as u128)
            .ok_or(ParityIssuanceError::CalculationOverflow)?
            .checked_div(10u128.pow(self.mint_decimals.into()))
            .ok_or(ParityIssuanceError::CalculationOverflow)?
            .checked_mul(10u128.pow(self.quote_mint_decimals.into()))
            .ok_or(ParityIssuanceError::CalculationOverflow)?;

        msg!("new_total_collateral: {}", new_total_collateral);
        msg!("max_collateral: {}", max_collateral);
        msg!("quote_amount: {}", quote_amount);
        msg!("mint_supply: {}", mint_supply);
        msg!("total_collateral: {}", self.total_collateral);

        if new_total_collateral > max_collateral {
            return err!(ParityIssuanceError::ExcessiveDeposit);
        }

        Ok(())
    }

    pub fn calculate_max_withdrawable_amount(
        &self,
        mint_supply: u64,
        vault_amount: u64,
    ) -> Result<u64> {
        let required_collateral = (mint_supply as u128)
            .checked_mul(self.exchange_rate as u128)
            .ok_or(ParityIssuanceError::CalculationOverflow)?
            .checked_div(10u128.pow(self.mint_decimals.into()))
            .ok_or(ParityIssuanceError::CalculationOverflow)?;

        let min_required_collateral = required_collateral
            .checked_mul(self.emergency_fund_basis_points as u128)
            .ok_or(ParityIssuanceError::CalculationOverflow)?
            .checked_div(10000)
            .ok_or(ParityIssuanceError::CalculationOverflow)?
            .checked_mul(10u128.pow(self.quote_mint_decimals.into()))
            .ok_or(ParityIssuanceError::CalculationOverflow)?
            .checked_div(10u128.pow(self.mint_decimals.into()))
            .ok_or(ParityIssuanceError::CalculationOverflow)?;

        Ok(vault_amount.saturating_sub(min_required_collateral as u64))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn default_token_manager() -> TokenManager {
        TokenManager {
            bump: 0,
            owner: Pubkey::default(),
            pending_owner: Pubkey::default(),
            admin: Pubkey::default(),
            minter: Pubkey::default(),
            merkle_root: [0u8; 32],
            is_whitelist_enabled: true,
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
            mint_fee_bps: 0,
            redeem_fee_bps: 0,
        }
    }

    #[test]
    fn test_calculate_normalized_quantity() {
        let mut token_manager = default_token_manager();

        // Test case where token decimals are equal
        let result = token_manager
            .calculate_normalized_quantity(1000000)
            .unwrap();
        assert_eq!(result, 1000000);

        // Test case where mint decimals are less than quote mint decimals
        token_manager.mint_decimals = 6;
        token_manager.quote_mint_decimals = 9;
        let result = token_manager
            .calculate_normalized_quantity(1000000)
            .unwrap();
        assert_eq!(result, 1000000000);

        // Test case where mint decimals are more than quote mint decimals
        token_manager.mint_decimals = 9;
        token_manager.quote_mint_decimals = 6;
        let result = token_manager
            .calculate_normalized_quantity(1000000000)
            .unwrap();
        assert_eq!(result, 1000000);
    }

    #[test]
    fn test_calculate_quote_amount() {
        let mut token_manager = default_token_manager();
        token_manager.exchange_rate = 2000000;

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

    #[test]
    fn test_calculate_max_withdrawable_amount() {
        let mut token_manager = default_token_manager();
        token_manager.emergency_fund_basis_points = 500; // 5%
        token_manager.total_collateral = 10000000000;
        let vault_amount = token_manager.total_collateral;

        // Test case where mint supply is 1000000
        let result = token_manager
            .calculate_max_withdrawable_amount(10000000000, vault_amount)
            .unwrap();
        assert_eq!(result, 9500000000); // 5% of 1000000 is 50000, so max withdrawable is 1000000 - 50000

        // Test case where mint supply is 0
        let result = token_manager
            .calculate_max_withdrawable_amount(0, vault_amount)
            .unwrap();
        assert_eq!(result, 10000000000); // No collateral required, so all collateral is withdrawable
    }

    #[test]
    fn test_check_excessive_deposit() {
        let mut token_manager = default_token_manager();
        token_manager.total_collateral = 500000; // Main value

        // Test case where deposit is within limit
        let result = token_manager.check_excessive_deposit(500000, 1000000);
        assert!(result.is_ok());

        // Test case where deposit exceeds limit
        let result = token_manager.check_excessive_deposit(500001, 1000000);
        assert!(result.is_err());
    }
}
