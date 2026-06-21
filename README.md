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

## Deploy

El proyecto está vinculado a Vercel desde `.vercel/project.json` y se publica en:

```text
https://sammer.shiafu.com/
```

Para desplegar producción desde la rama `main`:

```bash
git checkout main
git pull --ff-only origin main
make deploy
```

El deploy usa una versión fija de Vercel CLI vía `npm exec`, sin instalar dependencias en el repo:

```bash
npm exec --yes --package vercel@54.14.5 -- vercel deploy --prod --yes
```

Después del deploy, verificá que Vercel haya aliasado la publicación a `https://sammer.shiafu.com/` y abrí ese dominio para confirmar que el juego carga.

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
