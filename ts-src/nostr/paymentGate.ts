export interface JackpotLedgerEvent {
    amountSats: number;
    createdAt: number;
    type: 'entry-loss' | 'jackpot-claim';
}

export interface EntryGateState {
    entryFeeSats: number;
    invoice: string;
    invoiceAmountSats: number;
    isPaid: boolean;
    lastError: string;
    status: 'idle' | 'invoice-ready' | 'paying' | 'paid' | 'verifying' | 'error';
    verifiedReceiptId: string;
}

export function createEntryGateState(entryFeeSats: number): EntryGateState {
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

export function canStartPaidRun(state: EntryGateState): boolean {
    return state.isPaid && Boolean(state.verifiedReceiptId);
}

export function computeCurrentJackpot(events: JackpotLedgerEvent[]): { currentPotSats: number; lastClaimAt: number } {
    const sortedEvents = [...events].sort((left, right) => left.createdAt - right.createdAt);

    let currentPotSats = 0;
    let lastClaimAt = 0;

    sortedEvents.forEach((event) => {
        if (event.type === 'jackpot-claim') {
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
