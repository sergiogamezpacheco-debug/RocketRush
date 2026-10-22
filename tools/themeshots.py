# Capturas del estilo de menús (B2): título, mapa, previa, racha, tienda, pase, misiones, victoria, derrota, pausa, ajustes
from playwright.sync_api import sync_playwright
from PIL import Image
OUT='/home/claude/chroma3d/dist/shots/'
def ticks(pg,n,render=True): pg.evaluate(f"() => {{ for(let i=0;i<{n};i++) ChromaGame.tick(1/30, true); {'ChromaGame.render();' if render else ''} }}")
def on(pg,id): return pg.evaluate(f"() => document.getElementById('{id}').classList.contains('on')")
def only(pg,id): pg.evaluate(f"() => {{ document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); }}")
names=[]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
    pg=ctx.new_page(); errs=[]
    pg.add_init_script("localStorage.setItem('rocketrush.lang','es')")
    pg.on('pageerror',lambda e: errs.append(str(e)))
    stars={i:(3 if i%3 else 2) for i in range(1,12)}
    pg.add_init_script("localStorage.setItem('chromacrash3d.v1', JSON.stringify({unlocked:12, coins:2660, gems:19, stars:%s, daily:{n:3,last:Math.floor((Date.now()-new Date().getTimezoneOffset()*6e4)/864e5)-1,best:3,shields:0,adRescue:-99}}))" % str(stars).replace("'",'"'))
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2600)
    pg.evaluate("() => ChromaGame.manual(true)"); ticks(pg,1)
    def shot(n): ticks(pg,1); pg.wait_for_timeout(450); pg.screenshot(path=OUT+'t_'+n+'.png'); names.append(n)
    shot('racha')
    pg.click('#dX'); pg.wait_for_timeout(200); shot('titulo')
    pg.click('#btnPlay'); pg.wait_for_timeout(300)
    if on(pg,'pre'): pg.click('#preBack')
    pg.wait_for_timeout(200); shot('mapa')
    pg.evaluate("() => document.querySelector('.lv[data-id=\"5\"]').click()"); shot('previa')
    pg.click('#preBack'); pg.click('#btnShop'); shot('tienda'); pg.click('#shopClose')
    pg.click('#btnPass'); shot('pase'); pg.click('#passBack')
    pg.click('#btnMis'); shot('misiones'); pg.click('#misBack')
    pg.evaluate("() => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(1, []); }"); ticks(pg,40,False)
    pg.click('#btnPause'); shot('pausa'); pg.click('#pResume')
    pg.evaluate("() => { const s=ChromaGame.G.sim; s.liveBlocks().forEach(o=>s.removeBlock?s.removeBlock(o):0); }")
    for i in range(80):
        ticks(pg,15,False)
        if on(pg,'win'): break
    if not on(pg,'win'):
        pg.evaluate("() => { const s=ChromaGame.G.sim; for(const o of s.liveBlocks()) o.position.y=-50; }")
        for i in range(80):
            ticks(pg,15,False)
            if on(pg,'win'): break
    pg.wait_for_timeout(1800); shot('victoria')
    pg.evaluate("() => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(3, []); }"); ticks(pg,40,False)
    for i in range(400):
        if pg.evaluate("() => ChromaGame.G.sim.canFire()"): pg.mouse.click(195,120)
        ticks(pg,10,False)
        if on(pg,'lose'): break
    shot('derrota')
    pg.evaluate("() => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); document.getElementById('settings').classList.add('on'); }"); pg.wait_for_timeout(600); shot('ajustes')
    print('errores', errs[:5])
    b.close()
ims=[Image.open(OUT+'t_'+n+'.png').convert('RGB') for n in names]
W=6; rows=(len(ims)+W-1)//W
sheet=Image.new('RGB',(390*W+10*(W-1),844*rows+10*(rows-1)),(22,18,42))
for i,im in enumerate(ims): sheet.paste(im,((i%W)*400,(i//W)*854))
sheet.save(OUT+'t_hoja.png'); print(names)
