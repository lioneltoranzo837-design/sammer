export function resolveGamePayoutNwcUri(configValue = '', runtimeValue = '', metaValue = '') {
    const candidates = [runtimeValue, metaValue, configValue];
    for (const candidate of candidates) {
        const normalized = candidate.trim();
        if (normalized) {
            return normalized;
        }
    }
    return '';
}
