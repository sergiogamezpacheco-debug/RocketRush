# Genera las páginas legales de la web (site/*.html y site/en/*.html): privacidad, términos y borrar la cuenta.
# Se publican con la web (tools/deploy_hosting.py): https://rocket-rush-7297c.web.app/privacidad, /terminos, /borrar-cuenta
# y en inglés en /en/…  Para cambiar un texto, edítalo aquí y vuelve a ejecutar: python3 tools/legal_pages.py
import os
ROOT = os.path.join(os.path.dirname(__file__), '..', 'site')
UPDATED = {'es': '31 de octubre de 2026', 'en': '31 October 2026'}
MAIL = 'rocketrush.lostanarchygames@hotmail.com'
OWNER = 'Sergio Gámez Pacheco'

def page(lang, slug, title, body):
    pre = '' if lang == 'es' else '/en'
    labels = {'es': [('privacidad', 'Privacidad'), ('terminos', 'Términos'), ('borrar-cuenta', 'Borrar cuenta')],
              'en': [('privacidad', 'Privacy'), ('terminos', 'Terms'), ('borrar-cuenta', 'Delete account')]}[lang]
    nav = ''.join(f'<a href="{pre}/{s}"{" class=on" if s == slug else ""}>{t}</a>' for s, t in labels)
    other = ('/en/' if lang == 'es' else '/') + slug
    nav += f'<a href="{other}" hreflang="{"en" if lang == "es" else "es"}">{"English" if lang == "es" else "Español"}</a>'
    upd = ('Última actualización: ' if lang == 'es' else 'Last updated: ') + UPDATED[lang]
    foot = {'es': f'Rocket Rush · Lost Anarchy Games · Contacto: <a href="mailto:{MAIL}">{MAIL}</a>',
            'en': f'Rocket Rush · Lost Anarchy Games · Contact: <a href="mailto:{MAIL}">{MAIL}</a>'}[lang]
    html = f'''<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} · Rocket Rush</title>
<link rel="icon" href="/favicon.png">
<link rel="stylesheet" href="/legal.css">
<link rel="alternate" hreflang="es" href="https://rocket-rush-7297c.web.app/{slug}">
<link rel="alternate" hreflang="en" href="https://rocket-rush-7297c.web.app/en/{slug}">
</head>
<body>
<main>
<header><img src="/admin/icon-192.png" alt=""><a href="{pre or '/'}">ROCKET RUSH</a></header>
<nav>{nav}</nav>
<h1>{title}</h1>
<p class="upd">{upd}</p>
{body}
<footer>{foot}</footer>
</main>
</body>
</html>
'''
    path = os.path.join(ROOT, *( [slug + '.html'] if lang == 'es' else ['en', slug + '.html'] ))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8').write(html)
    print('ok', path)

