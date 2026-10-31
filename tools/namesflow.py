# Nombre único (comprobación al escribir y al guardar, palabras no permitidas, liberar el anterior) y modo probador
# activado desde el panel (testers/{uid}), con un Firestore de mentira.
import sys
sys.path.insert(0, '/home/claude/chroma3d/tools')
from fakefs import FakeFS
from playwright.sync_api import sync_playwright
OUT = '/home/claude/chroma3d/dist/shots/'
fs = FakeFS()
fs.put('names/los titanes', {'uid': {'stringValue': 'OTRO'}})
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1).new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script("window.RR_AGE = 30; window.RR_LIVE_OFF = true; localStorage.setItem('rocketrush.lang','es')")
    pg.route('**/*googleapis.com/**', fs.handle)
    pg.goto('file:///home/claude/chroma3d/' + (sys.argv[1] if len(sys.argv) > 1 else 'dist/index.html')); pg.wait_for_timeout(2500)
    pg.evaluate("() => { ChromaGame.manual(true); document.getElementById('daily').classList.remove('on'); Social.open('me'); }"); pg.wait_for_timeout(800)
    def typ(t, wait=1500):
        pg.fill('#socName', t); pg.dispatch_event('#socName', 'input'); pg.wait_for_timeout(wait)
        return pg.evaluate("() => [document.getElementById('socNameMsg').textContent, document.getElementById('socNameMsg').className]")
    print('ocupado:', typ('Los Titanes'))
    print('feo:', typ('PutaMadre'))
    print('corto:', typ('Yo'))
    print('libre:', typ('Sergio Rush'))
    pg.screenshot(path=OUT + 'name_free.png')
    pg.click('#socSaveName'); pg.wait_for_timeout(1500)
    print('guardado:', pg.evaluate("() => [ChromaGame.save().prof.name, ChromaGame.save().nameLc]"), 'reservas:', sorted(k for k in fs.docs if k.startswith('names/')))
    typ('Sergio Rush 2'); pg.click('#socSaveName'); pg.wait_for_timeout(1500)
    print('cambio:', sorted(k for k in fs.docs if k.startswith('names/')), 'perfil subido:', fs.docs.get('users/ME', {}).get('f', {}).get('name'))
    typ('Los Titanes'); pg.click('#socSaveName'); pg.wait_for_timeout(1200)
    print('guardar ocupado:', pg.evaluate("() => [document.getElementById('socNameMsg').textContent, ChromaGame.save().prof.name]"))
    pg.screenshot(path=OUT + 'name_taken.png')
    # probador
    print('antes:', pg.evaluate("() => [ChromaGame.save().tester, document.getElementById('sTest').hidden]"))
    fs.put('testers/ME', {'name': {'stringValue': 'yo'}})
    pg.evaluate("async () => { await Social.checkTester(); }"); pg.wait_for_timeout(800)
    pg.evaluate("() => { RRGame.goTitle(); document.getElementById('btnSetT').click(); }"); pg.wait_for_timeout(400)
    print('probador:', pg.evaluate("() => [ChromaGame.save().tester, document.getElementById('sTest').hidden, document.getElementById('sTestNote').textContent]"))
    pg.screenshot(path=OUT + 'tester_on.png')
    pg.click('#sTest'); print('desbloqueo:', pg.evaluate("() => [ChromaGame.save().testAll, ChromaGame.save().unlocked]"))
    del fs.docs['testers/ME']
    pg.evaluate("async () => { await Social.checkTester(); }"); pg.wait_for_timeout(300)
    print('el panel lo quita (tras 30 min se vuelve a mirar):', pg.evaluate("() => ChromaGame.save().tester"))
    print('errores', errs[:5]); b.close()
