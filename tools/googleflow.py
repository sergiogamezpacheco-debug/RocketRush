# Entrar con Google y copia del progreso en la nube (puente de Android y Firebase de mentira):
#  1) móvil nuevo sin cuenta de Google previa → se enlaza la cuenta anónima (mismo uid) y se sube el progreso
#  2) cuenta de Google que ya tenía progreso → pregunta cuál quedarse; «el de la nube» reabre el juego con él
#  3) guardar ahora, cerrar sesión (Facebook quitado de momento: no hay botón)
import sys, json
sys.path.insert(0, '/home/claude/chroma3d/tools')
from fakefs import FakeFS
from playwright.sync_api import sync_playwright
OUT = '/home/claude/chroma3d/dist/shots/'
BRIDGE = "window.ChromaAndroid = { googleSignIn(id){ window.__gid = id; setTimeout(() => onGoogleSignIn({ ok: true, idToken: 'gtok', email: 'yo@gmail.com', name: 'Sergio' }), 50); }, googleSignOut(){ window.__gout = 1; }, vibrate(){}, scheduleReminder(){}, cancelReminder(){}, share(){} };"
def page(p, fs, save=None):
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1).new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    init = "window.RR_AGE = 30; window.RR_LIVE_OFF = true; localStorage.setItem('rocketrush.lang','es');" + BRIDGE
    if save: init += "if (!sessionStorage.s) { sessionStorage.s = 1; localStorage.setItem('chromacrash3d.v1', JSON.stringify(%s)); }" % json.dumps(save)
    pg.add_init_script(init)
    pg.route('**/*googleapis.com/**', fs.handle)
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2500)
    pg.evaluate("() => { ChromaGame.manual(true); document.getElementById('daily').classList.remove('on'); }")
    return b, pg, errs
def openacc(pg):
    pg.evaluate("() => { RRGame.goTitle(); document.getElementById('btnSetT').click(); }"); pg.wait_for_timeout(300)
    pg.click('#sGoogle'); pg.wait_for_timeout(300)
st = lambda pg: pg.evaluate("() => [document.getElementById('gaTitle').textContent, document.getElementById('gaText').textContent, [...document.querySelectorAll('#gaBtns button')].map(b => b.textContent)]")
with sync_playwright() as p:
    # 1) enlazar
    fs = FakeFS()
    b, pg, errs = page(p, fs, {'unlocked': 30, 'coins': 1234, 'birthYear': 1990})
    pg.evaluate("async () => { await Social.sync(); }"); pg.wait_for_timeout(500)
    pg.screenshot(path=OUT + 'google_settings.png')
    openacc(pg); print('sin cuenta:', st(pg)); pg.screenshot(path=OUT + 'google_login.png')
    pg.click('[data-ga=in]'); pg.wait_for_timeout(1500)
    print('enlazada:', st(pg), '· id de cliente:', pg.evaluate("() => window.__gid")[:16], '· uid', pg.evaluate("() => Social.uid"))
    sv = fs.docs.get('saves/ME', {}).get('f', {})
    print('copia en la nube:', bool(sv), json.loads(sv['data']['stringValue'])['coins'] if sv else None, '· tick:', pg.evaluate("() => !document.getElementById('sGoogleOk').hidden"))
    pg.screenshot(path=OUT + 'google_linked.png')
    pg.evaluate("() => { ChromaGame.save().coins = 2000; }")
    pg.click('[data-ga=save]'); pg.wait_for_timeout(800)
    print('guardar ahora:', json.loads(fs.docs['saves/ME']['f']['data']['stringValue'])['coins'], pg.evaluate("() => document.getElementById('gaMsg').textContent"))
    pg.click('[data-ga=out]'); pg.click('[data-ga=out]'); pg.wait_for_timeout(800)
    print('sesión cerrada:', pg.evaluate("() => [Social.account.linked, window.__gout, ChromaGame.save().coins]"), st(pg)[0])
    pg.click('[data-ga=x]'); pg.wait_for_timeout(300)
    print('sin Facebook:', pg.evaluate("() => !document.getElementById('sFacebook') && !document.getElementById('welFacebook')"))
    print('errores', errs[:5]); b.close()
    # 2) cuenta de Google con progreso de otro móvil
    fs = FakeFS(); fs.google_existing = 'GUSER'
    cloud = {'unlocked': 250, 'coins': 9999, 'birthYear': 1990, 'pid': 'ABCDEFGH', 'stars': {'1': 3, '2': 3}}
    fs.put('saves/GUSER', {'data': {'stringValue': json.dumps(cloud)}, 'lv': {'integerValue': '250'}, 'stars': {'integerValue': '600'}, 'at': {'timestampValue': '2026-10-30T10:00:00Z'}, 'dev': {'stringValue': 'otro'}})
    b, pg, errs = page(p, fs, {'unlocked': 5, 'coins': 300, 'birthYear': 1990})
    pg.evaluate("async () => { await Social.sync(); }"); pg.wait_for_timeout(500)
    openacc(pg); pg.click('[data-ga=in]'); pg.wait_for_timeout(1800)
    print('elegir:', st(pg), pg.evaluate("() => document.querySelector('.gacmp').innerText.replace(/\\n/g,' | ')"))
    pg.screenshot(path=OUT + 'google_choose.png')
    print('anónima borrada:', [d for d in fs.log if d[0] == 'POST' and 'delete' in d[1]][:2])
    pg.click('[data-ga=useCloud]'); pg.wait_for_timeout(1500); pg.wait_for_function('() => window.Social && window.ChromaGame', timeout=30000); pg.wait_for_timeout(1500)
    print('tras recargar:', pg.evaluate("() => [ChromaGame.save().coins, ChromaGame.save().unlocked, Social.uid, Social.account.linked]"))
    print('errores', errs[:5]); b.close()
