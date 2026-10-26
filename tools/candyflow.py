# Bloques de caramelo de Halloween: el consejo de Cubi señala uno y, al romperlo, el caramelo vuela al contador
from playwright.sync_api import sync_playwright
OUT='/home/claude/chroma3d/dist/shots/candy_'
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    pg=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True).new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.add_init_script("window.RR_TUT_TEST=true; localStorage.setItem('rocketrush.lang','es'); if(!sessionStorage.g){sessionStorage.g=1;localStorage.setItem('chromacrash3d.v1', JSON.stringify({unlocked:23, played:5, tut:{main:true,tips:{}}}))}")
    pg.route('**/*googleapis.com/**', lambda r: r.abort())
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2500)
    pg.evaluate("() => { document.getElementById('daily').classList.remove('on'); RRGame.save.tut.tips = {shop:1,pass:1,missions:1,social:1,daily:1,hw:1,boss:1}; document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(20003, []); ChromaGame.manual(true); for(let i=0;i<60;i++) ChromaGame.tick(1/30,true); ChromaGame.render(); }")
    pg.wait_for_function("() => Tutorial.visible && Tutorial.step === 'candy'", timeout=30000); pg.wait_for_timeout(500)
    print('consejo:', pg.evaluate("() => document.querySelector('#tut .tu-tt').textContent"), '· caramelos', pg.evaluate("() => ChromaGame.G.candies.map(c=>c.n)"))
    pg.screenshot(path=OUT+'tip.png')
    pg.click('#tut .tu-bub'); pg.wait_for_timeout(300)
    c0=pg.evaluate("() => RRGame.save.candy || 0")
    pg.evaluate("() => { const G=ChromaGame.G; G.sim.blocks[G.candies.find(c=>c.n===2).id].userData.alive=false; ChromaGame.tick(1/30,true); ChromaGame.render(); }"); pg.wait_for_timeout(250)
    pg.screenshot(path=OUT+'fly.png')
    pg.wait_for_timeout(800)
    print('caramelos:', c0, '→', pg.evaluate("() => RRGame.save.candy"), '· errores', errs[:3]); b.close()
