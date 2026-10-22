# Pájaro y barco: aparecen, se ven, se apunta por delante con el dedo y al darles suman 2 bolas
from playwright.sync_api import sync_playwright
from PIL import Image
OUT='/home/claude/chroma3d/dist/shots/'
def ticks(pg,n,render=False): pg.evaluate(f"() => {{ for(let i=0;i<{n};i++) ChromaGame.tick(1/30, true); {'ChromaGame.render();' if render else ''} }}")
def ev(pg,js): return pg.evaluate(js)
LEAD="""(kind) => { const s=ChromaGame.G.sim, m=s.movers.find(x=>x.kind===kind && x.active); if(!m) return null;
  const cy = kind==="bird"? m.y0 : m.y0+1.9*SimLib.C.SHIP_S; let tx=m.x; for(let k=0;k<5;k++){ const L=s.launch(tx,cy,m.z); tx=m.x+m.dir*m.speed*L.T; }
  const v=new THREE.Vector3(tx,cy,m.z).project(ChromaGame.camera); return [(v.x*0.5+0.5)*innerWidth, (-v.y*0.5+0.5)*innerHeight, m.x, tx]; }"""
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    pg=b.new_context(viewport={'width':390,'height':844}).new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.add_init_script("localStorage.setItem('rocketrush.lang','es')")
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(1500)
    ev(pg,"() => ChromaGame.manual(true)")
    for kind in ['bird','ship']:
        ev(pg,"() => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(" + ('3' if kind=='bird' else '1') + ", []); }"); ticks(pg,40)
        ev(pg,f"() => {{ const s=ChromaGame.G.sim; s.nextBird = {'0' if kind=='bird' else '999'}; s.nextShip = {'0' if kind=='ship' else '999'}; }}")
        # esperar a que entre en pantalla
        CLEAR = """(kind) => { const s=ChromaGame.G.sim, m=s.movers.find(x=>x.kind===kind && x.active); if(!m) return false;
          const cy = kind==="bird"? m.y0 : m.y0+1.9*SimLib.C.SHIP_S; let tx=m.x; for(let k=0;k<5;k++){ const L=s.launch(tx,cy,m.z); tx=m.x+m.dir*m.speed*L.T; }
          const p=new THREE.Vector3(tx,cy,m.z), v=p.clone().project(ChromaGame.camera); if (Math.abs(v.x)>0.95) return false;
          const rc=new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(v.x,v.y), ChromaGame.camera);
          const objs=ChromaGame.G.meshes.filter(g=>g&&g.visible).map(g=>g.userData.body); return rc.intersectObjects(objs,false).length===0; }"""
        for i in range(400):
            ticks(pg,3)
            if kind=='bird':
                x=ev(pg,f"() => {{ const m=ChromaGame.G.sim.movers.find(x=>x.kind==='{kind}'); return m? m.x : 99; }}")
                if abs(x) < 2.5: break
            elif ev(pg,f"() => {{ const m=ChromaGame.G.sim.movers.find(x=>x.kind==='ship'); return !!m && Math.abs(m.x) < 22; }}") and pg.evaluate(CLEAR,kind): break
        ticks(pg,1,True); pg.screenshot(path=OUT+f'mv_{kind}_1.png')
        q0=ev(pg,"() => ChromaGame.G.sim.queue.length")
        lead=pg.evaluate(LEAD,kind); pass
        boatBalls=ev(pg,"() => { const m=ChromaGame.G.sim.movers.find(x=>x.kind==='ship'); return m? m.balls.join(',') : ''; }")
        if kind=='bird':
            pg.mouse.move(lead[0],lead[1]); pg.mouse.down(); ticks(pg,1,True); pg.screenshot(path=OUT+f'mv_{kind}_2.png')
            aim=ev(pg,"() => ChromaGame.G.aim ? [ChromaGame.G.aim.x, ChromaGame.G.aim.y, ChromaGame.G.aim.z] : null")
            pg.mouse.up(); ticks(pg,1)
        else:   # el velero se dispara al punto adelantado (el dedo en el mar, por delante de él)
            aim=ev(pg,"""() => { const s=ChromaGame.G.sim, m=s.movers.find(x=>x.kind==='ship' && x.active); const S=SimLib.C.SHIP_S, cy=m.y0+SimLib.C.BOAT.ballY*S, off=m.dir*0.62*S;
              let tx=m.x; for(let k=0;k<6;k++){ const L=s.launch(tx,cy,m.z); tx=m.x+off+m.dir*m.speed*L.T; } s.queue[0]='r'; s.fire(tx,cy,m.z); return [tx,cy,m.z]; }""")
            ticks(pg,1,True); pg.screenshot(path=OUT+f'mv_{kind}_2.png')
        hit=False
        for i in range(60):
            ticks(pg,2)
            if ev(pg,f"() => ChromaGame.G.sim.movers.some(x=>x.kind==='{kind}' && x.hitT)"): hit=True; break
        ticks(pg,4,True); pg.screenshot(path=OUT+f'mv_{kind}_3.png')
        ticks(pg,20,True); pg.screenshot(path=OUT+f'mv_{kind}_4.png')
        print(kind, '· apuntado a', [round(v,1) for v in aim] if aim else None, '· alcanzado:', hit, '· bolas', q0-1, '→', ev(pg,"() => ChromaGame.G.sim.queue.length"), ev(pg,"() => ChromaGame.G.sim.queue.join(',')"), '· bolas del velero:', boatBalls if kind=='ship' else '-')
    print('errores', errs[:5]); b.close()
names=[f'mv_{k}_{i}' for k in ['bird','ship'] for i in [1,2,3,4]]
ims=[Image.open(OUT+n+'.png').convert('RGB') for n in names]
W,H=ims[0].size; s=Image.new('RGB',(W*4+18,H*2+6),'white')
for i,im in enumerate(ims): s.paste(im,((i%4)*(W+6),(i//4)*(H+6)))
s.resize((s.width//2,s.height//2)).save(OUT+'movers.png')
