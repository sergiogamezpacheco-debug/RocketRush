# Logo del juego (placa de la portada) con fondo transparente, por idioma: python3 tools/storelogo.py en
import sys
from playwright.sync_api import sync_playwright
lang = sys.argv[1] if len(sys.argv) > 1 else 'es'
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width':390,'height':844}, device_scale_factor=4).new_page()
    pg.add_init_script("window.RR_AGE=30; window.RR_LIVE_OFF=true; localStorage.setItem('rocketrush.lang','" + lang + "')")
    pg.route('**/*googleapis.com/**', lambda r: r.abort())
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2500)
    pg.evaluate("() => { Live.set({hw:{on:false},xm:{on:false}}); document.getElementById('daily').classList.remove('on'); RRGame.goTitle(); ChromaGame.manual(true); }"); pg.wait_for_timeout(2500)
    r = pg.evaluate("""() => { document.body.style.background='transparent'; document.documentElement.style.background='transparent'; document.getElementById('game').style.visibility='hidden'; document.getElementById('title').style.background='none';
      document.querySelectorAll('#title > *:not(#tWrap), .tmascot, #tTrail, .trocket').forEach(e=>e.style.visibility='hidden');
      document.querySelectorAll('#tWrap *').forEach(e=>{ e.style.animation='none'; });
      const r = document.querySelector('.tplaque').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }""")
    pg.wait_for_timeout(300)
    pg.screenshot(path=f'/home/claude/chroma3d/store/logo-{lang}.png', omit_background=True, clip={'x': r[0]-6, 'y': r[1]-6, 'width': r[2]+12, 'height': r[3]+14})
    b.close()
