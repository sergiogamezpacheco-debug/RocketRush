# Panel de administración (site/admin) contra un Firebase simulado en memoria:
# entrar, crear una bonificación y un regalo, cambiar Halloween, guardar (y la copia previa), crear un código regalo,
# buscar un jugador por su código, bloquearlo y desbloquearlo, y ver que el juego entiende lo guardado.
import json, time, re
from urllib.parse import urlparse, parse_qs, unquote
from playwright.sync_api import sync_playwright
OUT = '/home/claude/chroma3d/dist/shots/'
DB = {}                       # 'users/u1' -> {'fields': {...}, 'updateTime': ...}
N = [0]
def ts():
    N[0] += 1; return f'2026-10-27T20:00:{N[0] % 60:02d}.{N[0]:06d}Z'
def put(path, fields): DB[path] = {'fields': fields, 'updateTime': ts()}
S = lambda v: {'stringValue': v}; I = lambda v: {'integerValue': str(v)}; T = lambda v: {'timestampValue': v}
put('admins/adm1', {'email': S('yo@ejemplo.com')})
for i, (name, code, lv) in enumerate([('Sergio', 'ABCD2345', 120), ('Tramposo', 'ZZZZ9999', 999), ('Lucía', 'QWER5678', 40)]):
    put(f'users/u{i}', {'name': S(name), 'avatar': S('🦊'), 'code': S('RR-' + code), 'country': S('ES'), 'lang': S('es'),
                        'stats': {'mapValue': {'fields': {'level': I(lv), 'stars': I(lv * 2), 'lv': I(9), 'wins': I(lv)}}},
                        'createdAt': T('2026-10-2%dT10:00:00Z' % (i + 5)), 'updatedAt': T('2026-10-27T10:00:00Z')})
    put(f'codes/{code}', {'uid': S(f'u{i}')})
calls = []
def doc_json(path): d = DB[path]; return {'name': 'projects/p/databases/(default)/documents/' + path, 'fields': d['fields'], 'updateTime': d['updateTime']}
def fval(f, path):
    cur = f
    for k in path.split('.'):
        if cur is None: return None
        v = cur.get(k)
        if v is None: return None
        cur = v['mapValue']['fields'] if 'mapValue' in v else v
    return cur
def num(v): return float(v.get('integerValue', v.get('doubleValue', 0))) if v else 0
def handle(route):
    req = route.request; u = urlparse(req.url); q = parse_qs(u.query)
    calls.append(req.method + ' ' + u.path.split('/documents')[-1][:60])
    if 'signInWithPassword' in u.path:
        b = json.loads(req.post_data)
        if b['password'] != 'secreta': return route.fulfill(status=400, json={'error': {'message': 'INVALID_LOGIN_CREDENTIALS'}})
        return route.fulfill(json={'localId': 'adm1', 'email': b['email'], 'idToken': 'tok', 'refreshToken': 'ref', 'expiresIn': '3600'})
    if 'securetoken' in u.netloc: return route.fulfill(json={'user_id': 'adm1', 'id_token': 'tok', 'refresh_token': 'ref', 'expires_in': '3600'})
    if 'firestore' not in u.netloc: return route.abort()
    p = unquote(u.path.split('/documents')[1]).lstrip('/').lstrip(':')
    if u.path.endswith(':runAggregationQuery'): return route.fulfill(json=[{'result': {'aggregateFields': {'n': I(len([k for k in DB if k.startswith('users/')]))}}}])
    if u.path.endswith(':runQuery'):
        sq = json.loads(req.post_data)['structuredQuery']; col = sq['from'][0]['collectionId']
        docs = [k for k in DB if k.startswith(col + '/')]
        w = sq.get('where', {}).get('fieldFilter')
        if w and w['op'] == 'EQUAL':
            want = list(w['value'].values())[0]
            docs = [k for k in docs if (lambda v: v is not None and list(v.values())[0] == want)(fval(DB[k]['fields'], w['field']['fieldPath']))]
        for o in sq.get('orderBy', []):
            docs.sort(key=lambda k: num(fval(DB[k]['fields'], o['field']['fieldPath'])) if 'stats' in o['field']['fieldPath'] else str(fval(DB[k]['fields'], o['field']['fieldPath'])), reverse=o.get('direction') == 'DESCENDING')
        return route.fulfill(json=[{'document': doc_json(k)} for k in docs[:sq.get('limit', 100)]] or [{}])
    if req.method == 'GET':
        if p.count('/') == 0:   # lista de una colección
            return route.fulfill(json={'documents': [doc_json(k) for k in DB if k.startswith(p + '/')]})
        if p not in DB: return route.fulfill(status=404, json={'error': {'status': 'NOT_FOUND'}})
        return route.fulfill(json=doc_json(p))
    if req.method == 'DELETE': DB.pop(p, None); return route.fulfill(json={})
    if req.method == 'PATCH':
        if q.get('currentDocument.exists') == ['false'] and p in DB: return route.fulfill(status=409, json={'error': {'status': 'ALREADY_EXISTS'}})
        if 'currentDocument.updateTime' in q and (p not in DB or DB[p]['updateTime'] != q['currentDocument.updateTime'][0]):
            return route.fulfill(status=400, json={'error': {'status': 'FAILED_PRECONDITION'}})
        new = json.loads(req.post_data).get('fields', {})
        f = dict(DB[p]['fields']) if p in DB else {}
        for k in q.get('updateMask.fieldPaths', list(new.keys())):
            if k in new: f[k] = new[k]
            else: f.pop(k, None)
        put(p, f); return route.fulfill(json=doc_json(p))
    return route.abort()
