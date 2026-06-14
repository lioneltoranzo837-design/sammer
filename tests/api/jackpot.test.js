import test from 'node:test';
import assert from 'node:assert/strict';

import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';

import { computePotFromLedger, verifyBossVictoryProof } from '../../api/_lib/jackpot.js';

function hexToBytes(hex) {
    return Uint8Array.from(Buffer.from(hex, 'hex'));
}

test('computePotFromLedger resets after jackpot claim', () => {
    const pot = computePotFromLedger([
        { type: 'entry-loss', amountSats: 100 },
        { type: 'entry-loss', amountSats: 100 },
        { type: 'jackpot-claim', amountSats: 200 },
        { type: 'entry-loss', amountSats: 100 },
    ]);

    assert.equal(pot, 100);
});

test('verifyBossVictoryProof accepts a matching signed proof', () => {
    const secretKey = hexToBytes('1111111111111111111111111111111111111111111111111111111111111111');
    const playerPubkey = getPublicKey(secretKey);
    const receiptId = 'receipt-123';
    const proof = finalizeEvent({
        kind: 39001,
        created_at: 1710000000,
        content: 'Sammer boss victory proof',
        tags: [
            ['game', 'sammer'],
            ['result', 'boss-win'],
            ['receipt', receiptId],
            ['level', '4'],
        ],
    }, secretKey);

    assert.equal(verifyBossVictoryProof(proof, playerPubkey, receiptId), true);
});

test('verifyBossVictoryProof rejects a proof with the wrong receipt', () => {
    const secretKey = hexToBytes('1111111111111111111111111111111111111111111111111111111111111111');
    const playerPubkey = getPublicKey(secretKey);
    const proof = finalizeEvent({
        kind: 39001,
        created_at: 1710000000,
        content: 'Sammer boss victory proof',
        tags: [
            ['game', 'sammer'],
            ['result', 'boss-win'],
            ['receipt', 'other-receipt'],
            ['level', '4'],
        ],
    }, secretKey);

    assert.throws(() => verifyBossVictoryProof(proof, playerPubkey, 'receipt-123'));
});
