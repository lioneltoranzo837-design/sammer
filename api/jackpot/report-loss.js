import {
    hasLossEventForReceipt,
    jsonResponse,
    publishLossEvent,
    readJsonBody,
    sendMethodNotAllowed,
    sendServerError,
    verifyEntryReceipt,
} from '../_lib/jackpot.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return sendMethodNotAllowed(res);
    }

    try {
        const body = await readJsonBody(req);
        const { playerPubkey = '', receiptId = '' } = body;
        const verified = await verifyEntryReceipt(receiptId, playerPubkey);
        const alreadyRecorded = await hasLossEventForReceipt(receiptId);
        if (alreadyRecorded) {
            return jsonResponse(res, 200, { ok: true, alreadyRecorded: true, receiptId });
        }

        const eventId = await publishLossEvent(receiptId, verified.playerPubkey);
        return jsonResponse(res, 200, { ok: true, eventId, receiptId });
    } catch (error) {
        return sendServerError(res, error);
    }
}
