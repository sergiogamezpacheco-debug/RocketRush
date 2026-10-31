# Jefe gólem: se dispara a bloques al azar y se mira dónde acaban los núcleos (python3 tools/golemflow.py [nivel] [semilla])
import sys, json
from playwright.sync_api import sync_playwright
OUT='/home/claude/chroma3d/dist/shots/'
lid=int(sys.argv[1]) if len(sys.argv)>1 else 82
seed=int(sys.argv[2]) if len(sys.argv)>2 else 1
heavy=float(sys.argv[3]) if len(sys.argv)>3 else 0.5
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    pg=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True).new_page(); errs=[]
    pg.add_init_script("window.RR_AGE = 30; localStorage.setItem('rocketrush.lang','es')")
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2000)
    pg.evaluate("() => ChromaGame.manual(true)")
    pg.evaluate(f"() => {{ document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel({lid}, []); }}")
    T=lambda n: pg.evaluate(f"() => {{ for(let i=0;i<{n};i++) ChromaGame.tick(1/30, true); }}")
    T(110)
    info=lambda: pg.evaluate("""() => { const S=Bosses.state(), s=ChromaGame.G.sim;
      return {hp:Math.round(S.hp*100), golpes:S.coresHit, estado:s.state, cola:s.queue.length,
        nucleos:S.cores.map(id=>{const b=s.blocks[id],d=b.userData; return d.alive&&!d.destroyed? [+b.position.x.toFixed(1),+b.position.y.toFixed(1),+b.position.z.toFixed(1)] : 'roto'})}; }""")
    print('inicio', info())
    # disparos a bloques de piedra o de color al azar (no a los núcleos), con bolas pesadas para derrumbarlo
    for k in range(14):
        r=pg.evaluate("""(k) => { const S=Bosses.state(), s=ChromaGame.G.sim; if(!s.canFire()) return 'no';
          let x=(k*9301+%d*49297)%%233280; const rnd=()=>{x=(x*9301+49297)%%233280; return x/233280;};
          const HEAVY=%s; const core=s.liveBlocks().find(b=>b.userData.kind==='gold' && (b.userData.floatCore || b.position.z>0.2));
          if (core && rnd()<0.6) { s.queue[0]=s.queue[0]||'r'; s.fire(core.position.x,core.position.y,core.position.z+0.4); return 'núcleo'; }
          const bs=s.liveBlocks().filter(b=>b.userData.kind!=='gold'); if(!bs.length) { if(core){ s.fire(core.position.x,core.position.y,core.position.z+0.4); return 'núcleo'; } return 'none'; }
          const t=bs[Math.floor(rnd()*bs.length)]; s.queue[0]=rnd()<HEAVY?'heavy':(t.userData.c||'r'); s.fire(t.position.x,t.position.y,t.position.z); return s.queue[0]; }""" % (seed, heavy), k)
        pg.evaluate("() => { const s=ChromaGame.G.sim; while(s.queue.length<4) s.queue.push('heavy'); }")
        T(150)
        st=info(); print(k, r, st)
        if st['hp']<=0: break
    T(60); pg.evaluate("() => ChromaGame.render()"); pg.screenshot(path=OUT+f'golem_{lid}_{seed}.png')
    print('final', info()); print('errores', errs[:5])
    b.close()
