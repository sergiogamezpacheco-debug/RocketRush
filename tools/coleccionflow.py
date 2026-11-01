# Mi colección (perfil) y el cañón de antes de jugar (3 huecos + cajón): ver, filtrar, poner, candados y desplazarse.
import json, sys
from playwright.sync_api import sync_playwright
OUT = '/home/claude/chroma3d/dist/shots/'
fails = []
def check(n, ok, info=''):
    print(('OK  ' if ok else 'FALLO ') + n, info)
    if not ok: fails.append(n)
SAVE = "{unlocked:14, welcomed:true, coins:4200, gems:310, skins:{owned:['classic','cobre','pirata','galaxia','volcan','royal'],equip:'galaxia'}, can:{lv:3,own:['base','doble'],eq:'base'}, bskin:{own:['clasica','playa','canica','planeta'],eq:'canica'}, daily:{n:0,last:null,best:0,shields:0,adRescue:-99,auto:Math.floor((Date.now()-new Date().getTimezoneOffset()*6e4)/864e5)}}"
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 390, 'height': 844}).new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script("window.RR_AGE=30; window.RR_LIVE_OFF=true; localStorage.setItem('rocketrush.lang','es'); localStorage.setItem('chromacrash3d.v1', JSON.stringify(" + SAVE + "))")
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(1500)
    ev = lambda js: pg.evaluate(js)
    ev("() => { ChromaGame.manual(true); document.querySelectorAll('.screen.dim').forEach(s=>s.classList.remove('on')); document.getElementById('btnSocT').click(); }"); pg.wait_for_timeout(600)
    ev("() => document.querySelector('#socTabs [data-t=me]').click()"); pg.wait_for_timeout(600)
    c = ev("() => [document.querySelector('#colMount .colhead small').textContent, document.querySelectorAll('#colMount .colit').length, document.querySelectorAll('#colMount .colit.lock').length]")
    check('perfil: colección con aspectos', c[0] == '13 de 61' and c[1] == 32 and c[2] == 26, json.dumps(c))
    ev("() => { const L=document.getElementById('socList'), m=document.getElementById('colMount'); L.scrollTop = m.offsetTop - L.offsetTop - 120; }"); pg.wait_for_timeout(2500)
    pg.screenshot(path=OUT + 'col1_perfil.png')
    sc = ev("() => { const g=document.querySelector('#colMount .colgrid'); return [g.scrollHeight, g.clientHeight]; }")
    check('la cuadrícula se desplaza si es grande', sc[0] > sc[1], json.dumps(sc))
    # poner otro aspecto desde el perfil
    pg.click('#colMount [data-col="skin:pirata"]'); pg.wait_for_timeout(300)
    check('poner desde el perfil', ev("() => ChromaGame.save().skins.equip") == 'pirata')
    # uno con candado: no se pone, dice cómo conseguirlo
    pg.click('#colMount [data-col="skin:neon"]'); pg.wait_for_timeout(200)
    t = ev("() => document.getElementById('toast').textContent")
    check('candado: dice cómo conseguirlo', ev("() => ChromaGame.save().skins.equip") == 'pirata' and 'gemas en la tienda' in t, t)
    # filtros
    pg.click('#colMount [data-colf="model"]'); pg.wait_for_timeout(300)
    check('filtro cañones', ev("() => document.querySelectorAll('#colMount .colit').length") == 6)
    pg.click('#colMount [data-col="model:doble"]'); pg.wait_for_timeout(200)
    check('poner el cañón doble', ev("() => ChromaGame.save().can.eq") == 'doble')
    pg.click('#colMount [data-colf="ball"]'); pg.wait_for_timeout(2500)
    pg.screenshot(path=OUT + 'col2_bolas.png')
    check('filtro bolas', ev("() => document.querySelectorAll('#colMount .colit').length") == 13)
    # ventana del nivel: 3 huecos y cajón
    ev("() => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); RRGame.openPre(5); }"); pg.wait_for_timeout(500)
    sl = ev("() => [...document.querySelectorAll('#preLoad .lslot b')].map(x => x.textContent)")
    check('4 huecos en la ventana del nivel', len(sl) == 4 and sl[1] == 'Pirata' and sl[2] == 'Canica' and sl[3] == 'Normal', json.dumps(sl))
    ev("() => { const s=document.getElementById('preScroll'); s.scrollTop = s.scrollHeight; }"); pg.wait_for_timeout(2500)
    pg.screenshot(path=OUT + 'col3_nivel.png')
    pg.click('#preLoad [data-ls="ball"]'); pg.wait_for_timeout(2500)
    check('cajón abierto', ev("() => document.getElementById('cosSheet').classList.contains('on')") and ev("() => document.querySelectorAll('#csGrid .colit').length") == 13)
    pg.screenshot(path=OUT + 'col4_cajon.png')
    pg.click('#csGrid [data-col="ball:playa"]'); pg.wait_for_timeout(300)
    check('elegir bolas en el cajón', ev("() => ChromaGame.save().bskin.eq") == 'playa' and not ev("() => document.getElementById('cosSheet').classList.contains('on')") and ev("() => document.querySelectorAll('#preLoad .lslot b')[2].textContent") == 'Pelota de playa')
    # cerrar tocando fuera y con «atrás»
    pg.click('#preLoad [data-ls="skin"]'); pg.wait_for_timeout(300); pg.mouse.click(195, 60); pg.wait_for_timeout(200)
    check('tocar fuera cierra el cajón', not ev("() => document.getElementById('cosSheet').classList.contains('on')"))
    pg.click('#preLoad [data-ls="model"]'); pg.wait_for_timeout(300)
    check('atrás cierra el cajón y no la ventana', ev("() => window.ChromaBack()") and not ev("() => document.getElementById('cosSheet').classList.contains('on')") and ev("() => document.getElementById('pre').classList.contains('on')"))
    # jugar con lo elegido
    pg.click('#preGo'); pg.wait_for_timeout(500)
    o = ev("() => [ChromaGame.cos.out().model, ChromaGame.G.sim.pw && ChromaGame.G.sim.pw.f]")
    check('se juega con el cañón elegido', o[0] == 'doble' and abs(o[1] - 1.375) < 1e-6, json.dumps(o))
    check('sin errores', not errs, str(errs[:3]))
    b.close()
print('FALLOS:', fails) if fails else print('todo bien')
sys.exit(1 if fails else 0)
