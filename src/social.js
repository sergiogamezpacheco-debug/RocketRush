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
  // menores de 13 años o funciones en línea apagadas en Ajustes: no se habla con el servidor
  const offline = () => !!(X.save.kid || X.save.noOnline || !X.save.birthYear);   // sin edad (aún no ha contestado): nada
  async function call(url, opt, authed) {
    if (offline()) throw new FbErr(-1, 'OFF', X.save.kid ? 'kid' : 'off');
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
        auth = { uid: j.user_id, id: j.id_token, refresh: j.refresh_token, exp: Date.now() + (+j.expires_in || 3600) * 1000, google: !!(auth && auth.google) };
        saveAuth(); return auth.id;
      } catch (e) {
        // sin conexión o servidor caído: se reintenta más tarde. Pase inválido (cuenta borrada): cuenta nueva
        if (e.status === 0 || e.status >= 500 || !/TOKEN|USER_|INVALID/.test(e.code + ' ' + e.message)) throw e;
      }
    }
    const j = await call(`${IDT}/accounts:signUp?key=${CFG.apiKey}`, { method: 'POST', body: JSON.stringify({ returnSecureToken: true }) }, false);
    auth = { uid: j.localId, id: j.idToken, refresh: j.refreshToken, exp: Date.now() + (+j.expiresIn || 3600) * 1000 };
    saveAuth(); X.save.codeUid = null; X.save.gacc = null; X.persist();
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
  const HW_AVATARS = ['🧛', '🧙', '👻', '🎃', '💀', '🕷️'];       // se compran en la tienda de Halloween
  const XM_AVATARS = ['🎅', '🦌', '⛄', '🎄', '🎁', '💂'];       // se compran en la tienda de Navidad
  const avatars = () => AVATARS.concat(X.save.hwAvatars ? HW_AVATARS : [], X.save.xmAvatars ? XM_AVATARS : []);
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
  const cleanName = t => (t || '').replace(/[\u0000-\u001f<>\/\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  // ---------------- nombre único ----------------
  // names/{nombre en minúsculas} → uid. Al guardar se reserva el nuevo y se libera el anterior en el mismo lote.
  let nameT = 0;
  const nameKey = n => n.toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();
  const BAD = ['puta', 'puto', 'mierda', 'gilipolla', 'cabron', 'maricon', 'polla', 'coño', 'conyo', 'zorra', 'follar', 'nazi', 'hitler', 'fuck', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'nigg', 'fag', 'whore', 'slut', 'rape', 'porn', 'sex', 'caralho', 'porra', 'merda', 'buceta', 'putain', 'merde', 'salope', 'connard', 'encule', 'scheisse', 'scheiße', 'hure', 'fotze', 'wichser', 'cazzo', 'stronzo', 'troia', 'vaffanculo', 'admin', 'moderador', 'rocketrush', 'rocket rush'];
  const badName = n => { const k = nameKey(n).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/[^a-zñß ]/g, ''); return BAD.some(w => k.includes(w) || k.replace(/ /g, '').includes(w.replace(/ /g, ''))); };
  function nameErr(e) {
    const c = e && (e.code || e);
    return ({ SHORT: 'El nombre necesita al menos 3 letras', BAD: 'Ese nombre no está permitido', TAKEN: 'Ese nombre ya lo tiene otro jugador' })[c]
      || (e && e.status === -1 ? 'Para cambiar el nombre hacen falta las funciones en línea.' : e && e.status === 0 ? 'Sin conexión: no se puede comprobar el nombre.' : 'No se ha podido comprobar el nombre.');
  }
  class NameErr extends Error { constructor(c) { super(c); this.code = c; } }
  async function nameFree(n) {
    if (n.length < 3) throw new NameErr('SHORT');
    if (badName(n)) throw new NameErr('BAD');
    const k = nameKey(n);
    if (X.save.nameLc === k && auth) return 'MINE';
    await token();
    const d = await getDoc(`names/${encodeURIComponent(k)}`);
    if (!d) return true;
    if (d.uid === auth.uid) return 'MINE';
    throw new NameErr('TAKEN');
  }
  async function saveName(n) {
    const r = await nameFree(n), k = nameKey(n), old = X.save.nameLc;
    if (r !== 'MINE') {
      const ws = [{ update: { name: `${ROOT}/names/${k}`, fields: enc({ uid: auth.uid }).mapValue.fields }, currentDocument: { exists: false } }];
      if (old && old !== k) ws.push({ delete: `${ROOT}/names/${old}` });
      try { await call(`${FS}:commit`, { method: 'POST', body: JSON.stringify({ writes: ws }) }); }
      catch (e) { if (e.status === 400 || e.status === 409 || /PRECONDITION|ALREADY/.test(e.code + e.message)) throw new NameErr('TAKEN'); throw e; }
    }
    prof().name = n; X.save.nameLc = k; X.persist();
    await push(true);
  }
  // cambiar de nombre cuesta 50 gemas (el primero es gratis; cambiar solo mayúsculas también)
  const NAME_GEMS = 50;
  const nameCost = n => !!(prof().name && nameKey(prof().name) !== nameKey(n));

  // ---------------- bienvenida (la primera vez, después del idioma y la edad): nombre y guardar el progreso ----------------
  function welcome() {
    const w = $('welcome'); if (!w) return;
    if (window.RR_AGE) { X.save.welcomed = true; }      // pruebas automáticas: sin bienvenida
    if (X.save.welcomed || X.save.kid) { w.hidden = true; return; }
    if (prof().name) { X.save.welcomed = true; X.persist(); return; }   // jugadores de antes que ya tenían nombre
    const inp = $('welName'), m = $('welMsg'), acc = $('welAcc'), go = $('welGo');
    inp.placeholder = T('Jugador') + ' ' + X.codeCore().slice(0, 4);
    const showAcc = () => { acc.textContent = linked() ? '✓ ' + T('Progreso guardado con Google') + (X.save.gacc && X.save.gacc.email ? ' · ' + X.save.gacc.email : '') : ''; $('welGoogle').disabled = linked(); };
    let t = 0;
    inp.oninput = () => {
      clearTimeout(t); m.className = 'snmsg'; m.textContent = '';
      const n = cleanName(inp.value); if (!n) return;
      t = setTimeout(async () => {
        const r = await nameFree(n).catch(e => e);
        if (cleanName(inp.value) !== n) return;
        if (r === true || r === 'MINE') { m.className = 'snmsg ok'; m.textContent = T('✓ Disponible'); } else { m.className = 'snmsg bad'; m.textContent = T(nameErr(r)); }
      }, 550);
    };
    const done = () => { X.save.welcomed = true; X.persist(); w.hidden = true; };
    $('welGoogle').onclick = async () => {
      X.Audio.init && X.Audio.init(); X.Audio.click && X.Audio.click();
      acc.textContent = T('Conectando…');
      try {
        const r = await Account.signIn();
        if (r.switched && r.cloud) { w.hidden = true; accountBox({ kind: 'choose', cloud: r.cloud }); return; }
        X.Audio.win && X.Audio.win(); showAcc();
        if (prof().name) done();          // la cuenta ya tenía nombre
      } catch (e) { acc.textContent = e.code === 'CANCEL' ? '' : e.code === 'NO_APP' ? T(NO_APP_TXT()) : e.status === 0 ? T('Sin conexión a internet.') : T('No se ha podido entrar con Google. Prueba otra vez.'); }
    };
    go.onclick = async () => {
      X.Audio.init && X.Audio.init(); X.Audio.click && X.Audio.click();
      const n = cleanName(inp.value); clearTimeout(t);
      if (!n) { m.className = 'snmsg bad'; m.textContent = T('Escribe tu nombre o toca «Ahora no»'); return; }
      go.disabled = true; m.className = 'snmsg'; m.textContent = T('Comprobando…');
      try { await saveName(n); X.toast(T('¡Hola, {x}!').replace('{x}', n), 2500); done(); }
      catch (e) { m.className = 'snmsg bad'; m.textContent = T(nameErr(e)); }
      go.disabled = false;
    };
    $('welLater').onclick = () => { X.Audio.click && X.Audio.click(); done(); };
    showAcc(); w.hidden = false;
  }
  setTimeout(welcome, 0);

  // ¿es probador? (el panel crea testers/{uid}); se mira al sincronizar y se recuerda en el móvil
  async function checkTester() {
    try { const d = await getDoc(`testers/${auth.uid}`); if (X.setTester) X.setTester(!!d); }
    catch (e) { if (e.status === 403 && X.setTester) X.setTester(false); }
  }
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
    // la app de pruebas (y quien tiene todo desbloqueado con el modo prueba) no cuenta en las clasificaciones: estadísticas a cero
    const noRank = (X.testBuild && !window.RR_RANK_TEST) || X.save.testAll, st = myStats();   // RR_RANK_TEST: pruebas automáticas
    if (noRank) for (const k in st) st[k] = 0;
    const data = { name: myName(), avatar: p.avatar, code: X.myCode(), lang: window.I18N ? I18N.lang : 'es', country: p.country || '', stats: st };
    const key = auth.uid + JSON.stringify(data);
    if (!force && key === lastPushed) return;
    data.updatedAt = new Date();
    if (X.save.profUid !== auth.uid) data.createdAt = new Date();
    await setDoc(`users/${auth.uid}`, data);
    X.save.profUid = auth.uid; X.persist();
    lastPushed = key; lsSet(PUSH_KEY, key);
  }

  // ---------------- regalos entre amigos ----------------
  // gifts/{para}_{de}_{día}: un regalo al día por amigo (día UTC). Lo crea quien regala (las reglas comprueban que son
  // amigos); lo lee y lo borra quien lo recibe al recogerlo (+50 monedas cada uno, como mucho 20 al día).
  const GIFT_COINS = 50, GIFT_MAX = 20;
  const giftDay = () => Math.floor(Date.now() / 864e5);
  const GF = { inbox: [], at: 0 };
  function giftSent() { const g = X.save.giftSent; if (!g || g.day !== giftDay()) X.save.giftSent = { day: giftDay(), to: [], got: 0 }; return X.save.giftSent; }
  async function loadGifts() {
    if (!auth || !auth.uid) return;
    GF.inbox = (await runQuery({ from: [{ collectionId: 'gifts' }], where: ffilter('to', 'EQUAL', auth.uid), limit: 60 })).filter(g => !isBlocked(g.from));
    GF.at = Date.now(); if (X.updateTitle) X.updateTitle();
  }
  async function sendGift(uid) {
    const sg = giftSent(); if (sg.to.includes(uid)) return false;
    const day = giftDay();
    try { await setDoc(`gifts/${uid}_${auth.uid}_${day}`, { to: uid, from: auth.uid, name: myName(), avatar: prof().avatar || '', day, at: new Date() }, { merge: false, mustNotExist: true }); }
    catch (e) { if (!(e.status === 409 || /ALREADY_EXISTS|FAILED_PRECONDITION/.test(e.code))) throw e; }
    sg.to.push(uid); const st = X.stats(); st.giftsSent = (st.giftsSent || 0) + 1; X.persist();
    return true;
  }
  async function claimGifts() {
    const sg = giftSent(), room = Math.max(0, GIFT_MAX - (sg.got || 0)), list = GF.inbox.slice(0, room);
    let n = 0;
    for (const g of list) { try { await delDoc(`gifts/${g._id}`); n++; } catch (e) { if (e.status === 404) n++; } }
    GF.inbox = GF.inbox.filter(g => !list.includes(g));
    if (n) { sg.got = (sg.got || 0) + n; X.grant({ coins: n * GIFT_COINS }); X.persist(); X.setCoins(); if (X.updateTitle) X.updateTitle(); }
    return n;
  }
  // amigo que lleva 3 días o más sin jugar: «avisar» comparte un mensaje (WhatsApp, etc.)
  const idleDays = u => u && u.updatedAt ? Math.floor((Date.now() - u.updatedAt) / 864e5) : 0;
  function nudge(u) {
    const t = T('¡Hola {x}! Te echo de menos en Rocket Rush. Vuelve y te mando un regalo 🎁').replace('{x}', u.name || '') + ' https://play.google.com/store/apps/details?id=com.lostanarchygames.rocketrush';
    try { if (window.ChromaAndroid && window.ChromaAndroid.share) { window.ChromaAndroid.share(t); return; } } catch (e) { /* nada */ }
    if (navigator.share) navigator.share({ text: t }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => X.toast(T('Mensaje copiado')));
  }

  // ---------------- desafío de la semana ----------------
  // weekly/{semana}/scores/{uid}: la mejor puntuación de cada jugador esa semana (las reglas solo dejan subirla)
  const WK = {};
  const wkQuery = (wk, kind, body) => call(`${FS}/weekly/${encodeURIComponent(wk)}:${kind}`, { method: 'POST', body: JSON.stringify(body) });
  async function wkSubmit(wk, score) {
    await token();
    await setDoc(`weekly/${encodeURIComponent(wk)}/scores/${auth.uid}`, { name: myName(), avatar: prof().avatar || '', country: prof().country || '', score: Math.max(0, Math.min(5000000, Math.round(score))), at: new Date() }, { merge: false });
    delete WK[wk];
  }
  async function wkBoard(wk, mine) {
    const c = WK[wk]; if (c && Date.now() - c.at < 60e3) return c;
    await token();
    const j = await wkQuery(wk, 'runQuery', { structuredQuery: { from: [{ collectionId: 'scores' }], orderBy: [{ field: fld('score'), direction: 'DESCENDING' }], limit: 20 } });
    const rows = (j || []).filter(x => x && x.document).map(x => docOf(x.document)).filter(r => !isBlocked(r._id)).map(mask);
    let rank = 0;
    const i = rows.findIndex(r => r._id === auth.uid);
    if (i >= 0) rank = i + 1;
    else if (mine > 0) {
      const a = await wkQuery(wk, 'runAggregationQuery', { structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: 'scores' }], where: ffilter('score', 'GREATER_THAN', mine) }, aggregations: [{ alias: 'n', count: {} }] } });
      const f = a && a[0] && a[0].result && a[0].result.aggregateFields; rank = 1 + (f && f.n ? dec(f.n) : 0);
    }
    return (WK[wk] = { at: Date.now(), rows, rank });
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
    loadGifts().catch(() => { /* sin regalos */ });
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
      if (isBlocked(o)) return { err: 'Has bloqueado a este jugador. Desbloquéalo en Ajustes › Privacidad y ayuda.' };
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
  let tab = 'friends', metric = 'level', scope = 'world', busy = false, msg = null, loadErr = '', sureP = null;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const fmt = n => (+n || 0).toLocaleString(window.I18N ? I18N.lang : 'es');
  const pct = s => s && s.plays ? Math.round(100 * (s.wins || 0) / s.plays) : 0;
  function errText(e) {
    const t = (e && (e.code + ' ' + e.message)) || '';
    if (e && e.status === -1) return X.save.kid ? 'Amigos y clasificaciones no están disponibles para tu edad.' : 'Las funciones en línea están desactivadas en Ajustes › Privacidad.';
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
        : (giftSent().to.includes(u._id) ? '<span class="sgift done">✓ 🎁</span>' : `<button class="sgift" data-gift="${esc(u._id)}" aria-label="Enviar regalo">🎁</button>`) +
          (idleDays(u) >= 3 ? `<button class="sgift nudge" data-nudge="${esc(u._id)}" aria-label="Avisar">👋</button>` : '') +
          `<button class="sx${sureP === pair ? ' sure' : ''}" data-act="del" data-p="${esc(pair)}" aria-label="Quitar amigo">${sureP === pair ? '¿Quitar?' : '✕'}</button>`;
    return `<div class="scard ${kind}" data-u="${esc(u._id)}">${avatar(u)}<div class="sbody"><div class="srow">${nameOf(u)}</div>
      <small>${kind === 'inc' ? 'Quiere ser tu amigo' : kind === 'out' ? 'Esperando respuesta' : `Nivel ${fmt(s.level)} · ⭐ ${fmt(s.stars)}` + (idleDays(u) >= 3 ? ' · ' + T('sin jugar desde hace {x} días').replace('{x}', idleDays(u)) : '')}</small>
      ${kind === 'ok' ? statChips(s) : ''}</div><div class="sbtns">${btns}</div></div>`;
  }
  function friendsHtml() {
    let h = `<div class="sbox"><div class="friendbox" style="margin:0;padding:0;border:0"><div><small>Tu código de amigo</small><b translate="no">${esc(X.myCode())}</b></div><button class="btn small blue" id="socShare">Compartir</button></div>
      <div class="addfriend"><input id="socCode" placeholder="Código de un amigo" maxlength="14" autocomplete="off"><button class="btn small green" id="socAdd">Añadir</button></div>
      ${msg ? `<div class="smsg ${msg.err ? 'bad' : 'good'}">${esc(msg.err || msg.ok)}</div>` : ''}</div>`;
    if (!FR.loaded) return h + `<div class="sempty">${loadErr ? esc(loadErr) : busy ? 'Cargando amigos…' : 'Conéctate a internet para ver a tus amigos.'}</div>`;
    const inc = FR.inc.filter(x => !isBlocked(x.u._id));
    if (inc.length) h += '<div class="shead">Solicitudes</div>' + inc.map(x => friendCard(x, 'inc')).join('');
    if (GF.inbox.length) {
      const room = Math.max(0, GIFT_MAX - (giftSent().got || 0)), n = Math.min(room, GF.inbox.length);
      h += `<div class="giftbox"><span class="gi">🎁</span><div><b>${GF.inbox.length === 1 ? T('1 regalo para ti') : T('{x} regalos para ti').replace('{x}', GF.inbox.length)}</b><small>${esc(GF.inbox.slice(0, 3).map(g => g.name).join(', '))}${GF.inbox.length > 3 ? '…' : ''} · ${GIFT_COINS} ${T('monedas cada uno')}</small></div>` +
        (n ? `<button class="btn small gold" id="socClaim">${T('RECOGER')}<br>+${n * GIFT_COINS} <i class="coin"></i></button>` : `<small>${T('Máximo de hoy recogido')}</small>`) + '</div>';
    }
    h += `<div class="shead">Amigos <span>${FR.list.length}</span></div>`;
    const canGift = FR.list.filter(x => !giftSent().to.includes(x.u._id) && !isBlocked(x.u._id));
    if (canGift.length > 1) h += `<button class="btn small green giftall" id="socGiftAll">🎁 ${T('ENVIAR A TODOS')} (${canGift.length})</button>`;
    if (FR.list.length) h += `<div class="snote">${T('Envía 1 regalo al día a cada amigo: no te cuesta nada y le das {x} monedas').replace('{x}', GIFT_COINS)}</div>`;
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
      const me = u._id === (auth && auth.uid) || u.me, mu = mask(u);
      return `<div class="lbrow ${me ? 'me' : ''}" ${me ? '' : `data-u="${esc(u._id)}"`}><span class="lbpos">${r <= 3 ? ['🥇', '🥈', '🥉'][r - 1] : r}</span>${avatar(mu)}<div class="lbname">${nameOf(mu)}</div><b class="lbval"><i>${m.icon}</i>${fmt(v)}</b></div>`;
    }).join('');
    if (c.rank) { const me = meDoc(); h += `<div class="lbsep">···</div><div class="lbrow me"><span class="lbpos">${fmt(c.rank)}</span>${avatar(me)}<div class="lbname">${nameOf(me)}</div><b class="lbval"><i>${m.icon}</i>${fmt(c.mine)}</b></div>`; }
    return h;
  }
  function meHtml() {
    const p = prof(), s = myStats();
    const opts = COUNTRIES.map(cc => [cc, countryName(cc)]).sort((a, b) => a[1].localeCompare(b[1])).map(([cc, n]) => `<option value="${cc}" ${cc === p.country ? 'selected' : ''}>${flag(cc)} ${esc(n)}</option>`).join('');
    const st = (i, v, n) => `<div class="sstat"><i>${i}</i><b>${v}</b><small>${n}</small></div>`;
    return `<div class="sbox sme"><span class="savat big">${esc(p.avatar)}</span>
        <div class="sform"><small>Tu nombre</small><div class="addfriend" style="margin-top:2px"><input id="socName" maxlength="16" autocomplete="off" translate="no" value="${esc(myName())}"><button class="btn small green" id="socSaveName">${prof().name ? `${T('Cambiar')} <i class="gem"></i>${NAME_GEMS}` : T('Guardar')}</button></div><div class="snmsg" id="socNameMsg"></div>
        <small>País</small><select id="socCountry" translate="no">${opts}</select></div></div>
      <div class="savs">${avatars().map(a => `<button data-av="${a}" class="${a === p.avatar ? 'on' : ''}">${a}</button>`).join('')}</div>
      <div id="colMount"></div>
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
    if (tab === 'me' && X.mountCol) X.mountCol($('colMount'));   // mi colección (game3d.js)
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
      // quitar amigo: el primer toque pide confirmación (se recuerda aunque la lista se vuelva a pintar)
      if (b.dataset.act === 'del' && sureP !== b.dataset.p) { sureP = b.dataset.p; render(); return; }
      sureP = null;
      b.disabled = true; act(b.dataset.act, b.dataset.p);
    }));
    // tocar a otro jugador: ficha con denunciar y bloquear
    list.querySelectorAll('[data-u]').forEach(r => r.addEventListener('click', ev => {
      if (ev.target.closest('button')) return;
      const id = r.dataset.u; let u = null;
      for (const c of Object.values(BOARD)) { u = (c.rows || []).find(x => x._id === id); if (u) break; }
      if (!u) { const x = FR.list.concat(FR.inc, FR.out).find(x => other(x.f) === id); u = x && x.u; }
      if (!u) return;
      X.Audio.click && X.Audio.click(); sheet({ kind: 'player', id, name: u.name, avatar: u.avatar });
    }));
    list.querySelectorAll('[data-gift]').forEach(b => b.addEventListener('click', async ev => {
      ev.stopPropagation(); X.Audio.click && X.Audio.click(); b.disabled = true;
      try { await sendGift(b.dataset.gift); X.Audio.coin && X.Audio.coin(); X.toast(T('¡Regalo enviado!')); } catch (e) { X.toast(errText(e)); }
      render();
    }));
    list.querySelectorAll('[data-nudge]').forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); X.Audio.click && X.Audio.click(); const x = FR.list.find(q => q.u._id === b.dataset.nudge); if (x) nudge(x.u); }));
    on('socGiftAll', async b => {
      b.disabled = true; let n = 0;
      for (const x of FR.list) if (!giftSent().to.includes(x.u._id) && !isBlocked(x.u._id)) { try { if (await sendGift(x.u._id)) n++; } catch (e) { /* sigue con los demás */ } }
      if (n) { X.Audio.coin && X.Audio.coin(); X.toast(T('{x} regalos enviados').replace('{x}', n)); }
      render();
    });
    on('socClaim', async b => {
      b.disabled = true;
      try { const n = await claimGifts(); if (n) { X.Audio.win && X.Audio.win(); X.toast(T('+{x} monedas de tus amigos').replace('{x}', n * GIFT_COINS), 2400); } } catch (e) { X.toast(errText(e)); }
      render();
    });
    list.querySelectorAll('[data-sc]').forEach(b => b.addEventListener('click', () => { X.Audio.click && X.Audio.click(); scope = b.dataset.sc; refresh(); }));
    list.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { X.Audio.click && X.Audio.click(); metric = b.dataset.m; refresh(); }));
    list.querySelectorAll('[data-av]').forEach(b => b.addEventListener('click', () => { X.Audio.click && X.Audio.click(); prof().avatar = b.dataset.av; X.persist(); dirty(1500); render(); }));
    on('socSaveName', async () => {
      const n = cleanName($('socName').value), b = $('socSaveName'), m = $('socNameMsg');
      clearTimeout(nameT);
      const paid = nameCost(n);
      if (paid && (X.save.gems || 0) < NAME_GEMS) { m.className = 'snmsg bad'; m.textContent = T('Te faltan {x} gemas').replace('{x}', NAME_GEMS - (X.save.gems || 0)); return; }
      b.disabled = true; m.className = 'snmsg'; m.textContent = T('Comprobando…');
      try {
        await saveName(n);
        if (paid) { X.save.gems -= NAME_GEMS; X.persist(); X.setCoins(); }
        m.className = 'snmsg ok'; m.textContent = T('Nombre guardado'); X.toast(T('Nombre guardado')); render();
      } catch (e) { b.disabled = false; m.className = 'snmsg bad'; m.textContent = T(nameErr(e)); }
    });
    // mientras escribe, se mira si el nombre está libre (medio segundo después de dejar de teclear)
    const ni = $('socName');
    if (ni) ni.addEventListener('input', () => {
      clearTimeout(nameT); const m = $('socNameMsg'); m.className = 'snmsg'; m.textContent = '';
      const n = cleanName(ni.value);
      nameT = setTimeout(async () => {
        const r = await nameFree(n).catch(e => e);
        if (cleanName(ni.value) !== n) return;
        if (r === true) { m.className = 'snmsg ok'; m.textContent = T('✓ Disponible'); }
        else if (r === 'MINE') { m.className = 'snmsg ok'; m.textContent = T('Es tu nombre'); }
        else { m.className = 'snmsg bad'; m.textContent = T(nameErr(r)); }
      }, 550);
    });
    const sel = $('socCountry');
    if (sel) sel.addEventListener('change', () => { prof().country = sel.value; X.persist(); dirty(500); for (const k in BOARD) delete BOARD[k]; render(); });
  }
  // descarga lo que necesita la pestaña abierta
  async function refresh() {
    render();
    if (tab === 'me') return;
    if (offline()) { loadErr = T(errText({ status: -1 })); setNet('error', loadErr); render(); return; }
    if (!navigator.onLine) { setNet('offline'); return; }
    if (maint()) { loadErr = T('En mantenimiento: vuelve en un rato'); setNet('error', loadErr); render(); return; }
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
    if (typeof cloudSoon === 'function') cloudSoon();
    if (dt && !ms) return;
    clearTimeout(dt);
    dt = setTimeout(() => { dt = 0; sync(); }, ms || 20000);
  }
  let syncing = false;
  // mantenimiento activado desde el panel: no se sube ni se descarga nada
  const maint = () => !!(window.Live && window.Live.cfg.maint && window.Live.cfg.maint.on);
  async function sync() {
    if (offline()) return;
    if (syncing || !navigator.onLine) { if (!navigator.onLine) setNet('offline'); return; }
    if (maint()) return;
    syncing = true;
    try {
      if (net !== 'online') setNet('connecting');
      // nombres de antes de que fueran únicos: se reservan solos; si ya lo tenía otro, vuelve a «Jugador XXXX»
      if (prof().name && !X.save.nameLc) {
        try { await saveName(prof().name); } catch (e) { if (e.code === 'TAKEN' || e.code === 'BAD' || e.code === 'SHORT') { prof().name = ''; X.save.nameLc = null; X.persist(); X.toast(T('Tu nombre ya lo usa otro jugador: elige uno nuevo en tu perfil'), 3500); } }
      }
      await push();
      if (!checkTester.at || Date.now() - checkTester.at > 30 * 60e3) { checkTester.at = Date.now(); await checkTester(); }
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

  // ---------------- códigos regalo (giftcodes/{CÓDIGO}, creados en el panel) ----------------
  // Se lee el código y se suma 1 a «used» con la condición de que nadie lo haya cambiado entretanto (si no, se reintenta).
  // Las reglas no dejan pasar de «max» ni canjear fuera de fecha.
  class CodeErr extends Error { constructor(c) { super(c); this.code = c; } }
  async function redeem(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) throw new CodeErr('NOT_FOUND');
    for (let i = 0; i < 4; i++) {
      let raw;
      try { raw = await call(`${FS}/giftcodes/${code}`); } catch (e) { if (e.status === 404 || e.status === 403) throw new CodeErr('NOT_FOUND'); throw e; }
      const d = docOf(raw), t = Date.now();
      if (d.start && t < d.start) throw new CodeErr('NOT_YET');
      if (d.end && t >= d.end) throw new CodeErr('EXPIRED');
      if (d.max && (d.used || 0) >= d.max) throw new CodeErr('USED_UP');
      try {
        await call(`${FS}/giftcodes/${code}?updateMask.fieldPaths=used&currentDocument.updateTime=${encodeURIComponent(raw.updateTime)}`,
          { method: 'PATCH', body: JSON.stringify({ fields: { used: enc((d.used || 0) + 1) } }) });
        return d;
      } catch (e) {
        if (e.status === 400 || e.status === 409 || /PRECONDITION|ABORTED/.test(e.code)) continue;   // otro lo canjeó a la vez: se vuelve a leer
        if (e.status === 403) throw new CodeErr('USED_UP');
        throw e;
      }
    }
    throw new CodeErr('USED_UP');
  }

  // ---------------- borrar la cuenta en línea ----------------
  // Se borran el perfil público (users), el código de amigo (codes), las amistades y solicitudes (friendships)
  // y la cuenta de Firebase. El progreso del juego está solo en el móvil y no se toca (se borra aparte).
  // Después las funciones en línea quedan apagadas, para que no se cree una cuenta nueva sin querer.
  async function deleteAccount() {
    if (auth && auth.refresh) {
      const was = [X.save.kid, X.save.noOnline, X.save.birthYear];
      X.save.kid = false; X.save.noOnline = false; X.save.birthYear = X.save.birthYear || 1;
      try { await wipeServer(); } finally { X.save.kid = was[0]; X.save.noOnline = was[1]; X.save.birthYear = was[2]; }
    }
    auth = null; saveAuth(); lastPushed = ''; lsSet(PUSH_KEY, '');
    FR.list = []; FR.inc = []; FR.out = []; FR.loaded = false; FR.at = 0;
    for (const k in BOARD) delete BOARD[k];
    X.save.codeUid = null; X.save.profUid = null; X.save.friends = []; X.save.nameLc = null; X.save.tester = false; X.save.gacc = null; X.save.noOnline = true;
    try { if (window.ChromaAndroid && window.ChromaAndroid.googleSignOut) window.ChromaAndroid.googleSignOut(); } catch (e) { /* nada */ }
    lsSet(CLOUD_KEY, '{}'); X.newPid(); X.persist();
    setNet('offline');
  }
  async function wipeServer() {
    {
      await token();
      if (myClubId()) { try { await clubLeave(); } catch (e) { if (e.code !== 'GONE' && e.code !== 'KICKED') throw e; } }
      const me = auth.uid, q = k => runQuery({ from: [{ collectionId: 'friendships' }], where: ffilter(k, 'EQUAL', me), limit: 300 });
      const [A, B] = await Promise.all([q('a'), q('b')]);
      for (const f of new Map(A.concat(B).map(x => [x._id, x])).values()) { try { await delDoc(`friendships/${f._id}`); } catch (e) { if (e.status !== 404) throw e; } }
      const c = X.codeCore(), d = await getDoc(`codes/${c}`);
      if (d && d.uid === me) await delDoc(`codes/${c}`);
      if (X.save.nameLc) { try { await delDoc(`names/${encodeURIComponent(X.save.nameLc)}`); } catch (e) { if (e.status !== 404 && e.status !== 403) throw e; } }
      try { await delDoc(`saves/${me}`); } catch (e) { if (e.status !== 404 && e.status !== 403) throw e; }
      for (const g of GF.inbox) { try { await delDoc(`gifts/${g._id}`); } catch (e) { /* nada */ } }
      if (X.save.wk && X.save.wk.id && X.save.wk.sent) { try { await delDoc(`weekly/${encodeURIComponent(X.save.wk.id)}/scores/${me}`); } catch (e) { /* nada */ } }
      try { await delDoc(`users/${me}`); } catch (e) { if (e.status !== 404) throw e; }
      await call(`${IDT}/accounts:delete?key=${CFG.apiKey}`, { method: 'POST', body: JSON.stringify({ idToken: auth.id }) }, false);
    }
  }

  // ---------------- clubes ----------------
  // Reloj del club: hora de España en invierno (UTC+1) para todos, así la semana cambia a la vez en todo el mundo.
  // Semana = lunes a domingo. Expedición: 10 niveles nuevos cada día de lunes a viernes (se pueden jugar hasta el domingo).
  // Jefe colosal: toda la semana, 3 ataques al día. Liga: de viernes a lunes (su id es la semana del viernes).
  const CLOCK = 3600e3;
  function clubTime(t) {
    const d = new Date((t || Date.now()) + CLOCK);
    const day = (d.getUTCDay() + 6) % 7;                                   // 0 = lunes
    const mon = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
    const th = new Date(mon + 3 * 864e5), y = th.getUTCFullYear();
    const wn = 1 + Math.floor((th - Date.UTC(y, 0, 1)) / 864e5 / 7);
    const wk = y + '-W' + String(wn).padStart(2, '0');
    const prev = day === 0 ? clubTime((t || Date.now()) - 864e5).wk : null;
    return { day, wk, dayId: wk + '-' + day, weekEnd: mon + 7 * 864e5 - CLOCK, dayEnd: mon + (day + 1) * 864e5 - CLOCK,
      lg: day >= 4 ? wk : prev, lgEnd: day >= 4 ? mon + 8 * 864e5 - CLOCK : day === 0 ? mon + 864e5 - CLOCK : 0, lgStart: mon + 4 * 864e5 - CLOCK };
  }
  class ClubErr extends Error { constructor(c) { super(c); this.code = c; } }
  const docName = p => `${ROOT}/${p}`;
  const wUpdate = (p, data, mask, pre) => {
    const w = { update: { name: docName(p), fields: enc(data).mapValue.fields } };
    if (mask) w.updateMask = { fieldPaths: mask === true ? Object.keys(data) : mask };
    if (pre) w.currentDocument = pre;
    return w;
  };
  const wDelete = (p, pre) => Object.assign({ delete: docName(p) }, pre ? { currentDocument: pre } : {});
  async function commit(writes) { return call(`${FS}:commit`, { method: 'POST', body: JSON.stringify({ writes }) }); }
  const CL = { cid: null, club: null, members: [], reqs: [], at: 0, loaded: false };
  const myClubId = () => (X.save.club && X.save.club.cid) || null;
  const memberBase = () => ({ name: myName(), avatar: prof().avatar || '🚀', wk: '', ex: 0, exN: 0, dmg: 0, atk: '', atkN: 0, lg: '', lgS: 0 });
  // una ficha de miembro con los datos de esta semana (los de semanas pasadas cuentan como 0)
  function fresh(m) {
    const ct = clubTime(), o = Object.assign({}, m);
    if (o.wk !== ct.wk) { o.ex = 0; o.exN = 0; o.dmg = 0; }
    if (o.atk !== ct.dayId) o.atkN = 0;
    if (o.lg !== ct.lg) o.lgS = 0;
    return o;
  }
  async function clubLoad(force) {
    const cid = myClubId();
    if (!cid) { Object.assign(CL, { cid: null, club: null, members: [], reqs: [], loaded: true, at: Date.now() }); return CL; }
    if (!force && CL.cid === cid && Date.now() - CL.at < 60e3) return CL;
    await token();
    const club = await getDoc(`clubs/${cid}`);
    const me = club && await getDoc(`clubs/${cid}/members/${auth.uid}`);
    if (!club || !me) {                                                  // el club ya no existe o te han expulsado
      const was = club ? club.name : null;
      X.save.club = null; X.persist(); Object.assign(CL, { cid: null, club: null, members: [], reqs: [], loaded: true, at: Date.now() });
      throw new ClubErr(was ? 'KICKED' : 'GONE');
    }
    const j = await call(`${FS}/clubs/${cid}/members?pageSize=40`);
    const members = (j.documents || []).map(docOf).map(fresh);
    let reqs = [];
    if (me.role !== 'member') { try { const r = await call(`${FS}/clubs/${cid}/requests?pageSize=50`); reqs = (r.documents || []).map(docOf); } catch (e) { reqs = []; } }
    Object.assign(CL, { cid, club, members, reqs, me: fresh(me), loaded: true, at: Date.now() });
    X.save.club = { cid, name: club.name, role: me.role }; X.persist();
    return CL;
  }
  const clubPayload = o => ({ desc: (o.desc || '').slice(0, 80), open: !!o.open && !o.closed, closed: !!o.closed, max: Math.max(10, Math.min(50, (o.max | 0) || 30)), minLv: Math.max(0, Math.min(5000, o.minLv | 0)), lang: (o.lang || (window.I18N ? I18N.lang : 'es')).slice(0, 5), country: (o.country || prof().country || '').slice(0, 3), badge: { ico: o.badge && o.badge.ico || '🚀', c: Math.max(0, Math.min(11, (o.badge && o.badge.c) | 0)) } });
  const cleanClubName = t => (t || '').replace(/[\u0000-\u001f<>\/]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
  async function clubCreate(o) {
    const name = cleanClubName(o.name);
    if (name.length < 3) throw new ClubErr('NAME_SHORT');
    if (badName(name)) throw new ClubErr('NAME_BAD');
    if (o.desc && badName(o.desc)) throw new ClubErr('DESC_BAD');
    if (myClubId()) throw new ClubErr('IN_CLUB');
    await token();
    const me = auth.uid, cid = Array.from({ length: 12 }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]).join(''), lc = name.toLowerCase();
    if (lc.includes('/') || lc === '.' || lc === '..') throw new ClubErr('NAME_BAD');
    const club = Object.assign({ name, nameLc: lc, leader: me, count: 1, last: me, lg: { id: '', s: 0 }, createdAt: new Date() }, clubPayload(o));
    try {
      await commit([
        wUpdate(`clubs/${cid}`, club, null, { exists: false }),
        wUpdate(`clubs/${cid}/members/${me}`, Object.assign(memberBase(), { role: 'leader', joinedAt: new Date() }), null, { exists: false }),
        wUpdate(`clubnames/${lc}`, { cid }, null, { exists: false }),
      ]);
    } catch (e) { if (e.status === 409 || e.status === 400 || /ALREADY_EXISTS|FAILED_PRECONDITION/.test(e.code + e.message)) throw new ClubErr('NAME_TAKEN'); throw e; }
    X.save.club = { cid, name, role: 'leader' }; X.persist(); CL.at = 0;
    return clubLoad(true);
  }
  async function clubSearch(text) {
    const q = (text || '').trim().toLowerCase();
    const sq = q
      ? { from: [{ collectionId: 'clubs' }], where: andF([ffilter('nameLc', 'GREATER_THAN_OR_EQUAL', q), ffilter('nameLc', 'LESS_THAN', q + '\uf8ff')]), orderBy: [{ field: fld('nameLc') }], limit: 30 }
      : { from: [{ collectionId: 'clubs' }], where: andF([ffilter('open', 'EQUAL', true), ffilter('count', 'LESS_THAN', 50)]), orderBy: [{ field: fld('count'), direction: 'DESCENDING' }], limit: 40 };
    const r = await runQuery(sq);
    return q ? r : r.filter(c => !c.closed && c.count < (c.max || 30)).slice(0, 30);   // sin texto: solo los que tienen sitio
  }
  async function clubJoin(cid) {
    if (myClubId()) throw new ClubErr('IN_CLUB');
    await token();
    const me = auth.uid;
    for (let i = 0; i < 4; i++) {
      const raw = await call(`${FS}/clubs/${cid}`).catch(e => { if (e.status === 404) throw new ClubErr('GONE'); throw e; });
      const c = docOf(raw);
      if (c.closed) throw new ClubErr('CLOSED');
      if (c.count >= (c.max || 30)) throw new ClubErr('FULL');
      if ((c.minLv || 0) > (X.plState().lv || 1)) throw new ClubErr('MIN_LV');
      if (!c.open) {
        const st = X.starsTotal ? X.starsTotal() : 0;
        await setDoc(`clubs/${cid}/requests/${me}`, { name: myName(), avatar: prof().avatar || '🚀', lv: Math.max(0, st | 0), at: new Date() }, { merge: false });
        X.save.clubReq = { cid, name: c.name, at: Date.now() }; X.persist();
        return 'REQUESTED';
      }
      try {
        await commit([
          wUpdate(`clubs/${cid}/members/${me}`, Object.assign(memberBase(), { role: 'member', joinedAt: new Date() }), null, { exists: false }),
          wUpdate(`clubs/${cid}`, { count: c.count + 1, last: me }, true, { updateTime: raw.updateTime }),
        ]);
        X.save.club = { cid, name: c.name, role: 'member' }; X.save.clubReq = null; X.persist(); CL.at = 0;
        return clubLoad(true);
      } catch (e) { if (e.status === 400 || e.status === 409 || /PRECONDITION|ABORTED/.test(e.code + e.message)) continue; throw e; }
    }
    throw new ClubErr('BUSY');
  }
  // quitar a alguien (uno mismo al salir, o expulsar): ficha fuera y contador -1 en el mismo lote
  async function removeMember(uid) {
    const cid = myClubId();
    for (let i = 0; i < 4; i++) {
      const raw = await call(`${FS}/clubs/${cid}`);
      const c = docOf(raw);
      try {
        await commit([wDelete(`clubs/${cid}/members/${uid}`, { exists: true }), wUpdate(`clubs/${cid}`, { count: c.count - 1, last: uid }, true, { updateTime: raw.updateTime })]);
        return;
      } catch (e) { if (e.status === 400 || e.status === 409 || /PRECONDITION|ABORTED/.test(e.code + e.message)) continue; throw e; }
    }
    throw new ClubErr('BUSY');
  }
  async function clubTransfer(uid) {
    const cid = myClubId(); await token();
    await commit([
      wUpdate(`clubs/${cid}/members/${uid}`, { role: 'leader' }, true),
      wUpdate(`clubs/${cid}/members/${auth.uid}`, { role: 'officer' }, true),
      wUpdate(`clubs/${cid}`, { leader: uid }, true),
    ]);
    CL.at = 0; return clubLoad(true);
  }
  async function clubLeave() {
    const cid = myClubId(); if (!cid) return;
    await clubLoad(true);
    const me = auth.uid, role = CL.me.role;
    if (role === 'leader') {
      const others = CL.members.filter(m => m._id !== me);
      if (others.length) {
        // el liderazgo pasa al oficial (o miembro) que más ha aportado esta semana
        const rk = r => ({ officer: 2, elder: 1 })[r] || 0;   // primero un colíder, luego un veterano
        const next = others.slice().sort((a, b) => (rk(b.role) - rk(a.role)) || (b.ex + b.dmg / 1000) - (a.ex + a.dmg / 1000))[0];
        await clubTransfer(next._id);
        await removeMember(me);
      } else {
        const ws = CL.reqs.map(r => wDelete(`clubs/${cid}/requests/${r._id}`));
        ws.push(wDelete(`clubs/${cid}/members/${me}`), wDelete(`clubs/${cid}`), wDelete(`clubnames/${CL.club.nameLc}`));
        await commit(ws);
      }
    } else await removeMember(me);
    X.save.club = null; X.persist(); Object.assign(CL, { cid: null, club: null, members: [], reqs: [], at: 0 });
  }
  async function clubKick(uid) { await removeMember(uid); CL.at = 0; return clubLoad(true); }
  async function clubRole(uid, role) { await setDoc(`clubs/${myClubId()}/members/${uid}`, { role }); CL.at = 0; return clubLoad(true); }
  async function clubAccept(uid) {
    const cid = myClubId(), r = CL.reqs.find(x => x._id === uid); if (!r) throw new ClubErr('GONE');
    for (let i = 0; i < 4; i++) {
      const raw = await call(`${FS}/clubs/${cid}`), c = docOf(raw);
      if (c.count >= (c.max || 30)) throw new ClubErr('FULL');
      try {
        await commit([
          wUpdate(`clubs/${cid}/members/${uid}`, { name: r.name, avatar: r.avatar, role: 'member', joinedAt: new Date(), wk: '', ex: 0, exN: 0, dmg: 0, atk: '', atkN: 0, lg: '', lgS: 0 }, null, { exists: false }),
          wDelete(`clubs/${cid}/requests/${uid}`, { exists: true }),
          wUpdate(`clubs/${cid}`, { count: c.count + 1, last: uid }, true, { updateTime: raw.updateTime }),
        ]);
        CL.at = 0; return clubLoad(true);
      } catch (e) { if (e.status === 400 || e.status === 409 || /PRECONDITION|ABORTED/.test(e.code + e.message)) continue; throw e; }
    }
    throw new ClubErr('BUSY');
  }
  async function clubReject(uid) { await delDoc(`clubs/${myClubId()}/requests/${uid}`); CL.at = 0; return clubLoad(true); }
  async function clubSettings(o) {
    if (o.desc && badName(o.desc)) throw new ClubErr('DESC_BAD'); await setDoc(`clubs/${myClubId()}`, clubPayload(o)); CL.at = 0; return clubLoad(true); }
  // progreso propio de la semana: estrellas de la expedición, daño al jefe, ataques de hoy y estrellas de la liga
  async function clubReport(p) {
    const cid = myClubId(); if (!cid || offline()) return;
    await token();
    const ct = clubTime(), data = { name: myName(), avatar: prof().avatar || '🚀', wk: ct.wk, ex: Math.min(150, p.ex | 0), exN: Math.min(50, p.exN | 0), dmg: Math.min(5000000, p.dmg | 0), atk: ct.dayId, atkN: Math.min(6, p.atkN | 0), lg: ct.lg || '', lgS: Math.min(30, p.lgS | 0) };
    await setDoc(`clubs/${cid}/members/${auth.uid}`, data);
    // puntos de liga del club: la suma de lo que llevan todos (se recalcula con la lista de miembros)
    if (ct.lg) {
      try {
        await clubLoad(true);
        const s = CL.members.reduce((a, m) => a + (m._id === auth.uid ? data.lgS : (m.lgS || 0)), 0);
        if (!CL.club.lg || CL.club.lg.id !== ct.lg || CL.club.lg.s !== s) await setDoc(`clubs/${cid}`, { lg: { id: ct.lg, s: Math.min(s, CL.club.count * 30) } });
      } catch (e) { /* la liga se pondrá al día en la próxima partida */ }
    }
    CL.at = 0;
  }
  async function clubLeague() {
    const ct = clubTime(); if (!ct.lg) return [];
    return runQuery({ from: [{ collectionId: 'clubs' }], where: ffilter('lg.id', 'EQUAL', ct.lg), orderBy: [{ field: fld('lg.s'), direction: 'DESCENDING' }], limit: 50 });
  }
  const Club = { time: clubTime, load: clubLoad, create: clubCreate, search: clubSearch, join: clubJoin, leave: clubLeave, kick: clubKick, role: clubRole,
    transfer: clubTransfer, accept: clubAccept, reject: clubReject, settings: clubSettings, report: clubReport, league: clubLeague, state: CL, get id() { return myClubId(); } };

  // ---------------- entrar con Google y copia del progreso en la nube ----------------
  // La cuenta anónima se ENLAZA a la de Google (mismo uid: amigos, club y nombre siguen). Si esa cuenta de Google ya tenía
  // progreso de otro móvil, se entra en ella (la anónima de este móvil se borra) y se pregunta qué progreso quedarse.
  // Copia: saves/{uid} = el progreso entero (JSON), al minuto de cada cambio y al salir del juego.
  const GOOGLE_WEB = '385088273478-vtlgkobgmei8oeuu02t7jg318n7t5n7h.apps.googleusercontent.com';
  const SAVE_KEY = 'chromacrash3d.v1', CLOUD_KEY = 'rocketrush.cloud';
  class GErr extends Error { constructor(c) { super(c); this.code = c; } }
  const linked = () => !!(auth && auth.google && X.save.gacc);
  const devId = () => { let d = lsGet('rocketrush.dev'); if (!d) { d = Math.random().toString(36).slice(2, 12); lsSet('rocketrush.dev', d); } return d; };
  let cloudInfo = {}; try { cloudInfo = JSON.parse(lsGet(CLOUD_KEY) || '{}') || {}; } catch (e) { cloudInfo = {}; }
  // en la app de iPhone y iPad (ios/) aún no se puede entrar con Google (irá junto con «Iniciar sesión con Apple»)
  const NO_APP_TXT = () => window.ChromaPlatform === 'ios' ? 'Pronto en iPhone y iPad.' : 'Disponible en la app de Android.';
  function googleSignIn() {
    return new Promise((res, rej) => {
      const A = window.ChromaAndroid;
      if (!A || !A.googleSignIn) { rej(new GErr('NO_APP')); return; }
      if (offline()) { rej(new FbErr(-1, 'OFF')); return; }
      window.onGoogleSignIn = async r => {
        window.onGoogleSignIn = null;
        if (!r || !r.ok) { rej(new GErr(r && r.error === 'CANCEL' ? 'CANCEL' : 'FAIL')); return; }
        try { res(await googleFirebase(r)); } catch (e) { rej(e); }
      };
      A.googleSignIn(GOOGLE_WEB);
    });
  }
  async function googleFirebase(r) {
    await token();
    const old = Object.assign({}, auth);
    const post = { postBody: 'id_token=' + encodeURIComponent(r.idToken) + '&providerId=google.com', requestUri: 'http://localhost', returnSecureToken: true };
    const idp = body => call(`${IDT}/accounts:signInWithIdp?key=${CFG.apiKey}`, { method: 'POST', body: JSON.stringify(body) }, false);
    let j;
    try { j = await idp(Object.assign({ idToken: old.id }, post)); }
    catch (e) {
      if (!/FEDERATED_USER_ID_ALREADY_LINKED|ALREADY_LINKED|EMAIL_EXISTS|CREDENTIAL/.test(e.code + ' ' + e.message)) throw e;
      j = await idp(post);                         // esa cuenta de Google ya existía: se entra en ella
    }
    const switched = j.localId !== old.uid;
    if (switched) { try { await wipeServer(); } catch (e) { /* la anónima de este móvil se queda huérfana */ } }
    auth = { uid: j.localId, id: j.idToken, refresh: j.refreshToken, exp: Date.now() + (+j.expiresIn || 3600) * 1000, google: true };
    saveAuth();
    X.save.gacc = { email: r.email || j.email || '', name: r.name || j.displayName || '', at: Date.now() };
    if (switched) { X.save.codeUid = null; X.save.profUid = null; X.save.club = null; X.save.nameLc = null; X.save.clubReq = null; lastPushed = ''; lsSet(PUSH_KEY, ''); }
    X.persist();
    const cloud = await cloudGet();
    if (!switched || !cloud) { await cloudPut(true); dirty(800); }
    return { switched, cloud };
  }
  async function cloudGet() {
    const d = await getDoc(`saves/${auth.uid}`);
    if (!d) return null;
    let data = null; try { data = JSON.parse(d.data); } catch (e) { data = null; }
    return data ? { data, at: d.at, lv: d.lv, stars: d.stars, dev: d.dev } : null;
  }
  let cloudT = 0, cloudBusy = false;
  async function cloudPut(force) {
    if (!linked() || offline() || cloudBusy) return false;
    const raw = JSON.stringify(X.save);
    if (raw.length > 900000) return false;
    if (!force && raw === cloudInfo.last) return false;
    cloudBusy = true;
    try {
      await token();
      await setDoc(`saves/${auth.uid}`, { data: raw, at: new Date(), lv: Math.min(X.save.unlocked || 1, 100000), stars: X.starsTotal(), dev: devId() }, { merge: false });
      cloudInfo = { last: raw, at: Date.now() }; lsSet(CLOUD_KEY, JSON.stringify({ at: cloudInfo.at, last: raw }));
      return true;
    } finally { cloudBusy = false; }
  }
  function cloudSoon() { if (!linked()) return; clearTimeout(cloudT); cloudT = setTimeout(() => { cloudPut().catch(() => { /* se reintenta en el próximo cambio */ }); }, 60000); }
  // al salir del juego (Android lo avisa con ChromaPause) se sube lo que falte
  { const p0 = window.ChromaPause; window.ChromaPause = () => { if (p0) p0(); if (linked()) cloudPut().catch(() => {}); }; }
  function cloudApply(data) {
    // se queda con el progreso de la nube y vuelve a abrir el juego con él (la cuenta de Google se mantiene)
    data = Object.assign({}, data, { gacc: X.save.gacc, birthYear: data.birthYear || X.save.birthYear });
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); lsSet(CLOUD_KEY, JSON.stringify({ at: Date.now(), last: JSON.stringify(data) })); } catch (e) { return; }
    location.reload();
  }
  async function googleSignOut() {
    if (linked()) { try { await cloudPut(true); } catch (e) { /* sin conexión: la nube tiene la última copia */ } }
    try { if (window.ChromaAndroid && window.ChromaAndroid.googleSignOut) window.ChromaAndroid.googleSignOut(); } catch (e) { /* nada */ }
    auth = null; saveAuth(); lastPushed = ''; lsSet(PUSH_KEY, '');
    X.save.gacc = null; X.save.codeUid = null; X.save.profUid = null; X.save.club = null; X.save.nameLc = null;
    FR.list = []; FR.inc = []; FR.out = []; FR.loaded = false; FR.at = 0; for (const k in BOARD) delete BOARD[k];
    X.persist(); setNet('offline'); dirty(2000);
  }
  const Account = { signIn: googleSignIn, signOut: googleSignOut, put: cloudPut, get: cloudGet, apply: cloudApply, get linked() { return linked(); }, get info() { return X.save.gacc; }, get lastAt() { return cloudInfo.at || 0; } };

  // ventana de la cuenta (botón G de Ajustes)
  const fmtAgo = t => { if (!t) return T('nunca'); const m = Math.round((Date.now() - t) / 60000); return m < 1 ? T('ahora mismo') : m < 60 ? T('hace {x} min').replace('{x}', m) : m < 1440 ? T('hace {x} h').replace('{x}', Math.round(m / 60)) : new Date(t).toLocaleDateString(window.I18N ? I18N.lang : 'es'); };
  function accountBox(state) {
    const el = $('gAcc'); if (!el) return;
    const msg = t => { $('gaMsg').textContent = t ? T(t) : ''; };
    const btns = list => {
      $('gaBtns').innerHTML = list.map(([id, cls, t]) => `<button class="btn ${cls}" data-ga="${id}">${t}</button>`).join('');
      $('gaBtns').querySelectorAll('[data-ga]').forEach(b => b.addEventListener('click', () => { X.Audio.click && X.Audio.click(); act(b.dataset.ga, b); }));
    };
    const close = () => { el.classList.remove('on'); refreshG(); };
    const setTxt = (title, text, extra) => { $('gaTitle').textContent = T(title); $('gaText').textContent = T(text); $('gaExtra').innerHTML = extra || ''; };
    const app = !!(window.ChromaAndroid && window.ChromaAndroid.googleSignIn);
    const draw = () => {
      msg('');
      if (state && state.kind === 'choose') {
        const c = state.cloud, l = X.save;
        setTxt('Ya tienes progreso guardado', 'Esta cuenta de Google ya tenía progreso de otro móvil. ¿Con cuál te quedas?',
          `<div class="gacmp"><div><b>${T('En la nube')}</b>${T('Nivel')} ${c.lv || 1} · ⭐ ${c.stars || 0}<br>${fmtAgo(c.at)}</div><div><b>${T('En este móvil')}</b>${T('Nivel')} ${l.unlocked || 1} · ⭐ ${X.starsTotal()}</div></div>`);
        btns([['useCloud', 'green', T('Usar el de la nube')], ['useLocal', 'gray small', T('Quedarme con el de este móvil')]]);
        return;
      }
      if (X.save.kid) { setTxt('Cuenta', 'Guardar el progreso con Google no está disponible para tu edad.'); btns([['x', 'green', T('Cerrar')]]); return; }
      if (linked()) {
        const g = X.save.gacc;
        setTxt('Tu cuenta de Google', g.email || g.name || '', `<p class="sub">${T('Última copia en la nube')}: <b>${fmtAgo(Account.lastAt)}</b></p>`);
        btns([['save', 'blue', '☁️ ' + T('Guardar ahora')], ['restore', 'gray small', T('Recuperar de la nube')], ['out', 'gray small', T('Cerrar sesión')], ['x', 'green', T('Cerrar')]]);
        return;
      }
      setTxt('Guarda tu progreso', 'Entra con Google y tu progreso se guardará en la nube. Si cambias de móvil o reinstalas el juego, lo recuperas.', app ? '' : `<p class="sub">${T(NO_APP_TXT())}</p>`);
      btns((app ? [['in', 'gwhite', `${'<svg viewBox="0 0 48 48" width="24" height="24" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.8 6C6.6 42.6 14.6 48 24 48z"/></svg>'}<span>${T('Entrar con Google')}</span>`]] : []).concat([['x', 'green', T('Cerrar')]]));
    };
    async function act(a, b) {
      if (a === 'x') { close(); return; }
      if (a === 'in') {
        b.disabled = true; msg('Conectando…');
        try {
          const r = await Account.signIn();
          if (r.switched && r.cloud) { state = { kind: 'choose', cloud: r.cloud }; draw(); return; }
          X.toast(T('¡Listo! Tu progreso se guarda en tu cuenta de Google'), 3000); X.Audio.win && X.Audio.win(); state = null; draw(); refreshG();
        } catch (e) {
          b.disabled = false;
          msg(e.code === 'CANCEL' ? '' : e.code === 'NO_APP' ? NO_APP_TXT() : e.status === -1 ? 'Las funciones en línea están desactivadas en Ajustes › Privacidad.' : e.status === 0 ? 'Sin conexión a internet.' : 'No se ha podido entrar con Google. Prueba otra vez.');
        }
        return;
      }
      if (a === 'useCloud') { msg('Cargando…'); Account.apply(state.cloud.data); return; }
      if (a === 'useLocal') { b.disabled = true; try { await Account.put(true); } catch (e) { /* se subirá luego */ } dirty(800); X.toast(T('¡Listo! Tu progreso se guarda en tu cuenta de Google'), 3000); state = null; draw(); refreshG(); if (!X.save.welcomed) { close(); welcome(); } return; }
      if (a === 'save') { b.disabled = true; msg('Guardando…'); try { await Account.put(true); msg('Guardado en la nube'); } catch (e) { msg('Sin conexión: se guardará más tarde.'); } b.disabled = false; draw(); msg('Guardado en la nube'); return; }
      if (a === 'restore') {
        if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = T('Toca otra vez: se cambia tu progreso por el de la nube'); return; }
        msg('Cargando…');
        try { const c = await Account.get(); if (!c) { msg('No hay ninguna copia en la nube todavía.'); return; } Account.apply(c.data); } catch (e) { msg('Sin conexión a internet.'); }
        return;
      }
      if (a === 'out') {
        if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = T('Toca otra vez para cerrar sesión'); return; }
        await Account.signOut(); X.toast(T('Sesión cerrada. Tu progreso se queda en este móvil.'), 3000); draw(); refreshG(); return;
      }
    }
    draw(); el.classList.add('on');
  }
  function refreshG() { const ok = $('sGoogleOk'); if (ok) ok.hidden = !linked(); }
  { const gb = $('sGoogle'); if (gb) gb.addEventListener('click', () => { X.Audio.click && X.Audio.click(); accountBox(null); }); }
  // Entrar con Facebook: quitado de momento (Meta exige verificar una empresa para publicarlo). Configuración en Meta guardada.
  setTimeout(refreshG, 0);

  // ---------------- denunciar y bloquear ----------------
  // Bloquear se guarda en el móvil: su nombre y su avatar ya no se ven (ni en clasificaciones ni en clubes), sus solicitudes
  // de amistad se descartan y, si era tu amigo, deja de serlo. Denunciar manda el caso al panel (reports/{tú}_{él}).
  const blocked = () => X.save.blocked || (X.save.blocked = {});
  const blockedClubs = () => X.save.blockedClubs || (X.save.blockedClubs = {});
  const isBlocked = uid => !!(uid && blocked()[uid]);
  const isClubBlocked = cid => !!(cid && blockedClubs()[cid]);
  const mask = u => isBlocked(u && u._id) ? Object.assign({}, u, { name: T('Jugador bloqueado'), avatar: '🚫', country: '' }) : u;
  async function report(kind, target, name, reason) {
    await token();
    try {
      await setDoc(`reports/${auth.uid}_${target}`, { by: auth.uid, kind, target, name: String(name || '').slice(0, 40), reason, at: new Date() }, { merge: false, mustNotExist: true });
      return 'OK';
    } catch (e) { if (e.status === 400 || e.status === 409 || /ALREADY|PRECONDITION/.test(e.code + e.message)) return 'DONE'; throw e; }
  }
  async function block(uid, name) {
    blocked()[uid] = { name: String(name || '').slice(0, 20), at: Date.now() }; X.persist();
    // si era amigo o había solicitud, se quita
    const all = FR.list.concat(FR.inc, FR.out).filter(x => other(x.f) === uid);
    for (const x of all) { try { await delDoc(`friendships/${x.f._id}`); } catch (e) { /* ya no estaba */ } }
    if (all.length) { FR.at = 0; try { await loadFriends(); } catch (e) { /* sin conexión */ } }
  }
  function unblock(uid) { delete blocked()[uid]; X.persist(); }
  function blockClub(cid, name) { blockedClubs()[cid] = { name: String(name || '').slice(0, 20), at: Date.now() }; X.persist(); }
  function unblockClub(cid) { delete blockedClubs()[cid]; X.persist(); }
  // ficha con «Denunciar» y «Bloquear» (toca a un jugador o a un club de otro)
  function sheet(o) {
    const el = $('modSheet'); if (!el) return;
    const club = o.kind === 'club', id = o.id;
    let bl = club ? isClubBlocked(id) : isBlocked(id);
    const reasons = club ? [['name', 'Nombre ofensivo'], ['desc', 'Descripción ofensiva'], ['other', 'Otro motivo']] : [['name', 'Nombre ofensivo'], ['cheat', 'Hace trampas'], ['other', 'Otro motivo']];
    let step = 'main';
    const draw = (note) => {
      el.querySelector('.ribbon').textContent = club ? 'CLUB' : T('JUGADOR');
      el.querySelector('.msico').textContent = bl ? '🚫' : (o.avatar || (club ? '🛡️' : '🙂'));
      el.querySelector('.msname').textContent = bl ? (club ? T('Club bloqueado') : T('Jugador bloqueado')) : o.name || '?';
      el.querySelector('.msnote').textContent = note || '';
      el.querySelector('.msbtns').innerHTML = step === 'main'
        ? `<button class="btn red small" data-ms="rep">🚩 ${T('Denunciar')}</button><button class="btn ${bl ? 'blue' : 'gray'} small" data-ms="blk">${bl ? '✅ ' + T('Desbloquear') : '🚫 ' + T('Bloquear')}</button><button class="btn green" data-ms="x">${T('Cerrar')}</button>`
        : reasons.map(([k, t]) => `<button class="btn gray small" data-r="${k}">${T(t)}</button>`).join('') + `<button class="btn green" data-ms="back">${T('Volver')}</button>`;
      el.querySelectorAll('[data-ms],[data-r]').forEach(b => b.addEventListener('click', async () => {
        X.Audio.click && X.Audio.click();
        const a = b.dataset.ms, r = b.dataset.r;
        if (a === 'x') { el.classList.remove('on'); if (o.done) o.done(); return; }
        if (a === 'back') { step = 'main'; draw(); return; }
        if (a === 'rep') { step = 'rep'; draw(T('¿Por qué lo denuncias?')); return; }
        if (a === 'blk') {
          if (club) { bl ? unblockClub(id) : blockClub(id, o.name); } else if (bl) unblock(id); else await block(id, o.name);
          const was = bl; bl = !bl; step = 'main'; draw(was ? T('Desbloqueado') : club ? T('Club bloqueado: ya no verás su nombre ni su descripción.') : T('Bloqueado: ya no verás su nombre ni su avatar, y no podrá ser tu amigo.'));
          render(); if (window.Club) window.Club.render();
          return;
        }
        if (r) {
          b.disabled = true;
          try { const res = await report(club ? 'club' : 'player', id, o.name, r); step = 'main'; draw(res === 'DONE' ? T('Ya lo habías denunciado. Lo revisaremos.') : T('Gracias. Lo revisaremos lo antes posible.')); }
          catch (e) { draw(T(errText(e))); }
        }
      }));
    };
    draw(); el.classList.add('on');
  }

  window.Social = { countries: { list: COUNTRIES, flag, name: countryName, mine: () => prof().country || '' }, gifts: { load: () => token().then(loadGifts), get inbox() { return GF.inbox; }, send: uid => sendGift(uid), claim: claimGifts }, weekly: { submit: wkSubmit, board: wkBoard, get online() { return !offline(); } }, open, dirty, sync, addByCode, render, redeem, deleteAccount, club: Club, account: Account, welcome, sheet, isBlocked, isClubBlocked, blocked, blockedClubs, unblock, unblockClub, badName: n => badName(n), checkTester: () => token().then(checkTester), get hasAccount() { return !!(auth && auth.refresh); }, get net() { return net; }, get uid() { return auth && auth.uid; }, _fr: FR, _stats: myStats, get _busy() { return inflight + (busy ? 1 : 0) + (syncing ? 1 : 0); } };
})();
