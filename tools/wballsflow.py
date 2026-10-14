# Bolas de los mundos: tienda, compra con gemas antes de la partida y el efecto de cada una
from playwright.sync_api import sync_playwright
from PIL import Image
OUT='/home/claude/chroma3d/dist/shots/'
def ticks(pg,n,render=False): pg.evaluate(f"() => {{ for(let i=0;i<{n};i++) ChromaGame.tick(1/30, true); {'ChromaGame.render();' if render else ''} }}")
def ev(pg,js): return pg.evaluate(js)
LV = {'w1':5,'w2':15,'w3':25,'w4':35,'w5':45,'w6':58,'w7':68,'w8':76,'w9':88,'w10':96}
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    pg=b.new_context(viewport={'width':390,'height':844}).new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.add_init_script("if(!sessionStorage.x){sessionStorage.x=1;localStorage.setItem('chromacrash3d.v1', JSON.stringify({unlocked:131, coins:5000, gems:20, seen:{bird:true,ship:true}, daily:{n:0,last:null,best:0,shields:0,adRescue:-99,auto:Math.floor((Date.now()-new Date().getTimezoneOffset()*6e4)/864e5)}}))}")
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(1500); ev(pg,"() => ChromaGame.manual(true)")
    pg.click('#btnShopT'); pg.wait_for_timeout(200)
    ev(pg,"() => { const h=[...document.querySelectorAll('.sechead')].find(x=>x.textContent.includes('MUNDOS')); h.scrollIntoView(); }"); pg.wait_for_timeout(100)
    pg.screenshot(path=OUT+'wb_tienda.png')
    print('tienda:', ev(pg,"() => [...document.querySelectorAll('.shopitem.wb b')].map(x=>x.textContent).join(' | ')"))
    pg.click('button[data-wb="w1"]'); print('comprada demoledora: tienes', ev(pg,"() => ChromaGame.save().boosters.w1"), '· monedas', ev(pg,"() => ChromaGame.save().coins"))
    pg.click('#shopClose'); pg.click('#btnPlay'); ticks(pg,1)
    ev(pg,"() => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); }")
    pg.evaluate("() => document.querySelector('.lv[data-id=\"76\"]').click()"); pg.wait_for_timeout(200)
    print('previa nivel 76:', ev(pg,"() => [...document.querySelectorAll('#preBoosters .boost')].map(x=>x.innerText.replace(/\\n/g,' ')).join(' | ')"))
    pg.click('.boost[data-k="w8"]'); pg.wait_for_timeout(100); pg.screenshot(path=OUT+'wb_previa.png')
    print('tras pulsar camaleón: gemas', ev(pg,"() => ChromaGame.save().gems"), '· tiene', ev(pg,"() => ChromaGame.save().boosters.w8"), '·', ev(pg,"() => document.getElementById('preWb').textContent"))
    pg.click('#preGo'); ticks(pg,2); print('en el cañón:', ev(pg,"() => ChromaGame.G.sim.queue[0]"), '· niveles de bola', ev(pg,"() => JSON.stringify(ChromaGame.G.sim.wlv)"))
    shots=[]
    for k,lv in LV.items():
        ev(pg,f"() => {{ document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel({lv}, ['{k}']); }}"); ticks(pg,40)
        n0=ev(pg,"() => ChromaGame.G.sim.liveBlocks().length")
        ev(pg,"() => { const s=ChromaGame.G.sim; const f=s.liveBlocks().reduce((a,b)=>b.position.z>a.position.z?b:a); s.fire(0, 1.6, f.position.z+0.3); }")
        hit=False
        for i in range(60):
            ticks(pg,2)
            if ev(pg,"() => ChromaGame.G.sim.balls.length===0 || ChromaGame.G.sim.liveBlocks().length < %d" % n0): hit=True; break
        ticks(pg,8,True); fn=OUT+f'wb_{k}.png'; pg.screenshot(path=fn); shots.append(fn)
        ticks(pg,90); print(k, 'rompe', n0-ev(pg,"() => ChromaGame.G.sim.liveBlocks().length"), 'de', n0)
    print('errores', errs[:5]); b.close()
ims=[Image.open(f).convert('RGB').crop((0,60,390,700)).resize((195,320)) for f in [OUT+'wb_tienda.png',OUT+'wb_previa.png']+shots]
s=Image.new('RGB',(195*6,320*2))
for i,im in enumerate(ims): s.paste(im,((i%6)*195,(i//6)*320))
s.save(OUT+'wballs_sheet.png')
