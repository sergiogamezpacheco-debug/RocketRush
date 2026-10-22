# Racha diaria: aparición automática, recoger, x2, cofres, escudo, peligro/rescate, pérdida, día 30 y aviso Android
from playwright.sync_api import sync_playwright
from PIL import Image
OUT='/home/claude/chroma3d/dist/shots/'
def ticks(pg,n,render=False): pg.evaluate(f"() => {{ for(let i=0;i<{n};i++) ChromaGame.tick(1/30, true); {'ChromaGame.render();' if render else ''} }}")
def ev(pg,js): return pg.evaluate(js)
def on(pg,id): return ev(pg,f"() => document.getElementById('{id}').classList.contains('on')")
def txt(pg,id): return ev(pg,f"() => document.getElementById('{id}').textContent")
def st(pg): return ev(pg,"() => JSON.stringify(ChromaGame.dailyStatus())")

def claim(pg, shots=None):
    """Recoge el premio; si es un cofre, juega la apertura entera (3 toques, recoger cada premio y resumen)."""
    pg.click('#dClaim'); pg.wait_for_timeout(250)
    if not pg.evaluate("() => document.getElementById('chestOpen').classList.contains('on')"): return
    pg.wait_for_timeout(900)
    for i in range(40):
        if not pg.evaluate("() => document.getElementById('chestOpen').classList.contains('on')"): break
        pg.locator('#chestOpen').dispatch_event('pointerdown'); pg.wait_for_timeout(260 if i < 3 else 700)
        if shots and i in shots: pg.screenshot(path=OUT+shots[i])
    pg.wait_for_timeout(200)
