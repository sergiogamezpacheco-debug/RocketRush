# 25-11: compartir jugada. Se juega un nivel de verdad, se fuerza un combo grande y se mira que al ganar salga el botón,
# que la ventana enseñe el vídeo (o la imagen) y que al compartir llegue un archivo al puente de Android.
from playwright.sync_api import sync_playwright
import base64
OUT='/home/claude/chroma3d/dist/shots/'; errs=[]; ok=[]
def chk(n, c, x=''): ok.append(bool(c)); print('OK ' if c else 'MAL', n, x)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    pg=b.new_context(viewport={'width':390,'height':844}).new_page(); pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.add_init_script("""window.RR_AGE = 30; window.RR_LIVE_OFF = true; window.RR_NO_INTRO = true; window.RR_REC_TEST = true; window.__S = [];
      window.ChromaAndroid = { shareFile: (b, mime, name, text) => window.__S.push({ n: b.length, mime, name, text }), scheduleNotice: () => {}, cancelNotice: () => {}, scheduleReminder: () => {}, cancelReminder: () => {} };
      localStorage.setItem('rocketrush.lang','es'); localStorage.setItem('chromacrash3d.v1', JSON.stringify({unlocked: 60, played: 30, birthYear: 1990, tut: {main: true, tips: {daily: 1, club: 1, shop: 1}}}))""")
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(3000)
    print('graba vídeo:', pg.evaluate("() => Jugada.canRec()"))
    pg.evaluate("() => { document.querySelectorAll('.screen').forEach(s => s.classList.remove('on')); ChromaGame.startLevel(12, []); }"); pg.wait_for_timeout(1500)
    # un tiro con combo de 9 (los pasos del combo llegan mientras el juego sigue pintando)
    pg.evaluate("() => { Jugada.shoot(ChromaGame.G.level); }")
    for n in range(1, 10):
        pg.evaluate(f"() => Jugada.combo({n})"); pg.wait_for_timeout(250)
    pg.wait_for_timeout(3500)
    bst=pg.evaluate("() => { const b = Jugada.best; return b ? { combo: b.combo, img: !!b.img, vid: b.vid ? b.vid.mime + ' ' + b.vid.blob.size : null } : null; }")
    chk('se guarda la mejor jugada (foto)', bst and bst['img'] and bst['combo'] == 9, bst)
    chk('y su vídeo', bst and bst['vid'], bst and bst['vid'])
    # ganar: botón y ventana
    pg.evaluate("() => { const s = ChromaGame.G.sim; for (const o of s.blocks) if (o.userData.alive) s.popSingle(o, 0); }")
    for i in range(40):
        pg.wait_for_timeout(250)
        if pg.evaluate("() => document.getElementById('win').classList.contains('on')"): break
    chk('sale «Compartir jugada» al ganar', pg.evaluate("() => !!document.getElementById('winShare') && /combo ×\\d+/.test(document.getElementById('winShare').textContent)"), pg.evaluate("() => document.getElementById('winShare') && document.getElementById('winShare').textContent"))
    pg.evaluate("() => document.getElementById('winShare').click()"); pg.wait_for_timeout(1200)
    chk('se abre la ventana con la jugada', pg.evaluate("() => Jugada.isOpen() && !!document.querySelector('#jugView video, #jugView img')"), pg.evaluate("() => document.getElementById('jugView').innerHTML.slice(0, 60)"))
    pg.screenshot(path=OUT+'jugada_ventana.png', timeout=90000)
    btns=pg.evaluate("() => [...document.querySelectorAll('#jugBtns button')].map(b => b.textContent)"); print('   botones', btns)
    pg.evaluate("() => document.querySelector('#jugBtns button:last-child').click()"); pg.wait_for_timeout(4000); print('   puente', pg.evaluate('() => [typeof window.ChromaAndroid.shareFile, Object.keys(window.ChromaAndroid).join()]'))
    s=pg.evaluate("() => window.__S")
    chk('compartir imagen llega a Android como jpg', s and s[-1]['mime'] == 'image/jpeg' and s[-1]['n'] > 20000 and 'play.google.com' in s[-1]['text'], s and {k: s[-1][k] for k in ('mime','name','n')})
    if len(btns) > 1:
        pg.evaluate("() => document.querySelector('#jugBtns button').click()"); pg.wait_for_timeout(1500)
        s=pg.evaluate("() => window.__S"); chk('compartir vídeo llega a Android', len(s) == 2 and s[-1]['mime'].startswith('video/'), s[-1] if s else None)
    # la imagen final
    img=pg.evaluate("() => new Promise(r => { const c = document.querySelector('#jugView img'); if (c) return r(c.src); const v = Jugada.best; r(null); })")
    pg.evaluate("() => Jugada.close()")
    chk('la ventana se cierra', not pg.evaluate("() => Jugada.isOpen()"))
    # sin combo y sin 3 estrellas: no hay botón
    pg.evaluate("() => { ChromaGame.startLevel(13, []); }"); pg.wait_for_timeout(800)
    pg.evaluate("() => Jugada.winUi(ChromaGame.G.level, 1)")
    chk('sin buena jugada no sale el botón', not pg.evaluate("() => !!document.getElementById('winShare')"))
    # con vídeo: un tiro bueno y se gana sin más combos
    pg.evaluate("() => { document.querySelectorAll('.screen').forEach(s => s.classList.remove('on')); ChromaGame.startLevel(14, []); }"); pg.wait_for_timeout(1200)
    pg.evaluate("() => Jugada.shoot(ChromaGame.G.level)")
    for n in range(1, 8):
        pg.evaluate(f"() => Jugada.combo({n})"); pg.wait_for_timeout(250)
    pg.wait_for_timeout(3500)
    pg.evaluate("() => { document.getElementById('win').classList.add('on'); Jugada.winUi(ChromaGame.G.level, 3); document.getElementById('winShare').click(); }"); pg.wait_for_timeout(1500)
    chk('la ventana enseña el vídeo', pg.evaluate("() => !!document.querySelector('#jugView video')"))
    pg.wait_for_timeout(1200); pg.screenshot(path=OUT+'jugada_video.png', timeout=90000)
    pg.evaluate("() => document.querySelector('#jugBtns button').click()"); pg.wait_for_timeout(2500)
    s=pg.evaluate("() => window.__S"); chk('compartir vídeo llega a Android', s and s[-1]['mime'].startswith('video/') and s[-1]['name'].startswith('jugada.'), s[-1] and {k: s[-1][k] for k in ('mime','name','n')})
    b.close()
print('errores', errs[:3]); print('TODO BIEN' if all(ok) and not errs else 'FALLOS')
