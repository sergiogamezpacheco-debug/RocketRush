# Avisos personalizados antes del nivel (ayuda, jefe, pocas ventajas): salen, se compran (con dinero simulado o gemas) y no se repiten el mismo día
import json
from playwright.sync_api import sync_playwright
OUT='/home/claude/chroma3d/dist/shots/'
CASES=[('ayuda',33,{'lvFails':{'33':3}}),('jefe',20,{}),('ventajas',45,{'boosters':{'bomb':1,'rainbow':0,'extra':0,'rocket':0,'golden':0}})]
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    for tag,lv,extra in CASES:
        pg=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2).new_page(); pg.on('pageerror',lambda e: errs.append(str(e)))
        sv={'unlocked':60,'played':30,'birthYear':1990,'coins':4200,'gems':235,'tut':{'main':True,'tips':{'daily':1,'club':1,'shop':1}}}; sv.update(extra)
        pg.add_init_script("window.RR_OFFERS = true; window.RR_AGE = 30; window.RR_LIVE_OFF = true; window.RR_NO_INTRO = true; localStorage.setItem('rocketrush.lang','es'); localStorage.setItem('chromacrash3d.v1', JSON.stringify(%s))" % json.dumps(sv))
        pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(3500)
        pg.evaluate("() => document.getElementById('daily').classList.remove('on')")
        pg.evaluate(f"() => RRGame.openPre({lv})"); pg.wait_for_timeout(1800)
        print(tag, pg.evaluate("() => document.getElementById('liveBox').className"))
        pg.wait_for_timeout(1500); pg.screenshot(path=OUT+f'of2_{tag}.png', timeout=90000)
        if tag=='jefe':
            # el aviso dice que con gemas no se quitan los anuncios
            pg.wait_for_selector('#liveBox.on .ofgem', timeout=15000)
            print(' nota gemas:', pg.inner_text('#liveBox .ofpack em') + ' | ' + pg.inner_text('#liveBox .ofgem'))
            # comprar con gemas: se cierra, quedan marcadas y NO quita los anuncios
            pg.click('#lbBtns .btn.gold'); pg.wait_for_timeout(700)
            print(' anuncios quitados al pagar con gemas:', pg.evaluate("() => !!RRGame.save.adsRemoved"), '(debe ser False)')
            print(' tras gemas:', pg.evaluate("() => [document.getElementById('liveBox').classList.contains('on'), RRGame.save.gems, JSON.stringify(RRGame.save.boosters), [...document.querySelectorAll('#preBoosters .boost.sel')].map(e=>e.dataset.k).join(',')]"))
            pg.screenshot(path=OUT+'of2_jefe_tras.png')
            # reabrir: no sale otra vez hoy
            pg.evaluate("() => { document.getElementById('pre').classList.remove('on'); RRGame.openPre(20); }"); pg.wait_for_timeout(1200)
            print(' otra vez:', pg.evaluate("() => document.getElementById('liveBox').classList.contains('on')"))
        if tag=='ayuda':
            pg.click('#lbBtns .btn.green'); pg.wait_for_timeout(700)
            print(' tras comprar:', pg.evaluate("() => [document.getElementById('liveBox').classList.contains('on'), JSON.stringify(RRGame.save.boosters), [...document.querySelectorAll('#preBoosters .boost.sel')].map(e=>e.dataset.k).join(','), RRGame.save.adsRemoved]"))
        pg.close()
    b.close()
print('errores', errs[:4])
