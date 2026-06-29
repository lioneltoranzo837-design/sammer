export interface NostrProfile {
    pubkey: string;
    name: string;
    displayName: string;
    picture: string;
    about: string;
    nip05: string;
}

export interface ProfileEventLike {
    pubkey?: string;
    created_at?: number;
    content?: string;
}

export interface ProfilePoolLike {
    querySync(relays: string[], filter: Record<string, unknown>): Promise<ProfileEventLike[]>;
}

function asString(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

export function parseProfileEvent(event: ProfileEventLike): NostrProfile | null {
    if (!event.pubkey) {
        return null;
    }

    let data: Record<string, unknown> = {};
    try {
        const parsed = JSON.parse(event.content || '{}');
        data = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed as Record<string, unknown>
            : {};
    } catch {
        return null;
    }

    return {
        pubkey: event.pubkey,
        name: asString(data.name),
        displayName: asString(data.display_name ?? data.displayName),
        picture: asString(data.picture ?? data.image),
        about: asString(data.about),
        nip05: asString(data.nip05),
    };
}

export async function fetchProfilesMap(
    pool: ProfilePoolLike,
    relays: string[],
    pubkeys: string[],
): Promise<Map<string, NostrProfile>> {
    const map = new Map<string, NostrProfile>();
    const uniquePubkeys = [...new Set(pubkeys.filter((pk) => /^[a-f0-9]{64}$/i.test(pk)))];
    if (uniquePubkeys.length === 0) {
        return map;
    }

    let events: ProfileEventLike[] = [];
    try {
        events = await pool.querySync(relays, {
            kinds: [0],
            authors: uniquePubkeys,
        });
    } catch {
        return map;
    }

    const latestCreatedAt = new Map<string, number>();
    for (const event of events || []) {
        const profile = parseProfileEvent(event);
        if (!profile) {
            continue;
        }
        const createdAt = event.created_at ?? 0;
        const prevCreatedAt = latestCreatedAt.get(profile.pubkey) ?? -1;
        if (createdAt >= prevCreatedAt) {
            latestCreatedAt.set(profile.pubkey, createdAt);
            map.set(profile.pubkey, profile);
        }
    }
    return map;
}

export async function fetchSingleProfile(
    pool: ProfilePoolLike,
    relays: string[],
    pubkey: string,
): Promise<NostrProfile | null> {
    const map = await fetchProfilesMap(pool, relays, [pubkey]);
    return map.get(pubkey) ?? null;
}

export function resolveDisplayName(profile: NostrProfile | undefined | null, fallback: string): string {
    if (!profile) {
        return fallback;
    }
    const name = profile.displayName || profile.name;
    return name || fallback;
}

export function resolveAvatarUrl(profile: NostrProfile | undefined | null): string {
    return profile?.picture || '';
}
