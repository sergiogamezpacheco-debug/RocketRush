// Rocket Rush — social: perfil, amigos y clasificaciones.
// Habla con Firebase directamente por internet (REST), sin cargar ninguna librería: el juego sigue funcionando
// igual sin conexión y, cuando la hay, sube el perfil y descarga amigos y clasificaciones.
//   · Cuenta: inicio de sesión anónimo (cada móvil es un jugador; la sesión se guarda en el propio móvil).
//   · Firestore: users/{uid} (perfil público con estadísticas), codes/{código} → uid, friendships/{uidA_uidB}.
// Las reglas de seguridad están en firebase/firestore.rules.
(function () {
  'use strict';
  const X = window.RRGame;
  if (!X) return;
  const $ = id => document.getElementById(id);
  const T = s => (window.I18N ? I18N.t(s) : s);
  const CFG = { apiKey: 'AIzaSyC9Rbs2qrzJaSugbHCjOTpuH_QQZKw8DNc', projectId: 'rocket-rush-7297c' };
  const ROOT = `projects/${CFG.projectId}/databases/${window.RR_FS_DB || '(default)'}/documents`;   // RR_FS_DB: solo para pruebas
  const FS = 'https://firestore.googleapis.com/v1/' + ROOT;
  const IDT = 'https://identitytoolkit.googleapis.com/v1', STS = 'https://securetoken.googleapis.com/v1';
  const AUTH_KEY = 'rocketrush.auth', PUSH_KEY = 'rocketrush.pushed';
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };
  let auth = null; try { auth = JSON.parse(lsGet(AUTH_KEY) || 'null'); } catch (e) { auth = null; }
  const saveAuth = () => lsSet(AUTH_KEY, JSON.stringify(auth));

  // ---------------- conexión ----------------
  let net = 'idle', netErr = '';                 // idle · connecting · online · offline · error
  function setNet(s, err) { net = s; netErr = err || ''; renderNet(); }
  let inflight = 0;                               // peticiones en curso (para las pruebas)
  class FbErr extends Error { constructor(status, code, msg) { super(msg || code); this.status = status; this.code = code || ''; } }
  async function call(url, opt, authed) {
    opt = opt || {};
    const h = Object.assign({ 'Content-Type': 'application/json' }, opt.headers || {});
    if (authed !== false) h.Authorization = 'Bearer ' + await token();
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const tm = ctl ? setTimeout(() => ctl.abort(), 15000) : 0;
    let r; inflight++;
    try { r = await fetch(url, Object.assign({}, opt, { headers: h, signal: ctl ? ctl.signal : undefined })); } catch (e) { throw new FbErr(0, 'NETWORK', String(e && e.message || e)); } finally { clearTimeout(tm); inflight--; }
    const txt = await r.text(); let j = null;
    try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = null; }
    if (!r.ok) {
      const er = (j && (j.error || (Array.isArray(j) && j[0] && j[0].error))) || {};
      throw new FbErr(r.status, er.status || er.message || 'HTTP', er.message || txt.slice(0, 300));
    }
    return j;
  }
  // sesión anónima: se crea la primera vez y después solo se renueva el pase (dura 1 hora)
  let tokP = null;
  function token() {
    if (auth && auth.id && auth.exp > Date.now() + 60e3) return Promise.resolve(auth.id);
    return tokP || (tokP = renew().finally(() => { tokP = null; }));
  }
  async function renew() {
    if (auth && auth.refresh) {
      try {
        const j = await call(`${STS}/token?key=${CFG.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(auth.refresh) }, false);
        auth = { uid: j.user_id, id: j.id_token, refresh: j.refresh_token, exp: Date.now() + (+j.expires_in || 3600) * 1000 };
        saveAuth(); return auth.id;
      } catch (e) {
        // sin conexión o servidor caído: se reintenta más tarde. Pase inválido (cuenta borrada): cuenta nueva
        if (e.status === 0 || e.status >= 500 || !/TOKEN|USER_|INVALID/.test(e.code + ' ' + e.message)) throw e;
      }
    }
    const j = await call(`${IDT}/accounts:signUp?key=${CFG.apiKey}`, { method: 'POST', body: JSON.stringify({ returnSecureToken: true }) }, false);
    auth = { uid: j.localId, id: j.idToken, refresh: j.refreshToken, exp: Date.now() + (+j.expiresIn || 3600) * 1000 };
    saveAuth(); X.save.codeUid = null; X.persist();
    return auth.id;
  }

  // ---------------- Firestore (formato de valores de la API REST) ----------------
  function enc(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (v instanceof Date) return { timestampValue: v.toISOString() };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === 'string') return { stringValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
    const fields = {};
    for (const k in v) if (v[k] !== undefined) fields[k] = enc(v[k]);
    return { mapValue: { fields } };
  }
  function dec(x) {
    if (!x) return null;
    if ('stringValue' in x) return x.stringValue;
    if ('integerValue' in x) return Number(x.integerValue);
    if ('doubleValue' in x) return Number(x.doubleValue);
    if ('booleanValue' in x) return x.booleanValue;
    if ('timestampValue' in x) return Date.parse(x.timestampValue);
    if ('arrayValue' in x) return (x.arrayValue.values || []).map(dec);
    if ('mapValue' in x) return decFields(x.mapValue.fields);
    return null;
  }
  function decFields(f) { const o = {}; for (const k in f || {}) o[k] = dec(f[k]); return o; }
  const docOf = d => d && d.name ? Object.assign(decFields(d.fields), { _id: d.name.split('/').pop() }) : null;
  async function getDoc(p) {
    try { return docOf(await call(`${FS}/${p}`)); } catch (e) { if (e.status === 404) return null; throw e; }
  }
  async function setDoc(p, data, o) {
    o = o || {};
    const q = [];
    if (o.merge !== false) for (const k of Object.keys(data)) q.push('updateMask.fieldPaths=' + encodeURIComponent(k));
    if (o.mustNotExist) q.push('currentDocument.exists=false');
    return docOf(await call(`${FS}/${p}${q.length ? '?' + q.join('&') : ''}`, { method: 'PATCH', body: JSON.stringify({ fields: enc(data).mapValue.fields }) }));
  }
  const delDoc = p => call(`${FS}/${p}`, { method: 'DELETE' });
  async function runQuery(sq) {
    const j = await call(`${FS}:runQuery`, { method: 'POST', body: JSON.stringify({ structuredQuery: sq }) });
    return (j || []).filter(x => x && x.document).map(x => docOf(x.document));
  }
  async function countQuery(sq) {
    const j = await call(`${FS}:runAggregationQuery`, { method: 'POST', body: JSON.stringify({ structuredAggregationQuery: { structuredQuery: sq, aggregations: [{ alias: 'n', count: {} }] } }) });
    const f = j && j[0] && j[0].result && j[0].result.aggregateFields;
    return f && f.n ? dec(f.n) : 0;
  }
  async function batchGet(paths) {
    if (!paths.length) return [];
    const j = await call(`${FS}:batchGet`, { method: 'POST', body: JSON.stringify({ documents: paths.map(p => `${ROOT}/${p}`) }) });
    return (j || []).filter(x => x && x.found).map(x => docOf(x.found));
  }
  const fld = f => ({ fieldPath: f });
  const ffilter = (f, op, v) => ({ fieldFilter: { field: fld(f), op, value: enc(v) } });
  const andF = fs => fs.length === 1 ? fs[0] : { compositeFilter: { op: 'AND', filters: fs } };

  // ---------------- perfil ----------------
  const AVATARS = ['🚀', '💣', '🦊', '🐼', '🐸', '🐯', '🦁', '🐙', '🤖', '👾', '🐲', '🦄', '🐧', '🐨', '🐵', '🦖', '⚡', '🔥', '⭐', '👑'];
  const COUNTRIES = ['ES', 'MX', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'UY', 'PY', 'BO', 'CR', 'PA', 'DO', 'GT', 'HN', 'SV', 'NI', 'CU', 'PR', 'US', 'CA',
    'BR', 'PT', 'FR', 'DE', 'IT', 'GB', 'IE', 'NL', 'BE', 'CH', 'AT', 'LU', 'PL', 'CZ', 'RO', 'GR', 'SE', 'NO', 'DK', 'FI', 'TR', 'MA', 'DZ', 'TN', 'EG',
    'SN', 'NG', 'ZA', 'AO', 'MZ', 'IN', 'CN', 'JP', 'KR', 'PH', 'ID', 'AU', 'NZ'];
  const flag = cc => cc && /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)) : '🏳️';
  function countryName(cc) {
    try { return new Intl.DisplayNames([window.I18N ? I18N.lang : 'es'], { type: 'region' }).of(cc); } catch (e) { return cc; }
  }
  function guessCountry() {
    for (const l of (navigator.languages || [navigator.language || ''])) { const m = /-([A-Za-z]{2})$/.exec(l || ''); if (m) return m[1].toUpperCase(); }
    return { es: 'ES', en: 'US', pt: 'BR', fr: 'FR', de: 'DE', it: 'IT' }[window.I18N ? I18N.lang : 'es'] || 'ES';
  }
  function prof() {
    const s = X.save;
    if (!s.prof) { s.prof = { name: '', avatar: AVATARS[Math.floor(Math.random() * 16)], country: guessCountry() }; X.persist(); }
    return s.prof;
  }
  const myName = () => prof().name || (T('Jugador') + ' ' + X.codeCore().slice(0, 4));
  const cleanName = t => (t || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  // estadísticas que se ven en el perfil, en los amigos y en las clasificaciones
  function myStats() {
    const s = X.save, st = X.stats(), d = s.daily || {};
    const wins = st.wins || 0;
    return {
      lv: X.plState().lv, level: Math.max(0, Math.min(s.unlocked, X.LEVELS.length + 1) - 1), stars: X.starsTotal(), perfect: X.countLv((L, n) => n >= 3),
      daily: d.n || 0, dailyBest: Math.max(d.best || 0, d.n || 0), winRun: st.winRun || 0, bestRun: Math.max(st.bestRun || 0, st.winRun || 0),
      wins, plays: Math.max(st.plays || 0, wins), bestShot: st.bestShot || 0, bosses: X.countLv((L, n) => L.boss && n > 0), blocks: st.blocks || 0,
    };
  }
  const meDoc = () => ({ _id: auth && auth.uid, me: true, name: myName(), avatar: prof().avatar, country: prof().country, code: X.myCode(), stats: myStats() });

  // el código de amigo (el mismo de siempre) apunta a este jugador
  async function ensureCode() {
    if (X.save.codeUid === auth.uid) return;
    for (let i = 0; i < 3; i++) {
      const c = X.codeCore(), d = await getDoc(`codes/${c}`);
      if (d && d.uid === auth.uid) break;
      if (!d) {
        try { await setDoc(`codes/${c}`, { uid: auth.uid }, { merge: false, mustNotExist: true }); break; } catch (e) { if (e.status !== 409 && e.status !== 400) throw e; }
      }
      X.newPid();                                  // código ya usado por otro jugador (casi imposible): uno nuevo
    }
    X.save.codeUid = auth.uid; X.persist();
  }
  let lastPushed = lsGet(PUSH_KEY) || '';
  async function push(force) {
    await token();
    await ensureCode();
    const p = prof();
    const data = { name: myName(), avatar: p.avatar, code: X.myCode(), lang: window.I18N ? I18N.lang : 'es', country: p.country || '', stats: myStats() };
    const key = auth.uid + JSON.stringify(data);
    if (!force && key === lastPushed) return;
    data.updatedAt = new Date();
    if (X.save.profUid !== auth.uid) data.createdAt = new Date();
    await setDoc(`users/${auth.uid}`, data);
    X.save.profUid = auth.uid; X.persist();
    lastPushed = key; lsSet(PUSH_KEY, key);
  }

  // ---------------- amigos ----------------
  const FR = { list: [], inc: [], out: [], at: 0, loaded: false };
  const other = f => f.a === auth.uid ? f.b : f.a;
  async function loadFriends() {
    const me = auth.uid, q = k => runQuery({ from: [{ collectionId: 'friendships' }], where: ffilter(k, 'EQUAL', me), limit: 300 });
    const [A, B] = await Promise.all([q('a'), q('b')]);
    const all = A.concat(B);
    const users = await batchGet([...new Set(all.map(other))].map(u => `users/${u}`));
    const byId = {}; for (const u of users) byId[u._id] = u;
    const pick = fn => all.filter(fn).map(f => ({ f, u: byId[other(f)] || { _id: other(f), name: '?', stats: {} } }));
    FR.list = pick(f => f.status === 'accepted');
    FR.inc = pick(f => f.status === 'pending' && f.from !== me);
    FR.out = pick(f => f.status === 'pending' && f.from === me);
    FR.at = Date.now(); FR.loaded = true;
    // la misión de amigos cuenta los amigos de verdad (los que han aceptado)
    let changed = false;
    X.save.friends = X.save.friends || [];
    for (const { u } of FR.list) { const c = u.code && X.normCode(u.code); if (c && !X.save.friends.includes(c)) { X.save.friends.push(c); changed = true; } }
    if (changed) { X.persist(); X.renderMissions(); }
    badge();
  }
  async function addByCode(text) {
    const c = X.normCode(text);
    if (!X.validCode(c)) return { err: 'Ese código no es válido. Revisa que esté bien escrito.' };
    if (c === X.codeCore()) return { err: 'Ese es tu propio código.' };
    if (!navigator.onLine) return { err: 'Necesitas conexión a internet para añadir amigos.' };
    try {
      await token();
      const d = await getDoc(`codes/${c}`);
      if (!d) return { err: 'No hay ningún jugador con ese código. Puede que aún no haya abierto el juego con internet.' };
      const me = auth.uid, o = d.uid;
      if (o === me) return { err: 'Ese es tu propio código.' };
      const a = me < o ? me : o, b = me < o ? o : me, pair = a + '_' + b;
      const f = await getDoc(`friendships/${pair}`);
      let res;
      if (f && f.status === 'accepted') res = { err: 'Ya sois amigos.' };
      else if (f && f.from === me) res = { err: 'Ya le enviaste una solicitud. Falta que la acepte.' };
      else if (f) { await accept(pair); res = { ok: '¡Ahora sois amigos!' }; }
      else {
        await push();
        await setDoc(`friendships/${pair}`, { a, b, from: me, status: 'pending', at: new Date() }, { merge: false, mustNotExist: true });
        res = { ok: 'Solicitud enviada. Cuando la acepte, aparecerá en tu lista de amigos.' };
      }
      setNet('online');
      loadFriends().then(render, () => {});
      return res;
    } catch (e) { return { err: errText(e) }; }
  }
  async function accept(pair) { await setDoc(`friendships/${pair}`, { status: 'accepted', since: new Date() }); }
  async function act(kind, pair) {
    try {
      if (kind === 'ok') await accept(pair); else await delDoc(`friendships/${pair}`);
      if (kind === 'ok') { X.Audio.win && X.Audio.win(); X.toast(T('¡Ahora sois amigos!')); }
      await loadFriends();
    } catch (e) { X.toast(T(errText(e)), 3000); }
    render();
  }

  // ---------------- clasificaciones ----------------
  const METRICS = [
    { k: 'level', icon: '🏁', name: 'Nivel' }, { k: 'stars', icon: '⭐', name: 'Estrellas' }, { k: 'daily', icon: '🔥', name: 'Racha' },
    { k: 'wins', icon: '🏆', name: 'Victorias' }, { k: 'bestRun', icon: '🏅', name: 'Seguidas' }, { k: 'bestShot', icon: '💥', name: 'Mejor tiro' },
    { k: 'bosses', icon: '👑', name: 'Jefes' }, { k: 'lv', icon: '🎖', name: 'Jugador' },
  ];
  const BOARD = {};                                 // caché de 90 s por clasificación
  async function loadBoard(m, scope) {
    const key = m + '|' + scope + '|' + prof().country;
    const c = BOARD[key];
    if (c && Date.now() - c.at < 90e3) return c;
    let rows, rank = 0;
    const mine = myStats()[m] || 0;
    if (scope === 'friends') {
      if (!FR.loaded) await loadFriends();
      rows = [meDoc()].concat(FR.list.map(x => x.u)).sort((a, b) => ((b.stats || {})[m] || 0) - ((a.stats || {})[m] || 0));
    } else {
      await push();
      const where = scope === 'local' ? [ffilter('country', 'EQUAL', prof().country)] : [];
      const sq = { from: [{ collectionId: 'users' }], orderBy: [{ field: fld('stats.' + m), direction: 'DESCENDING' }], limit: 50 };
      if (where.length) sq.where = andF(where);
      rows = await runQuery(sq);
      const i = rows.findIndex(r => r._id === auth.uid);
      if (i >= 0) rows[i] = Object.assign(rows[i], meDoc());
      else rank = 1 + await countQuery({ from: [{ collectionId: 'users' }], where: andF(where.concat([ffilter('stats.' + m, 'GREATER_THAN', mine)])) });
    }
    return (BOARD[key] = { at: Date.now(), rows, rank, mine });
  }

  // ---------------- pantalla ----------------
  let tab = 'friends', metric = 'level', scope = 'world', busy = false, msg = null, loadErr = '';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const fmt = n => (+n || 0).toLocaleString(window.I18N ? I18N.lang : 'es');
  const pct = s => s && s.plays ? Math.round(100 * (s.wins || 0) / s.plays) : 0;
  function errText(e) {
    const t = (e && (e.code + ' ' + e.message)) || '';
    if (!e || e.status === 0) return 'Sin conexión a internet.';
    if (/ADMIN_ONLY_OPERATION|OPERATION_NOT_ALLOWED|CONFIGURATION_NOT_FOUND/.test(t)) return 'El servidor aún no está listo: falta activar el inicio de sesión anónimo en Firebase.';
    if (/index/i.test(t)) { console.warn('[RR social] ' + e.message); return 'Falta crear un índice en Firestore para esta clasificación.'; }
    if (e.status === 404 || /database.*(not exist|not found)|NOT_FOUND/i.test(t)) return 'Falta crear la base de datos de Firestore.';
    if (e.status === 403) return 'El servidor ha rechazado la petición: revisa las reglas de Firestore.';
    console.warn('[RR social]', e.status, e.message);
    return 'No se ha podido conectar con el servidor.';
  }
  function renderNet() {
    const el = $('socNet'); if (!el) return;
    const t = net === 'online' ? '<i class="on"></i>Conectado' : net === 'connecting' ? '<i class="wait"></i>Conectando…' : net === 'offline' ? '<i></i>Sin conexión' : net === 'error' ? `<i class="bad"></i>${esc(netErr)}` : '';
    if (el.__h !== t) { el.__h = t; el.innerHTML = t; }
  }
  function badge() {
    const n = FR.inc.length, el = $('socDotT');
    if (el) { el.hidden = !n; el.textContent = n; }
  }
  const avatar = u => `<span class="savat">${esc(u.avatar || '🙂')}</span>`;
  const nameOf = u => `<b class="sname" translate="no">${esc(u.name || '?')}</b>${u.country ? `<span class="sflag">${flag(u.country)}</span>` : ''}`;
  function statChips(s) {
    s = s || {};
    return `<div class="schips">
      <span title="Racha diaria"><i>🔥</i>${fmt(s.daily)}</span>
      <span title="Victorias seguidas"><i>🏅</i>${fmt(s.bestRun)}</span>
      <span title="Mejor tiro"><i>💥</i>${fmt(s.bestShot)}</span>
      <span title="Victorias"><i>🏆</i>${fmt(s.wins)} · ${pct(s)}%</span>
      <span title="Jefes derrotados"><i>👑</i>${fmt(s.bosses)}</span></div>`;
  }
  function friendCard(x, kind) {
    const u = x.u, s = u.stats || {}, pair = x.f._id;
    const btns = kind === 'inc' ? `<button class="btn small green" data-act="ok" data-p="${esc(pair)}">Aceptar</button><button class="sx" data-act="no" data-p="${esc(pair)}" aria-label="Rechazar">✕</button>`
      : kind === 'out' ? `<button class="sx" data-act="no" data-p="${esc(pair)}" aria-label="Cancelar">✕</button>`
        : `<button class="sx" data-act="del" data-p="${esc(pair)}" aria-label="Quitar amigo">✕</button>`;
    return `<div class="scard ${kind}">${avatar(u)}<div class="sbody"><div class="srow">${nameOf(u)}</div>
      <small>${kind === 'inc' ? 'Quiere ser tu amigo' : kind === 'out' ? 'Esperando respuesta' : `Nivel ${fmt(s.level)} · ⭐ ${fmt(s.stars)}`}</small>
      ${kind === 'ok' ? statChips(s) : ''}</div><div class="sbtns">${btns}</div></div>`;
  }
  function friendsHtml() {
    let h = `<div class="sbox"><div class="friendbox" style="margin:0;padding:0;border:0"><div><small>Tu código de amigo</small><b translate="no">${esc(X.myCode())}</b></div><button class="btn small blue" id="socShare">Compartir</button></div>
      <div class="addfriend"><input id="socCode" placeholder="Código de un amigo" maxlength="14" autocomplete="off"><button class="btn small green" id="socAdd">Añadir</button></div>
      ${msg ? `<div class="smsg ${msg.err ? 'bad' : 'good'}">${esc(msg.err || msg.ok)}</div>` : ''}</div>`;
    if (!FR.loaded) return h + `<div class="sempty">${loadErr ? esc(loadErr) : busy ? 'Cargando amigos…' : 'Conéctate a internet para ver a tus amigos.'}</div>`;
    if (FR.inc.length) h += '<div class="shead">Solicitudes</div>' + FR.inc.map(x => friendCard(x, 'inc')).join('');
    h += `<div class="shead">Amigos <span>${FR.list.length}</span></div>`;
    h += FR.list.length ? FR.list.slice().sort((a, b) => ((b.u.stats || {}).level || 0) - ((a.u.stats || {}).level || 0)).map(x => friendCard(x, 'ok')).join('')
      : '<div class="sempty">Aún no tienes amigos. Comparte tu código y jugad juntos.</div>';
    if (FR.out.length) h += '<div class="shead">Enviadas</div>' + FR.out.map(x => friendCard(x, 'out')).join('');
    return h;
  }
  function ranksHtml() {
    const m = METRICS.find(q => q.k === metric);
    let h = `<div class="sscope">${[['world', '🌍', 'Mundial'], ['local', flag(prof().country), 'Mi país'], ['friends', '👥', 'Amigos']].map(([k, i, n]) => `<button data-sc="${k}" class="${k === scope ? 'on' : ''}"><i>${i}</i>${n}</button>`).join('')}</div>
      <div class="smetrics">${METRICS.map(q => `<button data-m="${q.k}" class="${q.k === metric ? 'on' : ''}"><i>${q.icon}</i>${q.name}</button>`).join('')}</div>`;
    const c = BOARD[metric + '|' + scope + '|' + prof().country];
    if (!c) return h + `<div class="sempty">${loadErr ? esc(loadErr) : busy ? 'Cargando clasificación…' : 'Conéctate a internet para ver las clasificaciones.'}</div>`;
    if (!c.rows.length) return h + '<div class="sempty">Todavía no hay nadie en esta clasificación.</div>';
    let r = 0, prev = null;
    h += c.rows.map((u, i) => {
      const v = (u.stats || {})[metric] || 0;
      if (v !== prev) { r = i + 1; prev = v; }
      return `<div class="lbrow ${u._id === (auth && auth.uid) || u.me ? 'me' : ''}"><span class="lbpos">${r <= 3 ? ['🥇', '🥈', '🥉'][r - 1] : r}</span>${avatar(u)}<div class="lbname">${nameOf(u)}</div><b class="lbval"><i>${m.icon}</i>${fmt(v)}</b></div>`;
    }).join('');
    if (c.rank) { const me = meDoc(); h += `<div class="lbsep">···</div><div class="lbrow me"><span class="lbpos">${fmt(c.rank)}</span>${avatar(me)}<div class="lbname">${nameOf(me)}</div><b class="lbval"><i>${m.icon}</i>${fmt(c.mine)}</b></div>`; }
    return h;
  }
  function meHtml() {
    const p = prof(), s = myStats();
    const opts = COUNTRIES.map(cc => [cc, countryName(cc)]).sort((a, b) => a[1].localeCompare(b[1])).map(([cc, n]) => `<option value="${cc}" ${cc === p.country ? 'selected' : ''}>${flag(cc)} ${esc(n)}</option>`).join('');
    const st = (i, v, n) => `<div class="sstat"><i>${i}</i><b>${v}</b><small>${n}</small></div>`;
    return `<div class="sbox sme"><span class="savat big">${esc(p.avatar)}</span>
        <div class="sform"><small>Tu nombre</small><div class="addfriend" style="margin-top:2px"><input id="socName" maxlength="16" autocomplete="off" translate="no" value="${esc(myName())}"><button class="btn small green" id="socSaveName">Guardar</button></div>
        <small>País</small><select id="socCountry" translate="no">${opts}</select></div></div>
      <div class="savs">${AVATARS.map(a => `<button data-av="${a}" class="${a === p.avatar ? 'on' : ''}">${a}</button>`).join('')}</div>
      <div class="shead">Tus estadísticas</div>
      <div class="sstats">${st('🏁', fmt(s.level), 'Niveles superados')}${st('⭐', fmt(s.stars), 'Estrellas')}${st('🎖', fmt(s.lv), 'Nivel de jugador')}
        ${st('🔥', fmt(s.daily), 'Racha diaria')}${st('📅', fmt(s.dailyBest), 'Mejor racha diaria')}${st('🏅', fmt(s.bestRun), 'Victorias seguidas (récord)')}
        ${st('🏆', fmt(s.wins), 'Victorias')}${st('📊', pct(s) + '%', 'Partidas ganadas')}${st('💥', fmt(s.bestShot), 'Mejor tiro (bloques)')}
        ${st('👑', fmt(s.bosses), 'Jefes derrotados')}${st('🌟', fmt(s.perfect), 'Niveles con 3 estrellas')}${st('🧱', fmt(s.blocks), 'Bloques derribados')}</div>
      <div class="note">Tu nombre, tu avatar y estas estadísticas los ven tus amigos y las clasificaciones.</div>`;
  }
  function render() {
    const scr = $('social'); if (!scr || !scr.classList.contains('on')) return;
    $('socTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
    renderNet();
    const list = $('socList'), sc = list.scrollTop, focus = document.activeElement && document.activeElement.id, val = $('socCode') && $('socCode').value;
    list.innerHTML = tab === 'friends' ? friendsHtml() : tab === 'ranks' ? ranksHtml() : meHtml();
    list.scrollTop = sc;
    if ($('socCode') && val) $('socCode').value = val;
    if (focus && $(focus) && focus === 'socCode') $(focus).focus();
    wire();
  }
  function wire() {
    const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', ev => { ev.stopPropagation(); X.Audio.click && X.Audio.click(); fn(el); }); };
    on('socShare', () => X.shareGame());
    on('socAdd', async b => {
      b.disabled = true; msg = { ok: T('Buscando…') }; const v = $('socCode').value; render();
      msg = await addByCode(v); if (msg.ok) { $('socCode') && ($('socCode').value = ''); X.Audio.win && X.Audio.win(); }
      render();
    });
    const list = $('socList');
    list.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      X.Audio.click && X.Audio.click();
      if (b.dataset.act === 'del' && !b.classList.contains('sure')) { b.classList.add('sure'); b.textContent = T('¿Quitar?'); return; }
      b.disabled = true; act(b.dataset.act, b.dataset.p);
    }));
    list.querySelectorAll('[data-sc]').forEach(b => b.addEventListener('click', () => { X.Audio.click && X.Audio.click(); scope = b.dataset.sc; refresh(); }));
    list.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { X.Audio.click && X.Audio.click(); metric = b.dataset.m; refresh(); }));
    list.querySelectorAll('[data-av]').forEach(b => b.addEventListener('click', () => { X.Audio.click && X.Audio.click(); prof().avatar = b.dataset.av; X.persist(); dirty(1500); render(); }));
    on('socSaveName', () => {
      const n = cleanName($('socName').value);
      prof().name = n; X.persist(); dirty(500); render();
      X.toast(T('Nombre guardado'));
    });
    const sel = $('socCountry');
    if (sel) sel.addEventListener('change', () => { prof().country = sel.value; X.persist(); dirty(500); for (const k in BOARD) delete BOARD[k]; render(); });
  }
  // descarga lo que necesita la pestaña abierta
  async function refresh() {
    render();
    if (tab === 'me') return;
    if (!navigator.onLine) { setNet('offline'); return; }
    busy = true; loadErr = ''; if (net !== 'online') setNet('connecting'); render();
    try {
      if (tab === 'friends') await loadFriends();
      else await loadBoard(metric, scope);
      setNet('online');
    } catch (e) { loadErr = T(errText(e)); setNet(e.status === 0 ? 'offline' : 'error', errText(e)); }
    busy = false; render();
  }
  function open(t) {
    tab = t || tab; msg = null;
    X.show('social'); X.setCoins();
    $('socList').scrollTop = 0;
    refresh();
  }

  // ---------------- sincronización en segundo plano ----------------
  let dt = 0;
  function dirty(ms) {
    if (dt && !ms) return;
    clearTimeout(dt);
    dt = setTimeout(() => { dt = 0; sync(); }, ms || 20000);
  }
  let syncing = false;
  async function sync() {
    if (syncing || !navigator.onLine) { if (!navigator.onLine) setNet('offline'); return; }
    syncing = true;
    try {
      if (net !== 'online') setNet('connecting');
      await push();
      if (!FR.loaded || Date.now() - FR.at > 5 * 60e3) await loadFriends();
      setNet('online');
    } catch (e) { setNet(e.status === 0 ? 'offline' : 'error', errText(e)); }
    syncing = false;
    render();
  }

  // botones y pantalla
  const bind = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', () => { X.Audio.init && X.Audio.init(); X.Audio.click && X.Audio.click(); fn(); }); };
  bind('btnSocT', () => open('friends'));
  bind('socBack', () => X.goTitle());
  bind('socSync', () => { for (const k in BOARD) delete BOARD[k]; FR.at = 0; refresh(); });
  $('socTabs').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { X.Audio.click && X.Audio.click(); tab = b.dataset.t; msg = null; $('socList').scrollTop = 0; refresh(); }));
  addEventListener('online', () => dirty(2000));
  addEventListener('offline', () => setNet('offline'));
  setTimeout(() => sync(), 2500);

  window.Social = { open, dirty, sync, addByCode, render, get net() { return net; }, get uid() { return auth && auth.uid; }, _fr: FR, _stats: myStats, get _busy() { return inflight + (busy ? 1 : 0) + (syncing ? 1 : 0); } };
})();
