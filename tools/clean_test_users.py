# Borra lo que haya quedado de las pruebas (jugadores del país «ZZ», sus códigos y amistades) con la cuenta de servicio.
# Uso: python3 tools/clean_test_users.py "$(gcloud auth print-access-token)"
import json, sys, urllib.request, urllib.error, urllib.parse
tok = sys.argv[1]
B = 'https://firestore.googleapis.com/v1/projects/rocket-rush-7297c/databases/(default)/documents'
def call(url, body=None, method='GET'):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, method=method,
                                 headers={'Authorization': 'Bearer ' + tok, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as r: return json.loads(r.read() or b'null')
def q(col, field, val):
    sq = {'from': [{'collectionId': col}], 'where': {'fieldFilter': {'field': {'fieldPath': field}, 'op': 'EQUAL', 'value': {'stringValue': val}}}}
    return [x['document'] for x in call(B + ':runQuery', {'structuredQuery': sq}, 'POST') if 'document' in x]
try:
    users = q('users', 'country', 'ZZ')
    n = 0
    for u in users:
        uid = u['name'].split('/')[-1]
        for col in ('codes', 'friendships'):
            for field in (('uid',) if col == 'codes' else ('a', 'b')):
                for d in q(col, field, uid): call('https://firestore.googleapis.com/v1/' + d['name'], method='DELETE'); n += 1
        call('https://firestore.googleapis.com/v1/' + u['name'], method='DELETE'); n += 1
    # nombres reservados por jugadores de prueba («… (prueba)», «zzprueba …»)
    j = call(B + '/names?pageSize=300') or {}
    for d in j.get('documents', []):
        nm = urllib.parse.unquote(d['name'].split('/')[-1])
        if '(prueba)' in nm or nm.startswith('zzprueba'): call('https://firestore.googleapis.com/v1/' + d['name'], method='DELETE'); n += 1
    print(f'restos de pruebas borrados: {len(users)} jugadores, {n} documentos')
except urllib.error.HTTPError as e:
    print('no se pudieron borrar los restos de pruebas:', e.code, e.read().decode()[:200])
