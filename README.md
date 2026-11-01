# Rocket Rush

Puzle de física en 3D para Android, en primera persona desde detrás de un cañón. Disparas bolas de colores contra castillos de bloques de gominola: si la bola toca un bloque de su color, revienta todo el grupo conectado de ese color y la estructura se derrumba con física real. Hay que derribar un porcentaje de la estructura con las bolas disponibles.

**Contenido:** 50 niveles en 5 mundos (Plaza mayor, Feria del castillo, Almacén helado, Puerto y Palacio de cristal) y 5 niveles extra, uno por mundo, que solo se abren con 3 estrellas en los 10 niveles de ese mundo. Los niveles extra tienen bloques de oro que sueltan monedas y dan el triple de premio la primera vez.

## Qué hay en esta carpeta

| Carpeta | Contenido |
| --- | --- |
| `src/` | El juego: reglas y física (`sim3d.js`), niveles (`levels3d.js`), ajuste de dificultad generado (`tuning.js`), gráficos, sonido y menús (`game3d.js`) y la página (`index.html`) |
| `vendor/` | three.js r169 (gráficos 3D) y cannon-es 0.20 (física), ambos con licencia MIT, ya incluidos para funcionar sin conexión |
| `tools/` | `build.js` junta todo en `dist/index.html`; `check3d.js` comprueba que los niveles no se caen solos; `curve3d.js` mide la dificultad con un jugador simulado; `tune.js` y `mergetune.js` ajustan bolas y objetivo de cada nivel; `shots.py`, `uiflow.py` hacen capturas y recorren los menús en Chromium |
| `ios/` | App de iPhone y iPad con el mismo juego (Swift + WKWebView, se compila en GitHub con `ios.yml`, sin Mac). Ver `ios/LEEME.md` |
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
3. En la pestaña **Actions**, el flujo "Compilar APK" arranca solo con cada subida y tarda 1-2 minutos.
4. Entra en la ejecución **más reciente** (la de arriba) y descarga el artefacto `RocketRush-1.0.N`: dentro está `RocketRush-1.0.N.apk`. El número N sube en cada compilación.
5. Pásala al móvil e instálala (Android pedirá permitir apps de origen desconocido).
6. En el juego, **Ajustes** muestra abajo «Rocket Rush · versión 1.0.N»: así compruebas que tienes la última.

Todas las APK de prueba se firman con la misma clave (`android/app/rocketrush-test.jks`) y cada una lleva un número de versión mayor, así que se instalan encima de la anterior sin perder el progreso. Las APK compiladas antes del 14/10/2026 usaban una clave distinta en cada compilación: si tienes una de esas, desinstálala una vez antes de instalar la nueva. Para Google Play hace falta firmarla con tu propia clave privada, que no va al repositorio (fase 3).

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

## Cañones y bolas: mejoras, cañones con más fuerza, aspectos y «Temporales»

Todo está en `src/cannons.js` (catálogo, cómo se dibuja cada cañón y cada bola, miniaturas de la tienda y la fuerza).

- **Tienda**: pestañas nuevas **⏳ Temporales** (la primera) y **🎨 Cañones**. Las pestañas se deslizan de lado.
- **Mejoras** (con monedas, sirven para cualquier cañón; cada nivel añade piezas al cañón normal):
  2 Aros reforzados (1.000, +10 % de fuerza) · 3 Mira telescópica (2.500, +10 % y la guía de tiro sigue un 40 % más allá de la diana)
  · 4 Tubos de presión (5.000, +20 % y guía larga) · 5 Turbo (10.000, +35 %, guía larga y los combos dan +25 % de puntos).
- **Cañones con más fuerza** (con gemas): Doble (150, +25 %) · Mortero Pesado (200, bola un 50 % más pesada, mismo tiro)
  · Vapor (250, +40 %) · Riel (350, +70 %) · Lanzacohetes (400, +100 % y una pequeña explosión al chocar que empuja los bloques, sin reventarlos).
  La fuerza total es cañón × mejora. En la física: una parte va en la velocidad (tiro más rápido y recto, como mucho ×1,5)
  y el resto en el peso de la bola, así el empujón sale multiplicado por esa fuerza. La guía de tiro dibuja el tiro real.
- **Liga de clubes**: sin bonus (todos los cañones tiran con la fuerza normal y sin guía larga); en la expedición y el jefe del club sí cuentan.
- **20 aspectos de cañón nuevos** (además de los de antes: Clásico, Real, Hielo, Arcoíris, Bastón, Calabaza y Fuego):
  comunes con monedas (Cobre, Camuflaje, Chicle, Sandía, Tigre), raros y épicos con gemas (Pirata, Neón, Cubi, Samurái,
  Galaxia, Dragón, Submarino, Fantasma, Arcade), legendarios que solo salen en «Temporales» (Diamante, Volcán, Tesoro,
  Holográfico) y los del Pase Pro (Robot y Bosque Encantado). Con un cañón fuerte y un aspecto que no sea el Clásico, el cañón se pinta con ese aspecto.
- **12 aspectos de bola**: cada bola conserva su color de juego (rojo, azul, verde, amarillo y morado); solo cambia el dibujo.
  Gominola (la de siempre) · Pelota de playa, Balón, Bola de billar (monedas) · Canica, Planeta, Carita, Frutas, Eléctrica (gemas)
  · Gema y Píxel (legendarias de «Temporales») · Huevo de dragón (Pase Pro, nivel 20). Las bolas especiales no cambian.
- **Temporales**: cada lunes cambian solos 2 cañones legendarios y 1 bola legendaria (cuenta atrás en la tienda);
  hay 2 ofertas del día con un 30 % menos (lo que aún no tienes); y la primera semana de cada temporada sale una semana el cañón
  del Pase Pro de la anterior (300 gemas). Desde el panel (Eventos › Tienda · Temporales) se pueden elegir a mano (`live.tmp`).
- **Pase Pro**: el nivel 30 da el cañón de la temporada (temporada 1: Arcoíris, 2: Robot, 3: Bosque Encantado, y vuelta a empezar)
  y el nivel 20 el Huevo de dragón.
- Guardado: `save.skins` (aspectos del cañón), `save.can = { lv, own, eq }` (nivel de mejora y cañones) y `save.bskin = { own, eq }` (bolas).
- Prueba: `python3 tools/cannonflow.py` (tienda, compras, mejoras, física de cada cañón, liga sin bonus y Pase).

## Racha diaria

- Un premio por cada día que entras y lo recoges, y un cofre cada 5 días: madera, plata, oro, cristal, épico y legendario (día 30, con el **Cañón de Fuego**, exclusivo de la racha). A partir del día 30 hay un cofre legendario cada 5 días.
- La ventana se abre sola una vez al día, 1,5 s después de abrir el juego (o de volver a él otro día). Si ese día aún no ha salido, aparece al llegar al mapa. Nunca sale a mitad de partida, y solo después de ganar el nivel 1. Tiene una X arriba a la derecha para cerrarla. En la portada y en el mapa siempre está el botón de la llama.
- Si faltas un día, lo cubre un escudo de racha (máximo 2). Sin escudo, la racha se salva con un vídeo (una vez por semana) o con 15 gemas. Si faltas 2 días o más, empieza de cero.
- Android: aviso local a las 19:00 (`ReminderReceiver.java`). El permiso de notificaciones se pide solo al tocar «Avisarme». Se apaga en Ajustes. Si el móvil se reinicia, el aviso se vuelve a programar al abrir el juego.
- Prueba en navegador: `python3 tools/dailyflow.py` (simula días con `ChromaGame.shiftDays(n)`).

