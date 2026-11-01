# Primera vez: idioma → edad → bienvenida (nombre único gratis + entrar con Google). Después, cambiar el nombre cuesta
# 50 gemas en el perfil. Menores de 13: sin bienvenida. Crear club: 5.000 monedas y 50 gemas.
import sys, json
sys.path.insert(0, '/home/claude/chroma3d/tools')
from fakefs import FakeFS
from playwright.sync_api import sync_playwright
OUT = '/home/claude/chroma3d/dist/shots/'
BRIDGE = "window.ChromaAndroid = { googleSignIn(id){ setTimeout(() => onGoogleSignIn({ ok: true, idToken: 'gtok', email: 'yo@gmail.com', name: 'Sergio' }), 50); }, googleSignOut(){}, vibrate(){}, scheduleReminder(){}, cancelReminder(){}, share(){} };"
def run(p, year, label):
    fs = FakeFS(); fs.put('names/los titanes', {'uid': {'stringValue': 'OTRO'}})
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1).new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script("window.RR_LIVE_OFF = true; localStorage.setItem('rocketrush.lang','es');" + BRIDGE)
    pg.route('**/*googleapis.com/**', fs.handle)
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2500)
    pg.evaluate("() => ChromaGame.manual(true)")
    vis = lambda: pg.evaluate("() => ['ageGate','welcome'].map(id => !document.getElementById(id).hidden)")
    print(label, 'al abrir (edad, bienvenida):', vis())
    pg.select_option('#agYear', str(year)); pg.click('#agOk'); pg.wait_for_timeout(600)
    print(label, 'tras la edad:', vis())
    if year > 2013: print('errores', errs[:5]); b.close(); return
    pg.screenshot(path=OUT + 'welcome.png')
    pg.fill('#welName', 'Los Titanes'); pg.dispatch_event('#welName', 'input'); pg.wait_for_timeout(1500)
    print('ocupado:', pg.evaluate("() => document.getElementById('welMsg').textContent"))
    pg.click('#welGoogle'); pg.wait_for_timeout(1500)
    print('google:', pg.evaluate("() => [document.getElementById('welAcc').textContent, Social.account.linked]"))
    pg.fill('#welName', 'Sergio Rush'); pg.dispatch_event('#welName', 'input'); pg.wait_for_timeout(1500)
    print('libre:', pg.evaluate("() => document.getElementById('welMsg').textContent"))
    pg.screenshot(path=OUT + 'welcome_filled.png')
    pg.click('#welGo'); pg.wait_for_timeout(1500)
    print('a jugar:', pg.evaluate("() => [document.getElementById('welcome').hidden, ChromaGame.save().prof.name, ChromaGame.save().welcomed, ChromaGame.save().gems || 0]"), sorted(k for k in fs.docs if k.startswith('names/')))
    # cambiar el nombre en el perfil: 50 gemas
    pg.evaluate("() => { ChromaGame.manual(true); document.getElementById('daily').classList.remove('on'); ChromaGame.save().gems = 30; Social.open('me'); }"); pg.wait_for_timeout(800)
    print('botón del perfil:', pg.evaluate("() => document.getElementById('socSaveName').innerText"))
    pg.fill('#socName', 'Sergio Nuevo'); pg.click('#socSaveName'); pg.wait_for_timeout(600)
    print('sin gemas:', pg.evaluate("() => [document.getElementById('socNameMsg').textContent, ChromaGame.save().prof.name]"))
    pg.evaluate("() => { ChromaGame.save().gems = 80; }")
    pg.fill('#socName', 'Sergio Nuevo'); pg.click('#socSaveName'); pg.wait_for_timeout(1500)
    print('con gemas:', pg.evaluate("() => [ChromaGame.save().prof.name, ChromaGame.save().gems]"))
    pg.screenshot(path=OUT + 'profile_cost.png')
    # club: 5.000 monedas y 50 gemas
    pg.evaluate("() => { const s = ChromaGame.save(); s.coins = 6000; s.gems = 20; Club.open(); }"); pg.wait_for_timeout(1200)
    pg.click('[data-nt=create]'); pg.wait_for_timeout(300)
    print('club sin gemas:', pg.evaluate("() => [document.getElementById('cfGo').disabled, document.getElementById('cfGo').innerText, [...document.querySelectorAll('#clubList .sm')].map(e=>e.textContent).filter(t=>t.startsWith('Te faltan'))]"))
    pg.evaluate("() => { ChromaGame.save().gems = 60; Club.render(); }"); pg.wait_for_timeout(200)
    pg.fill('#cfName', 'Los Rapidos'); pg.click('#cfGo'); pg.wait_for_timeout(1500)
    print('club creado:', pg.evaluate("() => [ChromaGame.save().coins, ChromaGame.save().gems, Social.club.id && 'sí']"))
    print('errores', errs[:5]); b.close()
with sync_playwright() as p:
    run(p, 1990, 'adulto')
    run(p, 2016, 'niño')
