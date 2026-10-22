# Juega unos tiros en cada mundo nuevo (arena, bola congelada, camaleón, magma, antigravedad) y derriba el objeto del cielo
from playwright.sync_api import sync_playwright
from PIL import Image
OUT='/home/claude/chroma3d/dist/shots/'
def ticks(pg,n,render=False): pg.evaluate(f"() => {{ for(let i=0;i<{n};i++) ChromaGame.tick(1/30, true); {'ChromaGame.render();' if render else ''} }}")
def ev(pg,js): return pg.evaluate(js)
SHOT = """() => { const s=ChromaGame.G.sim; if (!s.canFire()) return 'espera'; const live=s.liveBlocks(); const k=s.queue[0];
  let pool=live.filter(b=>b.userData.c===k && b.position.z>-0.5); if(!pool.length) pool=live.filter(b=>b.userData.c===k); if(!pool.length) pool=live;
  const b=pool[0]; s.fire(b.position.x, b.position.y, b.position.z+0.3); return k+'→'+(b.userData.kind==='block'?b.userData.c:b.userData.kind); }"""
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    pg=b.new_context(viewport={'width':390,'height':844}).new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.add_init_script("localStorage.setItem('rocketrush.lang','es')")
    pg.add_init_script("localStorage.setItem('chromacrash3d.v1', JSON.stringify({unlocked:100, seen:{bird:true,ship:true,c_desert:true,c_snow:true,c_jungle:true,c_volcano:true,c_space:true}}))")
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(1500); ev(pg,"() => ChromaGame.manual(true)")
    shots=[]
    for lv in [51, 61, 71, 81, 91]:
        ev(pg,f"() => {{ document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel({lv}, []); }}"); ticks(pg,40)
        ev(pg,"() => { ChromaGame.G.sim.events.length=0; window.__ev={}; const s=ChromaGame.G.sim; const orig=s.emit.bind(s); s.emit=e=>{ window.__ev[e.type]=(window.__ev[e.type]||0)+1; orig(e); }; }")
        log=[]
        for k in range(3):
            log.append(ev(pg,SHOT))
            for i in range(12):
                ticks(pg,4)
                if k==0 and i==3: ticks(pg,1,True); pg.screenshot(path=OUT+f'pl_{lv}.png')
            ticks(pg,20)
        # el objeto del cielo: aparece y se le dispara con adelanto
        ev(pg,"() => { const s=ChromaGame.G.sim; s.nextShip=0; }"); ticks(pg,2)
        hit=ev(pg,"""() => { const s=ChromaGame.G.sim, C=SimLib.C, m=s.movers.find(x=>x.kind==='ship' && x.active); if(!m) return 'no aparece'; const K=C.CARRIERS[m.carrier]; m.x=-m.dir*(m.xr-4);
          const bx=K.balls[0]; let tx=m.x, ty=m.y; for(let k=0;k<8;k++){ const L=s.launch(tx,ty,m.z); tx=m.x+m.dir*(m.speed*L.T+bx[0]*K.s); ty=m.y0-(K.slope?K.slope*m.dir*tx:0)+bx[1]*K.s; }
          s.queue.unshift('r'); s.sinceFire=99; s.balls.length=0; s.fire(tx,ty,m.z); return m.carrier; }""")
        for i in range(40):
            ticks(pg,3)
            if ev(pg,"() => ChromaGame.G.sim.movers.some(x=>x.kind==='ship' && x.hitT)"): break
        ticks(pg,6,True); pg.screenshot(path=OUT+f'plh_{lv}.png'); shots += [OUT+f'pl_{lv}.png', OUT+f'plh_{lv}.png']
        print(lv, ' '.join(log), '· eventos', ev(pg,"() => JSON.stringify(Object.fromEntries(Object.entries(window.__ev).filter(([k])=>['crumble','prize','cham','heat','erupt','group','moverHit'].includes(k))))"), '·', hit)
    print('errores', errs[:5]); b.close()
ims=[Image.open(f).convert('RGB').resize((195,422)) for f in shots]
s=Image.new('RGB',(195*len(ims),422))
for i,im in enumerate(ims): s.paste(im,(195*i,0))
s.save(OUT+'play_sheet.png')
