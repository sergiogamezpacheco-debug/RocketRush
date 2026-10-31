# Mapa de 5 mundos, desbloqueo del nivel extra y aspecto de hielo y oro
from playwright.sync_api import sync_playwright
from PIL import Image
OUT='/home/claude/chroma3d/dist/shots/'
def ticks(pg,n,render=False): pg.evaluate(f"() => {{ for(let i=0;i<{n};i++) ChromaGame.tick(1/30, true); {'ChromaGame.render();' if render else ''} }}")
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
    pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.add_init_script("window.RR_AGE = 30; localStorage.setItem('rocketrush.lang','es')")
    # partida guardada: mundo 1 con 3 estrellas en 9 niveles y 2 en el 10
    pg.add_init_script("localStorage.setItem('chromacrash3d.v1', JSON.stringify({worlds3:true, unlocked:6, stars:{1:3,2:3,3:3,4:3,5:2}, coins:500, daily:{n:0,last:null,best:0,shields:0,adRescue:-99,auto:Math.floor((Date.now()-new Date().getTimezoneOffset()*6e4)/864e5)}}))")
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(1500)
    pg.evaluate("() => ChromaGame.manual(true)")
    pg.click('#btnPlay'); ticks(pg,1,True); pg.screenshot(path=OUT+'m1_mapa.png')
    print('extra 1 cerrado:', pg.evaluate("() => !document.querySelector('.bonus[data-id=\"10001\"]').classList.contains('open')"), pg.evaluate("() => document.querySelector('.bonus[data-id=\"10001\"] span').textContent"))
    # ganar el nivel 10 con 3 estrellas: se simula derribándolo todo
    pg.evaluate("() => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(5, []); const s=ChromaGame.G.sim; for (const b of s.blocks) { b.position.y -= 20; } }")
    for i in range(30):
        ticks(pg,15)
        if pg.evaluate("() => document.getElementById('win').classList.contains('on')"): break
    print('victoria nivel 5:', pg.evaluate("() => document.getElementById('winNext').textContent"), '· estrellas', pg.evaluate("() => ChromaGame.save().stars[5]"))
    pg.click('#winNext'); ticks(pg,1,True); pg.screenshot(path=OUT+'m2_extra_pre.png')
    print('pre del extra:', pg.evaluate("() => document.getElementById('preTitle').textContent"), '·', pg.evaluate("() => document.getElementById('preReward').textContent"))
    pg.click('#preGo'); ticks(pg,40,True); pg.screenshot(path=OUT+'m3_extra_juego.png')
    # disparo al oro
    pos=pg.evaluate("""() => { const s=ChromaGame.G.sim; const b=s.liveBlocks().find(x=>x.userData.kind==='gold')||s.blocks[0];
       const v=new THREE.Vector3().copy(b.position).project(ChromaGame.camera); return [(v.x*0.5+0.5)*innerWidth, (-v.y*0.5+0.5)*innerHeight]; }""")
    pg.mouse.click(pos[0],pos[1]); ticks(pg,22,True); pg.screenshot(path=OUT+'m4_oro.png')
    print('monedas de oro en la partida:', pg.evaluate("() => ChromaGame.G.sim.coins"))
    # hielo
    pg.evaluate("() => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(22, []); }"); ticks(pg,40,True); pg.screenshot(path=OUT+'m5_hielo.png')
    pg.evaluate("() => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(33, []); }"); ticks(pg,40,True); pg.screenshot(path=OUT+'m6_puerto.png')
    pg.evaluate("() => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(50, []); }"); ticks(pg,40,True); pg.screenshot(path=OUT+'m7_palacio.png')
    print('errores', errs[:5]); b.close()
ims=[Image.open(OUT+n+'.png').convert('RGB') for n in ['m1_mapa','m2_extra_pre','m3_extra_juego','m4_oro','m5_hielo','m6_puerto','m7_palacio']]
W,H=ims[0].size; s=Image.new('RGB',(W*4+18,H*2+6),'white')
for i,im in enumerate(ims): s.paste(im,((i%4)*(W+6),(i//4)*(H+6)))
s.resize((s.width//2,s.height//2)).save(OUT+'mapsheet.png')
