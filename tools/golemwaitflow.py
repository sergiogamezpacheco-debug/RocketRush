# Gólem (nivel 82): al romper el núcleo encendido, el siguiente tarda ~3 s en encenderse (antes salía al momento)
from playwright.sync_api import sync_playwright
errs=[]; ok=[]
def chk(n, c, x=''): ok.append(bool(c)); print('OK ' if c else 'MAL', n, x)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    pg=b.new_context(viewport={'width':390,'height':844}).new_page(); pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.add_init_script("window.RR_AGE = 30; window.RR_LIVE_OFF = true; window.RR_NO_INTRO = true; localStorage.setItem('rocketrush.lang','es'); localStorage.setItem('chromacrash3d.v1', JSON.stringify({unlocked: 90, played: 90, birthYear: 1990, tut: {main: true, tips: {daily: 1, club: 1, shop: 1}}}))")
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2500)
    pg.evaluate("() => { ChromaGame.manual(true); ChromaGame.startLevel(82); }"); pg.wait_for_timeout(300)
    pg.evaluate("() => { for (let i = 0; i < 60; i++) ChromaGame.tick(1/60, true); }")
    st=lambda: pg.evaluate("() => { const S = Bosses.state(), sim = ChromaGame.G.sim; const a = S.activeCore; return { a, hit: S.coresHit, lit: a !== null && a !== undefined && sim.blocks[a].userData.kind === 'gold' }; }")
    s0=st(); chk('hay un núcleo encendido al empezar', s0['lit'], s0)
    pg.evaluate("() => { const S = Bosses.state(), sim = ChromaGame.G.sim; sim.popSingle(sim.blocks[S.activeCore], 0.02); }")
    def run(sec): pg.evaluate(f"() => {{ for (let i = 0; i < {int(sec*60)}; i++) ChromaGame.tick(1/60, true); }}")
    run(1.2); s1=st(); chk('a los 1,2 s todavía no hay otro encendido', s1['hit'] == s0['hit'] + 1 and (s1['a'] == s0['a'] or not s1['lit']), s1)
    run(2.6); s2=st(); chk('a los 3,8 s ya hay otro encendido', s2['lit'] and s2['a'] != s0['a'], s2)
    b.close()
print('errores', errs[:3]); print('TODO BIEN' if all(ok) and not errs else 'FALLOS')
