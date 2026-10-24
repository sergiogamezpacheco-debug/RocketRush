// Prueba contra el Firebase REAL (se ejecuta en GitHub Actions: node tools/firebase_live.mjs).
// Crea dos jugadores anónimos de prueba, comprueba lo que las reglas dejan hacer y lo que no, y al final lo borra todo.
const KEY = 'AIzaSyC9Rbs2qrzJaSugbHCjOTpuH_QQZKw8DNc', PID = 'rocket-rush-7297c';
const DB = process.env.FS_DB || '(default)';
console.log('base de datos: ' + DB);
const ROOT = `projects/${PID}/databases/${DB}/documents`, FS = 'https://firestore.googleapis.com/v1/' + ROOT;
let fails = 0, warns = 0;
const ok = (c, msg, warnOnly) => { console.log((c ? 'OK   ' : warnOnly ? 'AVISO' : 'FALLO') + ' ' + msg); if (!c) warnOnly ? warns++ : fails++; };

async function req(url, opt = {}, tok) {
  const h = { 'Content-Type': 'application/json' }; if (tok) h.Authorization = 'Bearer ' + tok;
  const r = await fetch(url, { ...opt, headers: { ...h, ...(opt.headers || {}) } });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { j = t; }
  return { s: r.status, j };
}
function enc(v) {
  if (v === null) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  const f = {}; for (const k in v) f[k] = enc(v[k]); return { mapValue: { fields: f } };
}
const patch = (p, data, tok, extra = '') => req(`${FS}/${p}?${Object.keys(data).map(k => 'updateMask.fieldPaths=' + k).join('&')}${extra}`, { method: 'PATCH', body: JSON.stringify({ fields: enc(data).mapValue.fields }) }, tok);
const get = (p, tok) => req(`${FS}/${p}`, {}, tok);
const del = (p, tok) => req(`${FS}/${p}`, { method: 'DELETE' }, tok);
const query = (sq, tok) => req(`${FS}:runQuery`, { method: 'POST', body: JSON.stringify({ structuredQuery: sq }) }, tok);
const eq = (f, v) => ({ fieldFilter: { field: { fieldPath: f }, op: 'EQUAL', value: enc(v) } });
const errOf = r => JSON.stringify(r.j).slice(0, 300);

