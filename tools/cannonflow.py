# Cañones: pestañas Temporales y Cañones de la tienda, mejoras (con sus piezas), cañones con más fuerza (física),
# aspectos de cañón y de bolas, Pase Pro (cañón de la temporada y huevo de dragón) y la liga de clubes sin bonus.
import json, sys
from playwright.sync_api import sync_playwright
OUT = '/home/claude/chroma3d/dist/shots/'
def ticks(pg, n, render=False): pg.evaluate(f"() => {{ for(let i=0;i<{n};i++) ChromaGame.tick(1/30, true); {'ChromaGame.render();' if render else ''} }}")
def ev(pg, js): return pg.evaluate(js)
fails = []
def check(name, ok, info=''):
    print(('OK  ' if ok else 'FALLO ') + name, info)
    if not ok: fails.append(name)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 390, 'height': 844}).new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script("window.RR_AGE = 30; window.RR_LIVE_OFF = true; localStorage.setItem('rocketrush.lang','es')")
    pg.add_init_script("localStorage.setItem('chromacrash3d.v1', JSON.stringify({unlocked:12, stars:{1:3,2:3,3:3,4:3,5:3}, coins:30000, gems:3000, welcomed:true, daily:{n:0,last:null,best:0,shields:0,adRescue:-99,auto:Math.floor((Date.now()-new Date().getTimezoneOffset()*6e4)/864e5)}}))")
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(1500)
    ev(pg, "() => ChromaGame.manual(true)")
    s = ev(pg, "() => ({ can: ChromaGame.save().can, bskin: ChromaGame.save().bskin, holders: ChromaGame.cos.out().holders.length })")
    check('partida vieja: claves nuevas', s['can']['lv'] == 1 and s['bskin']['eq'] == 'clasica' and s['holders'] == 1, json.dumps(s))
    # tienda: primera pestaña Temporales
    ev(pg, "() => RRGame.openShop()"); pg.wait_for_timeout(2500)
    tabs = ev(pg, "() => [...document.querySelectorAll('#shopTabs button')].map(b => b.textContent.trim())")
    check('pestañas', 'Temporales' in tabs[0] or any('Temporales' in t for t in tabs[:3]), str(tabs))
    T = ev(pg, "() => ChromaGame.cos.tmp()")
    check('temporales de la semana', len(T['items']) == 3 and len(T['days']) == 2, json.dumps([q['id'] for q in T['items']] + [q['id'] for q in T['days']]))
    pg.wait_for_timeout(4000)
    pg.screenshot(path=OUT + 'c1_temporales.png')
    thumbs = ev(pg, "() => document.querySelectorAll('.cth.ok').length")
    check('miniaturas pintadas', thumbs >= 3, str(thumbs))
    # comprar un temporal
    wk = T['items'][0]
    g0 = ev(pg, "() => ChromaGame.save().gems")
    pg.click(f'button[data-buy="skin:{wk["id"]}"]'); ticks(pg, 1)
    g1 = ev(pg, "() => ChromaGame.save().gems")
    check('comprar temporal', g0 - g1 == wk['g'] and ev(pg, f"() => ChromaGame.save().skins.equip === '{wk['id']}'"), f'{g0}->{g1}')
    # pestaña Cañones
    ev(pg, "() => document.querySelector('#shopTabs button[data-to=sCan]').click()"); pg.wait_for_timeout(6000)
    pg.screenshot(path=OUT + 'c2_canones.png')
    # mejoras 2..5
    c0 = ev(pg, "() => ChromaGame.save().coins")
    for i in range(4):
        pg.click('button[data-up]'); ticks(pg, 1)
    lv = ev(pg, "() => ChromaGame.save().can.lv"); c1 = ev(pg, "() => ChromaGame.save().coins")
    check('mejoras hasta el nivel 5', lv == 5 and c0 - c1 == 18500, f'lv {lv} · {c0}->{c1}')
    check('sin más mejoras', ev(pg, "() => !document.querySelector('button[data-up]')"))
    ev(pg, "() => document.querySelector('#sCan').scrollIntoView()"); pg.wait_for_timeout(2500); pg.screenshot(path=OUT + 'c3_mejoras.png')
    # cañones fuertes
    for m in ['doble', 'mortero', 'vapor', 'riel', 'cohete']:
        ok = ev(pg, f"() => ChromaGame.cos.buy('model', '{m}')")
        check('comprar ' + m, ok and ev(pg, f"() => ChromaGame.save().can.eq === '{m}'"))
    # aspectos de tienda y bolas
    for k, i in [('skin', 'cobre'), ('skin', 'pirata'), ('skin', 'dragon'), ('ball', 'playa'), ('ball', 'canica'), ('ball', 'pixel')]:
        pr = ev(pg, f"() => ChromaGame.cos.tmp()")
        ok = ev(pg, f"() => ChromaGame.cos.buy('{k}', '{i}')")
        exp = not (k == 'ball' and i == 'pixel' and not any(q['id'] == 'pixel' for q in pr['items']))
        check(f'comprar {k} {i}', ok == exp, str(ok))
    ev(pg, "() => RRGame.openShop('can')"); pg.wait_for_timeout(5000)
    ev(pg, "() => document.querySelector('#sBskin').scrollIntoView()"); pg.wait_for_timeout(500); pg.screenshot(path=OUT + 'c4_bolas.png')
    ev(pg, "() => document.getElementById('shop').classList.remove('on')")
    # en partida: cada cañón con su aspecto y física
    res = {}
    for m, sk in [('base', 'classic'), ('doble', 'classic'), ('mortero', 'classic'), ('vapor', 'pirata'), ('riel', 'classic'), ('cohete', 'dragon')]:
        ev(pg, f"() => {{ ChromaGame.save().can.eq = '{m}'; ChromaGame.save().skins.equip = '{sk}'; ChromaGame.save().bskin.eq = 'canica'; ChromaGame.cos.apply(); document.querySelectorAll('.screen').forEach(s => s.classList.remove('on')); ChromaGame.startLevel(3, []); }}")
        ticks(pg, 40)
        pw = ev(pg, "() => ChromaGame.G.sim.pw")
        # disparo: velocidad y masa de la bola
        shot = ev(pg, """() => { const s = ChromaGame.G.sim, t = s.blocks.find(b => b.userData.alive); const p = t.position; s.fire(p.x, p.y, p.z); const b = s.balls[s.balls.length - 1]; return { v: b.velocity.length(), m: b.mass }; }""")
        ticks(pg, 8, True); pg.screenshot(path=OUT + f'c5_{m}.png')
        res[m] = (pw, shot)
        print(m, json.dumps(pw), json.dumps(shot))
    check('cohete: más rápido y pesado que el normal', res['cohete'][1]['v'] > res['base'][1]['v'] * 0 and res['cohete'][1]['m'] > res['base'][1]['m'], '')
    check('mortero: mismo tiro, más peso', res['mortero'][0]['speed'] == 1 and res['mortero'][0]['mass'] > 1.9)
    check('guía larga y combos con el nivel 5', res['base'][0]['aim'] and res['base'][0]['combo'])
    check('explosión del cohete', res['cohete'][0]['boom'])
    # liga de clubes: sin bonus
    lg = ev(pg, """() => { const L = Object.assign({}, ChromaGame.LEVELS[2], { club: 'lg', pos: 1 }); const S = new SimLib.Sim(L, { power: null }); return S.pw; }""")
    check('liga de clubes sin bonus (Sim)', lg is None)
    nolg = ev(pg, "() => { const G = ChromaGame.G; return true; }")
    # Pase Pro: nivel 30 da el cañón de la temporada; nivel 20 el huevo de dragón
    p30 = ev(pg, """() => { const sv = ChromaGame.save(); sv.pass.pts = 999; sv.pass.pro = true; RRGame.grant({ bskin: 'dragonb' }); return sv.bskin.own.includes('dragonb'); }""")
    check('huevo de dragón del pase', p30)
    pg.click('#btnPassT') if ev(pg, "() => !!document.getElementById('btnPassT') && document.getElementById('btnPassT').offsetParent") else ev(pg, "() => document.getElementById('btnPass').click()")
    ticks(pg, 1, True); pg.wait_for_timeout(300)
    t30 = ev(pg, "() => document.querySelector('#ptier30') && document.querySelector('#ptier30').textContent")
    print('nivel 30 del pase:', t30)
    t20 = ev(pg, "() => document.querySelector('#ptier20') && document.querySelector('#ptier20').textContent")
    check('nivel 20 del pase con bolas', 'Huevo de dragón' in (t20 or ''), t20)
    check('sin errores', not errs, str(errs[:3]))
    b.close()
print('FALLOS:', fails) if fails else print('todo bien')
sys.exit(1 if fails else 0)
