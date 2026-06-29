import { useWebSocketImplementation, SimplePool } from 'nostr-tools/pool';
import { finalizeEvent, getPublicKey, verifyEvent } from 'nostr-tools/pure';
import { nip19, nip47 } from 'nostr-tools';
import { decrypt, encrypt } from 'nostr-tools/nip04';
import { getSatoshisAmountFromBolt11 } from 'nostr-tools/nip57';
import WebSocket from 'ws';

useWebSocketImplementation(WebSocket);

const DEFAULT_ENTRY_FEE_SATS = 100;
const JACKPOT_CONTRIBUTION_BASIS_POINTS = 9000;
const JACKPOT_LEDGER_KIND = 30078;
const SCORE_RELAYS = ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://nos.lol'];

function resolveEntryFeeSats() {
    const raw = (process.env.SAMMER_ENTRY_FEE_SATS || process.env.ENTRY_FEE_SATS || '').trim();
    if (!raw) {
        return DEFAULT_ENTRY_FEE_SATS;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid entry fee sats (SAMMER_ENTRY_FEE_SATS / ENTRY_FEE_SATS): ${raw}`);
    }
    return parsed;
}

const ENTRY_FEE_SATS = resolveEntryFeeSats();

function getRequiredEnv(name) {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`Missing required env var: ${name}`);
    }
    return value;
}

function hexToBytes(hex) {
    return Uint8Array.from(Buffer.from(hex, 'hex'));
}

function decodeSecretKey(input) {
    const trimmed = input.trim();
    if (trimmed.startsWith('nsec1')) {
        const decoded = nip19.decode(trimmed);
        if (decoded.type !== 'nsec' || !(decoded.data instanceof Uint8Array)) {
            throw new Error('Invalid nsec: expected 32-byte secret key');
        }
        return decoded.data;
    }
    const bytes = hexToBytes(trimmed);
    if (bytes.length !== 32) {
        throw new Error(`Invalid secret key hex: expected 32 bytes, got ${bytes.length}`);
    }
    return bytes;
}

function decodePubkey(input) {
    const trimmed = input.trim();
    if (trimmed.startsWith('npub1')) {
        const decoded = nip19.decode(trimmed);
        if (decoded.type !== 'npub' || typeof decoded.data !== 'string') {
            throw new Error('Invalid npub: expected 32-byte pubkey');
        }
        return decoded.data;
    }
    const bytes = hexToBytes(trimmed);
    if (bytes.length !== 32) {
        throw new Error(`Invalid pubkey hex: expected 32 bytes, got ${bytes.length}`);
    }
    return bytes.toString('hex');
}

function getServerSignerSecretKey() {
    return decodeSecretKey(getRequiredEnv('SAMMER_SERVER_SIGNER_NSEC_HEX'));
}

function getServerSignerPubkey() {
    return getPublicKey(getServerSignerSecretKey());
}

export function getGamePubkey() {
    return decodePubkey(getRequiredEnv('SAMMER_GAME_PUBKEY'));
}

function getGameNwcConnection() {
    return nip47.parseConnectionString(getRequiredEnv('SAMMER_GAME_NWC_URI'));
}

function createPool() {
    return new SimplePool({ enablePing: true, enableReconnect: true });
}

function jsonResponse(res, statusCode, payload) {
    res.statusCode = statusCode;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(payload));
}

function tagValue(event, key) {
    return event.tags?.find((tag) => tag[0] === key)?.[1] || '';
}

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

function parseScoreContent(value) {
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

function isSammerScoreEvent(event) {
    return (event.tags || []).some((tag) => tag[0] === 'game' && tag[1] === 'sammer')
        || (event.tags || []).some((tag) => tag[0] === 'd' && typeof tag[1] === 'string' && tag[1].startsWith('sammer-score-'));
}

function toScoreboardEntry(event) {
    if (!isSammerScoreEvent(event)) {
        return null;
    }

    const parsedContent = parseScoreContent(event.content);
    const parsedScore = typeof parsedContent.score === 'string' || typeof parsedContent.score === 'number'
        ? parsedContent.score
        : undefined;
    const parsedLevel = typeof parsedContent.level === 'string' || typeof parsedContent.level === 'number'
        ? parsedContent.level
        : undefined;
    const parsedTimestamp = typeof parsedContent.timestamp === 'string' || typeof parsedContent.timestamp === 'number'
        ? parsedContent.timestamp
        : undefined;
    const playerPubkey = tagValue(event, 'player') || event.pubkey || '';
    const score = toFiniteInteger(tagValue(event, 'score') || parsedScore);
    const level = toFiniteInteger(tagValue(event, 'level') || parsedLevel);
    const timestamp = toFiniteInteger(tagValue(event, 'timestamp') || parsedTimestamp) ?? 0;
    const createdAt = toFiniteInteger(event.created_at) ?? timestamp;

    if (!playerPubkey || score === null || level === null || createdAt === null) {
        return null;
    }

    return {
        createdAt,
        eventId: event.id || '',
        level,
        playerPubkey,
        score,
        timestamp,
    };
}

function sortScoreboardEntries(entries) {
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

export function computeJackpotContributionSats(entryFeeSats) {
    return Math.floor((entryFeeSats * JACKPOT_CONTRIBUTION_BASIS_POINTS) / 10000);
}

export async function readJsonBody(req) {
    if (typeof req.body === 'object' && req.body !== null) {
        return req.body;
    }

    const chunks = [];
    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    return raw ? JSON.parse(raw) : {};
}

export function sendMethodNotAllowed(res) {
    return jsonResponse(res, 405, { error: 'Method not allowed' });
}

export function sendServerError(res, error) {
    return jsonResponse(res, 500, { error: error.message || 'Internal server error' });
}

export function buildLedgerEvent(type, amountSats, playerPubkey, receiptId) {
    const now = Math.floor(Date.now() / 1000);
    const serverPubkey = getServerSignerPubkey();

    return finalizeEvent({
        kind: JACKPOT_LEDGER_KIND,
        content: JSON.stringify({ amountSats, game: 'sammer', receiptId, type, playerPubkey }),
        created_at: now,
        tags: [
            ['d', `sammer-jackpot-${type}-${receiptId || now}`],
            ['game', 'sammer'],
            ['ledger', 'jackpot'],
            ['type', type],
            ['amount', String(amountSats)],
            ['p', getGamePubkey()],
            ['player', playerPubkey],
            ['receipt', receiptId],
            ['timestamp', String(now)],
        ],
    }, getServerSignerSecretKey());
}

export function parseZapDescription(receipt) {
    const descriptionTag = receipt.tags.find((tag) => tag[0] === 'description')?.[1];
    if (!descriptionTag) {
        return null;
    }

    try {
        return JSON.parse(descriptionTag);
    } catch {
        return null;
    }
}

export function parseLedgerEvent(event) {
    const rawType = event.tags.find((tag) => tag[0] === 'type')?.[1];
    return {
        amountSats: Number.parseInt(event.tags.find((tag) => tag[0] === 'amount')?.[1] || '0', 10),
        createdAt: Number.parseInt(event.tags.find((tag) => tag[0] === 'timestamp')?.[1] || String(event.created_at || 0), 10),
        playerPubkey: event.tags.find((tag) => tag[0] === 'player')?.[1] || '',
        pubkey: event.pubkey,
        receiptId: event.tags.find((tag) => tag[0] === 'receipt')?.[1] || '',
        type: rawType === 'jackpot-claim' ? 'jackpot-claim' : (rawType === 'claim-lock' ? 'claim-lock' : 'entry-loss'),
    };
}

export function resolveLightningAddress(value) {
    const lightningAddress = (value || '').trim().toLowerCase();
    const [name, domain, extra] = lightningAddress.split('@');
    if (!name || !domain || extra || /[\s/]/.test(name) || /[\s/]/.test(domain)) {
        throw new Error('Lightning address is invalid.');
    }

    return { domain, lightningAddress, name };
}

export async function fetchGameZapConfig() {
    const lightningAddress = (process.env.SAMMER_GAME_LIGHTNING_ADDRESS || '').trim();

    if (lightningAddress) {
        const [name, domain] = lightningAddress.split('@');
        const lnurlUrl = new URL(`/.well-known/lnurlp/${name}`, `https://${domain}`).toString();
        const response = await fetch(lnurlUrl);
        const payload = await response.json();
        if (!payload?.allowsNostr || !payload?.nostrPubkey) {
            throw new Error('Game LNURL endpoint does not support Nostr zaps.');
        }

        return {
            providerPubkey: payload.nostrPubkey,
        };
    }

    const pool = createPool();

    try {
        const profileEvents = await pool.querySync(SCORE_RELAYS, {
            authors: [getGamePubkey()],
            kinds: [0],
            limit: 1,
        });
        const profileEvent = (profileEvents || []).sort((left, right) => right.created_at - left.created_at)[0];
        if (!profileEvent) {
            throw new Error('Game metadata not found on configured relays.');
        }

        const profile = JSON.parse(profileEvent.content || '{}');
        if (!profile.lud16 || typeof profile.lud16 !== 'string' || !profile.lud16.includes('@')) {
            throw new Error('Game metadata does not expose a valid lud16.');
        }

        const [name, domain] = profile.lud16.split('@');
        const lnurlUrl = new URL(`/.well-known/lnurlp/${name}`, `https://${domain}`).toString();
        const response = await fetch(lnurlUrl);
        const payload = await response.json();
        if (!payload?.allowsNostr || !payload?.nostrPubkey) {
            throw new Error('Game LNURL endpoint does not support Nostr zaps.');
        }

        return {
            providerPubkey: payload.nostrPubkey,
        };
    } finally {
        pool.close(SCORE_RELAYS);
    }
}

