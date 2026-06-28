# Repository Guidelines

## Project Structure & Module Organization
This is a static browser game using TypeScript source compiled to JavaScript, CSS, and Three.js from a CDN.
- **`ts-src/` is the only editable source.** All TypeScript files live here. Never edit `src/**` directly; it is generated output.
- `src/` is the compiled output of `ts-src/` via `npm run build:ts`. It is gitignored except for `src/GLTFLoader.js` (a vendored Three.js loader with no TypeScript source). Do not hand-edit files in `src/`.
- `index.html` stays at the repository root for simple static deploys; it defines overlays/HUD and loads `styles/styles.css`, Three.js, and `src/main.js`.
- `styles/styles.css` contains all global visual styling: CRT effects, menus, HUD panels, upgrade shop, and responsive presentation.
- `ts-src/main.ts` is the runtime composition layer: Three.js scene setup, map construction wiring, gameplay systems, entities, controls, progression, and the render loop.
- `ts-src/config/gameConfig.ts` contains constants, weapon data, the 2D map, font path, and blood wall message text.
- `ts-src/audio/SoundSynth.ts` contains procedural audio and exports the `AudioSynth` singleton.
- `ts-src/rendering/textures.ts` contains canvas-generated textures, SHLOP font loading, and wall-message decals.
- `ts-src/core/state.ts` contains small state factories for player/input initialization.
- `ts-src/ui/dom.ts` caches DOM references used by gameplay/UI code.
- `ts-src/nostr/` contains Nostr integration: `paymentGate.ts` (entry gate state machine), `delegation.ts` (NIP-26), `scoreboardData.ts` (kind 78 parsing), `startupLeaderboard.ts` (leaderboard formatting), `lunaNegra.ts` (external leaderboard), `payoutConfig.ts` (NWC URI resolver, mostly stub).
- `api/` contains Vercel serverless functions (NOT Express — native Vercel format with `export default async function handler(req, res)`). `api/_lib/jackpot.js` is the shared backend: ledger on Nostr relays (`kind 30078`), zap receipt verification, NWC payout. Endpoints in `api/jackpot/`: `status.js`, `verify-zap.js`, `report-loss.js`, `claim.js`.
- `assets/` stores versioned static assets such as `assets/fonts/SHLOP.ttf`; add future assets under clear folders like `assets/audio/`, `assets/textures/`, or `assets/models/`.
- `docs/` stores design and architecture notes. Start with `docs/architecture.md` when orienting agents.

Prefer small, behavior-preserving extractions from `ts-src/main.ts` into focused modules. Do not introduce a bundler, package manager, or dependency without an explicit request.

## Build, Test, and Development Commands
- `npm run build:ts` — compile `ts-src/` to `src/` (required after any TS change before serving).
- `npm run typecheck` — type-check `ts-src/` without emitting output.
- `npm test` — run the Node test suite (`tests/`).
- `npm run build` — alias of `build:ts`; used by Vercel and the deploy flow.
- `make run` (or `make serve`) — serves the game locally via `vercel dev` on `http://localhost:3000`. This is required for the jackpot/payment system because `vercel dev` runs the `api/` serverless functions and injects `.env` vars; `python3 -m http.server` only serves static files and the `/api/*` endpoints will 404. Run `npm run build:ts` first so `src/` is up to date.
- `node --check src/main.js` and `find src -name '*.js' -print -exec node --check {} \;` — syntax-check generated JavaScript modules.
- `git diff --check` — catch whitespace/conflict-marker issues.
- Open through the local server rather than `file://`; ES modules, fonts, browser APIs, and CDN loading behave more predictably over HTTP.
- `git status --short` — review local changes before committing.

## Coding Style & Naming Conventions
Use 4-space indentation in HTML, CSS, and JavaScript. Keep constants in `UPPER_SNAKE_CASE` (`GRID_SIZE`, `MAX_HEALTH`) and classes in `PascalCase` (`SoundSynth`). Use descriptive `camelCase` for variables, functions, and DOM IDs referenced from JavaScript. Preserve Spanish in-game copy/comments unless intentionally changing player-facing language. Keep module boundaries obvious: config/data in `ts-src/config`, rendering/texture work in `ts-src/rendering`, DOM lookup in `ts-src/ui`, and audio in `ts-src/audio`.

