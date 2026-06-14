import { jsonResponse, readJsonBody, sendMethodNotAllowed, sendServerError, verifyEntryReceipt } from '../_lib/jackpot.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return sendMethodNotAllowed(res);
    }

    try {
        const body = await readJsonBody(req);
        const { playerPubkey = '', receiptId = '' } = body;
        const verified = await verifyEntryReceipt(receiptId, playerPubkey);
        return jsonResponse(res, 200, {
            ok: true,
            playerPubkey: verified.playerPubkey,
            receiptId,
        });
    } catch (error) {
        return sendServerError(res, error);
    }
}