export async function fetchReceiptById(receiptId) {
    const pool = createPool();

    try {
        const receipts = await pool.querySync(SCORE_RELAYS, { ids: [receiptId], kinds: [9735], limit: 1 });
        return (receipts || [])[0] || null;
    } finally {
        pool.close(SCORE_RELAYS);
    }
}

export async function verifyEntryReceipt(receiptId, expectedPlayerPubkey) {
    const receipt = await fetchReceiptById(receiptId);
    if (!receipt) {
        throw new Error('Receipt not found on configured relays.');
    }

    if (!verifyEvent(receipt)) {
        throw new Error('Receipt event signature is invalid.');
    }

    const description = parseZapDescription(receipt);
    if (!description || description.kind !== 9734) {
        throw new Error('Receipt does not contain a valid zap request description.');
    }

    if (!verifyEvent(description)) {
        throw new Error('Embedded zap request signature is invalid.');
    }

    const recipientTag = description.tags?.find((tag) => tag[0] === 'p')?.[1];
    const amountTag = description.tags?.find((tag) => tag[0] === 'amount')?.[1];
    const bolt11 = receipt.tags.find((tag) => tag[0] === 'bolt11')?.[1] || '';
    const playerPubkey = description.pubkey;
    const zapConfig = await fetchGameZapConfig();

    if (receipt.pubkey !== zapConfig.providerPubkey) {
        throw new Error('Receipt was not signed by the game LNURL provider.');
    }

    if (recipientTag !== getGamePubkey()) {
        throw new Error('Receipt is not addressed to the game wallet.');
    }

    if (amountTag !== String(ENTRY_FEE_SATS * 1000)) {
        throw new Error(`Receipt amount is not the expected ${ENTRY_FEE_SATS}-sat entry fee.`);
    }

    if (getSatoshisAmountFromBolt11(bolt11) !== ENTRY_FEE_SATS) {
        throw new Error(`Bolt11 amount does not match the ${ENTRY_FEE_SATS}-sat entry fee.`);
    }

    if (expectedPlayerPubkey && playerPubkey !== expectedPlayerPubkey) {
        throw new Error('Receipt payer does not match the claimed player pubkey.');
    }

    return {
        playerPubkey,
        receipt,
    };
}

