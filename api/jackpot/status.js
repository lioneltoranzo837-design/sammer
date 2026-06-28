import { ENTRY_FEE_SATS, computePotFromLedger, fetchWalletBalanceSats, jsonResponse, listLedgerEvents } from '../_lib/jackpot.js';

export default async function handler(_req, res) {
    try {
        const events = await listLedgerEvents();
        const lightningAddress = (process.env.SAMMER_GAME_LIGHTNING_ADDRESS || '').trim();
        const ledgerPotSats = computePotFromLedger(events);
        let walletBalanceSats = null;

        if (process.env.SAMMER_GAME_NWC_URI) {
            try {
                walletBalanceSats = await fetchWalletBalanceSats();
            } catch (error) {
                console.error('NWC wallet balance error:', error);
            }
        }

        return jsonResponse(res, 200, {
            configured: Boolean(process.env.SAMMER_GAME_NWC_URI && process.env.SAMMER_SERVER_SIGNER_NSEC_HEX && process.env.SAMMER_GAME_PUBKEY),
            currentPotSats: walletBalanceSats ?? ledgerPotSats,
            entryFeeSats: ENTRY_FEE_SATS,
            ledgerPotSats,
            lightningAddress,
            walletBalanceSats,
        });
    } catch (error) {
        return jsonResponse(res, 500, { error: error.message || 'Failed to load jackpot status.' });
    }
}
