# Pantalla de victoria sin 3 estrellas: +3 bolas por anuncio y botón de reintentar
from playwright.sync_api import sync_playwright
OUT='/home/claude/chroma3d/dist/shots/'
def ticks(pg,n,render=False): pg.evaluate(f"() => {{ for(let i=0;i<{n};i++) ChromaGame.tick(1/30, true); {'ChromaGame.render();' if render else ''} }}")
def ev(pg,js): return pg.evaluate(js)
def on(pg,id): return ev(pg,f"() => document.getElementById('{id}').classList.contains('on')")
def vis(pg,id): return ev(pg,f"() => !document.getElementById('{id}').hidden")
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
    pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.add_init_script("localStorage.setItem('rocketrush.lang','es')")
    pg.add_init_script("if(!sessionStorage.g){sessionStorage.g=1;localStorage.setItem('chromacrash3d.v1', JSON.stringify({gemRoll:{n:0,got:0}}))}")  # sin gema: resultado estable
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(1500)
    ev(pg,"() => ChromaGame.manual(true)")
    ev(pg,"() => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(9, ['extra']); }"); ticks(pg,40)
    def shoot():
        pos=ev(pg,"""() => { const s=ChromaGame.G.sim, k=s.queue[0]; const live=s.liveBlocks(); const b=live.find(x=>x.userData.c===k)||live[0];
           const v=new THREE.Vector3().copy(b.position).project(ChromaGame.camera); return [(v.x*0.5+0.5)*innerWidth, (-v.y*0.5+0.5)*innerHeight]; }""")
        pg.mouse.click(pos[0],pos[1]); ticks(pg,1)
    for i in range(30):
        if ev(pg,"() => ChromaGame.G.sim.goalReached"): break
        if ev(pg,"() => ChromaGame.G.sim.canFire()"): shoot()
        ticks(pg,20)
    ticks(pg,30)
    coins0=ev(pg,"() => ChromaGame.save().coins")
    if vis(pg,'btnFinish') and not on(pg,'win'): pg.click('#btnFinish')
    ticks(pg,70)
    stars=ev(pg,"() => ChromaGame.G.sim.stars()")
    print('victoria:',on(pg,'win'),'· estrellas',stars,'· progreso',ev(pg,"() => Math.round(ChromaGame.G.sim.progress()*100)"),'%')
    print('botón +3 bolas:',vis(pg,'winBalls'),'· monedas x2:',vis(pg,'winDouble'),'· reintentar:',vis(pg,'winRetry'))
    ticks(pg,1,True); pg.wait_for_timeout(1500); pg.screenshot(path=OUT+'w1_victoria.png')
    coins1=ev(pg,"() => ChromaGame.save().coins")
    if __import__('sys').argv[-1]=='retry':
        pg.click('#winRetry'); ticks(pg,5)
        print('reintentar: modo',ev(pg,"() => ChromaGame.G.mode"),'· nivel',ev(pg,"() => ChromaGame.G.level.id"),'· estado',ev(pg,"() => ChromaGame.G.sim.state"),'· progreso',ev(pg,"() => Math.round(ChromaGame.G.sim.progress()*100)"),'· pantalla victoria',on(pg,'win')); print('errores',errs[:5]); b.close(); raise SystemExit
    pg.click('#winBalls'); pg.wait_for_timeout(3600); ticks(pg,2)
    print('tras el anuncio: estado',ev(pg,"() => ChromaGame.G.sim.state"),'· bolas',ev(pg,"() => ChromaGame.G.sim.queue.length"),'· monedas',coins0,'→',coins1,'→',ev(pg,"() => ChromaGame.save().coins"),'· pantalla victoria',on(pg,'win'))
    for i in range(40):
        if on(pg,'win'): break
        if ev(pg,"() => ChromaGame.G.sim.canFire() && ChromaGame.G.sim.liveBlocks().length>0"): shoot()
        ticks(pg,20)
    if not on(pg,'win'):
        if vis(pg,'btnFinish'): pg.click('#btnFinish')
        ticks(pg,70)
    print('segunda victoria:',on(pg,'win'),'· estrellas',ev(pg,"() => ChromaGame.G.sim.stars()"),'· +3 bolas otra vez:',vis(pg,'winBalls'),'· monedas',ev(pg,"() => ChromaGame.save().coins"))
    if vis(pg,'winRetry'):
        pg.click('#winRetry'); ticks(pg,5)
        print('reintentar: modo',ev(pg,"() => ChromaGame.G.mode"),'· nivel',ev(pg,"() => ChromaGame.G.level.id"),'· estado',ev(pg,"() => ChromaGame.G.sim.state"),'· progreso',ev(pg,"() => Math.round(ChromaGame.G.sim.progress()*100)"))
    print('errores',errs[:5]); b.close()
