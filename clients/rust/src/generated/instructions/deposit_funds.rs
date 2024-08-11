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
pub struct DepositFunds {
    pub token_manager: solana_program::pubkey::Pubkey,

    pub mint: solana_program::pubkey::Pubkey,

    pub quote_mint: solana_program::pubkey::Pubkey,

    pub authority_quote_mint_ata: solana_program::pubkey::Pubkey,

    pub vault: solana_program::pubkey::Pubkey,

    pub admin: solana_program::pubkey::Pubkey,

    pub rent: solana_program::pubkey::Pubkey,

    pub system_program: solana_program::pubkey::Pubkey,

    pub token_program: solana_program::pubkey::Pubkey,

    pub associated_token_program: solana_program::pubkey::Pubkey,
}

impl DepositFunds {
    pub fn instruction(
        &self,
        args: DepositFundsInstructionArgs,
    ) -> solana_program::instruction::Instruction {
        self.instruction_with_remaining_accounts(args, &[])
    }
    #[allow(clippy::vec_init_then_push)]
    pub fn instruction_with_remaining_accounts(
        &self,
        args: DepositFundsInstructionArgs,
        remaining_accounts: &[solana_program::instruction::AccountMeta],
    ) -> solana_program::instruction::Instruction {
        let mut accounts = Vec::with_capacity(10 + remaining_accounts.len());
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.token_manager,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.mint, false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.quote_mint,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.authority_quote_mint_ata,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.vault, false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.admin, true,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.rent, false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.system_program,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.token_program,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.associated_token_program,
            false,
        ));
        accounts.extend_from_slice(remaining_accounts);
        let mut data = DepositFundsInstructionData::new().try_to_vec().unwrap();
        let mut args = args.try_to_vec().unwrap();
        data.append(&mut args);

        solana_program::instruction::Instruction {
            program_id: crate::PARITY_ISSUANCE_ID,
            accounts,
            data,
        }
    }
}

#[cfg_attr(not(feature = "anchor"), derive(BorshSerialize, BorshDeserialize))]
#[cfg_attr(feature = "anchor", derive(AnchorSerialize, AnchorDeserialize))]
pub struct DepositFundsInstructionData {
    discriminator: [u8; 8],
}

impl DepositFundsInstructionData {
    pub fn new() -> Self {
        Self {
            discriminator: [202, 39, 52, 211, 53, 20, 250, 88],
        }
    }
}

#[cfg_attr(not(feature = "anchor"), derive(BorshSerialize, BorshDeserialize))]
#[cfg_attr(feature = "anchor", derive(AnchorSerialize, AnchorDeserialize))]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DepositFundsInstructionArgs {
    pub quantity: u64,
}

/// Instruction builder for `DepositFunds`.
///
/// ### Accounts:
///
///   0. `[writable]` token_manager
///   1. `[]` mint
///   2. `[]` quote_mint
///   3. `[writable]` authority_quote_mint_ata
///   4. `[writable]` vault
///   5. `[writable, signer]` admin
///   6. `[optional]` rent (default to `SysvarRent111111111111111111111111111111111`)
///   7. `[optional]` system_program (default to `11111111111111111111111111111111`)
///   8. `[optional]` token_program (default to `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`)
///   9. `[]` associated_token_program
#[derive(Default)]
pub struct DepositFundsBuilder {
    token_manager: Option<solana_program::pubkey::Pubkey>,
    mint: Option<solana_program::pubkey::Pubkey>,
    quote_mint: Option<solana_program::pubkey::Pubkey>,
    authority_quote_mint_ata: Option<solana_program::pubkey::Pubkey>,
    vault: Option<solana_program::pubkey::Pubkey>,
    admin: Option<solana_program::pubkey::Pubkey>,
    rent: Option<solana_program::pubkey::Pubkey>,
    system_program: Option<solana_program::pubkey::Pubkey>,
    token_program: Option<solana_program::pubkey::Pubkey>,
    associated_token_program: Option<solana_program::pubkey::Pubkey>,
    quantity: Option<u64>,
    __remaining_accounts: Vec<solana_program::instruction::AccountMeta>,
}