# ------------------------------------------------------------------ ESPAÑOL
page('es', 'privacidad', 'Política de privacidad', f'''
<div class="box"><p><strong>En resumen:</strong> puedes jugar sin dar ningún dato. Tu progreso se guarda solo en tu móvil.
Si usas las funciones en línea (amigos y clasificaciones) se crea una cuenta anónima con tu apodo y tus estadísticas.
Los anuncios los sirve Google AdMob y solo son personalizados si das tu consentimiento. Nunca vendemos tus datos.
Puedes borrar tu cuenta en línea desde el juego en cualquier momento.</p></div>

<h2>1. Responsable</h2>
<p><strong>{OWNER}</strong> (Lost Anarchy Games), España. Correo: <a href="mailto:{MAIL}">{MAIL}</a>.</p>

<h2>2. Qué datos tratamos y para qué</h2>
<div class="wrap"><table>
<tr><th>Datos</th><th>Para qué</th><th>Base legal</th><th>Cuánto tiempo</th></tr>
<tr><td>Progreso, monedas, ajustes y año de nacimiento</td><td>Guardar tu partida. Se quedan en tu móvil, no nos llegan.</td><td>—</td><td>Hasta que borres el progreso o desinstales el juego</td></tr>
<tr><td>Identificador anónimo de cuenta, apodo, avatar, país (si lo eliges), idioma, código de amigo, estadísticas de juego y lista de amigos</td><td>Funciones en línea: amigos y clasificaciones. Tu apodo, avatar, país y estadísticas los ven otros jugadores.</td><td>Ejecución del servicio que pides (art. 6.1.b RGPD)</td><td>Hasta que borres tu cuenta en línea</td></tr>
<tr><td>Identificador de publicidad del dispositivo, dirección IP, datos técnicos del móvil e interacción con los anuncios</td><td>Mostrar anuncios con Google AdMob, medirlos y evitar el fraude</td><td>Consentimiento (art. 6.1.a) para anuncios personalizados; interés legítimo (art. 6.1.f) para anuncios no personalizados y prevención del fraude</td><td>Según la política de Google</td></tr>
<tr><td>Denuncias que hagas o recibas (identificadores anónimos, nombre denunciado y motivo)</td><td>Moderar nombres y clubes y evitar trampas</td><td>Interés legítimo (art. 6.1.f) en mantener un juego seguro</td><td>Hasta resolver la denuncia</td></tr>
<tr><td>Comprobante de compra de Google Play (identificador del producto y del pedido)</td><td>Entregarte lo que compras y restaurar compras</td><td>Ejecución del contrato (art. 6.1.b)</td><td>Lo que exija la ley fiscal y de consumo</td></tr>
<tr><td>Tu correo y lo que nos escribas</td><td>Responder a tus consultas de soporte</td><td>Interés legítimo (art. 6.1.f)</td><td>Hasta resolver la consulta y, como mucho, 2 años</td></tr>
</table></div>
<p>La configuración de eventos y los códigos regalo se descargan sin cuenta y no contienen datos personales. Los avisos de la racha diaria se programan en tu propio móvil.
No pedimos tu nombre real, ni tu correo, ni tu ubicación precisa, ni accedemos a tus contactos, fotos o micrófono.</p>

<h2>3. Pagos</h2>
<p>Las compras las procesa Google Play. Nunca vemos ni guardamos los datos de tu tarjeta ni de tu método de pago.</p>

<h2>4. Anuncios y consentimiento</h2>
<p>En el Espacio Económico Europeo, Reino Unido y Suiza, la primera vez te mostramos el formulario de consentimiento de Google. Puedes cambiar tu elección cuando quieras en
<strong>Ajustes › Privacidad y ayuda › Opciones de privacidad de anuncios</strong>. Si tienes menos de 16 años no se muestran anuncios personalizados.
Si eliges «Quitar anuncios» no verás anuncios entre niveles; los anuncios con premio son siempre opcionales.
Más información: <a href="https://policies.google.com/technologies/partner-sites">cómo usa Google los datos de las apps que usan sus servicios</a>.</p>

<h2>5. Menores</h2>
<p>El juego está pensado para mayores de 13 años. La primera vez preguntamos el año de nacimiento (se guarda solo en el móvil).
A quien indique menos de 13 años no se le crea cuenta en línea, no puede usar amigos ni clasificaciones y solo ve anuncios aptos para todos los públicos, sin personalizar.
Si eres padre, madre o tutor y crees que un menor nos ha dado datos, escríbenos y los borraremos.</p>

<h2>6. Con quién se comparten</h2>
<p>Solo con los proveedores que necesitamos para que el juego funcione, que actúan como encargados del tratamiento o como responsables independientes:</p>
<ul>
<li><strong>Google Firebase</strong> (Google Ireland Ltd.): cuenta anónima, base de datos y web.</li>
<li><strong>Google AdMob</strong> (Google Ireland Ltd.): anuncios.</li>
<li><strong>Google Play</strong>: descarga, pagos y actualizaciones.</li>
</ul>
<p>Google puede tratar datos fuera del Espacio Económico Europeo con las garantías del Marco de Privacidad de Datos UE-EE. UU. y las cláusulas contractuales tipo de la Comisión Europea.
No vendemos ni cedemos tus datos a nadie más, salvo obligación legal.</p>

<h2>7. Tus derechos</h2>
<p>Puedes pedir el acceso, la rectificación, la supresión, la limitación, la portabilidad u oponerte al tratamiento, y retirar tu consentimiento en cualquier momento, escribiendo a
<a href="mailto:{MAIL}">{MAIL}</a> con tu código de jugador (lo ves en Ajustes › Privacidad y ayuda). Puedes cambiar tu apodo y avatar desde el juego y
<a href="/borrar-cuenta">borrar tu cuenta en línea</a> tú mismo. Si crees que no hemos atendido bien tu petición, puedes reclamar ante la
<a href="https://www.aepd.es">Agencia Española de Protección de Datos</a>.</p>

<h2>8. Seguridad</h2>
<p>Las comunicaciones van cifradas (HTTPS). Las reglas de la base de datos solo permiten a cada jugador cambiar su propio perfil.</p>

<h2>9. Cambios</h2>
<p>Si cambiamos esta política, actualizaremos la fecha de arriba y, si el cambio es importante, te avisaremos dentro del juego.</p>
''')

