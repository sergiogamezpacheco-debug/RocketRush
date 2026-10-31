# Prueba en Chromium real (WebGL por software): errores, capturas y una partida
import sys, json, time
from playwright.sync_api import sync_playwright
OUT='/home/claude/chroma3d/dist/shots/'
level=int(sys.argv[1]) if len(sys.argv)>1 else 1
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
    pg=ctx.new_page(); errs=[]; logs=[]
    pg.add_init_script("window.RR_AGE = 30; localStorage.setItem('rocketrush.lang','es')")
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.on('console',lambda m: logs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
    t0=time.time()
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2500)
    print('carga', round(time.time()-t0,1),'s')
    pg.screenshot(path=OUT+'a_titulo.png')
    # rendimiento: fotogramas por segundo en software
    fps=pg.evaluate("""() => new Promise(r=>{let n=0;const t=performance.now();function f(){n++; if(performance.now()-t<2000) requestAnimationFrame(f); else r(n/2);} requestAnimationFrame(f);})""")
    print('fps (software)', fps)
    pg.evaluate("() => ChromaGame.manual(true)")
    pg.click('#btnPlay'); pg.evaluate("() => { ChromaGame.tick(1/30); }"); pg.screenshot(path=OUT+'b_mapa.png')
    pg.evaluate(f"() => {{ document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel({level}, []); }}")
    # avanzar la intro con pasos manuales para no depender de la velocidad del render
    pg.evaluate("() => { for(let i=0;i<40;i++) ChromaGame.tick(1/30, true); ChromaGame.render(); }")
    pg.screenshot(path=OUT+f'c_nivel{level}.png')
    # apuntar al centro del primer bloque de color y disparar
    pos=pg.evaluate("""() => { const G=ChromaGame.G, s=G.sim; const k=s.queue[0]; let b=s.blocks.find(x=>x.userData.c===k)||s.blocks[0];
       const v=new THREE.Vector3().copy(b.position).project(ChromaGame.camera); return [(v.x*0.5+0.5)*innerWidth, (-v.y*0.5+0.5)*innerHeight]; }""")
    pg.mouse.move(pos[0],pos[1]); pg.mouse.down()
    pg.evaluate("() => { for(let i=0;i<3;i++) ChromaGame.tick(1/30, true); ChromaGame.render(); }")
    pg.screenshot(path=OUT+f'd_apunta{level}.png')
    pg.mouse.up(); pg.evaluate('() => ChromaGame.tick(1/30, true)')
    for i,n in enumerate([14,10,16,30]):
        pg.evaluate(f"() => {{ for(let i=0;i<{n};i++) ChromaGame.tick(1/30, true); ChromaGame.render(); }}")
        pg.screenshot(path=OUT+f'e_accion{level}_{i}.png')
    st=pg.evaluate("() => { const s=ChromaGame.G.sim; return {estado:s.state, progreso:Math.round(s.progress()*100), cola:s.queue.join(''), puntos:s.score}; }")
    print('tras disparo', st)
    print('errores', errs[:5]); print('consola', logs[:5])
    b.close()
