# Prueba de amigos y clasificaciones con un Firebase de mentira (en memoria): dos jugadores en dos navegadores.
# Simula la API REST de inicio de sesión anónimo y de Firestore (get, patch, delete, runQuery, recuento y batchGet).
# Con LIVE=1 usa el Firebase REAL (en GitHub Actions): jugadores de prueba del país «ZZ» que se borran al terminar.
import json, re, os, sys, urllib.parse
from playwright.sync_api import sync_playwright

LIVE = bool(os.environ.get('LIVE'))
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, 'dist', 'shots') + '/'
os.makedirs(OUT, exist_ok=True)
FAILS = []
def check(c, msg):
    print(('OK    ' if c else 'FALLO ') + msg)
    if not c: FAILS.append(msg)
DB = {}            # 'col/id' -> fields (formato REST)
USERS = {'n': 0}
ROOT = 'projects/rocket-rush-7297c/databases/(default)/documents'
OFFLINE = {'on': False}

def dec(x):
    if 'stringValue' in x: return x['stringValue']
    if 'integerValue' in x: return int(x['integerValue'])
    if 'doubleValue' in x: return float(x['doubleValue'])
    if 'booleanValue' in x: return x['booleanValue']
    if 'nullValue' in x: return None
    if 'timestampValue' in x: return x['timestampValue']
    if 'mapValue' in x: return {k: dec(v) for k, v in x['mapValue'].get('fields', {}).items()}
    if 'arrayValue' in x: return [dec(v) for v in x['arrayValue'].get('values', [])]
def getf(fields, path):
    v = {k: dec(x) for k, x in fields.items()}
    for p in path.split('.'):
        if not isinstance(v, dict) or p not in v: return None
        v = v[p]
    return v
def doc(path):
    return {'name': f'{ROOT}/{path}', 'fields': DB[path], 'createTime': '2026-01-01T00:00:00Z', 'updateTime': '2026-01-01T00:00:00Z'}
def match(fields, w):
    if not w: return True
    if 'compositeFilter' in w: return all(match(fields, f) for f in w['compositeFilter']['filters'])
    f = w['fieldFilter']; v = getf(fields, f['field']['fieldPath']); t = dec(f['value'])
    if v is None: return False
    return {'EQUAL': v == t, 'GREATER_THAN': v > t, 'LESS_THAN': v < t}[f['op']]
def query(sq):
    col = sq['from'][0]['collectionId']
    rows = [k for k in DB if k.split('/')[0] == col and match(DB[k], sq.get('where'))]
    for o in sq.get('orderBy', []):
        fp = o['field']['fieldPath']
        rows = [k for k in rows if getf(DB[k], fp) is not None]
        rows.sort(key=lambda k: getf(DB[k], fp), reverse=o.get('direction') == 'DESCENDING')
    return rows[:sq.get('limit', 10**9)]

