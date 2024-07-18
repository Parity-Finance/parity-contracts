export function calculateMaxWithdrawableAmount(
    mintSupply: bigint,
    exchangeRate: bigint,
    mintDecimals: number,
    quoteMintDecimals: number,
    emergencyFundBasisPoints: number,
    totalCollateral: bigint
): bigint {
    const requiredCollateral = mintSupply * exchangeRate / BigInt(10 ** mintDecimals);
    const minRequiredCollateral = requiredCollateral * BigInt(emergencyFundBasisPoints) / BigInt(10000) * BigInt(10 ** quoteMintDecimals) / BigInt(10 ** mintDecimals);
    return totalCollateral - minRequiredCollateral;
}