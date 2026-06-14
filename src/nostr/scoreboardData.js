// @ts-check

/**
 * @typedef {{
 *   id?: string,
 *   pubkey?: string,
 *   created_at?: number,
 *   content?: string,
 *   tags?: string[][]
 * }} SammerEvent
 */

/**
 * @typedef {{
 *   createdAt: number,
 *   eventId: string,
 *   level: number,
 *   playerPubkey: string,
 *   score: number,
 *   timestamp: number
 * }} ScoreboardEntry
 */

/**
 * @param {string} value
 * @returns {string[]}
 */
export function parseRelays(value) {
    return value
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
}

/**
 * @param {SammerEvent} event
 * @param {string} key
 * @returns {string}
 */
export function tagValue(event, key) {
    return event.tags?.find((tag) => tag[0] === key)?.[1] ?? '';
}

/**
 * @param {SammerEvent} event
 * @returns {boolean}
 */
export function isSammerScoreEvent(event) {
    return (event.tags ?? []).some((tag) => tag[0] === 'game' && tag[1] === 'sammer')
        || (event.tags ?? []).some((tag) => tag[0] === 'd' && typeof tag[1] === 'string' && tag[1].startsWith('sammer-score-'));
}

/**
 * @param {string | number | undefined} value
 * @returns {number | null}
 */
function toFiniteInteger(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.trunc(value);
    }

    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.trim();
    if (!normalized) {
        return null;
    }

    const parsed = Number.parseInt(normalized, 10);
    return Number.isFinite(parsed) ? parsed : null;
}

/**
 * @param {string | undefined} value
 * @returns {Record<string, unknown>}
 */
function parseEventContent(value) {
    if (!value) {
        return {};
    }

    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

/**
 * @param {SammerEvent} event
 * @returns {ScoreboardEntry | null}
 */
export function toScoreboardEntry(event) {
    if (!isSammerScoreEvent(event)) {
        return null;
    }

    const parsedContent = parseEventContent(event.content);
    const playerPubkey = tagValue(event, 'player') || event.pubkey || '';
    const parsedScore = typeof parsedContent.score === 'string' || typeof parsedContent.score === 'number'
        ? parsedContent.score
        : undefined;
    const parsedLevel = typeof parsedContent.level === 'string' || typeof parsedContent.level === 'number'
        ? parsedContent.level
        : undefined;
    const parsedTimestamp = typeof parsedContent.timestamp === 'string' || typeof parsedContent.timestamp === 'number'
        ? parsedContent.timestamp
        : undefined;
    const score = toFiniteInteger(tagValue(event, 'score') || parsedScore);
    const level = toFiniteInteger(tagValue(event, 'level') || parsedLevel);
    const timestamp = toFiniteInteger(tagValue(event, 'timestamp') || parsedTimestamp) ?? 0;
    const createdAt = toFiniteInteger(event.created_at) ?? timestamp;

    if (!playerPubkey || score === null || level === null || createdAt === null) {
        return null;
    }

    return {
        createdAt,
        eventId: event.id ?? '',
        level,
        playerPubkey,
        score,
        timestamp,
    };
}

/**
 * @param {ScoreboardEntry[]} entries
 * @returns {ScoreboardEntry[]}
 */
export function sortScoreboardEntries(entries) {
    return [...entries].sort((left, right) => {
        if (right.score !== left.score) {
            return right.score - left.score;
        }

        if (right.level !== left.level) {
            return right.level - left.level;
        }

        return right.createdAt - left.createdAt;
    });
}

/**
 * @param {SammerEvent[]} events
 * @returns {ScoreboardEntry[]}
 */
export function extractScoreboardEntries(events) {
    return sortScoreboardEntries(
        events
            .map((event) => toScoreboardEntry(event))
            .filter((entry) => entry !== null)
    );
}
