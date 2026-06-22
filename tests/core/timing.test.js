import test from 'node:test';
import assert from 'node:assert/strict';

import {
    MAX_SIMULATION_DELTA_SECONDS,
    clampSimulationDelta,
    distanceForDelta,
    eventOccursForDelta,
    frameProbabilityToRate,
    integrateConstantAcceleration,
    legacyFrameVelocityToPerSecond,
    probabilityForDelta,
} from '../../src/core/timing.js';

const REFERENCE_FPS = 60;
const TEST_FRAME_RATES = [30, 60, 120];

function simulateConstantSpeed(speedPerSecond, fps) {
    const deltaSeconds = 1 / fps;
    let position = 0;
    for (let frame = 0; frame < fps; frame += 1) {
        position += distanceForDelta(speedPerSecond, deltaSeconds);
    }
    return position;
}

function simulateParticle(velocityPerSecond, accelerationPerSecondSquared, fps) {
    const deltaSeconds = 1 / fps;
    let position = 0;
    let velocity = velocityPerSecond;
    for (let frame = 0; frame < fps; frame += 1) {
        const step = integrateConstantAcceleration(velocity, accelerationPerSecondSquared, deltaSeconds);
        position += step.displacement;
        velocity = step.velocity;
    }
    return position;
}

test('clampSimulationDelta returns zero when the clock does not advance', () => {
    // Given a paused simulation clock.
    const deltaSeconds = 0;

    // When the frame delta is normalized.
    const actual = clampSimulationDelta(deltaSeconds);

    // Then no simulation time advances.
    assert.equal(actual, 0);
});

test('clampSimulationDelta caps stale frames at 0.1 seconds', () => {
    // Given a frame delayed beyond the simulation safety cap.
    const staleDeltaSeconds = 0.35;

    // When the frame delta is normalized.
    const actual = clampSimulationDelta(staleDeltaSeconds);

    // Then the simulation advances by at most the configured cap.
    assert.equal(actual, MAX_SIMULATION_DELTA_SECONDS);
});

test('constant-speed movement preserves the 60 FPS one-second feel at 30, 60, and 120 FPS', () => {
    // Given the units-per-second equivalents of the legacy per-frame speeds.
    const speeds = {
        player: 0.07 * REFERENCE_FPS,
        zombie: 0.025 * REFERENCE_FPS,
        spider: 0.035 * REFERENCE_FPS,
        boss: 0.025 * REFERENCE_FPS * 1.8,
        bossRush: 0.025 * REFERENCE_FPS * 3.6,
        spiderProjectile: 0.2 * REFERENCE_FPS,
        bossAcidProjectile: 0.25 * REFERENCE_FPS,
    };

    // When each mover is simulated for exactly one second at multiple frame rates.
    const results = Object.fromEntries(Object.entries(speeds).map(([name, speed]) => [
        name,
        Object.fromEntries(TEST_FRAME_RATES.map(fps => [fps, simulateConstantSpeed(speed, fps)])),
    ]));

    // Then every displacement matches its legacy 60 FPS distance within 1%.
    for (const [name, speed] of Object.entries(speeds)) {
        for (const fps of TEST_FRAME_RATES) {
            const displacement = results[name][fps];
            assert.ok(Math.abs(displacement - speed) / speed <= 0.01, `${name} drifted at ${fps} FPS`);
        }
    }
    console.log('TIMING_HARNESS', JSON.stringify(results));
});

test('accelerated particle movement is stable at 30, 60, and 120 FPS', () => {
    // Given a representative legacy upward velocity and converted gravity.
    const velocityPerFrame = 0.075;
    const gravityPerSecondSquared = -18;
    const velocityPerSecond = legacyFrameVelocityToPerSecond(
        velocityPerFrame,
        gravityPerSecondSquared,
        REFERENCE_FPS,
    );

    // When the particle is simulated for one second at multiple frame rates.
    const displacements = TEST_FRAME_RATES.map(fps => simulateParticle(
        velocityPerSecond,
        gravityPerSecondSquared,
        fps,
    ));

    // Then all frame rates produce the same one-second displacement within 1%.
    const legacySixtyFpsDisplacement = velocityPerFrame * REFERENCE_FPS
        + (-0.005 * REFERENCE_FPS * (REFERENCE_FPS + 1)) / 2;
    for (const displacement of displacements) {
        assert.ok(
            Math.abs(displacement - legacySixtyFpsDisplacement)
                <= Math.max(Math.abs(legacySixtyFpsDisplacement) * 0.01, 1e-9),
        );
    }
    console.log('PARTICLE_TIMING_HARNESS', JSON.stringify(Object.fromEntries(
        TEST_FRAME_RATES.map((fps, index) => [fps, displacements[index]]),
    )));
});

test('frameProbabilityToRate preserves the event probability at the reference frame duration', () => {
    // Given a legacy 8% per-frame spark probability at 60 FPS.
    const probabilityPerFrame = 0.08;

    // When it is converted to a rate and sampled over one reference frame.
    const ratePerSecond = frameProbabilityToRate(probabilityPerFrame, REFERENCE_FPS);
    const restoredProbability = probabilityForDelta(ratePerSecond, 1 / REFERENCE_FPS);

    // Then the original probability is preserved.
    assert.ok(Math.abs(restoredProbability - probabilityPerFrame) < 1e-12);
});

test('eventOccursForDelta uses an injected sample without flaky randomness', () => {
    // Given a deterministic event probability threshold.
    const ratePerSecond = frameProbabilityToRate(0.08, REFERENCE_FPS);
    const deltaSeconds = 1 / REFERENCE_FPS;

    // When samples immediately below and at the threshold are evaluated.
    const belowThreshold = eventOccursForDelta(ratePerSecond, deltaSeconds, 0.079999);
    const atThreshold = eventOccursForDelta(ratePerSecond, deltaSeconds, 0.08);

    // Then only the sample below the threshold produces the event.
    assert.equal(belowThreshold, true);
    assert.equal(atThreshold, false);
});
