# Arquitectura del juego

Este repo es una app web estática con build step de TypeScript a JavaScript. `index.html` vive en la raíz para deploy simple y carga Three.js desde CDN antes del entrypoint ES module. La fuente editable es `ts-src/`; `src/` es salida generada por `npm run build:ts` y está gitignored (excepto `src/GLTFLoader.js`, vendor sin fuente TS).

## Mapa de carpetas

- `index.html`: documento raíz, overlays/HUD y carga de CSS/JS.
- `styles/styles.css`: estilos globales, overlays, HUD, tienda, efectos CRT y responsive.
- `ts-src/main.ts`: composición del juego, escena Three.js, loop principal y wiring entre sistemas.
- `ts-src/config/gameConfig.ts`: constantes, armas, mapa 2D y textos de mensajes de pared.
- `ts-src/audio/SoundSynth.ts`: sintetizador procedural y singleton `AudioSynth`.
- `ts-src/rendering/textures.ts`: texturas canvas, fuente SHLOP y decals/mensajes sangrientos.
- `ts-src/core/state.ts`: factories de estado base del jugador/input.
- `ts-src/ui/dom.ts`: cache de elementos DOM usados por el juego.
- `src/GLTFLoader.js`: loader de Three.js vendoreado (sin fuente TS; no editar).
- `assets/`: archivos estáticos versionados (`fonts/`, futuras texturas/audio/modelos).
- `docs/`: notas y documentación para humanos/agentes.

## Reglas de edición para agentes

- **Editar solo `ts-src/`.** `src/` es generado; los cambios manuales ahí se pierden al compilar.
- Cambios de balance/datos: empezar por `ts-src/config/gameConfig.ts`.
- Cambios visuales CSS/UI: `styles/styles.css` e IDs/classes de `index.html`.
- Cambios de render/texturas/decal: `ts-src/rendering/textures.ts`.
- Cambios de audio: `ts-src/audio/SoundSynth.ts`.
- Cambios de wiring/gameplay aún viven principalmente en `ts-src/main.ts`; extraer a módulos solo en pasadas pequeñas y verificadas.
- Después de editar TS, correr `npm run build:ts` antes de servir o commitear.
- No agregar bundlers ni dependencias salvo pedido explícito.
