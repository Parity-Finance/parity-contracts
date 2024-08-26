import { unwrapOption } from "@metaplex-foundation/umi";
import { GlobalConfig, PointsEarnedPhase } from "src/generated";

export function calculatePoints(
  globalConfig: GlobalConfig,
  stakedAmount: bigint,
  stakingTimestamp: number,
  currentTimestamp: number
): PointsEarnedPhase[] {
  const SECONDS_PER_YEAR = 31_536_000n;
  const PRECISION = 1_000_000_000_000n;

  let remainingDuration = BigInt(Math.max(currentTimestamp - stakingTimestamp, 0));
  const pointsHistory = globalConfig.exchangeRateHistory.reduceRight((acc, phase) => {
    if (remainingDuration <= 0n) {
      return acc;
    }

    const phaseEnd = unwrapOption(phase.endDate) ? unwrapOption(phase.endDate) as bigint : BigInt(currentTimestamp);
    const phaseDuration = phaseEnd - BigInt(phase.startDate);
    const applicableDuration = remainingDuration < phaseDuration ? remainingDuration : phaseDuration;


    const durationInYears = (applicableDuration * PRECISION) / SECONDS_PER_YEAR;

    const points = stakedAmount *
      globalConfig.baselineYieldBps *
      durationInYears *
      phase.exchangeRate /
      PRECISION /
      10000n /
      BigInt(10 ** globalConfig.baseMintDecimals);

    remainingDuration -= applicableDuration;
    return [...acc, { exchangeRate: phase.exchangeRate, points, index: phase.index }];
  }, [] as PointsEarnedPhase[]);

  return pointsHistory;
}

