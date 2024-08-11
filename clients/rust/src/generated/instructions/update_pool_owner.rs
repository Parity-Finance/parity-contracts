//! This code was AUTOGENERATED using the kinobi library.
//! Please DO NOT EDIT THIS FILE, instead use visitors
//! to add features, then rerun kinobi to update it.
//!
//! [https://github.com/metaplex-foundation/kinobi]
//!

#[cfg(feature = "anchor")]
use anchor_lang::prelude::{AnchorDeserialize, AnchorSerialize};
#[cfg(not(feature = "anchor"))]
use borsh::{BorshDeserialize, BorshSerialize};

/// Accounts.
pub struct UpdatePoolOwner {
    pub pool_manager: solana_program::pubkey::Pubkey,

    pub new_owner: solana_program::pubkey::Pubkey,
}

impl UpdatePoolOwner {
    pub fn instruction(&self) -> solana_program::instruction::Instruction {
        self.instruction_with_remaining_accounts(&[])
    }
    #[allow(clippy::vec_init_then_push)]
    pub fn instruction_with_remaining_accounts(
        &self,
        remaining_accounts: &[solana_program::instruction::AccountMeta],
    ) -> solana_program::instruction::Instruction {
        let mut accounts = Vec::with_capacity(2 + remaining_accounts.len());
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.pool_manager,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.new_owner,
            true,
        ));
        accounts.extend_from_slice(remaining_accounts);
        let data = UpdatePoolOwnerInstructionData::new().try_to_vec().unwrap();

        solana_program::instruction::Instruction {
            program_id: crate::PARITY_STAKING_ID,
            accounts,
            data,
        }
    }
}

#[cfg_attr(not(feature = "anchor"), derive(BorshSerialize, BorshDeserialize))]
#[cfg_attr(feature = "anchor", derive(AnchorSerialize, AnchorDeserialize))]
pub struct UpdatePoolOwnerInstructionData {
    discriminator: [u8; 8],
}

impl UpdatePoolOwnerInstructionData {
    pub fn new() -> Self {
        Self {
            discriminator: [111, 245, 139, 189, 40, 173, 111, 123],
        }
    }
}

/// Instruction builder for `UpdatePoolOwner`.
///
/// ### Accounts:
///
///   0. `[writable]` pool_manager
///   1. `[signer]` new_owner
#[derive(Default)]
pub struct UpdatePoolOwnerBuilder {
    pool_manager: Option<solana_program::pubkey::Pubkey>,
    new_owner: Option<solana_program::pubkey::Pubkey>,
    __remaining_accounts: Vec<solana_program::instruction::AccountMeta>,
}

impl UpdatePoolOwnerBuilder {
    pub fn new() -> Self {
        Self::default()
    }
    #[inline(always)]
    pub fn pool_manager(&mut self, pool_manager: solana_program::pubkey::Pubkey) -> &mut Self {
        self.pool_manager = Some(pool_manager);
        self
    }
    #[inline(always)]
    pub fn new_owner(&mut self, new_owner: solana_program::pubkey::Pubkey) -> &mut Self {
        self.new_owner = Some(new_owner);
        self
    }
    /// Add an aditional account to the instruction.
    #[inline(always)]
    pub fn add_remaining_account(
        &mut self,
        account: solana_program::instruction::AccountMeta,
    ) -> &mut Self {
        self.__remaining_accounts.push(account);
        self
    }
    /// Add additional accounts to the instruction.
    #[inline(always)]
    pub fn add_remaining_accounts(
        &mut self,
        accounts: &[solana_program::instruction::AccountMeta],
    ) -> &mut Self {
        self.__remaining_accounts.extend_from_slice(accounts);
        self
    }
    #[allow(clippy::clone_on_copy)]
    pub fn instruction(&self) -> solana_program::instruction::Instruction {
        let accounts = UpdatePoolOwner {
            pool_manager: self.pool_manager.expect("pool_manager is not set"),
            new_owner: self.new_owner.expect("new_owner is not set"),
        };

        accounts.instruction_with_remaining_accounts(&self.__remaining_accounts)
    }
}

/// `update_pool_owner` CPI accounts.
pub struct UpdatePoolOwnerCpiAccounts<'a, 'b> {
    pub pool_manager: &'b solana_program::account_info::AccountInfo<'a>,

    pub new_owner: &'b solana_program::account_info::AccountInfo<'a>,
}

/// `update_pool_owner` CPI instruction.
pub struct UpdatePoolOwnerCpi<'a, 'b> {
    /// The program to invoke.
    pub __program: &'b solana_program::account_info::AccountInfo<'a>,

    pub pool_manager: &'b solana_program::account_info::AccountInfo<'a>,

    pub new_owner: &'b solana_program::account_info::AccountInfo<'a>,
}