## Mundos 6 a 10 (niveles 51-100)

> Desde la versión con jefes, el orden de los mundos cambió: ver «Mundos por paisaje, jefes y bloques nuevos» al final. Los niveles de esta tabla siguen existiendo, ahora dentro de su paisaje.

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

> El paisaje de cada nivel generado ahora lo decide su mundo (ver el final). La forma y la dificultad de cada nivel no cambian.

- Los crea un generador determinista (`genLevel` en `src/levels3d.js`): el nivel N es siempre el mismo. Usa plantillas de estructura probadas (bloques, pirámides, escaleras, torres gemelas, anillos, puentes, murallas, templos y estructuras flotantes en el espacio), los elementos ya aprendidos y, sobre todo, el bloque propio de cada paisaje.
- **Paisajes**: cada 10 niveles cambia el mundo y rotan los 6 paisajes (mar, desierto, nieve, selva, volcán y espacio). En cada vuelta cambia la luz: día, atardecer, noche (con estrellas) y aurora boreal.
- **Dificultad**: en cada mundo, 1 nivel difícil, 4 medios y 5 fáciles. Cada nivel generado se afina con el jugador simulado (`tools/gentune.js`, resultados en `src/gentune.js`).
- **Niveles extra**: uno por mundo (100 en total). Ahora usan los números 10001-10100; las partidas guardadas antiguas se convierten solas.
- El mapa solo pinta los mundos abiertos y el siguiente, para que siga siendo ligero.

## Nivel de jugador, misiones y amigos

- **Experiencia**: subir del nivel L al L+1 cuesta `30 + 20·(L−1)` XP (cada nivel pide 20 XP más que el anterior). Se gana jugando (10 XP + 5 por estrella la primera vez, más en difíciles y extra; menos al repetir) y con las misiones. Ritmo: nivel 5 en unas 8 partidas, nivel 10 en unas 33, nivel 20 en unas 130 y nivel 50 en unas 800. Cada nivel da monedas; cada 5, una bomba; cada 10, 2 gemas.
- **Misiones en cadena** (al cobrar una aparece la siguiente): amigos (1, 5, 10, 25; la de 1 amigo da más que ninguna: 300 XP, 1.000 monedas, 15 gemas y una bola dorada), compartir el juego, equipar un cañón, racha diaria, vídeos con premio, superar el nivel 10, 25, 50... hasta 1000, desbloquear los mundos 2 a 100, estrellas, 3 estrellas, niveles extra, derribar bloques y bloques especiales, cascadas, bolas doradas y las difíciles (objetos del cielo, niveles difíciles y 3 estrellas en difíciles).
- **Gemas**: solo en las misiones de amigos, las de interactuar y las difíciles, y pocas.
- **Amigos**: cada jugador tiene un código (`RR-XXXXXXYY`, con 2 letras de control). Se añade un amigo escribiendo su código y se comparte con el botón «Compartir» (en Android abre el menú de compartir del móvil). En la versión de Google Play conviene comprobar los códigos con un servidor (por ejemplo, Firebase) para evitar trampas.
- No hay premios por valorar el juego en Google Play: está prohibido por sus normas.

## Modo prueba y probadores

- En las APK de prueba (`apk.yml`) el juego lleva `TEST_MODE = true`: botón «Modo prueba: desbloquear todo» en Ajustes y
  compras simuladas.
- La versión para Google Play (`release.yml`, `node tools/build.js --release`) va con `TEST_MODE = false`: nadie ve el botón…
- …salvo los **probadores**: en el panel (`/admin` › Jugadores › buscar su código RR-… › «🧪 Hacer probador») se crea
  `testers/{uid}` y el juego, al sincronizar, enseña el botón con la nota «Eres probador». Quitarlo en el panel lo devuelve a
  su progreso normal. Las compras de los probadores se prueban con los «testers de licencias» de Play Console (no cobran).
- Prueba: `tools/namesflow.py dist/index.html` (y con una versión `--release`).
- **Herramientas de prueba** (en Ajustes, debajo de «Modo prueba»; solo en la versión de pruebas o para probadores): **+500 gemas**, **+10.000 monedas**,
  **Compras simuladas** (la tienda de gemas, monedas y ofertas da lo comprado sin pasar por Google Play ni cobrar) y **Quitar aspectos**
  (deja el cañón, las mejoras y las bolas como al principio para volver a comprarlos).

## Bolas de los mundos

Cada uno de los 10 primeros mundos tiene su bola especial, con su diseño y su superpoder. Se abre al desbloquear el mundo:

| Mundo | Bola | Superpoder |
|---|---|---|
| 1 · Plaza mayor | Demoledora (acero) | Atraviesa la estructura rompiendo lo que toca, incluso la piedra |
| 2 · Feria del castillo | Fuegos artificiales | Estalla en chispas que revientan bloques al azar |
| 3 · Almacén helado | Escarcha | Onda helada que rompe todo el piso donde golpea |
| 4 · Puerto | Ancla | Parte la estructura de arriba abajo |
| 5 · Palacio de cristal | Prisma (irisada) | Pinta de un color lo de alrededor y lo revienta de golpe |
| 6 · Dunas doradas | Tornado | Remolino de arena que levanta la estructura y la lanza fuera |
| 7 · Pico helado | Bola de nieve gigante | Enorme y pesada: rueda arrasando |
| 8 · Templo perdido | Camaleón | Toma el color de cada bloque que toca y revienta su grupo |
| 9 · Isla de fuego | Meteoro | Funde las columnas de alrededor del impacto |
| 10 · Base lunar | Agujero negro | Se traga lo que tiene cerca durante casi 2 segundos |

- **Tienda**: con monedas (360 a 900). **Antes de la partida**: la bola del mundo de ese nivel se compra con gemas (5 en los mundos 1-5, 8 en los 6-10) y se elige como las demás ventajas.
- **Niveles de la bola**: los mundos 11-100 no traen bola nueva; cada uno sube de nivel la bola de su paisaje (más radio o más bloques; máximo nivel 10). Los mundos del mar van rotando entre las 5 bolas del mar.
- Si una bola de los mundos no se llega a disparar, vuelve al inventario. Prueba: `node tools/wballs.js` y `python3 tools/wballsflow.py`.

## Estilo de menús (gominola con borde dorado)

Todas las ventanas y menús usan el mismo estilo, elegido entre varias propuestas (B2 con las estrellas de la B1):

- **Paneles de gelatina morada** con brillo arriba, **borde de oro biselado** y contorno oscuro. El título va encima del borde, con letras con contorno y el **bloque-mascota** asomando (amarillo; naranja en la racha y morado en «¡Casi!»).
- **Botones de gominola** con aro dorado: verde para jugar o cobrar, rosa para los anuncios, dorado para lo de pago y gris para volver. La X de cerrar es una moneda dorada.
- **Estrellas de oro clásico con luz** (halo, brillo y destello) en la victoria, en la pantalla previa (tus mejores estrellas en ese nivel) y en las casillas del mapa. Las estrellas que faltan se ven como huecos morados.
- Se aplica a la racha, la tienda, el pase, las misiones, el mapa, la pausa, la victoria, la derrota y los ajustes. Todo está en un bloque de CSS al final de `src/index.html`, y las estrellas son símbolos SVG (`#starS`, `#starE`, `#starM`). Capturas: `python3 tools/themeshots.py`.

