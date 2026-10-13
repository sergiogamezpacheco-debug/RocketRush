# Chroma Crash 3D

Puzle de física en 3D para Android, en primera persona desde detrás de un cañón. Disparas bolas de colores contra castillos de bloques de gominola: si la bola toca un bloque de su color, revienta todo el grupo conectado de ese color y la estructura se derrumba con física real. Hay que derribar un porcentaje de la estructura con las bolas disponibles.

**Contenido:** 50 niveles en 5 mundos (Plaza mayor, Feria del castillo, Almacén helado, Puerto y Palacio de cristal) y 5 niveles extra, uno por mundo, que solo se abren con 3 estrellas en los 10 niveles de ese mundo. Los niveles extra tienen bloques de oro que sueltan monedas y dan el triple de premio la primera vez.

## Qué hay en esta carpeta

| Carpeta | Contenido |
| --- | --- |
| `src/` | El juego: reglas y física (`sim3d.js`), niveles (`levels3d.js`), ajuste de dificultad generado (`tuning.js`), gráficos, sonido y menús (`game3d.js`) y la página (`index.html`) |
| `vendor/` | three.js r169 (gráficos 3D) y cannon-es 0.20 (física), ambos con licencia MIT, ya incluidos para funcionar sin conexión |
| `tools/` | `build.js` junta todo en `dist/index.html`; `check3d.js` comprueba que los niveles no se caen solos; `curve3d.js` mide la dificultad con un jugador simulado; `tune.js` y `mergetune.js` ajustan bolas y objetivo de cada nivel; `shots.py`, `uiflow.py` hacen capturas y recorren los menús en Chromium |
| `android/` | App Android mínima que carga el juego sin conexión (pantalla completa, vibración, botón atrás) |
| `.github/workflows/apk.yml` | Compila la APK automáticamente en GitHub |

## Probar en el navegador

```
node tools/build.js
```

Abre `dist/index.html` en el navegador del ordenador o del móvil.

## Conseguir la APK (sin instalar nada)

1. Crea un repositorio nuevo en GitHub (puede ser privado).
2. Sube el contenido de esta carpeta a la rama `main`.
3. En la pestaña **Actions**, el flujo "Compilar APK" arranca solo y tarda unos 4 minutos.
4. Descarga el artefacto `chroma-crash-apk`: dentro está `app-debug.apk`.
5. Pásala al móvil e instálala (Android pedirá permitir apps de origen desconocido).

Es una APK de pruebas firmada con clave de depuración. Para Google Play hace falta firmarla con tu propia clave (fase 3).

## Curva de dificultad

En cada mundo hay 1 nivel bastante difícil, en una posición distinta (7, 16, 24, 38 y 45) y siempre seguido de uno fácil, 3 o 4 niveles medios y el resto fáciles. El jugador no ve ninguna etiqueta de dificultad. Los niveles difíciles pagan el doble de monedas, y antes del primero (niveles 1–6) perder regala 3 bolas.

`tools/tune.js` ajusta bolas y objetivo de cada nivel jugando partidas con un "jugador casual" simulado hasta que el porcentaje de victorias cae en su franja:

| Tipo | Franja de victorias |
| --- | --- |
| Fácil (mundo 1 / resto) | 85–100 % / 75–95 % |
| Medio | 55–72 % |
| Difícil (mundo 1 / resto) | 35–50 % / 28–42 % |
| Niveles extra | 70–95 % (3 estrellas, alrededor del 25 %) |

## Pájaro y velero de premio

Durante la partida, de vez en cuando cruza un pájaro rápido por detrás de la estructura y, por el mar, un velero pequeño. Si le das al pájaro, ganas 2 bolas al azar (a veces una bomba o un arcoíris). El velero lleva en cubierta, a la vista, las 2 bolas que ganas si lo tumbas, y en cada pasada lleva otras. Los dos están lejos y se mueven, así que hay que apuntar por delante de ellos. Los tiros al mar suben lo justo para pasar por encima de la estructura.

## Gemas y pase de temporada

- **Gemas** (moneda premium): 25 % de probabilidad por partida, garantizada tras 2 partidas sin ninguna. Van dentro de un cubo de cristal de color con marco dorado, donde se ve girar la gema (una esmeralda), y hay que derribarlo. En los niveles extra hay 1 asegurada y hasta 3. La tirada se guarda hasta que la partida acaba, así que salir y volver a entrar no da gemas extra.
- **Pase**: temporadas de 28 días con 30 niveles que se suben con estrellas. La pista gratis da monedas, potenciadores, gemas y una bola dorada. La pista Pro cuesta 150 gemas (≈ 4,99 €) y da mucho más, incluidos 3 cañones exclusivos. Al acabar la temporada se entrega lo ganado sin reclamar y el pase empieza de cero.
- **Tienda de gemas**: 30 (0,99 €), 150 (4,99 €) y 330 (9,99 €). Son compras de prueba en el prototipo; en Google Play irán con Play Billing.

## Racha diaria

