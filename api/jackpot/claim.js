import {
    computePotFromLedger,
    createWinnerInvoice,
    getGamePubkey,
    hasClaimLockOrClaim,
    hasLossEventForReceipt,
    jsonResponse,
    listLedgerEvents,
    listScoreboardEntries,
    publishClaimLockEvent,
    publishClaimEvent,
    readJsonBody,
    sendMethodNotAllowed,
    sendNwcPayInvoice,
    sendServerError,
    verifyEntryReceipt,
    verifyLeaderboardTopProof,
} from '../_lib/jackpot.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return sendMethodNotAllowed(res);
    }

    try {
        const body = await readJsonBody(req);
        const {
            winnerLightningAddress = '',
            winnerPubkey = '',
            receiptId = '',
            scoreProof = null,
        } = body;
        if (!winnerPubkey || !receiptId) {
            throw new Error('winnerPubkey and receiptId are required.');
        }
        if (!winnerLightningAddress) {
            throw new Error('winnerLightningAddress is required.');
        }

        await verifyEntryReceipt(receiptId, winnerPubkey);
        if (await hasLossEventForReceipt(receiptId)) {
            throw new Error('This paid run already lost and cannot claim the jackpot.');
        }
        if (await hasClaimLockOrClaim(receiptId)) {
            throw new Error('This paid run already claimed or is currently claiming the jackpot.');
        }
        verifyLeaderboardTopProof(scoreProof, winnerPubkey, receiptId, await listScoreboardEntries(), getGamePubkey());
        await publishClaimLockEvent(receiptId, winnerPubkey);

        const events = await listLedgerEvents();
        const currentPotSats = computePotFromLedger(events);
        if (currentPotSats <= 0) {
            return jsonResponse(res, 200, { ok: true, currentPotSats: 0, skipped: true });
        }

        const { invoice, signedEvent } = await createWinnerInvoice(winnerPubkey, currentPotSats, winnerLightningAddress);
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