## Pantalla inicial de Rocket Rush

Mezcla de dos propuestas: la «Despegue» (C) con el cartel dorado de la «Placa dorada» (B).

- **Cartel**: panel de gelatina morada con borde de oro. Dentro pone «ROCKET» en naranja fuego y «RUSH» en oro, con «DEMOLICIONES 3D» debajo. La mascota asoma por la esquina y una bola-cohete sale por la otra, dejando una estela con los 5 colores de los bloques.
- **Fondo**: el paisaje y la estructura del nivel en el que vas. La cámara baja la vista para que el cartel no tape la estructura.
- **Botones a los lados**: racha (con su número), pase y misiones a la izquierda, con avisos rojos cuando hay algo que cobrar; tienda y ajustes a la derecha.
- **Abajo**: «Nivel N · nombre del mundo» y el botón grande **¡A DEMOLER!**, que lleva al mapa.
- Se adapta a móviles bajos (botones algo más pequeños por debajo de 700 px de alto).

## Mapa con los 100 mundos

El mapa enseña los 100 mundos desde el principio, también los bloqueados: candado en el título, «Se abre al superar el nivel N» y casillas en gris con su número. Cada mundo lleva un fondo del color de su paisaje (mar, desierto, nieve, selva, volcán o espacio). Al tocar un nivel bloqueado sale un aviso. Para que vaya fluido con 1000 casillas, el navegador solo pinta los mundos que están en pantalla (`content-visibility`) y un único escuchador atiende todos los toques.

## Icono de la app

Icono elegido: **bloque de gelatina morada** que ocupa todo el icono, con «ROCKET» en naranja fuego, «RUSH» en oro y la bola-cohete con su estela de colores.

- Es un **icono adaptable** de Android 8 o superior (`mipmap-anydpi-v26`): el fondo morado y las letras van en capas separadas (`ic_launcher_background` e `ic_launcher_foreground`), así que se ve bien con cualquier forma de icono (redondo, cuadrado o gota) y las letras nunca se cortan.
- Para Android 7 hay versiones clásica y redonda (`ic_launcher`, `ic_launcher_round`) en las 5 densidades.
- En `store/` están el icono de 512 px para Google Play (`icono-play-512.png`) y los SVG originales para retocarlo.

## Nombre: Rocket Rush

Todo lo que ve el jugador dice **Rocket Rush**: nombre de la app, portada, icono, versión en Ajustes, texto para compartir y archivo de la APK. Los códigos de amigo ahora empiezan por `RR-`, y los antiguos `CC-` siguen valiendo. El identificador de la app es `com.rocketrush.game`: es el que aparece en el enlace de Google Play y no se puede cambiar después de publicar. Antes era `com.chromacrash.game3d`, así que la primera APK con el nombre nuevo (1.0.16) se instala como una app distinta: hay que desinstalar la antigua. Por dentro se mantienen dos nombres internos que no se ven: la clave del guardado (`chromacrash3d.v1`) y el puente con Android (`ChromaAndroid`).

## Iconos del juego (estilo «caramelo brillante»)

Bolas, monedas, gemas, cofres, escudo de racha, llama de la racha, estrella del pase y XP tienen dibujos con volumen de gominola: degradado, brillo arriba y sombra suave. Los cofres de cristal, épico y leyenda llevan además halo de luz y joya.

- Se generan con `python3 tools/iconset.py`, que reescribe el bloque `/*ICONOS:INI … ICONOS:FIN*/` de `src/index.html` con SVG incrustados (unos 100 KB, sin archivos externos).
- Las clases son las mismas de siempre (`.ball.bR`, `.coin`, `.gem`, `.chest.gold`, `.shieldi`…), así que salen igual en la tienda, la racha, el pase, las misiones, la victoria y la bandeja de bolas durante la partida. También hay clases nuevas: `.ball.bPlus2` (+2 bolas), `.gems2` (montón de gemas) e `.ico-fire`, `.ico-star`, `.ico-xp` e `.ico-golden`, que sustituyen a los emojis.
- El cofre tiene la tapa en una pieza aparte, así que al abrirlo se levanta de verdad.
- El mismo archivo guarda los otros dos estilos que se propusieron (pegatina y medalla dorada) por si se quieren recuperar.

## Menús «Feria luminosa»

Todas las ventanas (nivel, racha, tienda, pausa, victoria, derrota, ajustes) son casetas de feria:

- **Panel**: fondo morado con confeti, toldo de rayas rojas y blancas arriba y bombillas encendidas alrededor que parpadean. El título va en un letrero de neón con la mascota al lado.
- **Tickets**: las filas de la tienda, las misiones y los días de la racha son tickets con muescas a los lados. En la racha, los tickets van unidos por un camino de puntos. Los precios son etiquetas colgantes.
- **Ventajas** antes de jugar: casetas con aro rojo y blanco; la elegida, con aro verde.
- **Tienda**: monedero arriba y pestañas (Ofertas, Gemas, Bolas, Monedas) que bajan a su sección. El Pack de inicio sale como oferta destacada, con rayos girando, y hay etiquetas «MÁS POPULAR» y «MEJOR VALOR». No hay descuentos inventados ni cuentas atrás falsas: en Google Play no están permitidos.
- **Racha**: fila de próximos cofres, con los 5 siguientes.
- **Monedero** del mapa, el pase y las misiones: lleva un «+» verde que abre la tienda en monedas o en gemas.
- La cabecera del pase, la de misiones y el cartel de la portada también llevan bombillas.

## Cambiar de bola cuesta 10 monedas

En la partida, cambiar la bola del cañón por otra de la bandeja (con el icono ⇄, la bola grande o cualquier bola de la cola) cuesta **10 monedas** (`SWAP_COST` en `game3d.js`).

- El precio sale bajo el icono ⇄. Se pone en rojo si no te llega, y en ese caso el cambio no se hace y sale un aviso. Al pagar aparece «-10» flotando.
- El primer cambio del tutorial del nivel 2 es gratis (pone «GRATIS»), para que el jugador lo aprenda sin pagar.
- Tocar una bola del mismo color que la del cañón no hace nada ni cobra.

## Mapa más fluido

- Mientras estás en el mapa, el pase o las misiones, el paisaje 3D de fondo se pinta a 20 imágenes por segundo y se para del todo mientras deslizas, para dejar el móvil libre para el desplazamiento.
- Cada mundo tiene una altura fija (nombres largos en una línea con «…»), y el juego mide ese tamaño y se lo pasa al navegador. Así, al pintar los mundos que entran en pantalla, la lista no da saltos (antes daba unos 45 saltos al recorrer el mapa; ahora ninguno).

## Apertura de cofres

Al recoger un cofre de la racha se abre una pantalla completa:

1. El cofre cae rebotando y levanta polvo.
2. Se toca tres veces: cada golpe lo aplasta, saltan chispas y se agrieta y brilla del color de su categoría (madera, plata, oro, cristal, épico o leyenda).
3. Al tercer golpe revienta: un único fogonazo blanco, la tapa sale volando, rayos girando y confeti. Los premios saltan del cofre y caen al suelo rebotando: monedas, gemas, bolas, escudo y cañón.
4. Con cada toque se recoge un premio. Sale una carta con el número subiendo y las piezas del suelo vuelan al contador de arriba (monedas y gemas) o a la carta (lo demás). Aquí no hay destellos. Si tocas mientras sube el número, se completa al momento.
5. Al final hay un resumen y se vuelve a la ventana de la racha.