impl DepositFundsBuilder {
    pub fn new() -> Self {
        Self::default()
    }
    #[inline(always)]
    pub fn token_manager(&mut self, token_manager: solana_program::pubkey::Pubkey) -> &mut Self {
        self.token_manager = Some(token_manager);
        self
    }
    #[inline(always)]
    pub fn mint(&mut self, mint: solana_program::pubkey::Pubkey) -> &mut Self {
        self.mint = Some(mint);
        self
    }
    #[inline(always)]
    pub fn quote_mint(&mut self, quote_mint: solana_program::pubkey::Pubkey) -> &mut Self {
        self.quote_mint = Some(quote_mint);
        self
    }
    #[inline(always)]
    pub fn authority_quote_mint_ata(
        &mut self,
        authority_quote_mint_ata: solana_program::pubkey::Pubkey,
    ) -> &mut Self {
        self.authority_quote_mint_ata = Some(authority_quote_mint_ata);
        self
    }
    #[inline(always)]
    pub fn vault(&mut self, vault: solana_program::pubkey::Pubkey) -> &mut Self {
        self.vault = Some(vault);
        self
    }
    #[inline(always)]
    pub fn admin(&mut self, admin: solana_program::pubkey::Pubkey) -> &mut Self {
        self.admin = Some(admin);
        self
    }
    /// `[optional account, default to 'SysvarRent111111111111111111111111111111111']`
    #[inline(always)]
    pub fn rent(&mut self, rent: solana_program::pubkey::Pubkey) -> &mut Self {
        self.rent = Some(rent);
        self
    }
    /// `[optional account, default to '11111111111111111111111111111111']`
    #[inline(always)]
    pub fn system_program(&mut self, system_program: solana_program::pubkey::Pubkey) -> &mut Self {
        self.system_program = Some(system_program);
        self
    }
    /// `[optional account, default to 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA']`
    #[inline(always)]
    pub fn token_program(&mut self, token_program: solana_program::pubkey::Pubkey) -> &mut Self {
        self.token_program = Some(token_program);
        self
    }
    #[inline(always)]
    pub fn associated_token_program(
        &mut self,
        associated_token_program: solana_program::pubkey::Pubkey,
    ) -> &mut Self {
        self.associated_token_program = Some(associated_token_program);
        self
    }
    #[inline(always)]
    pub fn quantity(&mut self, quantity: u64) -> &mut Self {
        self.quantity = Some(quantity);
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
        let accounts = DepositFunds {
            token_manager: self.token_manager.expect("token_manager is not set"),
            mint: self.mint.expect("mint is not set"),
            quote_mint: self.quote_mint.expect("quote_mint is not set"),
            authority_quote_mint_ata: self
                .authority_quote_mint_ata
                .expect("authority_quote_mint_ata is not set"),
            vault: self.vault.expect("vault is not set"),
            admin: self.admin.expect("admin is not set"),
            rent: self.rent.unwrap_or(solana_program::pubkey!(
                "SysvarRent111111111111111111111111111111111"
            )),
            system_program: self
                .system_program
                .unwrap_or(solana_program::pubkey!("11111111111111111111111111111111")),
            token_program: self.token_program.unwrap_or(solana_program::pubkey!(
                "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
            )),
            associated_token_program: self
                .associated_token_program
                .expect("associated_token_program is not set"),
        };
        let args = DepositFundsInstructionArgs {
            quantity: self.quantity.clone().expect("quantity is not set"),
        };

        accounts.instruction_with_remaining_accounts(args, &self.__remaining_accounts)
    }
}

/// `deposit_funds` CPI accounts.
pub struct DepositFundsCpiAccounts<'a, 'b> {
    pub token_manager: &'b solana_program::account_info::AccountInfo<'a>,

    pub mint: &'b solana_program::account_info::AccountInfo<'a>,

    pub quote_mint: &'b solana_program::account_info::AccountInfo<'a>,

    pub authority_quote_mint_ata: &'b solana_program::account_info::AccountInfo<'a>,

    pub vault: &'b solana_program::account_info::AccountInfo<'a>,

    pub admin: &'b solana_program::account_info::AccountInfo<'a>,

