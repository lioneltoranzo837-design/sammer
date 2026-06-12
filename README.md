# Sammer

Juego web estático tipo Doom-like 3D horror survival, implementado con HTML, CSS, JavaScript y Three.js.

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

## Archivos principales

- `index.html`: estructura de UI, menús, HUD y carga de Three.js.
- `styles.css`: estilos visuales, overlays, efectos CRT y presentación responsive.
- `game.js`: lógica del juego, controles, audio, enemigos, render y estado.
