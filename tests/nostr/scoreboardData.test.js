import test from 'node:test';
import assert from 'node:assert/strict';

import {
    extractScoreboardEntries,
    isSammerScoreEvent,
    parseRelays,
    tagValue,
    toScoreboardEntry,
} from '../../src/nostr/scoreboardData.js';

test('parseRelays trims blanks and empty lines', () => {
    assert.deepEqual(parseRelays(' wss://relay.damus.io\n\n wss://nos.lol  '), [
        'wss://relay.damus.io',
        'wss://nos.lol',
    ]);
});

test('isSammerScoreEvent detects valid Sammer tags', () => {
    assert.equal(isSammerScoreEvent({ tags: [['game', 'sammer']] }), true);
    assert.equal(isSammerScoreEvent({ tags: [['d', 'sammer-score-1-123']] }), true);
    assert.equal(isSammerScoreEvent({ tags: [['game', 'otro-juego']] }), false);
});

test('tagValue returns empty string when tag is missing', () => {
    assert.equal(tagValue({ tags: [['score', '12']] }, 'level'), '');
});

test('toScoreboardEntry prefers tags and keeps numeric fields', () => {
    const entry = toScoreboardEntry({
        id: 'evt-1',
        pubkey: 'player-hex',
        created_at: 50,
        content: JSON.stringify({ score: 5, level: 1, timestamp: 11 }),
        tags: [
            ['game', 'sammer'],
            ['player', 'player-tag'],
            ['score', '42'],
            ['level', '3'],
            ['timestamp', '99'],
        ],
    });

    assert.deepEqual(entry, {
        createdAt: 50,
        eventId: 'evt-1',
        level: 3,
        playerPubkey: 'player-tag',
        score: 42,
        timestamp: 99,
    });
});

test('toScoreboardEntry falls back to JSON content when tags are absent', () => {
    const entry = toScoreboardEntry({
        id: 'evt-2',
        pubkey: 'player-hex',
        created_at: 88,
        content: JSON.stringify({ game: 'sammer', score: 12, level: 2, timestamp: 70 }),
        tags: [['d', 'sammer-score-2-70']],
    });

    assert.deepEqual(entry, {
        createdAt: 88,
        eventId: 'evt-2',
        level: 2,
        playerPubkey: 'player-hex',
        score: 12,
        timestamp: 70,
    });
});

test('toScoreboardEntry rejects malformed JSON without usable tags', () => {
    const entry = toScoreboardEntry({
        id: 'evt-3',
        pubkey: 'player-hex',
        created_at: 12,
        content: '{not-json',
        tags: [['game', 'sammer']],
    });

    assert.equal(entry, null);
});

test('extractScoreboardEntries sorts by score then level then recency', () => {
    const entries = extractScoreboardEntries([
        {
            id: 'low',
            pubkey: 'a',
            created_at: 10,
            content: JSON.stringify({ score: 5, level: 1, timestamp: 10 }),
            tags: [['d', 'sammer-score-1-10']],
        },
        {
            id: 'high-old',
            pubkey: 'b',
            created_at: 20,
            content: JSON.stringify({ score: 15, level: 1, timestamp: 20 }),
            tags: [['d', 'sammer-score-1-20']],
        },
        {
            id: 'high-new',
            pubkey: 'c',
            created_at: 30,
            content: JSON.stringify({ score: 15, level: 2, timestamp: 30 }),
            tags: [['d', 'sammer-score-2-30']],
        },
        {
            id: 'ignore',
            pubkey: 'd',
            created_at: 40,
            content: JSON.stringify({ score: 500, level: 9, timestamp: 40 }),
            tags: [['game', 'otro-juego']],
        },
    ]);

    assert.deepEqual(entries.map((entry) => entry.eventId), ['high-new', 'high-old', 'low']);
});
