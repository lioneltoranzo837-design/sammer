export const MAX_SIMULATION_DELTA_SECONDS = 0.1;
export const LEGACY_REFERENCE_FPS = 60;

export type MotionStep = {
    readonly displacement: number;
    readonly velocity: number;
};

export function clampSimulationDelta(deltaSeconds: number): number {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
        return 0;
    }
    return Math.min(deltaSeconds, MAX_SIMULATION_DELTA_SECONDS);
}

export function distanceForDelta(speedPerSecond: number, deltaSeconds: number): number {
    return speedPerSecond * clampSimulationDelta(deltaSeconds);
}

export function legacyFrameVelocityToPerSecond(
    velocityPerFrame: number,
    accelerationPerSecondSquared = 0,
    referenceFps = LEGACY_REFERENCE_FPS,
): number {
    if (referenceFps <= 0) {
        return 0;
    }
    return velocityPerFrame * referenceFps
        + accelerationPerSecondSquared / (2 * referenceFps);
}

export function integrateConstantAcceleration(
    velocityPerSecond: number,
    accelerationPerSecondSquared: number,
    deltaSeconds: number,
): MotionStep {
    const simulationDelta = clampSimulationDelta(deltaSeconds);
    return {
        displacement: velocityPerSecond * simulationDelta
            + 0.5 * accelerationPerSecondSquared * simulationDelta ** 2,
        velocity: velocityPerSecond + accelerationPerSecondSquared * simulationDelta,
    };
}

export function frameProbabilityToRate(
    probabilityPerFrame: number,
    referenceFps = LEGACY_REFERENCE_FPS,
): number {
    if (probabilityPerFrame <= 0 || referenceFps <= 0) {
        return 0;
    }
    if (probabilityPerFrame >= 1) {
        return Number.POSITIVE_INFINITY;
    }
    return -Math.log1p(-probabilityPerFrame) * referenceFps;
}

export function probabilityForDelta(ratePerSecond: number, deltaSeconds: number): number {
    const simulationDelta = clampSimulationDelta(deltaSeconds);
    if (ratePerSecond <= 0 || simulationDelta === 0) {
        return 0;
    }
    return -Math.expm1(-ratePerSecond * simulationDelta);
}

export function eventOccursForDelta(
    ratePerSecond: number,
    deltaSeconds: number,
    randomSample: number,
): boolean {
    return randomSample < probabilityForDelta(ratePerSecond, deltaSeconds);
}
