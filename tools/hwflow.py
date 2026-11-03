# Evento de Halloween: portada con castillo (sin bloques), mapa de 50 niveles, partida con caramelos, victoria y tienda
import sys
from playwright.sync_api import sync_playwright
OUT = '/home/claude/chroma3d/dist/shots/'
def ticks(pg, n): pg.evaluate(f"() => {{ for(let i=0;i<{n};i++) ChromaGame.tick(1/30, true); ChromaGame.render(); }}")
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True).new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script("window.RR_AGE = 30; localStorage.setItem('rocketrush.lang','es')")
    pg.add_init_script("if(!sessionStorage.g){sessionStorage.g=1;localStorage.setItem('chromacrash3d.v1', JSON.stringify({unlocked:23, coins:1250, gems:14, candy: 500, hwForce: true}))}")
    pg.route('**/*googleapis.com/**', lambda r: r.abort())
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2500)
    pg.evaluate("() => { document.getElementById('daily').classList.remove('on'); RRGame.goTitle(); ChromaGame.manual(true); }")
    ticks(pg, 90)
    print('portada: calabaza visible', pg.evaluate("() => !document.getElementById('hwPump').hidden"), '· cuenta atrás', pg.evaluate("() => document.querySelector('#hwPump .hwcdTxt').textContent"),
          '· bloques visibles', pg.evaluate("() => ChromaGame.G.meshes.filter(m => m && m.visible).length"), '· modo', pg.evaluate("() => ChromaGame.G.hwWorld"))
    pg.screenshot(path=OUT + 'hw_title.png')
    # mapa de mundos: fila de 3 botones; abrir Halloween
    pg.click('#btnPlay'); pg.wait_for_timeout(300); ticks(pg, 5)
    print('mapa: botón Halloween', pg.evaluate("() => !document.getElementById('navHw').hidden"))
    pg.screenshot(path=OUT + 'hw_map.png')
    pg.click('#navHw'); pg.wait_for_timeout(300); ticks(pg, 30)
    print('mapa Halloween: niveles', pg.evaluate("() => document.querySelectorAll('#hwList .hwlv').length"), '· abiertos', pg.evaluate("() => document.querySelectorAll('#hwList .hwlv:not(.lk)').length"))
    pg.screenshot(path=OUT + 'hw_world.png')
    # nivel 1 de Halloween
    pg.evaluate("() => document.querySelector('#hwList .hwlv.cur').click()"); pg.wait_for_timeout(300)
    print('ficha:', pg.evaluate("() => document.getElementById('preTitle').textContent + ' · ' + document.getElementById('preName').textContent"))
    pg.click('#preGo'); pg.wait_for_timeout(300); ticks(pg, 60)
    print('partida: caramelos puestos', pg.evaluate("() => ChromaGame.G.candies.length"), '· chip', pg.evaluate("() => !document.getElementById('candyChip').hidden"), '· hud', pg.evaluate("() => document.getElementById('hudLevel').textContent"))
    c0 = pg.evaluate("() => RRGame.save.candy")
    # tumbar un bloque con caramelo: se quita a mano para simular que revienta
    pg.evaluate("() => { const G=ChromaGame.G, c=G.candies[0], b=G.sim.blocks[c.id]; b.userData.alive=false; }"); ticks(pg, 3)
    print('caramelos tras romper un bloque con caramelo:', c0, '→', pg.evaluate("() => RRGame.save.candy"))
    pg.evaluate("() => { const s=ChromaGame.G.sim; s.nextBird=0; }"); ticks(pg, 100)
    pg.screenshot(path=OUT + 'hw_play.png')
    # ganar: victoria con caramelos y botón siguiente
    pg.evaluate("() => { const s=ChromaGame.G.sim; for (const b of s.liveBlocks()) { b.userData.alive=false; } s.popped = s.total; s.goalReached = true; s.finish(); }")
    for i in range(12): ticks(pg, 20)
    print('victoria:', pg.evaluate("() => document.getElementById('win').classList.contains('on')"), pg.evaluate("() => document.getElementById('winCoins').textContent"), '· siguiente:', pg.evaluate("() => document.getElementById('winNext').textContent"),
          '· abiertos Halloween:', pg.evaluate("() => RRGame.save.hw.unlocked"), '· mundo normal sin tocar:', pg.evaluate("() => RRGame.save.unlocked"))
    pg.click('#winMap'); pg.wait_for_timeout(400); ticks(pg, 5)
    pg.wait_for_timeout(3500); ticks(pg, 5)
    print('vuelve al mapa de Halloween:', pg.evaluate("() => document.getElementById('hwmap').classList.contains('on')"), pg.evaluate("() => [...document.querySelectorAll('.screen.on')].map(s=>s.id).join(',')"))
    # tienda de Halloween: comprar los avatares y el cañón
    pg.click('#hwShop'); pg.wait_for_timeout(300)
    print('tienda: pestaña', pg.evaluate("() => !!document.querySelector('#shopTabs .hwtab')"), '· artículos', pg.evaluate("() => document.querySelectorAll('.hwitem').length"))
    pg.screenshot(path=OUT + 'hw_shop.png')
    pg.click('button[data-hw=hav]'); pg.wait_for_timeout(200); pg.click('button[data-hw=hskin]'); pg.wait_for_timeout(200)
    print('compras: avatares', pg.evaluate("() => RRGame.save.hwAvatars"), '· cañón', pg.evaluate("() => RRGame.save.skins.equip"), '· caramelos', pg.evaluate("() => RRGame.save.candy"))
    pg.click('button[data-hw=hgems]'); pg.wait_for_timeout(200)
    print('sin caramelos suficientes:', pg.evaluate("() => document.getElementById('toast').textContent"))
    print('errores', errs[:5]); b.close()