    pub rent: &'b solana_program::account_info::AccountInfo<'a>,

    pub system_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub token_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub associated_token_program: &'b solana_program::account_info::AccountInfo<'a>,
}

/// `deposit_funds` CPI instruction.
pub struct DepositFundsCpi<'a, 'b> {
    /// The program to invoke.
    pub __program: &'b solana_program::account_info::AccountInfo<'a>,

    pub token_manager: &'b solana_program::account_info::AccountInfo<'a>,

    pub mint: &'b solana_program::account_info::AccountInfo<'a>,

    pub quote_mint: &'b solana_program::account_info::AccountInfo<'a>,

    pub authority_quote_mint_ata: &'b solana_program::account_info::AccountInfo<'a>,

    pub vault: &'b solana_program::account_info::AccountInfo<'a>,

    pub admin: &'b solana_program::account_info::AccountInfo<'a>,

    pub rent: &'b solana_program::account_info::AccountInfo<'a>,

    pub system_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub token_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub associated_token_program: &'b solana_program::account_info::AccountInfo<'a>,
    /// The arguments for the instruction.
    pub __args: DepositFundsInstructionArgs,
}

impl<'a, 'b> DepositFundsCpi<'a, 'b> {
    pub fn new(
        program: &'b solana_program::account_info::AccountInfo<'a>,
        accounts: DepositFundsCpiAccounts<'a, 'b>,
        args: DepositFundsInstructionArgs,
    ) -> Self {
        Self {
            __program: program,
            token_manager: accounts.token_manager,
            mint: accounts.mint,
            quote_mint: accounts.quote_mint,
            authority_quote_mint_ata: accounts.authority_quote_mint_ata,
            vault: accounts.vault,
            admin: accounts.admin,
            rent: accounts.rent,
            system_program: accounts.system_program,
            token_program: accounts.token_program,
            associated_token_program: accounts.associated_token_program,
            __args: args,
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
        let mut accounts = Vec::with_capacity(10 + remaining_accounts.len());
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.token_manager.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.mint.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.quote_mint.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.authority_quote_mint_ata.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.vault.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.admin.key,
            true,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.rent.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.system_program.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.token_program.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.associated_token_program.key,
            false,
        ));
        remaining_accounts.iter().for_each(|remaining_account| {
            accounts.push(solana_program::instruction::AccountMeta {
                pubkey: *remaining_account.0.key,
                is_signer: remaining_account.1,
                is_writable: remaining_account.2,
            })
        });
        let mut data = DepositFundsInstructionData::new().try_to_vec().unwrap();
        let mut args = self.__args.try_to_vec().unwrap();
        data.append(&mut args);

