import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildLunaNegraLeaderboardRows,
    buildLunaNegraLeaderboardUrl,
    buildLunaNegraScoresUrl,
    buildLunaNegraSessionUrl,
    getLunaNegraTokenFromSearch,
    normalizeLunaNegraSession,
    removeLunaNegraTokenFromUrl,
} from '../../src/nostr/lunaNegra.js';

test('builds Luna Negra API URLs without duplicate slashes', () => {
    assert.equal(buildLunaNegraSessionUrl('https://moon21.vercel.app/'), 'https://moon21.vercel.app/api/v1/session');
    assert.equal(buildLunaNegraLeaderboardUrl('https://moon21.vercel.app/', 'sammer'), 'https://moon21.vercel.app/api/v1/leaderboards/sammer?window=all&view=top');
    assert.equal(buildLunaNegraScoresUrl('https://moon21.vercel.app/', 'sammer'), 'https://moon21.vercel.app/api/v1/leaderboards/sammer/scores');
});

test('extracts and removes lnToken while preserving other URL parts', () => {
    assert.equal(getLunaNegraTokenFromSearch('?lnToken=abc&debug=1'), 'abc');
    assert.equal(removeLunaNegraTokenFromUrl('https://game.test/play?lnToken=abc&debug=1#hud'), '/play?debug=1#hud');
});

test('normalizes session payload variants', () => {
    assert.deepEqual(normalizeLunaNegraSession({ user: { npub: 'npub1x', displayName: 'Ada', avatarUrl: 'pic.png', gameId: 'g1' } }, 'token'), {
        token: 'token',
        npub: 'npub1x',
        pubkey: '',
        displayName: 'Ada',
        avatarUrl: 'pic.png',
        gameId: 'g1',
    });
});

test('builds leaderboard rows from flexible Luna Negra payloads', () => {
    assert.deepEqual(buildLunaNegraLeaderboardRows({ scores: [
        { rank: 3, user: { username: 'alice' }, score: 9 },
        { name: 'bob', points: 7 },
    ] }), [
        { rank: '03', player: 'alice', score: '9', level: 'LUNA NEGRA' },
        { rank: '02', player: 'bob', score: '7', level: 'LUNA NEGRA' },
    ]);
});
