import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildStartupLeaderboardRows,
    shortenPlayerIdentity,
} from '../../src/nostr/startupLeaderboard.js';

test('shortenPlayerIdentity keeps readable prefix and suffix', () => {
    assert.equal(
        shortenPlayerIdentity('npub1abcdefghijklmnopqrstuvwxyz0123456789'),
        'npub1abcde...6789',
    );
});

test('buildStartupLeaderboardRows limits and ranks high scores first', () => {
    const rows = buildStartupLeaderboardRows([
        { eventId: '1', playerPubkey: 'player-a', score: 12, level: 2, createdAt: 10, timestamp: 10 },
        { eventId: '2', playerPubkey: 'player-b', score: 25, level: 4, createdAt: 20, timestamp: 20 },
        { eventId: '3', playerPubkey: 'player-c', score: 7, level: 1, createdAt: 30, timestamp: 30 },
    ], 2);

    assert.deepEqual(rows, [
        { rank: '01', player: 'player-b', score: '25', level: 'NIVEL 4', avatarUrl: undefined, displayName: undefined },
        { rank: '02', player: 'player-a', score: '12', level: 'NIVEL 2', avatarUrl: undefined, displayName: undefined },
    ]);
});
