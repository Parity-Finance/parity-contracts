import assert from 'assert';
import { calculatePoints } from '../utils/pointsCalculation';
import { GlobalConfig } from '../generated';

function assertWithinTolerance(actual: bigint, expected: bigint, tolerance: bigint, message: string) {
    assert(
        BigInt(Math.abs(Number(actual - expected))) <= tolerance,
        `${message}. Expected close to ${expected}, but got ${actual}`
    );
}

describe('calculatePoints', () => {
    const defaultGlobalConfig: Partial<GlobalConfig> = {
        bump: 0,
        owner: {} as any,
        pendingOwner: {} as any,
        admin: {} as any,
        baseMint: {} as any,
        stakingVault: {} as any,
        baseMintDecimals: 6,
        stakedSupply: 1_000_000n,
        totalPointsIssued: 50_000n,
        depositCap: 10_000_000n,
        exchangeRateHistory: [],
        pointsHistory: [],
        baseYieldHistory: []
    };

    it('calculate points with phases', () => {
        const globalConfig: Partial<GlobalConfig> = {
            ...defaultGlobalConfig,
            exchangeRateHistory: [
                {
                    exchangeRate: 20_000_000n,
                    startDate: 0n,
                    endDate: { __option: 'Some', value: 604_800n },
                    index: 0
                },
                {
                    exchangeRate: 16_666_667n,
                    startDate: 604_800n,
                    endDate: { __option: 'None' },
                    index: 1
                }
            ],
            baseYieldHistory: [
                {
                    baseYieldBps: 1000n,
                    startDate: 0n,
                    endDate: { __option: 'None' },
                    index: 0
                }
            ]
        };

        const stakedAmount = 1_000_000_000n;
        const stakingTimestamp = 0;
        const currentTimestamp = 1_209_600;

        const points = calculatePoints(globalConfig as GlobalConfig, stakedAmount, stakingTimestamp, currentTimestamp);

        assert.strictEqual(points.length, 2);
        assert.strictEqual(points[0].index, 0);
        assert.strictEqual(points[0].points, 38356164n);
        assert.strictEqual(points[1].index, 1);
        assert.strictEqual(points[1].points, 31963470n);

        const totalPoints = points.reduce((sum, p) => sum + p.points, 0n);
        assert.strictEqual(totalPoints, 70319634n);
    });

    it('calculate points with yield change', () => {
        const globalConfig: Partial<GlobalConfig> = {
            ...defaultGlobalConfig,
            exchangeRateHistory: [
                {
                    exchangeRate: 20_000_000n,
                    startDate: 0n,
                    endDate: { __option: 'None' },
                    index: 0
                }
            ],
            baseYieldHistory: [
                {
                    baseYieldBps: 1000n,
                    startDate: 0n,
                    endDate: { __option: 'Some', value: 604_800n },
                    index: 0
                },
                {
                    baseYieldBps: 1500n,
                    startDate: 604_800n,
                    endDate: { __option: 'None' },
                    index: 1
                }
            ]
        };

        const stakedAmount = 1_000_000_000n;
        const stakingTimestamp = 0;
        const currentTimestamp = 1_209_600;

        const points = calculatePoints(globalConfig as GlobalConfig, stakedAmount, stakingTimestamp, currentTimestamp);

        assert.strictEqual(points.length, 1);
        assert.strictEqual(points[0].index, 0);
        assert.strictEqual(points[0].points, 95890410n);

        const totalPoints = points.reduce((sum, p) => sum + p.points, 0n);
        assert.strictEqual(totalPoints, 95890410n);
    });

    it('calculate points with multiple changes', () => {
        const globalConfig: Partial<GlobalConfig> = {
            ...defaultGlobalConfig,
            exchangeRateHistory: [
                {
                    exchangeRate: 20_000_000n,
                    startDate: 0n,
                    endDate: { __option: 'Some', value: 432_000n },
                    index: 0
                },
                {
                    exchangeRate: 16_666_667n,
                    startDate: 432_000n,
                    endDate: { __option: 'Some', value: 864_000n },
                    index: 1
                },
                {
                    exchangeRate: 14_285_714n,
                    startDate: 864_000n,
                    endDate: { __option: 'None' },
                    index: 2
                }
            ],
            baseYieldHistory: [
                {
                    baseYieldBps: 1000n,
                    startDate: 0n,
                    endDate: { __option: 'Some', value: 259_200n },
                    index: 0
                },
                {
                    baseYieldBps: 1500n,
                    startDate: 259_200n,
                    endDate: { __option: 'Some', value: 691_200n },
                    index: 1
                },
                {
                    baseYieldBps: 2000n,
                    startDate: 691_200n,
                    endDate: { __option: 'None' },
                    index: 2
                }
            ]
        };

        const stakedAmount = 1_000_000_000n;
        const stakingTimestamp = 0;
        const currentTimestamp = 1_209_600;

        const points = calculatePoints(globalConfig as GlobalConfig, stakedAmount, stakingTimestamp, currentTimestamp);

        assert.strictEqual(points.length, 3);
        assert.strictEqual(points[0].points, 32876712n);
        assert.strictEqual(points[1].points, 38812785n);

        assertWithinTolerance(
            points[2].points,
            31315068n,
            5000n,
            "points[2].points is not within tolerance"
        );
    });
});