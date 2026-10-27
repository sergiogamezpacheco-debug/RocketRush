# Da o quita permiso de administrador del panel a una cuenta de Firebase Authentication (por su correo).
# La cuenta se crea antes en la consola: Authentication › Usuarios › Agregar usuario (correo y contraseña).
# Uso: python3 tools/add_admin.py "$(gcloud auth print-access-token)" correo@ejemplo.com [add|remove]
import json, sys, urllib.request, urllib.error, datetime
tok, email = sys.argv[1], sys.argv[2].strip().lower()
action = sys.argv[3] if len(sys.argv) > 3 else 'add'
PID = 'rocket-rush-7297c'
H = {'Authorization': 'Bearer ' + tok, 'Content-Type': 'application/json', 'X-Goog-User-Project': PID}
def call(url, body=None, method='POST'):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, method=method, headers=H)
    try:
        with urllib.request.urlopen(req) as r: t = r.read(); return json.loads(t) if t else {}
    except urllib.error.HTTPError as e:
        print('ERROR', e.code, e.read().decode()[:400]); sys.exit(1)
u = call(f'https://identitytoolkit.googleapis.com/v1/projects/{PID}/accounts:lookup', {'email': [email]}).get('users') or []
if not u:
    print(f'No hay ninguna cuenta con el correo {email}. Créala en Firebase › Authentication › Usuarios › Agregar usuario.'); sys.exit(1)
uid = u[0]['localId']
doc = f'https://firestore.googleapis.com/v1/projects/{PID}/databases/(default)/documents/admins/{uid}'
if action == 'remove':
    call(doc, method='DELETE'); print(f'{email} ya no es administrador')
else:
    now = datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')
    call(doc, {'fields': {'email': {'stringValue': email}, 'at': {'timestampValue': now}}}, method='PATCH')
    print(f'{email} es administrador del panel. Entra en https://{PID}.web.app/admin')