page('es', 'terminos', 'Términos de uso', f'''
<h2>1. Quiénes somos</h2>
<p>Rocket Rush es un juego de <strong>{OWNER}</strong> (Lost Anarchy Games), España. Contacto: <a href="mailto:{MAIL}">{MAIL}</a>. Al jugar aceptas estos términos y la <a href="/privacidad">política de privacidad</a>.</p>

<h2>2. Licencia</h2>
<p>Te damos una licencia personal, gratuita, no exclusiva e intransferible para usar el juego en tus dispositivos con fines no comerciales. El juego, sus gráficos, música y textos son nuestros o de sus autores (ver «Créditos y licencias» en el juego).</p>

<h2>3. Monedas, gemas y objetos del juego</h2>
<p>Las monedas, gemas, bolas, cofres, cañones y demás objetos virtuales son parte del juego: no son dinero, no tienen valor fuera de él, no se pueden cambiar por dinero ni transferir a otras personas. Algunos cofres dan premios al azar; en el juego se indican las probabilidades.</p>

<h2>4. Compras</h2>
<p>Las compras se hacen con Google Play y se rigen también por sus condiciones. Los objetos se entregan al momento. Al tratarse de contenido digital que se entrega inmediatamente con tu consentimiento, una vez entregado no se aplica el derecho de desistimiento de 14 días, sin perjuicio de tus demás derechos como consumidor y de la <a href="https://support.google.com/googleplay/answer/2479637">política de reembolsos de Google Play</a>. Si una compra no te llega, escríbenos.</p>

<h2>5. Normas de convivencia</h2>
<p>No uses apodos ofensivos, que suplanten a otra persona o que incluyan datos personales. No hagas trampas, no modifiques el juego ni ataques sus servidores. Puedes <strong>denunciar o bloquear</strong> a cualquier jugador o club tocando su nombre (en las clasificaciones, en tus amigos o en los clubes); revisamos cada denuncia y podemos cambiar apodos o nombres de club inadecuados y suspender las funciones en línea de quien incumpla estas normas.</p>

<h2>6. Disponibilidad y cambios</h2>
<p>Podemos actualizar el juego, cambiar eventos, equilibrar niveles y premios, o retirar funciones. Las funciones en línea pueden no estar disponibles en algunos momentos (por ejemplo, por mantenimiento).</p>

<h2>7. Responsabilidad</h2>
<p>Hacemos lo posible para que el juego funcione bien, pero se ofrece «tal cual». En la medida en que la ley lo permita, no respondemos de daños indirectos ni de la pérdida del progreso guardado en tu móvil (por ejemplo, al desinstalar o borrar datos). Nada de esto limita los derechos que la ley te reconoce como consumidor.</p>

<h2>8. Ley aplicable</h2>
<p>Estos términos se rigen por la ley española. Si eres consumidor, puedes acudir a los tribunales de tu domicilio. Si cambiamos estos términos, te avisaremos dentro del juego.</p>
''')

page('es', 'borrar-cuenta', 'Borrar tu cuenta y tus datos', f'''
<p>Rocket Rush no necesita registro. Solo existe una cuenta en línea (anónima) si has usado amigos o clasificaciones. Puedes borrarla así:</p>
<h2>Desde el juego (inmediato)</h2>
<ol>
<li>Abre <strong>Ajustes</strong> (rueda dentada en la portada).</li>
<li>Toca <strong>Privacidad y ayuda</strong>.</li>
<li>Toca <strong>Borrar mi cuenta en línea</strong> y otra vez para confirmar.</li>
</ol>
<h2>Sin el juego (por correo)</h2>
<p>Escribe a <a href="mailto:{MAIL}?subject=Borrar%20mi%20cuenta%20de%20Rocket%20Rush">{MAIL}</a> con el asunto «Borrar mi cuenta» e indica tu <strong>código de jugador</strong> (RR-…) o tu apodo y país. La borraremos en un plazo máximo de 30 días y te lo confirmaremos.</p>
<h2>Qué se borra</h2>
<ul>
<li>Tu perfil público: apodo, avatar, país, idioma y estadísticas (sales de las clasificaciones).</li>
<li>Tu código de amigo, tus amistades y las solicitudes pendientes.</li>
<li>Tu cuenta anónima de Firebase.</li>
</ul>
<p>No guardamos copias de esos datos después del borrado. Los comprobantes de compra los conserva Google Play según sus condiciones y la ley.</p>
<h2>Tu progreso del juego</h2>
<p>El progreso (niveles, monedas, objetos) está guardado solo en tu móvil. Puedes borrarlo en <strong>Ajustes › Borrar progreso</strong> o desinstalando el juego.</p>
''')

