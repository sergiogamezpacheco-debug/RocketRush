# Tutorial de los clubes: paso «El Club» del mapa y consejos de Cubi en la pantalla de clubes (sin club y en cada pestaña).
import sys
sys.path.insert(0, '/home/claude/chroma3d/tools')
from fakefs import FakeFS
from playwright.sync_api import sync_playwright
OUT = '/home/claude/chroma3d/dist/shots/'
fs = FakeFS()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True).new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script("window.RR_TUT_TEST = true; window.RR_AGE = 30; window.RR_LIVE_OFF = true; localStorage.setItem('rocketrush.lang','es'); if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', 1); localStorage.setItem('chromacrash3d.v1', JSON.stringify({ unlocked: 3, played: 2, coins: 900, birthYear: 1990, tut: { main: false, tips: { daily: 1 }, step: 8 } })); }")
    pg.route('**/*googleapis.com/**', fs.handle)
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2500)
    tut = lambda: pg.evaluate("() => [Tutorial.visible, document.querySelector('#tut .tu-tt').textContent]")
    # tutorial principal en el mapa: paso del Club
    pg.evaluate("() => { document.getElementById('daily').classList.remove('on'); RRGame.goMap(); }"); pg.wait_for_timeout(1500)
    print('mapa:', tut()); pg.click('#tut .tu-bub'); pg.wait_for_timeout(800)
    print('mapa 2:', tut()); pg.screenshot(path=OUT + 'tut_club_mapa.png')
    pg.evaluate("() => Tutorial.finish()"); pg.wait_for_timeout(300)
    pg.click('#navClub'); pg.wait_for_timeout(1500)
    print('sin club:', tut()); pg.screenshot(path=OUT + 'tut_club_sin.png')
    pg.click('#tut .tu-bub'); pg.wait_for_timeout(400)
    pg.click('[data-nt=create]'); pg.fill('#cfName', 'Los Demoledores'); pg.click('#cfGo'); pg.wait_for_timeout(1800)
    print('club:', tut()); pg.screenshot(path=OUT + 'tut_club_club.png'); pg.click('#tut .tu-bub'); pg.wait_for_timeout(400)
    for t in ('ex', 'boss', 'lg'):
        pg.click(f'[data-t={t}]'); pg.wait_for_timeout(1200)
        print(t + ':', tut()); pg.screenshot(path=OUT + f'tut_club_{t}.png'); pg.click('#tut .tu-bub'); pg.wait_for_timeout(400)
    print('consejos vistos:', pg.evaluate("() => Object.keys(ChromaGame.save().tut.tips).filter(k => k.startsWith('club'))"))
    print('errores', errs[:5]); b.close()
