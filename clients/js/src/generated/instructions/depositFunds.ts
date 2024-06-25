/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import {
  Context,
  Pda,
  PublicKey,
  Signer,
  TransactionBuilder,
  publicKey,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import {
  Serializer,
  array,
  mapSerializer,
  struct,
  u64,
  u8,
} from '@metaplex-foundation/umi/serializers';
import {
  ResolvedAccount,
  ResolvedAccountsWithIndices,
  getAccountMetasAndSigners,
} from '../shared';

// Accounts.
export type DepositFundsInstructionAccounts = {
  tokenManager: PublicKey | Pda;
  quoteMint: PublicKey | Pda;
  authorityQuoteMintAta: PublicKey | Pda;
  vault: PublicKey | Pda;
  admin: Signer;
  rent?: PublicKey | Pda;
  systemProgram?: PublicKey | Pda;
  tokenProgram?: PublicKey | Pda;
  associatedTokenProgram: PublicKey | Pda;
};

// Data.
export type DepositFundsInstructionData = {
  discriminator: Array<number>;
  quantity: bigint;
};

export type DepositFundsInstructionDataArgs = { quantity: number | bigint };

export function getDepositFundsInstructionDataSerializer(): Serializer<
  DepositFundsInstructionDataArgs,
  DepositFundsInstructionData
> {
  return mapSerializer<
    DepositFundsInstructionDataArgs,
    any,
    DepositFundsInstructionData
  >(
    struct<DepositFundsInstructionData>(
      [
        ['discriminator', array(u8(), { size: 8 })],
        ['quantity', u64()],
      ],
      { description: 'DepositFundsInstructionData' }
    ),
    (value) => ({
      ...value,
      discriminator: [202, 39, 52, 211, 53, 20, 250, 88],
    })
  ) as Serializer<DepositFundsInstructionDataArgs, DepositFundsInstructionData>;
}

// Args.
export type DepositFundsInstructionArgs = DepositFundsInstructionDataArgs;

// Instruction.
export function depositFunds(
  context: Pick<Context, 'programs'>,
  input: DepositFundsInstructionAccounts & DepositFundsInstructionArgs
): TransactionBuilder {
  // Program ID.
  const programId = context.programs.getPublicKey(
    'soldIssuance',
    '6JfYz5itjCP6jjaxqX8KQizXYcRtzmSsHJdbiLBeqvEH'
  );

  // Accounts.
  const resolvedAccounts = {
    tokenManager: {
      index: 0,
      isWritable: true as boolean,
      value: input.tokenManager ?? null,
    },
    quoteMint: {
      index: 1,
      isWritable: false as boolean,
      value: input.quoteMint ?? null,
    },
    authorityQuoteMintAta: {
      index: 2,
      isWritable: true as boolean,
      value: input.authorityQuoteMintAta ?? null,
    },
    vault: {
      index: 3,
      isWritable: true as boolean,
      value: input.vault ?? null,
    },
    admin: {
      index: 4,
      isWritable: true as boolean,
      value: input.admin ?? null,
    },
    rent: { index: 5, isWritable: false as boolean, value: input.rent ?? null },
    systemProgram: {
      index: 6,
      isWritable: false as boolean,
      value: input.systemProgram ?? null,
    },
    tokenProgram: {
      index: 7,
      isWritable: false as boolean,
      value: input.tokenProgram ?? null,
    },
    associatedTokenProgram: {
      index: 8,
      isWritable: false as boolean,
      value: input.associatedTokenProgram ?? null,
    },
  } satisfies ResolvedAccountsWithIndices;

  // Arguments.
  const resolvedArgs: DepositFundsInstructionArgs = { ...input };

  // Default values.
  if (!resolvedAccounts.rent.value) {
    resolvedAccounts.rent.value = publicKey(
      'SysvarRent111111111111111111111111111111111'
    );
  }
  if (!resolvedAccounts.systemProgram.value) {
    resolvedAccounts.systemProgram.value = context.programs.getPublicKey(
      'splSystem',
      '11111111111111111111111111111111'
    );
    resolvedAccounts.systemProgram.isWritable = false;
  }
  if (!resolvedAccounts.tokenProgram.value) {
    resolvedAccounts.tokenProgram.value = context.programs.getPublicKey(
      'splToken',
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
    );
    resolvedAccounts.tokenProgram.isWritable = false;
  }

  // Accounts in order.
  const orderedAccounts: ResolvedAccount[] = Object.values(
    resolvedAccounts
  ).sort((a, b) => a.index - b.index);

  // Keys and Signers.
  const [keys, signers] = getAccountMetasAndSigners(
    orderedAccounts,
    'programId',
    programId
  );

  // Data.
  const data = getDepositFundsInstructionDataSerializer().serialize(
    resolvedArgs as DepositFundsInstructionDataArgs
  );

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return transactionBuilder([
    { instruction: { keys, programId, data }, signers, bytesCreatedOnChain },
  ]);
}
