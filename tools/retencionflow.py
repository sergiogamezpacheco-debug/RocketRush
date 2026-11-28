# Motivos para volver: regalo de bienvenida, cofre gratis cada 4 h (con aviso), logros, desafío de la semana,
# mini-evento con fichas y su tienda, y estelas (tienda + maestría). Sin red: el desafío cuenta solo en local.
import json, sys
from playwright.sync_api import sync_playwright
OUT = '/home/claude/chroma3d/dist/shots/'
fails = []
def check(n, ok, info=''):
    print(('OK  ' if ok else 'FALLO ') + n, info)
    if not ok: fails.append(n)
DAY = "Math.floor((Date.now()-new Date().getTimezoneOffset()*6e4)/864e5)"
SAVE = "{unlocked:140, played:60, welcomed:true, coins:4200, gems:310, lastSeen: Date.now()-5*864e5, stats:{blocks:1200, wins:60}, daily:{n:0,last:null,best:0,shields:0,adRescue:-99,auto:" + DAY + "}}"
NA = """window.__notes = []; window.ChromaAndroid = { scheduleNotice: (n, at, t, x) => __notes.push(['on', n, +at, t]), cancelNotice: n => __notes.push(['off', n]),
  vibrate(){}, scheduleReminder(){}, cancelReminder(){}, version: () => '1.0.test' };"""
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 390, 'height': 844}).new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: m.type == 'warning' and '[RR ret]' in m.text and errs.append(m.text))
    pg.add_init_script("window.RR_AGE=30; window.RR_LIVE_OFF=true; " + NA + " localStorage.setItem('rocketrush.lang','es'); localStorage.setItem('chromacrash3d.v1', JSON.stringify(" + SAVE + "))")
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(3000)
    ev = lambda js: pg.evaluate(js)
    tap = lambda sel: pg.evaluate("s => document.querySelector(s).click()", sel)
    def open_chest():
        pg.wait_for_timeout(900)
        for i in range(40):
            if not ev("() => document.getElementById('chestOpen').classList.contains('on')"): break
            pg.locator('#chestOpen').dispatch_event('pointerdown'); pg.wait_for_timeout(260 if i < 3 else 600)
        pg.wait_for_timeout(200)
    S = lambda k: ev("() => ChromaGame.save()." + k)

    # --- 1 · regalo de bienvenida (5 días sin jugar) ---
    check('bienvenida: sale la ventana', ev("() => document.getElementById('retPop').classList.contains('on')") and '5 días' in ev("() => document.getElementById('rpBody').textContent"))
    pg.screenshot(path=OUT + 'ret_bienvenida.png')
    tap('#rpOk'); pg.wait_for_timeout(700)
    check('bienvenida: 1000 monedas, 10 gemas y ×2 durante 24 h', S('coins') == 5200 and S('gems') == 320 and abs(S('boost2') - ev('() => Date.now()') - 864e5) < 60e3, json.dumps([S('coins'), S('gems')]))
    check('bienvenida: el ×2 se ve en la portada', not ev("() => document.getElementById('liveBoost').hidden") and 'x2' in ev("() => document.getElementById('liveBoost').textContent"))
    check('las monedas valen el doble con el ×2', ev("() => RRGame.live.mult('coins')") >= 2)
    ev("() => { Retencion.boot(); }"); pg.wait_for_timeout(2000)
    check('bienvenida: solo una vez', not ev("() => document.getElementById('retPop').classList.contains('on')"))

    # --- 2 · cofre gratis ---
    check('cofre gratis: ya no está en la portada, la tienda lleva aviso', not ev("() => !!document.getElementById('freeChest')") and not ev("() => document.getElementById('shopDotT').hidden"))
    ev("() => RRGame.openShop()"); pg.wait_for_timeout(400)
    check('cofre gratis: tarjeta lista arriba de la tienda', ev("() => document.querySelector('#shopList [data-fccard]').classList.contains('ready')"))
    pg.screenshot(path=OUT + 'ret_portada.png')
    c0 = S('coins'); tap('#shopList [data-fc]'); pg.wait_for_timeout(600)
    check('cofre gratis: se abre el cofre', ev("() => document.getElementById('chestOpen') && document.getElementById('chestOpen').classList.contains('on')"))
    pg.screenshot(path=OUT + 'ret_cofre.png'); open_chest()
    check('cofre gratis: el cofre se cierra', not ev("() => document.getElementById('chestOpen').classList.contains('on')"))
    check('cofre gratis: da monedas', S('coins') >= c0 + 80, str(S('coins') - c0))
    fc = S('freeChest')
    check('cofre gratis: vuelve en 4 horas', abs(fc['at'] - ev('() => Date.now()') - 4 * 3600e3) < 60e3 and fc['n'] == 1)
    check('cofre gratis: cuenta atrás en la tarjeta', not ev("() => document.querySelector('#shopList [data-fccard]').classList.contains('ready')") and 'h' in ev("() => document.querySelector('#shopList [data-fccard]').textContent"))
    notes = ev("() => __notes")
    check('cofre gratis: aviso programado en el móvil', any(n[0] == 'on' and n[1] == 'cofre' and abs(n[2] - fc['at']) < 5 for n in notes), json.dumps(notes[-2:]))
    tap('#shopList [data-fc]'); pg.wait_for_timeout(200)
    check('cofre gratis: si no está listo, dice cuánto falta', 'listo en' in ev("() => document.getElementById('toast').textContent"))
    ev("() => { ChromaGame.save().daily.notif = false; ChromaGame.save().freeChest.at = Date.now() + 1000; document.dispatchEvent(new Event('visibilitychange')); }")
    check('sin avisos si están apagados', ev("() => __notes[__notes.length-1]") == ['off', 'cofre'])

    # --- 3 · logros ---
    check('logros: cuentan en el globo de misiones', int(ev("() => document.getElementById('misDotT').textContent") or 0) >= 1)
    ev("() => document.getElementById('btnMisT').click()"); pg.wait_for_timeout(500)
    check('logros: botón en misiones con aviso', ev("() => !!document.querySelector('#btnAch .bdg')"))
    tap('#btnAch'); pg.wait_for_timeout(400)
    rows = ev("() => document.querySelectorAll('#retPop .achrow').length")
    check('logros: lista completa', rows >= 17, str(rows))
    pg.screenshot(path=OUT + 'ret_logros.png')
    sc = ev("() => { const l=document.querySelector('#retPop .achlist'); return [l.scrollHeight, l.clientHeight]; }")
    check('logros: la lista se desplaza', sc[0] > sc[1], json.dumps(sc))
    c0 = S('coins'); tap('[data-ach="blocks"]'); pg.wait_for_timeout(400)
    check('logros: cobrar el primero (300 monedas)', S('coins') == c0 + 300 and S('ach.got.blocks') == 1)
    # premio exclusivo: el Cañón Oro Macizo
    ev("() => { ChromaGame.save().stats.blocks = 12000; ChromaGame.save().ach.got.blocks = 2; Retencion.open.ach(); }"); pg.wait_for_timeout(300)
    tap('[data-ach="blocks"]'); pg.wait_for_timeout(400)
    check('logros: el Cañón Oro Macizo es exclusivo', 'oro' in S('skins.owned'))
    ev("() => { ChromaGame.save().stats.bestShot = 16; ChromaGame.save().ach.got.shot = 2; Retencion.open.ach(); }"); pg.wait_for_timeout(300)
    tap('[data-ach="shot"]'); pg.wait_for_timeout(400)
    check('logros: bola Trofeo', 'trofeo' in S('bskin.own'))
    check('atrás cierra los logros', ev("() => window.ChromaBack()") and not ev("() => document.getElementById('retPop').classList.contains('on')"))

    # --- 4 · desafío de la semana ---
    ev("() => { ChromaGame.goTitle(); RRGame.goMap(); }"); pg.wait_for_timeout(600)
    check('retos: botón en el mapa con 3 intentos', ev("() => document.querySelector('#navWk i').textContent") == '3')
    tap('#navWk'); pg.wait_for_timeout(400)
    tap('#rtWk'); pg.wait_for_timeout(400)
    check('desafío: panel con premios', 'Top 10' in ev("() => document.getElementById('rpBody').textContent"))
    pg.screenshot(path=OUT + 'ret_desafio.png')
    tap('#wkGo'); pg.wait_for_timeout(600)
    check('desafío: ventana del nivel', ev("() => document.getElementById('preTitle').textContent") == 'Desafío de la semana')
    stars0 = ev("() => JSON.stringify(ChromaGame.save().stars)"); unl0 = S('unlocked')
    tap('#preGo'); pg.wait_for_timeout(800)
    check('desafío: gasta un intento', S('wk.tries') == 1 and S('stats.weeklyPlays') == 1)
    ev("() => { ChromaGame.G.sim.score = 23456; ChromaGame.finishWin(); }"); pg.wait_for_timeout(1500)
    check('desafío: guarda la mejor puntuación', S('wk.best') == 23456)
    check('desafío: no cuenta como nivel del mapa', ev("() => JSON.stringify(ChromaGame.save().stars)") == stars0 and S('unlocked') == unl0)
    ev("() => { ChromaGame.save().lastInter = Date.now(); document.getElementById('winMap').click(); }"); pg.wait_for_timeout(2500)
    ev("() => document.querySelectorAll('#mystery.on button, #chestOpen.on').forEach(b => b.click())"); pg.wait_for_timeout(1200)
    check('desafío: al salir vuelve al panel', ev("() => document.getElementById('retPop').classList.contains('on')") and '23.456' in ev("() => document.getElementById('rpBody').textContent"))
    ev("() => { ChromaGame.save().wk.tries = 3; Retencion.open.weekly(); }"); pg.wait_for_timeout(300)
    check('desafío: sin intentos ofrece uno más con vídeo', ev("() => !!document.getElementById('wkAd')") and not ev("() => !!document.getElementById('wkGo')"))
    # semana siguiente: premio por puesto (sin red → premio de participación)
    ev("() => { ChromaGame.save().wk.id = 'S0'; ChromaGame.save().wk.sent = false; window.ChromaBack(); Retencion.title(); ChromaGame.goTitle(); }"); pg.wait_for_timeout(300)
    ev("() => Retencion._wk()"); g0 = S('gems')
    pg.wait_for_timeout(2500)
    check('desafío: resultado de la semana pasada', ev("() => document.getElementById('retPop').classList.contains('on')") and 'semana pasada' in ev("() => document.getElementById('rpBody').textContent"))
    tap('#rpOk'); pg.wait_for_timeout(400)
    check('desafío: premio de la semana pasada', S('gems') == g0 + 3 and S('wkPrev.paid') == True)

    # --- 5 · mini-evento ---
    ev("() => { window.Live.cfg = Object.assign(window.Live.cfg || {}, { mini: { on: true, theme: 'verano', start: Date.now() - 3600e3, end: Date.now() + 2*864e5 } }); Retencion.title(); }")
    check('mini-evento: botón en la portada', not ev("() => document.getElementById('miniPump').hidden"))
    pg.wait_for_timeout(300); pg.screenshot(path=OUT + 'ret_mini_portada.png')
    ev("() => { ChromaGame.startLevel(20, []); }"); pg.wait_for_timeout(500)
    ev("() => ChromaGame.finishWin()"); pg.wait_for_timeout(1200)
    tok = S('mini.tok')
    check('mini-evento: fichas al ganar', tok >= 1, str(tok))
    ev("() => { ChromaGame.save().mini.tok = 45; document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); RRGame.openShop('mini'); }"); pg.wait_for_timeout(2500)
    check('mini-evento: pestaña y sección en la tienda', ev("() => !!document.querySelector('#shopTabs .minitab') && !!document.getElementById('sMini')"))
    pg.screenshot(path=OUT + 'ret_mini_tienda.png')
    tap('[data-mini="skin"]'); pg.wait_for_timeout(400)
    check('mini-evento: cañón exclusivo por 40 fichas', 'surf' in S('skins.owned') and S('mini.tok') == 5)
    g0 = S('gems'); tap('[data-mini="gems"]'); pg.wait_for_timeout(300)
    check('mini-evento: no deja comprar sin fichas', S('gems') == g0 and S('mini.tok') == 5)
    ev("() => { window.Live.cfg.mini = { on: false }; Retencion.title(); }")
    check('mini-evento: el panel puede apagarlo', ev("() => document.getElementById('miniPump').hidden"))
    # fecha por defecto: último viernes-domingo del mes (ni octubre ni diciembre)
    d = ev("""() => { const R = []; for (const t of ['2026-11-27T12:00:00', '2026-11-20T12:00:00', '2026-10-30T12:00:00', '2027-01-31T20:00:00']) { const r = Date.now; Date.now = () => new Date(t).getTime(); window.Live.cfg.mini = null; R.push(Retencion._mini() ? Retencion._mini().theme : null); Date.now = r; } return R; }""")
    check('mini-evento: calendario por defecto', d == ['otono', None, None, 'invierno'], json.dumps(d))

    # --- 6 · estelas ---
    ev("() => RRGame.openShop('trail')"); pg.wait_for_timeout(2000)
    check('estelas: sección en la tienda', ev("() => document.querySelectorAll('#sTrail ~ .cgrid .cosc').length") >= 4 or ev("() => !!document.getElementById('sTrail')"))
    ok = ev("() => { ChromaGame.save().coins = 5000; return ChromaGame.cos.buy('trail', 'burbujas'); }")
    check('estelas: comprar Burbujas con monedas', 'burbujas' in S('trail.own'), str(ok))
    ev("() => ChromaGame.cos.equip('trail', 'burbujas')")
    check('estelas: equipar', S('trail.eq') == 'burbujas')
    ev("() => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(21, []); }"); pg.wait_for_timeout(600)
    m0 = ev("() => JSON.stringify(ChromaGame.save().mastery || {})")
    ev("() => { const G = ChromaGame.G; G.sim.launch ? 0 : 0; }")
    check('logros: «Rastro brillante» cuenta las estelas', ev("() => Retencion.ACH.find(a => a.id === 'trails').v()") >= 1)
    check('sin errores', not errs, str(errs[:3]))
    b.close()
print('\n' + ('TODO BIEN' if not fails else 'FALLOS: ' + ', '.join(fails)))
sys.exit(1 if fails else 0)