## Testing Guidelines
An automated Node test suite exists in `tests/` (`npm test`), covering the Nostr payment/jackpot helpers and pure game logic. For gameplay changes, also manually verify in a browser served from localhost via `make run`. Test: start menu, pointer lock, movement, shooting, reloading, weapon switching, doors/interactions with `E`, HUD updates, damage/death, level completion, shop/next-level flow, and restart flows. For visual/render changes, verify that SHLOP blood messages load once per message and remain on walls.

## Commit & Pull Request Guidelines
Recent history uses short Spanish commit subjects such as `actualizacion`; keep subjects concise and imperative. Prefer the Lore commit format when possible: first line explains why, followed by useful trailers like `Tested:` and `Not-tested:`. Pull requests should include a short gameplay summary, changed files, manual test steps, screenshots or video for visual changes, and known risks.

## Security & Configuration Tips
External libraries are loaded from CDNs in `index.html`; review URLs before changing them. Do not commit credentials, analytics keys, or large binary assets without discussion. Keep local deploy compatibility: root `index.html`, relative asset paths, and no hand-edited build output in `src/`.

## Jackpot / Paid Entry System

The game has a "pay to play" mode where players stake sats via Lightning zaps (NIP-57) to enter. If they die without reaching #1 on the Nostr leaderboard, their stake goes into an accumulated pot. If they reach #1, they can claim the pot. The jackpot payout is currently wired to boss victory (`finalizeBossJackpotVictory`); the plan is to rewire it to "new #1 on leaderboard" instead.

### Feature Flags
`ts-src/config/gameConfig.ts:40-42` controls start menu visibility:
- `SHOW_START_ZAP_ACCESS` — `true` to show the entry payment panel and "APOSTAR N SATS" button. Set `false` to hide the paid mode entirely.
- `SHOW_START_NOSTR_LEADERBOARD` — `true` to show the Nostr leaderboard panel.
- `SHOW_START_LUNA_NEGRA_SECTION` — `false` hides the external Luna Negra leaderboard.

### Entry Fee
- Backend (`api/_lib/jackpot.js`): `resolveEntryFeeSats()` reads env var `SAMMER_ENTRY_FEE_SATS` (preferred) or `ENTRY_FEE_SATS` (fallback). Both accept the value. If neither is set, defaults to `100`. Invalid values (non-numeric, <= 0) throw explicitly.
- Frontend (`ts-src/main.ts`): `entryFeeSats` is a `let` initialized to `DEFAULT_ENTRY_FEE_SATS=100`. It is hydrated from `/api/jackpot/status` response field `entryFeeSats` on every `loadCurrentJackpot()` call. All UI strings, zap amounts, and receipt verification use the dynamic value.

### Environment Variables (Vercel / `.env`)
The backend requires three env vars to function; without them `/api/jackpot/status` returns `configured: false` and the frontend shows "CONFIGURA EL SIGNER Y LA WALLET":
- `SAMMER_SERVER_SIGNER_NSEC_HEX` — Nostr secret key for signing ledger events (`kind 30078`). Accepts bech32 (`nsec1...`) or 64-char hex. Decoded by `decodeSecretKey()` in `jackpot.js`.
- `SAMMER_GAME_PUBKEY` — The game's Nostr public key. Accepts bech32 (`npub1...`) or 64-char hex. Decoded by `decodePubkey()`.
- `SAMMER_GAME_NWC_URI` — NWC connection URI (`nostr+walletconnect://...`) for the wallet that custodies the pot. Used to pay winners via `nip47.pay_invoice`.
- `SAMMER_GAME_LIGHTNING_ADDRESS` (optional) — Lightning address (LUD-16, e.g. `sammerjackpot@getalby.com`) used to generate entry zap invoices. When set, BOTH the frontend and backend (`fetchGameZapConfig()`) resolve the LNURL-pay endpoint directly from this address, skipping the relay-based game `kind 0` profile lookup. If unset, both fall back to fetching the game's `kind 0` from relays to discover `lud16`.
- `SAMMER_ENTRY_FEE_SATS` or `ENTRY_FEE_SATS` (optional) — entry fee in sats. Defaults to 100 if absent.

