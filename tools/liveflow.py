# Configuración en directo (panel de administración) en el juego, con Firebase simulado:
# bonificación x2 en la portada y en el premio, regalo para todos, noticia, Halloween apagado/encendido por fechas,
# versión mínima, mantenimiento y canje de un código regalo (con límite de usos).
import json, time
from playwright.sync_api import sync_playwright
OUT = '/home/claude/chroma3d/dist/shots/'
NOW = int(time.time() * 1000)
CODES = {'ROCKET2026': {'coins': 500, 'gems': 5, 'max': 2, 'used': 0}, 'VIEJO': {'coins': 1, 'end': NOW - 1000, 'used': 0}}
def fs_val(v):
    return {'integerValue': str(v)} if isinstance(v, int) else {'stringValue': str(v)}
def handle(route):
    req = route.request; url = req.url
    if 'accounts:signUp' in url:
        return route.fulfill(json={'localId': 'u1', 'idToken': 't', 'refreshToken': 'r', 'expiresIn': '3600'})
    if '/giftcodes/' in url:
        code = url.split('/giftcodes/')[1].split('?')[0]
        d = CODES.get(code)
        if not d: return route.fulfill(status=404, json={'error': {'status': 'NOT_FOUND', 'message': 'no'}})
        if req.method == 'PATCH':
            d['used'] = int(json.loads(req.post_data)['fields']['used']['integerValue'])
        return route.fulfill(json={'name': 'x/giftcodes/' + code, 'updateTime': '2026-10-27T00:00:00Z', 'fields': {k: fs_val(v) for k, v in d.items()}})
    return route.abort()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True).new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script("window.RR_LIVE_OFF = true; localStorage.setItem('rocketrush.lang','es')")
    pg.route('**/*googleapis.com/**', handle)
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2500)
    pg.evaluate("() => { document.getElementById('daily').classList.remove('on'); }")
    # 1) bonificación x2 monedas + regalo + noticia
    cfg = {'boosts': [{'id': 'b1', 'kind': 'coins', 'mult': 2, 'start': NOW - 1000, 'end': NOW + 2 * 86400000 + 3600000}],
           'gifts': [{'id': 'g1', 'title': 'Regalo de bienvenida', 'body': 'Gracias por jugar', 'coins': 200, 'gems': 3, 'start': NOW - 1000, 'end': NOW + 86400000}],
           'news': [{'id': 'n1', 'title': 'Llega la Navidad', 'body': 'Nuevo mundo el 1 de diciembre', 'tr': {'en': {'title': 'Christmas is coming', 'body': 'New world on December 1st'}}}]}
    pg.evaluate("c => Live.set(c)", cfg); pg.wait_for_timeout(900)
    print('cartel:', pg.evaluate("() => [!document.getElementById('liveBoost').hidden, document.getElementById('liveBoost').textContent]"))
    print('ventana 1:', pg.evaluate("() => [document.getElementById('liveBox').classList.contains('on'), document.getElementById('lbRib').textContent, document.getElementById('lbTitle').textContent, document.getElementById('lbExtra').textContent]"))
    pg.screenshot(path=OUT + 'live_gift.png')
    c0 = pg.evaluate("() => [RRGame.save.coins, RRGame.save.gems]")
    pg.click('#lbBtns .btn'); pg.wait_for_timeout(1200)
    print('monedas/gemas:', c0, '->', pg.evaluate("() => [RRGame.save.coins, RRGame.save.gems]"))
    print('ventana 2:', pg.evaluate("() => [document.getElementById('liveBox').classList.contains('on'), document.getElementById('lbRib').textContent, document.getElementById('lbTitle').textContent]"))
    pg.screenshot(path=OUT + 'live_news.png')
    pg.click('#lbBtns .btn'); pg.wait_for_timeout(1200)
    print('no se repiten:', not pg.evaluate("() => document.getElementById('liveBox').classList.contains('on')"))
    pg.screenshot(path=OUT + 'live_title.png')
    # 2) premio de un nivel con x2
    w = pg.evaluate("""() => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(3, []);
        const G = ChromaGame.G; G.sim.stars = () => 3; G.sim.coins = 0; const c = RRGame.save.coins; ChromaGame.finishWin ? ChromaGame.finishWin() : null; return [c, document.getElementById('winCoins').textContent]; }""")
    print('premio con x2:', w)
    # 3) Halloween apagado desde el panel y luego encendido hasta otra fecha
    pg.evaluate("() => { RRGame.save.hwForce = false; RRGame.goTitle(); }")
    pg.evaluate("c => Live.set(c)", {'hw': {'on': False}}); pg.wait_for_timeout(500)
    a = pg.evaluate("() => [RRGame.hw.active(), document.getElementById('hwPump').hidden]")
    pg.evaluate("c => Live.set(c)", {'hw': {'on': True, 'start': NOW - 1000, 'end': NOW + 5 * 86400000}}); pg.wait_for_timeout(500)
    print('Halloween apagado:', a, '· encendido hasta dentro de 5 días:', pg.evaluate("() => [RRGame.hw.active(), document.querySelector('.hwcdTxt').textContent]"))
    # 4) versión mínima (obligatoria) y mantenimiento
    pg.evaluate("() => { RRGame.goTitle(); }")
    pg.evaluate("c => Live.set(c)", {'update': {'min': 999999, 'force': True}, 'maint': {'on': True, 'msg': 'Volvemos a las 18:00'}}); pg.wait_for_timeout(900)
    print('compilación, aviso y texto (sin número no pide actualizar; con 1.0.60 sí, obligatorio) ->', pg.evaluate("() => [RRGame.live.build, document.getElementById('lbRib').textContent, document.getElementById('lbBody').textContent]"))
    pg.screenshot(path=OUT + 'live_maint.png')
    pg.click('#lbBtns .btn'); pg.wait_for_timeout(300)
    # 5) código regalo
    pg.evaluate("c => Live.set(c)", {}); pg.wait_for_timeout(300)
    pg.evaluate("() => { document.getElementById('liveBox').classList.remove('on'); RRGame.show('settings'); }")
    pg.click('#sCode'); pg.wait_for_timeout(300)
    def redeem(code):
        pg.fill('#lbCode', code); pg.click('#lbBtns .btn'); pg.wait_for_function("() => !/Comprobando/.test(document.getElementById('lbMsg').textContent)", timeout=8000)
        return pg.evaluate("() => document.getElementById('lbMsg').textContent")
    c0 = pg.evaluate("() => RRGame.save.coins")
    print('ROCKET2026:', redeem('rocket-2026'), '· monedas', c0, '->', pg.evaluate("() => RRGame.save.coins"), '· usos', CODES['ROCKET2026']['used'])
    pg.screenshot(path=OUT + 'live_code.png')
    pg.evaluate("() => { document.getElementById('lbCode').disabled = false; }")
    print('otra vez:', redeem('ROCKET2026'))
    print('caducado:', redeem('VIEJO'), '· inexistente:', redeem('NOEXISTE'))
    pg.evaluate("() => { RRGame.save.codesUsed = {}; }"); CODES['ROCKET2026']['used'] = 2
    print('agotado:', redeem('ROCKET2026'))
    # 6) en inglés, la noticia sale traducida
    pg.evaluate("() => { I18N.set('en'); RRGame.save.liveGot = {}; document.getElementById('liveBox').classList.remove('on'); RRGame.goTitle(); }")
    pg.evaluate("c => Live.set(c)", {'news': cfg['news']}); pg.wait_for_timeout(900)
    print('inglés:', pg.evaluate("() => [document.getElementById('lbRib').textContent, document.getElementById('lbTitle').textContent, document.querySelector('#lbBtns .btn').textContent]"))
    print('errores', errs[:5]); b.close()