# ------------------------------------------------------------------ ENGLISH
page('en', 'privacidad', 'Privacy policy', f'''
<div class="box"><p><strong>In short:</strong> you can play without giving us any data. Your progress is stored only on your phone.
If you use the online features (friends and leaderboards), an anonymous account is created with your nickname and your stats.
Ads are served by Google AdMob and are personalised only if you consent. We never sell your data.
You can delete your online account from the game at any time.</p></div>

<h2>1. Controller</h2>
<p><strong>{OWNER}</strong> (Lost Anarchy Games), Spain. Email: <a href="mailto:{MAIL}">{MAIL}</a>.</p>

<h2>2. What data we process and why</h2>
<div class="wrap"><table>
<tr><th>Data</th><th>Purpose</th><th>Legal basis</th><th>Retention</th></tr>
<tr><td>Progress, coins, settings and year of birth</td><td>Saving your game. It stays on your phone and never reaches us.</td><td>—</td><td>Until you delete your progress or uninstall</td></tr>
<tr><td>Anonymous account ID, nickname, avatar, country (if you choose one), language, friend code, game stats and friend list</td><td>Online features: friends and leaderboards. Other players can see your nickname, avatar, country and stats.</td><td>Performance of the service you request (Art. 6(1)(b) GDPR)</td><td>Until you delete your online account</td></tr>
<tr><td>Device advertising ID, IP address, technical device data and ad interactions</td><td>Showing ads with Google AdMob, measuring them and preventing fraud</td><td>Consent (Art. 6(1)(a)) for personalised ads; legitimate interest (Art. 6(1)(f)) for non-personalised ads and fraud prevention</td><td>As set out in Google's policy</td></tr>
<tr><td>Reports you make or receive (anonymous IDs, reported name and reason)</td><td>Moderating names and clubs and preventing cheating</td><td>Legitimate interest (Art. 6(1)(f)) in keeping the game safe</td><td>Until the report is resolved</td></tr>
<tr><td>Google Play purchase receipt (product and order ID)</td><td>Delivering and restoring your purchases</td><td>Performance of contract (Art. 6(1)(b))</td><td>As required by tax and consumer law</td></tr>
<tr><td>Your email address and your message</td><td>Answering support requests</td><td>Legitimate interest (Art. 6(1)(f))</td><td>Until resolved, and at most 2 years</td></tr>
</table></div>
<p>Event settings and gift codes are downloaded without an account and contain no personal data. Daily-streak reminders are scheduled on your own phone.
We do not ask for your real name, email or precise location, and we do not access your contacts, photos or microphone.</p>

<h2>3. Payments</h2>
<p>Purchases are processed by Google Play. We never see or store your card or payment details.</p>

<h2>4. Ads and consent</h2>
<p>In the European Economic Area, the UK and Switzerland we show Google's consent form the first time. You can change your choice at any time in
<strong>Settings › Privacy &amp; help › Ad privacy options</strong>. If you are under 16, no personalised ads are shown.
If you buy “Remove ads” you will not see ads between levels; rewarded ads are always optional.
More information: <a href="https://policies.google.com/technologies/partner-sites">how Google uses data from apps that use its services</a>.</p>

<h2>5. Children</h2>
<p>The game is intended for players aged 13 and over. The first time, we ask for your year of birth (stored only on the phone).
Players who indicate they are under 13 get no online account, cannot use friends or leaderboards, and only see non-personalised ads suitable for all ages.
If you are a parent or guardian and believe a child has given us data, contact us and we will delete it.</p>

<h2>6. Who we share data with</h2>
<p>Only with the providers we need to run the game, acting as processors or independent controllers:</p>
<ul>
<li><strong>Google Firebase</strong> (Google Ireland Ltd.): anonymous account, database and website.</li>
<li><strong>Google AdMob</strong> (Google Ireland Ltd.): ads.</li>
<li><strong>Google Play</strong>: downloads, payments and updates.</li>
</ul>
<p>Google may process data outside the EEA under the EU-US Data Privacy Framework and the European Commission's standard contractual clauses.
We do not sell or disclose your data to anyone else, unless required by law.</p>

<h2>7. Your rights</h2>
<p>You can request access, rectification, erasure, restriction, portability, object to processing, and withdraw consent at any time by emailing
<a href="mailto:{MAIL}">{MAIL}</a> with your player code (shown in Settings › Privacy &amp; help). You can change your nickname and avatar in the game and
<a href="/en/borrar-cuenta">delete your online account</a> yourself. You may also lodge a complaint with the
<a href="https://www.aepd.es">Spanish Data Protection Agency (AEPD)</a> or your local authority.</p>

<h2>8. Security</h2>
<p>All communication is encrypted (HTTPS). Database rules only allow each player to change their own profile.</p>

<h2>9. Changes</h2>
<p>If we change this policy we will update the date above and, for important changes, let you know in the game.</p>
''')

