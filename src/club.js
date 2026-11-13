// Rocket Rush — Clubes (pantalla y partidas). Diseño A: cabecera del club con pestañas Club · Expedición · Jefe · Liga.
// El servidor (crear, entrar, salir, oficiales, progreso) está en social.js (Social.club); aquí va lo que se ve y se juega.
//   Expedición: 50 niveles por semana, 10 nuevos cada día de lunes a viernes (se pueden jugar hasta el domingo).
//     Las estrellas de todos llenan el cofre del club; cada uno se lleva además monedas según lo que ha aportado.
//   Jefe colosal: toda la semana, 3 ataques al día por miembro; la vida es de todo el club (60.000 por miembro).
//   Liga: de viernes a lunes, 10 niveles difíciles; gana el club con más estrellas entre todos sus miembros.
// Los premios de una semana se recogen al abrir el club la semana siguiente.
(function () {
  'use strict';
  const X = window.RRGame, $ = id => document.getElementById(id);
  if (!X || !window.Social || !window.Social.club || !window.Levels) return;
  const S = window.Social.club, Lv = window.Levels;
  const ATTACKS = 3, HP_PER = 60000, CREATE_COST = 5000, CREATE_GEMS = 50, MAX = 30;
  // rangos, como en Clash of Clans (en el servidor el colíder se llama «officer»):
  //   miembro · veterano (acepta solicitudes y expulsa miembros) · colíder (además asciende hasta veterano, expulsa veteranos
  //   y cambia los ajustes) · líder (todo: asciende hasta colíder, expulsa colíderes y cede el liderazgo)
  const RANK = { member: 0, elder: 1, officer: 2, leader: 3 }, RKEY = ['member', 'elder', 'officer', 'leader'];
  const RNAME = { member: 'Miembro', elder: 'Veterano', officer: 'Colíder', leader: 'Líder' };
  const rankOf = r => RANK[r] || 0, maxOf = c => (c && c.max) || MAX;
  const TYPES = [['open', '🟢', 'Abierto'], ['req', '✋', 'Con solicitud'], ['closed', '🔒', 'Cerrado']];
  const THINT = { open: 'Abierto: entra quien quiera, sin esperar.', req: 'Con solicitud: los jugadores piden entrar y el líder, los colíderes o los veteranos deciden.', closed: 'Cerrado: no entra nadie nuevo hasta que lo abras.' };
  const typeOf = c => c.closed ? 'closed' : c.open ? 'open' : 'req';
  const LANGS = [['es', '🇪🇸 Español'], ['en', '🇬🇧 English'], ['pt', '🇵🇹 Português'], ['fr', '🇫🇷 Français'], ['de', '🇩🇪 Deutsch'], ['it', '🇮🇹 Italiano']];
  const ICONS = ['🚀', '💣', '⚡', '👑', '🔥', '⭐', '🦁', '🐲', '🧱', '🎯', '💎', '🛡️'];
  const COLS = [['#ff7a3d', '#c94f1a'], ['#3d8bff', '#2a5fd6'], ['#37c46b', '#22914b'], ['#e8203a', '#8a1a2c'], ['#ffc83d', '#e09a12'], ['#8a5cff', '#5a2fd0'],
    ['#ff5fa8', '#c2307a'], ['#20c4c4', '#128a8a'], ['#9aa6c8', '#4a5478'], ['#ffd76a', '#b07a10'], ['#6a46e0', '#2a1d6c'], ['#1d1440', '#000']];
  const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = n => Math.round(n || 0).toLocaleString('es-ES');
  const left = ms => { ms = Math.max(0, ms); const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4); return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`; };
  const shield = (b, w, h) => { const [c1, c2] = COLS[(b && b.c) || 0] || COLS[0]; return `<svg class="klshield" width="${w || 58}" height="${h || 66}" viewBox="0 0 64 72"><path d="M32 3 L60 12 V36 C60 54 46 64 32 69 C18 64 4 54 4 36 V12 Z" fill="${c1}" stroke="#2a1d5c" stroke-width="4"/><path d="M32 10 L53 17 V36 C53 50 43 58 32 62 Z" fill="${c2}" opacity=".55"/><text x="32" y="45" text-anchor="middle" font-size="26">${esc((b && b.ico) || '🚀')}</text></svg>`; };
  const BOSS_SVG = {
    golem: '<svg viewBox="0 0 200 190" width="190" height="170"><defs><linearGradient id="cgs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9aa6c8"/><stop offset="1" stop-color="#4a5478"/></linearGradient></defs><rect x="60" y="18" width="80" height="60" rx="14" fill="url(#cgs)" stroke="#1d1440" stroke-width="5"/><rect x="74" y="38" width="18" height="12" rx="3" fill="#ffd23f"/><rect x="108" y="38" width="18" height="12" rx="3" fill="#ffd23f"/><rect x="84" y="60" width="32" height="7" rx="3" fill="#1d1440"/><rect x="40" y="80" width="120" height="70" rx="16" fill="url(#cgs)" stroke="#1d1440" stroke-width="5"/><circle cx="100" cy="114" r="15" fill="#ff5a3d" stroke="#1d1440" stroke-width="4"/><rect x="8" y="84" width="30" height="64" rx="12" fill="url(#cgs)" stroke="#1d1440" stroke-width="5"/><rect x="162" y="84" width="30" height="64" rx="12" fill="url(#cgs)" stroke="#1d1440" stroke-width="5"/><rect x="56" y="150" width="34" height="34" rx="8" fill="url(#cgs)" stroke="#1d1440" stroke-width="5"/><rect x="110" y="150" width="34" height="34" rx="8" fill="url(#cgs)" stroke="#1d1440" stroke-width="5"/></svg>',
    pyramid: '<svg viewBox="0 0 200 170" width="200" height="170"><defs><linearGradient id="cgp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#c98a1a"/></linearGradient></defs><path d="M100 10 L190 160 H10 Z" fill="url(#cgp)" stroke="#1d1440" stroke-width="6" stroke-linejoin="round"/><path d="M100 10 L120 160 H10 Z" fill="#000" opacity=".12"/><path d="M62 96 q16 -14 30 0 q-16 12 -30 0Z" fill="#fff" stroke="#1d1440" stroke-width="4"/><path d="M108 96 q16 -14 30 0 q-16 12 -30 0Z" fill="#fff" stroke="#1d1440" stroke-width="4"/><circle cx="77" cy="96" r="6" fill="#1d1440"/><circle cx="123" cy="96" r="6" fill="#1d1440"/><rect x="80" y="124" width="40" height="8" rx="4" fill="#1d1440"/></svg>',
    ship: '<svg viewBox="0 0 220 180" width="210" height="172"><path d="M108 14 V120" stroke="#5a3a1a" stroke-width="8"/><path d="M112 22 Q170 50 112 100 Z" fill="#fff6e0" stroke="#1d1440" stroke-width="5"/><path d="M104 30 Q56 60 104 104 Z" fill="#ffe9c0" stroke="#1d1440" stroke-width="5"/><path d="M98 14 h30 l-8 10 8 10 h-30 Z" fill="#e8203a" stroke="#1d1440" stroke-width="3"/><path d="M14 118 H206 L180 166 H40 Z" fill="#8a4a1e" stroke="#1d1440" stroke-width="6" stroke-linejoin="round"/><circle cx="70" cy="140" r="9" fill="#1d1440"/><circle cx="110" cy="140" r="9" fill="#1d1440"/><circle cx="150" cy="140" r="9" fill="#1d1440"/></svg>',
  };
  let tab = 'club', ntab = 'find', busy = false, err = '', found = null, query = '', sel = null, leaveArm = 0, league = { at: 0, list: [], id: '' }, form = { name: '', desc: '', ico: '🚀', c: 0, type: 'open', max: MAX, minLv: 0, lang: '', country: '' }, edit = null, confirmOn = false, ranksOn = false;
  const save = () => X.save;

  // ---------------- progreso propio (en el móvil) ----------------
  function P() {
    const s = save(), ct = S.time();
    if (!s.clubP) s.clubP = { wk: ct.wk, ex: {}, dmg: 0, atkDay: '', atkN: 0, lg: ct.lg || '', lgS: {} };
    const p = s.clubP;
    if (p.wk !== ct.wk) { settleWeek(p); Object.assign(p, { wk: ct.wk, ex: {}, dmg: 0 }); X.persist(); }
    if ((p.lg || '') !== (ct.lg || '')) { settleLeague(p); Object.assign(p, { lg: ct.lg || '', lgS: {} }); X.persist(); }
    if (p.atkDay !== ct.dayId) { p.atkDay = ct.dayId; p.atkN = 0; }
    return p;
  }
  const sum = o => Object.values(o || {}).reduce((a, b) => a + (b || 0), 0);
  const nDone = o => Object.values(o || {}).filter(v => v > 0).length;
  const CHEST = {
    wood: { coins: 300, bomb: 1 },
    gold: { coins: 700, bomb: 2, rainbow: 1, gems: 5 },
    crystal: { coins: 1500, bomb: 3, rainbow: 2, gems: 15, golden: 1 },
  };
  // instantánea de cómo iba el club (para dar los premios cuando acaba la semana)
  function snap() {
    const st = S.state; if (!st.club) return;
    const s = save(), ct = S.time();
    const sn = s.clubSnap && s.clubSnap.wk === ct.wk ? s.clubSnap : { wk: ct.wk };
    Object.assign(sn, { count: st.club.count, ex: st.members.reduce((a, m) => a + (m.ex || 0), 0), dmg: st.members.reduce((a, m) => a + (m.dmg || 0), 0) });
    s.clubSnap = sn;
    // puesto dentro del grupo (si aún no tiene rivales, no hay puesto: cofre de madera si ha jugado)
    if (ct.lg && league.id === ct.lg && league.list.length > 1) { const i = league.list.findIndex(c => c._id === st.cid); s.clubLgSnap = { lg: ct.lg, rank: i >= 0 ? i + 1 : 0 }; }
    X.persist();
  }
  const exGoal = n => Math.max(1, n) * 40;
  const exTier = (stars, n) => { const f = stars / exGoal(n); return f >= 1 ? 'crystal' : f >= 0.6 ? 'gold' : f >= 0.25 ? 'wood' : null; };
  function pend(r) { const s = save(); s.clubPending = (s.clubPending || []).concat([r]).slice(-6); }
  function settleWeek(p) {
    const s = save(), sn = s.clubSnap && s.clubSnap.wk === p.wk ? s.clubSnap : null, my = sum(p.ex);
    if (my > 0) {
      const tier = sn ? exTier(sn.ex, sn.count) : null;
      const r = Object.assign({}, tier ? CHEST[tier] : {}); r.coins = (r.coins || 0) + my * 15;
      pend({ what: 'Expedición', tier: tier || 'wood', r });
    }
    if (p.dmg > 0) {
      const dead = sn && sn.dmg >= sn.count * HP_PER;
      pend({ what: dead ? 'Jefe colosal derrotado' : 'Jefe colosal', tier: dead ? 'gold' : 'wood', r: dead ? { coins: 500 + Math.round(p.dmg / 40), gems: 10 } : { coins: Math.round(p.dmg / 40) } });
    }
  }
  function settleLeague(p) {
    const s = save(), my = sum(p.lgS);
    if (!p.lg || my <= 0) return;
    const rk = s.clubLgSnap && s.clubLgSnap.lg === p.lg ? s.clubLgSnap.rank : 0;
    const tier = rk === 1 ? 'crystal' : rk && rk <= 3 ? 'gold' : 'wood';
    pend({ what: rk ? 'Liga · ' + rk + '.º puesto' : 'Liga', tier, r: Object.assign({}, CHEST[tier]) });
  }

  // ---------------- niveles de la semana ----------------
  let built = { ex: '', lg: '', boss: '' };
  function ensureLevels() {
    const ct = S.time();
    if (built.ex !== ct.wk) { Lv.club('ex', ct.wk); built.ex = ct.wk; }
    if (built.boss !== ct.wk) { Lv.club('boss', ct.wk); built.boss = ct.wk; }
    if (ct.lg && built.lg !== ct.lg) { Lv.club('lg', ct.lg); built.lg = ct.lg; }
  }
  // ¿se puede jugar la casilla «pos» de la expedición? (los días se abren de lunes a viernes; dentro del día, en orden)
  function exOpen(pos) {
    const ct = S.time(), p = P(), d = Math.floor((pos - 1) / 10);
    if (d > ct.day) return false;
    const first = d * 10 + 1;
    return pos === first || (p.ex[pos - 1] || 0) > 0;
  }
  function lgOpen(pos) { const p = P(); return !!S.time().lg && (pos === 1 || (p.lgS[pos - 1] || 0) > 0); }

  // ---------------- pantalla ----------------
  function setMsg(t) { err = t || ''; const el = $('clubErr'); if (el) { el.textContent = err; el.hidden = !err; } }
  function errMsg(e) {
    const c = e && e.code;
    return ({ NAME_TAKEN: 'Ese nombre ya lo tiene otro club', NAME_SHORT: 'El nombre necesita al menos 3 letras', NAME_BAD: 'Ese nombre no está permitido', DESC_BAD: 'Esa descripción no está permitida', IN_CLUB: 'Ya estás en un club',
      FULL: 'El club está lleno', CLOSED: 'El club está cerrado: no admite a nadie nuevo', MIN_LV: 'No tienes el nivel mínimo que pide el club', GONE: 'Ese club ya no existe', KICKED: 'Ya no estás en el club', BUSY: 'Hay mucho movimiento: vuelve a probar' })[c]
      || (e && e.status === -1 ? (save().kid ? 'Los clubes no están disponibles para tu edad.' : 'Las funciones en línea están desactivadas en Ajustes › Privacidad.')
        : e && e.status === 0 ? 'Sin conexión a internet.' : 'No se ha podido conectar con el servidor.');
  }
  async function run(fn, okMsg) {
    if (busy) return; busy = true; setMsg(''); render();
    try { const r = await fn(); if (okMsg) X.toast(okMsg); busy = false; render(); return r; } catch (e) { busy = false; setMsg(errMsg(e)); render(); if (e && (e.code === 'KICKED' || e.code === 'GONE')) X.toast(errMsg(e)); }
  }
  // liga: tu grupo (tu club y hasta 4 rivales elegidos al azar al empezar), ordenado por estrellas de esta liga
  async function loadGroup(ct) {
    const g = await S.group();
    const pts = c => (c.lg && c.lg.id === ct.lg ? c.lg.s : 0) || 0;
    const list = g ? g.clubs.slice().sort((a, b) => pts(b) - pts(a) || String(a._id).localeCompare(String(b._id))) : [];
    league = { at: Date.now(), list, id: ct.lg, gid: g ? g.id : '', pts };
  }
  async function refresh(force) {
    if (!S.id) { render(); return; }
    busy = true; render();
    try { await S.load(force); const ct = S.time(); if (ct.lg && (force || Date.now() - league.at > 60e3 || league.id !== ct.lg)) await loadGroup(ct); snap(); setMsg(''); }
    catch (e) { setMsg(errMsg(e)); }
    busy = false; render();
  }
  let from = 'map';   // pantalla a la que vuelve «atrás»: 'title' (botón de la portada) o 'map' (fila del mapa)
  function open(t, f) {
    if (f) from = f;
    if (t) tab = t;
    P(); ensureLevels();
    X.show('club'); X.setCoins(); $('clubList').scrollTop = 0;
    render(); refresh();
  }

  function head() {
    const st = S.state, c = st.club;
    const tabs = [['club', 'Club'], ['ex', 'Expedición'], ['boss', 'Jefe'], ['lg', 'Liga']];
    if (!S.id || !c) {
      return `<div class="row klhrow"><span class="klbig">🛡️</span><div><b class="klname">Clubes</b><small>Juega en equipo: expedición, jefe colosal y liga</small></div></div>` +
        `<div class="stabs kltabs">${[['find', '🔎 Buscar'], ['create', '➕ Crear']].map(([k, t]) => `<button data-nt="${k}" class="${ntab === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    }
    const open = c.closed ? 'Cerrado' : c.open ? 'Abierto' : 'Con solicitud';
    return `<div class="row klhrow">${shield(c.badge)}<div><b class="klname" translate="no">${esc(c.name)}</b><small><span>${c.count}/${maxOf(c)} miembros</span> · <span>${open}</span>${c.minLv ? ' · <span>nivel ' + c.minLv + '+</span>' : ''}${c.country ? ' · ' + CO().flag(c.country) : ''}</small></div></div>` +
      `<div class="stabs kltabs">${tabs.map(([k, t]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  }
  // jugadores y clubes bloqueados (Ajustes › Privacidad y ayuda): no se ven su nombre ni su avatar
  const SO = window.Social;
  const mm = m => SO.isBlocked(m._id) ? Object.assign({}, m, { name: 'Jugador bloqueado', avatar: '🚫' }) : m;
  const cm = c => SO.isClubBlocked(c._id) ? Object.assign({}, c, { name: 'Club bloqueado', desc: '', badge: { ico: '🚫', c: 11 } }) : c;
  const card = (h, cls) => `<div class="klcard ${cls || ''}">${h}</div>`;
  const bar = (f, cls) => `<div class="klbar ${cls || ''}"><i style="width:${Math.max(0, Math.min(100, f * 100)).toFixed(1)}%"></i></div>`;
  const roleTag = r => r === 'leader' ? '<span class="klrole">LÍDER</span>' : r === 'officer' ? '<span class="klrole of">COLÍDER</span>' : r === 'elder' ? '<span class="klrole el">VETERANO</span>' : '';
  const CO = () => (window.Social && window.Social.countries) || { list: [], flag: () => '🏳️', name: c => c, mine: () => '' };
  // ajustes del club (al crearlo y, después, para el líder y los colíderes): tipo, máximo, nivel mínimo, idioma y país
  function setCtl(o) {
    const co = CO(), cl = co.list.includes(o.country) || !o.country ? co.list : [o.country].concat(co.list);
    return `<label class="sm">Tipo de club</label>
      <div class="klseg">${TYPES.map(([k, i, n]) => `<button data-ty="${k}" class="${o.type === k ? 'on' : ''}"><b>${i}</b>${n}</button>`).join('')}</div>
      <div class="klhint">${THINT[o.type]}</div>
      <div class="klrow2"><span>👥 Máximo</span><div class="klstep"><button data-st="max" data-d="-5" ${o.max <= Math.max(10, o.minMax || 0) ? 'disabled' : ''}>−</button><i>${o.max}</i><button data-st="max" data-d="5" ${o.max >= 50 ? 'disabled' : ''}>+</button></div></div>
      <div class="klhint">De 10 a 50 miembros. Con más miembros, el jefe colosal tiene más vida y la liga se reparte entre más.</div>
      <div class="klrow2"><span>⭐ Nivel mínimo</span><div class="klstep"><button data-st="minLv" data-d="-5" ${o.minLv <= 0 ? 'disabled' : ''}>−</button><i>${o.minLv ? 'Nivel ' + o.minLv : 'Ninguno'}</i><button data-st="minLv" data-d="5" ${o.minLv >= 100 ? 'disabled' : ''}>+</button></div></div>
      <div class="klhint">Solo pueden entrar o pedir entrar jugadores con este nivel o más.</div>
      <div class="kltwo"><div><label class="sm">Idioma</label><select class="klsel" data-sel="lang">${LANGS.map(([k, n]) => `<option value="${k}" ${o.lang === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div><label class="sm">País</label><select class="klsel" data-sel="country"><option value="" ${!o.country ? 'selected' : ''}>🌍 Todos</option>${cl.map(c => `<option value="${c}" ${o.country === c ? 'selected' : ''}>${co.flag(c)} ${esc(co.name(c))}</option>`).join('')}</select></div></div>`;
  }
  const tags = o => { const co = CO(), t = TYPES.find(x => x[0] === o.type) || TYPES[0], l = LANGS.find(x => x[0] === o.lang);
    return `<div class="kltags"><span>${t[1]} ${t[2]}</span><span>👥 ${o.max}</span><span>⭐ ${o.minLv ? 'Nivel ' + o.minLv + '+' : 'Sin mínimo'}</span>${l ? `<span>${l[1]}</span>` : ''}${o.country ? `<span>${co.flag(o.country)} ${esc(co.name(o.country))}</span>` : ''}</div>`; };
  const fromClub = c => ({ cid: S.state.cid, desc: c.desc || '', type: typeOf(c), max: maxOf(c), minLv: c.minLv || 0, lang: c.lang || 'es', country: c.country || '', badge: c.badge, minMax: c.count });
  const payload = o => ({ desc: o.desc, open: o.type === 'open', closed: o.type === 'closed', max: o.max, minLv: o.minLv, lang: o.lang, country: o.country, badge: o.badge || { ico: o.ico, c: o.c } });

  function pendingCard() {
    const pd = save().clubPending || [];
    if (!pd.length) return '';
    return card(`<div class="klttl">🎁 Premios de la semana pasada</div>` + pd.map(x => `<div class="sm">${esc(x.what)}</div>`).join('') + `<button class="btn green small" id="clubClaim">RECOGER</button>`, 'klprize');
  }
  function claim() {
    const s = save(), pd = s.clubPending || []; if (!pd.length) return;
    const x = pd.shift(); s.clubPending = pd;
    X.grant(x.r); X.persist(); X.setCoins();
    X.openChestFX(x.tier, x.r, () => { X.show('club'); render(); if ((save().clubPending || []).length) setTimeout(claim, 300); });
  }

  // Resumen + botón de crear: se rehace al escribir el nombre sin perder el foco del campo
  function sumHtml() {
    const s = save(), needC = Math.max(0, CREATE_COST - (s.coins || 0)), needG = Math.max(0, CREATE_GEMS - (s.gems || 0)), okName = (form.name || '').trim().length >= 3, can = !needC && !needG && okName;
    return `<div class="klsum">${shield({ ico: form.ico, c: form.c })}<div><b translate="no">${esc((form.name || '').trim() || 'Tu club')}</b>${tags(form)}</div></div>
        <button class="btn gold klpay" id="cfGo" ${can && !busy ? '' : 'disabled'}><span>CREAR CLUB</span><i class="coin"></i>${CREATE_COST.toLocaleString('es-ES')}<i class="gem"></i>${CREATE_GEMS}</button>
        ${!okName ? '<div class="sm klmid">Escribe un nombre de al menos 3 letras</div>' : ''}${needC ? `<div class="sm klmid">Te faltan ${needC.toLocaleString('es-ES')} monedas</div>` : ''}${needG ? `<div class="sm klmid">Te faltan ${needG} gemas</div>` : ''}
        ${can ? `<div class="klok">✓ Tienes suficiente: ${(s.coins || 0).toLocaleString('es-ES')} monedas y ${s.gems || 0} gemas</div>` : ''}`;
  }
  function confirmBox() {
    return `<div class="klconfirm" id="cfBox"><div class="panel"><div class="ribbon gold">¿CREAR EL CLUB?</div>
      <div class="klsum">${shield({ ico: form.ico, c: form.c })}<div><b translate="no">${esc(form.name.trim())}</b>${tags(form)}</div></div>
      <p class="klcp">Se cobrarán ${CREATE_COST.toLocaleString('es-ES')} monedas y ${CREATE_GEMS} gemas. Serás el líder y podrás cambiar los ajustes cuando quieras.</p>
      <div class="row"><button class="btn gray" id="cfNo">Cancelar</button><button class="btn green klpay" id="cfPay" ${busy ? 'disabled' : ''}><span>PAGAR</span><i class="coin"></i>${CREATE_COST.toLocaleString('es-ES')}<i class="gem"></i>${CREATE_GEMS}</button></div></div></div>`;
  }
  function viewNoClub() {
    const s = save();
    if (ntab === 'create') {
      if (!form.lang) form.lang = window.I18N ? I18N.lang : 'es';
      if (form.country === '' && !form.cset) { form.country = CO().mine(); form.cset = true; }
      return card(`<div class="klttl">➕ Crea tu club</div>
        <label class="sm">Nombre</label><input id="cfName" class="klinput" maxlength="20" autocomplete="off" spellcheck="false" value="${esc(form.name)}" placeholder="Los Demoledores">
        <label class="sm">Descripción</label><input id="cfDesc" class="klinput" maxlength="80" autocomplete="off" value="${esc(form.desc)}" placeholder="¡Venid a demoler!">
        <label class="sm">Escudo</label><div class="klpick">${ICONS.map(i => `<button data-ico="${i}" class="${form.ico === i ? 'on' : ''}">${i}</button>`).join('')}</div>
        <div class="klpick col">${COLS.map((c, i) => `<button data-col="${i}" class="${form.c === i ? 'on' : ''}" style="background:${c[0]}"></button>`).join('')}</div>`) +
        card(`<div class="klttl">⚙️ Ajustes del club</div>${setCtl(form)}`) +
        card(`<div id="cfSum">${sumHtml()}</div>`);
    }
    const req = s.clubReq && Date.now() - s.clubReq.at < 7 * 864e5 ? card(`<div class="sm">Solicitud enviada a</div><b translate="no">${esc(s.clubReq.name)}</b><div class="sm">Cuando te acepten aparecerás dentro.</div><button class="btn gray small" id="cfReqCheck">Comprobar</button>`) : '';
    const list = found == null ? '<div class="sm klmid">Buscando clubes…</div>' : !found.length ? '<div class="sm klmid">No hay clubes con ese nombre. ¡Crea el tuyo!</div>'
      : found.map(cm).map(c => `<div class="klfound" data-club="${esc(c._id)}">${shield(c.badge, 40, 46)}<div class="klfi"><b translate="no">${esc(c.name)}</b><small><span translate="no">${c.count}/${maxOf(c)}</span> · <span>${c.closed ? 'Cerrado' : c.open ? 'Abierto' : 'Con solicitud'}</span>${c.minLv ? ' · <span>nivel ' + c.minLv + '+</span>' : ''}${c.lang ? ' · ' + ((LANGS.find(l => l[0] === c.lang) || ['', c.lang])[1].split(' ')[0]) : ''}</small>${c.desc ? `<small class="kldesc" translate="no">${esc(c.desc)}</small>` : ''}</div>` +
        (c.closed ? '<span class="sm">🔒 Cerrado</span>' : c.count >= maxOf(c) ? '<span class="sm">Lleno</span>' : `<button class="btn small ${c.open ? 'green' : 'blue'}" data-join="${esc(c._id)}" ${busy ? 'disabled' : ''}>${c.open ? 'Entrar' : 'Pedir'}</button>`) + '</div>').join('');
    return req + card(`<div class="row klsearch"><input id="cfQ" class="klinput" maxlength="20" autocomplete="off" spellcheck="false" value="${esc(query)}" placeholder="Nombre del club"><button class="btn blue small" id="cfFind">Buscar</button></div>${list}`);
  }

  function viewClub() {
    const st = S.state, c = st.club, me = st.me, ct = S.time(), p = P();
    const myR = rankOf(me.role), staff = myR >= 1, boss = myR >= 2, lead = myR === 3, mx = maxOf(c);
    const exAll = st.members.reduce((a, m) => a + (m.ex || 0), 0), hp = c.count * HP_PER, dmg = st.members.reduce((a, m) => a + (m.dmg || 0), 0);
    const rk = league.id === ct.lg && league.list.length > 1 ? league.list.findIndex(x => x._id === st.cid) + 1 : 0;
    const week = `<span>Expedición: día ${Math.min(5, ct.day + 1)} de 5</span> · <span>Jefe: ${Math.max(0, Math.round((1 - dmg / hp) * 100))} % de vida</span> · <span>` + (ct.lg ? (rk ? 'Liga: ' + rk + '.º puesto' : 'Liga: en juego') : 'Liga: el viernes') + '</span>';
    const mems = st.members.slice().sort((a, b) => (b.ex || 0) - (a.ex || 0) || (b.dmg || 0) - (a.dmg || 0));
    const act = m => {
      if (sel !== m._id || m._id === me._id) return '';
      const rep = `<button class="btn gray small" data-sheet="${m._id}">🚩 Denunciar o bloquear</button>`;
      const tR = rankOf(m.role);
      if (tR >= myR) return `<div class="klact">${rep}</div>`;
      const up = boss && tR + 1 < myR ? RKEY[tR + 1] : null, down = boss && tR >= 1 ? RKEY[tR - 1] : null;
      return `<div class="klact">${rep}` + (up ? `<button class="btn blue small" data-role="${up}" data-u="${m._id}">⬆ Ascender a ${RNAME[up].toLowerCase()}</button>` : '') +
        (down ? `<button class="btn gray small" data-role="${down}" data-u="${m._id}">⬇ Degradar a ${RNAME[down].toLowerCase()}</button>` : '') +
        (lead ? `<button class="btn gold small" data-lead="${m._id}">👑 Hacer líder</button>` : '') + `<button class="btn red small" data-kick="${m._id}">Expulsar</button></div>`;
    };
    const rows = mems.map(mm).map(m => `<div class="klmem ${m._id === me._id ? 'me' : ''}" data-m="${m._id}"><span class="klav">${esc(m.avatar)}</span><span class="klnm" translate="no">${esc(m.name)}</span>${roleTag(m.role)}<span class="klpts">${m.ex || 0} ⭐</span></div>${act(m)}`).join('');
    const reqs = staff && st.reqs.length ? card(`<div class="klttl">📨 Quieren entrar (${st.reqs.length})</div>` + st.reqs.map(mm).map(r => `<div class="klmem"><span class="klav">${esc(r.avatar)}</span><span class="klnm" translate="no">${esc(r.name)}</span><span class="sm">${r.lv || 0} ⭐</span><button class="btn green small" data-acc="${r._id}" ${c.count >= mx ? 'disabled' : ''}>Sí</button><button class="btn gray small" data-rej="${r._id}">No</button></div>`).join('')) : '';
    if (boss && (!edit || edit.cid !== st.cid)) edit = fromClub(c);
    if (edit) edit.minMax = c.count;
    const settings = boss ? card(`<div class="klttl">⚙️ Ajustes del club</div><label class="sm">Descripción</label><input id="csDesc" class="klinput" maxlength="80" value="${esc(edit.desc)}">
      ${setCtl(edit)}<div class="row klgap"><button class="btn blue" id="csSave" ${busy ? 'disabled' : ''}>Guardar ajustes</button></div>`) : '';
    const ranks = card(`<div class="row"><div class="klttl">🎖️ Rangos</div><button class="btn gray small klright" id="clubRanks">${ranksOn ? 'Ocultar' : 'Ver'}</button></div>` + (ranksOn ? `<div class="klranks">
      <div><span class="klrole">LÍDER</span> Todo: asciende hasta colíder, expulsa a cualquiera, cambia los ajustes y puede ceder el liderazgo.</div>
      <div><span class="klrole of">COLÍDER</span> Cambia los ajustes, acepta solicitudes, asciende a veterano y expulsa a miembros y veteranos.</div>
      <div><span class="klrole el">VETERANO</span> Acepta solicitudes y expulsa a miembros.</div>
      <div><span class="klrole mb">MIEMBRO</span> Juega y suma para el club.</div>
      <div class="sm">Toca a un miembro de la lista para ascenderlo, degradarlo o expulsarlo.</div></div>` : ''));
    return pendingCard() + card(`<div class="klttl">📣 Esta semana</div><div class="sm">${week}</div>`) +
      reqs + card(`<div class="klttl">👥 Miembros <span translate="no">${c.count}/${mx}</span> <span class="sm klright">contribución semanal</span></div>${rows}`) + ranks +
      `<div class="klbtns"><button class="btn blue" id="clubInvite">Invitar amigos</button></div>` + settings +
      `<div class="klbtns"><button class="btn gray small" id="clubLeave">${leaveArm > Date.now() ? 'Toca otra vez para salir' : 'Salir del club'}</button></div>`;
  }

  function tiles(n, start, state, open, prefix) {
    return `<div class="klgrid">${Array.from({ length: n }, (_, i) => { const pos = start + i, s = state[pos] || 0, o = open(pos), cur = o && !s;
      return `<button class="kllv ${s ? 'd' : cur ? 'c' : o ? '' : 'l'}" data-${prefix}="${pos}" ${o ? '' : 'disabled'}>${pos}${s ? `<i>${'★'.repeat(s)}</i>` : ''}</button>`; }).join('')}</div>`;
  }
  function viewEx() {
    const st = S.state, c = st.club, ct = S.time(), p = P();
    const all = st.members.reduce((a, m) => a + (m._id === st.me._id ? sum(p.ex) : (m.ex || 0)), 0), goal = exGoal(c.count), tier = exTier(all, c.count);
    const tname = { wood: 'Ya tenéis el cofre de madera', gold: 'Ya tenéis el cofre de oro', crystal: 'Ya tenéis el cofre de cristal' };
    let h = card(`<div class="row"><div class="klttl">🏔️ Expedición semanal</div><span class="kltag">${left(ct.weekEnd - Date.now())}</span></div>${bar(all / goal)}
      <div class="sm"><span>El club lleva ${fmt(all)} de ${fmt(goal)} estrellas</span> · <span>${tier ? tname[tier] : 'Cofre de madera con ' + fmt(Math.ceil(goal * 0.25))}</span></div>
      <div class="sm">Tú: ${sum(p.ex)} ⭐ (cada estrella son 15 monedas al acabar la semana)</div>`);
    for (let d = 0; d < 5; d++) {
      const done = [...Array(10)].filter((_, i) => (p.ex[d * 10 + i + 1] || 0) > 0).length;
      const stt = d < ct.day || ct.day >= 5 || d === ct.day ? `${done}/10${done === 10 ? ' ✔' : ''}` : d === ct.day + 1 ? 'se abre en ' + left(ct.dayEnd - Date.now()) : '🔒';
      h += card(`<div class="row"><b>${DAYS[d]}</b>${d === ct.day ? '<b class="kltoday">HOY</b>' : ''}<span class="sm klright">${stt}</span></div>${tiles(10, d * 10 + 1, p.ex, exOpen, 'ex')}`, 'klday');
    }
    return pendingCard() + h;
  }
  function viewBoss() {
    const st = S.state, c = st.club, p = P(), ct = S.time();
    const B = Lv.byId(42001), hp = c.count * HP_PER;
    const dmg = st.members.reduce((a, m) => a + (m._id === st.me._id ? p.dmg : (m.dmg || 0)), 0), lifeF = Math.max(0, 1 - dmg / hp), dead = lifeF <= 0;
    const leftN = Math.max(0, ATTACKS - p.atkN);
    const top = st.members.map(m => m._id === st.me._id ? Object.assign({}, m, { dmg: p.dmg }) : mm(m)).sort((a, b) => (b.dmg || 0) - (a.dmg || 0)).slice(0, 5)
      .map(m => `<div class="klmem"><span class="klav">${esc(m.avatar)}</span><span class="klnm" translate="no">${esc(m.name)}</span>${roleTag(m.role)}<span class="klpts">${fmt(m.dmg)} 💥</span></div>`).join('');
    return pendingCard() + card(`<div class="klttl klmid">🗿 ${esc(B ? B.bossName : 'Jefe colosal')}</div><div class="klboss">${BOSS_SVG[B && B.boss] || BOSS_SVG.golem}</div>${bar(lifeF, 'red')}
      <div class="sm klmid">Vida del club: ${fmt(Math.max(0, hp - dmg))} / ${fmt(hp)} · termina en ${left(ct.weekEnd - Date.now())}</div>
      <div class="row klstat"><div><b>${fmt(p.dmg)}</b><small>tu daño</small></div><div><b>${leftN}/${ATTACKS}</b><small>ataques hoy</small></div></div>
      ${dead ? '<div class="sm klmid">¡Derrotado! El premio llega el lunes.</div>' : `<button class="btn green" id="clubAttack" ${leftN ? '' : 'disabled'}>${leftN ? '¡ATACAR!' : 'Mañana más ataques'}</button>`}`, 'klbosscard') +
      card(`<div class="klttl">💥 Más daño</div>${top}`);
  }
  function viewLg() {
    const st = S.state, ct = S.time(), p = P();
    if (!ct.lg) {
      const s = save(), last = s.clubLgSnap;
      return pendingCard() + card(`<div class="klttl">🏆 Liga del fin de semana</div><div class="sm">Empieza el viernes: falta ${left(ct.lgStart - Date.now())}. Al empezar, tu club entra en un grupo con 4 clubes elegidos al azar: 10 niveles difíciles y gana el que más estrellas consiga.</div>` +
        (last && last.rank ? `<div class="sm">La última vez quedasteis ${last.rank}.º</div>` : '')) + card('<div class="sm">Premios: 1.º cofre de cristal · 2.º y 3.º cofre de oro · los demás cofre de madera (si has jugado)</div>');
    }
    const N = S.GROUP_N || 5, pts = league.pts || (c => (c.lg && c.lg.id === ct.lg ? c.lg.s : 0) || 0);
    const rivals = Math.max(0, league.list.length - 1);
    const rows = `<div class="row"><div class="klttl">⚔️ Tu grupo</div><span class="kltag">${league.list.length}/${N}</span></div>
      <div class="sm">${rivals >= N - 1 ? 'Tu club contra 4 rivales elegidos al azar al empezar la liga.' : 'Buscando rivales: los clubes que juegan esta liga se van sumando a tu grupo al azar (hasta 4 rivales).'}</div>` +
      league.list.map(cm).map((c, i) => `<div class="klrank ${c._id === st.cid ? 'me' : ''}" ${c._id === st.cid ? '' : `data-club="${esc(c._id)}"`}><span class="kln">${i + 1}</span>${shield(c.badge, 26, 30)}<span class="klnm" translate="no">${esc(c.name)}</span><span class="klpts">${fmt(pts(c))} ⭐</span></div>`).join('') +
      Array.from({ length: Math.max(0, N - league.list.length) }, () => `<div class="klrank klwait"><span class="kln">·</span><span class="klnm">🔎 Buscando rival…</span></div>`).join('');
    return pendingCard() + card(`<div class="row"><div class="klttl">🏆 Liga del fin de semana</div><span class="kltag lg">${left(ct.lgEnd - Date.now())}</span></div>
      <div class="sm">10 niveles · gana el club con más estrellas · tú llevas ${sum(p.lgS)} ⭐</div>${tiles(10, 1, p.lgS, lgOpen, 'lg')}`) + card(rows) +
      card('<div class="sm">Premios según el puesto en tu grupo: 1.º cofre de cristal · 2.º y 3.º cofre de oro · 4.º y 5.º cofre de madera (si has jugado)</div>');
  }

  function render() {
    if (!$('club')) return;
    const s = save(), st = S.state, inClub = S.id && st.club && st.cid === S.id;
    $('clubHead').innerHTML = head() + `<div class="socnet" id="clubNet">${busy ? '<i class="wait"></i> Conectando…' : ''}</div>`;
    let body;
    if (s.kid) body = card('<div class="sm klmid">Los clubes no están disponibles para tu edad.</div>');
    else if (s.noOnline) body = card('<div class="sm klmid">Las funciones en línea están desactivadas en Ajustes › Privacidad.</div><button class="btn blue small" id="clubOnline">Activarlas</button>');
    else if (!S.id) body = viewNoClub();
    else if (!inClub) body = card(`<div class="sm klmid">${busy ? 'Cargando tu club…' : 'No se ha podido cargar el club.'}</div>`);
    else body = ({ club: viewClub, ex: viewEx, boss: viewBoss, lg: viewLg })[tab]();
    $('clubList').innerHTML = `<div class="klerr" id="clubErr" ${err ? '' : 'hidden'}>${esc(err)}</div>` + body;
    // ventana de confirmación del pago: encima de toda la pantalla del club
    let md = $('clubModal');
    if (!md) { md = document.createElement('div'); md.id = 'clubModal'; $('club').appendChild(md); }
    const canPay = !S.id && ntab === 'create' && (form.name || '').trim().length >= 3 && (s.coins || 0) >= CREATE_COST && (s.gems || 0) >= CREATE_GEMS;
    if (!canPay) confirmOn = false;
    md.innerHTML = confirmOn ? confirmBox() : '';
    wire();
  }

  function wire() {
    const L = $('clubList'), H = $('clubHead'), on = (sel, ev, f) => L.querySelectorAll(sel).forEach(el => el.addEventListener(ev, e => { X.Audio.click && X.Audio.click(); f(el, e); }));
    H.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => { X.Audio.click && X.Audio.click(); tab = b.dataset.t; sel = null; $('clubList').scrollTop = 0; render(); if (tab === 'lg') refresh(); }));
    H.querySelectorAll('[data-nt]').forEach(b => b.addEventListener('click', () => { X.Audio.click && X.Audio.click(); ntab = b.dataset.nt; render(); if (ntab === 'find' && found == null) find(); }));
    const g = id => L.querySelector('#' + id) || ($('clubModal') && $('clubModal').querySelector('#' + id));
    if (g('clubClaim')) g('clubClaim').addEventListener('click', claim);
    if (g('clubOnline')) g('clubOnline').addEventListener('click', () => { save().noOnline = false; X.persist(); window.Social.dirty(1500); render(); refresh(true); });
    // sin club
    if (g('cfName')) g('cfName').addEventListener('input', e => { form.name = e.target.value; const box = g('cfSum'); if (box) { box.innerHTML = sumHtml(); goWire(); } });
    if (g('cfDesc')) g('cfDesc').addEventListener('input', e => { form.desc = e.target.value; });
    if (g('cfQ')) { g('cfQ').addEventListener('input', e => { query = e.target.value; }); g('cfQ').addEventListener('keydown', e => { if (e.key === 'Enter') find(); }); }
    on('[data-ico]', 'click', b => { form.ico = b.dataset.ico; render(); });
    on('[data-col]', 'click', b => { form.c = +b.dataset.col; render(); });
    // ajustes (del formulario de creación o del club): tipo, máximo, nivel mínimo, idioma y país
    const tgt = () => (S.state.club && edit) ? edit : form;
    if (g('csDesc')) g('csDesc').addEventListener('input', e => { if (edit) edit.desc = e.target.value; });
    on('[data-ty]', 'click', b => { tgt().type = b.dataset.ty; render(); });
    on('[data-st]', 'click', b => { const o = tgt(), k = b.dataset.st, lo = k === 'max' ? Math.max(10, o.minMax || 0) : 0, hi = k === 'max' ? 50 : 100;
      o[k] = Math.max(lo, Math.min(hi, o[k] + +b.dataset.d)); if (k === 'max' && o[k] % 5) o[k] = Math.min(hi, Math.ceil(o[k] / 5) * 5); render(); });
    L.querySelectorAll('[data-sel]').forEach(el => el.addEventListener('change', () => { tgt()[el.dataset.sel] = el.value; render(); }));
    if (g('cfFind')) g('cfFind').addEventListener('click', find);
    const goWire = () => { if (g('cfGo')) g('cfGo').addEventListener('click', () => { confirmOn = true; render(); }); };
    goWire();
    if (g('cfNo')) g('cfNo').addEventListener('click', () => { confirmOn = false; render(); });
    if (g('cfBox')) g('cfBox').addEventListener('click', e => { if (e.target.id === 'cfBox') { confirmOn = false; render(); } });
    if (g('cfPay')) g('cfPay').addEventListener('click', () => { confirmOn = false; create(); });
    if (g('clubRanks')) g('clubRanks').addEventListener('click', () => { ranksOn = !ranksOn; render(); });
    if (g('cfReqCheck')) g('cfReqCheck').addEventListener('click', checkReq);
    on('[data-join]', 'click', b => join(b.dataset.join));
    // dentro del club
    on('.klmem[data-m]', 'click', el => { sel = sel === el.dataset.m ? null : el.dataset.m; render(); });
    on('[data-role]', 'click', b => { sel = null; run(() => S.role(b.dataset.u, b.dataset.role), 'Ahora es ' + RNAME[b.dataset.role].toLowerCase()); });
    on('[data-kick]', 'click', b => { if (b.dataset.armed) { sel = null; run(() => S.kick(b.dataset.kick), 'Expulsado del club'); } else { b.dataset.armed = 1; b.textContent = '¿Seguro?'; } });
    on('[data-lead]', 'click', b => { if (b.dataset.armed) { sel = null; run(() => S.transfer(b.dataset.lead), 'Nuevo líder del club'); } else { b.dataset.armed = 1; b.textContent = '¿Seguro?'; } });
    on('[data-acc]', 'click', b => run(() => S.accept(b.dataset.acc), '¡Nuevo miembro!'));
    on('[data-rej]', 'click', b => run(() => S.reject(b.dataset.rej)));
    if (g('csSave')) g('csSave').addEventListener('click', () => { const o = edit; if (!o) return; o.desc = g('csDesc').value; run(() => S.settings(payload(o)), 'Ajustes guardados').then(() => { edit = null; render(); }); });
    if (g('clubInvite')) g('clubInvite').addEventListener('click', invite);
    if (g('clubLeave')) g('clubLeave').addEventListener('click', () => {
      if (leaveArm < Date.now()) { leaveArm = Date.now() + 3000; render(); setTimeout(render, 3100); return; }
      leaveArm = 0; run(() => S.leave(), 'Has salido del club').then(() => { tab = 'club'; ntab = 'find'; found = null; render(); find(); });
    });
    on('[data-sheet]', 'click', b => { const m = S.state.members.find(x => x._id === b.dataset.sheet); if (m) SO.sheet({ kind: 'player', id: m._id, name: m.name, avatar: m.avatar, done: render }); });
    on('[data-club]', 'click', (el, e) => {
      if (e.target.closest('button')) return;
      const id = el.dataset.club, c = (found || []).concat(league.list || []).find(x => x._id === id);
      if (c) SO.sheet({ kind: 'club', id, name: c.name, avatar: (c.badge && c.badge.ico) || '🛡️', done: render });
    });
    on('[data-ex]', 'click', b => play(40000 + +b.dataset.ex));
    on('[data-lg]', 'click', b => play(41000 + +b.dataset.lg));
    if (g('clubAttack')) g('clubAttack').addEventListener('click', () => play(42001));
  }
  async function find() {
    found = null; render();
    try { found = await S.search(query); setMsg(''); } catch (e) { found = []; setMsg(errMsg(e)); }
    render();
  }
  async function create() {
    const s = save(), name = (form.name || '').trim();
    if ((s.coins || 0) < CREATE_COST) { X.toast('No tienes monedas suficientes'); return; }
    if ((s.gems || 0) < CREATE_GEMS) { X.toast('No tienes gemas suficientes'); return; }
    if (name.length < 3) { setMsg('El nombre necesita al menos 3 letras'); return; }
    const r = await run(() => S.create(Object.assign({ name }, payload(Object.assign({}, form, { badge: { ico: form.ico, c: form.c } })))));
    if (r) { s.coins -= CREATE_COST; s.gems = (s.gems || 0) - CREATE_GEMS; X.persist(); X.setCoins(); X.Audio.win && X.Audio.win(); X.toast('¡Club creado!'); tab = 'club'; render(); }
  }
  async function join(cid) {
    const r = await run(() => S.join(cid));
    if (r === 'REQUESTED') X.toast('Solicitud enviada');
    else if (r) { X.Audio.win && X.Audio.win(); X.toast('¡Bienvenido al club!'); tab = 'club'; refresh(true); }
    render();
  }
  async function checkReq() {
    const s = save(); if (!s.clubReq) return;
    // si ya te han aceptado, tu ficha de miembro existe
    s.club = { cid: s.clubReq.cid, name: s.clubReq.name, role: 'member' };
    try { await S.load(true); s.clubReq = null; X.persist(); X.toast('¡Te han aceptado!'); tab = 'club'; }
    catch (e) { s.club = null; X.persist(); X.toast(e && e.code === 'KICKED' ? 'Todavía no te han aceptado' : errMsg(e)); }
    render();
  }
  function invite() {
    const c = S.state.club; if (!c) return;
    const text = (window.I18N ? I18N.t : t => t)('¡Únete a mi club de Rocket Rush!') + ' «' + c.name + '» · ' + X.myCode();
    try {
      if (window.ChromaAndroid && window.ChromaAndroid.share) window.ChromaAndroid.share(text);
      else if (navigator.share) navigator.share({ title: 'Rocket Rush', text }).catch(() => {});
      else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => X.toast('Mensaje copiado: pégalo donde quieras'));
    } catch (e) { /* sin compartir */ }
  }

  // ---------------- partidas ----------------
  function play(id) {
    ensureLevels();
    const L = Lv.byId(id); if (!L) return;
    if (L.club === 'boss') {
      const p = P(); if (p.atkN >= ATTACKS) { X.toast('Ya has usado tus 3 ataques de hoy'); return; }
    }
    X.openPre(id);
  }
  // al empezar un ataque al jefe se gasta el ataque (así salir a mitad no da ataques gratis)
  function onStart(L) { if (L.club === 'boss') { const p = P(); p.atkN++; X.persist(); } }
  // al acabar: estrellas a la expedición o a la liga; daño al jefe
  function onEnd(L, o) {
    const p = P();
    let txt = '';
    if (L.club === 'ex' && o.win) { p.ex[L.pos] = Math.max(p.ex[L.pos] || 0, o.stars || 1); txt = '+' + o.stars + ' ⭐ para el club'; }
    if (L.club === 'lg' && o.win && S.time().lg) { p.lgS[L.pos] = Math.max(p.lgS[L.pos] || 0, o.stars || 1); txt = '+' + o.stars + ' ⭐ para la liga del club'; }
    if (L.club === 'boss') {
      const hpLeft = window.Bosses && window.Bosses.hp ? Math.max(0, Math.min(1, window.Bosses.hp())) : (o.win ? 0 : 1);
      const d = Math.round((o.win ? 1 : 1 - hpLeft) * 8000 + (o.win ? 4000 + (o.stars || 1) * 1000 : 0));
      p.dmg += d; txt = '💥 ' + fmt(d) + ' de daño al jefe colosal';
      o.dmg = d;
    }
    X.persist(); league.at = 0;
    S.report({ ex: sum(p.ex), exN: nDone(p.ex), dmg: p.dmg, atkN: p.atkN, lgS: sum(p.lgS) }).catch(() => { /* se subirá la próxima vez */ });
    return txt;
  }
  // siguiente nivel del club (para el botón SIGUIENTE)
  function next(L) {
    if (L.club === 'ex' && L.pos < 50 && exOpen(L.pos + 1)) return 40000 + L.pos + 1;
    if (L.club === 'lg' && L.pos < 10 && lgOpen(L.pos + 1)) return 41000 + L.pos + 1;
    return 0;
  }
  function back(L) { tab = L && L.club ? ({ ex: 'ex', lg: 'lg', boss: 'boss' })[L.club] : tab; open(); }

  window.Club = { open, render, refresh, onStart, onEnd, next, back, levels: ensureLevels, time: () => S.time(), _P: P, get tab() { return tab; }, get inClub() { return !!(S.id && S.state.club && S.state.cid === S.id); } };
  const goBack = () => { if (from === 'title') X.goTitle(); else X.goMap(); };
  window.Club.goBack = goBack;
  const bk = $('clubBack'); if (bk) bk.addEventListener('click', () => { X.Audio.click && X.Audio.click(); goBack(); });
  const sy = $('clubSync'); if (sy) sy.addEventListener('click', () => { X.Audio.click && X.Audio.click(); found = null; if (!S.id) find(); else refresh(true); });
  // la liga empieza sola: al abrir la app (y cada media hora) un miembro mete a su club en un grupo con 4 rivales al azar,
  // aunque nadie abra la pantalla del club
  function autoGroup() {
    try {
      const ct = S.time(); if (!S.id || !ct.lg || (league.id === ct.lg && league.gid)) return;
      loadGroup(ct).then(() => { snap(); if ($('club') && $('club').classList.contains('on')) render(); }).catch(() => { /* lo intentará más tarde */ });
    } catch (e) { /* sin conexión */ }
  }
  if (!(window.RRGame && window.RRGame.testBuild && navigator.webdriver)) { setTimeout(autoGroup, 9000); setInterval(autoGroup, 30 * 60e3); }
  window.Club.autoGroup = autoGroup;
  // al abrir sin club, se busca directamente
  const _open = open;
  window.Club.open = (t, f) => { _open(t, f); if (!S.id && found == null) find(); };
})();