- El botón atrás de Android cierra la animación y entrega los premios igual (ya se habían dado al recoger).
- Sonidos sintetizados en `src/sfx.js`, sin archivos de audio. Hay tres juegos (`arcade`, `magia`, `feria`) y se elige con `CHEST_SFX` en `game3d.js`: el elegido es **magia** (campanillas, soplo de aire al estallar, destellos al recoger y coro suave en los premios especiales). Respetan el botón de sonido de Ajustes.

## Portada en 3D: demolición en bucle

En la portada se ve la estructura del nivel en el que vas, con el motor 3D y la física del propio juego:

- La cámara se balancea un poco delante de la estructura. Cada 3 segundos llega una bola dorada desde delante y la revienta: los bloques estallan en pedazos con anillos de luz y un pequeño temblor, y el resto sale volando.
- A los 3,6 segundos la estructura vuelve a aparecer bloque a bloque, de abajo arriba, con un pequeño rebote, y el ciclo empieza otra vez.
- Es solo decoración: no da premios, no cuenta para las misiones ni para las estadísticas y no suena. Se detiene mientras haya una ventana abierta (racha, tienda, ajustes…).
- El cartel del nombre va sin bombillas.
- Código: `titleDemo()` y `titleEvents()` en `game3d.js`.

## Mundos por paisaje, jefes y bloques nuevos

**Ritmo de los mundos** (`src/levels3d.js`, bloque «ORDEN DE LOS MUNDOS»)
- Los mundos 1, 2 y 3 son cortos (5, 6 y 8 niveles); el resto tiene 10. Así el primer cambio de paisaje y el primer jefe llegan pronto (nivel 20).
- Cada paisaje dura 3 mundos y cada mundo tiene su luz: **día, atardecer y anochecer**.
- Mundos 1-18: mar, desierto, nieve, selva, volcán y espacio. Del 19 al 51 vuelven con **clima**, que también cambia la partida (aviso arriba a la izquierda y explicación la primera vez):
  | Clima | Efecto |
  |---|---|
  | Tormenta (mar) | Viento constante que desvía la bola; la guía de apuntado ya lo tiene en cuenta |
  | Tormenta de arena (desierto) | Ráfagas de viento que suben y bajan de fuerza |
  | Ventisca (nieve) | Todo resbala la mitad: las torres caen con poco |
  | Lluvia (selva) | Suelo mojado: los bloques resbalan algo más |
  | Ceniza (volcán) | Cada 6-10 s cae una brasa que rompe un bloque de arriba |
  | Meteoritos (espacio) | Cada 8-13 s un meteorito golpea la estructura |
- Desde el mundo 52 se intercalan **6 paisajes nuevos** con las vueltas de los clásicos: ciudad de caramelo, cueva de cristales, templo antiguo, bosque encantado, feria y ciudad neón (cada uno con su suelo, decorado, plataforma y efectos).
- 100 mundos, 1023 niveles (incluidos 34 jefes y 7 niveles de estreno) y 100 niveles extra (uno por mundo; se abre con 3 ★ en todos los niveles de su mundo).
- **La dificultad no cambia**: cada nivel conserva su tipo (fácil, medio o difícil) y su ajuste. Las partidas guardadas se convierten solas: cada nivel viejo conserva sus estrellas y el progreso sigue donde estaba.

**Jefes** (`src/bosses.js`): el último nivel de cada 3.er mundo (y del 100). Rotan tres tipos y cambian de nombre y aspecto con el paisaje:
| Tipo | Ejemplo | Cómo se gana |
|---|---|---|
| Barco pirata | Capitán Bloquebarba (mundo 3) | Derribar el barco y su tesoro dorado. Su cañón se carga **con cada tiro y con el tiempo** (barra «CAÑONAZO»): si esperas, también dispara. Con la mitad de los bloques derribados carga un 35 % más rápido. Cada cañonazo quita una bola. Prueba: `python3 tools/shipflow.py [nivel]`. |
| Pirámide | Faraón Arenas (mundo 6) | Su vida está en la **máscara de oro**: **5 golpes**. El escudo cambia de color cada 2 tiros (los ojos de la máscara y la barra avisan del siguiente); para abrirlo hay que romper 4, 5, 6, 7 y 8 bloques de su color, y si cambia antes de completarlo se recupera un poco (-1). La pirámide tiene como mucho 3 bloques del mismo color juntos. Con el escudo roto hay 2 tiros para darle a la máscara (1 en los dos últimos golpes) y la máscara va más despacio. La máscara: quieta, luego de lado a lado (golpes 2 y 3) y al final da vueltas a la pirámide y a veces se esconde detrás. **Maldición de arena**: cada 3 tiros una bola de color de la bandeja se vuelve de arena (no revienta bloques, pero sí vale contra la máscara). Desde el 3.er golpe sopla una tormenta de arena con viento. Empieza con 16 bolas y gana 3 por golpe; tras cada golpe la arena reconstruye la pirámide. Prueba: `python3 tools/pharaohflow.py` (un jugador automático que apunta bien gana más o menos la mitad de las veces, en unos 16-23 tiros). |
| Gólem | Gólem de hielo (mundo 9) | Camina sobre una losa. Piernas de piedra y el resto del cuerpo de colores. **Sus 3 núcleos de lava se encienden de uno en uno** (primero los de delante; los demás, sellados en roca oscura): al romper o perder el encendido se enciende el siguiente. **Si derribas todos sus bloques de colores, cae solo** («¡GÓLEM DESMONTADO!»). El golpe sísmico quita una bola; cada núcleo roto lo aturde. Un núcleo que se cae (detrás, a un lado o al agua) sube flotando delante del gólem. Del primero al último: colores más mezclados, alguna placa de piedra más, núcleos con coraza (1, 2 o 3 golpes), camina y carga más rápido y el núcleo flotante se mueve (`python3 tools/golemflow.py nivel semilla 0`). |
**Jefes repetidos más difíciles**: cada jefe tiene una dificultad que sube desde el primero de su mismo tipo (0 en el primer barco, faraón y gólem; 1 en el último de cada tipo). Barco: el cañón carga antes y los colores están cada vez más mezclados (grupos de 6 en el primero a 3 en el último), con unas bolas más para compensar. Faraón: desde la mitad pide 1 bloque más por escudo y desde los dos tercios la maldición llega cada 2 tiros; la máscara da vueltas más rápido. Gólem: camina más rápido y carga el golpe sísmico antes.

Barra de vida arriba, presentación al empezar, explosión final y **cofre de oro**. Contra un jefe no se regalan bombas ni arcoíris por combo. Estrellas: 3 si quedan 3 bolas o más, 2 si queda alguna, 1 si no.

