# Clubes de principio a fin con un Firestore de mentira (tools/fakefs.py): buscar, crear (cuesta 500 monedas),
# pestañas Club / Expedición / Jefe / Liga, jugar un nivel de la expedición, atacar al jefe, liga, oficiales,
# solicitudes, premios de la semana pasada y salir del club.
import sys, json
sys.path.insert(0, '/home/claude/chroma3d/tools')
from fakefs import FakeFS
from playwright.sync_api import sync_playwright
OUT = '/home/claude/chroma3d/dist/shots/'
fs = FakeFS()
def enc(v):
    if isinstance(v, bool): return {'booleanValue': v}
    if isinstance(v, int): return {'integerValue': str(v)}
    if isinstance(v, str): return {'stringValue': v}
    if isinstance(v, dict): return {'mapValue': {'fields': {k: enc(x) for k, x in v.items()}}}
fs.put('clubs/titan1', {k: enc(v) for k, v in dict(name='Los Titanes', nameLc='los titanes', desc='Solo jugadores activos', open=True, minLv=0, lang='es', country='ES', badge={'ico': '⚡', 'c': 1}, leader='X1', count=22, last='X1', lg={'id': '2026-W44', 's': 742}).items()})
fs.put('clubs/bomb1', {k: enc(v) for k, v in dict(name='Las Bombas', nameLc='las bombas', desc='', open=False, minLv=0, lang='es', country='ES', badge={'ico': '💣', 'c': 3}, leader='X2', count=12, last='X2', lg={'id': '2026-W44', 's': 610}).items()})
def mem(name, av, role, ex, dmg, lgS=0):
    return {k: enc(v) for k, v in dict(name=name, avatar=av, role=role, wk='2026-W44', ex=ex, exN=ex // 2, dmg=dmg, atk='', atkN=0, lg='2026-W44', lgS=lgS).items()}
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True).new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script("window.RR_AGE = 30; window.RR_LIVE_OFF = true; localStorage.setItem('rocketrush.lang','es')")
    pg.route('**/*googleapis.com/**', fs.handle)
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2500)
    pg.evaluate("() => { ChromaGame.manual(true); document.getElementById('daily').classList.remove('on'); const s = ChromaGame.save(); s.coins = 6200; s.gems = 60; RRGame.goMap(); }")
    print('semana del club:', pg.evaluate("() => Club.time()"))
    pg.click('#navClub'); pg.wait_for_timeout(1200)
    print('sin club:', pg.evaluate("() => [document.getElementById('club').classList.contains('on'), document.querySelectorAll('.klfound').length, [...document.querySelectorAll('.klfound b')].map(e=>e.textContent)]"))
    pg.screenshot(path=OUT + 'club_buscar.png')
    pg.click('[data-nt=create]'); pg.wait_for_timeout(200)
    pg.fill('#cfName', 'Los Titanes'); pg.click('[data-ico="🔥"]'); pg.wait_for_timeout(100); pg.click('[data-col="0"]')
    pg.screenshot(path=OUT + 'club_crear.png')
    pg.fill('#cfName', 'los titanes')
    # el nombre ya existe (la reserva clubnames/los titanes)
    fs.put('clubnames/los titanes', {'cid': enc('titan1')})
    pg.click('#cfGo'); pg.wait_for_timeout(800)
    print('nombre repetido:', pg.evaluate("() => [document.getElementById('clubErr').textContent, ChromaGame.save().coins]"))
    pg.fill('#cfName', 'Los Demoledores'); pg.wait_for_timeout(100); pg.click('#cfGo'); pg.wait_for_timeout(1500)
    print('creado:', pg.evaluate("() => [ChromaGame.save().coins, Social.club.id && Social.club.state.club && Social.club.state.club.name, Social.club.state.me && Social.club.state.me.role]"))
    cid = pg.evaluate("() => Social.club.id")
    fs.put(f'clubs/{cid}/members/U2', mem('Lucía_22', '🐼', 'officer', 38, 18200, 9))
    fs.put(f'clubs/{cid}/members/U3', mem('MegaBoom', '🤖', 'member', 30, 9100, 6))
    fs.put(f'clubs/{cid}/members/U4', mem('Kiko', '🦊', 'member', 26, 4000, 3))
    fs.docs[f'clubs/{cid}']['f']['count'] = enc(4)
    fs.put(f'clubs/{cid}/requests/U5', {k: enc(v) for k, v in dict(name='Ranita', avatar='🐸', lv=140).items()})
    pg.click('#clubSync'); pg.wait_for_timeout(1500)
    print('club:', pg.evaluate("() => [document.querySelectorAll('.klmem[data-m]').length, document.querySelector('.clubhead small').textContent, !!document.querySelector('[data-acc]')]"))
    pg.screenshot(path=OUT + 'club_club.png')
    pg.click('[data-acc]'); pg.wait_for_timeout(1500)
    print('solicitud aceptada:', pg.evaluate("() => [Social.club.state.club.count, document.querySelectorAll('.klmem[data-m]').length]"))
    pg.click('.klmem[data-m=U3]'); pg.wait_for_timeout(200); pg.click('[data-role=officer]'); pg.wait_for_timeout(1200)
    print('nuevo oficial:', pg.evaluate("() => Social.club.state.members.find(m => m._id === 'U3').role"))
    # expedición
    pg.click('[data-t=ex]'); pg.wait_for_timeout(300)
    print('expedición:', pg.evaluate("() => [document.querySelectorAll('.klday').length, document.querySelectorAll('.kllv.c').length, document.querySelectorAll('.kllv.l').length]"))
    pg.screenshot(path=OUT + 'club_expedicion.png')
    pg.click('[data-ex="1"]', force=True); pg.wait_for_timeout(500)
    print('antes de jugar:', pg.evaluate("() => [document.getElementById('pre').classList.contains('on'), document.getElementById('preTitle').textContent]"))
    pg.evaluate("() => { document.getElementById('preGo').click(); for (let i=0;i<60;i++) ChromaGame.tick(1/30, true); }")
    print('partida:', pg.evaluate("() => [ChromaGame.G.level.id, ChromaGame.G.level.club, document.getElementById('hudLevel').textContent]"))
    pg.evaluate("() => { ChromaGame.finishWin(); }"); pg.wait_for_timeout(1500)
    print('victoria:', pg.evaluate("() => [document.getElementById('winCoins').textContent, document.getElementById('winNext').textContent, JSON.stringify(Club._P().ex)]"))
    pg.screenshot(path=OUT + 'club_win.png')
    me = fs.docs.get(f'clubs/{cid}/members/ME', {}).get('f', {})
    print('subido al servidor:', me.get('ex'), me.get('exN'))
    pg.click('#winNext'); pg.wait_for_timeout(4800)
    print('siguiente:', pg.evaluate("() => [document.getElementById('club').classList.contains('on'), document.getElementById('pre').classList.contains('on'), document.getElementById('preTitle').textContent]"))
    pg.evaluate("() => { document.getElementById('pre').classList.remove('on'); }")
    # jefe
    pg.evaluate("() => Club.open('boss')"); pg.wait_for_timeout(1200)
    print('jefe:', pg.evaluate("() => [document.querySelector('.klbosscard .klttl').textContent, document.querySelector('.klstat').textContent]"))
    pg.screenshot(path=OUT + 'club_jefe.png')
    pg.click('#clubAttack'); pg.wait_for_timeout(400)
    pg.evaluate("() => { document.getElementById('preGo').click(); for (let i=0;i<200;i++) ChromaGame.tick(1/30, true); document.getElementById('bossIntro').classList.remove('on'); }")
    print('ataque:', pg.evaluate("() => [ChromaGame.G.level.club, Club._P().atkN, !!Bosses.state()]"))
    pg.evaluate("() => { ChromaGame.finishWin(); }"); pg.wait_for_timeout(800)
    print('daño:', pg.evaluate("() => [Club._P().dmg, document.getElementById('winCoins').textContent]"))
    pg.evaluate("() => { Bosses.stop(); document.getElementById('winMap').click(); }"); pg.wait_for_timeout(4800)
    print('vuelve al jefe:', pg.evaluate("() => [document.getElementById('club').classList.contains('on'), document.querySelector('.klstat').textContent]"))
    # liga
    pg.click('[data-t=lg]'); pg.wait_for_timeout(1500)
    print('liga:', pg.evaluate("() => [document.querySelectorAll('.klrank').length, [...document.querySelectorAll('.klrank .klnm')].map(e=>e.textContent), document.querySelectorAll('[data-lg]').length]"))
    pg.screenshot(path=OUT + 'club_liga.png')
    # premios de la semana pasada (se fuerza un cambio de semana)
    pg.evaluate("() => { const s = ChromaGame.save(); s.clubSnap = Object.assign(s.clubSnap || {}, { ex: 400, count: 5 }); s.clubP.wk = '2026-W43'; s.clubSnap.wk = '2026-W43'; s.clubLgSnap = { lg: s.clubP.lg, rank: 2 }; s.clubP.lg = '2026-W43'; s.clubLgSnap.lg = '2026-W43'; Club.open('club'); }"); pg.wait_for_timeout(1200)
    print('premios:', pg.evaluate("() => [ (ChromaGame.save().clubPending||[]).map(x => x.what + ' ' + x.tier), !!document.getElementById('clubClaim')]"))
    pg.screenshot(path=OUT + 'club_premios.png')
    c0 = pg.evaluate("() => ChromaGame.save().coins")
    pg.click('#clubClaim'); pg.wait_for_timeout(500)
    print('recogido:', c0, '->', pg.evaluate("() => [ChromaGame.save().coins, document.getElementById('chestOpen').classList.contains('on')]"))
    pg.evaluate("() => { document.getElementById('chestOpen').classList.remove('on'); ChromaGame.save().clubPending = []; Club.open('club'); }"); pg.wait_for_timeout(1200)
    # salir: el líder cede el liderazgo y sale
    pg.click('#clubLeave'); pg.wait_for_timeout(100); pg.click('#clubLeave'); pg.wait_for_timeout(2500)
    print('salir:', pg.evaluate("() => [Social.club.id, document.querySelectorAll('.klfound').length]"), 'nuevo líder:', fs.docs.get(f'clubs/{cid}', {}).get('f', {}).get('leader'))
    print('errores', errs[:5]); b.close()
