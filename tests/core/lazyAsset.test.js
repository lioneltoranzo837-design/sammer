import test from 'node:test';
import assert from 'node:assert/strict';

import { LazyAsset } from '../../src/core/lazyAsset.js';

test('LazyAsset stays idle until level-four code requests it', () => {
    // Given a lazy boss asset loader.
    let calls = 0;
    const asset = new LazyAsset(async () => {
        calls += 1;
        return 'boss';
    });

    // When no request has occurred.
    const status = asset.status;

    // Then the network-producing loader remains untouched.
    assert.equal(status, 'idle');
    assert.equal(calls, 0);
});

test('LazyAsset shares one in-flight load across duplicate ensure calls', async () => {
    // Given a loader whose completion is externally controlled.
    let calls = 0;
    let resolveLoad;
    const asset = new LazyAsset(() => {
        calls += 1;
        return new Promise(resolve => {
            resolveLoad = resolve;
        });
    });

    // When level entry and boss spawn request the asset together.
    const enteringLevel = asset.ensure();
    const spawningBoss = asset.ensure();
    resolveLoad('boss');

    // Then one request serves both callers.
    assert.equal(await enteringLevel, 'boss');
    assert.equal(await spawningBoss, 'boss');
    assert.equal(calls, 1);
    assert.equal(asset.status, 'ready');
});

test('LazyAsset keeps a rejected load idempotently failed', async () => {
    // Given a loader that rejects.
    let calls = 0;
    const asset = new LazyAsset(async () => {
        calls += 1;
        throw new Error('network failure');
    });

    // When requests occur before and after the rejection.
    const first = await asset.ensure();
    const second = await asset.ensure();

    // Then fallback remains selected without retrying the network.
    assert.equal(first, undefined);
    assert.equal(second, undefined);
    assert.equal(calls, 1);
    assert.equal(asset.status, 'failed');
});
