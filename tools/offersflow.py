# Prueba de la tienda: doble en la primera compra, oferta de la semana (una vez por semana) y 0,99 € sin quitar anuncios
from playwright.sync_api import sync_playwright
OUT='/home/claude/chroma3d/tmp_scratch/'; errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    pg=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2).new_page(); pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.add_init_script("window.RR_AGE = 30; window.RR_LIVE_OFF = true; window.RR_NO_INTRO = true; localStorage.setItem('rocketrush.lang','es'); localStorage.setItem('chromacrash3d.v1', JSON.stringify({unlocked: 60, played: 30, birthYear: 1990, coins: 4200, gems: 35, tut: {main: true, tips: {daily: 1, club: 1, shop: 1}}}))")
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(3500)
    pg.evaluate("() => { document.getElementById('daily').classList.remove('on'); RRGame.openShop(); }"); pg.wait_for_timeout(900)
    pg.screenshot(path=OUT+'of2_tienda1.png')
    pg.evaluate("() => { const L=document.getElementById('shopList'), e=document.getElementById('sGem'); L.scrollTop = e.offsetTop - L.offsetTop - 4; }"); pg.wait_for_timeout(500)
    pg.screenshot(path=OUT+'of2_tienda3.png')
    clk="(id) => document.querySelector('button[data-id='+id+']').click()"
    g0=pg.evaluate("() => RRGame.save.gems"); pg.evaluate(clk,'g1'); pg.wait_for_timeout(300); g1=pg.evaluate("() => RRGame.save.gems")
    pg.evaluate(clk,'g1'); pg.wait_for_timeout(300); g2=pg.evaluate("() => RRGame.save.gems")
    print('x2 primera:', g1-g0, 'segunda:', g2-g1, 'anuncios quitados por 0,99:', pg.evaluate("() => !!RRGame.save.adsRemoved"))
    c0=pg.evaluate("() => RRGame.save.coins"); pg.evaluate(clk,'semanal'); pg.wait_for_timeout(300)
    print('semanal:', pg.evaluate("() => [RRGame.save.weekBuy, RRGame.save.adsRemoved, !!document.querySelector('.wkoff.done'), RRGame.save.coins]"), c0)
    pg.evaluate(clk,'semanal') if pg.query_selector('button[data-id=semanal]') else print('semanal: ya no se puede volver a comprar esta semana')
    b.close()
print('errores', errs[:4])
