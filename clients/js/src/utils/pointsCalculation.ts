import { GlobalConfig, PointsEarnedPhase, ExchangeRatePhase, BaseYieldPhase } from "src/generated";

type CombinedPhase = {
  type: 'ExchangeRate' | 'BaseYield';
  phase: ExchangeRatePhase | BaseYieldPhase;
};

/**
 * Calculates the points earned over time based on the provided global configuration, staked amount, and timestamps.
 * 
 * @param globalConfig - The global configuration containing exchange rate and base yield histories.
 * @param stakedAmount - The amount of tokens staked.
 * @param stakingTimestamp - The timestamp when the staking started.
 * @param currentTimestamp - The current timestamp to calculate points up to.
 * @returns An array of PointsEarnedPhase objects representing the points earned over different phases.
 */
export function calculatePoints(
  globalConfig: GlobalConfig,
  stakedAmount: bigint,
  stakingTimestamp: number,
  currentTimestamp: number
): PointsEarnedPhase[] {
  const SECONDS_PER_YEAR = 31_536_000n;
  const PRECISION = 1_000_000_000_000n;

  const pointsHistory: PointsEarnedPhase[] = [];
  let currentTime = BigInt(stakingTimestamp);

  // Combine both histories and sort by start_date
  const combinedPhases: [bigint, CombinedPhase][] = [
    ...globalConfig.exchangeRateHistory.map(phase => [BigInt(phase.startDate), { type: 'ExchangeRate', phase } as CombinedPhase] as [bigint, CombinedPhase]),
    ...globalConfig.baseYieldHistory.map(phase => [BigInt(phase.startDate), { type: 'BaseYield', phase } as CombinedPhase] as [bigint, CombinedPhase])
  ].sort((a, b) => Number(a[0] - b[0]));

  let currentExchangeRate = globalConfig.exchangeRateHistory[0];
  let currentBaseYield = globalConfig.baseYieldHistory[0];
  let accumulatedPoints = 0n;

  combinedPhases.forEach(([phaseStart, phase]) => {
    if (phaseStart >= BigInt(currentTimestamp)) {
      return;
    }

    if (phaseStart <= currentTime) {
      if (phase.type === 'ExchangeRate') {
        currentExchangeRate = phase.phase as ExchangeRatePhase;
      } else {
        currentBaseYield = phase.phase as BaseYieldPhase;
      }
      return;
    }

    const phaseEnd = BigInt(Math.min(Number(phaseStart), currentTimestamp));
    const applicableDuration = phaseEnd - currentTime;

    const durationInYears = (applicableDuration * PRECISION) / SECONDS_PER_YEAR;

    const points = stakedAmount *
      currentBaseYield.baseYieldBps *
      durationInYears *
      currentExchangeRate.exchangeRate /
      PRECISION /
      10000n /
      BigInt(10 ** globalConfig.baseMintDecimals);

    accumulatedPoints += points;

    if (pointsHistory.length > 0 &&
      pointsHistory[pointsHistory.length - 1].exchangeRate === currentExchangeRate.exchangeRate &&
      pointsHistory[pointsHistory.length - 1].index === currentExchangeRate.index) {
      // Update the last entry if exchange rate and index are the same
      pointsHistory[pointsHistory.length - 1].points = accumulatedPoints;
    } else {
      // Add a new entry if exchange rate or index changed
      pointsHistory.push({
        exchangeRate: currentExchangeRate.exchangeRate,
        points: accumulatedPoints,
        index: currentExchangeRate.index
      });
    }

    currentTime = phaseStart;

    if (phase.type === 'ExchangeRate') {
      currentExchangeRate = phase.phase as ExchangeRatePhase;
      // Reset accumulated points when exchange rate changes
      accumulatedPoints = 0n;
    } else {
      currentBaseYield = phase.phase as BaseYieldPhase;
    }
  })

  // Calculate points for the final phase
  if (currentTime < BigInt(currentTimestamp)) {
    const applicableDuration = BigInt(currentTimestamp) - currentTime;

    const durationInYears = (applicableDuration * PRECISION) / SECONDS_PER_YEAR;

    const points = stakedAmount *
      currentBaseYield.baseYieldBps *
      durationInYears *
      currentExchangeRate.exchangeRate /
      PRECISION /
      10000n /
      BigInt(10 ** globalConfig.baseMintDecimals);

    accumulatedPoints += points;

    if (pointsHistory.length > 0 &&
      pointsHistory[pointsHistory.length - 1].exchangeRate === currentExchangeRate.exchangeRate &&
      pointsHistory[pointsHistory.length - 1].index === currentExchangeRate.index) {
      // Update the last entry if exchange rate and index are the same
      pointsHistory[pointsHistory.length - 1].points = accumulatedPoints;
    } else {
      // Add a new entry if exchange rate or index changed
      pointsHistory.push({
        exchangeRate: currentExchangeRate.exchangeRate,
        points: accumulatedPoints,
        index: currentExchangeRate.index
      });
    }
  }

  return pointsHistory;
}

/**
 * Combines two points histories into one by summing up the points for matching exchange rates and indices.
 * 
 * @param calculatedPoints - The initial points history.
 * @param additionalPoints - The additional points history to be combined.
 * @returns A combined array of PointsEarnedPhase objects.
 */
export function combinePointsHistories(
  calculatedPoints: PointsEarnedPhase[],
  additionalPoints: PointsEarnedPhase[]
): PointsEarnedPhase[] {
  const combinedPoints: PointsEarnedPhase[] = [...calculatedPoints];

  additionalPoints.forEach(additionalPoint => {
    const existingPoint = combinedPoints.find(
      point => point.exchangeRate === additionalPoint.exchangeRate && point.index === additionalPoint.index
    );

    if (existingPoint) {
      existingPoint.points += additionalPoint.points;
    } else {
      combinedPoints.push(additionalPoint);
    }
  });

  return combinedPoints;
}