**Bloques nuevos** (`src/sim3d.js`, 19 en total). Cada uno se estrena en un nivel fácil con la tarjeta «¡Bloque nuevo!» y un anillo que lo señala hasta el primer tiro; el nivel siguiente es de práctica, 3 niveles después se combina con lo anterior y luego aparece en los niveles generados (los que ayudan, en todos los paisajes; los obstáculos, en su paisaje y en los nuevos).
| Nivel | Bloque | Qué hace |
|---|---|---|
| 4 | Cohete | Barre su fila de punta a punta |
| 15 | Piñata | Con 2 golpes revienta y suelta monedas |
| 22 | Reloj de arena | +1 bola |
| 65 | Espejo | Rebota la bola; no se rompe |
| 84 | Muelle | El primer golpe lanza por los aires lo que tiene encima (y el muelle se queda aplastado y más oscuro); el segundo lo revienta. Cuenta como bloque: para las 3 estrellas hay que reventarlo. |
| 127 | Géiser | Chorro que rompe su columna |
| 158 | Portal | La bola entra por uno y sale por el otro, sobre la estructura |
| 520 | Caja sorpresa | Bomba, arcoíris o +2 bolas al azar |
| 551 | Burbuja | El bloque flota dentro hasta que revientas la pompa |
| 582 | Cubo arcoíris | Revienta todos los bloques del color de la bola |
| 613 | Ventilador | Sopla con fuerza hacia la estructura |
| 644 | Candado y llave | Los candados no se rompen hasta romper la llave |
| 675 | Bola de nieve | Rueda y arrasa hasta 6 bloques |
| 706 | Nube | Tapa el color de lo que hay detrás hasta que la atraviesas |
| 737 | Liana | Cuelga a un lado; si la golpeas con otro color, sale contra la torre |
| 768 | Globo | Sube si no tiene nada encima; si lo revientas, lo de arriba cae |
| 830 | Imán | Atrae lo de alrededor y se traga hasta 5 bloques |
| 861 | Tótem | Revienta con su color; si fallas, cambia de color |
| 892 | Chicle | La bola se queda pegada; con otro toque eliges hacia dónde sale |
Prueba rápida: `node tools/newblocks.js`.

**Más ganas de seguir jugando**
1. Combo musical: cada pieza de un tiro suena una nota más aguda; con 5, 10, 15 y 25 piezas salen «¡GENIAL!», «¡INCREÍBLE!», «¡ROCKET RUSH!» e «¡IMPARABLE!» con vibración. Cámara lenta al caer la última pieza.
2. Gran final: las bolas que sobran salen como cohetes, revientan lo que queda y dan 5 monedas cada una.
3. «¡Casi!»: dice cuántos bloques faltaban y la primera derrota de cada mundo regala +3 bolas.
4. Racha de victorias con llama en el botón de jugar. **Premio de racha** al ganar, al azar dentro de su nivel y nunca el mismo dos veces seguidas: racha 1 = 30-50 monedas; 2 = 80 monedas, cohete o +2 bolas; 3 = bomba, arcoíris, 120 monedas o 2 gemas; 4-5 = bomba + 100 monedas, arcoíris + cohete, 4 gemas o bola de mundo; 6+ = bola dorada, 8 gemas, bomba + arcoíris + 150 monedas o 2 bolas de mundo + 2 gemas. Va a tu inventario (no cuenta para el x2 de monedas). En la ventana del nivel **ninguna ventaja es gratis**: si te quedan se usan, y si no se compran ahí mismo al precio de la tienda (cohete 200, bomba 250, arcoíris 300, +2 bolas 200 y bolas de mundo a su precio en monedas). El **cohete de salida** también está en la tienda.
5. Recompensa variable: cofre de estrellas en lo alto del mapa (cada 30 ★) y caja misteriosa al superar por primera vez cada 5.º nivel (a veces con premio doble).

Pruebas: los tests de siempre (`tools/*flow.py`), ya adaptados a los números de nivel nuevos.

## Colores: solo revienta la bola de su color

Antes, una bola de otro color podía reventar un grupo entero: al empujar el bloque contra su vecino del mismo color saltaba la cascada (que es para los bloques que **caen** sobre los de su color). Pasaba en uno de cada cuatro niveles más o menos, también en los jefes (por ejemplo, Barcaza del río, 113).

Ahora cada bloque recuerda su altura de reposo y la cascada solo salta si uno de los dos ha caído al menos medio bloque. Los empujones no cuentan, y las cascadas de verdad siguen igual. Prueba: `node tools/wrongcolor.js 3` (bola de otro color contra el bloque más cercano en 1 de cada 3 niveles): antes 27 % de niveles con bloques reventados por error; ahora solo quedan los derrumbes reales.

## Lianas: los bloques ya no se meten unos dentro de otros

El punto del que cuelga cada liana era un cuerpo físico sin forma. Eso descolocaba el sistema que decide qué piezas se tocan, y algunos bloques dejaban de chocar entre sí: en el nivel 1022 (el que sale de fondo en la portada con todo desbloqueado) el tablón rojo se hundía por la derecha dentro de la columna. Ahora el amarre lleva una forma diminuta que no choca con nada. Afectaba a los 8 niveles con liana, también durante la partida.

## Tirones con viento y tormenta de arena

El aviso del viento se reescribía en cada fotograma, igual que la puntuación, el porcentaje y el botón de la bola dorada. Cada cambio en la capa de encima del juego obliga al móvil a repintarla, y eso se notaba como tirones (más con viento, porque había un cambio más). Ahora solo se toca cuando cambia de verdad: 0 cambios por fotograma en partida normal. Las partículas de la tormenta no se han tocado.

## Barco con casi 100 bloques, primer faraón más fácil, tormenta visible y menos tirones

- **Barco**: había un fallo que ponía el cuerpo de piedra del gólem en los dos primeros barcos (niveles 20 y 113), por eso eran casi todo piedra y caían enseguida. Ahora todos los barcos llevan su casco de colores, castillos de proa y popa, cabina y mástil (95 bloques que se pueden reventar). Grupos de color de hasta 6 en el primero y cada vez más mezclados (hasta 3) en los siguientes.
- **Faraón**: pirámide de 3 de fondo (menos piezas = física más ligera). En el primer faraón el escudo siempre cambia a un color del que tienes bolas, hay 2 tiros contra la máscara hasta el final y +4 bolas por golpe; esta ayuda se va quitando poco a poco en los siguientes faraones y desaparece a partir de los dos tercios del juego. La tormenta de arena llega tras el 2.º, 3.º y 4.º golpe y dura 2 tiros en el primer faraón (hasta 6 en los últimos); luego amaina.
- **Tormenta de arena visible**: rachas de arena y granos redondos que van hacia donde sopla el viento (antes eran puntitos casi invisibles), también en el jefe.
- **Menos tirones al impactar**: la física da como mucho 4 pasos por fotograma (lo justo para 30 fotogramas por segundo; antes 6, que encadenaba fotogramas lentos); el sonido de varias piezas que revientan a la vez se junta en uno; la nota del combo usa 2 osciladores en vez de 3-6; los efectos (destellos y anillos) se preparan al cargar.

## Portada y misiones nuevas

- **Portada**: la bola dorada ya no se lanza al centro (hay estructuras huecas por dentro); apunta al bloque de delante más cercano al centro y a media altura, así que siempre impacta.
- **Misiones** (difíciles): «Derriba al pájaro 3 veces» (luego 15 y 40) y «Derriba el barco 10 veces» (luego 30 y 75; cuenta también lo que cruza en su lugar en cada paisaje: globo, teleférico, mono, dragón u ovni).

## Idiomas

Español, inglés, portugués, francés, alemán e italiano. La primera vez que se abre el juego sale una ventana para elegir el idioma (con el del móvil marcado) y se puede cambiar en **Ajustes**.

