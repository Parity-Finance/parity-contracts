/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import {
  Account,
  Context,
  Pda,
  PublicKey,
  RpcAccount,
  RpcGetAccountOptions,
  RpcGetAccountsOptions,
  assertAccountExists,
  deserializeAccount,
  gpaBuilder,
  publicKey as toPublicKey,
} from '@metaplex-foundation/umi';
import {
  Serializer,
  array,
  bool,
  mapSerializer,
  publicKey as publicKeySerializer,
  string,
  struct,
  u64,
  u8,
} from '@metaplex-foundation/umi/serializers';

export type TokenManager = Account<TokenManagerAccountData>;

export type TokenManagerAccountData = {
  discriminator: Array<number>;
  tokenManager: PublicKey;
  mintRedeemAuthorities: Array<PublicKey>;
  depositWithdrawAuthorities: Array<PublicKey>;
  pauseAuthorities: Array<PublicKey>;
  mint: PublicKey;
  mintDecimals: number;
  quoteMint: PublicKey;
  totalSupply: bigint;
  active: boolean;
  bump: number;
};

export type TokenManagerAccountDataArgs = {
  tokenManager: PublicKey;
  mintRedeemAuthorities: Array<PublicKey>;
  depositWithdrawAuthorities: Array<PublicKey>;
  pauseAuthorities: Array<PublicKey>;
  mint: PublicKey;
  mintDecimals: number;
  quoteMint: PublicKey;
  totalSupply: number | bigint;
  active: boolean;
  bump: number;
};

export function getTokenManagerAccountDataSerializer(): Serializer<
  TokenManagerAccountDataArgs,
  TokenManagerAccountData
> {
  return mapSerializer<
    TokenManagerAccountDataArgs,
    any,
    TokenManagerAccountData
  >(
    struct<TokenManagerAccountData>(
      [
        ['discriminator', array(u8(), { size: 8 })],
        ['tokenManager', publicKeySerializer()],
        ['mintRedeemAuthorities', array(publicKeySerializer())],
        ['depositWithdrawAuthorities', array(publicKeySerializer())],
        ['pauseAuthorities', array(publicKeySerializer())],
        ['mint', publicKeySerializer()],
        ['mintDecimals', u8()],
        ['quoteMint', publicKeySerializer()],
        ['totalSupply', u64()],
        ['active', bool()],
        ['bump', u8()],
      ],
      { description: 'TokenManagerAccountData' }
    ),
    (value) => ({
      ...value,
      discriminator: [185, 97, 124, 231, 70, 75, 228, 47],
    })
  ) as Serializer<TokenManagerAccountDataArgs, TokenManagerAccountData>;
}

export function deserializeTokenManager(rawAccount: RpcAccount): TokenManager {
  return deserializeAccount(rawAccount, getTokenManagerAccountDataSerializer());
}

export async function fetchTokenManager(
  context: Pick<Context, 'rpc'>,
  publicKey: PublicKey | Pda,
  options?: RpcGetAccountOptions
): Promise<TokenManager> {
  const maybeAccount = await context.rpc.getAccount(
    toPublicKey(publicKey, false),
    options
  );
  assertAccountExists(maybeAccount, 'TokenManager');
  return deserializeTokenManager(maybeAccount);
}

export async function safeFetchTokenManager(
  context: Pick<Context, 'rpc'>,
  publicKey: PublicKey | Pda,
  options?: RpcGetAccountOptions
): Promise<TokenManager | null> {
  const maybeAccount = await context.rpc.getAccount(
    toPublicKey(publicKey, false),
    options
  );
  return maybeAccount.exists ? deserializeTokenManager(maybeAccount) : null;
}

export async function fetchAllTokenManager(
  context: Pick<Context, 'rpc'>,
  publicKeys: Array<PublicKey | Pda>,
  options?: RpcGetAccountsOptions
): Promise<TokenManager[]> {
  const maybeAccounts = await context.rpc.getAccounts(
    publicKeys.map((key) => toPublicKey(key, false)),
    options
  );
  return maybeAccounts.map((maybeAccount) => {
    assertAccountExists(maybeAccount, 'TokenManager');
    return deserializeTokenManager(maybeAccount);
  });
}

export async function safeFetchAllTokenManager(
  context: Pick<Context, 'rpc'>,
  publicKeys: Array<PublicKey | Pda>,
  options?: RpcGetAccountsOptions
): Promise<TokenManager[]> {
  const maybeAccounts = await context.rpc.getAccounts(
    publicKeys.map((key) => toPublicKey(key, false)),
    options
  );
  return maybeAccounts
    .filter((maybeAccount) => maybeAccount.exists)
    .map((maybeAccount) => deserializeTokenManager(maybeAccount as RpcAccount));
}

export function getTokenManagerGpaBuilder(
  context: Pick<Context, 'rpc' | 'programs'>
) {
  const programId = context.programs.getPublicKey(
    'soldIssuance',
    '3ja6s1Pb55nhzhwYp4GY77n972iEQtWX55xoRwP2asCT'
  );
  return gpaBuilder(context, programId)
    .registerFields<{
      discriminator: Array<number>;
      tokenManager: PublicKey;
      mintRedeemAuthorities: Array<PublicKey>;
      depositWithdrawAuthorities: Array<PublicKey>;
      pauseAuthorities: Array<PublicKey>;
      mint: PublicKey;
      mintDecimals: number;
      quoteMint: PublicKey;
      totalSupply: number | bigint;
      active: boolean;
      bump: number;
    }>({
      discriminator: [0, array(u8(), { size: 8 })],
      tokenManager: [8, publicKeySerializer()],
      mintRedeemAuthorities: [40, array(publicKeySerializer())],
      depositWithdrawAuthorities: [null, array(publicKeySerializer())],
      pauseAuthorities: [null, array(publicKeySerializer())],
      mint: [null, publicKeySerializer()],
      mintDecimals: [null, u8()],
      quoteMint: [null, publicKeySerializer()],
      totalSupply: [null, u64()],
      active: [null, bool()],
      bump: [null, u8()],
    })
    .deserializeUsing<TokenManager>((account) =>
      deserializeTokenManager(account)
    )
    .whereField('discriminator', [185, 97, 124, 231, 70, 75, 228, 47]);
}

export function findTokenManagerPda(
  context: Pick<Context, 'eddsa' | 'programs'>
): Pda {
  const programId = context.programs.getPublicKey(
    'soldIssuance',
    '3ja6s1Pb55nhzhwYp4GY77n972iEQtWX55xoRwP2asCT'
  );
  return context.eddsa.findPda(programId, [
    string({ size: 'variable' }).serialize('token_manager'),
  ]);
}

export async function fetchTokenManagerFromSeeds(
  context: Pick<Context, 'eddsa' | 'programs' | 'rpc'>,
  options?: RpcGetAccountOptions
): Promise<TokenManager> {
  return fetchTokenManager(context, findTokenManagerPda(context), options);
}

export async function safeFetchTokenManagerFromSeeds(
  context: Pick<Context, 'eddsa' | 'programs' | 'rpc'>,
  options?: RpcGetAccountOptions
): Promise<TokenManager | null> {
  return safeFetchTokenManager(context, findTokenManagerPda(context), options);
}
