// @ts-check

/**
 * @typedef {{
 *   amountSats: number,
 *   createdAt: number,
 *   type: 'entry-loss' | 'jackpot-claim'
 * }} JackpotLedgerEvent
 */

/**
 * @typedef {{
 *   entryFeeSats: number,
 *   invoice: string,
 *   invoiceAmountSats: number,
 *   isPaid: boolean,
 *   lastError: string,
 *   status: 'idle' | 'invoice-ready' | 'paying' | 'paid' | 'verifying' | 'error',
 *   verifiedReceiptId: string
 * }} EntryGateState
 */

/**
 * @param {number} entryFeeSats
 * @returns {EntryGateState}
 */
export function createEntryGateState(entryFeeSats) {
    return {
        entryFeeSats,
        invoice: '',
        invoiceAmountSats: 0,
        isPaid: false,
        lastError: '',
        status: 'idle',
        verifiedReceiptId: '',
    };
}

/**
 * @param {EntryGateState} state
 * @returns {boolean}
 */
export function canStartPaidRun(state) {
    return state.isPaid && Boolean(state.verifiedReceiptId);
}

/**
 * @param {JackpotLedgerEvent[]} events
 * @returns {{ currentPotSats: number, lastClaimAt: number }}
 */
export function computeCurrentJackpot(events) {
    const sortedEvents = [...events].sort((left, right) => left.createdAt - right.createdAt);

    let currentPotSats = 0;
    let lastClaimAt = 0;

    sortedEvents.forEach((event) => {
        if (event.type === 'jackpot-claim') {
            currentPotSats = 0;
            lastClaimAt = event.createdAt;
            return;
        }

        currentPotSats += event.amountSats;
    });

    return {
        currentPotSats,
        lastClaimAt,
    };
}
