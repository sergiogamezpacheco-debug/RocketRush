# Publica la carpeta site/ en Firebase Hosting (https://rocket-rush-7297c.web.app) con la API REST de Hosting.
# Uso (con una sesión de gcloud de la cuenta de servicio): python3 tools/deploy_hosting.py "$(gcloud auth print-access-token)"
# Necesita el rol «Administrador de Firebase Hosting» en la cuenta de servicio.
import gzip, hashlib, json, os, sys, urllib.request, urllib.error
tok, SITE = sys.argv[1], 'rocket-rush-7297c'
API = 'https://firebasehosting.googleapis.com/v1beta1'
H = {'Authorization': 'Bearer ' + tok, 'Content-Type': 'application/json', 'X-Goog-User-Project': SITE}
def call(url, body=None, method='POST', raw=None, ctype=None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    h = dict(H); h['Content-Type'] = ctype or h['Content-Type']
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req) as r: t = r.read(); return json.loads(t) if t else {}
    except urllib.error.HTTPError as e:
        print('ERROR', e.code, url.split('?')[0], e.read().decode()[:400]); sys.exit(1)
# configuración del sitio: direcciones sin .html y el panel nunca en caché
config = {'cleanUrls': True, 'trailingSlashBehavior': 'REMOVE',
          'headers': [{'glob': '/admin/**', 'headers': {'Cache-Control': 'no-cache', 'X-Robots-Tag': 'noindex'}},
                      {'glob': '**/*.@(html|webmanifest|js)', 'headers': {'Cache-Control': 'no-cache'}}]}
ver = call(f'{API}/sites/{SITE}/versions', {'config': config})['name']
files, blobs = {}, {}
for root, _, names in os.walk('site'):
    for n in names:
        p = os.path.join(root, n); rel = '/' + os.path.relpath(p, 'site').replace(os.sep, '/')
        gz = gzip.compress(open(p, 'rb').read(), mtime=0); h = hashlib.sha256(gz).hexdigest()
        files[rel] = h; blobs[h] = gz
pop = call(f'{API}/{ver}:populateFiles', {'files': files})
up = pop.get('uploadUrl'); need = pop.get('uploadRequiredHashes', [])
for h in need: call(f'{up}/{h}', raw=blobs[h], ctype='application/octet-stream')
call(f'{API}/{ver}?update_mask=status', {'status': 'FINALIZED'}, method='PATCH')
call(f'{API}/sites/{SITE}/releases?versionName={ver}', {'message': os.environ.get('GITHUB_SHA', 'manual')[:7]})
print(f'publicado: {len(files)} archivos ({len(need)} nuevos) en https://{SITE}.web.app')
for f in sorted(files): print('  ', f)
