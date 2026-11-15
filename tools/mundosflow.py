# Paisajes nuevos (huerto, arrecife, juguetería y dinosaurios): capturas de una partida en cada uno con su objeto del cielo,
# y que el objeto del cielo se alcanza (con python3 tools/mundosflow.py [paisaje ...])
import sys
from playwright.sync_api import sync_playwright
OUT='/home/claude/chroma3d/dist/shots/'; errs=[]; res=[]
W={'orchard':58,'reef':70,'dino':79,'toys':83}
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    for k in (sys.argv[1:] or list(W)):
        pg=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2).new_page(); pg.on('pageerror',lambda e: errs.append(str(e)))
        pg.add_init_script("window.RR_AGE = 30; window.RR_LIVE_OFF = true; window.RR_NO_INTRO = true; localStorage.setItem('rocketrush.lang','es'); localStorage.setItem('chromacrash3d.v1', JSON.stringify({unlocked: 1023, played: 30, birthYear: 1990, coins: 4200, gems: 35, tut: {main: true, tips: {daily: 1, club: 1, shop: 1}}}))")
        pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2500)
        pg.evaluate("() => ChromaGame.manual(true)")
        id=pg.evaluate("(w) => ChromaGame.LEVELS.find(l => l.world === w && !l.boss).id", W[k])
        info=pg.evaluate("(id) => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(id, []); const L=ChromaGame.G.level; return [L.id, L.name, L.biome, L.weather]; }", id)
        pg.evaluate("() => { for(let i=0;i<40;i++) ChromaGame.tick(1/30,true); const s=ChromaGame.G.sim; s.nextBird=999; s.nextShip=0; }")
        for i in range(400):
            pg.evaluate("() => { for(let i=0;i<3;i++) ChromaGame.tick(1/30,true); }")
            if pg.evaluate("() => { const m=ChromaGame.G.sim.movers.find(x=>x.kind==='ship'&&x.active); return !!m && Math.abs(m.x) < 4; }"): break
        
        pg.evaluate("() => { ChromaGame.tick(1/30,true); ChromaGame.render(); }"); pg.screenshot(path=OUT+f'mundo_{k}.png')
        car=pg.evaluate("() => { const m=ChromaGame.G.sim.movers.find(x=>x.kind==='ship'); return m ? m.carrier : null; }")
        # disparo adelantado (toque 30 px por debajo del objeto), cuando la estructura no tapa el punto adelantado
        for i in range(120):
            if pg.evaluate("""() => { const s=ChromaGame.G.sim, m=s.movers.find(x=>x.kind==='ship'&&x.active); if(!m) return true; const cam=ChromaGame.camera;
              let tx=m.x; for(let k=0;k<6;k++){ const L=s.launch(tx,m.y,m.z); tx=m.x+m.dir*m.speed*L.T; }
              const v=new THREE.Vector3(tx,m.y,m.z).project(cam); if (Math.abs(v.x) > 0.9) return false; const t=ChromaGame.pickTarget((v.x*.5+.5)*innerWidth,(-v.y*.5+.5)*innerHeight+30); return !!t && Math.abs(t.z-m.z) < 0.5; }"""): break
            pg.evaluate("() => ChromaGame.tick(1/30,true)")
        pg.evaluate("""() => { const s=ChromaGame.G.sim, m=s.movers.find(x=>x.kind==='ship'&&x.active); if(!m) return; const cam=ChromaGame.camera;
          let tx=m.x; for(let k=0;k<6;k++){ const L=s.launch(tx,m.y,m.z); tx=m.x+m.dir*m.speed*L.T; }
          const v=new THREE.Vector3(tx,m.y,m.z).project(cam); const t=ChromaGame.pickTarget((v.x*.5+.5)*innerWidth,(-v.y*.5+.5)*innerHeight+30);
          let x2=m.x; for(let k=0;k<6;k++){ const L=s.launch(x2,t.y,m.z); x2=m.x+m.dir*m.speed*L.T; } s.queue[0]="r"; s.sinceFire=9; s.fire(x2,t.y,t.z); window.__shot=[m.x,m.y,m.z,t.y,t.z,x2,m.speed]; }""")
        hit=False
        for i in range(80):
            pg.evaluate("() => { for(let i=0;i<2;i++) ChromaGame.tick(1/30,true); }")
            if pg.evaluate("() => ChromaGame.G.sim.movers.some(x=>x.kind==='ship' && x.hitT)"): hit=True; break
        res.append((k, info, car, hit)); print(k, info, 'objeto:', car, 'alcanzado:', hit, [round(v,2) for v in (pg.evaluate('() => window.__shot') or [])])
        pg.close()
    b.close()
print('errores', errs[:3]); print('TODO BIEN' if all(r[3] and r[2]==r[0] for r in res) and not errs else 'FALLOS')
