# Rocket Rush para iPhone y iPad

La app de Apple usa **el mismo juego** que la de Android (`dist/index.html`). Solo cambia la "carcasa":

| | Android | iPhone / iPad |
| --- | --- | --- |
| Carpeta | `android/` | `ios/` |
| Compilación en GitHub | `apk.yml` (cada cambio) | `ios.yml` (al cambiar `ios/` o a mano) |
| Puente con el juego | `MainActivity.java` | `GameViewController.swift` (mismos nombres: `window.ChromaAndroid`) |

Cualquier cambio en `src/` (niveles, tienda, cañones…) llega a las dos apps. Tocar `ios/` no cambia nada de Android.

## Ya funciona (fase 1, sin cuenta de Apple)
- Juego completo sin conexión, guardado, idiomas, sonido, clubes y amigos (Firebase).
- Vibración (respuesta háptica), aviso de la racha diaria, compartir, abrir enlaces.
- iPhone y iPad en vertical, con los márgenes de la muesca y la isla dinámica.
- GitHub lo compila en un Mac virtual, lo abre en un iPhone y un iPad simulados y guarda capturas.

## Falta (fase 2, necesita la cuenta de desarrollador de Apple)
- Subir a **TestFlight** (para instalarlo en tu iPhone/iPad y en los de los probadores) y al **App Store**.
- **Compras con Apple** (StoreKit): Apple no deja usar Google Play ni otro sistema de pago.
- **Anuncios** AdMob para iOS con el permiso de seguimiento (ATT).
- **Iniciar sesión con Apple** + Google: si la app ofrece Google, Apple exige también su botón.

## Lo que tienes que hacer tú
1. Darte de alta en el **Apple Developer Program** (99 $/año): https://developer.apple.com/programs/enroll/
   Se hace con tu Apple ID (con verificación en dos pasos) desde la web o la app «Apple Developer».
2. Cuando esté aprobado, en **App Store Connect › Usuarios y acceso › Integraciones › Claves de la API**
   crea una clave con rol **App Manager** y descarga el archivo `.p8` (solo se puede descargar una vez).
3. Guarda en GitHub (Settings › Secrets and variables › Actions) estos secretos. **No me los pegues en el chat**:
   - `ASC_KEY_ID` (el ID de la clave)
   - `ASC_ISSUER_ID` (el ID del emisor, sale arriba en esa misma página)
   - `ASC_KEY_P8` (el contenido del archivo `.p8`)
   - `APPLE_TEAM_ID` (Membership › Team ID; este no es secreto, me lo puedes decir)
4. Avísame y preparo la subida automática a TestFlight. No hace falta un Mac.
