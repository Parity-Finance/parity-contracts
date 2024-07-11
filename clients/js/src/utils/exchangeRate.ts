const secondsPerYear = 365 * 24 * 60 * 60;
const PRECISION = 1_000_000_000_000;

export function calculateExchangeRate(
    lastYieldChangeTimestamp: number,
    currentTimestamp: number,
    intervalRate: number,
    lastYieldChangeExchangeRate: number,
    intervalSeconds: number
): number {
    if (currentTimestamp === lastYieldChangeTimestamp) {
        return lastYieldChangeExchangeRate;
    }

    const elapsedTime = currentTimestamp - lastYieldChangeTimestamp;
    const intervalAmounts = Math.floor(elapsedTime / intervalSeconds);
    const remainingSeconds = elapsedTime % intervalSeconds;

    // Calculate the compounded rate by inverting the growth effect
    const compoundedRate = (intervalRate / PRECISION) ** intervalAmounts;

    const linearRate = (intervalRate / PRECISION) * remainingSeconds / intervalSeconds

    const totalRate = compoundedRate + linearRate

    const exchangeRate = lastYieldChangeExchangeRate * totalRate

    // Use Math.floor to ensure the exchange rate is an integer if necessary
    const finalExchangeRate = Math.floor(exchangeRate);
    return finalExchangeRate;
}

export const calculateIntervalRate = (annualYieldBps: number, intervalSeconds: number): bigint => {
    const annualYield = annualYieldBps / 10000;
    const intervalsPerYear = secondsPerYear / intervalSeconds;
    const intervalRate = (1 + annualYield) ** (1 / intervalsPerYear);
    const preciseRate = Math.floor(intervalRate * PRECISION);
    return BigInt(preciseRate);
};