import test from 'node:test';
import assert from 'node:assert/strict';

import {
    canStartPaidRun,
    computeCurrentJackpot,
    createEntryGateState,
} from '../../src/nostr/paymentGate.js';

test('unpaid entry gate blocks the run until payment is verified', () => {
    const state = createEntryGateState(100);

    assert.equal(canStartPaidRun(state), false);
    assert.equal(state.entryFeeSats, 100);
});

test('verified entry gate unlocks the run', () => {
    const state = createEntryGateState(100);
    state.isPaid = true;
    state.verifiedReceiptId = 'receipt-1';

    assert.equal(canStartPaidRun(state), true);
});

test('current jackpot reports accumulated validated loss events', () => {
    const jackpot = computeCurrentJackpot([
        { type: 'entry-loss', amountSats: 100, createdAt: 10 },
        { type: 'entry-loss', amountSats: 100, createdAt: 20 },
        { type: 'jackpot-claim', amountSats: 200, createdAt: 30 },
        { type: 'entry-loss', amountSats: 100, createdAt: 40 },
        { type: 'entry-loss', amountSats: 100, createdAt: 50 },
    ]);

    assert.deepEqual(jackpot, {
        currentPotSats: 400,
        lastClaimAt: 30,
    });
});
