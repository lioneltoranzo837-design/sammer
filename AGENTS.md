# Repository Guidelines

## Project Structure & Module Organization
This is a static browser game using plain HTML, CSS, ES modules, and Three.js from a CDN. There is no build step.
- `index.html` stays at the repository root for simple static deploys; it defines overlays/HUD and loads `styles/styles.css`, Three.js, and `src/main.js`.
- `styles/styles.css` contains all global visual styling: CRT effects, menus, HUD panels, upgrade shop, and responsive presentation.
- `src/main.js` is the runtime composition layer: Three.js scene setup, map construction wiring, gameplay systems, entities, controls, progression, and the render loop.
- `src/config/gameConfig.js` contains constants, weapon data, the 2D map, font path, and blood wall message text.
- `src/audio/SoundSynth.js` contains procedural audio and exports the `AudioSynth` singleton.
- `src/rendering/textures.js` contains canvas-generated textures, SHLOP font loading, and wall-message decals.
- `src/core/state.js` contains small state factories for player/input initialization.
- `src/ui/dom.js` caches DOM references used by gameplay/UI code.
- `assets/` stores versioned static assets such as `assets/fonts/SHLOP.ttf`; add future assets under clear folders like `assets/audio/`, `assets/textures/`, or `assets/models/`.
- `docs/` stores design and architecture notes. Start with `docs/architecture.md` when orienting agents.

Prefer small, behavior-preserving extractions from `src/main.js` into focused modules. Do not introduce a bundler, package manager, or dependency without an explicit request.

## Build, Test, and Development Commands
- `python3 -m http.server 8000` — serves the repository locally at `http://localhost:8000`.
- `node --check src/main.js` and `find src -name '*.js' -print -exec node --check {} \;` — syntax-check JavaScript modules.
- `git diff --check` — catch whitespace/conflict-marker issues.
- Open through the local server rather than `file://`; ES modules, fonts, browser APIs, and CDN loading behave more predictably over HTTP.
- `git status --short` — review local changes before committing.

## Coding Style & Naming Conventions
Use 4-space indentation in HTML, CSS, and JavaScript. Keep constants in `UPPER_SNAKE_CASE` (`GRID_SIZE`, `MAX_HEALTH`) and classes in `PascalCase` (`SoundSynth`). Use descriptive `camelCase` for variables, functions, and DOM IDs referenced from JavaScript. Preserve Spanish in-game copy/comments unless intentionally changing player-facing language. Keep module boundaries obvious: config/data in `src/config`, rendering/texture work in `src/rendering`, DOM lookup in `src/ui`, and audio in `src/audio`.

## Testing Guidelines
No automated test suite exists yet. For each change, manually verify in a browser served from localhost. Test: start menu, pointer lock, movement, shooting, reloading, weapon switching, doors/interactions with `E`, HUD updates, damage/death, level completion, shop/next-level flow, and restart flows. For visual/render changes, verify that SHLOP blood messages load once per message and remain on walls. If logic grows, add lightweight browser-based tests or extract pure functions from `src/main.js` for unit testing.

## Commit & Pull Request Guidelines
Recent history uses short Spanish commit subjects such as `actualizacion`; keep subjects concise and imperative. Prefer the Lore commit format when possible: first line explains why, followed by useful trailers like `Tested:` and `Not-tested:`. Pull requests should include a short gameplay summary, changed files, manual test steps, screenshots or video for visual changes, and known risks.

## Security & Configuration Tips
External libraries are loaded from CDNs in `index.html`; review URLs before changing them. Do not commit credentials, analytics keys, or large binary assets without discussion. Keep local deploy compatibility: root `index.html`, relative asset paths, and no generated build output.