**Important**: `.env` values must use `KEY=value` format (no spaces around `=`). Spaces break parsing.

### Entry Payment Flow (Frontend)
The entry gate UI in `ts-src/main.ts` is a state machine (`entryGateState.status`):
1. **idle** — Player sees "APOSTAR N SATS" and "JUGAR GRATIS".
2. **paying** — `requestEntryInvoice()` calls LNURL-pay to get a BOLT11 invoice. If `window.webln` exists (Alby extension), attempts auto-payment.
3. **invoice-ready** → **verifying** — `startAutoVerification()` polls Nostr relays every 2.5s for `kind 9735` (zap receipt) matching the invoice. Timeout: 5 minutes.
4. **paid** — Receipt found, `/api/jackpot/verify-zap` confirms with backend. "JUGAR GRATIS" button becomes "JUGAR POR EL POZO" and starts the paid run.
5. **error** — Timeout or verification failure. Player can retry.

The "JUGAR GRATIS" / "JUGAR POR EL POZO" button (`#free-start-btn`) is dual-purpose: free play when no payment is active, paid play when `canStartPaidRun(entryGateState)` is true. It is disabled (greyed out) during `paying` and `verifying` states so the player cannot start until payment is detected.

The old "INICIAR OPERACIÓN" button (`#start-btn`) was removed. The old "VERIFICAR ZAP" button (`#entry-verify-btn`) is hidden — verification is now automatic.

### Backend Ledger
`api/_lib/jackpot.js` maintains a ledger on Nostr relays using `kind 30078` events signed by the server signer key:
- `entry-loss` events add sats to the pot (published when a paid run dies).
- `jackpot-claim` events reset the pot to zero (published when a winner claims).
- `computePotFromLedger()` sums the ledger to calculate the current pot.

The pot itself lives in a Lightning wallet (Alby Hub, LNbits, or similar) configured via `SAMMER_GAME_NWC_URI`. The backend does not custody sats directly; it uses NWC to instruct the wallet to pay invoices.

### Key Files
- `ts-src/main.ts` — Frontend entry gate UI, zap generation, auto-verification, leaderboard, score publishing.
- `ts-src/nostr/paymentGate.ts` — `EntryGateState` interface, `createEntryGateState()`, `canStartPaidRun()`, `computeCurrentJackpot()`.
- `api/_lib/jackpot.js` — Backend ledger, zap verification, NWC payout, entry fee resolver, key decoders.
- `api/jackpot/status.js` — Returns `{ configured, currentPotSats, entryFeeSats, lightningAddress }`.
- `api/jackpot/verify-zap.js` — Verifies a zap receipt against the ledger.
- `api/jackpot/report-loss.js` — Records an entry-loss event when a paid run dies.
- `api/jackpot/claim.js` — Pays out the pot to a winner via NWC (currently wired to boss victory proof).
- `tests/nostr/` and `tests/api/` — Test coverage for payment gate, scoreboard, jackpot ledger.

### Notes for Future Work
- The claim flow (`api/jackpot/claim.js` + `verifyBossVictoryProof`) still gates on boss victory. To implement "prize for #1 on leaderboard", replace `verifyBossVictoryProof` with a leaderboard-top proof that re-reads `kind 78` scores from relays and confirms the claimant is the new #1.
- `finalizeBossJackpotVictory` in `main.ts` is the current payout trigger; it needs to move to `triggerGameOver` after score publication for the #1-based prize model.
- Race conditions: the backend has a claim lock (`publishClaimLockEvent`) so only the first claimant wins; subsequent claims are rejected.
