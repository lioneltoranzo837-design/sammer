const MIN_SCALE = 0.75;
const MAX_SCALE = 1.5;
const SCALE_STEP = 0.25;
const LOW_FPS = 50;
const HIGH_FPS = 58;
const SUSTAINED_SECONDS = 1;
const DURATION_EPSILON = 1e-9;
const MAX_SAMPLE_DELTA_SECONDS = 0.25;
const HUD_HEIGHT = 110;

export type AdaptiveResolutionState = {
    scale: number;
    rollingFps: number;
    lowDurationSeconds: number;
    highDurationSeconds: number;
};

export function createAdaptiveResolutionState(devicePixelRatio: number): AdaptiveResolutionState {
    const validDpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
        ? devicePixelRatio
        : 1;
    return {
        scale: clamp(validDpr, MIN_SCALE, MAX_SCALE),
        rollingFps: 0,
        lowDurationSeconds: 0,
        highDurationSeconds: 0,
    };
}

export function sampleAdaptiveResolution(
    state: AdaptiveResolutionState,
    fps: number,
    deltaSeconds: number,
): AdaptiveResolutionState {
    if (!Number.isFinite(fps) || fps <= 0
        || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0
        || deltaSeconds > MAX_SAMPLE_DELTA_SECONDS) {
        return state;
    }
    const sampleWeight = Math.min(1, deltaSeconds * 2);
    state.rollingFps = state.rollingFps === 0
        ? fps
        : state.rollingFps + (fps - state.rollingFps) * sampleWeight;
    state.lowDurationSeconds = state.rollingFps < LOW_FPS
        ? state.lowDurationSeconds + deltaSeconds
        : 0;
    state.highDurationSeconds = state.rollingFps > HIGH_FPS
        ? state.highDurationSeconds + deltaSeconds
        : 0;
    if (state.lowDurationSeconds + DURATION_EPSILON >= SUSTAINED_SECONDS && state.scale > MIN_SCALE) {
        resetAfterScaleChange(state, state.scale - SCALE_STEP);
    }
    else if (state.highDurationSeconds + DURATION_EPSILON >= SUSTAINED_SECONDS && state.scale < MAX_SCALE) {
        resetAfterScaleChange(state, state.scale + SCALE_STEP);
    }
    return state;
}

export function getRenderViewport(width: number, height: number): {
    readonly width: number;
    readonly height: number;
} {
    const safeWidth = Number.isFinite(width) ? Math.floor(width) : 1;
    const safeHeight = Number.isFinite(height) ? Math.floor(height - HUD_HEIGHT) : 1;
    return { width: Math.max(1, safeWidth), height: Math.max(1, safeHeight) };
}

function resetAfterScaleChange(state: AdaptiveResolutionState, scale: number): void {
    state.scale = clamp(scale, MIN_SCALE, MAX_SCALE);
    state.rollingFps = 0;
    state.lowDurationSeconds = 0;
    state.highDurationSeconds = 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
}
