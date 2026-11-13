# Liga de clubes por grupos: al empezar la liga, el club entra al azar en un grupo con sitio (hasta 5 clubes) o abre
# uno nuevo; todos los del grupo ven la misma clasificación. Firestore de mentira (tools/fakefs.py) y reloj en sábado.
import sys, json
sys.path.insert(0, '/home/claude/chroma3d/tools')
from fakefs import FakeFS
from playwright.sync_api import sync_playwright
OUT = '/home/claude/chroma3d/dist/shots/'
LG = '2026-W46'
fails = []
def check(name, ok, extra=''):
    print(('OK  ' if ok else 'FALLO ') + name, extra); (None if ok else fails.append(name))
def enc(v):
    if isinstance(v, bool): return {'booleanValue': v}
    if isinstance(v, int): return {'integerValue': str(v)}
    if isinstance(v, str): return {'stringValue': v}
    if isinstance(v, list): return {'arrayValue': {'values': [enc(x) for x in v]}}
    if isinstance(v, dict): return {'mapValue': {'fields': {k: enc(x) for k, x in v.items()}}}
def club(cid, name, ico, pts, count=8):
    fs.put('clubs/' + cid, {k: enc(v) for k, v in dict(name=name, nameLc=name.lower(), desc='', open=True, closed=False, max=30, minLv=0, lang='es', country='ES', badge={'ico': ico, 'c': 2}, leader='L' + cid, count=count, last='L' + cid, lg={'id': LG, 's': pts}).items()})
def run(scenario):
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
        pg = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True).new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        # sábado 14-11-2026 a mediodía: la liga está en marcha
        pg.add_init_script("""(() => { const T0 = Date.UTC(2026, 10, 14, 12), r0 = Date.now(); const real = Date.now.bind(Date); Date.now = () => T0 + (real() - r0); })();
          window.RR_AGE = 30; window.RR_LIVE_OFF = true; localStorage.setItem('rocketrush.lang','es');
          localStorage.setItem('chromacrash3d.v1', JSON.stringify({ unlocked: 60, played: 30, birthYear: 1990, coins: 500, club: { cid: 'MY' }, tut: { main: true, tips: { daily: 1, club: 1, clubIn: 1 } } }))""")
        pg.route('**/*googleapis.com/**', fs.handle)
        pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2500)
        pg.evaluate("() => { ChromaGame.manual(true); document.getElementById('daily').classList.remove('on'); }")
        check(scenario + ': la liga está en marcha', pg.evaluate("() => Club.time().lg") == LG)
        pg.evaluate("() => Club.open('lg')"); pg.wait_for_timeout(2500)
        rows = pg.evaluate("() => [...document.querySelectorAll('.klrank')].map(e => e.textContent.replace(/\\s+/g, ' ').trim())")
        print('  filas:', rows)
        pg.screenshot(path=OUT + f'liga_grupo_{scenario}.png')
        r = (rows, pg.evaluate("() => ChromaGame.save().clubLgSnap"), errs)
        b.close(); return r

fs = FakeFS()
# tu club y otros 7: un grupo lleno (5) y uno abierto con 2 clubes
club('MY', 'Mi Club', '🚀', 40, 6)
for i, (n, ico, pts) in enumerate([('Los Titanes', '⚡', 120), ('Las Bombas', '💣', 80), ('Cohetes', '🔥', 30), ('Dragones', '🐲', 55), ('Pandas', '🐼', 10), ('Zorros', '🦊', 70), ('Tigres', '🐯', 90)]):
    club('C%d' % i, n, ico, pts)
fs.put('clubs/MY/members/ME', {k: enc(v) for k, v in dict(name='Yo', avatar='🚀', role='member', wk='', ex=0, exN=0, dmg=0, atk='', atkN=0, lg=LG, lgS=5).items()})
fs.put(f'leaguegroups/{LG}_FULLxxxxxx', {k: enc(v) for k, v in dict(lg=LG, open='', clubs=['C2', 'C3', 'C4', 'C5', 'C6'], n=5).items()})
fs.put(f'leaguegroups/{LG}_OPENxxxxxx', {k: enc(v) for k, v in dict(lg=LG, open=LG, clubs=['C0', 'C1'], n=2).items()})
rows, snap, errs = run('abierto')
g = fs.docs.get(f'leaguegroups/{LG}_OPENxxxxxx')
clubs = [x['stringValue'] for x in g['f']['clubs']['arrayValue']['values']]
check('entra en el grupo con sitio (no en el lleno)', clubs == ['C0', 'C1', 'MY'] and g['f']['n']['integerValue'] == '3', str(clubs))
check('el club apunta su grupo', fs.docs['clubs/MY']['f'].get('lgG', {}).get('mapValue', {}).get('fields', {}).get('g', {}).get('stringValue') == f'{LG}_OPENxxxxxx')
check('clasificación del grupo por estrellas (3 clubes + 2 huecos)', len(rows) == 5 and 'Los Titanes' in rows[0] and 'Las Bombas' in rows[1] and 'Mi Club' in rows[2] and 'Buscando rival' in rows[3], str(rows))
check('puesto guardado para el premio', snap and snap.get('rank') == 3, str(snap))
check('sin errores', not errs, str(errs[:2]))
# segunda vez: ya tiene grupo, no se mete en otro
rows2, snap2, errs2 = run('ya_en_grupo')
g = fs.docs.get(f'leaguegroups/{LG}_OPENxxxxxx')
check('no se apunta dos veces', g['f']['n']['integerValue'] == '3' and len([k for k in fs.docs if k.startswith('leaguegroups/')]) == 2)
# sin grupos con sitio: abre uno nuevo y es el único club (todo «buscando rival»)
fs.docs.pop('clubs/MY', None); club('MY', 'Mi Club', '🚀', 40, 6)
fs.docs.pop(f'leaguegroups/{LG}_OPENxxxxxx')
rows3, snap3, errs3 = run('nuevo')
new = [k for k in fs.docs if k.startswith('leaguegroups/') and 'FULL' not in k]
check('abre un grupo nuevo', len(new) == 1 and fs.docs[new[0]]['f']['open']['stringValue'] == LG, str(new))
check('solo tu club y 4 huecos', len(rows3) == 5 and 'Mi Club' in rows3[0] and all('Buscando rival' in r for r in rows3[1:]), str(rows3))
check('sin rivales no hay puesto', not snap3 or snap3.get('lg') != LG or snap3.get('rank', 0) == 0, str(snap3))
print('FALLOS:', fails if fails else 'ninguno')