export async function listLedgerEvents() {
    const pool = createPool();

    try {
        const events = await pool.querySync(SCORE_RELAYS, {
            authors: [getServerSignerPubkey()],
            kinds: [JACKPOT_LEDGER_KIND],
            '#p': [getGamePubkey()],
            limit: 500,
        });
        return (events || []).map(parseLedgerEvent).sort((left, right) => left.createdAt - right.createdAt);
    } finally {
        pool.close(SCORE_RELAYS);
    }
}

export async function listScoreboardEntries() {
    const pool = createPool();

    try {
        const events = await pool.querySync(SCORE_RELAYS, {
            kinds: [78],
            '#p': [getGamePubkey()],
            limit: 500,
        });
        return sortScoreboardEntries(
            (events || [])
                .map((event) => toScoreboardEntry(event))
                .filter((entry) => entry !== null)
        );
    } finally {
        pool.close(SCORE_RELAYS);
    }
}

export function computePotFromLedger(events) {
    let currentPotSats = 0;

    for (const event of events) {
        if (event.type === 'jackpot-claim') {
            currentPotSats = 0;
            continue;
        }

        currentPotSats += event.amountSats;
    }

    return currentPotSats;
}

export async function hasLossEventForReceipt(receiptId) {
    const events = await listLedgerEvents();
    return events.some((event) => event.type === 'entry-loss' && event.receiptId === receiptId);
}

