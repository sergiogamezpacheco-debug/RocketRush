# Ficha de Google Play · Rocket Rush

Todo lo que hay que subir en Play Console › Crecer › Presencia en Google Play › Ficha de Play Store principal.

| Qué | Archivo | Tamaño |
|---|---|---|
| Icono de la aplicación | `icono-play-512.png` | 512 × 512 PNG |
| Imagen destacada | `play/<idioma>/imagen-destacada-1024x500.png` | 1024 × 500 |
| Capturas de teléfono (8) | `play/<idioma>/captura-1…8-*.png` | 1080 × 1920 |
| Textos (nombre, descripción breve y completa) | `ficha.md` | 30 / 80 / 4000 caracteres |

Idiomas: `es` (español, España — idioma principal), `en` (inglés, EE. UU.), `pt` (portugués, Portugal), `fr` (francés),
`de` (alemán) e `it` (italiano). En Play Console: «Gestionar traducciones › Añadir traducciones propias» y en cada idioma
se pegan sus textos y se suben sus imágenes.

Orden de las capturas: 1 apunta y derriba · 2 cañones (tienda) · 3 jefes · 4 cofre abriéndose · 5 cañón y bolas personalizados ·
6 club · 7 jefe colosal del club · 8 mapa de mundos.

Para volver a generarlo todo: `node tools/build.js`, `python3 tools/storeshots.py <idioma>` (o solo algunas: `python3 tools/storeshots.py <idioma> cannons,skinplay`),
`python3 tools/storelogo.py <idioma>` y `python3 tools/storeart.py final C C`.
