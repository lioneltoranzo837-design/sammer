import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createInitialScoreState,
    enemyScoreValue,
    recordEnemyKill,
    recordPlayerDamage,
    resolveFinalScore,
} from '../../src/gameplay/scoring.js';

test('enemyScoreValue rewards enemy difficulty with a large boss bonus', () => {
    // Given the enemy types used by the game.
    const normal = enemyScoreValue('zombie-normal', 1);
    const runner = enemyScoreValue('zombie-runner', 2);
    const spitter = enemyScoreValue('zombie-spitter', 2);
    const spider = enemyScoreValue('ceiling-spider', 3);
    const boss = enemyScoreValue('boss', 4);

    // When their kill values are compared.
    // Then harder enemies and the final boss are worth more.
    assert.ok(runner > normal);
    assert.ok(spitter > runner);
    assert.ok(spider > spitter);
    assert.ok(boss > spider * 10);
});

test('resolveFinalScore favors fast aggressive runs and penalizes damage', () => {
    // Given two players who reach the same level.
    const fastAggressive = recordEnemyKill(
        recordEnemyKill(
            recordEnemyKill(createInitialScoreState(0), 'zombie-normal', 1),
            'zombie-spitter',
            2,
        ),
        'boss',
        4,
    );
    const slowCareless = recordPlayerDamage(
        recordEnemyKill(createInitialScoreState(0), 'zombie-normal', 1),
        75,
    );

    // When final scores are resolved after different run durations.
    const fastScore = resolveFinalScore({
        state: fastAggressive,
        currentLevel: 4,
        elapsedSeconds: 360,
    });
    const slowScore = resolveFinalScore({
        state: slowCareless,
        currentLevel: 4,
        elapsedSeconds: 1800,
    });

    // Then speed and extra kills matter more than passive survival.
    assert.ok(fastScore > slowScore);
    assert.ok(fastScore > 0);
    assert.ok(slowScore > 0);
});