- Un premio por cada día que entras y lo recoges, y un cofre cada 5 días: madera, plata, oro, cristal, épico y legendario (día 30, con el **Cañón de Fuego**, exclusivo de la racha). A partir del día 30 hay un cofre legendario cada 5 días.
- La ventana se abre sola una vez al día, 1,5 s después de abrir el juego (o de volver a él otro día). Si ese día aún no ha salido, aparece al llegar al mapa. Nunca sale a mitad de partida, y solo después de ganar el nivel 1. Tiene una X arriba a la derecha para cerrarla. En la portada y en el mapa siempre está el botón de la llama.
- Si faltas un día, lo cubre un escudo de racha (máximo 2). Sin escudo, la racha se salva con un vídeo (una vez por semana) o con 15 gemas. Si faltas 2 días o más, empieza de cero.
- Android: aviso local a las 19:00 (`ReminderReceiver.java`). El permiso de notificaciones se pide solo al tocar «Avisarme». Se apaga en Ajustes. Si el móvil se reinicia, el aviso se vuelve a programar al abrir el juego.
- Prueba en navegador: `python3 tools/dailyflow.py` (simula días con `ChromaGame.shiftDays(n)`).

## Mundos 6 a 10 (niveles 51-100)

Cada mundo nuevo tiene su paisaje, su plataforma, un bloque nuevo y su propio objeto que cruza el cielo con 2 bolas a la vista (en lugar del velero, que solo navega en los mundos del mar). Los 50 primeros niveles no cambian.

| Mundo | Paisaje y plataforma | Bloque nuevo | Cruza el cielo |
|---|---|---|---|
| 6 · Dunas doradas | Desierto con pirámides, cactus y oasis; plataforma de arenisca sobre una meseta | **Arena**: se deshace con cualquier golpe y cuando revienta un bloque pegado a ella | Globo aerostático |
| 7 · Pico helado | Montañas nevadas, pinos y nieve cayendo; plataforma de nieve sobre un iceberg con carámbanos | **Bola congelada**: al romper el hielo, la bola de dentro pasa a tu bandeja | Teleférico |
| 8 · Templo perdido | Selva, árboles y templos mayas; plataforma de piedra con musgo sobre un tronco gigante | **Camaleón**: cambia de color después de cada tiro | Mono en tirolina |
| 9 · Isla de fuego | Mar de lava, volcán humeante y brasas; plataforma de basalto con grietas de lava | **Magma**: estalla hacia arriba cuando revienta un bloque a su lado y funde toda su columna | Dragón con cesta |
| 10 · Base lunar | Estrellas, planetas y asteroides; plataforma lunar sobre un asteroide | **Antigravedad**: bloques que flotan aunque les quites el apoyo | Ovni (y un satélite en lugar del pájaro) |

Cada mundo tiene 1 nivel difícil (57, 65, 78, 86, 99), 4 medios y 5 fáciles, y su nivel extra (Tumba del faraón, Cueva de cristal, Ídolo de oro, Forja del dragón y Tesoro galáctico).

Pruebas: `node tools/mechanics.js` (reglas de los bloques nuevos y de los objetos que cruzan) y `python3 tools/worldsflow.py` (capturas de cada mundo).

## Niveles 101 a 1000 (mundos 11-100)

- Los crea un generador determinista (`genLevel` en `src/levels3d.js`): el nivel N es siempre el mismo. Usa plantillas de estructura probadas (bloques, pirámides, escaleras, torres gemelas, anillos, puentes, murallas, templos y estructuras flotantes en el espacio), los elementos ya aprendidos y, sobre todo, el bloque propio de cada paisaje.
- **Paisajes**: cada 10 niveles cambia el mundo y rotan los 6 paisajes (mar, desierto, nieve, selva, volcán y espacio). En cada vuelta cambia la luz: día, atardecer, noche (con estrellas) y aurora boreal.
- **Dificultad**: en cada mundo, 1 nivel difícil, 4 medios y 5 fáciles. Cada nivel generado se afina con el jugador simulado (`tools/gentune.js`, resultados en `src/gentune.js`).
- **Niveles extra**: uno por mundo (100 en total). Ahora usan los números 10001-10100; las partidas guardadas antiguas se convierten solas.
- El mapa solo pinta los mundos abiertos y el siguiente, para que siga siendo ligero.

## Nivel de jugador, misiones y amigos

- **Experiencia**: subir del nivel L al L+1 cuesta `30 + 20·(L−1)` XP (cada nivel pide 20 XP más que el anterior). Se gana jugando (10 XP + 5 por estrella la primera vez, más en difíciles y extra; menos al repetir) y con las misiones. Ritmo: nivel 5 en unas 8 partidas, nivel 10 en unas 33, nivel 20 en unas 130 y nivel 50 en unas 800. Cada nivel da monedas; cada 5, una bomba; cada 10, 2 gemas.
- **Misiones en cadena** (al cobrar una aparece la siguiente): amigos (1, 5, 10, 25; la de 1 amigo da más que ninguna: 300 XP, 1.000 monedas, 15 gemas y una bola dorada), compartir el juego, equipar un cañón, racha diaria, vídeos con premio, superar el nivel 10, 25, 50... hasta 1000, desbloquear los mundos 2 a 100, estrellas, 3 estrellas, niveles extra, derribar bloques y bloques especiales, cascadas, bolas doradas y las difíciles (objetos del cielo, niveles difíciles y 3 estrellas en difíciles).
- **Gemas**: solo en las misiones de amigos, las de interactuar y las difíciles, y pocas.
- **Amigos**: cada jugador tiene un código (`CC-XXXXXXYY`, con 2 letras de control). Se añade un amigo escribiendo su código y se comparte con el botón «Compartir» (en Android abre el menú de compartir del móvil). En la versión de Google Play conviene comprobar los códigos con un servidor (por ejemplo, Firebase) para evitar trampas.
- No hay premios por valorar el juego en Google Play: está prohibido por sus normas.
