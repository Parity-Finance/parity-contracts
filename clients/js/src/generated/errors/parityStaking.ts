/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import { Program, ProgramError } from '@metaplex-foundation/umi';

type ProgramErrorConstructor = new (
  program: Program,
  cause?: Error
) => ProgramError;
const codeToErrorMap: Map<number, ProgramErrorConstructor> = new Map();
const nameToErrorMap: Map<string, ProgramErrorConstructor> = new Map();

/** InvalidXMintAddress: Invalid x mint address */
export class SsInvalidXMintAddressError extends ProgramError {
  override readonly name: string = 'InvalidXMintAddress';

  readonly code: number = 0x1770; // 6000

  constructor(program: Program, cause?: Error) {
    super('Invalid x mint address', program, cause);
  }
}
codeToErrorMap.set(0x1770, SsInvalidXMintAddressError);
nameToErrorMap.set('InvalidXMintAddress', SsInvalidXMintAddressError);

/** CalculationOverflow: Calculation overflow */
export class SsCalculationOverflowError extends ProgramError {
  override readonly name: string = 'CalculationOverflow';

  readonly code: number = 0x1771; // 6001

  constructor(program: Program, cause?: Error) {
    super('Calculation overflow', program, cause);
  }
}
codeToErrorMap.set(0x1771, SsCalculationOverflowError);
nameToErrorMap.set('CalculationOverflow', SsCalculationOverflowError);

/** InvalidAdmin: Invalid admin */
export class SsInvalidAdminError extends ProgramError {
  override readonly name: string = 'InvalidAdmin';

  readonly code: number = 0x1772; // 6002

  constructor(program: Program, cause?: Error) {
    super('Invalid admin', program, cause);
  }
}
codeToErrorMap.set(0x1772, SsInvalidAdminError);
nameToErrorMap.set('InvalidAdmin', SsInvalidAdminError);

/** InvalidOwner: Invalid owner */
export class SsInvalidOwnerError extends ProgramError {
  override readonly name: string = 'InvalidOwner';

  readonly code: number = 0x1773; // 6003

  constructor(program: Program, cause?: Error) {
    super('Invalid owner', program, cause);
  }
}
codeToErrorMap.set(0x1773, SsInvalidOwnerError);
nameToErrorMap.set('InvalidOwner', SsInvalidOwnerError);

/** InvalidYieldRate: Invalid yield rate */
export class SsInvalidYieldRateError extends ProgramError {
  override readonly name: string = 'InvalidYieldRate';

  readonly code: number = 0x1774; // 6004

  constructor(program: Program, cause?: Error) {
    super('Invalid yield rate', program, cause);
  }
}
codeToErrorMap.set(0x1774, SsInvalidYieldRateError);
nameToErrorMap.set('InvalidYieldRate', SsInvalidYieldRateError);

/** DepositCapExceeded: Deposit cap exceeded */
export class SsDepositCapExceededError extends ProgramError {
  override readonly name: string = 'DepositCapExceeded';

  readonly code: number = 0x1775; // 6005

  constructor(program: Program, cause?: Error) {
    super('Deposit cap exceeded', program, cause);
  }
}
codeToErrorMap.set(0x1775, SsDepositCapExceededError);
nameToErrorMap.set('DepositCapExceeded', SsDepositCapExceededError);

/** DepositCapTooLow: Deposit cap less than the previous */
export class SsDepositCapTooLowError extends ProgramError {
  override readonly name: string = 'DepositCapTooLow';

  readonly code: number = 0x1776; // 6006

  constructor(program: Program, cause?: Error) {
    super('Deposit cap less than the previous', program, cause);
  }
}
codeToErrorMap.set(0x1776, SsDepositCapTooLowError);
nameToErrorMap.set('DepositCapTooLow', SsDepositCapTooLowError);

/** InvalidQuantity: Invalid Quantity */
export class SsInvalidQuantityError extends ProgramError {
  override readonly name: string = 'InvalidQuantity';

  readonly code: number = 0x1777; // 6007

  constructor(program: Program, cause?: Error) {
    super('Invalid Quantity', program, cause);
  }
}
codeToErrorMap.set(0x1777, SsInvalidQuantityError);
nameToErrorMap.set('InvalidQuantity', SsInvalidQuantityError);

/** OwnerAlreadySet: Owner Already Set */
export class SsOwnerAlreadySetError extends ProgramError {
  override readonly name: string = 'OwnerAlreadySet';

  readonly code: number = 0x1778; // 6008

  constructor(program: Program, cause?: Error) {
    super('Owner Already Set', program, cause);
  }
}
codeToErrorMap.set(0x1778, SsOwnerAlreadySetError);
nameToErrorMap.set('OwnerAlreadySet', SsOwnerAlreadySetError);

/** InvalidParam: An Invalid Parameter was passed */
export class SsInvalidParamError extends ProgramError {
  override readonly name: string = 'InvalidParam';

  readonly code: number = 0x1779; // 6009

  constructor(program: Program, cause?: Error) {
    super('An Invalid Parameter was passed', program, cause);
  }
}
codeToErrorMap.set(0x1779, SsInvalidParamError);
nameToErrorMap.set('InvalidParam', SsInvalidParamError);

/**
 * Attempts to resolve a custom program error from the provided error code.
 * @category Errors
 */
export function getParityStakingErrorFromCode(
  code: number,
  program: Program,
  cause?: Error
): ProgramError | null {
  const constructor = codeToErrorMap.get(code);
  return constructor ? new constructor(program, cause) : null;
}

/**
 * Attempts to resolve a custom program error from the provided error name, i.e. 'Unauthorized'.
 * @category Errors
 */
export function getParityStakingErrorFromName(
  name: string,
  program: Program,
  cause?: Error
): ProgramError | null {
  const constructor = nameToErrorMap.get(name);
  return constructor ? new constructor(program, cause) : null;
}
