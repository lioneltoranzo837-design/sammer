import type { ScoreboardEntry } from './scoreboardData.js';
import type { NostrProfile } from './profiles.js';

export interface StartupLeaderboardRow {
    rank: string;
    player: string;
    score: string;
    level: string;
    avatarUrl?: string | undefined;
    displayName?: string | undefined;
}

export function shortenPlayerIdentity(playerIdentity: string): string {
    if (playerIdentity.length <= 14) {
        return playerIdentity;
    }

    return `${playerIdentity.slice(0, 10)}...${playerIdentity.slice(-4)}`;
}

export function buildStartupLeaderboardRows(
    entries: ScoreboardEntry[],
    limit = 5,
    formatIdentity: (playerIdentity: string) => string = (playerIdentity) => playerIdentity,
    profiles?: Map<string, NostrProfile>,
): StartupLeaderboardRow[] {
    const sortedEntries = [...entries].sort((left, right) => {
        if (right.score !== left.score) {
            return right.score - left.score;
        }

        if (right.level !== left.level) {
            return right.level - left.level;
        }

        return right.createdAt - left.createdAt;
    });

    return sortedEntries.slice(0, limit).map((entry, index) => {
        const profile = profiles?.get(entry.playerPubkey);
        const displayName = profile && (profile.displayName || profile.name)
            ? (profile.displayName || profile.name)
            : undefined;
        const avatarUrl = profile?.picture || undefined;
        return {
            rank: String(index + 1).padStart(2, '0'),
            player: formatIdentity(entry.playerPubkey),
            score: String(entry.score),
            level: `NIVEL ${entry.level}`,
            avatarUrl,
            displayName,
        };
    });
}