- El juego sigue escrito en español. `src/i18n.js` traduce todo lo que sale en pantalla (textos de la página y los que el juego va poniendo: botones, avisos, nombres de niveles y mundos, misiones, jefes, textos flotantes…) con la tabla de `src/i18n-data.js` (unos 1.100 textos): frase exacta, plantilla con trozos variables (`Nivel {x} · {x}`), textos compuestos con « · » y frases conocidas dentro de textos más largos. Lo que no está en pantalla (mensaje al compartir, aviso de la racha) se traduce con `I18N.t()`.
- Para añadir textos nuevos: `python3 tools/i18n_extract.py` (saca los textos en español del código), `python3 tools/i18n_missing.py en` (juega en inglés y lista lo que siga en español) y `python3 tools/i18n_merge.py tabla.py` (añade las traducciones a la tabla).
- Las pruebas fijan el español (`localStorage rocketrush.lang = es`) para que no salga la ventana de idioma.

## Nombres de jugador únicos

- `names/{nombre en minúsculas}` → uid. Al escribir el nombre se comprueba si está libre («✓ Disponible» / «Ese nombre ya lo
  tiene otro jugador»); al guardar se reserva el nuevo y se libera el anterior en el mismo lote. Mínimo 3 letras y filtro de
  palabras malsonantes (6 idiomas). Los nombres de antes se reservan solos; si ya lo tenía otro, vuelve a «Jugador XXXX».
- Borrar la cuenta en línea libera el nombre. Las reglas no dejan coger ni liberar el nombre de otro.

## Denunciar y bloquear (contenido de los jugadores)

- Tocar a otro jugador (clasificaciones, amigos, miembros del club con «🚩 Denunciar o bloquear») o a un club (buscador y
  liga) abre una ficha con **Denunciar** (nombre ofensivo, trampas o descripción, otro motivo) y **Bloquear**.
- Denunciar crea `reports/{tú}_{él}` (una por denunciante y denunciado; solo las lee el panel). El panel tiene la pestaña
  **🚩 Denuncias**: agrupadas por denunciado, con «Ver jugador» (cambiar nombre, poner a cero, bloquear, borrar) o, para
  clubes, cambiar nombre, quitar descripción o borrar el club; y «Descartar».
- Bloquear se guarda en el móvil: su nombre y avatar pasan a «Jugador bloqueado»/«Club bloqueado», sus solicitudes de
  amistad no se ven y, si era amigo, deja de serlo. Lista para desbloquear en Ajustes › Privacidad y ayuda.
- Los nombres de club y las descripciones pasan el mismo filtro de palabras que los nombres de jugador.
- Prueba: `tools/reportflow.py` (y `tools/adminflow.py` para el panel).

## Amigos, clasificaciones y perfil (Firebase)
El botón **Amigos** de la portada abre tres pestañas:
- **Amigos**: tu código de amigo (el mismo `RR-` de siempre), compartirlo y añadir el de otro. Añadir envía una **solicitud**; cuando el otro la acepta, aparecéis en la lista del otro con nivel, estrellas, racha diaria, victorias seguidas, mejor tiro, victorias (con % de partidas ganadas) y jefes derrotados. La portada avisa con un número cuando tienes solicitudes. La misión «Añade amigos» cuenta los amigos que han aceptado.
- **Clasificación**: mundial, de tu país o entre amigos, por nivel, estrellas, racha diaria, victorias, victorias seguidas, mejor tiro, jefes y nivel de jugador. Se ven los 50 primeros y, si no estás entre ellos, tu puesto debajo.
- **Perfil**: nombre (máx. 16 letras), avatar, país y todas tus estadísticas. Esta pestaña funciona sin conexión.

Estadísticas nuevas que guarda el juego: partidas jugadas, victorias, victorias seguidas (actual y récord) y **mejor tiro** (bloques derribados desde un disparo hasta el siguiente).

Cómo funciona por dentro (`src/social.js`):
- Habla con Firebase por su API REST, sin librerías: el juego sigue igual sin internet y, cuando hay conexión, sube el perfil (como mucho cada 20 s y solo si cambió) y descarga amigos y clasificaciones.
- Cuenta **anónima** por móvil; la sesión se guarda en el propio móvil. Si se desinstala el juego se pierde (más adelante se podrá vincular a Google).
- Firestore: `users/{uid}` (perfil público), `codes/{código}` → uid, `friendships/{uidA_uidB}` (pendiente → aceptada). Las reglas están en `firebase/firestore.rules` y los índices de las clasificaciones por país en `firebase/firestore.indexes.json`.
- El workflow «Publicar reglas de Firebase» las sube solo si existe el secreto `FIREBASE_SERVICE_ACCOUNT` en GitHub. Sin él, las reglas se pegan a mano en la consola.
- Los nombres de los jugadores llevan `translate="no"` para que el traductor del juego no los cambie.
- Prueba: `python3 tools/socialflow.py`: dos jugadores con un Firebase simulado (solicitud, aceptar, clasificaciones, puesto fuera del top 50, perfil, sin conexión, inglés y quitar amigo).

**Paquete nuevo**: la app ahora es `com.lostanarchygames.rocketrush`. Se instala como app distinta: hay que desinstalar la antigua y el progreso empieza de cero (el modo prueba de Ajustes desbloquea todo). El juego se carga desde la APK como `https://appassets.androidplatform.net/assets/index.html` (WebViewAssetLoader), que es lo que necesita Firebase; la app pide permiso de internet.

### Pruebas contra el Firebase real
El workflow **«Probar Firebase»** se lanza cuando cambian `src/social.js` o las pruebas. Primero publica los índices (`tools/deploy_indexes.py`, por la API de Firestore) y las reglas (con firebase-tools, que necesita el rol «Administrador de Firebase Rules»). Después ejecuta:
- `tools/firebase_live.mjs`: lo que las reglas permiten y lo que no, los códigos, las amistades y las clasificaciones.
- `tools/socialflow.py` con `LIVE=1`: el juego de verdad con dos jugadores.

Los jugadores de prueba son del país «ZZ» y se borran al terminar. Los resultados y las capturas quedan en la rama `resultados-pruebas`. La base de datos tiene que llamarse exactamente `(default)`, con paréntesis: es la única que entra en la cuota gratis.

## Evento de Halloween (hasta el 1 de noviembre a las 23:59, hora de España)
Todo el evento se apaga solo al acabar el plazo: `HW_END` en `src/game3d.js`. Para probarlo después, pon `save.hwForce = true` en el modo prueba.

- **Portada:** durante el evento muestra el paisaje de Halloween en 3D, sin bloques.
  - Castillo encantado con murciélagos alrededor de los torreones y luna llena.
  - La bruja pasa volando y se ríe.
  - Relámpagos cada 1-2 s, con trueno de vez en cuando.
  - Música de Halloween y sombrero de bruja en la mascota.
  - Arriba a la derecha, una calabaza con la cuenta atrás que abre el mundo de Halloween.
- **Mapa:** bajo la barra de misiones hay una fila con tres botones.
  - **Mundos** te lleva al nivel en curso.
  - **Club** abre la pantalla de clubes (ver «Clubes»).
  - **Halloween** muestra la calabaza y el tiempo que queda.
- **Mundo de Halloween** (`Levels.HW`, ids 20001-20050):
  - 50 niveles en 5 zonas: Calle de las calabazas, Cementerio maldito, Mansión encantada, Bosque de las brujas y Castillo del vampiro.
  - El 10.º de cada zona es un jefe: Capitán Calavera, Gólem del cementerio, Faraón maldito, Galeón fantasma y Rey Vampiro.
  - La dificultad va de fácil a media-difícil. Los niveles están afinados con `tools/hwtune.js` y guardados en `src/gentune.js` como `hw1…hw50`.
  - Tiene su propio progreso (`save.hw.unlocked`) y no toca el del juego normal.