page('en', 'terminos', 'Terms of use', f'''
<h2>1. Who we are</h2>
<p>Rocket Rush is a game by <strong>{OWNER}</strong> (Lost Anarchy Games), Spain. Contact: <a href="mailto:{MAIL}">{MAIL}</a>. By playing you accept these terms and the <a href="/en/privacidad">privacy policy</a>.</p>

<h2>2. Licence</h2>
<p>We grant you a personal, free, non-exclusive, non-transferable licence to use the game on your devices for non-commercial purposes. The game, its graphics, music and texts belong to us or their authors (see “Credits &amp; licences” in the game).</p>

<h2>3. Coins, gems and in-game items</h2>
<p>Coins, gems, balls, chests, cannons and other virtual items are part of the game: they are not money, have no value outside the game, and cannot be exchanged for money or transferred to others. Some chests give random rewards; the odds are shown in the game.</p>

<h2>4. Purchases</h2>
<p>Purchases are made through Google Play and are also subject to its terms. Items are delivered immediately. Because this is digital content supplied immediately with your consent, the 14-day right of withdrawal no longer applies once delivered, without prejudice to your other consumer rights and the <a href="https://support.google.com/googleplay/answer/2479637">Google Play refund policy</a>. If a purchase does not arrive, contact us.</p>

<h2>5. Community rules</h2>
<p>Do not use offensive nicknames, impersonate others or include personal data in your nickname. Do not cheat, modify the game or attack its servers. You can <strong>report or block</strong> any player or club by tapping their name (in the leaderboards, your friends or the clubs); we review every report and may change inappropriate nicknames or club names and suspend online features for anyone breaking these rules.</p>

<h2>6. Availability and changes</h2>
<p>We may update the game, change events, rebalance levels and rewards, or remove features. Online features may be temporarily unavailable (for example, during maintenance).</p>

<h2>7. Liability</h2>
<p>We do our best to keep the game working well, but it is provided “as is”. To the extent permitted by law, we are not liable for indirect damages or for the loss of progress stored on your phone (for example, after uninstalling or clearing data). Nothing here limits your statutory rights as a consumer.</p>

<h2>8. Governing law</h2>
<p>These terms are governed by Spanish law. If you are a consumer, you may bring claims before the courts of your place of residence. If we change these terms, we will let you know in the game.</p>
''')

page('en', 'borrar-cuenta', 'Delete your account and data', f'''
<p>Rocket Rush does not require registration. An (anonymous) online account only exists if you have used friends or leaderboards. You can delete it like this:</p>
<h2>In the game (immediate)</h2>
<ol>
<li>Open <strong>Settings</strong> (gear icon on the title screen).</li>
<li>Tap <strong>Privacy &amp; help</strong>.</li>
<li>Tap <strong>Delete my online account</strong>, then tap again to confirm.</li>
</ol>
<h2>Without the game (by email)</h2>
<p>Email <a href="mailto:{MAIL}?subject=Delete%20my%20Rocket%20Rush%20account">{MAIL}</a> with the subject “Delete my account” and include your <strong>player code</strong> (RR-…) or your nickname and country. We will delete it within 30 days at most and confirm it to you.</p>
<h2>What is deleted</h2>
<ul>
<li>Your public profile: nickname, avatar, country, language and stats (you are removed from leaderboards).</li>
<li>Your friend code, your friendships and pending requests.</li>
<li>Your anonymous Firebase account.</li>
</ul>
<p>We keep no copies of this data after deletion. Purchase receipts are kept by Google Play under its terms and the law.</p>
<h2>Your game progress</h2>
<p>Progress (levels, coins, items) is stored only on your phone. You can erase it in <strong>Settings › Erase progress</strong> or by uninstalling the game.</p>
''')
