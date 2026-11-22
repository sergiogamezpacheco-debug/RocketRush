# 22-11: los 4 cañones nuevos (Galleta de Jengibre, Cubitos, Tormenta, Abeja) se ven en la tienda y en la partida
from playwright.sync_api import sync_playwright
OUT='/home/claude/chroma3d/dist/shots/'; errs=[]; ok=[]
def chk(n, c, x=''): ok.append(bool(c)); print('OK ' if c else 'MAL', n, x)
IDS=['jengibre','cubitos','tormenta','abeja']
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    for sk in IDS:
        pg=b.new_context(viewport={'width':390,'height':844}).new_page(); pg.on('pageerror',lambda e: errs.append(str(e)))
        pg.add_init_script("window.RR_AGE = 30; window.RR_LIVE_OFF = true; window.RR_NO_INTRO = true; localStorage.setItem('rocketrush.lang','es'); localStorage.setItem('chromacrash3d.v1', JSON.stringify({unlocked: 60, played: 30, birthYear: 1990, skins: {owned: ['classic','%s'], equip: '%s'}, tut: {main: true, tips: {daily: 1, club: 1, shop: 1}}}))" % (sk, sk))
        pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2500)
        info=pg.evaluate("(sk) => { const d = Cannons.SKIN[sk]; return d ? { name: d.name, rar: d.rar, how: d.how, g: d.g } : null; }", sk)
        chk('existe ' + sk, info, info)
        pg.evaluate("() => { document.getElementById('daily').classList.remove('on'); ChromaGame.startLevel(12); }"); pg.wait_for_timeout(2500)
        pg.screenshot(path=OUT+'canon_'+sk+'.png', clip={'x':60,'y':560,'width':270,'height':284}, timeout=90000)
        pg.close()
    pg=b.new_context(viewport={'width':390,'height':844}).new_page(); pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.add_init_script("window.RR_AGE = 30; window.RR_LIVE_OFF = true; window.RR_NO_INTRO = true; localStorage.setItem('rocketrush.lang','es'); localStorage.setItem('chromacrash3d.v1', JSON.stringify({unlocked: 60, played: 30, birthYear: 1990, tut: {main: true, tips: {daily: 1, club: 1, shop: 1}}}))")
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2500)
    pg.evaluate("() => { document.getElementById('daily').classList.remove('on'); RRGame.openShop('can'); }"); pg.wait_for_timeout(800)
    txt=pg.inner_text('#shopList')
    for n in ['Cañón Galleta de Jengibre','Cañón Cubitos','Cañón Abeja']: chk('en la tienda: ' + n, n in txt)
    b.close()
print('errores', errs[:3]); print('TODO BIEN' if all(ok) and not errs else 'FALLOS')
