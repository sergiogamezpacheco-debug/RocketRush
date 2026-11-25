# 25-11: jefes nuevos (Maese Brochazo, Grúa Mordisco, Nimbo): se ven, y acertar en su punto débil les quita vidas
from playwright.sync_api import sync_playwright
OUT='/home/claude/chroma3d/dist/shots/'; errs=[]; ok=[]
def chk(n, c, x=''): ok.append(bool(c)); print('OK ' if c else 'MAL', n, x)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    def page():
        pg=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2).new_page(); pg.on('pageerror',lambda e: errs.append(str(e)))
        pg.add_init_script("window.RR_AGE = 30; window.RR_LIVE_OFF = true; window.RR_NO_INTRO = true; localStorage.setItem('rocketrush.lang','es'); localStorage.setItem('chromacrash3d.v1', JSON.stringify({unlocked: 1100, played: 300, birthYear: 1990, seenDebut: {pb:1,cv:1,cb:1,bt:1}, tut: {main: true, tips: {daily: 1, club: 1, shop: 1}}}))")
        pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2500); return pg
    run=lambda pg, sec: pg.evaluate(f"() => {{ for (let i = 0; i < {int(sec*60)}; i++) ChromaGame.tick(1/60, true); }}")
    fire=lambda pg, expr: pg.evaluate("(e) => { const S = Bosses.state(), sim = ChromaGame.G.sim, v = new THREE.Vector3(); (0, eval)(e).getWorldPosition(v); sim.sinceFire = 9; sim.fire(v.x, v.y, v.z); return [v.x, v.y, v.z].map(n => +n.toFixed(2)); }", expr)
    # --- Maese Brochazo
    pg=page()
    pg.evaluate("() => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(578, []); }"); pg.wait_for_timeout(3500)
    st=pg.evaluate("() => { const S = Bosses.state(); return S && { key: S.key, lives: S.livesLeft, want: S.want }; }")
    chk('Brochazo empieza con 3 vidas', st and st['key'] == 'brush' and st['lives'] == 3, st)
    pg.screenshot(path=OUT+'jefe_brochazo.png', timeout=90000)
    pg.evaluate("() => ChromaGame.manual(true)")
    for k in range(3):
        pg.evaluate("() => { const S = Bosses.state(), sim = ChromaGame.G.sim; sim.queue.unshift(S.want); }")
        fire(pg, "Bosses.state().hit"); run(pg, 3.5)
    st=pg.evaluate("() => { const S = Bosses.state(); return S && { lives: S.livesLeft, done: S.done }; }")
    chk('Brochazo: 3 aciertos con su color = derrotado', st and st['lives'] == 0, st)
    pg.close()
    # --- Grúa Mordisco
    pg=page()
    pg.evaluate("() => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(640, []); }"); pg.wait_for_timeout(3500)
    pg.screenshot(path=OUT+'jefe_grua.png', timeout=90000)
    pg.evaluate("() => ChromaGame.manual(true)")
    fire(pg, "Bosses.state().cabHit"); run(pg, 3.5)
    chk('Grúa: la cabina es inmune si no está aturdida', pg.evaluate("() => Bosses.state().livesLeft") == 3)
    fire(pg, "Bosses.state().crateHit"); run(pg, 4)
    st=pg.evaluate("() => { const S = Bosses.state(); return { crate: S.crate, stun: S.stun }; }")
    chk('Grúa: el contenedor cae y la aturde', st['crate'] == 'gone' and st['stun'] > 0, st)
    fire(pg, "Bosses.state().cabHit"); run(pg, 3.5)
    chk('Grúa: aturdida, la cabina le quita una vida', pg.evaluate("() => Bosses.state().livesLeft") == 2)
    pg.evaluate("() => ChromaGame.manual(false)"); pg.wait_for_timeout(800); pg.screenshot(path=OUT+'jefe_grua_2.png', timeout=90000)
    pg.close()
    # --- Nimbo
    pg=page()
    pg.evaluate("() => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(950, []); }"); pg.wait_for_timeout(3500)
    pg.screenshot(path=OUT+'jefe_nimbo.png', timeout=90000)
    pg.evaluate("() => ChromaGame.manual(true)")
    fire(pg, "Bosses.state().hit"); run(pg, 3.5)
    chk('Nimbo: sin cargar, el pararrayos no le hace nada', pg.evaluate("() => Bosses.state().livesLeft") == 3)
    pg.evaluate("() => { const S = Bosses.state(); S.charging = true; S.chargeShots = 0; }")
    fire(pg, "Bosses.state().hit"); run(pg, 3.5)
    chk('Nimbo: cargando, el pararrayos le devuelve el rayo', pg.evaluate("() => Bosses.state().livesLeft") == 2)
    # rayo: electrifica 2 bloques
    pg.evaluate("() => { const S = Bosses.state(); S.charging = true; S.chargeShots = 1; }")
    pg.evaluate("() => { const sim = ChromaGame.G.sim, b = sim.liveBlocks().find(o => o.userData.kind === 'block'); sim.sinceFire = 9; sim.fire(b.position.x, b.position.y, b.position.z + 0.4); }"); run(pg, 4)
    chk('Nimbo: si no le das a tiempo, electrifica 2 bloques', pg.evaluate("() => Bosses.state().cages.length") == 2)
    pg.evaluate("() => ChromaGame.manual(false)"); pg.wait_for_timeout(800); pg.screenshot(path=OUT+'jefe_nimbo_2.png', timeout=90000)
    pg.close()
    b.close()
print('errores', errs[:3]); print('TODO BIEN' if all(ok) and not errs else 'FALLOS')
