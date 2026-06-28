export const ENEMY_SCORE_TYPES = {
    ZombieNormal: 'zombie-normal',
    ZombieRunner: 'zombie-runner',
    ZombieSpitter: 'zombie-spitter',
    CeilingSpider: 'ceiling-spider',
    Boss: 'boss',
} as const;

export type EnemyScoreType = typeof ENEMY_SCORE_TYPES[keyof typeof ENEMY_SCORE_TYPES];

export type ScoreState = {
    readonly startedAtMs: number;
    readonly killScore: number;
    readonly damageTaken: number;
    readonly kills: Readonly<Record<EnemyScoreType, number>>;
};

export type FinalScoreInput = {
    readonly state: ScoreState;
    readonly currentLevel: number;
    readonly elapsedSeconds: number;
};

const BASE_ENEMY_VALUES: Readonly<Record<EnemyScoreType, number>> = {
    [ENEMY_SCORE_TYPES.ZombieNormal]: 120,
    [ENEMY_SCORE_TYPES.ZombieRunner]: 175,
    [ENEMY_SCORE_TYPES.ZombieSpitter]: 240,
    [ENEMY_SCORE_TYPES.CeilingSpider]: 330,
    [ENEMY_SCORE_TYPES.Boss]: 6_500,
} as const;

const EMPTY_KILLS: Readonly<Record<EnemyScoreType, number>> = {
    [ENEMY_SCORE_TYPES.ZombieNormal]: 0,
    [ENEMY_SCORE_TYPES.ZombieRunner]: 0,
    [ENEMY_SCORE_TYPES.ZombieSpitter]: 0,
    [ENEMY_SCORE_TYPES.CeilingSpider]: 0,
    [ENEMY_SCORE_TYPES.Boss]: 0,
} as const;

export function createInitialScoreState(startedAtMs: number): ScoreState {
    return {
        startedAtMs,
        killScore: 0,
        damageTaken: 0,
        kills: EMPTY_KILLS,
    };
}

export function enemyScoreValue(enemyType: EnemyScoreType, currentLevel: number): number {
    const safeLevel = Math.max(1, Math.floor(currentLevel));
    const levelMultiplier = 1 + Math.sqrt(safeLevel - 1) * 0.22;
    return Math.round(BASE_ENEMY_VALUES[enemyType] * levelMultiplier);
}

export function recordEnemyKill(
    state: ScoreState,
    enemyType: EnemyScoreType,
    currentLevel: number,
): ScoreState {
    const killValue = enemyScoreValue(enemyType, currentLevel);
    return {
        ...state,
        killScore: state.killScore + killValue,
        kills: {
            ...state.kills,
            [enemyType]: state.kills[enemyType] + 1,
        },
    };
}

export function recordPlayerDamage(state: ScoreState, damageAmount: number): ScoreState {
    return {
        ...state,
        damageTaken: state.damageTaken + Math.max(0, Math.round(damageAmount)),
    };
}

export function resolveFinalScore(input: FinalScoreInput): number {
    const levelProgressScore = Math.max(1, Math.floor(input.currentLevel)) * 2_000;
    const timePenalty = Math.round(Math.pow(Math.max(0, input.elapsedSeconds), 1.08) * 1.4);
    const damagePenalty = Math.round(Math.pow(input.state.damageTaken, 1.12) * 6);
    const rawScore = levelProgressScore + input.state.killScore - timePenalty - damagePenalty;
    return Math.max(0, rawScore);
}
