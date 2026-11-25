# 25-11: Torre sin fin y botón «Retos». Se empieza la torre, se derriba el piso, cae otro con más bolas, y al
# quedarse sin bolas sale el resultado (piso, récord, premio) en vez de «¡CASI!».
from playwright.sync_api import sync_playwright
OUT='/home/claude/chroma3d/dist/shots/'; errs=[]; ok=[]
def chk(n, c, x=''): ok.append(bool(c)); print('OK ' if c else 'MAL', n, x)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    pg=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2).new_page(); pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.add_init_script("window.RR_AGE = 30; window.RR_LIVE_OFF = true; window.RR_NO_INTRO = true; localStorage.setItem('rocketrush.lang','es'); localStorage.setItem('chromacrash3d.v1', JSON.stringify({unlocked: 60, played: 30, birthYear: 1990, coins: 100, tut: {main: true, tips: {daily: 1, club: 1, shop: 1}}}))")
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(3000)
    pg.evaluate("() => { document.getElementById('daily').classList.remove('on'); }")
    chk('botón Retos en la portada', pg.evaluate("() => !!document.getElementById('btnRetosT')"))
    pg.evaluate("() => document.getElementById('btnRetosT').click()"); pg.wait_for_timeout(600)
    chk('ventana de retos con desafío y torre', pg.evaluate("() => document.getElementById('retosPop').classList.contains('on') && !!document.getElementById('rtWk') && !!document.getElementById('rtTw')"))
    pg.screenshot(path=OUT+'retos.png', timeout=90000)
    pg.evaluate("() => document.getElementById('rtTw').click()"); pg.wait_for_timeout(2000)
    st=pg.evaluate("() => ({ endless: !!ChromaGame.G.level.endless, floor: Torre.state && Torre.state.floor, q: ChromaGame.G.sim.queue.length, hud: document.getElementById('meterPct').textContent })")
    chk('empieza la torre en el piso 1', st['endless'] and st['floor'] == 1 and 'PISO 1' in st['hud'], st)
    pg.screenshot(path=OUT+'torre_1.png', timeout=90000)
    st=pg.evaluate("() => { const s = ChromaGame.G.sim; const lv = s.liveBlocks(); return { n: lv.length, fixed: lv.every(b => b.type === CANNON.Body.STATIC), ship: s.nextShip > 1e8 }; }")
    chk('pared de 7×8 bloques fijos (no se caen) y sin ovni', st['n'] == 56 and st['fixed'] and st['ship'], st)
    # reventar 30 bloques: se rellena por arriba, sube al piso 2 y llegan bolas
    q0=st0=pg.evaluate("() => ChromaGame.G.sim.queue.length")
    pg.evaluate("() => { ChromaGame.manual(true); const s = ChromaGame.G.sim; const lv = s.liveBlocks().filter(b => b.userData.kind === 'block'); lv.slice(0, 30).forEach(o => s.popSingle(o, 0)); }")
    pg.evaluate("() => { for (let i = 0; i < 240; i++) ChromaGame.tick(1/60, true); }")
    st=pg.evaluate("""() => { const s = ChromaGame.G.sim, lv = s.liveBlocks(); const cells = new Set(lv.map(b => Math.round(b.position.x + 3) + ',' + Math.round(b.position.y - 0.5)));
      return { floor: Torre.state && Torre.state.floor, q: s.queue.length, n: lv.length, cells: cells.size, maxY: Math.max(...lv.map(b => b.position.y)), hud: document.getElementById('meterPct').textContent }; }""")
    chk('la torre se rellena (56 bloques en su sitio)', st['n'] == 56 and st['cells'] == 56 and st['maxY'] < 7.6, st)
    chk('piso 2 y bolas ganadas', st['floor'] == 2 and st['q'] > q0 and 'PISO 2' in st['hud'], st)
    pg.evaluate("() => { ChromaGame.manual(false); }"); pg.wait_for_timeout(1500)
    pg.screenshot(path=OUT+'torre_2.png', timeout=90000)
    # sin bolas: resultado
    pg.evaluate("() => { ChromaGame.manual(true); const s = ChromaGame.G.sim; s.queue.length = 0; }")
    pg.evaluate("() => { for (let i = 0; i < 900; i++) { ChromaGame.tick(1/60, true); if (document.getElementById('torrePop') && document.getElementById('torrePop').classList.contains('on')) break; } }")
    res=pg.evaluate("() => ({ pop: !!document.getElementById('torrePop') && document.getElementById('torrePop').classList.contains('on'), lose: document.getElementById('lose').classList.contains('on'), best: Torre.best(), coins: RRGame.save.coins, txt: document.getElementById('tpBody') && document.getElementById('tpBody').textContent.slice(0, 80) })")
    chk('al acabarse las bolas sale el resultado de la torre (no «¡CASI!»)', res['pop'] and not res['lose'], res)
    chk('récord piso 2 y premio en monedas', res['best'] >= 2 and res['coins'] > 100, res)
    pg.evaluate("() => ChromaGame.manual(false)"); pg.wait_for_timeout(600)
    pg.screenshot(path=OUT+'torre_fin.png', timeout=90000)
    # un nivel normal después: vuelve a decir DEMOLICIÓN
    pg.evaluate("() => { document.getElementById('torrePop').classList.remove('on'); ChromaGame.startLevel(5, []); }"); pg.wait_for_timeout(600)
    chk('un nivel normal vuelve a «DEMOLICIÓN»', pg.evaluate("() => !ChromaGame.G.level.endless && /%/.test(document.getElementById('meterPct').textContent) && /DEMOLICI/.test(document.querySelector('.meterlabel small').textContent)"))
    b.close()
print('errores', errs[:3]); print('TODO BIEN' if all(ok) and not errs else 'FALLOS')
