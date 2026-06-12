# Repository Guidelines

## Project Structure & Module Organization
This is a small browser game implemented with plain HTML, CSS, and JavaScript.
- `index.html` defines the game UI overlays, HUD, controls text, and loads external Three.js from a CDN.
- `styles.css` contains all visual styling, including CRT effects, menus, HUD panels, and responsive presentation.
- `game.js` contains game constants, map data, audio synthesis, player/enemy logic, rendering, and input handling.
- `docs/` is reserved for design notes and project documentation.

Keep new assets in clear top-level folders such as `assets/audio/`, `assets/textures/`, or `assets/models/` if they become necessary. Avoid committing generated build output.

## Build, Test, and Development Commands
There is currently no package manager or build step. Run the game as static files:
- `python3 -m http.server 8000` — serves the repository locally at `http://localhost:8000`.
- Open `index.html` directly only for quick checks; prefer the local server because browser APIs and CDN loading behave more predictably.
- `git status --short` — review local changes before committing.

## Coding Style & Naming Conventions
Use the existing style: 4-space indentation in HTML, CSS, and JavaScript. Keep constants in `UPPER_SNAKE_CASE` (`GRID_SIZE`, `MAX_HEALTH`) and classes in `PascalCase` (`SoundSynth`). Use descriptive `camelCase` for variables, functions, and DOM IDs referenced from JavaScript. Preserve the Spanish in-game copy and comments unless intentionally changing player-facing language. Do not add dependencies without a clear need.

## Testing Guidelines
No automated test suite exists yet. For each change, manually verify in a browser served from localhost. Test: start menu, pointer lock, movement, shooting, reloading, weapon switching, doors/interactions with `E`, HUD updates, damage/death, level completion, and restart flows. If logic grows, add lightweight browser-based tests or extract pure functions from `game.js` for unit testing.

## Commit & Pull Request Guidelines
Recent history uses short Spanish commit subjects such as `actualizacion`; keep subjects concise and imperative. For this repo, prefer the Lore commit format when possible: first line explains why, followed by useful trailers like `Tested:` and `Not-tested:`. Pull requests should include a short gameplay summary, changed files, manual test steps, screenshots or video for visual changes, and any known risks.

## Security & Configuration Tips
External libraries are loaded from CDNs in `index.html`; review URLs before changing them. Do not commit credentials, analytics keys, or large binary assets without discussion.