export async function hasClaimLockOrClaim(receiptId) {
    const events = await listLedgerEvents();
    return events.some((event) => (event.type === 'claim-lock' || event.type === 'jackpot-claim') && event.receiptId === receiptId);
}

export function verifyBossVictoryProof(victoryProof, playerPubkey, receiptId) {
    if (!victoryProof || typeof victoryProof !== 'object') {
        throw new Error('Missing boss victory proof event.');
    }

    if (!verifyEvent(victoryProof)) {
        throw new Error('Boss victory proof signature is invalid.');
    }

    if (victoryProof.pubkey !== playerPubkey) {
        throw new Error('Boss victory proof does not belong to the winner pubkey.');
    }

    if (victoryProof.kind !== 39001) {
        throw new Error('Boss victory proof kind is invalid.');
    }

    const gameTag = victoryProof.tags.find((tag) => tag[0] === 'game')?.[1];
    const resultTag = victoryProof.tags.find((tag) => tag[0] === 'result')?.[1];
    const receiptTag = victoryProof.tags.find((tag) => tag[0] === 'receipt')?.[1];
    const levelTag = victoryProof.tags.find((tag) => tag[0] === 'level')?.[1];

    if (gameTag !== 'sammer' || resultTag !== 'boss-win' || receiptTag !== receiptId || levelTag !== '4') {
        throw new Error('Boss victory proof tags are invalid.');
    }

    return true;
}

export function verifyLeaderboardTopProof(scoreProof, playerPubkey, receiptId, leaderboardEntries, expectedGamePubkey = '') {
    if (!scoreProof || typeof scoreProof !== 'object') {
        throw new Error('Missing leaderboard score proof event.');
    }

    if (!verifyEvent(scoreProof)) {
        throw new Error('Leaderboard score proof signature is invalid.');
    }

    if (scoreProof.pubkey !== playerPubkey) {
        throw new Error('Leaderboard score proof does not belong to the winner pubkey.');
    }

    if (scoreProof.kind !== 78) {
        throw new Error('Leaderboard score proof kind is invalid.');
    }

    const gameTag = tagValue(scoreProof, 'game');
    const playerTag = tagValue(scoreProof, 'player');
    const receiptTag = tagValue(scoreProof, 'receipt');
    if (gameTag !== 'sammer' || playerTag !== playerPubkey || receiptTag !== receiptId) {
        throw new Error('Leaderboard score proof tags are invalid.');
    }
    if (expectedGamePubkey && !(scoreProof.tags || []).some((tag) => tag[0] === 'p' && tag[1] === expectedGamePubkey)) {
        throw new Error('Leaderboard score proof is not addressed to the game pubkey.');
    }

    const proofEntry = toScoreboardEntry(scoreProof);
    if (!proofEntry) {
        throw new Error('Leaderboard score proof is missing score data.');
    }

    const rankedEntries = sortScoreboardEntries([
        ...leaderboardEntries,
        proofEntry,
    ]);
    const topEntry = rankedEntries[0];
    if (!topEntry || topEntry.playerPubkey !== playerPubkey || topEntry.score !== proofEntry.score) {
        throw new Error('Winner is not the current #1 leaderboard score.');
    }

    return true;
}

