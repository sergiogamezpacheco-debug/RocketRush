# Partículas y clima: capturas en mitad de un derrumbe y dibujos por fotograma (para comprobar que van en lotes).
# Uso: python3 tools/fxprobe.py [nivel ...]   (por defecto: 9 lluvia/tormenta/arena/ventisca/ceniza/nieve/volcán)
import sys
from playwright.sync_api import sync_playwright
OUT = '/home/claude/chroma3d/dist/shots/'
LV = [int(x) for x in sys.argv[1:]] or [9, 176, 207, 238, 269, 300, 52, 114]
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1).new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script("window.RR_AGE = 30; window.RR_LIVE_OFF = true; window.RR_NO_INTRO = true; localStorage.setItem('rocketrush.lang','es'); localStorage.setItem('chromacrash3d.v1', JSON.stringify({unlocked: 400, played: 30, birthYear: 1990, tut: {main: true, tips: {daily: 1, club: 1}}}))")
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(3500)
    pg.evaluate("() => { document.getElementById('daily').classList.remove('on'); ChromaGame.manual(true); }")
    for lv in LV:
        pg.evaluate(f"() => {{ document.querySelectorAll('.screen,.pop').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel({lv}, []); for(let i=0;i<100;i++) ChromaGame.tick(1/60, true); }}")
        r = pg.evaluate("""() => { const G = ChromaGame.G, s = G.sim, R = ChromaGame.renderer; const out = { dc: [], ms: [] };
          for (let k = 0; k < 3; k++) { const live = s.liveBlocks(); if (!live.length || s.state !== 'play') break; const b = live.find(x => x.userData.c === s.queue[0]) || live[0]; s.sinceFire = 9; if (s.canFire()) s.fire(b.position.x, b.position.y, b.position.z + 0.3); for (let i = 0; i < 40; i++) ChromaGame.tick(1/60, true); }
          for (let i = 0; i < 6; i++) { const t = performance.now(); ChromaGame.tick(1/60); out.ms.push(+(performance.now() - t).toFixed(1)); out.dc.push(R.info.render.calls); }
          return out; }""")
        pg.screenshot(path=OUT + f'fx_{lv}.png')
        print(lv, 'dibujos', r['dc'], 'ms', r['ms'], flush=True)
    print('errores', errs[:4]); b.close()
