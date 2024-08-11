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
  transactionBuilder,
} from '@metaplex-foundation/umi';
import {
  Serializer,
  array,
  bool,
  mapSerializer,
  struct,
  u8,
} from '@metaplex-foundation/umi/serializers';
import {
  ResolvedAccount,
  ResolvedAccountsWithIndices,
  getAccountMetasAndSigners,
} from '../shared';

// Accounts.
export type ToggleActiveInstructionAccounts = {
  tokenManager: PublicKey | Pda;
  authority?: Signer;
  gatekeeper?: PublicKey | Pda;
};

// Data.
export type ToggleActiveInstructionData = {
  discriminator: Array<number>;
  active: boolean;
};

export type ToggleActiveInstructionDataArgs = { active: boolean };

export function getToggleActiveInstructionDataSerializer(): Serializer<
  ToggleActiveInstructionDataArgs,
  ToggleActiveInstructionData
> {
  return mapSerializer<
    ToggleActiveInstructionDataArgs,
    any,
    ToggleActiveInstructionData
  >(
    struct<ToggleActiveInstructionData>(
      [
        ['discriminator', array(u8(), { size: 8 })],
        ['active', bool()],
      ],
      { description: 'ToggleActiveInstructionData' }
    ),
    (value) => ({
      ...value,
      discriminator: [51, 157, 191, 23, 239, 202, 160, 93],
    })
  ) as Serializer<ToggleActiveInstructionDataArgs, ToggleActiveInstructionData>;
}

// Args.
export type ToggleActiveInstructionArgs = ToggleActiveInstructionDataArgs;

// Instruction.
export function toggleActive(
  context: Pick<Context, 'identity' | 'programs'>,
  input: ToggleActiveInstructionAccounts & ToggleActiveInstructionArgs
): TransactionBuilder {
  // Program ID.
  const programId = context.programs.getPublicKey(
    'parityIssuance',
    '2EWh1kTyMUgv46FdwJYJP61LXvrhLp5CqDfy5gDoqggf'
  );

  // Accounts.
  const resolvedAccounts = {
    tokenManager: {
      index: 0,
      isWritable: true as boolean,
      value: input.tokenManager ?? null,
    },
    authority: {
      index: 1,
      isWritable: false as boolean,
      value: input.authority ?? null,
    },
    gatekeeper: {
      index: 2,
      isWritable: false as boolean,
      value: input.gatekeeper ?? null,
    },
  } satisfies ResolvedAccountsWithIndices;

  // Arguments.
  const resolvedArgs: ToggleActiveInstructionArgs = { ...input };

  // Default values.
  if (!resolvedAccounts.authority.value) {
    resolvedAccounts.authority.value = context.identity;
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
  const data = getToggleActiveInstructionDataSerializer().serialize(
    resolvedArgs as ToggleActiveInstructionDataArgs
  );

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return transactionBuilder([
    { instruction: { keys, programId, data }, signers, bytesCreatedOnChain },
  ]);
}
