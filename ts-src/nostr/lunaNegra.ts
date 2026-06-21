export interface LunaNegraSession {
    token: string;
    npub: string;
    pubkey: string;
    displayName: string;
    avatarUrl: string;
    gameId: string;
}

export interface LunaNegraLeaderboardRow {
    rank: string;
    player: string;
    score: string;
    level: string;
}

export function normalizeLunaNegraBaseUrl(baseUrl: string): string {
    return String(baseUrl || '').replace(/\/+$/, '');
}

export function buildLunaNegraSessionUrl(baseUrl: string): string {
    return `${normalizeLunaNegraBaseUrl(baseUrl)}/api/v1/session`;
}

export function buildLunaNegraLeaderboardUrl(baseUrl: string, leaderboardName: string): string {
    const encodedName = encodeURIComponent(leaderboardName);
    return `${normalizeLunaNegraBaseUrl(baseUrl)}/api/v1/leaderboards/${encodedName}?window=all&view=top`;
}

export function buildLunaNegraScoresUrl(baseUrl: string, leaderboardName: string): string {
    const encodedName = encodeURIComponent(leaderboardName);
    return `${normalizeLunaNegraBaseUrl(baseUrl)}/api/v1/leaderboards/${encodedName}/scores`;
}

export function getLunaNegraTokenFromSearch(search: string): string {
    return new URLSearchParams(search).get('lnToken') || '';
}

export function removeLunaNegraTokenFromUrl(url: string): string {
    const nextUrl = new URL(url);
    nextUrl.searchParams.delete('lnToken');
    const search = nextUrl.searchParams.toString();
    return `${nextUrl.pathname}${search ? `?${search}` : ''}${nextUrl.hash}`;
}

export function normalizeLunaNegraSession(payload: unknown, token: string): LunaNegraSession {
    const root = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
    const nested = root.session || root.user || root.player || root;
    const source = nested && typeof nested === 'object' ? nested as Record<string, unknown> : {};
    const game = source.game && typeof source.game === 'object' ? source.game as Record<string, unknown> : {};
    return {
        token,
        npub: String(source.npub || source.nostrNpub || ''),
        pubkey: String(source.pubkey || source.publicKey || source.nostrPubkey || ''),
        displayName: String(source.displayName || source.name || source.username || source.handle || 'OPERADOR LUNA NEGRA'),
        avatarUrl: String(source.avatarUrl || source.picture || source.image || ''),
        gameId: String(source.gameId || game.id || '')
    };
}

function firstArray(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'object') return [];
    const record = value as Record<string, unknown>;
    for (const key of ['entries', 'scores', 'leaderboard', 'data']) {
        if (Array.isArray(record[key])) return record[key];
    }
    return [];
}

export function buildLunaNegraLeaderboardRows(payload: unknown, limit = 5): LunaNegraLeaderboardRow[] {
    return firstArray(payload).slice(0, limit).map((rawEntry, index) => {
        const entry = rawEntry && typeof rawEntry === 'object' ? rawEntry as Record<string, unknown> : {};
        const rawPlayer = entry.player || entry.user || entry.profile;
        const player = rawPlayer && typeof rawPlayer === 'object' ? rawPlayer as Record<string, unknown> : {};
        const displayName = entry.displayName || entry.name || entry.username || player.displayName || player.name || player.username || entry.npub || entry.pubkey || 'OPERADOR';
        const score = entry.score ?? entry.points ?? entry.value ?? 0;
        return {
            rank: String(entry.rank || index + 1).padStart(2, '0'),
            player: String(displayName),
            score: String(score),
            level: 'LUNA NEGRA'
        };
    });
}
