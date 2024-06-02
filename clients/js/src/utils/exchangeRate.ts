export function calculateExchangeRate(
    lastYieldChangeTimestamp: number,
    currentTimestamp: number,
    annualYieldRate: number, // Basis points
    lastYieldChangeExchangeRate: number,
    secondsPerYear: number = 31536000 // 60 * 60 * 24 * 365
): number {
    if (currentTimestamp === lastYieldChangeTimestamp) {
        return lastYieldChangeExchangeRate;
    }

    const elapsedTime = currentTimestamp - lastYieldChangeTimestamp;
    const yearsElapsed = elapsedTime / secondsPerYear;

    const rate = annualYieldRate / 10000;

    // Calculate the compounded rate by inverting the growth effect
    const compoundedRate = lastYieldChangeExchangeRate / ((1 + rate) ** yearsElapsed);

    // Use Math.floor to ensure the exchange rate is an integer if necessary
    const finalExchangeRate = Math.floor(compoundedRate);
    return finalExchangeRate;
}