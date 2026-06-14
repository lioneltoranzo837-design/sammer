import {
    computePotFromLedger,
    createWinnerInvoice,
    jsonResponse,
    listLedgerEvents,
    publishClaimEvent,
    readJsonBody,
    sendMethodNotAllowed,
    sendNwcPayInvoice,
    sendServerError,
} from '../_lib/jackpot.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return sendMethodNotAllowed(res);
    }

    try {
        const body = await readJsonBody(req);
        const { winnerPubkey = '' } = body;
        if (!winnerPubkey) {
            throw new Error('winnerPubkey is required.');
        }

        const events = await listLedgerEvents();
        const currentPotSats = computePotFromLedger(events);
        if (currentPotSats <= 0) {
            return jsonResponse(res, 200, { ok: true, currentPotSats: 0, skipped: true });
        }

        const { invoice, signedEvent } = await createWinnerInvoice(winnerPubkey, currentPotSats);
        await sendNwcPayInvoice(invoice);
        const claimEventId = await publishClaimEvent(signedEvent.id, winnerPubkey, currentPotSats);

        return jsonResponse(res, 200, {
            ok: true,
            claimEventId,
            currentPotSats,
            winnerPubkey,
        });
    } catch (error) {
        return sendServerError(res, error);
    }
}
