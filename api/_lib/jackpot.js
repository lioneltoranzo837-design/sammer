import { useWebSocketImplementation, SimplePool } from 'nostr-tools/pool';
import { finalizeEvent, getPublicKey, verifyEvent } from 'nostr-tools/pure';
import { nip47 } from 'nostr-tools';
import { decrypt } from 'nostr-tools/nip04';
import { getSatoshisAmountFromBolt11 } from 'nostr-tools/nip57';
import WebSocket from 'ws';

useWebSocketImplementation(WebSocket);

const ENTRY_FEE_SATS = 100;
const JACKPOT_LEDGER_KIND = 30078;
const SCORE_RELAYS = ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://nos.lol'];

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

function getServerSignerSecretKey() {
    return hexToBytes(getRequiredEnv('SAMMER_SERVER_SIGNER_NSEC_HEX'));
}

function getServerSignerPubkey() {
    return getPublicKey(getServerSignerSecretKey());
}

function getGamePubkey() {
    return getRequiredEnv('SAMMER_GAME_PUBKEY');
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
    return {
        amountSats: Number.parseInt(event.tags.find((tag) => tag[0] === 'amount')?.[1] || '0', 10),
        createdAt: Number.parseInt(event.tags.find((tag) => tag[0] === 'timestamp')?.[1] || String(event.created_at || 0), 10),
        playerPubkey: event.tags.find((tag) => tag[0] === 'player')?.[1] || '',
        pubkey: event.pubkey,
        receiptId: event.tags.find((tag) => tag[0] === 'receipt')?.[1] || '',
        type: event.tags.find((tag) => tag[0] === 'type')?.[1] === 'jackpot-claim' ? 'jackpot-claim' : 'entry-loss',
    };
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

    const description = parseZapDescription(receipt);
    if (!description || description.kind !== 9734) {
        throw new Error('Receipt does not contain a valid zap request description.');
    }

    const recipientTag = description.tags?.find((tag) => tag[0] === 'p')?.[1];
    const amountTag = description.tags?.find((tag) => tag[0] === 'amount')?.[1];
    const bolt11 = receipt.tags.find((tag) => tag[0] === 'bolt11')?.[1] || '';
    const playerPubkey = description.pubkey;

    if (recipientTag !== getGamePubkey()) {
        throw new Error('Receipt is not addressed to the game wallet.');
    }

    if (amountTag !== String(ENTRY_FEE_SATS * 1000)) {
        throw new Error('Receipt amount is not the expected 100-sat entry fee.');
    }

    if (getSatoshisAmountFromBolt11(bolt11) !== ENTRY_FEE_SATS) {
        throw new Error('Bolt11 amount does not match the 100-sat entry fee.');
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

export async function publishLossEvent(receiptId, playerPubkey) {
    const pool = createPool();

    try {
        const signedEvent = buildLedgerEvent('entry-loss', ENTRY_FEE_SATS, playerPubkey, receiptId);
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

export async function createWinnerInvoice(playerPubkey, amountSats) {
    const { callback } = await fetchPlayerZapConfig(playerPubkey);
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