- **Paisaje de Halloween** (`src/halloween.js`):
  - Castillo, islotes con tumbas, árboles muertos, calabazas iluminadas, niebla morada y plataforma con farolillos de calabaza.
  - Relámpagos cada 5 s, con destello y trueno.
  - El pájaro es una **bruja en escoba** que se ríe y el velero es un **galeón pirata de velas negras**. Al darles se ganan 2 bolas, igual que siempre.
- **Bloques de caramelo 🍬** (`save.candy`):
  - Solo en los niveles del mundo de Halloween (no en los mundos normales): 4 bloques que dan la cara al cañón son de caramelo. Llevan rayas blancas en espiral sobre su color, así que no pierden su color, y un brillo.
  - **Caramelo envuelto:** lazos a los lados, da 1 caramelo.
  - **Bastón:** un bastón de caramelo colgado del borde, da 2.
  - Si el bloque revienta o cae, el caramelo vuela al contador de arriba.
  - La primera vez que aparecen, Cubi los señala y los explica.
  - Superar un nivel de Halloween da 3 caramelos más 2 por estrella; un jefe da 25.
- **Tienda de Halloween** (pestaña 🎃): se paga con caramelos.
  - Cañón Calabaza, cofre embrujado y avatares de Halloween para el perfil (vampiro, bruja, fantasma, calabaza, calavera y araña).
  - Bola dorada, 3 bombas, 2 arcoíris, 10 gemas y 500 monedas.
- **Pruebas:**
  - `python3 tools/hwflow.py`: portada, mapa, partida con caramelos, victoria y tienda.
  - `python3 tools/candyflow.py`: el consejo de los bloques de caramelo y el caramelo que vuela al contador.
  - `node tools/hwcheck.js`: comprueba que los 50 niveles se quedan quietos sin disparar.

## Tutorial con Cubi
**Cubi** es un bloque amarillo del juego de verdad: se dibuja una vez con el mismo 3D (forma, brillo y cara) mediante `RRGame.cubiFrames()`. Explica cada cosa con un bocadillo, da un botecito al hablar y parpadea. Lo que señala queda iluminado y lo demás oscurecido; una mano blanca indica dónde tocar (`src/tutorial.js`).

- **Primera vez** (10 pasos):
  1. Bienvenida.
  2. Recompensas: racha, pase y misiones.
  3. Amigos, tienda y ajustes.
  4. **¡A DEMOLER!** (hay que tocarlo).
  5. Ficha del nivel 1: **¡A DEMOLER!** (hay que tocarlo).
  6. **Apunta y dispara**: la mano dibuja el gesto y espera al primer disparo.
  7. El porcentaje de la barra.
  8. Al volver al mapa: nivel de jugador y misiones.
  9. Modos de juego (Mundos, Club y eventos).
  10. Tu camino.
- **Qué obliga a tocar:** solo lo que lleva a jugar. Lo demás se pasa tocando en cualquier sitio, y siempre se puede «Saltar tutorial».
- **Racha diaria:** no se abre sola mientras dura la primera parte.
- **Consejos de primera vez:** los bloques de caramelo (en la primera partida que los tenga), y la primera vez que abres la tienda, el pase, las misiones, los amigos, la racha diaria, el evento de Halloween o un jefe, Cubi da un consejo corto. Los bloques nuevos tienen su propia tarjeta y no salen aquí.
- **Jugadores de antes:** quien ya había jugado no lo ve. En Ajustes está **«Ver el tutorial otra vez»**.
- **Pruebas:** las pruebas automáticas no lo ven (navegador automatizado). `python3 tools/tutflow.py` lo recorre entero, también en inglés.

## Panel de administración y configuración en directo

Web del juego y panel en **https://rocket-rush-7297c.web.app** (Firebase Hosting; carpeta `site/`, se publica sola con
`.github/workflows/web.yml`). El panel está en **/admin** y se puede instalar en el móvil como app (menú del navegador ›
*Añadir a pantalla de inicio*).

Qué se cambia desde el panel sin publicar versión (todo va en el documento `config/live` de Firestore, que el juego lee
al arrancar con `src/live.js` y guarda en el móvil por si no hay conexión):

- **Eventos:** fechas de Halloween (encender, apagar, alargar) y bonificaciones temporales x2/x3 de monedas, experiencia
  o caramelos, con cartel y cuenta atrás en la portada.
- **Avisos:** regalos para todos (ventana con «Recoger», una vez por jugador) y noticias (una vez), con traducciones opcionales.
- **Códigos regalo** (`giftcodes/{CÓDIGO}`): se canjean en Ajustes › Canjear código; con usos máximos y fechas.
- **Jugadores:** buscar por código de amigo o nombre, cambiar nombre, poner a cero, bloquear (sale de las clasificaciones
  y ya no puede subir su perfil) y borrar.
- **Ajustes:** frecuencia de los anuncios entre niveles, mantenimiento (pausa amigos y clasificaciones) y versión mínima
  (aviso «Hay una versión nueva», opcionalmente obligatorio). Cada guardado deja copia en `config/prev` (Deshacer).

Puesta en marcha (una vez):
1. Google Cloud › IAM: añadir a la cuenta de servicio el rol **Administrador de Firebase Hosting**.
2. Firebase › Authentication › Método de acceso: activar **Correo electrónico/contraseña**; en *Usuarios* › *Agregar usuario*,
   crear tu cuenta del panel (la contraseña solo la sabes tú).
3. GitHub › Actions › **Administradores del panel** › *Run workflow* con ese correo.
4. Entrar en https://rocket-rush-7297c.web.app/admin.

Pruebas: `tools/liveflow.py` (el juego con la configuración en directo), `tools/adminflow.py` (el panel contra un
Firebase simulado) y, en GitHub, `tools/firebase_live.mjs` prueba las reglas del panel con un administrador de prueba.

## Evento de Navidad (del 1 de diciembre al 6 de enero a las 23:59, se cambia desde el panel)

- **Mundo de 50 niveles** (ids 30001-30050, `Levels.XM`) en 5 zonas: Plaza del pueblo, Mercadillo navideño, Bosque de los
  abetos, Lago helado y Taller de Papá Noel. Afinados con `EV=xm node tools/hwtune.js` (gid `xm1…xm50` en `src/gentune.js`)
  y comprobados con `EV=xm node tools/hwcheck.js`.
- **Paisaje** (`src/christmas.js`): pueblo nevado de noche con árbol gigante, casas con luces en la ladera, torre del reloj,
  luna y nieve cayendo; plataforma de hielo con borde y postes de bastón de caramelo.
- **Trineo de Papá Noel con 4 renos** en lugar del pájaro (y cruzando la portada con cascabeles). Música navideña propia.
- **Regalos**: algunos bloques se envuelven (papel de su color con copos y lazo blanco). El del bastón da 2 caramelos
  navideños y el del caramelo de menta, 1. En los jefes se envuelven todos los bloques de colores.
- **Jefes** (mismo combate, aspecto navideño): Cascanueces Mayor (gólem), Caja Sorpresa (faraón: payaso de muelle que sale
  de un regalo gigante), Capitán Escarcha (barco rompehielos), General Cascanueces y Gran Caja Sorpresa.
- **Mapa calendario de Adviento**: cada zona es una casa nevada con ventanas numeradas y la puerta del jefe; calles con
  farolas, abetos y muñecos de nieve entre las casas; luna, trineo, nieve y pueblo al fondo.