async function signUp() {
  const r = await req(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`, { method: 'POST', body: JSON.stringify({ returnSecureToken: true }) });
  ok(r.s === 200, 'inicio de sesión anónimo' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
  if (r.s !== 200) { console.log('Sin sesión no se puede seguir.'); process.exit(1); }
  return { uid: r.j.localId, tok: r.j.idToken, refresh: r.j.refreshToken };
}

const A = await signUp(), B = await signUp();
// renovar el pase de sesión (lo que hace el juego cada hora)
{
  const r = await req(`https://securetoken.googleapis.com/v1/token?key=${KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(A.refresh) });
  ok(r.s === 200 && r.j.user_id === A.uid, 'renovar sesión');
}
const stats = lv => ({ lv: 3, level: lv, stars: lv * 2, perfect: 1, daily: 2, dailyBest: 4, winRun: 1, bestRun: 5, wins: lv, plays: lv + 2, bestShot: 9, bosses: 1, blocks: 300 });
const prof = (name, lv) => ({ name, avatar: '🦊', code: 'RR-TEST', lang: 'es', country: 'ZZ', stats: stats(lv), updatedAt: new Date(), createdAt: new Date() });
const codeA = 'TST' + A.uid.slice(0, 5).toUpperCase(), codeB = 'TST' + B.uid.slice(0, 5).toUpperCase();

let r = await patch(`users/${A.uid}`, prof('Prueba A', 30), A.tok); ok(r.s === 200, 'crear perfil propio' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
r = await patch(`users/${B.uid}`, prof('Prueba B', 10), B.tok); ok(r.s === 200, 'crear perfil del otro jugador');
r = await patch(`users/${A.uid}`, { name: 'X'.repeat(30) }, A.tok); ok(r.s === 403, 'rechaza un nombre de más de 20 letras');
r = await patch(`users/${A.uid}`, { hack: 1 }, A.tok); ok(r.s === 403, 'rechaza campos inventados en el perfil');
r = await patch(`users/${A.uid}`, { name: 'Pirata' }, B.tok); ok(r.s === 403, 'nadie puede cambiar el perfil de otro');
r = await get(`users/${B.uid}`, A.tok); ok(r.s === 200, 'leer el perfil de otro jugador');
r = await get(`users/${B.uid}`); ok(r.s === 403, 'sin sesión no se lee nada');

r = await patch(`codes/${codeA}`, { uid: A.uid }, A.tok, '&currentDocument.exists=false'); ok(r.s === 200, 'reservar código de amigo' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
r = await patch(`codes/${codeB}`, { uid: B.uid }, B.tok, '&currentDocument.exists=false'); ok(r.s === 200, 'reservar el código del otro');
r = await patch(`codes/${codeA}`, { uid: B.uid }, B.tok); ok(r.s === 403, 'no se puede robar un código ajeno');
r = await get(`codes/${codeA}`, B.tok); ok(r.s === 200 && r.j.fields.uid.stringValue === A.uid, 'buscar a un jugador por su código');
r = await get('codes/NOEXISTE1', B.tok); ok(r.s === 404, 'código inexistente → no encontrado');

const [a, b] = A.uid < B.uid ? [A.uid, B.uid] : [B.uid, A.uid], pair = a + '_' + b;
r = await get(`friendships/${pair}`, B.tok); ok(r.s === 404, 'comprobar si ya hay solicitud (no existe)' + (r.s !== 404 ? ' → ' + r.s + ' ' + errOf(r) : ''));
r = await patch(`friendships/${pair}`, { a, b, from: A.uid, status: 'pending', at: new Date() }, B.tok, '&currentDocument.exists=false'); ok(r.s === 403, 'no se puede pedir amistad en nombre de otro');
r = await patch(`friendships/${pair}`, { a, b, from: B.uid, status: 'accepted', at: new Date() }, B.tok, '&currentDocument.exists=false'); ok(r.s === 403, 'una solicitud no puede nacer ya aceptada');
r = await patch(`friendships/${pair}`, { a, b, from: B.uid, status: 'pending', at: new Date() }, B.tok, '&currentDocument.exists=false'); ok(r.s === 200, 'enviar solicitud de amistad' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
r = await patch(`friendships/${pair}`, { status: 'accepted', since: new Date() }, B.tok); ok(r.s === 403, 'quien la envía no puede aceptarla él mismo');
for (const k of ['a', 'b']) {
  r = await query({ from: [{ collectionId: 'friendships' }], where: eq(k, A.uid), limit: 50 }, A.tok);
  ok(r.s === 200, `listar mis amistades (campo ${k})` + (r.s !== 200 ? ' → ' + errOf(r) : ''));
}
r = await query({ from: [{ collectionId: 'friendships' }], limit: 5 }, A.tok); ok(r.s === 403, 'no se pueden listar las amistades de todos');
r = await patch(`friendships/${pair}`, { status: 'accepted', since: new Date() }, A.tok); ok(r.s === 200, 'aceptar la solicitud' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
r = await req(`${FS}:batchGet`, { method: 'POST', body: JSON.stringify({ documents: [`${ROOT}/users/${B.uid}`] }) }, A.tok); ok(r.s === 200 && r.j[0].found, 'descargar los perfiles de los amigos');

// clasificaciones
r = await query({ from: [{ collectionId: 'users' }], orderBy: [{ field: { fieldPath: 'stats.level' }, direction: 'DESCENDING' }], limit: 50 }, A.tok);
ok(r.s === 200, 'clasificación mundial' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
r = await req(`${FS}:runAggregationQuery`, { method: 'POST', body: JSON.stringify({ structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: 'users' }], where: { fieldFilter: { field: { fieldPath: 'stats.level' }, op: 'GREATER_THAN', value: enc(10) } } }, aggregations: [{ alias: 'n', count: {} }] } }) }, B.tok);
ok(r.s === 200, 'puesto en la clasificación mundial' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
for (const m of ['level', 'stars', 'daily', 'wins', 'bestRun', 'bestShot', 'bosses', 'lv']) {
  r = await query({ from: [{ collectionId: 'users' }], where: eq('country', 'ZZ'), orderBy: [{ field: { fieldPath: 'stats.' + m }, direction: 'DESCENDING' }], limit: 50 }, A.tok);
  const n = r.s === 200 ? r.j.filter(x => x.document).length : 0;
  ok(r.s === 200 && n === 2, `clasificación por país · ${m}` + (r.s !== 200 ? ' → ' + (/index/i.test(errOf(r)) ? 'falta el índice (o aún se está creando)' : errOf(r)) : ` (${n} jugadores)`), true);
  r = await req(`${FS}:runAggregationQuery`, { method: 'POST', body: JSON.stringify({ structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: 'users' }], where: { compositeFilter: { op: 'AND', filters: [eq('country', 'ZZ'), { fieldFilter: { field: { fieldPath: 'stats.' + m }, op: 'GREATER_THAN', value: enc(0) } }] } } }, aggregations: [{ alias: 'n', count: {} }] } }) }, A.tok);
  ok(r.s === 200, `puesto por país · ${m}` + (r.s !== 200 ? ' → ' + (/index/i.test(errOf(r)) ? 'falta el índice (o aún se está creando)' : errOf(r)) : ''), true);
}

// limpieza: no queda nada de la prueba
r = await del(`friendships/${pair}`, B.tok); ok(r.s === 200, 'quitar amigo');
for (const [u, c] of [[A, codeA], [B, codeB]]) {
  await del(`codes/${c}`, u.tok); await del(`users/${u.uid}`, u.tok);
  const d = await req(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${KEY}`, { method: 'POST', body: JSON.stringify({ idToken: u.tok }) });
  ok(d.s === 200, 'borrar el jugador de prueba');
}
console.log(`\n${fails ? fails + ' fallos' : 'Todo bien'}${warns ? ' · ' + warns + ' avisos' : ''}`);
process.exit(fails ? 1 : 0);