impl<'a, 'b> UpdatePoolOwnerCpi<'a, 'b> {
    pub fn new(
        program: &'b solana_program::account_info::AccountInfo<'a>,
        accounts: UpdatePoolOwnerCpiAccounts<'a, 'b>,
    ) -> Self {
        Self {
            __program: program,
            pool_manager: accounts.pool_manager,
            new_owner: accounts.new_owner,
        }
    }
    #[inline(always)]
    pub fn invoke(&self) -> solana_program::entrypoint::ProgramResult {
        self.invoke_signed_with_remaining_accounts(&[], &[])
    }
    #[inline(always)]
    pub fn invoke_with_remaining_accounts(
        &self,
        remaining_accounts: &[(
            &'b solana_program::account_info::AccountInfo<'a>,
            bool,
            bool,
        )],
    ) -> solana_program::entrypoint::ProgramResult {
        self.invoke_signed_with_remaining_accounts(&[], remaining_accounts)
    }
    #[inline(always)]
    pub fn invoke_signed(
        &self,
        signers_seeds: &[&[&[u8]]],
    ) -> solana_program::entrypoint::ProgramResult {
        self.invoke_signed_with_remaining_accounts(signers_seeds, &[])
    }
    #[allow(clippy::clone_on_copy)]
    #[allow(clippy::vec_init_then_push)]
    pub fn invoke_signed_with_remaining_accounts(
        &self,
        signers_seeds: &[&[&[u8]]],
        remaining_accounts: &[(
            &'b solana_program::account_info::AccountInfo<'a>,
            bool,
            bool,
        )],
    ) -> solana_program::entrypoint::ProgramResult {
        let mut accounts = Vec::with_capacity(2 + remaining_accounts.len());
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.pool_manager.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.new_owner.key,
            true,
        ));
        remaining_accounts.iter().for_each(|remaining_account| {
            accounts.push(solana_program::instruction::AccountMeta {
                pubkey: *remaining_account.0.key,
                is_signer: remaining_account.1,
                is_writable: remaining_account.2,
            })
        });
        let data = UpdatePoolOwnerInstructionData::new().try_to_vec().unwrap();

        let instruction = solana_program::instruction::Instruction {
            program_id: crate::PARITY_STAKING_ID,
            accounts,
            data,
        };
        let mut account_infos = Vec::with_capacity(2 + 1 + remaining_accounts.len());
        account_infos.push(self.__program.clone());
        account_infos.push(self.pool_manager.clone());
        account_infos.push(self.new_owner.clone());
        remaining_accounts
            .iter()
            .for_each(|remaining_account| account_infos.push(remaining_account.0.clone()));

        if signers_seeds.is_empty() {
            solana_program::program::invoke(&instruction, &account_infos)
        } else {
            solana_program::program::invoke_signed(&instruction, &account_infos, signers_seeds)
        }
    }
}

/// Instruction builder for `UpdatePoolOwner` via CPI.
///
/// ### Accounts:
///
///   0. `[writable]` pool_manager
///   1. `[signer]` new_owner
pub struct UpdatePoolOwnerCpiBuilder<'a, 'b> {
    instruction: Box<UpdatePoolOwnerCpiBuilderInstruction<'a, 'b>>,
}

impl<'a, 'b> UpdatePoolOwnerCpiBuilder<'a, 'b> {
    pub fn new(program: &'b solana_program::account_info::AccountInfo<'a>) -> Self {
        let instruction = Box::new(UpdatePoolOwnerCpiBuilderInstruction {
            __program: program,
            pool_manager: None,
            new_owner: None,
            __remaining_accounts: Vec::new(),
        });
        Self { instruction }
    }
    #[inline(always)]
    pub fn pool_manager(
        &mut self,
        pool_manager: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.pool_manager = Some(pool_manager);
        self
    }
    #[inline(always)]
    pub fn new_owner(
        &mut self,
        new_owner: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.new_owner = Some(new_owner);
        self
    }
    /// Add an additional account to the instruction.
    #[inline(always)]
    pub fn add_remaining_account(
        &mut self,
        account: &'b solana_program::account_info::AccountInfo<'a>,
        is_writable: bool,
        is_signer: bool,
    ) -> &mut Self {
        self.instruction
            .__remaining_accounts
            .push((account, is_writable, is_signer));
        self
    }
    /// Add additional accounts to the instruction.
    ///
    /// Each account is represented by a tuple of the `AccountInfo`, a `bool` indicating whether the account is writable or not,
    /// and a `bool` indicating whether the account is a signer or not.
    #[inline(always)]
    pub fn add_remaining_accounts(
        &mut self,
        accounts: &[(
            &'b solana_program::account_info::AccountInfo<'a>,
            bool,
            bool,
        )],
    ) -> &mut Self {
        self.instruction
            .__remaining_accounts
            .extend_from_slice(accounts);
        self
    }
    #[inline(always)]
    pub fn invoke(&self) -> solana_program::entrypoint::ProgramResult {
        self.invoke_signed(&[])
    }
    #[allow(clippy::clone_on_copy)]
    #[allow(clippy::vec_init_then_push)]
    pub fn invoke_signed(
        &self,
        signers_seeds: &[&[&[u8]]],
    ) -> solana_program::entrypoint::ProgramResult {
        let instruction = UpdatePoolOwnerCpi {
            __program: self.instruction.__program,

            pool_manager: self
                .instruction
                .pool_manager
                .expect("pool_manager is not set"),

            new_owner: self.instruction.new_owner.expect("new_owner is not set"),
        };
        instruction.invoke_signed_with_remaining_accounts(
            signers_seeds,
            &self.instruction.__remaining_accounts,
        )
    }
}

struct UpdatePoolOwnerCpiBuilderInstruction<'a, 'b> {
    __program: &'b solana_program::account_info::AccountInfo<'a>,
    pool_manager: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    new_owner: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    /// Additional instruction accounts `(AccountInfo, is_writable, is_signer)`.
    __remaining_accounts: Vec<(
        &'b solana_program::account_info::AccountInfo<'a>,
        bool,
        bool,
    )>,
}
