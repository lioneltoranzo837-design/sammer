export type FacilityDecorationType = 'barrel' | 'crate' | 'cable';

export function pickFacilityDecorationType(randomValue: number): FacilityDecorationType {
    const clampedRandomValue = Math.max(0, Math.min(0.999999, randomValue));
    const typeIndex = Math.floor(clampedRandomValue * 3);

    if (typeIndex === 0) {
        return 'barrel';
    }

    if (typeIndex === 1) {
        return 'crate';
    }

    return 'cable';
}
