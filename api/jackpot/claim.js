import {
    computePotFromLedger,
    createWinnerInvoice,
    hasLossEventForReceipt,
    jsonResponse,
    listLedgerEvents,
    publishClaimEvent,
    readJsonBody,
    sendMethodNotAllowed,
    sendNwcPayInvoice,
    sendServerError,
    verifyBossVictoryProof,
    verifyEntryReceipt,
} from '../_lib/jackpot.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return sendMethodNotAllowed(res);
    }

    try {
        const body = await readJsonBody(req);
        const { winnerPubkey = '', receiptId = '', victoryProof = null } = body;
        if (!winnerPubkey || !receiptId) {
            throw new Error('winnerPubkey and receiptId are required.');
        }

        await verifyEntryReceipt(receiptId, winnerPubkey);
        if (await hasLossEventForReceipt(receiptId)) {
            throw new Error('This paid run already lost and cannot claim the jackpot.');
        }
        verifyBossVictoryProof(victoryProof, winnerPubkey, receiptId);

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
