# Jefe faraón: romper el escudo con su color, golpear la máscara 3 veces, reconstrucción con arena y victoria (python3 tools/pharaohflow.py)
import json, sys
from playwright.sync_api import sync_playwright
OUT='/home/claude/chroma3d/dist/shots/'
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    pg=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True).new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2000)
    pg.evaluate("() => ChromaGame.manual(true)")
    lid=int(sys.argv[1]) if len(sys.argv)>1 else pg.evaluate("() => ChromaGame.LEVELS.find(l=>l.boss==='pyramid').id")
    pg.evaluate(f"() => {{ document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel({lid}, []); }}")
    T=lambda n: pg.evaluate(f"() => {{ for(let i=0;i<{n};i++) ChromaGame.tick(1/30, true); ChromaGame.render(); }}")
    T(5); pg.screenshot(path=OUT+'ph_0_intro.png'); T(110)
    pg.screenshot(path=OUT+'ph_1_inicio.png')
    info=lambda: pg.evaluate("() => { const S=Bosses.state(), s=ChromaGame.G.sim; return {hp:Math.round(S.hp*100), hits:S.hits, prog:S.prog, open:S.open, esc:S.shieldC, sig:S.nextC, tiros:s.shots, cola:s.queue.join(''), vivos:s.liveBlocks().length, estado:s.state, modo:ChromaGame.G.mode, sub:document.getElementById('bbSub').textContent}; }")
    print('inicio', info())
    # disparar: al bloque del color del escudo con su color, o a la máscara si está abierta
    # jugador realista: sin bolas regaladas; con el escudo puesto usa una bola de su color si la tiene (cargarla es gratis aquí)
    fire = """(useMask) => { const S=Bosses.state(), s=ChromaGame.G.sim; if(!s.canFire()) return 'no'; if(!s.queue.length) return 'sin bolas';
      if (S.open || useMask) { let m=S.mask.position, T=1;      // apunta por delante: donde estará la máscara cuando llegue la bola
        for (let i=0;i<3;i++){ const L=s.launch(m.x,m.y,m.z+0.6); T=Math.abs((s.cannon.z-m.z)/(L.vz||-1)); m=Bosses.maskAt(T); }
        s.fire(m.x, m.y, m.z+0.6); return 'mask'; }
      const i=s.queue.indexOf(S.shieldC); if(i>0){ const t=s.queue[0]; s.queue[0]=s.queue[i]; s.queue[i]=t; }
      const k=s.queue[0], col = k===S.shieldC ? S.shieldC : k;
      // como haría un buen jugador: el bloque de delante que forma el grupo más grande de ese color
      const cand=s.liveBlocks().filter(b=>b.userData.kind==='block'&&b.userData.c===col&&!b.userData.popping);
      const grp=b=>cand.filter(o=>Math.abs(o.position.x-b.position.x)<1.2&&Math.abs(o.position.y-b.position.y)<1.2&&Math.abs(o.position.z-b.position.z)<1.2).length;
      const t=cand.filter(b=>b.position.z>-0.6).sort((a,b)=>grp(b)-grp(a)||b.position.z-a.position.z)[0] || cand.sort((a,b)=>b.position.z-a.position.z)[0]
        || s.liveBlocks().filter(b=>b.userData.kind==='block').sort((a,b)=>b.position.z-a.position.z)[0];
      if(!t) return 'none'; s.fire(t.position.x,t.position.y,t.position.z); return 'block '+k+(k===S.shieldC?' (escudo)':''); }"""
    for k in range(70):
        st=info()
        if st['estado']!='play' or st['hp']<=0: break
        r=pg.evaluate(f"({fire})({'true' if k==0 else 'false'})")
        if r in ('sin bolas','no'): T(60); continue
        T(150)
        st=info(); print(k, r, st)
        if r=='mask': pg.screenshot(path=OUT+f'ph_3_tras_mascara_{st["hits"]}.png')
        if st['open']: pg.screenshot(path=OUT+f'ph_2_abierto_{st["hits"]}.png')
    T(120); st=info(); print('final', st)
    pg.screenshot(path=OUT+'ph_4_final.png')
    print('errores', errs[:5])
    b.close()