def handler(route, request):
    if OFFLINE['on']: return route.abort('internetdisconnected')
    url = request.url; body = request.post_data or ''
    hdr = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}
    def ok(j, st=200): route.fulfill(status=st, headers=hdr, body=json.dumps(j))
    if request.method == 'OPTIONS': return route.fulfill(status=204, headers={**hdr, 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'})
    if 'accounts:signUp' in url:
        USERS['n'] += 1; u = 'uid%d' % USERS['n']
        return ok({'localId': u, 'idToken': 'tok-' + u, 'refreshToken': 'ref-' + u, 'expiresIn': '3600'})
    if 'securetoken' in url:
        r = urllib.parse.parse_qs(body)['refresh_token'][0]; u = r[4:]
        return ok({'user_id': u, 'id_token': 'tok-' + u, 'refresh_token': r, 'expires_in': '3600'})
    auth = request.headers.get('authorization', '')
    me = auth[len('Bearer tok-'):] if auth.startswith('Bearer tok-') else None
    if not me: return ok({'error': {'code': 403, 'status': 'PERMISSION_DENIED', 'message': 'no auth'}}, 403)
    pu = urllib.parse.urlparse(url); path = urllib.parse.unquote(pu.path).split('/documents', 1)[1]
    qs = urllib.parse.parse_qs(pu.query)
    if path == ':runQuery':
        return ok([{'document': doc(k), 'readTime': 'x'} for k in query(json.loads(body)['structuredQuery'])] or [{'readTime': 'x'}])
    if path == ':runAggregationQuery':
        n = len(query(json.loads(body)['structuredAggregationQuery']['structuredQuery']))
        return ok([{'result': {'aggregateFields': {'n': {'integerValue': str(n)}}}, 'readTime': 'x'}])
    if path == ':batchGet':
        out = []
        for full in json.loads(body)['documents']:
            k = full.split('/documents/', 1)[1]
            out.append({'found': doc(k)} if k in DB else {'missing': full})
        return ok(out)
    k = path.strip('/')
    col = k.split('/')[0]
    if request.method == 'GET':
        if k in DB: return ok(doc(k))
        return ok({'error': {'code': 404, 'status': 'NOT_FOUND', 'message': 'not found'}}, 404)
    if request.method == 'DELETE':
        DB.pop(k, None); return ok({})
    if request.method == 'PATCH':
        new = json.loads(body)['fields']
        if qs.get('currentDocument.exists') == ['false'] and k in DB:
            return ok({'error': {'code': 409, 'status': 'ALREADY_EXISTS', 'message': 'exists'}}, 409)
        # reglas mínimas
        if col == 'users' and k.split('/')[1] != me: return ok({'error': {'code': 403, 'status': 'PERMISSION_DENIED', 'message': 'not owner'}}, 403)
        if col == 'friendships' and k in DB and getf(DB[k], 'from') == me: return ok({'error': {'code': 403, 'status': 'PERMISSION_DENIED', 'message': 'sender cannot accept'}}, 403)
        mask = qs.get('updateMask.fieldPaths')
        cur = dict(DB.get(k, {})) if mask else {}
        for f in (mask or new.keys()):
            if f in new: cur[f] = new[f]
            else: cur.pop(f, None)
        DB[k] = cur
        return ok(doc(k))
    ok({'error': {'code': 400, 'message': 'unknown'}}, 400)

def ev(pg, js): return pg.evaluate(js)
def idle(pg, ms=150):
    pg.wait_for_timeout(ms)
    pg.wait_for_function("() => Social._busy === 0", timeout=20000)
    pg.wait_for_timeout(50)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    pages = []; errs = []
    for name, lv in (('Ana', 40), ('Beto', 12)):
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True)
        for host in ([] if LIVE else ('identitytoolkit.googleapis.com', 'securetoken.googleapis.com', 'firestore.googleapis.com')):
            ctx.route(re.compile(r'https://' + re.escape(host) + '/.*'), handler)
        pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: m.type == 'warning' and 'RR social' in m.text and errs.append(m.text))
        pg.add_init_script("localStorage.setItem('rocketrush.lang','es')")
        if os.environ.get('FS_DB'): pg.add_init_script("window.RR_FS_DB = %s" % json.dumps(os.environ['FS_DB']))
        pg.add_init_script("if(!sessionStorage.g){sessionStorage.g=1;localStorage.setItem('chromacrash3d.v1', JSON.stringify({unlocked:%d, prof:{name:'%s',avatar:'🦊',country:'%s'}, stats:{wins:%d,plays:%d,bestShot:%d}}))}" % (lv, name + (' (prueba)' if LIVE else ''), 'ZZ' if LIVE else 'ES', lv - 1, lv + 3, lv // 2))
        pg.goto(os.environ.get('GAME_URL') or 'file://' + os.path.join(HERE, 'dist', 'index.html'))
        pg.ctx = ctx
        pages.append(pg)
    A, B = pages
    for pg in pages: pg.wait_for_function("() => window.Social && Social.uid && Social.net === 'online'", timeout=30000)
    for pg in pages: pg.evaluate("() => { ChromaGame.manual(true); document.getElementById('daily').classList.remove('on'); RRGame.goTitle(); }")
    print('sesiones:', ev(A, "() => Social.uid"), ev(B, "() => Social.uid"), '· docs:', sorted(DB))
    codeA = ev(A, "() => RRGame.myCode()")
    # Beto abre Amigos y añade a Ana
    B.click('#btnSocT'); idle(B)
    B.fill('#socCode', codeA); B.click('#socAdd'); idle(B)
    B.wait_for_function("() => { const m = document.querySelector('.smsg'); return m && m.textContent !== 'Buscando…'; }", timeout=20000)
    m = ev(B, "() => document.querySelector('.smsg') && document.querySelector('.smsg').textContent")
    check('Solicitud enviada' in (m or ''), 'Beto envía solicitud a Ana: ' + str(m))
    B.fill('#socCode', codeA); B.click('#socAdd'); idle(B)
    B.wait_for_function("() => { const m = document.querySelector('.smsg'); return m && m.textContent !== 'Buscando…'; }", timeout=20000)
    m = ev(B, "() => document.querySelector('.smsg').textContent")
    check('Ya le enviaste' in m and ev(B, "() => Social._fr.out.length") == 1, 'repetir la solicitud: ' + m)
    # Ana ve la solicitud y la acepta
    A.evaluate("() => { Social._fr.at = 0; Social.sync(); }"); idle(A)
    check(ev(A, "() => !document.getElementById('socDotT').hidden && document.getElementById('socDotT').textContent") == '1', 'aviso de solicitud en la portada de Ana')
    A.click('#btnSocT'); idle(A)
    A.screenshot(path=OUT + 'soc_solicitud.png')
    A.click('.scard.inc [data-act=ok]'); idle(A)
    fa = ev(A, "() => Social._fr.list.map(x=>x.u.name)")
    check(len(fa) == 1 and fa[0].startswith('Beto') and len(ev(A, "() => RRGame.save.friends")) == 1, 'Ana acepta: amigos ' + str(fa) + ' · cuenta para la misión')
    A.screenshot(path=OUT + 'soc_amigos.png')
    B.click('#socSync'); idle(B)
    fb = ev(B, "() => Social._fr.list.map(x=>x.u.name + ' nivel ' + x.u.stats.level)")
    check(len(fb) == 1 and fb[0].startswith('Ana'), 'Beto ve a Ana con sus datos: ' + str(fb))
    # clasificación mundial por nivel y por mejor tiro
    A.click('#socTabs [data-t=ranks]'); idle(A)
    rk = ev(A, "() => [...document.querySelectorAll('.lbrow')].map(r=>r.innerText.replace(/\\s+/g,' '))")
    check(len(rk) >= 2 and any('Ana' in x for x in rk), 'clasificación mundial por nivel: ' + str(rk[:5]))
    A.click('.smetrics [data-m=bestShot]'); idle(A)
    print('ranking mejor tiro:', ev(A, "() => [...document.querySelectorAll('.lbrow')].map(r=>r.innerText.replace(/\\s+/g,' '))"))
    A.click('.sscope [data-sc=friends]'); idle(A)
    print('ranking amigos:', ev(A, "() => [...document.querySelectorAll('.lbrow')].map(r=>r.innerText.replace(/\\s+/g,' '))"))
    A.click('.sscope [data-sc=local]'); idle(A)
    rk = ev(A, "() => [...document.querySelectorAll('.lbrow')].map(r=>r.innerText.replace(/\\s+/g,' '))")
    check(len(rk) == 2, 'clasificación de mi país: ' + str(rk) + ' ' + ev(A, "() => (document.querySelector('.sempty')||{}).textContent || ''"))
    A.screenshot(path=OUT + 'soc_ranking.png')
    # puesto cuando no sale en el top: 60 jugadores de relleno por delante
    for i in range(0 if LIVE else 60): DB['users/z%d' % i] = {'name': {'stringValue': 'Z%d' % i}, 'country': {'stringValue': 'MX'}, 'stats': {'mapValue': {'fields': {'level': {'integerValue': str(100 + i)}}}}}
    B.click('#socTabs [data-t=ranks]'); idle(B); B.click('#socSync'); idle(B)
    if not LIVE: print('Beto fuera del top 50: filas', ev(B, "() => document.querySelectorAll('.lbrow').length"), '· su puesto:', ev(B, "() => document.querySelector('.lbsep + .lbrow .lbpos').textContent"))
    # perfil: cambiar nombre y avatar
    A.click('#socTabs [data-t=me]'); idle(A)
    A.fill('#socName', '  Ana <b>la</b> Grande  '); A.click('#socSaveName'); A.click('.savs [data-av="🐲"]'); A.wait_for_timeout(2200); idle(A)
    srv = A.evaluate("""async () => { const a = JSON.parse(localStorage.getItem('rocketrush.auth'));
      const r = await fetch('https://firestore.googleapis.com/v1/projects/rocket-rush-7297c/databases/' + (window.RR_FS_DB || '(default)') + '/documents/users/' + a.uid, { headers: { Authorization: 'Bearer ' + a.id } });
      const j = await r.json(); return j.fields.name.stringValue + ' ' + j.fields.avatar.stringValue; }""")
    check(srv.endswith('🐲') and srv.startswith('Ana'), 'perfil subido al servidor: ' + srv)
    A.screenshot(path=OUT + 'soc_perfil.png')
    # sin conexión
    OFFLINE['on'] = True; A.ctx.set_offline(True)
    A.click('#socTabs [data-t=friends]'); A.click('#socSync'); idle(A)
    check('Sin conexión' in ev(A, "() => document.getElementById('socNet').textContent"), 'aviso sin conexión')
    OFFLINE['on'] = False; A.ctx.set_offline(False)
    # en inglés: los nombres no se traducen
    A.evaluate("() => I18N.set('en')"); A.click('#socSync'); idle(A)
    print('en inglés:', ev(A, "() => document.querySelector('.shead').textContent + ' | ' + document.querySelector('.scard .sname').textContent + ' | ' + document.querySelector('.scard small').textContent"))
    A.screenshot(path=OUT + 'soc_en.png')
    # quitar amigo (dos toques)
    A.click('.scard [data-act=del]'); A.click('.scard [data-act=del]'); idle(A)
    check(ev(A, "() => Social._fr.list.length") == 0, 'quitar amigo')
    if LIVE:   # limpieza: se borran perfil, código y cuenta de los dos jugadores de prueba
        for pg in pages:
            print('limpieza:', pg.evaluate("""async () => { const a = JSON.parse(localStorage.getItem('rocketrush.auth')), H = { Authorization: 'Bearer ' + a.id };
              const D = 'https://firestore.googleapis.com/v1/projects/rocket-rush-7297c/databases/' + (window.RR_FS_DB || '(default)') + '/documents/';
              const s = [(await fetch(D + 'codes/' + RRGame.codeCore(), { method: 'DELETE', headers: H })).status, (await fetch(D + 'users/' + a.uid, { method: 'DELETE', headers: H })).status];
              s.push((await fetch('https://identitytoolkit.googleapis.com/v1/accounts:delete?key=AIzaSyC9Rbs2qrzJaSugbHCjOTpuH_QQZKw8DNc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: a.id }) })).status);
              return s.join(' '); }"""))
    check(not errs, 'sin errores de la página ' + str(errs[:6]))
    b.close()
    print('\n' + ('Todo bien' if not FAILS else '%d fallos' % len(FAILS)))
    sys.exit(1 if FAILS else 0)