def cfg():
    d = DB.get('config/live'); return json.loads(d['fields']['data']['stringValue']) if d else None
with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: d.accept())
    pg.route('**/*googleapis.com/**', handle)
    pg.goto('file:///home/claude/chroma3d/site/admin/index.html'); pg.wait_for_timeout(400)
    pg.screenshot(path=OUT + 'adm_login.png')
    pg.fill('#lEmail', 'yo@ejemplo.com'); pg.fill('#lPass', 'mala'); pg.click('#lGo'); pg.wait_for_timeout(400)
    print('contraseña mala:', pg.text_content('#lMsg'))
    pg.fill('#lPass', 'secreta'); pg.click('#lGo'); pg.wait_for_selector('#app:not([hidden])'); pg.wait_for_timeout(600)
    print('resumen:', [pg.text_content(i) for i in ('#kTot', '#kNew1', '#kAct')], '· últimos:', pg.locator('#lastP .item').count())
    pg.screenshot(path=OUT + 'adm_home.png', full_page=True)
    # eventos: fin de semana x2 + Halloween 7 días más
    pg.click('nav [data-tab=events]'); pg.click('[data-x=pWeekend]'); pg.click('[data-x=bAdd]'); pg.wait_for_timeout(200)
    pg.click('[data-x=hwExt]'); pg.wait_for_timeout(200)
    pg.click('[data-x=xmNow]'); pg.wait_for_timeout(200)
    print('tarjeta de Navidad:', pg.text_content('#xmCard h3').strip())
    print('barra de guardar visible:', pg.is_visible('#savebar'), '· aún sin guardar en el servidor:', cfg())
    pg.screenshot(path=OUT + 'adm_events.png', full_page=True)
    pg.click('#save'); pg.wait_for_timeout(500)
    c = cfg(); print('guardado:', [(x['kind'], x['mult']) for x in c['boosts']], '· Halloween hasta', time.strftime('%d/%m %H:%M', time.localtime(c['hw']['end'] / 1000)), '· barra oculta:', not pg.is_visible('#savebar'))
    print('Navidad:', c['xm']['on'], 'desde', time.strftime('%d/%m %H:%M', time.localtime(c['xm']['start'] / 1000)), 'hasta', time.strftime('%d/%m %H:%M', time.localtime(c['xm']['end'] / 1000)))
    # avisos: regalo con traducción
    pg.click('nav [data-tab=msgs]')
    f = '#gForm '
    pg.fill(f + '[name=title]', '¡Gracias por jugar!'); pg.fill(f + '[name=coins]', '300'); pg.fill(f + '[name=gems]', '5')
    pg.click(f + 'summary'); pg.fill(f + '[name=tr_en_title]', 'Thanks for playing!')
    pg.click('[data-x=gAdd]'); pg.wait_for_timeout(200)
    pg.fill('#nForm [name=title]', 'Llega la Navidad'); pg.fill('#nForm [name=body]', 'Mundo nuevo el 1 de diciembre'); pg.click('[data-x=nAdd]'); pg.wait_for_timeout(200)
    pg.screenshot(path=OUT + 'adm_msgs.png', full_page=True)
    pg.click('#save'); pg.wait_for_timeout(500)
    c = cfg(); print('regalo:', c['gifts'][0]['title'], c['gifts'][0]['coins'], c['gifts'][0]['tr'], '· noticia:', c['news'][0]['title'], '· copia previa con', len(json.loads(DB['config/prev']['fields']['data']['stringValue']).get('boosts', [])), 'bonificación')
    # conflicto: otro administrador guarda a la vez
    put('config/live', DB['config/live']['fields'])
    pg.click('nav [data-tab=settings]'); pg.fill('#mtF [name=msg]', 'Volvemos pronto'); pg.check('#mtF [name=on]'); pg.wait_for_timeout(200)
    pg.click('#save'); pg.wait_for_timeout(500)
    print('conflicto detectado:', pg.text_content('#toast'))
    pg.click('#reload'); pg.wait_for_timeout(500)
    pg.check('#mtF [name=on]'); pg.fill('#upF [name=min]', '70'); pg.dispatch_event('#upF [name=min]', 'input'); pg.click('#save'); pg.wait_for_timeout(500)
    c = cfg(); print('ajustes:', c.get('maint'), c.get('update'))
    pg.screenshot(path=OUT + 'adm_settings.png', full_page=True)
    # códigos
    pg.click('nav [data-tab=codes]'); pg.wait_for_timeout(300)
    pg.fill('#cForm [name=code]', 'navidad-2026'); pg.fill('#cForm [name=gems]', '10'); pg.fill('#cForm [name=max]', '100'); pg.click('[data-x=cAdd]'); pg.wait_for_timeout(500)
    print('código creado:', {k: list(v.values())[0] for k, v in DB['giftcodes/NAVIDAD2026']['fields'].items() if k in ('gems', 'max', 'used')}, '· en la lista:', pg.locator('#cList .item').count())
    pg.fill('#cForm [name=code]', 'NAVIDAD2026'); pg.fill('#cForm [name=gems]', '1'); pg.click('[data-x=cAdd]'); pg.wait_for_timeout(500)
    print('repetido:', pg.text_content('#toast'))
    pg.screenshot(path=OUT + 'adm_codes.png', full_page=True)
    # jugadores
    pg.click('nav [data-tab=players]'); pg.fill('#pForm [name=q]', 'rr-zzzz9999'); pg.click('[data-x=find]'); pg.wait_for_timeout(600)
    print('ficha:', pg.text_content('#pc h3').strip())
    pg.click('[data-p=ban]'); pg.wait_for_timeout(600)
    f2 = DB['users/u1']['fields']; print('bloqueado:', f2.get('banned'), '· nivel', f2['stats']['mapValue']['fields']['level'])
    pg.screenshot(path=OUT + 'adm_player.png', full_page=True)
    pg.click('[data-p=unban]'); pg.wait_for_timeout(600)
    print('desbloqueado (sin campo):', 'banned' not in DB['users/u1']['fields'])
    pg.click('[data-x=top]'); pg.wait_for_timeout(500)
    print('top:', [pg.locator('#pRes .item b').nth(i).text_content().strip() for i in range(pg.locator('#pRes .item').count())])
    # probador
    pg.click('#pRes .item >> nth=0'); pg.wait_for_timeout(500)
    pg.click('#pcTester'); pg.wait_for_timeout(600)
    print('probador:', [k for k in DB if k.startswith('testers/')], pg.text_content('#pcTester'))
    # denuncias
    S = lambda v: {'stringValue': v}
    put('reports/a_u1', {'by': S('a'), 'kind': S('player'), 'target': S('u1'), 'name': S('Sergio'), 'reason': S('name'), 'at': {'timestampValue': '2026-10-31T10:00:00Z'}})
    put('reports/b_u1', {'by': S('b'), 'kind': S('player'), 'target': S('u1'), 'name': S('Sergio'), 'reason': S('cheat'), 'at': {'timestampValue': '2026-10-31T11:00:00Z'}})
    put('clubs/cz', {'name': S('Club Feo'), 'nameLc': S('club feo'), 'desc': S('fea')}); put('clubnames/club feo', {'cid': S('cz')})
    put('reports/a_cz', {'by': S('a'), 'kind': S('club'), 'target': S('cz'), 'name': S('Club Feo'), 'reason': S('desc'), 'at': {'timestampValue': '2026-10-31T12:00:00Z'}})
    pg.click('#nav [data-tab=reports]'); pg.wait_for_timeout(800)
    print('denuncias:', [pg.locator('#rBox .card h3').nth(i).text_content().strip() for i in range(pg.locator('#rBox .card').count())])
    pg.screenshot(path=OUT + 'adm_reports.png', full_page=True)
    pg.click('#rBox [data-g] >> text=Quitar descripción'); pg.wait_for_timeout(800)
    print('descripción quitada:', DB['clubs/cz']['fields'].get('desc'), '· quedan', [k for k in DB if k.startswith('reports/')])
    pg.click('#rBox [data-a=dismiss]'); pg.wait_for_timeout(800)
    print('descartadas:', [k for k in DB if k.startswith('reports/')])
    # al recargar sigue dentro (sesión guardada)
    pg.reload(); pg.wait_for_selector('#app:not([hidden])', timeout=5000); print('sesión recordada:', pg.text_content('#who'))
    print('errores', errs[:5]); b.close()
    json.dump(cfg(), open('/tmp/claude-0/-home-claude/bf9c43e5-5475-5454-a4fd-cef2843ab5ff/scratchpad/live_cfg.json', 'w'))
