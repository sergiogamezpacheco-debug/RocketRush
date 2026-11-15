# Prueba: el teleférico, globo, mono, dragón y ovni se alcanzan tocando hasta ~35 px por encima o por debajo (franja de ±6 % de la pantalla)
# Toque 35 px por debajo / encima del objeto (fuera de la franja vieja), adelantado: ¿le da?
from playwright.sync_api import sync_playwright
def ev(pg,js,a=None): return pg.evaluate(js,a) if a is not None else pg.evaluate(js)
res=[]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    pg=b.new_context(viewport={'width':390,'height':844}).new_page()
    pg.add_init_script("window.RR_AGE = 30; localStorage.setItem('rocketrush.lang','es')")
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(1500)
    ev(pg,"() => ChromaGame.manual(true)")
    for biome,id in [('snow',52),('jungle',83),('desert',21),('volcano',114),('space',145)]:
      for off in [-35, 35, 0]:
        ev(pg,"(id) => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(id, []); }", id)
        ev(pg,"() => { for(let i=0;i<40;i++) ChromaGame.tick(1/30,true); const s=ChromaGame.G.sim; s.nextBird=999; s.nextShip=0; }")
        for i in range(400):
            ev(pg,"() => { for(let i=0;i<3;i++) ChromaGame.tick(1/30,true); }")
            if ev(pg,"() => { const m=ChromaGame.G.sim.movers.find(x=>x.kind==='ship'&&x.active); return !!m && Math.abs(m.x) < 14 && m.x*m.dir < 0; }"): break
        pt = ev(pg,"""(off) => { const G=ChromaGame.G, s=G.sim, m=s.movers.find(x=>x.kind==='ship'&&x.active), cam=ChromaGame.camera;
          const cy={desert:0.92,snow:-0.12,jungle:-1.45,volcano:-0.66,space:0.32}[m.carrier]+m.y; let tx=m.x; for(let k=0;k<6;k++){ const L=s.launch(tx,cy,m.z); tx=m.x+m.dir*m.speed*L.T; }
          const v=new THREE.Vector3(tx,cy,m.z).project(cam); const px=(v.x*.5+.5)*innerWidth, py=(-v.y*.5+.5)*innerHeight+off;
          const t=ChromaGame.pickTarget(px,py); if(!t) return null; let x2=m.x; for(let k=0;k<6;k++){ const L=s.launch(x2,t.y,m.z); x2=m.x+m.dir*m.speed*L.T; } s.queue[0]='r'; s.sinceFire=9; s.fire(x2,t.y,t.z); return [px,py,t.z]; }""", off)
        hit=False
        for i in range(80):
            ev(pg,"() => { for(let i=0;i<2;i++) ChromaGame.tick(1/30,true); }")
            if ev(pg,"() => ChromaGame.G.sim.movers.some(x=>x.kind==='ship' && x.hitT)"): hit=True; break
        res.append((biome,off,hit, None if not pt else round(pt[2],1)))
    b.close()
for r in res: print(r)
