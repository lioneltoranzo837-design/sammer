function getElementById<T extends HTMLElement>(id: string): T | null {
    return document.getElementById(id) as T | null;
}

export const menuOverlay = getElementById<HTMLDivElement>('menu-overlay');
export const deathOverlay = getElementById<HTMLDivElement>('death-overlay');
export const victoryOverlay = getElementById<HTMLDivElement>('victory-overlay');
export const freeStartBtn = getElementById<HTMLButtonElement>('free-start-btn');
export const startBtn = getElementById<HTMLButtonElement>('start-btn');
export const restartBtn = getElementById<HTMLButtonElement>('restart-btn');
export const winBtn = getElementById<HTMLButtonElement>('win-btn');
export const nostrConnectBtn = getElementById<HTMLButtonElement>('nostr-connect-btn');
export const nostrNsecInput = getElementById<HTMLInputElement>('nostr-nsec-input');
export const nostrNsecBtn = getElementById<HTMLButtonElement>('nostr-nsec-btn');
export const nostrManualSection = getElementById<HTMLDivElement>('nostr-manual-section');
export const startLeaderboardList = getElementById<HTMLOListElement>('start-leaderboard-list');
export const startLeaderboardPanel = getElementById<HTMLElement>('start-leaderboard-panel');
export const startLeaderboardStatus = getElementById<HTMLParagraphElement>('start-leaderboard-status');
export const lunaNegraPanel = getElementById<HTMLElement>('luna-negra-panel');
export const lunaNegraStatus = getElementById<HTMLParagraphElement>('luna-negra-status');
export const lunaNegraPlayer = getElementById<HTMLDivElement>('luna-negra-player');
export const lunaNegraAvatar = getElementById<HTMLImageElement>('luna-negra-avatar');
export const lunaNegraLeaderboardList = getElementById<HTMLOListElement>('luna-negra-leaderboard-list');
export const entryGateInvoiceOutput = getElementById<HTMLTextAreaElement>('entry-invoice-output');
export const entryGatePanel = getElementById<HTMLElement>('entry-gate-panel');
export const entryGatePayBtn = getElementById<HTMLButtonElement>('entry-pay-btn');
export const entryGateStatus = getElementById<HTMLParagraphElement>('entry-gate-status');
export const entryGateVerifyBtn = getElementById<HTMLButtonElement>('entry-verify-btn');
export const jackpotValue = getElementById<HTMLSpanElement>('jackpot-value');

export const healthVal = getElementById<HTMLElement>('health-value');
export const healthBar = getElementById<HTMLElement>('health-bar');
export const armorVal = getElementById<HTMLElement>('armor-value');
export const armorBar = getElementById<HTMLElement>('armor-bar');
export const zombieCountEl = getElementById<HTMLElement>('zombie-count');
export const ammoClipEl = getElementById<HTMLElement>('ammo-clip');
export const ammoReserveEl = getElementById<HTMLElement>('ammo-reserve');
export const feedbackMsg = getElementById<HTMLElement>('feedback-message');
export const crosshair = getElementById<HTMLElement>('crosshair');
export const damageFlash = getElementById<HTMLElement>('damage-flash');
export const bossHud = getElementById<HTMLElement>('boss-hud');
export const bossHealthFill = getElementById<HTMLElement>('boss-health-fill');
