# Crea los índices de firebase/firestore.indexes.json con la API de administración de Firestore.
# Uso (con una sesión de gcloud de la cuenta de servicio): python3 tools/deploy_indexes.py "$(gcloud auth print-access-token)"
# Solo necesita el rol «Administrador de índices de Cloud Datastore»; los que ya existen se dejan como están.
import json, sys, urllib.request, urllib.error
tok, db = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else '(default)')
base = f'https://firestore.googleapis.com/v1/projects/rocket-rush-7297c/databases/{db}/collectionGroups'
bad = 0
for ix in json.load(open('firebase/firestore.indexes.json'))['indexes']:
    body = {'queryScope': ix['queryScope'], 'fields': [{'fieldPath': f['fieldPath'], 'order': f['order']} for f in ix['fields']]}
    req = urllib.request.Request(f"{base}/{ix['collectionGroup']}/indexes", data=json.dumps(body).encode(), method='POST',
                                 headers={'Authorization': 'Bearer ' + tok, 'Content-Type': 'application/json'})
    name = ' + '.join(f"{f['fieldPath']} {f['order'][:3]}" for f in ix['fields'])
    try:
        urllib.request.urlopen(req); print('creando  ', name)
    except urllib.error.HTTPError as e:
        msg = e.read().decode()[:200]
        if e.code == 409: print('ya existe', name)
        else: bad += 1; print('ERROR', e.code, name, msg)
sys.exit(1 if bad else 0)
