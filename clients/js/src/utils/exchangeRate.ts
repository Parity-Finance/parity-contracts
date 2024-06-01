export function calculateExchangeRate(
    inceptionTimestamp: number,
    currentTimestamp: number,
    annualYieldRate: number, // Basis points
    initialExchangeRate: number,
    secondsPerYear: number = 31536000 // 60 * 60 * 24 * 365
): number {
    if (currentTimestamp === inceptionTimestamp) {
        return initialExchangeRate;
    }

    const elapsedTime = currentTimestamp - inceptionTimestamp;
    const yearsElapsed = elapsedTime / secondsPerYear;

    const rate = annualYieldRate / 10000;

    // Calculate the compounded rate by inverting the growth effect
    const compoundedRate = initialExchangeRate / ((1 + rate) ** yearsElapsed);

    // Use Math.floor to ensure the exchange rate is an integer if necessary
    const finalExchangeRate = Math.floor(compoundedRate);
    return finalExchangeRate;
}