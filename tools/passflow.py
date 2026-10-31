# Gemas en partida, pase gratis/Pro, compra de gemas, cañón exclusivo
from playwright.sync_api import sync_playwright
from PIL import Image
OUT='/home/claude/chroma3d/dist/shots/'
def ticks(pg,n,render=False): pg.evaluate(f"() => {{ for(let i=0;i<{n};i++) ChromaGame.tick(1/30, true); {'ChromaGame.render();' if render else ''} }}")
def ev(pg,js): return pg.evaluate(js)
def on(pg,id): return ev(pg,f"() => document.getElementById('{id}').classList.contains('on')")
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    pg=b.new_context(viewport={'width':390,'height':844}).new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.add_init_script("window.RR_AGE = 30; localStorage.setItem('rocketrush.lang','es')")
    pg.add_init_script("localStorage.setItem('chromacrash3d.v1', JSON.stringify({unlocked:6, stars:{1:3,2:3,3:2,4:3,5:1}, coins:800, gemDry:2, daily:{n:0,last:null,best:0,shields:0,adRescue:-99,auto:Math.floor((Date.now()-new Date().getTimezoneOffset()*6e4)/864e5)}}))")
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(1500)
    ev(pg,"() => ChromaGame.manual(true)")
    ticks(pg,1,True); pg.screenshot(path=OUT+'p0_titulo.png')
    pg.click('#btnPlay'); ticks(pg,1,True); pg.screenshot(path=OUT+'p1_mapa.png')
    # 1) partida con gema garantizada (2 partidas seguidas sin gema)
    ev(pg,"() => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(3, []); }"); ticks(pg,40,True)
    pg.screenshot(path=OUT+'p2_gema.png')
    print('bloques con gema:', ev(pg,"() => ChromaGame.G.sim.blocks.filter(b=>b.userData.gem).length"), '· tirada', ev(pg,"() => JSON.stringify(ChromaGame.save().gemRoll)"))
    # salir y volver a entrar: misma tirada, no una nueva
    ev(pg,"() => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(3, []); }"); ticks(pg,5)
    print('al reentrar sigue habiendo', ev(pg,"() => ChromaGame.G.sim.blocks.filter(b=>b.userData.gem).length"), 'gema(s) · tirada', ev(pg,"() => JSON.stringify(ChromaGame.save().gemRoll)"))
    ticks(pg,40)
    # reventar la gema: poner su color en el cañón y dispararle
    pos=ev(pg,"""() => { const s=ChromaGame.G.sim; const g=s.blocks.find(b=>b.userData.gem); s.queue[0]=g.userData.c; ChromaGame.G.sim.queue=s.queue; const v=new THREE.Vector3().copy(g.position).project(ChromaGame.camera); return [(v.x*0.5+0.5)*innerWidth, (-v.y*0.5+0.5)*innerHeight]; }""")
    g0=ev(pg,"() => ChromaGame.save().gems")
    pg.mouse.click(pos[0],pos[1]); ticks(pg,20,True); pg.screenshot(path=OUT+'p3_gema_cogida.png')
    print('gemas', g0, '→', ev(pg,"() => ChromaGame.save().gems"), '(tras el disparo)')
    # ganar el nivel (derribando todo) y ver la línea del pase
    ev(pg,"() => { for (const b of ChromaGame.G.sim.blocks) b.position.y -= 20; }")
    for i in range(30):
        ticks(pg,15)
        if on(pg,'win'): break
    pg.wait_for_timeout(1300); ticks(pg,1,True); pg.screenshot(path=OUT+'p4_victoria.png')
    print('gemas guardadas tras ganar:', ev(pg,"() => ChromaGame.save().gems"))
    print('victoria:', ev(pg,"() => document.getElementById('winPass').textContent"), '· tirada tras ganar', ev(pg,"() => JSON.stringify(ChromaGame.save().gemRoll)"), '· sequía', ev(pg,"() => ChromaGame.save().gemDry"))
    # 2) pase: dar estrellas para llegar a nivel 4 del pase
    pg.click('#winMap'); ticks(pg,1)
    ev(pg,"() => { ChromaGame.save().pass.pts = 17; }")
    pg.click('#btnPass'); ticks(pg,1,True); pg.screenshot(path=OUT+'p5_pase.png')
    print('pase:', ev(pg,"() => document.getElementById('passProg').textContent"), '· listas para reclamar:', ev(pg,"() => document.querySelectorAll('.pcard.ready').length"))
    pg.click('.pcard.ready', force=True); ticks(pg,1)
    print('tras reclamar una: monedas', ev(pg,"() => ChromaGame.save().coins"))
    # 3) Pro sin gemas suficientes -> tienda de gemas
    pg.click('#passBuy'); ticks(pg,1,True)
    print('tienda abierta:', on(pg,'shop')); pg.screenshot(path=OUT+'p6_tienda.png')
    pg.click('button[data-id="g2"]'); ticks(pg,1)
    print('gemas tras comprar el cofre:', ev(pg,"() => ChromaGame.save().gems"))
    pg.click('#shopClose'); ticks(pg,1)
    pg.click('#passBuy'); ticks(pg,1)
    print('Pro:', ev(pg,"() => ChromaGame.save().pass.pro"), '· gemas', ev(pg,"() => ChromaGame.save().gems"), '· listas:', ev(pg,"() => document.querySelectorAll('.pcard.ready').length"))
    pg.click('#passClaimAll'); ticks(pg,1,True)
    print('cañones:', ev(pg,"() => JSON.stringify(ChromaGame.save().skins)"), '· dorada', ev(pg,"() => ChromaGame.save().boosters.golden"))
    pg.wait_for_timeout(300); pg.screenshot(path=OUT+'p7_pro.png')
    pg.click('#passBack'); ticks(pg,1)
    ev(pg,"() => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(4, []); }"); ticks(pg,40,True)
    pg.screenshot(path=OUT+'p8_canon_real.png')
    print('errores', errs[:5]); b.close()
names=['p1_mapa','p2_gema','p3_gema_cogida','p4_victoria','p5_pase','p6_tienda','p7_pro','p8_canon_real']
ims=[Image.open(OUT+n+'.png').convert('RGB') for n in names]
W,H=ims[0].size; s=Image.new('RGB',(W*4+18,H*2+6),'white')
for i,im in enumerate(ims): s.paste(im,((i%4)*(W+6),(i//4)*(H+6)))
s.resize((s.width//2,s.height//2)).save(OUT+'passsheet.png')
