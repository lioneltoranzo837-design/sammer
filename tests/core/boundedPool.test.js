import test from 'node:test';
import assert from 'node:assert/strict';

import { BoundedPool } from '../../src/core/boundedPool.js';

test('BoundedPool refuses acquisitions beyond its active capacity', () => {
    // Given a pool with two reusable slots.
    let nextId = 0;
    const pool = new BoundedPool(2, () => ({ id: nextId += 1 }));

    // When three items are requested without releasing one.
    const first = pool.acquire();
    const second = pool.acquire();
    const saturated = pool.acquire();

    // Then only the bounded number of effects can be active.
    assert.deepEqual([first?.id, second?.id, saturated], [1, 2, null]);
    assert.equal(pool.activeCount, 2);
});

test('BoundedPool reuses a released item instead of allocating again', () => {
    // Given a saturated one-slot pool.
    let allocations = 0;
    const pool = new BoundedPool(1, () => ({ id: allocations += 1 }));
    const first = pool.acquire();

    // When the active item is released and acquired again.
    assert.ok(first);
    pool.release(first);
    const reused = pool.acquire();

    // Then the same object is reused and no second allocation occurs.
    assert.equal(reused, first);
    assert.equal(allocations, 1);
});

test('BoundedPool releaseAll clears saturation while retaining reusable items', () => {
    // Given a fully active pool.
    let nextId = 0;
    const pool = new BoundedPool(2, () => ({ id: nextId += 1 }));
    const first = pool.acquire();
    const second = pool.acquire();
    assert.ok(first);
    assert.ok(second);

    // When all active items are released together.
    pool.clear();

    // Then active capacity is restored and both objects remain reusable.
    assert.equal(pool.activeCount, 0);
    assert.ok(pool.acquire());
    assert.ok(pool.acquire());
    assert.equal(nextId, 2);
});
