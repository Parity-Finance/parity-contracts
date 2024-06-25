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
  u64,
  u8,
} from '@metaplex-foundation/umi/serializers';
import {
  ResolvedAccount,
  ResolvedAccountsWithIndices,
  getAccountMetasAndSigners,
} from '../shared';

// Accounts.
export type MintAdminInstructionAccounts = {
  tokenManager: PublicKey | Pda;
  mint: PublicKey | Pda;
  minterMintAta: PublicKey | Pda;
  minter: Signer;
  systemProgram?: PublicKey | Pda;
  tokenProgram?: PublicKey | Pda;
  associatedTokenProgram: PublicKey | Pda;
};

// Data.
export type MintAdminInstructionData = {
  discriminator: Array<number>;
  quantity: bigint;
};

export type MintAdminInstructionDataArgs = { quantity: number | bigint };

export function getMintAdminInstructionDataSerializer(): Serializer<
  MintAdminInstructionDataArgs,
  MintAdminInstructionData
> {
  return mapSerializer<
    MintAdminInstructionDataArgs,
    any,
    MintAdminInstructionData
  >(
    struct<MintAdminInstructionData>(
      [
        ['discriminator', array(u8(), { size: 8 })],
        ['quantity', u64()],
      ],
      { description: 'MintAdminInstructionData' }
    ),
    (value) => ({
      ...value,
      discriminator: [230, 227, 6, 187, 107, 91, 106, 21],
    })
  ) as Serializer<MintAdminInstructionDataArgs, MintAdminInstructionData>;
}

// Args.
export type MintAdminInstructionArgs = MintAdminInstructionDataArgs;

// Instruction.
export function mintAdmin(
  context: Pick<Context, 'programs'>,
  input: MintAdminInstructionAccounts & MintAdminInstructionArgs
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
    mint: { index: 1, isWritable: true as boolean, value: input.mint ?? null },
    minterMintAta: {
      index: 2,
      isWritable: true as boolean,
      value: input.minterMintAta ?? null,
    },
    minter: {
      index: 3,
      isWritable: false as boolean,
      value: input.minter ?? null,
    },
    systemProgram: {
      index: 4,
      isWritable: false as boolean,
      value: input.systemProgram ?? null,
    },
    tokenProgram: {
      index: 5,
      isWritable: false as boolean,
      value: input.tokenProgram ?? null,
    },
    associatedTokenProgram: {
      index: 6,
      isWritable: false as boolean,
      value: input.associatedTokenProgram ?? null,
    },
  } satisfies ResolvedAccountsWithIndices;

  // Arguments.
  const resolvedArgs: MintAdminInstructionArgs = { ...input };

  // Default values.
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
  const data = getMintAdminInstructionDataSerializer().serialize(
    resolvedArgs as MintAdminInstructionDataArgs
  );

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return transactionBuilder([
    { instruction: { keys, programId, data }, signers, bytesCreatedOnChain },
  ]);
}
