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
- `assets/` stores versioned static assets such as `assets/fonts/SHLOP.ttf`; add future assets under clear folders like `assets/audio/`, `assets/textures/`, or `assets/models/`.
- `docs/` stores design and architecture notes. Start with `docs/architecture.md` when orienting agents.

Prefer small, behavior-preserving extractions from `ts-src/main.ts` into focused modules. Do not introduce a bundler, package manager, or dependency without an explicit request.

## Build, Test, and Development Commands
- `npm run build:ts` — compile `ts-src/` to `src/` (required after any TS change before serving).
- `npm run typecheck` — type-check `ts-src/` without emitting output.
- `npm test` — run the Node test suite (`tests/`).
- `npm run build` — alias of `build:ts`; used by Vercel and the deploy flow.
- `python3 -m http.server 8000` — serves the repository locally at `http://localhost:8000`. Run `npm run build:ts` first so `src/` is up to date.
- `node --check src/main.js` and `find src -name '*.js' -print -exec node --check {} \;` — syntax-check generated JavaScript modules.
- `git diff --check` — catch whitespace/conflict-marker issues.
- Open through the local server rather than `file://`; ES modules, fonts, browser APIs, and CDN loading behave more predictably over HTTP.
- `git status --short` — review local changes before committing.

## Coding Style & Naming Conventions
Use 4-space indentation in HTML, CSS, and JavaScript. Keep constants in `UPPER_SNAKE_CASE` (`GRID_SIZE`, `MAX_HEALTH`) and classes in `PascalCase` (`SoundSynth`). Use descriptive `camelCase` for variables, functions, and DOM IDs referenced from JavaScript. Preserve Spanish in-game copy/comments unless intentionally changing player-facing language. Keep module boundaries obvious: config/data in `ts-src/config`, rendering/texture work in `ts-src/rendering`, DOM lookup in `ts-src/ui`, and audio in `ts-src/audio`.

## Testing Guidelines
No automated test suite exists yet. For each change, manually verify in a browser served from localhost. Test: start menu, pointer lock, movement, shooting, reloading, weapon switching, doors/interactions with `E`, HUD updates, damage/death, level completion, shop/next-level flow, and restart flows. For visual/render changes, verify that SHLOP blood messages load once per message and remain on walls. If logic grows, add lightweight browser-based tests or extract pure functions from `ts-src/main.ts` for unit testing.

## Commit & Pull Request Guidelines
Recent history uses short Spanish commit subjects such as `actualizacion`; keep subjects concise and imperative. Prefer the Lore commit format when possible: first line explains why, followed by useful trailers like `Tested:` and `Not-tested:`. Pull requests should include a short gameplay summary, changed files, manual test steps, screenshots or video for visual changes, and known risks.

## Security & Configuration Tips
External libraries are loaded from CDNs in `index.html`; review URLs before changing them. Do not commit credentials, analytics keys, or large binary assets without discussion. Keep local deploy compatibility: root `index.html`, relative asset paths, and no hand-edited build output in `src/`.
