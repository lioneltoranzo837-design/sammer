import { ENTRY_FEE_SATS, computePotFromLedger, jsonResponse, listLedgerEvents } from '../_lib/jackpot.js';

export default async function handler(_req, res) {
    try {
        const events = await listLedgerEvents();
        const lightningAddress = (process.env.SAMMER_GAME_LIGHTNING_ADDRESS || '').trim();
        return jsonResponse(res, 200, {
            configured: Boolean(process.env.SAMMER_GAME_NWC_URI && process.env.SAMMER_SERVER_SIGNER_NSEC_HEX && process.env.SAMMER_GAME_PUBKEY),
            currentPotSats: computePotFromLedger(events),
            entryFeeSats: ENTRY_FEE_SATS,
            lightningAddress,
        });
    } catch (error) {
        return jsonResponse(res, 500, { error: error.message || 'Failed to load jackpot status.' });
    }
}
