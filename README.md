# Rocket Rush

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

## Modo prueba (quitar al publicar)

En **Ajustes → Modo prueba: desbloquear todo** se abren los 1000 niveles y los 100 niveles extra para probar el juego. El mismo botón devuelve el progreso normal sin perder estrellas. Para publicar, compila con `node tools/build.js --release`: el modo prueba queda desactivado y el botón no aparece.

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
| Barco pirata | Capitán Bloquebarba (mundo 3) | Derribar el barco y su tesoro dorado. Cada 3 tiros (2 con menos de la mitad de vida) dispara un cañonazo que quita una bola. |
| Pirámide | Faraón Arenas (mundo 6) | Su vida está en la **máscara de oro** que flota sobre la pirámide. El escudo es de un color que cambia cada 2 tiros (siempre uno que queda en la pirámide; los ojos de la máscara y la barra avisan del siguiente). Rompiendo 4, 6 y 8 bloques de ese color (cuentan aunque caigan) el escudo cae durante 2 tiros y se puede golpear la máscara. 3 golpes y cae. Tras cada golpe la arena reconstruye parte de la pirámide y da +4 bolas; si se queda sin bloques, también se reconstruye, así que nunca se atasca. Prueba: `python3 tools/pharaohflow.py`. |
| Gólem | Gólem de hielo (mundo 9) | Camina sobre una losa. Hay que reventar sus 3 núcleos de lava antes de que cargue el golpe sísmico (quita una bola); cada acierto lo aturde. |
Barra de vida arriba, presentación al empezar, explosión final y **cofre de oro**. Contra un jefe no se regalan bombas ni arcoíris por combo. Estrellas: 3 si quedan 3 bolas o más, 2 si queda alguna, 1 si no.

**Bloques nuevos** (`src/sim3d.js`, 19 en total). Cada uno se estrena en un nivel fácil con la tarjeta «¡Bloque nuevo!» y un anillo que lo señala hasta el primer tiro; el nivel siguiente es de práctica, 3 niveles después se combina con lo anterior y luego aparece en los niveles generados (los que ayudan, en todos los paisajes; los obstáculos, en su paisaje y en los nuevos).
| Nivel | Bloque | Qué hace |
|---|---|---|
| 4 | Cohete | Barre su fila de punta a punta |
| 15 | Piñata | Con 2 golpes revienta y suelta monedas |
| 22 | Reloj de arena | +1 bola |
| 65 | Espejo | Rebota la bola; no se rompe |
| 84 | Muelle | Lanza por los aires lo que tiene encima |
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
4. Racha de victorias con llama en el botón de jugar: 2 victorias = bomba gratis, 3 o más = + arcoíris. Con 1 victoria o más, el **cohete de salida** (cruza la estructura y revienta la fila con más bloques) sale gratis en la ventana del nivel, junto a las demás ventajas, y solo se usa si lo eliges.
5. Recompensa variable: cofre de estrellas en lo alto del mapa (cada 30 ★) y caja misteriosa al superar por primera vez cada 5.º nivel (a veces con premio doble).

Pruebas: los tests de siempre (`tools/*flow.py`), ya adaptados a los números de nivel nuevos.

## Colores: solo revienta la bola de su color

Antes, una bola de otro color podía reventar un grupo entero: al empujar el bloque contra su vecino del mismo color saltaba la cascada (que es para los bloques que **caen** sobre los de su color). Pasaba en uno de cada cuatro niveles más o menos, también en los jefes (por ejemplo, Barcaza del río, 113).

Ahora cada bloque recuerda su altura de reposo y la cascada solo salta si uno de los dos ha caído al menos medio bloque. Los empujones no cuentan, y las cascadas de verdad siguen igual. Prueba: `node tools/wrongcolor.js 3` (bola de otro color contra el bloque más cercano en 1 de cada 3 niveles): antes 27 % de niveles con bloques reventados por error; ahora solo quedan los derrumbes reales.
