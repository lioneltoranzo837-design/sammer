import test from 'node:test';
import assert from 'node:assert/strict';

import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';

import {
    computeJackpotContributionSats,
    computePotFromLedger,
    verifyBossVictoryProof,
    verifyLeaderboardTopProof,
} from '../../api/_lib/jackpot.js';

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

test('computeJackpotContributionSats keeps ten percent in the game wallet', () => {
    assert.equal(computeJackpotContributionSats(100), 90);
    assert.equal(computeJackpotContributionSats(101), 90);
    assert.equal(computeJackpotContributionSats(9), 8);
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

test('verifyLeaderboardTopProof accepts a matching top score proof', () => {
    const secretKey = hexToBytes('1111111111111111111111111111111111111111111111111111111111111111');
    const playerPubkey = getPublicKey(secretKey);
    const receiptId = 'receipt-123';
    const proof = finalizeEvent({
        kind: 78,
        created_at: 1710000000,
        content: JSON.stringify({ game: 'sammer', score: 500, level: 3, timestamp: 1710000000 }),
        tags: [
            ['game', 'sammer'],
            ['p', 'game-pubkey'],
            ['player', playerPubkey],
            ['score', '500'],
            ['level', '3'],
            ['receipt', receiptId],
        ],
    }, secretKey);

    assert.equal(verifyLeaderboardTopProof(proof, playerPubkey, receiptId, [
        { playerPubkey: 'other-player', score: 499, level: 4, createdAt: 1710000010 },
        { playerPubkey, score: 500, level: 3, createdAt: 1710000000 },
    ]), true);
});

test('verifyLeaderboardTopProof accepts a delegated top score proof for the winning player tag', () => {
    const playerSecretKey = hexToBytes('1111111111111111111111111111111111111111111111111111111111111111');
    const signerSecretKey = hexToBytes('2222222222222222222222222222222222222222222222222222222222222222');
    const playerPubkey = getPublicKey(playerSecretKey);
    const receiptId = 'receipt-123';
    const proof = finalizeEvent({
        kind: 78,
        created_at: 1710000000,
        content: JSON.stringify({ game: 'sammer', score: 500, level: 3, timestamp: 1710000000 }),
        tags: [
            ['game', 'sammer'],
            ['p', 'game-pubkey'],
            ['player', playerPubkey],
            ['score', '500'],
            ['level', '3'],
            ['receipt', receiptId],
        ],
    }, signerSecretKey);

    assert.equal(verifyLeaderboardTopProof(proof, playerPubkey, receiptId, [
        { playerPubkey: 'other-player', score: 499, level: 4, createdAt: 1710000010 },
        { playerPubkey, score: 500, level: 3, createdAt: 1710000000 },
    ]), true);
});

test('verifyLeaderboardTopProof rejects a score below the current leader', () => {
    const secretKey = hexToBytes('1111111111111111111111111111111111111111111111111111111111111111');
    const playerPubkey = getPublicKey(secretKey);
    const receiptId = 'receipt-123';
    const proof = finalizeEvent({
        kind: 78,
        created_at: 1710000000,
        content: JSON.stringify({ game: 'sammer', score: 500, level: 3, timestamp: 1710000000 }),
        tags: [
            ['game', 'sammer'],
            ['p', 'game-pubkey'],
            ['player', playerPubkey],
            ['score', '500'],
            ['level', '3'],
            ['receipt', receiptId],
        ],
    }, secretKey);

    assert.throws(() => verifyLeaderboardTopProof(proof, playerPubkey, receiptId, [
        { playerPubkey: 'other-player', score: 501, level: 1, createdAt: 1710000010 },
        { playerPubkey, score: 500, level: 3, createdAt: 1710000000 },
    ]));
});
