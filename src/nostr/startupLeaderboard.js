// @ts-check

/** @typedef {import('./scoreboardData.js').ScoreboardEntry} ScoreboardEntry */

/**
 * @param {string} playerIdentity
 * @returns {string}
 */
export function shortenPlayerIdentity(playerIdentity) {
    if (playerIdentity.length <= 14) {
        return playerIdentity;
    }

    return `${playerIdentity.slice(0, 10)}...${playerIdentity.slice(-4)}`;
}

/**
 * @param {ScoreboardEntry[]} entries
 * @param {number} limit
 * @param {(playerIdentity: string) => string} [formatIdentity]
 * @returns {{ rank: string, player: string, score: string, level: string }[]}
 */
export function buildStartupLeaderboardRows(entries, limit = 5, formatIdentity = (playerIdentity) => playerIdentity) {
    const sortedEntries = [...entries].sort((left, right) => {
        if (right.score !== left.score) {
            return right.score - left.score;
        }

        if (right.level !== left.level) {
            return right.level - left.level;
        }

        return right.createdAt - left.createdAt;
    });

    return sortedEntries.slice(0, limit).map((entry, index) => ({
        rank: String(index + 1).padStart(2, '0'),
        player: formatIdentity(entry.playerPubkey),
        score: String(entry.score),
        level: `NIVEL ${entry.level}`,
    }));
}
