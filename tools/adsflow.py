# Anuncios entre niveles: uno cada 5 partidas terminadas (desde el nivel 10), corto (simulado 5 s); el de recompensa simulado dura 8 s.
import sys, json
from playwright.sync_api import sync_playwright
fails = []
def check(n, ok, info=''):
    print(('OK  ' if ok else 'FALLO ') + n, info)
    if not ok: fails.append(n)
SAVE = "{unlocked:30, played:40, welcomed:true, lastSeen:Date.now(), coins:500, daily:{n:0,last:null,best:0,shields:0,adRescue:-99,auto:Math.floor((Date.now()-new Date().getTimezoneOffset()*6e4)/864e5)}}"
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 390, 'height': 844}).new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script("window.RR_AGE=30; window.RR_LIVE_OFF=true; localStorage.setItem('rocketrush.lang','es'); localStorage.setItem('chromacrash3d.v1', JSON.stringify(" + SAVE + "))")
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2500)
    ev = lambda js: pg.evaluate(js)
    ev("() => ChromaGame.manual(true)")
    shown = []
    for i in range(1, 11):
        ev(f"() => {{ document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel({10 + i}, []); ChromaGame.finishWin(); }}")
        pg.wait_for_timeout(300)
        ev("() => { ChromaGame.save().lastInter = 0; ChromaGame.G.mystery = false; document.getElementById('winMap').click(); }"); pg.wait_for_timeout(400)
        ev("() => document.querySelectorAll('#mystery.on button').forEach(b => b.click())"); pg.wait_for_timeout(200)
        on = ev("() => document.getElementById('ad').classList.contains('on')")
        if on:
            shown.append(i); n0 = ev("() => +document.getElementById('adCnt').textContent")
            check(f'anuncio corto en la partida {i} (5 s)', n0 == 5, str(n0))
            pg.wait_for_timeout(5600)
            check('el anuncio se cierra solo y sigue el juego', not ev("() => document.getElementById('ad').classList.contains('on')") and ev("() => document.getElementById('map').classList.contains('on')"))
    check('uno cada 5 partidas', shown == [5, 10], json.dumps(shown))
    # perder también cuenta
    ev("() => { ChromaGame.save().interN = 4; ChromaGame.save().lastInter = 0; document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(20, []); const s=ChromaGame.G.sim; s.queue.length=0; s.balls.length=0; }")
    ev("() => { for (let i=0;i<240;i++) ChromaGame.tick(1/30, true); }"); pg.wait_for_timeout(300)
    lost = ev("() => document.getElementById('lose').classList.contains('on')")
    if lost:
        ev("() => document.getElementById('loseMap').click()"); pg.wait_for_timeout(300)
        check('al perder la 5.ª partida también sale', ev("() => document.getElementById('ad').classList.contains('on')"))
        pg.wait_for_timeout(5600)
    else: print('(no se llegó a perder: se omite)')
    # sin anuncios comprado: nunca
    ev("() => { const s=ChromaGame.save(); s.adsRemoved = true; s.interN = 9; s.lastInter = 0; document.querySelectorAll('.screen').forEach(x=>x.classList.remove('on')); ChromaGame.startLevel(21, []); ChromaGame.finishWin(); }"); pg.wait_for_timeout(300)
    ev("() => document.getElementById('winMap').click()"); pg.wait_for_timeout(400)
    check('con «sin anuncios» no sale', not ev("() => document.getElementById('ad').classList.contains('on')"))
    # recompensa: 8 s
    ev("() => { document.querySelectorAll('.screen').forEach(x=>x.classList.remove('on')); RRGame.showRewarded(ok => { window.__rw = ok; }); }")
    n0 = ev("() => +document.getElementById('adCnt').textContent")
    check('vídeo con premio simulado de 8 s', n0 == 8, str(n0))
    pg.wait_for_timeout(8600)
    check('da el premio al acabar', ev("() => window.__rw") == True)
    check('sin errores', not errs, str(errs[:3]))
    b.close()
print('\n' + ('TODO BIEN' if not fails else 'FALLOS: ' + ', '.join(fails)))
sys.exit(1 if fails else 0)
