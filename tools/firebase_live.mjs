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
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
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

// panel de administración: configuración en directo, códigos regalo y bloqueo de jugadores
r = await get('config/live'); ok(r.s === 200 || r.s === 404, 'el juego lee la configuración en directo sin cuenta' + (r.s !== 200 && r.s !== 404 ? ' → ' + r.s + ' ' + errOf(r) : ''));
r = await patch('config/zz_test', { data: '{}' }, A.tok); ok(r.s === 403, 'un jugador no puede cambiar la configuración');
r = await patch(`admins/${A.uid}`, { on: true }, A.tok); ok(r.s === 403, 'nadie puede hacerse administrador a sí mismo');
const SA = process.env.SA_TOKEN;
let C = null;
const gcode = 'ZZT' + A.uid.slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, 'X'), gold = gcode + 'OLD';
if (!SA) console.log('AVISO sin la cuenta de servicio no se prueba el panel de administración'), warns++;
else {
  C = await signUp();
  r = await patch(`admins/${C.uid}`, { email: 'prueba', at: new Date() }, SA); ok(r.s === 200, 'dar de alta un administrador de prueba (cuenta de servicio)' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
  r = await get(`admins/${C.uid}`, C.tok); ok(r.s === 200, 'el administrador ve que lo es');
  r = await patch('config/zz_test', { data: '{"boosts":[]}', updatedAt: new Date() }, C.tok); ok(r.s === 200, 'el administrador cambia la configuración' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
  r = await del('config/zz_test', C.tok); ok(r.s === 200, 'el administrador borra una configuración');
  r = await patch(`giftcodes/${gcode}`, { coins: 1, max: 1, used: 0 }, A.tok); ok(r.s === 403, 'un jugador no puede crear códigos regalo');
  r = await patch(`giftcodes/${gcode}`, { coins: 1, gems: 0, max: 1, used: 0, start: 0, end: 0, note: 'prueba' }, C.tok); ok(r.s === 200, 'el administrador crea un código regalo' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
  r = await patch(`giftcodes/${gold}`, { coins: 1, max: 0, used: 0, start: 0, end: Date.now() - 60000 }, C.tok); ok(r.s === 200, 'el administrador crea un código caducado');
  r = await query({ from: [{ collectionId: 'giftcodes' }], limit: 5 }, A.tok); ok(r.s === 403, 'un jugador no puede ver la lista de códigos');
  r = await get(`giftcodes/${gcode}`, B.tok); ok(r.s === 200, 'un jugador lee un código que conoce');
  r = await patch(`giftcodes/${gcode}`, { used: 2 }, B.tok); ok(r.s === 403, 'no se pueden sumar dos usos de golpe');
  r = await patch(`giftcodes/${gcode}`, { coins: 9999 }, B.tok); ok(r.s === 403, 'un jugador no puede cambiar el premio');
  r = await patch(`giftcodes/${gcode}`, { used: 1 }, B.tok); ok(r.s === 200, 'canjear un código regalo' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
  r = await patch(`giftcodes/${gcode}`, { used: 2 }, A.tok); ok(r.s === 403, 'un código agotado ya no se canjea');
  r = await patch(`giftcodes/${gold}`, { used: 1 }, A.tok); ok(r.s === 403, 'un código caducado no se canjea');
  r = await patch(`users/${B.uid}`, { banned: true, name: 'Jugador bloqueado' }, C.tok); ok(r.s === 200, 'el administrador bloquea a un jugador' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
  r = await patch(`users/${B.uid}`, { name: 'Vuelvo' }, B.tok); ok(r.s === 403, 'un jugador bloqueado ya no puede subir su perfil');
  r = await patch(`users/${B.uid}`, { banned: null }, C.tok); ok(r.s === 200, 'el administrador lo desbloquea');
  r = await req(`${FS}/users/${B.uid}?updateMask.fieldPaths=banned`, { method: 'PATCH', body: JSON.stringify({ fields: {} }) }, C.tok); ok(r.s === 200, 'quitar el campo de bloqueo');
  r = await patch(`users/${B.uid}`, { name: 'Prueba B' }, B.tok); ok(r.s === 200, 'desbloqueado, vuelve a subir su perfil' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
  r = await req(`${FS}:runAggregationQuery`, { method: 'POST', body: JSON.stringify({ structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: 'users' }] }, aggregations: [{ alias: 'n', count: {} }] } }) }, C.tok);
  ok(r.s === 200, 'el panel cuenta los jugadores' + (r.s === 200 ? ` (${r.j[0].result.aggregateFields.n.integerValue})` : ' → ' + errOf(r)));
  for (const g of [gcode, gold]) { r = await del(`giftcodes/${g}`, C.tok); ok(r.s === 200, 'el administrador borra un código'); }
}

// ---------------- nombres únicos y probadores ----------------
const nm = 'zzprueba ' + A.uid.slice(0, 6).toLowerCase();
r = await patch(`names/${encodeURIComponent(nm)}`, { uid: A.uid }, A.tok, '&currentDocument.exists=false'); ok(r.s === 200, 'reservar un nombre' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
r = await patch(`names/${encodeURIComponent(nm)}`, { uid: B.uid }, B.tok, '&currentDocument.exists=false'); ok(r.s !== 200, 'nadie más puede coger un nombre reservado');
r = await patch(`names/${encodeURIComponent(nm + 'x')}`, { uid: A.uid }, B.tok); ok(r.s === 403, 'no se reserva un nombre a nombre de otro');
r = await get(`names/${encodeURIComponent(nm)}`, B.tok); ok(r.s === 200 && r.j.fields.uid.stringValue === A.uid, 'comprobar si un nombre está libre');
r = await del(`names/${encodeURIComponent(nm)}`, B.tok); ok(r.s === 403, 'nadie libera el nombre de otro');
r = await del(`names/${encodeURIComponent(nm)}`, A.tok); ok(r.s === 200, 'liberar mi nombre');
r = await get(`testers/${A.uid}`, A.tok); ok(r.s === 404, 'un jugador mira si es probador (no lo es)' + (r.s !== 404 ? ' → ' + r.s : ''));
r = await get(`testers/${A.uid}`, B.tok); ok(r.s === 403, 'nadie mira si otro es probador');
r = await patch(`testers/${A.uid}`, { name: 'yo' }, A.tok); ok(r.s === 403, 'nadie se hace probador a sí mismo');
if (SA) {
  r = await patch(`testers/${A.uid}`, { name: 'Prueba A', at: new Date() }, SA); ok(r.s === 200, 'el panel marca un probador');
  r = await get(`testers/${A.uid}`, A.tok); ok(r.s === 200, 'el probador lo ve');
  await del(`testers/${A.uid}`, SA);
}

// ---------------- copia del progreso ----------------
r = await patch(`saves/${A.uid}`, { data: '{}', at: new Date(), lv: 1, stars: 0, dev: 'x' }, A.tok); ok(r.s === 403, 'sin entrar con Google no se sube copia a la nube');
r = await get(`saves/${A.uid}`, B.tok); ok(r.s === 403, 'nadie lee la copia de otro');

// ---------------- denuncias ----------------
r = await patch(`reports/${B.uid}_${A.uid}`, { by: B.uid, kind: 'player', target: A.uid, name: 'Prueba A', reason: 'name', at: new Date() }, B.tok, '&currentDocument.exists=false');
ok(r.s === 200, 'denunciar a un jugador' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
r = await patch(`reports/${B.uid}_${A.uid}`, { by: B.uid, kind: 'player', target: A.uid, name: 'Prueba A', reason: 'cheat', at: new Date() }, B.tok, '&currentDocument.exists=false');
ok(r.s !== 200, 'no se puede denunciar dos veces al mismo');
r = await patch(`reports/${A.uid}_${B.uid}`, { by: A.uid, kind: 'player', target: B.uid, name: 'x', reason: 'name', at: new Date() }, B.tok); ok(r.s === 403, 'no se denuncia en nombre de otro');
r = await patch(`reports/${B.uid}_zz`, { by: B.uid, kind: 'player', target: 'zz', name: 'x', reason: 'insulto', at: new Date() }, B.tok); ok(r.s === 403, 'rechaza motivos inventados');
r = await get(`reports/${B.uid}_${A.uid}`, B.tok); ok(r.s === 403, 'un jugador no puede leer las denuncias');
if (SA) { r = await query({ from: [{ collectionId: 'reports' }], limit: 5 }, SA); ok(r.s === 200, 'el panel lee las denuncias'); }
r = await del(`reports/${B.uid}_${A.uid}`, B.tok); ok(r.s === 403, 'un jugador no puede borrar denuncias');
if (SA) await del(`reports/${B.uid}_${A.uid}`, SA);

// ---------------- clubes ----------------
const commit = (writes, tok) => req(`${FS}:commit`, { method: 'POST', body: JSON.stringify({ writes }) }, tok);
const W = (p, data, mask, pre) => Object.assign({ update: { name: `${ROOT}/${p}`, fields: enc(data).mapValue.fields } }, mask ? { updateMask: { fieldPaths: Object.keys(data) } } : {}, pre ? { currentDocument: pre } : {});
const WD = (p, pre) => Object.assign({ delete: `${ROOT}/${p}` }, pre ? { currentDocument: pre } : {});
const mem = (name, role) => ({ name, avatar: '🦊', role, joinedAt: new Date(), wk: '', ex: 0, exN: 0, dmg: 0, atk: '', atkN: 0, lg: '', lgS: 0 });
const D = await signUp();
const cid = 'zzt' + A.uid.slice(0, 8).toLowerCase().replace(/[^a-z0-9]/g, 'x'), cname = 'Club Prueba ' + cid.slice(3, 9), clc = cname.toLowerCase();
const club = (o = {}) => Object.assign({ name: cname, nameLc: clc, desc: 'prueba', open: true, minLv: 0, lang: 'es', country: 'ZZ', badge: { ico: '🚀', c: 1 }, leader: A.uid, count: 1, last: A.uid, lg: { id: '', s: 0 }, createdAt: new Date() }, o);
const cget = async () => { const x = await get(`clubs/${cid}`, A.tok); return { c: x.j.fields ? +x.j.fields.count.integerValue : -1, ut: x.j.updateTime }; };
r = await commit([W(`clubs/${cid}`, club({ count: 5 }), 0, { exists: false }), W(`clubs/${cid}/members/${A.uid}`, mem('A', 'leader'), 0, { exists: false }), W(`clubnames/${clc}`, { cid }, 0, { exists: false })], A.tok);
ok(r.s === 403, 'un club no puede nacer con miembros de más');
r = await commit([W(`clubs/${cid}`, club({ leader: B.uid }), 0, { exists: false }), W(`clubs/${cid}/members/${A.uid}`, mem('A', 'leader'), 0, { exists: false }), W(`clubnames/${clc}`, { cid }, 0, { exists: false })], A.tok);
ok(r.s === 403, 'no se crea un club a nombre de otro líder');
r = await commit([W(`clubs/${cid}`, club(), 0, { exists: false }), W(`clubs/${cid}/members/${A.uid}`, mem('A', 'leader'), 0, { exists: false }), W(`clubnames/${clc}`, { cid }, 0, { exists: false })], A.tok);
ok(r.s === 200, 'crear un club (club + líder + nombre en un lote)' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
r = await commit([W(`clubs/${cid}x`, club({ leader: D.uid, last: D.uid }), 0, { exists: false }), W(`clubs/${cid}x/members/${D.uid}`, mem('D', 'leader'), 0, { exists: false }), W(`clubnames/${clc}`, { cid: cid + 'x' }, 0, { exists: false })], D.tok);
ok(r.s !== 200, 'no puede haber dos clubes con el mismo nombre');
r = await query({ from: [{ collectionId: 'clubs' }], where: { compositeFilter: { op: 'AND', filters: [eq('open', true), { fieldFilter: { field: { fieldPath: 'count' }, op: 'LESS_THAN', value: enc(30) } }] } }, orderBy: [{ field: { fieldPath: 'count' }, direction: 'DESCENDING' }], limit: 30 }, B.tok);
ok(r.s === 200, 'buscar clubes abiertos' + (r.s !== 200 ? ' → ' + (/index/i.test(errOf(r)) ? 'falta el índice (o aún se está creando)' : errOf(r)) : ''), true);
let cs = await cget();
r = await commit([W(`clubs/${cid}/members/${B.uid}`, mem('B', 'officer'), 0, { exists: false }), W(`clubs/${cid}`, { count: cs.c + 1, last: B.uid }, 1, { updateTime: cs.ut })], B.tok);
ok(r.s === 403, 'nadie entra ya como oficial');
r = await commit([W(`clubs/${cid}`, { count: cs.c + 1, last: B.uid }, 1, { updateTime: cs.ut })], B.tok);
ok(r.s === 403, 'el contador no sube sin miembro nuevo');
r = await commit([W(`clubs/${cid}/members/${B.uid}`, mem('B', 'member'), 0, { exists: false }), W(`clubs/${cid}`, { count: cs.c + 1, last: B.uid }, 1, { updateTime: cs.ut })], B.tok);
ok(r.s === 200, 'entrar en un club abierto' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
cs = await cget(); ok(cs.c === 2, 'el club tiene 2 miembros');
r = await patch(`clubs/${cid}/members/${B.uid}`, { wk: '2026-W44', ex: 21, exN: 9, dmg: 12000, atk: '2026-W44-2', atkN: 2, lg: '', lgS: 0 }, B.tok); ok(r.s === 200, 'subir mi progreso de la semana' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
r = await patch(`clubs/${cid}/members/${B.uid}`, { ex: 999 }, B.tok); ok(r.s === 403, 'rechaza estrellas imposibles');
r = await patch(`clubs/${cid}/members/${B.uid}`, { role: 'leader' }, B.tok); ok(r.s === 403, 'un miembro no se asciende a sí mismo');
r = await patch(`clubs/${cid}/members/${A.uid}`, { dmg: 5 }, B.tok); ok(r.s === 403, 'nadie cambia el progreso de otro');
r = await patch(`clubs/${cid}`, { desc: 'hackeado' }, B.tok); ok(r.s === 403, 'un miembro no cambia los ajustes del club');
r = await patch(`clubs/${cid}`, { lg: { id: '2026-W44', s: 25 } }, B.tok); ok(r.s === 200, 'sumar puntos de liga del club' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
r = await patch(`clubs/${cid}`, { lg: { id: '2026-W44', s: 500 } }, B.tok); ok(r.s === 403, 'rechaza puntos de liga imposibles');
r = await query({ from: [{ collectionId: 'clubs' }], where: eq('lg.id', '2026-W44'), orderBy: [{ field: { fieldPath: 'lg.s' }, direction: 'DESCENDING' }], limit: 50 }, B.tok);
ok(r.s === 200, 'clasificación de la liga de clubes' + (r.s !== 200 ? ' → ' + (/index/i.test(errOf(r)) ? 'falta el índice (o aún se está creando)' : errOf(r)) : ''), true);
r = await patch(`clubs/${cid}/members/${B.uid}`, { role: 'elder' }, A.tok); ok(r.s === 200, 'el líder asciende a veterano' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
r = await patch(`clubs/${cid}`, { desc: 'veterano' }, B.tok); ok(r.s === 403, 'un veterano no cambia los ajustes');
r = await patch(`clubs/${cid}/members/${A.uid}`, { role: 'member' }, B.tok); ok(r.s === 403, 'un veterano no degrada al líder');
r = await patch(`clubs/${cid}/members/${B.uid}`, { role: 'officer' }, A.tok); ok(r.s === 200, 'el líder asciende a colíder' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
r = await patch(`clubs/${cid}`, { max: 5 }, B.tok); ok(r.s === 403, 'el máximo del club no baja de 10');
r = await patch(`clubs/${cid}`, { max: 60 }, B.tok); ok(r.s === 403, 'el máximo del club no pasa de 50');
r = await patch(`clubs/${cid}`, { max: 50, open: false, closed: false, desc: 'con solicitud' }, B.tok); ok(r.s === 200, 'un colíder cambia los ajustes (máximo 50, con solicitud)' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
cs = await cget();
r = await commit([W(`clubs/${cid}/members/${D.uid}`, mem('D', 'member'), 0, { exists: false }), W(`clubs/${cid}`, { count: cs.c + 1, last: D.uid }, 1, { updateTime: cs.ut })], D.tok);
ok(r.s === 403, 'en un club con solicitud no se entra directamente');
r = await patch(`clubs/${cid}/requests/${D.uid}`, { name: 'D', avatar: '🐸', lv: 12, at: new Date() }, D.tok); ok(r.s === 200, 'pedir entrar' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
r = await req(`${FS}/clubs/${cid}/requests`, {}, D.tok); ok(r.s === 403, 'un jugador no ve las solicitudes de otros');
r = await req(`${FS}/clubs/${cid}/requests`, {}, B.tok); ok(r.s === 200 && (r.j.documents || []).length === 1, 'un oficial ve las solicitudes');
cs = await cget();
r = await commit([W(`clubs/${cid}/members/${D.uid}`, mem('D', 'member'), 0, { exists: false }), WD(`clubs/${cid}/requests/${D.uid}`, { exists: true }), W(`clubs/${cid}`, { count: cs.c + 1, last: D.uid }, 1, { updateTime: cs.ut })], B.tok);
ok(r.s === 200, 'un colíder acepta la solicitud' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
cs = await cget(); ok(cs.c === 3, 'el club tiene 3 miembros');
r = await patch(`clubs/${cid}/members/${D.uid}`, { role: 'officer' }, B.tok); ok(r.s === 403, 'un colíder no nombra colíderes');
r = await patch(`clubs/${cid}/members/${D.uid}`, { role: 'elder' }, B.tok); ok(r.s === 200, 'un colíder asciende a veterano' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
r = await patch(`clubs/${cid}/members/${B.uid}`, { role: 'member' }, D.tok); ok(r.s === 403, 'un veterano no degrada a un colíder');
r = await patch(`clubs/${cid}`, { closed: true }, B.tok); ok(r.s === 200, 'cerrar el club' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
const E = await signUp(); r = await patch(`clubs/${cid}/requests/${E.uid}`, { name: 'E', avatar: '🐸', lv: 12, at: new Date() }, E.tok); ok(r.s === 403, 'en un club cerrado no se puede pedir entrar');
r = await patch(`clubs/${cid}`, { closed: false }, B.tok); ok(r.s === 200, 'volver a abrir las solicitudes' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
// liga por grupos: un miembro mete a su club en un grupo (club y grupo en el mismo lote); nadie de fuera puede
const LGT = 'T' + cid.slice(3, 9), gid = LGT + '_g' + A.uid.slice(0, 10).replace(/[^A-Za-z0-9]/g, 'x');
const grp = (o = {}) => Object.assign({ lg: LGT, open: LGT, clubs: [cid], n: 1 }, o);
r = await commit([W(`leaguegroups/${gid}`, grp(), 0, { exists: false }), W(`clubs/${cid}`, { lgG: { id: LGT, g: gid } }, 1)], E.tok);
ok(r.s === 403, 'alguien de fuera no mete al club en un grupo de liga');
r = await commit([W(`leaguegroups/${gid}`, grp({ n: 2 }), 0, { exists: false }), W(`clubs/${cid}`, { lgG: { id: LGT, g: gid } }, 1)], D.tok);
ok(r.s === 403, 'un grupo no puede nacer con el contador mal');
r = await commit([W(`leaguegroups/${gid}`, grp(), 0, { exists: false }), W(`clubs/${cid}`, { lgG: { id: LGT, g: gid } }, 1)], D.tok);
ok(r.s === 200, 'un miembro abre un grupo de liga con su club' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
r = await commit([W(`leaguegroups/${gid}y`, grp(), 0, { exists: false }), W(`clubs/${cid}`, { lgG: { id: LGT, g: gid + 'y' } }, 1)], D.tok);
ok(r.s === 403, 'un club no entra en dos grupos de la misma liga');
r = await commit([W(`leaguegroups/${gid}`, grp({ clubs: [cid, 'otroclubdeprueba'], n: 2 }))], E.tok);
ok(r.s === 403, 'no se puede añadir a un grupo un club que no es tuyo');
r = await commit([W(`leaguegroups/${gid}`, grp({ open: '', n: 1 }))], D.tok);
ok(r.s === 403, 'no se puede cerrar ni tocar un grupo sin entrar en él');
r = await get(`leaguegroups/${gid}`, E.tok); ok(r.s === 200, 'cualquiera ve la clasificación de un grupo');
if (SA) await del(`leaguegroups/${gid}`, SA);
cs = await cget(); // cerrar y abrir cambió la versión del club
r = await commit([WD(`clubs/${cid}/members/${A.uid}`, { exists: true }), W(`clubs/${cid}`, { count: cs.c - 1, last: A.uid }, 1, { updateTime: cs.ut })], B.tok);
ok(r.s === 403, 'un colíder no puede expulsar al líder');
r = await commit([WD(`clubs/${cid}/members/${D.uid}`, { exists: true }), W(`clubs/${cid}`, { count: cs.c - 1, last: D.uid }, 1, { updateTime: cs.ut })], B.tok);
ok(r.s === 200, 'un colíder expulsa a un veterano' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
r = await commit([W(`clubs/${cid}/members/${B.uid}`, { role: 'leader' }, 1), W(`clubs/${cid}/members/${A.uid}`, { role: 'officer' }, 1), W(`clubs/${cid}`, { leader: B.uid }, 1)], A.tok);
ok(r.s === 200, 'el líder cede el liderazgo' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
cs = await cget();
r = await commit([WD(`clubs/${cid}/members/${A.uid}`, { exists: true }), W(`clubs/${cid}`, { count: cs.c - 1, last: A.uid }, 1, { updateTime: cs.ut })], A.tok);
ok(r.s === 200, 'salir del club' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
r = await commit([WD(`clubs/${cid}/members/${B.uid}`), WD(`clubs/${cid}`), WD(`clubnames/${clc}`)], B.tok);
ok(r.s === 200, 'el último en salir borra el club' + (r.s !== 200 ? ' → ' + errOf(r) : ''));
r = await get(`clubs/${cid}`, A.tok); ok(r.s === 404, 'el club ya no existe');
for (const p of [`clubs/${cid}/members/${A.uid}`, `clubs/${cid}/members/${B.uid}`, `clubs/${cid}/members/${D.uid}`, `clubs/${cid}/requests/${D.uid}`, `clubs/${cid}`, `clubnames/${clc}`, `clubs/${cid}x/members/${D.uid}`, `clubs/${cid}x`])
  if (SA) await del(p, SA);
{ const d = await req(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${KEY}`, { method: 'POST', body: JSON.stringify({ idToken: D.tok }) }); ok(d.s === 200, 'borrar el jugador de prueba D'); }
{ const d = await req(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${KEY}`, { method: 'POST', body: JSON.stringify({ idToken: E.tok }) }); ok(d.s === 200, 'borrar el jugador de prueba E'); }

// limpieza: no queda nada de la prueba
r = await del(`friendships/${pair}`, B.tok); ok(r.s === 200, 'quitar amigo');
for (const [u, c] of [[A, codeA], [B, codeB]]) {
  await del(`codes/${c}`, u.tok); await del(`users/${u.uid}`, u.tok);
  const d = await req(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${KEY}`, { method: 'POST', body: JSON.stringify({ idToken: u.tok }) });
  ok(d.s === 200, 'borrar el jugador de prueba');
}
if (C) {
  await del(`admins/${C.uid}`, SA);
  const d = await req(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${KEY}`, { method: 'POST', body: JSON.stringify({ idToken: C.tok }) });
  ok(d.s === 200, 'borrar el administrador de prueba');
}
console.log(`\n${fails ? fails + ' fallos' : 'Todo bien'}${warns ? ' · ' + warns + ' avisos' : ''}`);
process.exit(fails ? 1 : 0);
