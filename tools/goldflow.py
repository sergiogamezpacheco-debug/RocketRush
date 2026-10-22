# Bola dorada (inventario y uso), premio con 3 estrellas y pago para repetir un nivel extra
from playwright.sync_api import sync_playwright
from PIL import Image
OUT='/home/claude/chroma3d/dist/shots/'
def ticks(pg,n,render=False): pg.evaluate(f"() => {{ for(let i=0;i<{n};i++) ChromaGame.tick(1/30, true); {'ChromaGame.render();' if render else ''} }}")
def ev(pg,js): return pg.evaluate(js)
def on(pg,id): return ev(pg,f"() => document.getElementById('{id}').classList.contains('on')")
def vis(pg,id): return ev(pg,f"() => !document.getElementById('{id}').hidden")
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    pg=b.new_context(viewport={'width':390,'height':844}).new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.add_init_script("localStorage.setItem('rocketrush.lang','es')")
    stars={i:3 for i in range(1,6)}
    pg.add_init_script("localStorage.setItem('chromacrash3d.v1', JSON.stringify({worlds3:true, unlocked:11, stars:%s, coins:400, bonusSeen:{10001:true}, daily:{n:0,last:null,best:0,shields:0,adRescue:-99,auto:Math.floor((Date.now()-new Date().getTimezoneOffset()*6e4)/864e5)}}))" % str(stars).replace("'",'"'))
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(1500)
    ev(pg,"() => ChromaGame.manual(true)")
    # 1) primera vez en el extra 1: ganar con 3 estrellas
    pg.click('#btnPlay'); ticks(pg,1); pg.click('.bonus[data-id="10001"]', force=True); ticks(pg,1)
    print('pre (1ª vez):', ev(pg,"() => document.getElementById('preGo').textContent"), '|', ev(pg,"() => document.getElementById('preReward').textContent"))
    print('bolas del nivel:', ev(pg,"() => ChromaGame.LEVELS.length && ChromaGame.G.level.balls"))
    pg.click('#preGo'); ticks(pg,40)
    ev(pg,"() => { const s=ChromaGame.G.sim; for (const b of s.blocks) b.position.y -= 20; }")
    for i in range(30):
        ticks(pg,15)
        if on(pg,'win'): break
    print('victoria:', on(pg,'win'), '·', ev(pg,"() => document.getElementById('winCoins').textContent"), '· doradas en inventario:', ev(pg,"() => ChromaGame.save().boosters.golden"), '· monedas', ev(pg,"() => ChromaGame.save().coins"))
    # 2) reintentar el extra: pasa por la pantalla de pago
    pg.wait_for_timeout(1500)
    pg.click('#winMap'); ticks(pg,1); pg.click('.bonus[data-id="10001"]', force=True); ticks(pg,1,True); pg.screenshot(path=OUT+'g1_pago.png')
    print('pre (repetir):', ev(pg,"() => document.getElementById('preGo').textContent"), '|', ev(pg,"() => document.getElementById('preReward').textContent"))
    c0=ev(pg,"() => ChromaGame.save().coins"); pg.click('#preGo'); ticks(pg,40)
    print('pago al repetir:', c0, '→', ev(pg,"() => ChromaGame.save().coins"), '· jugando', ev(pg,"() => ChromaGame.G.mode"))
    # 3) usar la bola dorada en el nivel 3
    ev(pg,"() => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(3, []); }"); ticks(pg,40,True)
    print('botón dorado visible:', vis(pg,'btnGold'), '· contador', ev(pg,"() => document.getElementById('goldCount').textContent"))
    pg.screenshot(path=OUT+'g2_boton.png')
    pg.click('#btnGold'); ticks(pg,2,True)
    print('cola tras cargarla:', ev(pg,"() => ChromaGame.G.sim.queue.join(',')"), '· inventario', ev(pg,"() => ChromaGame.save().boosters.golden"))
    pg.screenshot(path=OUT+'g3_cargada.png')
    pos=ev(pg,"""() => { const s=ChromaGame.G.sim; const b=s.liveBlocks().find(x=>x.userData.c==='g'); const v=new THREE.Vector3().copy(b.position).project(ChromaGame.camera); return [(v.x*0.5+0.5)*innerWidth, (-v.y*0.5+0.5)*innerHeight]; }""")
    verdes0=ev(pg,"() => ChromaGame.G.sim.liveBlocks().filter(b=>b.userData.c==='g').length")
    pg.mouse.click(pos[0],pos[1]); ticks(pg,1)
    for i,n in enumerate([14,10,30]):
        ticks(pg,n,True); pg.screenshot(path=OUT+f'g4_impacto{i}.png')
    print('verdes antes/después:', verdes0, '→', ev(pg,"() => ChromaGame.G.sim.liveBlocks().filter(b=>b.userData.c==='g' && !b.userData.popping).length"), '· progreso', ev(pg,"() => Math.round(ChromaGame.G.sim.progress()*100)"),'%')
    # 4) cargar otra (no hay) y comprobar devolución al salir sin usar
    ev(pg,"() => { ChromaGame.save().boosters.golden = 1; }")
    ev(pg,"() => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(4, []); }"); ticks(pg,40)
    pg.click('#btnGold'); ticks(pg,2)
    ev(pg,"() => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(5, []); }"); ticks(pg,5)
    print('dorada sin usar devuelta al cambiar de nivel:', ev(pg,"() => ChromaGame.save().boosters.golden"))
    print('errores', errs[:5]); b.close()
ims=[Image.open(OUT+n+'.png').convert('RGB') for n in ['g1_pago','g2_boton','g3_cargada','g4_impacto0','g4_impacto1','g4_impacto2']]
W,H=ims[0].size; s=Image.new('RGB',(W*6+30,H),'white')
for i,im in enumerate(ims): s.paste(im,(i*(W+6),0))
s.resize((s.width//2,s.height//2)).save(OUT+'goldsheet.png')