export async function publishLossEvent(receiptId, playerPubkey) {
    const pool = createPool();

    try {
        const signedEvent = buildLedgerEvent('entry-loss', computeJackpotContributionSats(ENTRY_FEE_SATS), playerPubkey, receiptId);
        await Promise.allSettled(pool.publish(SCORE_RELAYS, signedEvent));
        return signedEvent.id;
    } finally {
        pool.close(SCORE_RELAYS);
    }
}

export async function publishClaimLockEvent(receiptId, playerPubkey) {
    const pool = createPool();

    try {
        const signedEvent = buildLedgerEvent('claim-lock', 0, playerPubkey, receiptId);
        await Promise.allSettled(pool.publish(SCORE_RELAYS, signedEvent));
        return signedEvent.id;
    } finally {
        pool.close(SCORE_RELAYS);
    }
}

export async function sendNwcPayInvoice(invoice) {
    const connection = getGameNwcConnection();
    const secretKey = hexToBytes(connection.secret);
    const clientPubkey = getPublicKey(secretKey);
    const requestEvent = await nip47.makeNwcRequestEvent(connection.pubkey, secretKey, invoice);
    const pool = createPool();

    try {
        await Promise.allSettled(pool.publish(connection.relays, requestEvent));
        const responses = await pool.querySync(connection.relays, {
            kinds: [23195],
            authors: [connection.pubkey],
            '#p': [clientPubkey],
            limit: 20,
        });
        const matchingResponse = (responses || [])
            .sort((left, right) => right.created_at - left.created_at)
            .find((response) => response.tags.some((tag) => tag[0] === 'e' && tag[1] === requestEvent.id));

        if (!matchingResponse) {
            throw new Error('NWC wallet did not return a pay_invoice response.');
        }

        const decrypted = decrypt(secretKey, connection.pubkey, matchingResponse.content);
        const parsed = JSON.parse(decrypted);
        if (parsed.error) {
            throw new Error(parsed.error.message || 'NWC wallet rejected the payout request.');
        }

        return parsed.result;
    } finally {
        pool.close(connection.relays);
    }
}

export async function fetchWalletBalanceSats() {
    const connection = getGameNwcConnection();
    const secretKey = hexToBytes(connection.secret);
    const clientPubkey = getPublicKey(secretKey);

    const payload = JSON.stringify({ method: 'get_balance', params: {} });
    const encryptedContent = encrypt(secretKey, connection.pubkey, payload);
    const requestEvent = finalizeEvent({
        kind: 23194,
        created_at: Math.round(Date.now() / 1000),
        content: encryptedContent,
        tags: [['p', connection.pubkey]],
    }, secretKey);

    const pool = createPool();

    try {
        await Promise.allSettled(pool.publish(connection.relays, requestEvent));
        const responses = await pool.querySync(connection.relays, {
            kinds: [23195],
            authors: [connection.pubkey],
            '#p': [clientPubkey],
            limit: 20,
        });
        const matchingResponse = (responses || [])
            .sort((left, right) => right.created_at - left.created_at)
            .find((response) => response.tags.some((tag) => tag[0] === 'e' && tag[1] === requestEvent.id));

        if (!matchingResponse) {
            throw new Error('NWC wallet did not return a get_balance response.');
        }

        const decrypted = decrypt(secretKey, connection.pubkey, matchingResponse.content);
        const parsed = JSON.parse(decrypted);
        if (parsed.error) {
            throw new Error(parsed.error.message || 'NWC wallet rejected the get_balance request.');
        }

        return Math.floor((parsed.result?.balance || 0) / 1000);
    } finally {
        pool.close(connection.relays);
    }
}