        let instruction = solana_program::instruction::Instruction {
            program_id: crate::PARITY_ISSUANCE_ID,
            accounts,
            data,
        };
        let mut account_infos = Vec::with_capacity(10 + 1 + remaining_accounts.len());
        account_infos.push(self.__program.clone());
        account_infos.push(self.token_manager.clone());
        account_infos.push(self.mint.clone());
        account_infos.push(self.quote_mint.clone());
        account_infos.push(self.authority_quote_mint_ata.clone());
        account_infos.push(self.vault.clone());
        account_infos.push(self.admin.clone());
        account_infos.push(self.rent.clone());
        account_infos.push(self.system_program.clone());
        account_infos.push(self.token_program.clone());
        account_infos.push(self.associated_token_program.clone());
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

/// Instruction builder for `DepositFunds` via CPI.
///
/// ### Accounts:
///
///   0. `[writable]` token_manager
///   1. `[]` mint
///   2. `[]` quote_mint
///   3. `[writable]` authority_quote_mint_ata
///   4. `[writable]` vault
///   5. `[writable, signer]` admin
///   6. `[]` rent
///   7. `[]` system_program
///   8. `[]` token_program
///   9. `[]` associated_token_program
pub struct DepositFundsCpiBuilder<'a, 'b> {
    instruction: Box<DepositFundsCpiBuilderInstruction<'a, 'b>>,
}

impl<'a, 'b> DepositFundsCpiBuilder<'a, 'b> {
    pub fn new(program: &'b solana_program::account_info::AccountInfo<'a>) -> Self {
        let instruction = Box::new(DepositFundsCpiBuilderInstruction {
            __program: program,
            token_manager: None,
            mint: None,
            quote_mint: None,
            authority_quote_mint_ata: None,
            vault: None,
            admin: None,
            rent: None,
            system_program: None,
            token_program: None,
            associated_token_program: None,
            quantity: None,
            __remaining_accounts: Vec::new(),
        });
        Self { instruction }
    }
    #[inline(always)]
    pub fn token_manager(
        &mut self,
        token_manager: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.token_manager = Some(token_manager);
        self
    }
    #[inline(always)]
    pub fn mint(&mut self, mint: &'b solana_program::account_info::AccountInfo<'a>) -> &mut Self {
        self.instruction.mint = Some(mint);
        self
    }
    #[inline(always)]
    pub fn quote_mint(
        &mut self,
        quote_mint: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.quote_mint = Some(quote_mint);
        self
    }
    #[inline(always)]
    pub fn authority_quote_mint_ata(
        &mut self,
        authority_quote_mint_ata: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.authority_quote_mint_ata = Some(authority_quote_mint_ata);
        self
    }
    #[inline(always)]
    pub fn vault(&mut self, vault: &'b solana_program::account_info::AccountInfo<'a>) -> &mut Self {
        self.instruction.vault = Some(vault);
        self
    }
    #[inline(always)]
    pub fn admin(&mut self, admin: &'b solana_program::account_info::AccountInfo<'a>) -> &mut Self {
        self.instruction.admin = Some(admin);
        self
    }
    #[inline(always)]
    pub fn rent(&mut self, rent: &'b solana_program::account_info::AccountInfo<'a>) -> &mut Self {
        self.instruction.rent = Some(rent);
        self
    }
    #[inline(always)]
    pub fn system_program(
        &mut self,
        system_program: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.system_program = Some(system_program);
        self
    }
    #[inline(always)]
    pub fn token_program(
        &mut self,
        token_program: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.token_program = Some(token_program);
        self
    }
    #[inline(always)]
    pub fn associated_token_program(
        &mut self,
        associated_token_program: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.associated_token_program = Some(associated_token_program);
        self
    }
    #[inline(always)]
    pub fn quantity(&mut self, quantity: u64) -> &mut Self {
        self.instruction.quantity = Some(quantity);
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
        let args = DepositFundsInstructionArgs {
            quantity: self
                .instruction
                .quantity
                .clone()
                .expect("quantity is not set"),
        };
        let instruction = DepositFundsCpi {
            __program: self.instruction.__program,

            token_manager: self
                .instruction
                .token_manager
                .expect("token_manager is not set"),

            mint: self.instruction.mint.expect("mint is not set"),

            quote_mint: self.instruction.quote_mint.expect("quote_mint is not set"),

            authority_quote_mint_ata: self
                .instruction
                .authority_quote_mint_ata
                .expect("authority_quote_mint_ata is not set"),

            vault: self.instruction.vault.expect("vault is not set"),

            admin: self.instruction.admin.expect("admin is not set"),

            rent: self.instruction.rent.expect("rent is not set"),

            system_program: self
                .instruction
                .system_program
                .expect("system_program is not set"),

            token_program: self
                .instruction
                .token_program
                .expect("token_program is not set"),

            associated_token_program: self
                .instruction
                .associated_token_program
                .expect("associated_token_program is not set"),
            __args: args,
        };
        instruction.invoke_signed_with_remaining_accounts(
            signers_seeds,
            &self.instruction.__remaining_accounts,
        )
    }
}

struct DepositFundsCpiBuilderInstruction<'a, 'b> {
    __program: &'b solana_program::account_info::AccountInfo<'a>,
    token_manager: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    mint: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    quote_mint: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    authority_quote_mint_ata: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    vault: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    admin: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    rent: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    system_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    token_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    associated_token_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    quantity: Option<u64>,
    /// Additional instruction accounts `(AccountInfo, is_writable, is_signer)`.
    __remaining_accounts: Vec<(
        &'b solana_program::account_info::AccountInfo<'a>,
        bool,
        bool,
    )>,
}
