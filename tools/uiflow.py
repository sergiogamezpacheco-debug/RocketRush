# Recorrido de pantallas: título → nivel 1 → victoria → nivel 2 · derrota en nivel 3 (regalo) y nivel 10 (pago)
from playwright.sync_api import sync_playwright
OUT='/home/claude/chroma3d/dist/shots/'
def ticks(pg,n,render=True): pg.evaluate(f"() => {{ for(let i=0;i<{n};i++) ChromaGame.tick(1/30, true); {'ChromaGame.render();' if render else ''} }}")
def on(pg,id): return pg.evaluate(f"() => document.getElementById('{id}').classList.contains('on')")
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(1500)
    pg.evaluate("() => ChromaGame.manual(true)")
    pg.click('#btnPlay'); ticks(pg,1); pg.screenshot(path=OUT+'u1_pre.png')
    pg.click('#preGo'); ticks(pg,40,False)
    def shoot_color():
        pos=pg.evaluate("""() => { const s=ChromaGame.G.sim, k=s.queue[0]; const live=s.liveBlocks(); const b=live.find(x=>x.userData.c===k)||live[0];
           const v=new THREE.Vector3().copy(b.position).project(ChromaGame.camera); return [(v.x*0.5+0.5)*innerWidth, (-v.y*0.5+0.5)*innerHeight]; }""")
        pg.mouse.click(pos[0],pos[1]); ticks(pg,1,False)
    shoot_color()
    for i in range(60):
        ticks(pg,15,False)
        if on(pg,'win'): break
    pg.wait_for_timeout(1500); ticks(pg,1); pg.screenshot(path=OUT+'u2_win.png')
    print('victoria visible', on(pg,'win'), pg.evaluate("() => document.getElementById('winRes').textContent"))
    pg.click('#winNext'); ticks(pg,1); pg.screenshot(path=OUT+'u3_pre2.png'); print('pre nivel 2', on(pg,'pre'))
    # derrota en nivel 3 disparando al cielo
    pg.evaluate("() => { ChromaGame.save().casiFree = {2:true}; }")   # el regalo del mundo 2 ya se usó
    for lv,name in [(3,'u4_regalo'),(11,'u5_pago')]:
        pg.evaluate(f"() => {{ document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel({lv}, []); }}"); ticks(pg,40,False)
        for i in range(400):
            if pg.evaluate("() => ChromaGame.G.sim.canFire()"): pg.mouse.click(195,120)
            ticks(pg,10,False)
            if on(pg,'lose'): break
        ticks(pg,1); pg.screenshot(path=OUT+name+'.png')
        print('nivel',lv,'derrota', on(pg,'lose'), 'regalo', pg.evaluate("() => !document.getElementById('loseGift').hidden"), 'anuncio', pg.evaluate("() => !document.getElementById('loseAd').hidden"), 'pack', pg.evaluate("() => !document.getElementById('loseStarter').hidden"), pg.evaluate("() => document.getElementById('loseRes').textContent"))
    pg.click('#loseCoins'); ticks(pg,2)
    print('tras pagar: estado', pg.evaluate("() => ChromaGame.G.sim.state"), 'cola', pg.evaluate("() => ChromaGame.G.sim.queue.join('')"), 'monedas', pg.evaluate("() => ChromaGame.save().coins"))
    print('errores', errs[:5])
    b.close()
from PIL import Image
ims=[Image.open(OUT+n+'.png').convert('RGB') for n in ['u1_pre','u2_win','u3_pre2','u4_regalo','u5_pago']]
W,H=ims[0].size; s=Image.new('RGB',(W*5+24,H),'white')
for i,im in enumerate(ims): s.paste(im,(i*(W+6),0))
s.resize((s.width//2,s.height//2)).save(OUT+'ui.png')
