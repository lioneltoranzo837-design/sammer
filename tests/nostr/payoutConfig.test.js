import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveGamePayoutNwcUri } from '../../src/nostr/payoutConfig.js';

test('runtime payout config wins over baked config', () => {
    assert.equal(
        resolveGamePayoutNwcUri('nostr+walletconnect://from-config', 'nostr+walletconnect://from-runtime', ''),
        'nostr+walletconnect://from-runtime',
    );
});

test('meta payout config wins when runtime config is absent', () => {
    assert.equal(
        resolveGamePayoutNwcUri('nostr+walletconnect://from-config', '', 'nostr+walletconnect://from-meta'),
        'nostr+walletconnect://from-meta',
    );
});

test('returns empty string when no payout config exists', () => {
    assert.equal(resolveGamePayoutNwcUri('', '   ', ''), '');
});
