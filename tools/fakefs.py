# Firestore de mentira (en memoria) para probar el juego sin red: documentos, colecciones, commit y consultas sencillas.
import json, time, re, urllib.parse
class FakeFS:
    def __init__(self):
        self.docs = {}; self.n = 0; self.log = []
    def ut(self):
        self.n += 1; return '2026-10-31T10:00:%02d.%06dZ' % (self.n // 1000000 % 60, self.n % 1000000)
    def doc(self, p):
        d = self.docs.get(p)
        return d and {'name': 'projects/rocket-rush-7297c/databases/(default)/documents/' + p, 'fields': d['f'], 'updateTime': d['t']}
    def put(self, p, fields, mask=None, pre=None):
        cur = self.docs.get(p)
        if pre:
            if 'exists' in pre and bool(cur) != pre['exists']: return 'FAILED_PRECONDITION'
            if 'updateTime' in pre and (not cur or cur['t'] != pre['updateTime']): return 'FAILED_PRECONDITION'
        if mask is not None and cur:
            f = dict(cur['f'])
            for k in mask:
                if k in fields: f[k] = fields[k]
                else: f.pop(k, None)
        else: f = fields
        self.docs[p] = {'f': f, 't': self.ut()}
    def handle(self, route):
        req = route.request; u = urllib.parse.urlparse(req.url); m = req.method
        body = json.loads(req.post_data) if req.post_data else {}
        self.log.append((m, u.path.split('/documents')[-1][:80]))
        if 'accounts:signUp' in u.path: return route.fulfill(json={'localId': 'ME', 'idToken': 'T', 'refreshToken': 'R', 'expiresIn': '3600'})
        if 'accounts:delete' in u.path or 'securetoken' in u.netloc: return route.fulfill(json={'user_id': 'ME', 'id_token': 'T', 'refresh_token': 'R', 'expires_in': '3600'})
        path = urllib.parse.unquote(u.path.split('/documents', 1)[1]) if '/documents' in u.path else ''
        q = urllib.parse.parse_qs(u.query)
        if path == ':commit':
            snap = json.loads(json.dumps(self.docs))
            for w in body.get('writes', []):
                if 'update' in w:
                    p = w['update']['name'].split('/documents/')[1]
                    r = self.put(p, w['update'].get('fields', {}), (w.get('updateMask') or {}).get('fieldPaths'), w.get('currentDocument'))
                else:
                    p = w['delete'].split('/documents/')[1]; pre = w.get('currentDocument')
                    if pre and 'exists' in pre and bool(self.docs.get(p)) != pre['exists']: r = 'FAILED_PRECONDITION'
                    else: self.docs.pop(p, None); r = None
                if r: self.docs = snap; return route.fulfill(status=400, json={'error': {'status': r, 'message': r}})
            return route.fulfill(json={'writeResults': []})
        if path == ':runQuery':
            sq = body['structuredQuery']; col = sq['from'][0]['collectionId']
            out = [self.doc(p) for p in self.docs if p.startswith(col + '/') and p.count('/') == 1]
            w = json.dumps(sq.get('where', {}))
            mm = re.search(r'"lg.id".*?"stringValue": "([^"]+)"', w)
            if mm: out = [d for d in out if d['fields'].get('lg', {}).get('mapValue', {}).get('fields', {}).get('id', {}).get('stringValue') == mm.group(1)]
            if 'friendships' == col: out = []
            return route.fulfill(json=[{'document': d} for d in out] or [{}])
        if path == ':batchGet':
            return route.fulfill(json=[{'found': self.doc(n.split('/documents/')[1])} if self.doc(n.split('/documents/')[1]) else {'missing': n} for n in body['documents']])
        if path.startswith(':'): return route.fulfill(json=[{}])
        p = path.strip('/')
        if m == 'GET':
            if p.count('/') % 2 == 0:   # colección
                kids = [self.doc(k) for k in self.docs if k.startswith(p + '/') and k.count('/') == p.count('/') + 1]
                return route.fulfill(json={'documents': kids} if kids else {})
            d = self.doc(p)
            return route.fulfill(json=d) if d else route.fulfill(status=404, json={'error': {'status': 'NOT_FOUND', 'message': 'no'}})
        if m == 'PATCH':
            pre = {}
            if 'currentDocument.exists' in q: pre['exists'] = q['currentDocument.exists'][0] == 'true'
            if 'currentDocument.updateTime' in q: pre['updateTime'] = q['currentDocument.updateTime'][0]
            r = self.put(p, body.get('fields', {}), q.get('updateMask.fieldPaths'), pre or None)
            if r: return route.fulfill(status=400, json={'error': {'status': r, 'message': r}})
            return route.fulfill(json=self.doc(p))
        if m == 'DELETE': self.docs.pop(p, None); return route.fulfill(json={})
        return route.fulfill(json={})