- **Icono**: árbol de Navidad con cuenta atrás en la portada y botón «Navidad» en el mapa. Moneda: bastones (caramelos navideños).
- **Tienda de Navidad**: Cañón Bastón, regalo sorpresa, avatares de Navidad, bola dorada, bombas, arcoíris, gemas y monedas.
- **Panel**: tarjeta «🎄 Navidad» en Eventos (encender, «Empezar ya», +7 días, fechas originales).
- Prueba: `tools/xmflow.py`.

## Clubes (diseño A: cabecera con pestañas Club · Expedición · Jefe · Liga)

- **Pantalla** (`src/club.js`, botón «Club» del mapa). Sin club: pestañas **Buscar** (clubes abiertos o por nombre) y
  **Crear** (nombre único, descripción, escudo con 12 iconos y 12 colores, abierto o con solicitud; cuesta 500 monedas).
- **Club**: resumen de la semana, miembros (hasta 30) con su aportación, solicitudes (líder y oficiales aceptan o rechazan),
  nombrar o quitar oficiales, expulsar, ceder el liderazgo, ajustes, invitar amigos y salir (si sale el líder, el
  liderazgo pasa solo al oficial que más ha aportado; si es el último, el club se borra).
- **Expedición semanal**: 50 niveles, 10 nuevos cada día de lunes a viernes (se juegan en orden dentro del día y hasta el
  domingo). Las estrellas de todos llenan el cofre del club (madera, oro o cristal según 40 estrellas por miembro) y cada
  estrella propia vale 15 monedas.
- **Jefe colosal**: toda la semana, 3 ataques al día por miembro (el ataque se gasta al empezar). Vida: 60.000 por miembro.
  Cada ataque quita hasta 8.000 según la vida que le quites, más 4.000-7.000 si lo derribas.
- **Liga del fin de semana** (de viernes a lunes): 10 niveles difíciles; gana el club con más estrellas entre todos.
  Premios: 1.º cofre de cristal, 2.º y 3.º de oro, el resto de madera (si has jugado).
- **Premios**: se recogen al abrir el club la semana siguiente (tarjeta «Premios de la semana pasada»).
- **Reloj**: la semana empieza el lunes a las 00:00 en hora de España de invierno (UTC+1) para todos.
- **Niveles** (`Levels.club(tipo, semana)` en `src/levels3d.js`): sacados de los del juego (ya afinados) con una semilla por
  semana; expedición ids 40001-40050 (cada día un poco más difícil), liga 41001-41010, jefe 42001.
- **Servidor** (`Social.club` en `src/social.js`, reglas en `firebase/firestore.rules`): `clubs/{id}`, `clubs/{id}/members/{uid}`,
  `clubs/{id}/requests/{uid}` y `clubnames/{nombre}`. Entrar, salir y expulsar van en un lote que cambia a la vez la ficha
  y el contador (las reglas no dejan pasar de 30 ni inventar miembros). Probado contra el Firebase real en
  `tools/firebase_live.mjs`; la pantalla, con un Firestore de mentira en `tools/clubflow.py` (`tools/fakefs.py`).

## Preparación para Google Play

- **Android 16 (API 36)**, AGP 8.11 y Gradle 8.13: `MainActivity` con borde a borde, barras ocultas, márgenes de la muesca
  al juego (`--sat/--sar/--sab/--sal`) y gesto atrás predictivo.
- **Compras** (`Billing.java`, Play Billing 8): precios de Play en la moneda del jugador, entrega, confirmación o consumo y
  restaurar (quitar anuncios y pack de inicio). Productos: g1, g2, g3, c1, c2, starter (una vez) y noads (una vez).
- **Anuncios** (`Ads.java`): AdMob con el formulario de consentimiento de Google (UMP). Con premio e intersticial reales;
  sin personalizar a menores de 16 y para todos los públicos a menores de 13. Los identificadores reales van en
  GitHub › Settings › Secrets and variables › Actions › **Variables**: `ADMOB_APP_ID`, `ADMOB_REWARDED`, `ADMOB_INTERSTITIAL`
  (sin ellos se usan los de prueba de Google).
- **Edad**: la primera vez se pregunta el año de nacimiento (solo se guarda en el móvil). Menores de 13: sin funciones en línea.
- **Ajustes › Privacidad y ayuda**: política, términos, opciones de privacidad de anuncios, funciones en línea sí/no,
  borrar la cuenta en línea (perfil, código, amistades, club y cuenta de Firebase), soporte por correo y créditos.
  En Ajustes también: menos destellos y gráficos en ahorro.
- **Web**: `/privacidad`, `/terminos` y `/borrar-cuenta` (y `/en/…`), generadas con `python3 tools/legal_pages.py`.
- **Paquete para Play**: Actions › «Crear clave de subida» (una vez; necesita los secretos `GH_ADMIN_TOKEN` y
  `KEY_BACKUP_PASS`) y después Actions › «Versión para Google Play (AAB)», que deja el `.aab` firmado sin modo prueba.
- Prueba: `tools/storeflow.py`.

## Bienvenida y nombre

- La primera vez (después del idioma y la edad) sale **¡BIENVENIDO!**: elegir el nombre (único, se comprueba al escribir;
  gratis) y guardar el progreso con Google (Facebook marcado «pronto»). «Ahora no» la cierra. Menores de 13: no sale.
- Después, cambiar el nombre en el perfil cuesta **50 gemas** (cambiar solo mayúsculas es gratis).
- Crear un club cuesta **5.000 monedas y 50 gemas**.
- Prueba: `tools/welcomeflow.py`.

## Entrar con Google y copia del progreso en la nube

- Ajustes: botón **G** a la izquierda de los de sonido (con ✓ cuando hay sesión) y **f** de Facebook a la derecha (de
  momento avisa de que llega pronto: hace falta el ID de la app de Facebook).
- Android: `GoogleLogin.java` (Credential Manager, «Sign in with Google») con el ID de cliente web de Firebase; el juego
  recibe el `idToken` en `window.onGoogleSignIn` y `social.js` entra en Firebase con `accounts:signInWithIdp`.
- Si la cuenta de Google es nueva, se **enlaza** la anónima (mismo uid: amigos, club y nombre siguen). Si ya tenía
  progreso de otro móvil, se entra en ella, se borra la anónima de este móvil y se pregunta con qué progreso quedarse.
- Copia: `saves/{uid}` (el progreso entero en JSON, ≤ 900 KB), al minuto de cada cambio, al salir del juego y con
  «Guardar ahora». «Recuperar de la nube» y «Cerrar sesión» en la misma ventana. Borrar la cuenta borra también la copia.
- Reglas: solo el dueño la lee y solo la sube una sesión de Google (`sign_in_provider == google.com`).
- Para que funcione en el móvil, en Firebase › app Android tienen que estar las huellas SHA-1 (tabla de abajo).
- Prueba: `tools/googleflow.py`.

## Huellas de las claves (públicas: van en Firebase › app Android › huellas digitales)

| Clave | SHA-1 |
| --- | --- |
| Subida a Google Play (secreto UPLOAD_KEYSTORE_B64) | FA:76:7E:8B:47:54:15:F7:1C:7F:0D:9A:5D:DC:92:E5:B0:73:51:07 |
| APK de prueba (`android/app/rocketrush-test.jks`) | FA:9B:81:10:3F:2E:62:AA:6A:2E:E4:26:DA:C5:B2:C5:3E:2C:DA:3C |
| Firma de Google Play | (se ve en Play Console › Integridad de la aplicación al subir el primer paquete) |

