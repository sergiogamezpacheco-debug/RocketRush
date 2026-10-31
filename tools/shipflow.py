# Jefe barco: un jugador automático juega la partida entera (python3 tools/shipflow.py [nivel])
import sys
from playwright.sync_api import sync_playwright
OUT='/home/claude/chroma3d/dist/shots/'
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    pg=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True).new_page(); errs=[]
    pg.add_init_script("window.RR_AGE = 30; localStorage.setItem('rocketrush.lang','es')")
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2000)
    pg.evaluate("() => ChromaGame.manual(true)")
    lid=int(sys.argv[1]) if len(sys.argv)>1 else pg.evaluate("() => ChromaGame.LEVELS.find(l=>l.boss==='ship').id")
    pg.evaluate(f"() => {{ document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel({lid}, []); }}")
    T=lambda n: pg.evaluate(f"() => {{ for(let i=0;i<{n};i++) ChromaGame.tick(1/30, true); }}")
    T(110)
    info=lambda: pg.evaluate("() => { const S=Bosses.state(), s=ChromaGame.G.sim; return {hp:Math.round(S.hp*100), fase:S.phase, carga:+S.charge.toFixed(2), tiros:s.shots, bolas:s.queue.length, estado:s.state}; }")
    print('nivel', lid, 'dificultad', pg.evaluate("() => ChromaGame.G.level.bossD.toFixed(2)"), info())
    fire = """() => { const s=ChromaGame.G.sim; if(!s.canFire()) return 'no'; if(!s.queue.length) return 'sin bolas';
      window.__tries = window.__tries || {};
      const live=s.liveBlocks().filter(b=>b.userData.kind==='block'&&!b.userData.popping);
      const grp=(b)=>live.filter(o=>o.userData.c===b.userData.c&&Math.abs(o.position.x-b.position.x)<1.2&&Math.abs(o.position.y-b.position.y)<1.2&&Math.abs(o.position.z-b.position.z)<1.2).length;
      // el tesoro dorado vale mucho: a por él en cuanto esté a la vista
      const gold=s.liveBlocks().find(b=>b.userData.kind==='gold' && (window.__tries['g'+b.userData.id]||0)<3);
      if (gold) { window.__tries['g'+gold.userData.id]=(window.__tries['g'+gold.userData.id]||0)+1; s.fire(gold.position.x,gold.position.y,gold.position.z+0.3); return 'oro'; }
      // la bola de la bandeja cuyo color tiene el mejor grupo (cambiarla es gratis aquí); no repite un bloque que ya ha fallado 2 veces
      let best=null,bi=0,bs=-99; s.queue.slice(0,3).forEach((k,i)=>{ for(const b of live) if(b.userData.c===k && (window.__tries[b.userData.id]||0)<2){ const g=grp(b)+b.position.z*0.8; if(g>bs){bs=g;best=b;bi=i;} } });
      if(!best){ best=live[0]; if(!best) return 'nada'; bi=0; }
      window.__tries[best.userData.id]=(window.__tries[best.userData.id]||0)+1;
      if(bi>0){ const t=s.queue[0]; s.queue[0]=s.queue[bi]; s.queue[bi]=t; }
      s.fire(best.position.x,best.position.y,best.position.z); return s.queue.length+''; }"""
    for k in range(40):
        st=info()
        if st['estado']!='play' or st['hp']<=0: break
        r=pg.evaluate(fire)
        T(110); print(k, r, info())
    T(90); print('final', info()); print('errores', errs[:5])
    print('quedan', pg.evaluate("() => ChromaGame.G.sim.liveBlocks().filter(b=>b.userData.kind!=='stone').map(b=>(b.userData.c||b.userData.kind)+'@'+b.position.toArray().map(v=>v.toFixed(1)).join(',')).join('  ')"))
    pg.evaluate("() => ChromaGame.render()"); pg.screenshot(path=OUT+f'ship_{lid}.png')
    b.close()
