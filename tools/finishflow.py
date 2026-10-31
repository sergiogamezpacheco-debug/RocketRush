# Comprueba el arreglo: tras cumplir el objetivo el jugador sigue disparando, puede cambiar de bola y terminar
from playwright.sync_api import sync_playwright
OUT='/home/claude/chroma3d/dist/shots/'
def ticks(pg,n,render=False): pg.evaluate(f"() => {{ for(let i=0;i<{n};i++) ChromaGame.tick(1/30, true); {'ChromaGame.render();' if render else ''} }}")
def ev(pg,js): return pg.evaluate(js)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
    pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.add_init_script("window.RR_AGE = 30; localStorage.setItem('rocketrush.lang','es')")
    pg.add_init_script("if(!sessionStorage.g){sessionStorage.g=1;localStorage.setItem('chromacrash3d.v1', JSON.stringify({gemRoll:{n:0,got:0}}))}")  # sin gema: resultado estable
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(1500)
    ev(pg,"() => ChromaGame.manual(true)")
    ev(pg,"() => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(9, ['extra','extra','extra']); }"); ticks(pg,40)
    def shoot():
        pos=ev(pg,"""() => { const s=ChromaGame.G.sim, k=s.queue[0]; const live=s.liveBlocks(); const b=live.find(x=>x.userData.c===k)||live[0];
           const v=new THREE.Vector3().copy(b.position).project(ChromaGame.camera); return [(v.x*0.5+0.5)*innerWidth, (-v.y*0.5+0.5)*innerHeight]; }""")
        pg.mouse.click(pos[0],pos[1]); ticks(pg,1)
    disparos=0
    for i in range(30):
        if ev(pg,"() => ChromaGame.G.sim.goalReached"): break
        if ev(pg,"() => ChromaGame.G.sim.canFire()"): shoot(); disparos+=1
        ticks(pg,20)
    ticks(pg,30)
    antes=ev(pg,"() => ChromaGame.G.sim.queue.join('')")
    pg.click('#tray'); ticks(pg,1)
    despues=ev(pg,"() => ChromaGame.G.sim.queue.join('')")
    print('objetivo tras',disparos,'disparos · botón Terminar visible:',ev(pg,"() => !document.getElementById('btnFinish').hidden"),'· estado:',ev(pg,"() => ChromaGame.G.sim.state"))
    print('cambio de bola tras objetivo:',antes,'→',despues)
    # esperar 6 s sin tocar: no debe dispararse nada solo
    n0=ev(pg,"() => ChromaGame.G.sim.shots"); ticks(pg,180); n1=ev(pg,"() => ChromaGame.G.sim.shots")
    print('disparos automáticos en 6 s sin tocar:', n1-n0)
    ticks(pg,1,True); pg.screenshot(path=OUT+'f1_objetivo.png')
    # a veces lo que quedaba termina de caer solo y el nivel se gana sin pulsar Terminar
    if ev(pg,"() => !document.getElementById('btnFinish').hidden"): pg.click('#btnFinish')
    else: print('(se ha ganado solo al caer lo que quedaba)')
    ticks(pg,70)
    print('victoria visible:',ev(pg,"() => document.getElementById('win').classList.contains('on')"),'· puntos:',ev(pg,"() => document.getElementById('winScore').textContent"),'· bonus:',ev(pg,"() => ChromaGame.G.sim.bonus"))
    print('errores', errs[:5]); b.close()
