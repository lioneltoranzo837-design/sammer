# Sammer Design System

## 1. Product feel
Sammer is a retro industrial horror survival game. The UI should feel like a damaged CRT terminal inside a compromised biological facility: dark, high-contrast, tense, tactical, and diegetic.

## 2. Color tokens
- `surface-black`: `#050505` for the page and game void.
- `panel-red-surface`: `rgba(15, 10, 10, 0.75)` for primary overlays.
- `border-red`: `#3a1010` for hostile/facility borders.
- `alarm-red`: `#ff3333` and `#ff2a2a` for titles, hazard accents, and critical actions.
- `terminal-green`: `#00ff41` for Nostr leaderboard and system-success readouts.
- `text-primary`: `#e0e0e0` for readable UI text.
- `text-muted`: `#888888` and `#b0b0b0` for subtitles and body copy.
- `luna-purple`: `#b9a7ff` for Luna Negra headings and rank accents.
- `luna-surface`: `rgba(10, 8, 24, 0.95)` for Luna Negra panels.
- `error-red`: `#ff8b8b` for recoverable error states.

## 3. Typography
- Primary UI font: `Share Tech Mono`, monospace.
- Horror accent font: `Special Elite` for narrative flavor where already used.
- Titles use uppercase, wide letter spacing, and glow/glitch treatment.
- Status labels use compact uppercase mono text with 1px-2px letter spacing.

## 4. Spacing and layout
- Base spacing unit: 4px.
- Overlay cards use 16px-22px inner spacing for subpanels and 32px-40px for main containers.
- Start menu is a responsive grid: mission/actions on the left, controls center, leaderboards right. New optional panels must occupy named grid areas and collapse to one column on mobile.

## 5. Components
- `retro-btn`: full-width CTA with red industrial styling; disabled state must visibly reduce intensity.
- `start-leaderboard-panel`: green terminal score panel for Nostr only.
- `entry-gate-panel`: red payment/access panel for zap-gated starts.
- `death-jackpot-panel`: green terminal claim panel shown only when a paid death reaches leaderboard #1; it asks for a Lightning Address and uses `data-tone="idle|loading|success|error"` status text.
- `luna-negra-panel`: purple terminal score/session panel for Luna Negra only; it must not reuse the Nostr panel element or IDs.
- Status text uses `data-tone="idle|loading|success|error"` for color semantics.

## 6. Motion and effects
- CRT overlay and glitch effects are part of the identity.
- Avoid layout animations; use opacity, transform, or filter when motion is needed.
- Preserve pointer-lock and game canvas interactions over ornamental UI effects.

## 7. Accessibility and states
- Interactive controls must remain real buttons/inputs.
- Every panel needs loading, empty, success, and error text states.
- Meaningful images need alt text; decorative or absent avatars remain hidden.
