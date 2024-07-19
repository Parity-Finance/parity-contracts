const scale = 1000000000000;

/**
 * Converts annual APY to interval APR rate.
 * @param {number} annualApy - The annual APY (e.g., 0.2 for 20%).
 * @param {number} secondsPerInterval - The number of seconds per interval.
 * @returns {number} - The interval APR rate.
 */
export function annualApyToIntervalAprRate(annualApy: number, secondsPerInterval: number): number {
    const intervalsPerYear = (365 * 24 * 60 * 60) / secondsPerInterval;
    const intervalAprRate = (1 + annualApy) ** (1 / intervalsPerYear) * scale;
    return Math.round(intervalAprRate);
}

/**
 * Converts interval APR rate to annual APY.
 * @param {number} intervalAprRate - The interval APR rate.
 * @param {number} secondsPerInterval - The number of seconds per interval.
 * @returns {number} - The annual APY rounded to full percentage points.
 */
export function intervalAprRateToAnnualApy(intervalAprRate: number, secondsPerInterval: number): number {
    const intervalsPerYear = (365 * 24 * 60 * 60) / secondsPerInterval;
    const annualApy = (intervalAprRate / scale) ** intervalsPerYear;
    return Math.round(annualApy * 10000) / 10000;
}
