// NIP-26 delegation helper for kind 78 score publishing.
//
// Al pedir delegacion al usuario una sola vez por sesion, el juego firma
// los eventos de score con una app key local (delegatee) sin volver a
// invocar signEvent. El tag "delegation" identifica al usuario (delegator)
// y la firma schnorr del usuario autoriza al delegatee a publicar en su
// nombre durante la ventana de tiempo acordada.
//
// La spec NIP-26 exige que el delegation token sea una schnorr signature
// sobre SHA256(nostr:delegation:<delegatee pubkey>:<conditions>). NIP-07
// estandar solo firma eventos Nostr, no strings arbitrarios; la extension
// signSchnorr de Alby (desde v1.27) expone exactamente esa primitiva.

export interface Delegation {
    delegatorPubkey: string;
    delegateePubkey: string;
    delegateePrivateKey: Uint8Array;
    conditions: string;
    token: string;
    expiresAt: number;
}

export class DelegationUnavailableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DelegationUnavailableError';
    }
}

const DELEGATION_KIND = 78;
const DELEGATION_TTL_SECONDS = 24 * 60 * 60; // 24h por sesion

interface NostrWindowWithSchnorr {
    signSchnorr?: (msgHashHex: string) => Promise<string>;
}

interface NostrToolsWithSecretKey {
    generateSecretKey: () => Uint8Array;
    getPublicKey: (privateKey: Uint8Array | string) => string;
}

function getNostrWindow(): NostrWindowWithSchnorr {
    return (window as unknown as { nostr?: NostrWindowWithSchnorr }).nostr ?? {};
}

function getNostrTools(): NostrToolsWithSecretKey {
    const tools = (window as unknown as { NostrTools?: NostrToolsWithSecretKey }).NostrTools;
    if (!tools || typeof tools.generateSecretKey !== 'function' || typeof tools.getPublicKey !== 'function') {
        throw new Error('nostr-tools no disponible para generar la app key de delegacion');
    }
    return tools;
}

function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let hex = '';
    for (let i = 0; i < view.length; i++) {
        hex += (view[i] ?? 0).toString(16).padStart(2, '0');
    }
    return hex;
}

async function sha256Hex(text: string): Promise<string> {
    const data = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return bytesToHex(digest);
}

export function isSignSchnorrAvailable(): boolean {
    return typeof getNostrWindow().signSchnorr === 'function';
}

export function generateAppKey(): { pubkey: string; privateKey: Uint8Array } {
    const tools = getNostrTools();
    const privateKey = tools.generateSecretKey();
    const pubkey = tools.getPublicKey(privateKey);
    if (!pubkey || !/^[a-f0-9]{64}$/i.test(pubkey)) {
        throw new Error('getPublicKey retorno un valor invalido para la app key');
    }
    return { pubkey, privateKey };
}

export function buildConditions(fromTs: number, toTs: number): string {
    return `kind=${DELEGATION_KIND}&created_at>${fromTs}&created_at<${toTs}`;
}

export function buildDelegationString(delegateePubkey: string, conditions: string): string {
    return `nostr:delegation:${delegateePubkey}:${conditions}`;
}

export async function requestDelegation(delegatorPubkey: string): Promise<Delegation> {
    const signer = getNostrWindow();
    if (typeof signer.signSchnorr !== 'function') {
        throw new DelegationUnavailableError(
            'Tu extension Nostr no expone signSchnorr (NIP-26). ' +
            'Se firmara cada score con signEvent como respaldo.'
        );
    }
    const { pubkey: delegateePubkey, privateKey: delegateePrivateKey } = generateAppKey();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + DELEGATION_TTL_SECONDS;
    const conditions = buildConditions(now, expiresAt);
    const delegationString = buildDelegationString(delegateePubkey, conditions);
    const msgHash = await sha256Hex(delegationString);
    const token = await signer.signSchnorr(msgHash);
    if (!token || !/^[a-f0-9]{128}$/i.test(token)) {
        throw new DelegationUnavailableError('La extension retorno un token de delegacion invalido');
    }
    return { delegatorPubkey, delegateePubkey, delegateePrivateKey, conditions, token, expiresAt };
}

export function isDelegationActive(delegation: Delegation | null): delegation is Delegation {
    if (!delegation) {
        return false;
    }
    return Math.floor(Date.now() / 1000) < delegation.expiresAt;
}

export function buildDelegationTag(delegation: Delegation): string[] {
    return ['delegation', delegation.delegatorPubkey, delegation.conditions, delegation.token];
}
