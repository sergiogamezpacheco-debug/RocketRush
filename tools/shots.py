# Capturas de varios niveles: inicio, apuntado y acción tras un disparo
import sys
from playwright.sync_api import sync_playwright
from PIL import Image
OUT='/home/claude/chroma3d/dist/shots/'
levels=[int(x) for x in sys.argv[1].split(',')] if len(sys.argv)>1 else [1]
pick=sys.argv[2] if len(sys.argv)>2 else 'color'
frames=[]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
    pg=ctx.new_page(); errs=[]
    pg.add_init_script("window.RR_AGE = 30; localStorage.setItem('rocketrush.lang','es')")
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(1500)
    pg.evaluate("() => ChromaGame.manual(true)")
    for L in levels:
        pg.evaluate(f"() => {{ document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel({L}, []); for(let i=0;i<40;i++) ChromaGame.tick(1/30, true); ChromaGame.render(); }}")
        f=OUT+f'L{L}_0.png'; pg.screenshot(path=f); frames.append(f)
        pos=pg.evaluate("""() => { const G=ChromaGame.G, s=G.sim; const k=s.queue[0];
          const cands=s.blocks.filter(x=>x.userData.c===k); let b=cands.sort((a,c)=>a.position.y-c.position.y)[0]||s.blocks[0];
          const v=new THREE.Vector3().copy(b.position).project(ChromaGame.camera); return [(v.x*0.5+0.5)*innerWidth, (-v.y*0.5+0.5)*innerHeight]; }""")
        pg.mouse.move(pos[0],pos[1]); pg.mouse.down()
        pg.evaluate("() => { for(let i=0;i<2;i++) ChromaGame.tick(1/30, true); ChromaGame.render(); }")
        f=OUT+f'L{L}_1.png'; pg.screenshot(path=f); frames.append(f)
        pg.mouse.up(); pg.evaluate("() => ChromaGame.tick(1/30, true)")
        for i,n in enumerate([16,40]):
            pg.evaluate(f"() => {{ for(let i=0;i<{n};i++) ChromaGame.tick(1/30, true); ChromaGame.render(); }}")
            f=OUT+f'L{L}_{i+2}.png'; pg.screenshot(path=f); frames.append(f)
        st=pg.evaluate("() => { const s=ChromaGame.G.sim; return [s.state, Math.round(s.progress()*100)]; }")
        print('nivel',L,st)
    print('errores', errs[:5])
    b.close()
ims=[Image.open(f).convert('RGB') for f in frames]
W,H=ims[0].size; cols=4; rows=(len(ims)+3)//4
s=Image.new('RGB',(W*cols+6*(cols-1),H*rows+6*(rows-1)),'white')
for i,im in enumerate(ims): s.paste(im,((i%cols)*(W+6),(i//cols)*(H+6)))
s.resize((s.width//2,s.height//2)).save(OUT+'sheet.png')
