# Sammer

Juego web estático tipo Doom-like 3D horror survival, implementado con HTML, CSS, JavaScript modular y Three.js.

## Probar online

Podés jugarlo desde:

https://sammer.shiafu.com/

## Ejecutar localmente

Este proyecto no requiere build ni instalación de dependencias. Servilo como archivos estáticos:

```bash
python3 -m http.server 8000
```

Luego abrí:

```text
http://localhost:8000
```

## Arquitectura rápida

- `index.html`: documento raíz, overlays, HUD y carga de Three.js + `src/main.js`.
- `styles/styles.css`: estilos visuales, CRT, menús, HUD y tienda.
- `src/config/gameConfig.js`: constantes, armas, mapa y mensajes de sangre.
- `src/audio/SoundSynth.js`: audio procedural.
- `src/rendering/textures.js`: texturas canvas, fuente SHLOP y mensajes en paredes.
- `src/core/state.js`: estado inicial base.
- `src/ui/dom.js`: referencias DOM compartidas.
- `src/main.js`: composición del juego, escena, entidades, gameplay y loop.
- `assets/`: fuentes y futuros assets estáticos.

Ver `docs/architecture.md` para reglas de edición orientadas a agentes.
