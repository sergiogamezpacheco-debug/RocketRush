# Evento de Navidad de principio a fin: se enciende desde la configuración en directo (como el panel), portada con el árbol
# y el trineo, botón «Navidad» del mapa, mapa-calendario de Adviento, partida con regalos (caramelos y bastones), recoger
# un regalo, los tres jefes con su aspecto navideño, tienda de Navidad y apagado.
import time, sys
from playwright.sync_api import sync_playwright
OUT = '/home/claude/chroma3d/dist/shots/'
NOW = int(time.time() * 1000)
ON = {'xm': {'on': True, 'start': NOW - 1000, 'end': NOW + 30 * 86400000}, 'hw': {'on': False}}
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True).new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script("window.RR_LIVE_OFF = true; window.RR_AGE = 30; localStorage.setItem('rocketrush.lang','es')")
    pg.route('**/*googleapis.com/**', lambda r: r.abort())
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2500)
    pg.evaluate("() => document.getElementById('daily').classList.remove('on')")
    print('antes de encenderlo (fechas por defecto, 1 dic):', pg.evaluate("() => RRGame.xm.active()"))
    pg.evaluate("c => Live.set(c)", ON); pg.wait_for_timeout(1500)
    print('portada:', pg.evaluate("() => [RRGame.xm.active(), ChromaGame.G.xmWorld, !document.getElementById('xmTree').hidden, document.querySelector('#xmTree .xmcdTxt').textContent, document.getElementById('title').classList.contains('xm')]"))
    pg.wait_for_timeout(2500); pg.screenshot(path=OUT + 'xm_title.png')
    pg.evaluate("() => RRGame.goMap()"); pg.wait_for_timeout(600)
    print('botón del mapa:', pg.evaluate("() => [!document.getElementById('navXm').hidden, document.querySelector('#navXm b').textContent]"))
    pg.screenshot(path=OUT + 'xm_mapnav.png')
    pg.click('#navXm'); pg.wait_for_timeout(800)
    print('calendario:', pg.evaluate("() => [document.getElementById('xmmap').classList.contains('on'), document.querySelectorAll('#xmList .xhouse').length, document.querySelectorAll('#xmList .xwin').length, document.querySelectorAll('#xmList .xwin.door').length, document.querySelector('#xmList .xwin.cur') && document.querySelector('#xmList .xwin.cur').textContent]"))
    pg.screenshot(path=OUT + 'xm_map.png')
    # partida 1: regalos con premio
    pg.evaluate("() => { ChromaGame.manual(true); document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(30001, []); for (let i=0;i<120;i++) ChromaGame.tick(1/30, true); }")
    st = pg.evaluate("() => { const G = ChromaGame.G; return [G.level.biome, (G.xgifts||[]).length, (G.xgifts||[]).map(g=>g.n), !document.getElementById('xcandyChip').hidden, document.getElementById('hudLevel').textContent]; }")
    print('partida:', st)
    pg.evaluate("() => { document.getElementById('hint').style.display='none'; ChromaGame.render(); }"); pg.screenshot(path=OUT + 'xm_play.png')
    c0 = pg.evaluate("() => RRGame.save.xcandy || 0")
    got = pg.evaluate("""() => { const G = ChromaGame.G, g = G.xgifts[0], n = g.n, b = G.sim.blocks[g.id]; b.userData.alive = false; for (let i=0;i<3;i++) ChromaGame.tick(1/30, true); return [n, RRGame.save.xcandy, G.xgifts.length]; }""")
    print('regalo roto: vale', got[0], '· caramelos', c0, '->', got[1], '· quedan', got[2])
    # el pájaro: trineo
    sl = pg.evaluate("""() => { const G = ChromaGame.G, s = G.sim; s.nextBird = 0; for (let i=0;i<20;i++) ChromaGame.tick(1/30, true); const m = s.movers.find(m=>m.kind==='bird'); const g = m && G.moverMeshes.get(m.id); return [!!m, !!(g && g.userData.deer)]; }""")
    print('el pájaro es el trineo:', sl)
    # jefes
    for lid in (30010, 30020, 30030):
        pg.evaluate(f"() => {{ ChromaGame.startLevel({lid}, []); for (let i=0;i<200;i++) ChromaGame.tick(1/30, true); document.getElementById('bossIntro').classList.remove('on'); }}")
        info = pg.evaluate("() => { const S = Bosses.state(), G = ChromaGame.G; return [S && S.key, document.getElementById('bbName').textContent, (G.xgifts||[]).length, G.sim.blocks.filter(b => { const m = G.meshes[b.userData.id]; let w = false; if (m) m.traverse(o => { if (o.isMesh && o.material && o.material.map && o.material.map.image && o.material.color && o.material.color.getHex() === 0xffffff && b.userData.kind==='block') w = true; }); return w; }).length]; }")
        print('jefe', lid, info)
        pg.evaluate("() => { for (let i=0;i<30;i++) ChromaGame.tick(1/30, true); ChromaGame.render(); }"); pg.screenshot(path=OUT + f'xm_boss{lid}.png')
    # tienda
    pg.evaluate("() => { Bosses.stop(); ChromaGame.manual(false); RRGame.goMap(); RRGame.save.xcandy = 500; RRGame.openShop('xm'); }"); pg.wait_for_timeout(700)
    print('tienda:', pg.evaluate("() => [!!document.getElementById('sXm'), document.querySelectorAll('[data-xm]').length, !!document.querySelector('.stabs .xmtab')]"))
    pg.screenshot(path=OUT + 'xm_shop.png')
    pg.click('[data-xm=xskin]'); pg.wait_for_timeout(400)
    print('cañón bastón:', pg.evaluate("() => [RRGame.save.skins.owned.includes('candycane'), RRGame.save.skins.equip, RRGame.save.xcandy]"))
    # apagado desde el panel
    pg.evaluate("() => { document.getElementById('shop').classList.remove('on'); RRGame.goTitle(); }")
    pg.evaluate("c => Live.set(c)", {'xm': {'on': False}}); pg.wait_for_timeout(1200)
    print('apagado:', pg.evaluate("() => [RRGame.xm.active(), document.getElementById('xmTree').hidden, ChromaGame.G.xmWorld]"))
    print('errores', errs[:5]); b.close()
