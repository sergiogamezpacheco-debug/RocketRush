# 25-11: los 3 mundos nuevos se ven (paisaje, bloques propios) y su estreno sale la primera vez
import sys
from playwright.sync_api import sync_playwright
OUT='/home/claude/chroma3d/dist/shots/'; errs=[]; ok=[]
def chk(n, c, x=''): ok.append(bool(c)); print('OK ' if c else 'MAL', n, x)
IDS=[(548,'pintura','paint'),(610,'fabrica','factory'),(920,'tormenta','storm')]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    for lv,name,bio in IDS:
        pg=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2).new_page(); pg.on('pageerror',lambda e: errs.append(str(e)))
        pg.add_init_script("window.RR_AGE = 30; window.RR_LIVE_OFF = true; window.RR_NO_INTRO = true; localStorage.setItem('rocketrush.lang','es'); localStorage.setItem('chromacrash3d.v1', JSON.stringify({unlocked: 1100, played: 300, birthYear: 1990, tut: {main: true, tips: {daily: 1, club: 1, shop: 1}}}))")
        pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2500)
        pg.evaluate("(id) => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(id, []); }", lv)
        for i in range(30):
            pg.wait_for_timeout(300)
            if pg.evaluate("() => document.getElementById('newCard').classList.contains('on')"): break
        info=pg.evaluate("() => { const L = ChromaGame.G.level, s = ChromaGame.G.sim; return { biome: L.biome, debut: L.debut, card: document.getElementById('newCard').classList.contains('on'), kinds: [...new Set(s.blocks.map(b => b.userData.kind))].join(',') }; }")
        chk(name + ': paisaje y estreno', info['biome'] == bio and info['card'], info)
        pg.screenshot(path=OUT+f'mundo_{name}_carta.png', timeout=90000)
        pg.evaluate("() => document.getElementById('ncOk').click()"); pg.wait_for_timeout(1800)
        chk(name + ': anillo en el bloque nuevo', pg.evaluate('() => !!ChromaGame.G.debutRing'))
        pg.screenshot(path=OUT+f'mundo_{name}.png', timeout=90000); pg.close()
    b.close()
print('errores', errs[:3]); print('TODO BIEN' if all(ok) and not errs else 'FALLOS')
