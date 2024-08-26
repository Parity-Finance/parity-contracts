import { GlobalConfig, PointsEarnedPhase } from "src/generated";
  
 export function calculatePoints(
    globalConfig: GlobalConfig,
    stakedAmount: bigint,
    stakingTimestamp: number,
    currentTimestamp: number
  ): PointsEarnedPhase[] {
    const SECONDS_PER_YEAR = 31_536_000n;
    const PRECISION = 1_000_000_000_000n;
  
    let pointsHistory: PointsEarnedPhase[] = [];
    let remainingDuration = BigInt(Math.max(currentTimestamp - stakingTimestamp, 0));
    for (const phase of [...globalConfig.exchangeRateHistory].reverse()) {
      if (remainingDuration <= 0n) {
        break;
      }
  
      const phaseEnd = phase.endDate.__option === 'None' ? BigInt(currentTimestamp) : BigInt(phase.endDate.__option);
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
  
      pointsHistory.push({
        exchangeRate: phase.exchangeRate,
        points: points,
        index: phase.index,
      });
  
      remainingDuration -= applicableDuration;
    }
    return pointsHistory;
  }
  
