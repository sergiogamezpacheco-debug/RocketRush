# Jefe faraón: romper el escudo con su color, golpear la máscara 3 veces, reconstrucción con arena y victoria (python3 tools/pharaohflow.py)
import json
from playwright.sync_api import sync_playwright
OUT='/home/claude/chroma3d/dist/shots/'
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    pg=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True).new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2000)
    pg.evaluate("() => ChromaGame.manual(true)")
    lid=pg.evaluate("() => ChromaGame.LEVELS.find(l=>l.boss==='pyramid').id")
    pg.evaluate(f"() => {{ document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel({lid}, []); }}")
    T=lambda n: pg.evaluate(f"() => {{ for(let i=0;i<{n};i++) ChromaGame.tick(1/30, true); ChromaGame.render(); }}")
    T(5); pg.screenshot(path=OUT+'ph_0_intro.png'); T(110)
    pg.screenshot(path=OUT+'ph_1_inicio.png')
    info=lambda: pg.evaluate("() => { const S=Bosses.state(), s=ChromaGame.G.sim; return {hp:Math.round(S.hp*100), hits:S.hits, prog:S.prog, open:S.open, esc:S.shieldC, sig:S.nextC, tiros:s.shots, cola:s.queue.join(''), vivos:s.liveBlocks().length, estado:s.state, modo:ChromaGame.G.mode, sub:document.getElementById('bbSub').textContent}; }")
    print('inicio', info())
    # disparar: al bloque del color del escudo con su color, o a la máscara si está abierta
    fire = """(useMask) => { const S=Bosses.state(), s=ChromaGame.G.sim; if(!s.canFire()) return 'no';
      if (S.open || useMask) { s.queue[0]=s.queue[0]||'r'; const m=S.mask.position; s.fire(m.x, m.y, m.z+0.6); return 'mask'; }
      const t=s.liveBlocks().filter(b=>b.userData.kind==='block'&&b.userData.c===S.shieldC&&!b.userData.popping).sort((a,b)=>b.position.z-a.position.z)[0];
      if(!t) return 'none'; s.queue[0]=S.shieldC; s.fire(t.position.x,t.position.y,t.position.z); return 'block '+S.shieldC; }"""
    shots=0; shot_mask_closed=False
    for k in range(40):
        st=info()
        if st['estado']!='play' or st['hp']<=0: break
        if not st['open'] and not shot_mask_closed and k==0:
            r=pg.evaluate(f"({fire})(true)"); shot_mask_closed=True   # con el escudo puesto: tiene que rebotar
        else: r=pg.evaluate(f"({fire})(false)")
        pg.evaluate("() => { const s=ChromaGame.G.sim; while(s.queue.length<4) s.queue.push('r'); }")
        T(150); shots+=1
        st=info(); print(k, r, st)
        if st['open'] and not any(f.startswith('ph_2') for f in []): pg.screenshot(path=OUT+f'ph_2_abierto_{st["hits"]}.png')
        if r=='mask': pg.screenshot(path=OUT+f'ph_3_tras_mascara_{st["hits"]}.png')
    T(120); st=info(); print('final', st)
    pg.screenshot(path=OUT+'ph_4_final.png')
    print('errores', errs[:5])
    b.close()
