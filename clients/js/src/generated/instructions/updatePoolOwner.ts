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
export type UpdatePoolOwnerInstructionAccounts = {
  poolManager: PublicKey | Pda;
  newOwner: Signer;
};

// Data.
export type UpdatePoolOwnerInstructionData = { discriminator: Array<number> };

export type UpdatePoolOwnerInstructionDataArgs = {};

export function getUpdatePoolOwnerInstructionDataSerializer(): Serializer<
  UpdatePoolOwnerInstructionDataArgs,
  UpdatePoolOwnerInstructionData
> {
  return mapSerializer<
    UpdatePoolOwnerInstructionDataArgs,
    any,
    UpdatePoolOwnerInstructionData
  >(
    struct<UpdatePoolOwnerInstructionData>(
      [['discriminator', array(u8(), { size: 8 })]],
      { description: 'UpdatePoolOwnerInstructionData' }
    ),
    (value) => ({
      ...value,
      discriminator: [111, 245, 139, 189, 40, 173, 111, 123],
    })
  ) as Serializer<
    UpdatePoolOwnerInstructionDataArgs,
    UpdatePoolOwnerInstructionData
  >;
}

// Instruction.
export function updatePoolOwner(
  context: Pick<Context, 'programs'>,
  input: UpdatePoolOwnerInstructionAccounts
): TransactionBuilder {
  // Program ID.
  const programId = context.programs.getPublicKey(
    'soldStaking',
    'B6rAjGxw89UQCho4fLBGcEne9jadXv2QewPgpQ1SmUnw'
  );

  // Accounts.
  const resolvedAccounts = {
    poolManager: {
      index: 0,
      isWritable: true as boolean,
      value: input.poolManager ?? null,
    },
    newOwner: {
      index: 1,
      isWritable: false as boolean,
      value: input.newOwner ?? null,
    },
  } satisfies ResolvedAccountsWithIndices;

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
  const data = getUpdatePoolOwnerInstructionDataSerializer().serialize({});

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return transactionBuilder([
    { instruction: { keys, programId, data }, signers, bytesCreatedOnChain },
  ]);
}
