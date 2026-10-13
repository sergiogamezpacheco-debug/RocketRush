# Mundos 6-10: paisaje, plataforma, bloques nuevos y el objeto que cruza el cielo
from playwright.sync_api import sync_playwright
from PIL import Image
import sys
OUT='/home/claude/chroma3d/dist/shots/'
def ticks(pg,n,render=False): pg.evaluate(f"() => {{ for(let i=0;i<{n};i++) ChromaGame.tick(1/30, true); {'ChromaGame.render();' if render else ''} }}")
def ev(pg,js): return pg.evaluate(js)
LV = [int(x) for x in sys.argv[1:]] or [51, 61, 71, 81, 91]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    pg=b.new_context(viewport={'width':390,'height':844}).new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.add_init_script("localStorage.setItem('chromacrash3d.v1', JSON.stringify({unlocked:1000, seen:{bird:true,ship:true}, daily:{n:0,last:null,best:0,shields:0,adRescue:-99,auto:Math.floor((Date.now()-new Date().getTimezoneOffset()*6e4)/864e5)}}))")
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(1500); ev(pg,"() => ChromaGame.manual(true)")
    shots=[]
    for lv in LV:
        ev(pg,f"() => {{ document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel({lv}, []); }}"); ticks(pg,45)
        ev(pg,"() => { const s=ChromaGame.G.sim; s.nextBird=999; s.nextShip=0; }"); ticks(pg,2)
        ev(pg,"() => { const m=ChromaGame.G.sim.movers.find(x=>x.kind==='ship'); if (m) { m.x = -m.dir * 4.5; } }"); ticks(pg,1,True)
        fn=OUT+f'w_{lv}.png'; pg.screenshot(path=fn); shots.append(fn)
        info=ev(pg,"() => { const m=ChromaGame.G.sim.movers.find(x=>x.kind==='ship'); return m ? (m.carrier||'velero')+' y='+m.y.toFixed(1)+' z='+m.z.toFixed(0)+' bolas='+m.balls : 'sin objeto'; }")
        print(lv, ev(pg,"() => ChromaGame.G.level.name"), '·', info)
    # vista del menú girando (paisaje completo)
    for lv in LV[:5]:
        ev(pg,f"() => {{ ChromaGame.G.mode='title'; ChromaGame.startLevel({lv}, []); ChromaGame.G.mode='title'; ChromaGame.G.orbit=2.6; }}"); ticks(pg,2,True)
        fn=OUT+f'wo_{lv}.png'; pg.screenshot(path=fn); shots.append(fn)
    print('errores', errs[:5]); b.close()
ims=[Image.open(f).convert('RGB').resize((234,506)) for f in shots]
cols=len(LV); s=Image.new('RGB',(234*cols,506*((len(ims)+cols-1)//cols)))
for i,im in enumerate(ims): s.paste(im,((i%cols)*234,(i//cols)*506))
s.save(OUT+'worlds_sheet.png')
