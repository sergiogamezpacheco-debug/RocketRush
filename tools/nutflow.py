# Cascanueces (jefes de gólem de Navidad): sonriendo es inmune; 3 tiros que rompen bloques lo enfadan; enfadado, cada tiro
# a la cara le quita una vida; 2 fallos y vuelve a sonreír. Se puede apuntar a la cara (no se va a lo que cruza el cielo).
import time
from playwright.sync_api import sync_playwright
OUT='/home/claude/chroma3d/dist/shots/'
NOW=int(time.time()*1000); ON={'xm':{'on':True,'start':NOW-1000,'end':NOW+30*86400000},'hw':{'on':False}}
ok=[]; errs=[]
def chk(n, c, x=''): ok.append(bool(c)); print('OK ' if c else 'MAL', n, x)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    pg=b.new_context(viewport={'width':390,'height':844}).new_page(); pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.add_init_script("window.RR_LIVE_OFF = true; window.RR_TUT_TEST = true; window.RR_AGE = 30; window.RR_NO_INTRO = true; localStorage.setItem('rocketrush.lang','es'); localStorage.setItem('chromacrash3d.v1', JSON.stringify({unlocked: 60, played: 30, birthYear: 1990, tut: {main: true, tips: {daily:1,club:1,shop:1,boss:1,xm:1,xgift:1}}}))")
    pg.route('**/*googleapis.com/**', lambda r: r.abort())
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2500)
    pg.evaluate("c => Live.set(c)", ON); pg.wait_for_timeout(600)
    pg.evaluate("() => { ChromaGame.manual(true); document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(30010, []); for (let i=0;i<260;i++) ChromaGame.tick(1/30, true); ChromaGame.render(); }")
    st=pg.evaluate("() => { const S=Bosses.state(); return [S.nut, S.mood, S.lives, document.getElementById('bbPhase').textContent, document.querySelector('#bossIntro .biRule').textContent]; }")
    chk('empieza sonriendo, inmune', st[0] and st[1]=='happy' and st[2]==3, st)
    pg.evaluate("() => { for (let i=0;i<300 && Bosses.state().introT > 0;i++) ChromaGame.tick(1/30, true); document.getElementById('bossIntro').classList.remove('on'); ChromaGame.render(); }")
    pg.wait_for_timeout(1500)
    tip=pg.evaluate("() => { const t=document.getElementById('tut'); return t && !t.hidden ? t.querySelector('.tu-tt').textContent + ' · ' + t.querySelector('.tu-tx').textContent : ''; }")
    chk('Cubi explica el Cascanueces', 'Cascanueces' in tip, tip)
    pg.evaluate("() => { const t=document.getElementById('tut'); if (t && !t.hidden) t.querySelector('.tu-go').click(); }")
    pg.screenshot(path=OUT+'nut_tutorial.png'); pg.evaluate("() => { const t=document.getElementById('tut'); if (t && !t.hidden) t.querySelector('.tu-go').click(); }"); pg.wait_for_timeout(300)
    pg.evaluate("() => { for (let i=0;i<5;i++) ChromaGame.tick(1/30, true); ChromaGame.render(); }"); pg.screenshot(path=OUT+'nut_feliz.png')
    # la cara se puede apuntar (aunque pase algo por el cielo)
    aim=pg.evaluate("""() => { const S=Bosses.state(), f=S.xm.face, s=ChromaGame.G.sim; s.nextShip=0; for(let i=0;i<5;i++) ChromaGame.tick(1/30,true);
      const v=new THREE.Vector3(f.x,f.y,f.z+1).project(ChromaGame.camera); const t=ChromaGame.pickTarget((v.x*.5+.5)*innerWidth,(-v.y*.5+.5)*innerHeight); return [t && +t.z.toFixed(2), f.z]; }""")
    chk('tocar la cara apunta a la cara', aim[0] is not None and abs(aim[0]-aim[1]) < 2, aim)
    # disparo a la cara sonriendo: rebota
    def shoot_face():
        pg.evaluate("""() => { const S=Bosses.state(); S.stun = 6; S.charge = 0; for (let i=0;i<10;i++) ChromaGame.tick(1/30,true); const f=S.xm.face, s=ChromaGame.G.sim; s.sinceFire=9; s.fire(f.x, f.y, f.z + 1.0); }""")
        for i in range(160):
            pg.evaluate("() => ChromaGame.tick(1/30,true)")
            if not pg.evaluate("() => ChromaGame.G.sim.shotOpen"): break
    def shoot_block():
        pg.evaluate("""() => { const s=ChromaGame.G.sim, k=s.queue[0]; const b=s.liveBlocks().filter(o=>o.userData.kind==='block').sort((a,b)=>(b.userData.c===k)-(a.userData.c===k) || b.position.z-a.position.z)[0]; s.sinceFire=9; s.fire(b.position.x,b.position.y,b.position.z+0.3); }""")
        for i in range(200):
            pg.evaluate("() => ChromaGame.tick(1/30,true)")
            if not pg.evaluate("() => ChromaGame.G.sim.shotOpen"): break
        print('   bloques de colores:', pg.evaluate("() => ChromaGame.G.sim.liveBlocks().filter(o=>o.userData.kind==='block').length"))
    print('   bloques al empezar:', pg.evaluate("() => ChromaGame.G.sim.liveBlocks().filter(o=>o.userData.kind==='block').length"))
    shoot_face(); st=pg.evaluate("() => { const S=Bosses.state(); return [S.mood, S.livesLeft, S.prog]; }")
    chk('sonriendo no le quita vida', st[1]==3, st)
    for k in range(3): shoot_block()
    st=pg.evaluate("() => { const S=Bosses.state(); return [S.mood, S.prog, S.livesLeft]; }")
    chk('3 tiros que rompen bloques: se enfada', st[0]=='angry', st)
    pg.evaluate("() => { for (let i=0;i<5;i++) ChromaGame.tick(1/30, true); document.getElementById('bossBanner').classList.remove('on'); ChromaGame.render(); }"); pg.screenshot(path=OUT+'nut_enfadado.png')
    q0=pg.evaluate("() => [ChromaGame.G.sim.queue.length, ChromaGame.G.sim.liveBlocks().filter(o=>o.userData.kind==='block').length]")
    shoot_face(); st=pg.evaluate("() => { const S=Bosses.state(); return [S.mood, S.livesLeft, document.getElementById('bbPhase').textContent]; }")
    chk('enfadado, a la cara: -1 vida y vuelve a sonreír', st[1]==2 and st[0]=='happy', st)
    pg.evaluate("() => { for (let i=0;i<90;i++) ChromaGame.tick(1/30,true); }")
    q1=pg.evaluate("() => [ChromaGame.G.sim.queue.length, ChromaGame.G.sim.liveBlocks().filter(o=>o.userData.kind==='block').length]")
    chk('le caen regalos nuevos y +3 bolas', (q1[1] > q0[1] or q0[1] >= 20) and q1[0] == q0[0] - 1 + 3, [q0, q1])
    for k in range(3): shoot_block()
    st=pg.evaluate("() => { const S=Bosses.state(), s=ChromaGame.G.sim; return [S.mood, S.prog, S.done, s.queue.length, s.liveBlocks().filter(o=>o.userData.kind==='block').length]; }")
    chk('otra vez enfadado', st[0]=='angry', st)
    for k in range(2): shoot_block()
    st=pg.evaluate("() => { const S=Bosses.state(); return [S.mood, S.miss, S.prog, S.livesLeft]; }")
    chk('2 fallos: vuelve a sonreír sin perder vida', st[0]=='happy' and st[3]==2, st)
    # el General Cascanueces tiene 4 vidas
    pg.evaluate("() => { ChromaGame.startLevel(30040, []); for (let i=0;i<60;i++) ChromaGame.tick(1/30, true); }")
    chk('General Cascanueces: 4 vidas', pg.evaluate("() => [Bosses.state().nut, Bosses.state().lives]")==[True,4])
    b.close()
print('errores', errs[:3]); print('TODO BIEN' if all(ok) and not errs else 'FALLOS')