export async function fetchPlayerZapConfig(playerPubkey) {
    const pool = createPool();

    try {
        const profileEvents = await pool.querySync(SCORE_RELAYS, {
            authors: [playerPubkey],
            kinds: [0],
            limit: 1,
        });
        const profileEvent = (profileEvents || []).sort((left, right) => right.created_at - left.created_at)[0];
        if (!profileEvent) {
            throw new Error('Winner metadata not found on configured relays.');
        }

        const profile = JSON.parse(profileEvent.content || '{}');
        if (!profile.lud16 || typeof profile.lud16 !== 'string' || !profile.lud16.includes('@')) {
            throw new Error('Winner does not expose a valid lud16 for jackpot payout.');
        }

        const [name, domain] = profile.lud16.split('@');
        const lnurlUrl = new URL(`/.well-known/lnurlp/${name}`, `https://${domain}`).toString();
        const response = await fetch(lnurlUrl);
        const lnurlData = await response.json();
        if (!lnurlData?.allowsNostr || !lnurlData?.callback || !lnurlData?.nostrPubkey) {
            throw new Error('Winner LNURL endpoint does not support Nostr zaps.');
        }

        return {
            callback: lnurlData.callback,
            providerPubkey: lnurlData.nostrPubkey,
        };
    } finally {
        pool.close(SCORE_RELAYS);
    }
}

export async function fetchLightningAddressZapConfig(lightningAddress) {
    const resolved = resolveLightningAddress(lightningAddress);
    const lnurlUrl = new URL(`/.well-known/lnurlp/${resolved.name}`, `https://${resolved.domain}`).toString();
    const response = await fetch(lnurlUrl);
    const lnurlData = await response.json();
    if (!lnurlData?.allowsNostr || !lnurlData?.callback || !lnurlData?.nostrPubkey) {
        throw new Error('Winner LNURL endpoint does not support Nostr zaps.');
    }

    return {
        callback: lnurlData.callback,
        providerPubkey: lnurlData.nostrPubkey,
    };
}

export async function createWinnerInvoice(playerPubkey, amountSats, winnerLightningAddress = '') {
    const { callback } = winnerLightningAddress
        ? await fetchLightningAddressZapConfig(winnerLightningAddress)
        : await fetchPlayerZapConfig(playerPubkey);
    const amountMillisats = amountSats * 1000;
    const now = Math.floor(Date.now() / 1000);
    const unsignedEvent = {
        kind: 9734,
        created_at: now,
        content: 'Sammer jackpot payout',
        tags: [
            ['p', playerPubkey],
            ['amount', String(amountMillisats)],
            ['relays', ...SCORE_RELAYS],
        ],
    };
    const signedEvent = finalizeEvent(unsignedEvent, getServerSignerSecretKey());
    const response = await fetch(`${callback}?amount=${amountMillisats}&nostr=${encodeURIComponent(JSON.stringify(signedEvent))}`);
    const payload = await response.json();
    if (!payload?.pr || typeof payload.pr !== 'string') {
        throw new Error('Winner payout invoice was not generated.');
    }

    return {
        invoice: payload.pr,
        signedEvent,
    };
}

export async function publishClaimEvent(receiptId, playerPubkey, amountSats) {
    const pool = createPool();

    try {
        const signedEvent = buildLedgerEvent('jackpot-claim', amountSats, playerPubkey, receiptId);
        await Promise.allSettled(pool.publish(SCORE_RELAYS, signedEvent));
        return signedEvent.id;
    } finally {
        pool.close(SCORE_RELAYS);
    }
}

export { ENTRY_FEE_SATS, SCORE_RELAYS, jsonResponse };
