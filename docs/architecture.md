# Arquitectura del juego

Este repo sigue siendo una app web estática sin build step. `index.html` vive en la raíz para deploy simple y carga Three.js desde CDN antes del entrypoint ES module.

## Mapa de carpetas

- `index.html`: documento raíz, overlays/HUD y carga de CSS/JS.
- `styles/styles.css`: estilos globales, overlays, HUD, tienda, efectos CRT y responsive.
- `src/main.js`: composición del juego, escena Three.js, loop principal y wiring entre sistemas.
- `src/config/gameConfig.js`: constantes, armas, mapa 2D y textos de mensajes de pared.
- `src/audio/SoundSynth.js`: sintetizador procedural y singleton `AudioSynth`.
- `src/rendering/textures.js`: texturas canvas, fuente SHLOP y decals/mensajes sangrientos.
- `src/core/state.js`: factories de estado base del jugador/input.
- `src/ui/dom.js`: cache de elementos DOM usados por el juego.
- `assets/`: archivos estáticos versionados (`fonts/`, futuras texturas/audio/modelos).
- `docs/`: notas y documentación para humanos/agentes.

## Reglas de edición para agentes

- Cambios de balance/datos: empezar por `src/config/gameConfig.js`.
- Cambios visuales CSS/UI: `styles/styles.css` e IDs/classes de `index.html`.
- Cambios de render/texturas/decal: `src/rendering/textures.js`.
- Cambios de audio: `src/audio/SoundSynth.js`.
- Cambios de wiring/gameplay aún viven principalmente en `src/main.js`; extraer a módulos solo en pasadas pequeñas y verificadas.
- No agregar bundlers ni dependencias salvo pedido explícito.
