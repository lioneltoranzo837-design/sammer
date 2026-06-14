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
export function canStartPaidRun(state) {
    return state.isPaid && Boolean(state.verifiedReceiptId);
}
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