def d(pg): return ev(pg,"() => JSON.stringify(ChromaGame.save().daily)")
FAKE = "window.ChromaAndroid={scheduleReminder:(a,t,x)=>{window.__rem=[new Date(+a).toString().slice(0,21),t,x]},cancelReminder:()=>{window.__rem='cancelado'},askNotifications:()=>{window.__asked=true},vibrate:()=>{}};"
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    # 0) jugador nuevo: no hay racha hasta ganar el nivel 1
    pg=b.new_context(viewport={'width':360,'height':780}).new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.add_init_script("localStorage.setItem('rocketrush.lang','es')")
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2200); ev(pg,"() => ChromaGame.manual(true)")
    print('nuevo, en la portada a los 2 s: ventana', on(pg,'daily'))
    pg.click('#btnPlay'); ticks(pg,1)
    print('nuevo: chip visible', not ev(pg,"() => document.getElementById('btnDailyT').hidden"), '· ventana', on(pg,'daily'), '· pre nivel 1', on(pg,'pre'))
    pg.close()
    # 1) jugador con niveles ganados
    ctx=b.new_context(viewport={'width':360,'height':780}); pg=ctx.new_page(); pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.add_init_script("localStorage.setItem('rocketrush.lang','es')")
    pg.add_init_script(FAKE+"if(!sessionStorage.x){sessionStorage.x=1;localStorage.setItem('chromacrash3d.v1', JSON.stringify({unlocked:6, stars:{1:3,2:3,3:2,4:3,5:1}, coins:800, gems:5}))}")
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); t0=ev(pg,"() => performance.now()"); ev(pg,"() => ChromaGame.manual(true)")
    ticks(pg,1,True); pg.screenshot(path=OUT+'d0_titulo.png')
    print('portada recién cargada: ventana', on(pg,'daily'), '·', txt(pg,'btnDailyT'))
    pg.wait_for_function("() => document.getElementById('daily').classList.contains('on')", timeout=5000); t1=ev(pg,"() => performance.now()")
    ticks(pg,1,True); pg.screenshot(path=OUT+'d1_primera.png')
    print('se abre sola a los %.1f s de cargar: ventana' % ((t1-t0)/1000), on(pg,'daily'), '·', txt(pg,'dTitle'), '· modo', ev(pg,"() => ChromaGame.G.mode"))
    print('X visible:', not ev(pg,"() => document.getElementById('dX').hidden"))
    pg.click('#dX'); ticks(pg,1)
    print('cerrar con la X: ventana', on(pg,'daily'), '· sigue en', ev(pg,"() => ChromaGame.G.mode"), '· punto en la portada', not ev(pg,"() => document.getElementById('dailyDotT').hidden"))
    pg.click('#btnDailyT', force=True); pg.wait_for_timeout(200)
    claim(pg); pg.wait_for_timeout(500); pg.screenshot(path=OUT+'d2_recogido.png')
    print('día 1 →', txt(pg,'dTitle'), '|', txt(pg,'dSub'), '| premios:', ev(pg,"() => document.querySelector('.drew').innerText.replace(/\\n/g,' ')"), '| monedas', ev(pg,"() => ChromaGame.save().coins"))
    pg.click('#dNotify2'); print('permiso pedido:', ev(pg,"() => window.__asked"), '· aviso:', ev(pg,"() => JSON.stringify(window.__rem)"))
    pg.click('#dClose2'); ticks(pg,1,True); pg.screenshot(path=OUT+'d3_mapa.png')
    print('tras ¡A JUGAR! desde la portada: modo', ev(pg,"() => ChromaGame.G.mode"))
    print('mapa: llama', txt(pg,'dailyN'), '· punto', not ev(pg,"() => document.getElementById('dailyDot').hidden"))
    pg.click('#btnHome'); pg.click('#btnPlay'); ticks(pg,1)
    print('segunda vez el mismo día, ¿se abre sola?', on(pg,'daily'))
    # 2) día 2 con x2 (vídeo simulado)
    ev(pg,"() => ChromaGame.shiftDays(1)")
    pg.click('#btnHome'); ev(pg,"() => window.ChromaResume()"); pg.wait_for_timeout(1800)
    print('día 2, al volver a la app:', on(pg,'daily'), txt(pg,'dTitle'), '· bombas antes', ev(pg,"() => ChromaGame.save().boosters.bomb"))
    pg.click('#dDouble'); pg.wait_for_timeout(3800)
    print('x2 →', txt(pg,'dTitle'), '· bombas', ev(pg,"() => ChromaGame.save().boosters.bomb"))
    pg.click('#dClose2')
    # 3) días 3 y 4, y el cofre del día 5
    for k in range(2):
        ev(pg,"() => ChromaGame.shiftDays(1)"); pg.click('#btnDaily'); claim(pg); pg.wait_for_timeout(200); pg.click('#dClose2')
    ev(pg,"() => ChromaGame.shiftDays(1)"); pg.click('#btnDaily'); pg.wait_for_timeout(300); pg.screenshot(path=OUT+'d4_dia5.png')
    print('día 5:', txt(pg,'dTitle'), '|', ev(pg,"() => document.getElementById('dNext').innerText"))
    claim(pg, {1:'d5_cofre_agita.png', 2:'d5b_estallido.png', 3:'d6_premio.png', 6:'d6b_resumen.png'})
    pg.screenshot(path=OUT+'d6_cofre_abierto.png')
    print('cofre →', txt(pg,'dTitle'), '| premios:', ev(pg,"() => document.querySelector('.drew').innerText.replace(/\\n/g,' ')"), '| aviso:', ev(pg,"() => JSON.stringify(window.__rem)"))
    pg.click('#dClose2')
    # 4) saltar al día 10 (cofre de plata con escudo) y faltar un día con escudo
    ev(pg,"() => { const s=ChromaGame.save(); s.daily.n=9; s.daily.last=ChromaGame.shiftDays(1)-1; }")
    pg.click('#btnDaily'); claim(pg); pg.wait_for_timeout(1300)
    print('día 10 →', ev(pg,"() => document.querySelector('.drew').innerText.replace(/\\n/g,' ')"), '· escudos', ev(pg,"() => ChromaGame.save().daily.shields"))
    pg.click('#dClose2')
    ev(pg,"() => ChromaGame.shiftDays(2)"); pg.click('#btnDaily'); pg.wait_for_timeout(300); pg.screenshot(path=OUT+'d7_escudo.png')
    print('falta 1 día con escudo:', txt(pg,'dTitle'), '|', txt(pg,'dSub'))
    claim(pg); pg.wait_for_timeout(200); print('   → racha', ev(pg,"() => ChromaGame.save().daily.n"), '· escudos', ev(pg,"() => ChromaGame.save().daily.shields")); pg.click('#dClose2')
    # 5) falta 1 día sin escudo: racha en peligro y rescate con gemas (sin gemas suficientes -> tienda)
    ev(pg,"() => { ChromaGame.save().gems = 5; ChromaGame.shiftDays(2); }"); pg.click('#btnDaily'); pg.wait_for_timeout(300); pg.screenshot(path=OUT+'d8_peligro.png')
    print('peligro:', txt(pg,'dTitle'), '| botones:', ev(pg,"() => [...document.querySelectorAll('#dBtns button')].map(b=>b.innerText).join(' / ')"))
    pg.click('#dSaveGem'); ticks(pg,1); print('   sin gemas → tienda abierta:', on(pg,'shop'), '· encima de la racha:', ev(pg,"() => getComputedStyle(document.getElementById('shop')).zIndex"))
    pg.click('button[data-id="g1"]'); pg.click('#shopClose')
    pg.click('#dSaveGem'); pg.wait_for_timeout(200)
    print('   salvada:', txt(pg,'dSub'), '· gemas', ev(pg,"() => ChromaGame.save().gems"), '·', st(pg))
    claim(pg); pg.wait_for_timeout(200); pg.click('#dClose2')
    # 6) faltar 3 días: se pierde
    ev(pg,"() => ChromaGame.shiftDays(4)"); pg.click('#btnDaily'); pg.wait_for_timeout(300); pg.screenshot(path=OUT+'d9_perdida.png')
    print('perdida:', txt(pg,'dTitle'), '|', txt(pg,'dSub'), '| aviso:', ev(pg,"() => JSON.stringify(window.__rem)"))
    claim(pg); pg.wait_for_timeout(200); print('   nueva racha', ev(pg,"() => ChromaGame.save().daily.n"), '· mejor', ev(pg,"() => ChromaGame.save().daily.best")); pg.click('#dClose2')
    # 7) día 30: cofre legendario con el Cañón de Fuego
    ev(pg,"() => { const s=ChromaGame.save(); s.daily.n=29; s.daily.last=ChromaGame.shiftDays(1)-1; }")
    pg.click('#btnDaily'); pg.wait_for_timeout(300); pg.screenshot(path=OUT+'d10_dia30.png')
    claim(pg); pg.wait_for_timeout(1400); pg.screenshot(path=OUT+'d11_legendario.png')
    print('día 30 →', ev(pg,"() => document.querySelector('.drew').innerText.replace(/\\n/g,' ')"), '· cañón', ev(pg,"() => ChromaGame.save().skins.equip"))
    pg.click('#dClose2')
    ev(pg,"() => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(5, []); }"); ticks(pg,40,True)
    pg.screenshot(path=OUT+'d12_canon_fuego.png')
    # 8) cambio de día a mitad de sesión: al volver al mapa tras ganar, aparece y luego sigue al nivel
    ev(pg,"() => ChromaGame.shiftDays(1)")
    ev(pg,"() => { for (const b of ChromaGame.G.sim.blocks) b.position.y -= 20; }")
    for i in range(30):
        ticks(pg,15)
        if on(pg,'win'): break
    pg.wait_for_timeout(1300); pg.click('#winNext'); ticks(pg,1)
    print('tras ganar y SIGUIENTE: racha', on(pg,'daily'), txt(pg,'dTitle'))
    claim(pg); pg.wait_for_timeout(200); pg.click('#dClose2'); ticks(pg,1)
    print('   después se abre el nivel siguiente:', on(pg,'pre'), txt(pg,'preTitle'))
    # ajustes
    pg.click('#preBack'); pg.click('#btnHome'); pg.click('#btnSetT'); pg.click('#sNotif')
    print('ajustes:', txt(pg,'sNotif'), '· aviso:', ev(pg,"() => JSON.stringify(window.__rem)"))
    print('errores', errs[:5]); b.close()
names=['d0_titulo','d1_primera','d2_recogido','d3_mapa','d4_dia5','d5_cofre_agita','d6_cofre_abierto','d7_escudo','d8_peligro','d9_perdida','d10_dia30','d11_legendario','d12_canon_fuego']
ims=[Image.open(OUT+n+'.png').convert('RGB').resize((270,585)) for n in names]
for k in range(0,len(ims),7):
    part=ims[k:k+7]; sheet=Image.new('RGB',(270*len(part),585))
    for i,im in enumerate(part): sheet.paste(im,(270*i,0))
    sheet.save(OUT+f'daily_sheet{k//7}.png')
