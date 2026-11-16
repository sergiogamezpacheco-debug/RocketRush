# Arrecife: el pájaro es un pez (aviso «¡Un pez!», también con el aviso del pájaro ya visto) y en el espacio, satélite
from playwright.sync_api import sync_playwright
errs=[]; ok=[]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    for w, want in [('reef', '¡Un pez!'), ('space', '¡Un satélite!'), ('sea', '')]:
        pg=b.new_context(viewport={'width':390,'height':844}).new_page(); pg.on('pageerror',lambda e: errs.append(str(e)))
        pg.add_init_script("window.RR_AGE = 30; window.RR_LIVE_OFF = true; window.RR_NO_INTRO = true; localStorage.setItem('rocketrush.lang','es'); localStorage.setItem('chromacrash3d.v1', JSON.stringify({unlocked: 1023, played: 30, birthYear: 1990, seen: {bird: true}, tut: {main: true}}))")
        pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2500)
        pg.evaluate("() => ChromaGame.manual(true)")
        biome = pg.evaluate("(w) => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); const L=ChromaGame.LEVELS.find(l=>l.biome===w&&!l.boss&&l.id>5); ChromaGame.startLevel(L.id, []); const s=ChromaGame.G.sim; s.nextShip=1e9; s.nextBird=0.1; return L.biome; }", w)
        txt=''
        for i in range(60):
            pg.evaluate("() => { ChromaGame.tick(1/30,true); }")
            txt = pg.evaluate("() => document.getElementById('hint').textContent")
            if txt: break
        good = (want in txt) if want else (txt == '')     # en el mar el aviso del pájaro ya estaba visto
        ok.append(good); print('OK ' if good else 'MAL', w, biome, repr(txt)); pg.close()
    b.close()
print('errores', errs[:3]); print('TODO BIEN' if all(ok) and not errs else 'FALLOS')
