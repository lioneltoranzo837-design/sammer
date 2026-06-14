import test from 'node:test';
import assert from 'node:assert/strict';

import { pickFacilityDecorationType } from '../../src/gameplay/facilityDecorations.js';

test('facility decorations never select the floating pipe variant', () => {
    assert.notEqual(
        pickFacilityDecorationType(0.55),
        'pipe',
        'Facility decoration sampling still returns the floating pipe variant for level 1.',
    );
});
