# Tutorial con Cubi: partida nueva de principio a fin (portada → ficha → primer disparo → mapa) y un consejo de la tienda
from playwright.sync_api import sync_playwright
OUT = '/home/claude/chroma3d/dist/shots/'
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True).new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script("window.RR_TUT_TEST = true; window.RR_AGE = 30; localStorage.setItem('rocketrush.lang','es')")
    pg.route('**/*googleapis.com/**', lambda r: r.abort())
    pg.goto('file:///home/claude/chroma3d/dist/index.html')
    st = lambda: pg.evaluate("() => [Tutorial.step, Tutorial.visible, document.querySelector('#tut .tu-tt').textContent]")
    def wait_step(n, ms=15000):
        pg.wait_for_function(f"() => Tutorial.visible && Tutorial.step === {n}", timeout=ms); pg.wait_for_timeout(400)
    shots = []
    for n in range(3):
        wait_step(n); print('paso', st(), '· racha automática abierta:', pg.evaluate("() => document.getElementById('daily').classList.contains('on')"))
        pg.screenshot(path=OUT + f'tut{n}.png'); pg.click('#tut .tu-bub')
    wait_step(3); print('paso', st()); pg.screenshot(path=OUT + 'tut3.png')
    # tocar fuera del botón no hace nada; tocar el botón sí
    pg.mouse.click(30, 120); pg.wait_for_timeout(300); print('toque fuera: sigue en el paso', st()[0])
    pg.click('#btnPlay')
    wait_step(4); print('paso', st()); pg.screenshot(path=OUT + 'tut4.png')
    pg.click('#preGo')
    wait_step(5, 30000); print('paso', st()); pg.screenshot(path=OUT + 'tut5.png')
    pos = pg.evaluate("""() => { const s=ChromaGame.G.sim, k=s.queue[0]; const live=s.liveBlocks(); const b=live.find(x=>x.userData.c===k)||live[0];
         const v=new THREE.Vector3().copy(b.position).project(ChromaGame.camera); return [(v.x*0.5+0.5)*innerWidth, (-v.y*0.5+0.5)*innerHeight]; }""")
    pg.mouse.click(pos[0], pos[1])
    wait_step(6); print('paso', st(), '· disparos', pg.evaluate("() => ChromaGame.G.sim.shots")); pg.screenshot(path=OUT + 'tut6.png')
    # vuelve al mapa: se explican el nivel de jugador y los modos
    pg.evaluate("() => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); RRGame.goMap(); }")
    for n in (7, 8, 9):
        wait_step(n); print('paso', st()); pg.screenshot(path=OUT + f'tut{n}.png'); pg.click('#tut .tu-bub')
    pg.wait_for_timeout(500)
    print('tutorial terminado:', pg.evaluate("() => RRGame.save.tut.main"), '· visible', pg.evaluate("() => Tutorial.visible"))
    # consejo de la tienda la primera vez
    pg.evaluate("() => RRGame.openShop()"); pg.wait_for_function("() => Tutorial.visible && Tutorial.step === 'shop'", timeout=8000); pg.wait_for_timeout(300)
    print('consejo:', st()); pg.screenshot(path=OUT + 'tut_shop.png'); pg.click('#tut .tu-bub'); pg.wait_for_timeout(300)
    pg.evaluate("() => { document.getElementById('shop').classList.remove('on'); RRGame.openShop(); }"); pg.wait_for_timeout(600)
    print('la segunda vez no sale:', not pg.evaluate("() => Tutorial.visible"))
    # en inglés
    pg.evaluate("() => { I18N.set('en'); RRGame.save.tut = { main: false, tips: {}, step: 1 }; document.getElementById('shop').classList.remove('on'); RRGame.goTitle(); }")
    wait_step(1); print('inglés:', st()); pg.screenshot(path=OUT + 'tut_en.png')
    print('errores', errs[:5]); b.close()
