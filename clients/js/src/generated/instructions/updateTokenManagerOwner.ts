/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import {
  Context,
  Option,
  OptionOrNullable,
  Pda,
  PublicKey,
  Signer,
  TransactionBuilder,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import {
  Serializer,
  array,
  i64,
  mapSerializer,
  option,
  publicKey as publicKeySerializer,
  struct,
  u16,
  u8,
} from '@metaplex-foundation/umi/serializers';
import {
  ResolvedAccount,
  ResolvedAccountsWithIndices,
  getAccountMetasAndSigners,
} from '../shared';

// Accounts.
export type UpdateTokenManagerOwnerInstructionAccounts = {
  tokenManager: PublicKey | Pda;
  owner: Signer;
};

// Data.
export type UpdateTokenManagerOwnerInstructionData = {
  discriminator: Array<number>;
  newAdmin: Option<PublicKey>;
  newMinter: Option<PublicKey>;
  emergencyFundBasisPoints: Option<number>;
  newWithdrawTimeLock: Option<bigint>;
  newWithdrawExecutionWindow: Option<bigint>;
  newMintFeeBps: Option<number>;
  newRedeemFeeBps: Option<number>;
};

export type UpdateTokenManagerOwnerInstructionDataArgs = {
  newAdmin: OptionOrNullable<PublicKey>;
  newMinter: OptionOrNullable<PublicKey>;
  emergencyFundBasisPoints: OptionOrNullable<number>;
  newWithdrawTimeLock: OptionOrNullable<number | bigint>;
  newWithdrawExecutionWindow: OptionOrNullable<number | bigint>;
  newMintFeeBps: OptionOrNullable<number>;
  newRedeemFeeBps: OptionOrNullable<number>;
};

export function getUpdateTokenManagerOwnerInstructionDataSerializer(): Serializer<
  UpdateTokenManagerOwnerInstructionDataArgs,
  UpdateTokenManagerOwnerInstructionData
> {
  return mapSerializer<
    UpdateTokenManagerOwnerInstructionDataArgs,
    any,
    UpdateTokenManagerOwnerInstructionData
  >(
    struct<UpdateTokenManagerOwnerInstructionData>(
      [
        ['discriminator', array(u8(), { size: 8 })],
        ['newAdmin', option(publicKeySerializer())],
        ['newMinter', option(publicKeySerializer())],
        ['emergencyFundBasisPoints', option(u16())],
        ['newWithdrawTimeLock', option(i64())],
        ['newWithdrawExecutionWindow', option(i64())],
        ['newMintFeeBps', option(u16())],
        ['newRedeemFeeBps', option(u16())],
      ],
      { description: 'UpdateTokenManagerOwnerInstructionData' }
    ),
    (value) => ({
      ...value,
      discriminator: [31, 16, 91, 211, 211, 16, 93, 144],
    })
  ) as Serializer<
    UpdateTokenManagerOwnerInstructionDataArgs,
    UpdateTokenManagerOwnerInstructionData
  >;
}

// Args.
export type UpdateTokenManagerOwnerInstructionArgs =
  UpdateTokenManagerOwnerInstructionDataArgs;

// Instruction.
export function updateTokenManagerOwner(
  context: Pick<Context, 'programs'>,
  input: UpdateTokenManagerOwnerInstructionAccounts &
    UpdateTokenManagerOwnerInstructionArgs
): TransactionBuilder {
  // Program ID.
  const programId = context.programs.getPublicKey(
    'soldIssuance',
    'E52KjA58odp3taqmaCuBFdDya3s4TA1ho4tSXoW2igxb'
  );

  // Accounts.
  const resolvedAccounts = {
    tokenManager: {
      index: 0,
      isWritable: true as boolean,
      value: input.tokenManager ?? null,
    },
    owner: {
      index: 1,
      isWritable: false as boolean,
      value: input.owner ?? null,
    },
  } satisfies ResolvedAccountsWithIndices;

  // Arguments.
  const resolvedArgs: UpdateTokenManagerOwnerInstructionArgs = { ...input };

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
  const data = getUpdateTokenManagerOwnerInstructionDataSerializer().serialize(
    resolvedArgs as UpdateTokenManagerOwnerInstructionDataArgs
  );

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return transactionBuilder([
    { instruction: { keys, programId, data }, signers, bytesCreatedOnChain },
  ]);
}
