export interface SammerEvent {
    id?: string;
    pubkey?: string;
    created_at?: number;
    content?: string;
    tags?: string[][];
}

export interface ScoreboardEntry {
    createdAt: number;
    eventId: string;
    level: number;
    playerPubkey: string;
    score: number;
    timestamp: number;
}

export function parseRelays(value: string): string[] {
    return value
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
}

export function tagValue(event: SammerEvent, key: string): string {
    return event.tags?.find((tag) => tag[0] === key)?.[1] ?? '';
}

export function isSammerScoreEvent(event: SammerEvent): boolean {
    return (event.tags ?? []).some((tag) => tag[0] === 'game' && tag[1] === 'sammer')
        || (event.tags ?? []).some((tag) => tag[0] === 'd' && typeof tag[1] === 'string' && tag[1].startsWith('sammer-score-'));
}

function toFiniteInteger(value: string | number | undefined): number | null {
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

function parseEventContent(value: string | undefined): Record<string, unknown> {
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

export function toScoreboardEntry(event: SammerEvent): ScoreboardEntry | null {
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

export function sortScoreboardEntries(entries: ScoreboardEntry[]): ScoreboardEntry[] {
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

export function extractScoreboardEntries(events: SammerEvent[]): ScoreboardEntry[] {
    return sortScoreboardEntries(
        events
            .map((event) => toScoreboardEntry(event))
            .filter((entry): entry is ScoreboardEntry => entry !== null)
    );
}
