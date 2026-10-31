# Denunciar y bloquear: jugadores en la clasificación y en los clubes, clubes en el buscador; lista de bloqueados en
# Ajustes › Privacidad y ayuda; nombres y descripciones de club no permitidos. Con un Firestore de mentira.
import sys
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
st = lambda lv: {k: lv for k in ['level', 'stars', 'daily', 'wins', 'bestRun', 'bestShot', 'bosses', 'lv', 'plays']}
for uid, n, a, lv in [('U2', 'Malote', '🐯', 300), ('U3', 'Lucía', '🐼', 200)]:
    fs.put(f'users/{uid}', {k: enc(v) for k, v in dict(name=n, avatar=a, country='ES', code='RR-X', lang='es', stats=st(lv)).items()})
fs.put('clubs/c1', {k: enc(v) for k, v in dict(name='Club Feo', nameLc='club feo', desc='descripción fea', open=True, minLv=0, lang='es', country='ES', badge={'ico': '💣', 'c': 3}, leader='U2', count=3, last='U2', lg={'id': '', 's': 0}).items()})
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1).new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script("window.RR_AGE = 30; window.RR_LIVE_OFF = true; localStorage.setItem('rocketrush.lang','es')")
    pg.route('**/*googleapis.com/**', fs.handle)
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2500)
    pg.evaluate("() => { ChromaGame.manual(true); document.getElementById('daily').classList.remove('on'); Social.open('ranks'); }"); pg.wait_for_timeout(1500)
    print('clasificación:', pg.evaluate("() => [...document.querySelectorAll('.lbrow .sname')].map(e => e.textContent)"))
    pg.click('.lbrow[data-u=U2]'); pg.wait_for_timeout(300)
    print('ficha:', pg.evaluate("() => [document.getElementById('modSheet').classList.contains('on'), document.querySelector('.msname').textContent, [...document.querySelectorAll('.msbtns button')].map(b => b.textContent)]"))
    pg.screenshot(path=OUT + 'report_sheet.png')
    pg.click('[data-ms=rep]'); pg.wait_for_timeout(200)
    print('motivos:', pg.evaluate("() => [...document.querySelectorAll('.msbtns button')].map(b => b.textContent)"))
    pg.click('[data-r=name]'); pg.wait_for_timeout(800)
    print('denunciado:', pg.evaluate("() => document.querySelector('.msnote').textContent"), [k for k in fs.docs if k.startswith('reports/')])
    pg.click('[data-ms=rep]'); pg.click('[data-r=cheat]'); pg.wait_for_timeout(800)
    print('otra vez:', pg.evaluate("() => document.querySelector('.msnote').textContent"))
    pg.click('[data-ms=blk]'); pg.wait_for_timeout(500)
    print('bloqueado:', pg.evaluate("() => [document.querySelector('.msnote').textContent, document.querySelector('.msname').textContent]"))
    pg.screenshot(path=OUT + 'report_blocked.png')
    pg.click('[data-ms=x]'); pg.wait_for_timeout(300)
    print('clasificación ahora:', pg.evaluate("() => [...document.querySelectorAll('.lbrow .sname')].map(e => e.textContent)"))
    # clubes
    pg.evaluate("() => { Club.open(); }"); pg.wait_for_timeout(1500)
    pg.click('.klfound[data-club=c1]'); pg.wait_for_timeout(300)
    print('ficha club:', pg.evaluate("() => [document.querySelector('#modSheet .ribbon').textContent, document.querySelector('.msname').textContent]"))
    pg.click('[data-ms=rep]'); pg.click('[data-r=desc]'); pg.wait_for_timeout(800)
    pg.click('[data-ms=blk]'); pg.wait_for_timeout(300); pg.click('[data-ms=x]'); pg.wait_for_timeout(300)
    print('club bloqueado:', pg.evaluate("() => [...document.querySelectorAll('.klfound b')].map(e => e.textContent)"), [k for k in fs.docs if k.startswith('reports/')])
    pg.evaluate("() => { ChromaGame.save().coins = 900; }"); pg.click('[data-nt=create]'); pg.wait_for_timeout(200); pg.fill('#cfName', 'Los Putas'); pg.click('#cfGo'); pg.wait_for_timeout(600)
    print('nombre de club feo:', pg.evaluate("() => document.getElementById('clubErr').textContent"))
    # lista de bloqueados
    pg.evaluate("() => { RRGame.goTitle(); document.getElementById('btnSetT').click(); document.getElementById('sPriv').click(); }"); pg.wait_for_timeout(300)
    pg.click('#pBlocked'); pg.wait_for_timeout(300)
    print('lista:', pg.evaluate("() => [...document.querySelectorAll('.blrow b')].map(e => e.textContent)"))
    pg.screenshot(path=OUT + 'report_list.png')
    pg.click('[data-ub=U2]'); pg.wait_for_timeout(200)
    print('tras desbloquear:', pg.evaluate("() => [...document.querySelectorAll('.blrow b')].map(e => e.textContent)"))
    print('errores', errs[:5]); b.close()
