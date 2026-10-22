# Busca textos que siguen en español con el juego en otro idioma (python3 tools/i18n_missing.py [en])
import sys, re
from playwright.sync_api import sync_playwright
lang = sys.argv[1] if len(sys.argv) > 1 else 'en'
SP = re.compile(r'[áéíóúñ¡¿]|\b(de|la|el|los|las|una|un|para|con|tu|tus|nivel|niveles|bolas?|monedas|gemas?|racha|del|al|que|en|por|sin|se|más|ya|te|lo|su|hay|mundo|jefe|bloques?|cofre|pase|misiones|tienda|ajustes|amigos?|premio|gratis|toca|derriba|consigue|supera|usa|mira|cañón|pájaro|barco|día|días)\b', re.I)
found = {}
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 390, 'height': 844}).new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script(f"localStorage.setItem('rocketrush.lang','{lang}')")
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2000)
    pg.evaluate("() => ChromaGame.manual(true)")
    def grab(tag):
        txt = pg.evaluate("""() => { const out=[]; const w=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
          while((n=w.nextNode())){ const p=n.parentNode; if(!p||p.nodeName==='SCRIPT'||p.nodeName==='STYLE') continue; const t=n.nodeValue.trim(); if(t) out.push(t); }
          for (const e of document.querySelectorAll('[aria-label],[title],[placeholder]')) for (const a of ['aria-label','title','placeholder']) if(e.getAttribute(a)) out.push(e.getAttribute(a));
          return out; }""")
        for t in txt:
            if SP.search(t) and t not in found: found[t] = tag
    E = lambda js: pg.evaluate("() => { try { " + js + " } catch(e) { return String(e); } }")
    T = lambda n: pg.evaluate(f"() => {{ for(let i=0;i<{n};i++) ChromaGame.tick(1/30,true); }}")
    grab('portada')
    for scr in ['map', 'pass', 'missions', 'shop', 'settings', 'daily']:
        E("document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); document.getElementById('" + scr + "').classList.add('on');")
        E({'map': "document.getElementById('btnPlay').click()", 'pass': "document.getElementById('btnPassT').click()", 'missions': "document.getElementById('btnMisT').click()", 'shop': "document.getElementById('btnShopT').click()", 'settings': "document.getElementById('btnSetT').click()", 'daily': "document.getElementById('btnDailyT') && document.getElementById('btnDailyT').click()"}[scr])
        pg.wait_for_timeout(400); grab(scr)
    for lid in [1, 2, 5, 12, 20, 51, 82, 84, 207, 520, 1001 if False else 9]:
        E(f"document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); document.querySelector('.lv[data-id=\"{lid}\"]') ; ChromaGame.startLevel({lid}, [])")
        pg.wait_for_timeout(300); T(60); grab(f'nivel {lid}')
        E("const s=ChromaGame.G.sim; const k=s.queue[0]; const t=s.liveBlocks().find(b=>b.userData.c===k)||s.liveBlocks()[0]; if(t){ s.sinceFire=9; s.fire(t.position.x,t.position.y,t.position.z); }")
        T(90); grab(f'nivel {lid} tiro')
    # ventana del nivel, victoria y derrota
    E("ChromaGame.save().unlocked=30; document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); document.getElementById('btnPlay').click()"); pg.wait_for_timeout(300)
    E("document.getElementById('daily').classList.remove('on'); document.querySelector('.lv[data-id=\"12\"]').click()"); pg.wait_for_timeout(400); grab('ventana nivel')
    E("document.getElementById('preGo').click()"); T(60)
    E("const s=ChromaGame.G.sim; s.goalReached=true; s.finish();"); T(120); pg.wait_for_timeout(300); grab('victoria')
    E("document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(13, []);"); T(40)
    E("const s=ChromaGame.G.sim; s.queue.length=0; s.balls.length=0;"); T(200); pg.wait_for_timeout(300); grab('derrota')
    for t, tag in sorted(found.items(), key=lambda x: x[1]): print(f'[{tag}] {t}')
    print('total', len(found), 'errores', errs[:3])
    b.close()
