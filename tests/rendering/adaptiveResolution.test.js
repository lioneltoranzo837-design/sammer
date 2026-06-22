import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createAdaptiveResolutionState,
    getRenderViewport,
    sampleAdaptiveResolution,
} from '../../src/rendering/adaptiveResolution.js';

function sampleForOneSecond(state, fps) {
    let next = state;
    const deltaSeconds = 1 / fps;
    for (let frame = 0; frame < fps; frame += 1) {
        next = sampleAdaptiveResolution(next, fps, deltaSeconds);
    }
    return next;
}

test('initial adaptive resolution caps high-DPR displays at 1.5', () => {
    // Given a high-density display.
    const devicePixelRatio = 3;

    // When initial render state is created.
    const state = createAdaptiveResolutionState(devicePixelRatio);

    // Then GPU work starts at the DPR cap.
    assert.equal(state.scale, 1.5);
});

test('adaptive resolution reduces after sustained performance below 50 FPS', () => {
    // Given maximum render scale.
    const state = createAdaptiveResolutionState(2);

    // When 49 FPS is sustained for one second.
    const next = sampleForOneSecond(state, 49);

    // Then quality drops exactly one step.
    assert.equal(next.scale, 1.25);
});

test('adaptive resolution recovers after sustained performance above 58 FPS', () => {
    // Given render scale reduced to 1.25.
    const reduced = sampleForOneSecond(createAdaptiveResolutionState(2), 49);

    // When 59 FPS is sustained for one second.
    const recovered = sampleForOneSecond(reduced, 59);

    // Then quality recovers exactly one step.
    assert.equal(recovered.scale, 1.5);
});

test('adaptive resolution ignores threshold oscillation and extreme deltas', () => {
    // Given maximum render scale.
    let state = createAdaptiveResolutionState(4);

    // When samples alternate thresholds and stale deltas are presented.
    for (let sample = 0; sample < 120; sample += 1) {
        state = sampleAdaptiveResolution(state, sample % 2 === 0 ? 49 : 59, 1 / 60);
        state = sampleAdaptiveResolution(state, 10, 5);
    }

    // Then hysteresis prevents scale churn.
    assert.equal(state.scale, 1.5);
});

test('getRenderViewport clamps resize storms to positive dimensions', () => {
    // Given invalid transient browser dimensions.
    const width = Number.NaN;
    const height = 50;

    // When renderer dimensions are calculated.
    const viewport = getRenderViewport(width, height);

    // Then renderer and composer receive finite positive dimensions.
    assert.deepEqual(viewport, { width: 1, height: 1 });
});
