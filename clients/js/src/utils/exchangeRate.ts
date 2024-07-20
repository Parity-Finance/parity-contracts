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

    // Calculate the compounded rate
    const compoundedRate = (intervalRate / PRECISION) ** intervalAmounts;

    // Calculate the linear yield for the remaining seconds
    const linearYield = ((intervalRate - PRECISION) * remainingSeconds) / intervalSeconds;

    // Add the linear yield to the compounded rate
    const totalRate = compoundedRate * PRECISION + linearYield;

    // Multiply the current exchange rate with the total rate
    const newExchangeRate = (lastYieldChangeExchangeRate * totalRate) / PRECISION;

    // Ensure the exchange rate is in absolute numbers with 6 decimal places
    const finalExchangeRate = Math.floor(newExchangeRate);

    return finalExchangeRate;
}

// Test
// const exchangeRatee = calculateExchangeRate(0, secondsPerYear / 2, 1000166517567, 1000000, 8 * 60 * 60)
// console.log(exchangeRatee);

/**
 * This function calculates the interval rate based on the annual yield and the interval duration in seconds.
 * 
 * @param {number} annualYieldBps - The annual yield in basis points (bps).
 * @param {number} intervalSeconds - The duration of each interval in seconds.
 * @returns {number} - The calculated interval rate, adjusted for precision.
 */
export const calculateIntervalRate = (annualYieldBps: number, intervalSeconds: number): number => {
    const annualYield = annualYieldBps / 10000;
    const intervalsPerYear = secondsPerYear / intervalSeconds;
    const intervalRate = (1 + annualYield) ** (1 / intervalsPerYear);
    const preciseRate = Math.floor(intervalRate * PRECISION);
    return preciseRate;
};

// Test
// const intervalRate = calculateIntervalRate(2000, 8 * 60 * 60)
// console.log(intervalRate);

/**
 * This function calculates the annual yield in basis points (bps) based on the interval rate and the interval duration in seconds.
 * 
 * @param {number} intervalRate - The interval rate, adjusted for precision.
 * @param {number} intervalSeconds - The duration of each interval in seconds.
 * @returns {number} - The calculated annual yield in basis points (bps).
 */
export const calculateAnnualYieldBps = (
    intervalRateParam: number,
    intervalSeconds: number
): number => {
    const preciseRate = intervalRateParam / PRECISION;
    const intervalsPerYear = secondsPerYear / intervalSeconds;
    const annualYield = (preciseRate ** intervalsPerYear) - 1;
    const annualYieldBps = annualYield * 10000;
    return Math.ceil(annualYieldBps); // Changed from Math.floor to Math.ceil
};

// const annualYieldBps = calculateAnnualYieldBps(1000166517567, 8 * 60 * 60)
// console.log(annualYieldBps);