// Rocket Rush — motivos para volver: cofre gratis cada 4 horas, regalo de bienvenida, mini-eventos de 3 días,
// logros con premios únicos y desafío de la semana. (Los regalos entre amigos están en social.js y las estelas en cannons.js.)
// Se engancha al juego con window.Retencion (game3d.js lo llama en la portada, al ganar, al perder y al volver del desafío).
(function () {
  'use strict';
  const X = window.RRGame; if (!X) return;
  const $ = id => document.getElementById(id);
  const T = s => (window.I18N ? I18N.t(s) : s);
  const S = () => X.save, st = () => X.stats();
  const fmt = n => (+n || 0).toLocaleString('es-ES');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const NA = () => window.ChromaAndroid;
  const notifOn = () => (S().daily || {}).notif !== false;
  const click = () => { X.Audio.init && X.Audio.init(); X.Audio.click && X.Audio.click(); };

  // ---------------- ventana propia (encima de todo, con «atrás» de Android) ----------------
  const pop = document.createElement('div');
  pop.className = 'screen dim retpop'; pop.id = 'retPop';
  pop.innerHTML = '<div class="panel"><div class="ribbon" id="rpRib"></div><div id="rpBody"></div></div>';
  document.body.appendChild(pop);
  let popClose = null;
  function popOpen(rib, cls, html, onClose) {
    $('rpRib').className = 'ribbon ' + (cls || ''); $('rpRib').textContent = rib;
    $('rpBody').innerHTML = html; popClose = onClose || null;
    pop.classList.add('on');
    return $('rpBody');
  }
  function popHide() { pop.classList.remove('on'); const f = popClose; popClose = null; if (f) f(); }
  const prevBack = window.ChromaBack;
  window.ChromaBack = () => { if (pop.classList.contains('on')) { popHide(); return true; } return prevBack ? prevBack() : false; };
  const chip = (h) => `<span class="rchip">${h}</span>`;
  function rewardChips(r) {
    const o = [];
    if (r.coins) o.push(chip(`<i class="coin"></i>${fmt(r.coins)}`));
    if (r.gems) o.push(chip(`<i class="gem"></i>${r.gems}`));
    if (r.bomb) o.push(chip(`<i class="ball bBomb"></i>×${r.bomb}`));
    if (r.rainbow) o.push(chip(`<i class="ball bRainbow"></i>×${r.rainbow}`));
    if (r.extra) o.push(chip(`<i class="ball bPlus2"></i>×${r.extra}`));
    if (r.golden) o.push(chip(`<i class="ball bGolden"></i>×${r.golden}`));
    if (r.skin) { const d = Cannons.SKIN[r.skin]; o.push(chip(`<i class="skinsw" style="background:${d.css}"></i>${esc(d.name)}`)); }
    if (r.bskin) o.push(chip(`<i class="bskinsw"></i>${T('Bolas')} ${esc(Cannons.BALL[r.bskin].name)}`));
    if (r.trail) o.push(chip(`<i class="trailsw" style="--tr:${Cannons.TRAIL[r.trail].css}"></i>${T('Estela')} ${esc(Cannons.TRAIL[r.trail].name)}`));
    if (r.x2) o.push(chip(`🪙 ×2 ${T('monedas')} · 24 h`));
    return o.join('');
  }
  // da un premio; si lleva cofre, se abre con la animación de los cofres
  function give(r, tier, then) {
    const g = Object.assign({}, r); delete g.x2;
    X.grant(g); X.persist(); X.setCoins();
    if (tier) X.openChestFX(tier, g, () => { if (then) then(); });
    else { X.Audio.win && X.Audio.win(); if (then) then(); }
  }

  // =====================================================================
  // 1 · COFRE GRATIS CADA 4 HORAS (botón en la portada y aviso en el móvil)
  // =====================================================================
  const FREE_MS = 4 * 3600e3;
  function fc() { if (!S().freeChest) S().freeChest = { at: 0, n: 0 }; return S().freeChest; }
  const fcReady = () => Date.now() >= fc().at;
  function fcReward() {
    const r = { coins: Math.round(rnd(80, 200) / 10) * 10 }, q = Math.random();
    if (q < 0.3) r.bomb = 1; else if (q < 0.55) r.rainbow = 1; else if (q < 0.7) r.extra = 1;
    if (Math.random() < 0.12) r.gems = 2 + Math.floor(Math.random() * 4);
    if (Math.random() < 0.03) r.golden = 1;
    return r;
  }
  function fcOpen() {
    click();
    if (!fcReady()) { X.toast(T('El cofre gratis estará listo en {x}').replace('{x}', X.leftTxt(fc().at - Date.now())), 2400); return; }
    const r = fcReward();
    fc().at = Date.now() + FREE_MS; fc().n++; st().freeChests = (st().freeChests || 0) + 1;
    give(r, r.gems || r.golden ? 'silver' : 'wood', () => { fcUi(); achToast(); });
    fcUi(); fcNotify();
  }
  function fcNotify() {
    const a = NA(); if (!a || !a.scheduleNotice) return;
    try {
      if (!notifOn() || fcReady()) { if (a.cancelNotice) a.cancelNotice('cofre'); return; }
      a.scheduleNotice('cofre', String(fc().at), T('¡Tu cofre gratis está listo!'), T('Entra y ábrelo: dentro hay monedas y a veces gemas.'));
    } catch (e) { /* sin avisos */ }
  }
  // ---------------- avisos del móvil (25-11) ----------------
  // Además de la racha (game3d) y el cofre gratis: eventos, desafío y tienda de los lunes, club, pase y «te echamos de menos».
  // Cada aviso tiene su hueco y se reprograma cada vez que se abre el juego; si ya pasó la hora, no se programa.
  const NOTICES = ['evento', 'eventofin', 'desafio', 'tienda', 'club', 'pase', 'vuelve', 'mini'];
  function atHour(t, h) { const d = new Date(t); d.setHours(h, 0, 0, 0); return d.getTime(); }
  function nextMonday(h) { const d = new Date(); d.setHours(h, 0, 0, 0); const add = (8 - d.getDay()) % 7 || 7; d.setDate(d.getDate() + add); return d.getTime(); }
  function plan() {
    const now = Date.now(), I = X.noticeInfo ? X.noticeInfo() : {}, out = {};
    const put = (k, at, title, text, raw) => { if (at > now + 60e3) out[k] = { at, title: raw ? title : T(title), text: raw ? text : T(text) }; };
    // eventos de temporada: aviso al empezar y 2 días antes de acabar
    if (I.xmStart && I.xmEnd) { put('evento', atHour(I.xmStart, 11), '🎄 ¡Ha empezado la Navidad!', 'Mundo navideño, caramelos y tienda de Navidad. ¡Entra a verlo!'); put('eventofin', atHour(I.xmEnd - 2 * 864e5, 18), '🎄 Quedan 2 días de Navidad', 'Gasta tus caramelos navideños antes de que se acabe el evento.'); }
    if (!out.evento && I.hwStart && I.hwEnd) { put('evento', atHour(I.hwStart, 11), '🎃 ¡Ha empezado Halloween!', 'Castillo encantado, caramelos y tienda de miedo. ¡Entra a verlo!'); }
    if (!out.eventofin && I.hwEnd) put('eventofin', atHour(I.hwEnd - 2 * 864e5, 18), '🎃 Quedan 2 días de Halloween', 'Gasta tus caramelos antes de que se acabe el evento.');
    // lunes: desafío nuevo por la mañana y tienda nueva por la tarde
    put('desafio', nextMonday(10), '🏆 Nuevo desafío de la semana', 'Ya tienes el desafío nuevo: 3 intentos para llevarte el premio.');
    put('tienda', nextMonday(19), '✨ Nuevos legendarios en la tienda', 'Han llegado los cañones y la bola de esta semana, y una oferta nueva.');
    // club: la liga acaba el lunes; la expedición, el domingo por la noche
    const cid = S().club && S().club.cid, C = window.Social && window.Social.club;
    if (cid && C && C.time) { const ct = C.time(); const lgEnd = ct.lgEnd || (ct.lgStart > now ? ct.lgStart + 4 * 864e5 : 0);
      if (lgEnd) put('club', atHour(lgEnd - 864e5 - 1, 18), '🛡️ La liga de tu club acaba mañana', 'Juega tus niveles de liga y ayuda a tu club a ganar.');
      if (!out.club) put('club', ct.weekEnd - 6 * 36e5, '🏔️ La expedición termina esta noche', 'Últimas horas para completar la expedición con tu club.'); }
    // pase de temporada: 3 días antes de acabar
    if (I.passEnd) put('pase', atHour(I.passEnd - 3 * 864e5, 18), '🎟️ Tu temporada acaba en 3 días', I.passPending ? 'Tienes premios del pase sin recoger.' : 'Sube unos niveles más del pase antes de que se acabe.');
    // 3 días sin jugar
    put('vuelve', atHour(now + 3 * 864e5, 18), '😢 ¡Te echamos de menos!', 'Vuelve y llévate un regalo de bienvenida.');
    // mini-evento del mes
    const md = miniDefault(now), mn = md && md.start > now ? md : miniDefault(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).getTime());
    const lc = X.liveCfg && X.liveCfg().mini;
    const sameDay = (a, b) => a && b && new Date(a).toDateString() === new Date(b).toDateString();
    if (mn && !(lc && lc.on === false) && MINI[mn.theme]) put('mini', atHour(mn.start, 11) + (out.evento && sameDay(out.evento.at, mn.start) ? 864e5 : 0),   // no el mismo día que el evento grande
      MINI[mn.theme].ico + ' ' + T('¡Empieza la {x}!').replace('{x}', T(MINI[mn.theme].name)), T('Solo este fin de semana: consigue {x} y cámbialas en la tienda.').replace('{x}', T(MINI[mn.theme].many)), true);
    return out;
  }
  function noticesSync() {
    const a = NA(); if (!a || !a.scheduleNotice) return;
    try {
      const p = notifOn() ? plan() : {};
      for (const k of NOTICES) { if (p[k]) a.scheduleNotice(k, String(p[k].at), p[k].title, p[k].text); else if (a.cancelNotice) a.cancelNotice(k); }
    } catch (e) { /* sin avisos */ }
  }
  function fcUi() {
    let b = $('freeChest');
    if (!b) {
      const col = document.querySelector('#title .tside.left'); if (!col) return;
      b = document.createElement('button'); b.id = 'freeChest'; b.className = 'sb freechest'; b.setAttribute('aria-label', T('Cofre gratis'));
      col.appendChild(b); b.addEventListener('click', fcOpen);
    }
    const ok = fcReady();
    b.classList.toggle('ready', ok);
    b.innerHTML = `<i class="chest ${ok ? 'gold' : 'wood'}"><i></i></i>` + (ok ? `<b>${T('¡GRATIS!')}</b><i class="bdg">1</i>` : `<b class="fct">${X.leftTxt(fc().at - Date.now())}</b>`);
  }

  // =====================================================================
  // 6 · REGALO DE BIENVENIDA (3 días o más sin jugar) y MINI-EVENTOS de 3 días
  // =====================================================================
  let pendingWelcome = 0;
  function seen() {
    const now = Date.now(), last = S().lastSeen || 0;
    if (last && now - last >= 3 * 864e5 && (S().played || 0) > 0) pendingWelcome = Math.floor((now - last) / 864e5);
    S().lastSeen = now; X.persist();
  }
  const titleFree = () => $('title') && $('title').classList.contains('on') && !document.querySelector('.screen.dim.on') && !($('chestOpen') && $('chestOpen').classList.contains('on'))
    && !($('langPick') && !$('langPick').hidden) && !($('ageGate') && !$('ageGate').hidden) && !($('welcome') && !$('welcome').hidden) && !($('tut') && $('tut').classList.contains('on'));
  function welcomeTry() {
    if (!pendingWelcome || !titleFree()) return;
    const days = pendingWelcome; pendingWelcome = 0;
    const r = { coins: 1000, gems: 10, x2: true }, m = miniNow();
    popOpen(T('¡HAS VUELTO!'), 'green', `<p class="rptxt">${T('Te echábamos de menos. Llevabas {x} días sin jugar: aquí tienes un regalo.').replace('{x}', days)}</p>
      <div class="rchips">${rewardChips(r)}</div>${m ? miniBanner(m) : ''}
      <div class="row"><button class="btn green" id="rpOk">${T('¡RECOGER!')}</button></div>`);
    $('rpOk').addEventListener('click', () => {
      click(); popHide();
      S().boost2 = Date.now() + 864e5;
      give(r); X.liveUi(); X.toast(T('¡Monedas ×2 durante 24 horas!'), 2600);
    });
  }
  // --- mini-eventos: el último fin de semana de cada mes (de viernes a domingo), menos octubre y diciembre, que ya
  // tienen Halloween y Navidad. Se ganan fichas al superar niveles y se cambian en la tienda (cañón exclusivo y más).
  // El panel puede encenderlo, apagarlo o cambiar fechas y tema (live.mini = { on, start, end, theme }).
  const MINI = {
    otono: { name: 'Fiesta de Otoño', ico: '🍂', tok: '🌰', one: 'bellota', many: 'bellotas', skin: 'castana', c: ['#e8902a', '#a8380f'] },
    invierno: { name: 'Fiesta de la Nieve', ico: '⛄', tok: '❄️', one: 'copo', many: 'copos', skin: 'copo', c: ['#8fd0ff', '#2a5fd6'] },
    primavera: { name: 'Fiesta de Primavera', ico: '🌸', tok: '🌷', one: 'flor', many: 'flores', skin: 'cerezo', c: ['#ff9ad5', '#c8407a'] },
    verano: { name: 'Fiesta de Verano', ico: '☀️', tok: '🐚', one: 'concha', many: 'conchas', skin: 'surf', c: ['#ffd23f', '#ff7a1a'] },
  };
  const MONTH_THEME = { 0: 'invierno', 1: 'invierno', 2: 'primavera', 3: 'primavera', 4: 'primavera', 5: 'verano', 6: 'verano', 7: 'verano', 8: 'otono', 10: 'otono' };
  function miniDefault(t) {
    const d = new Date(t), y = d.getFullYear(), mo = d.getMonth(), theme = MONTH_THEME[mo];
    if (!theme) return null;
    const lastDay = new Date(y, mo + 1, 0), sun = new Date(y, mo, lastDay.getDate() - lastDay.getDay());   // último domingo del mes
    const start = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() - 2).getTime(), end = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() + 1).getTime();
    return { theme, start, end, id: y + '-' + (mo + 1) };
  }
  function miniNow() {
    const t = Date.now(), lc = X.liveCfg().mini;
    if (lc && lc.on === false) return null;
    if (lc && lc.on && lc.start && lc.end && MINI[lc.theme]) return t >= lc.start && t < lc.end ? { theme: lc.theme, start: +lc.start, end: +lc.end, id: 'p' + lc.start } : null;
    const m = miniDefault(t);
    return m && t >= m.start && t < m.end ? m : null;
  }
  function miniState(m) {
    if (!S().mini || S().mini.id !== m.id) { S().mini = { id: m.id, tok: 0 }; X.persist(); }
    return S().mini;
  }
  const miniBanner = m => { const M = MINI[m.theme]; return `<div class="rpban" style="background:linear-gradient(135deg,${M.c[0]},${M.c[1]})"><b>${M.ico} ${T(M.name)} · ${T('3 días')}</b><small>${T('Supera niveles para conseguir {x} y cámbialos en la tienda por el {y}').replace('{x}', M.tok + ' ' + T(M.many)).replace('{y}', esc(Cannons.SKIN[M.skin].name))} · ${T('quedan')} ${X.leftTxt(m.end - Date.now())}</small></div>`; };
  const MINI_SHOP = [
    { id: 'skin', cost: 40 },
    { id: 'gems', cost: 10, r: { gems: 5 } },
    { id: 'chest', cost: 15, r: { coins: 500, bomb: 1, rainbow: 1 }, tier: 'silver' },
    { id: 'bombs', cost: 8, r: { bomb: 2 } },
    { id: 'golden', cost: 25, r: { golden: 1 } },
  ];
  function miniShopHtml() {
    const m = miniNow(); if (!m) return '';
    const M = MINI[m.theme], s = miniState(m), sk = Cannons.SKIN[M.skin], has = S().skins.owned.includes(M.skin);
    const row = it => {
      const r = it.id === 'skin' ? { skin: M.skin } : it.r, done = it.id === 'skin' && has;
      return `<div class="minirow"><div class="mrw">${rewardChips(r)}</div>${done ? `<span class="chow">${T('Ya es tuyo')}</span>` : `<button class="btn ${s.tok >= it.cost ? 'gold' : 'gray'}" data-mini="${it.id}">${M.tok} ${it.cost}</button>`}</div>`;
    };
    return `<div class="tmphead minihead" id="sMini" style="background:linear-gradient(135deg,${M.c[0]},${M.c[1]})"><b>${M.ico} ${T(M.name)}</b><small>${T('Cambia tus fichas')} · ${T('tienes')} <b class="miniTok">${M.tok} ${s.tok}</b> · ${T('quedan')} ${X.leftTxt(m.end - Date.now())}</small></div>
      <div class="cgrid mini1"><div class="cosc r-event"><i class="crar">${T('EXCLUSIVO')}</i><div class="cth" data-th="skin:${M.skin}" style="--ph:${sk.css}"></div><b>${esc(sk.name)}</b>${has ? '<button class="btn gray" disabled>✓</button>' : `<button class="btn ${s.tok >= 40 ? 'gold' : 'gray'}" data-mini="skin">${M.tok} 40</button>`}</div></div>
      ${MINI_SHOP.slice(1).map(row).join('')}`;
  }
  function miniBuy(id) {
    const m = miniNow(); if (!m) return;
    const M = MINI[m.theme], s = miniState(m), it = MINI_SHOP.find(x => x.id === id); if (!it) return;
    if (s.tok < it.cost) { X.toast(T('Te faltan {x}').replace('{x}', (it.cost - s.tok) + ' ' + M.tok), 2200); return; }
    if (it.id === 'skin' && S().skins.owned.includes(M.skin)) return;
    s.tok -= it.cost;
    if (it.id === 'skin') { give({ skin: M.skin }); X.toast('¡' + Cannons.SKIN[M.skin].name + ' ' + T('es tuyo') + '!', 2400); }
    else give(it.r, it.tier);
    X.openShop('mini');
  }
  function miniUi() {
    const m = miniNow();
    let b = $('miniPump');
    if (!m) { if (b) b.hidden = true; return; }
    const M = MINI[m.theme];
    if (!b) {
      b = document.createElement('button'); b.id = 'miniPump'; b.className = 'hwpump minipump';
      $('title').appendChild(b); b.addEventListener('click', () => { click(); X.openShop('mini'); });
    }
    b.hidden = !!($('hwPump') && !$('hwPump').hidden) || !!($('xmTree') && !$('xmTree').hidden);
    b.innerHTML = `<div class="mpi">${M.ico}</div><span class="hwcd">⏳ ${X.leftTxt(m.end - Date.now())}</span><b>${T(M.name).toUpperCase()}</b>`;
  }

  // =====================================================================
  // 2 · LOGROS (3 niveles cada uno; algunos dan cosas que no se pueden comprar)
  // =====================================================================
  const cnt = f => X.countLv(f);
  const ACH = [
    { id: 'blocks', ico: '🧱', name: 'Demoledor', txt: 'Derriba {n} bloques', v: () => st().blocks || 0, t: [1000, 5000, 10000], r: [{ coins: 300 }, { gems: 10 }, { skin: 'oro', gems: 20 }] },
    { id: 'bosses', ico: '👑', name: 'Cazajefes', txt: 'Vence {n} jefes', v: () => cnt((L, n) => L.boss && n > 0), t: [5, 15, 30], r: [{ coins: 300 }, { gems: 15 }, { chest: 'gold' }] },
    { id: 'perfect', ico: '⭐', name: 'Perfeccionista', txt: '{n} niveles con 3 estrellas', v: () => cnt((L, n) => n >= 3), t: [25, 100, 250], r: [{ coins: 400 }, { gems: 15 }, { trail: 'dorada', gems: 20 }] },
    { id: 'stars', ico: '🌟', name: 'Coleccionista de estrellas', txt: 'Consigue {n} estrellas', v: () => X.starsTotal(), t: [100, 400, 1000], r: [{ coins: 300 }, { gems: 10 }, { chest: 'crystal' }] },
    { id: 'level', ico: '🗺️', name: 'Explorador', txt: 'Llega al nivel {n}', v: () => Math.max(0, (S().unlocked || 1) - 1), t: [50, 200, 500], r: [{ coins: 300 }, { gems: 15 }, { chest: 'crystal' }] },
    { id: 'wins', ico: '🏆', name: 'Ganador', txt: 'Gana {n} partidas', v: () => st().wins || 0, t: [50, 250, 1000], r: [{ coins: 300 }, { gems: 10 }, { chest: 'gold' }] },
    { id: 'shot', ico: '🎯', name: 'Francotirador', txt: 'Derriba {n} bloques de un tiro', v: () => st().bestShot || 0, t: [8, 12, 15], r: [{ coins: 200 }, { gems: 10 }, { bskin: 'trofeo', gems: 10 }] },
    { id: 'daily', ico: '🔥', name: 'Constante', txt: 'Racha diaria de {n} días', v: () => Math.max((S().daily || {}).best || 0, (S().daily || {}).n || 0), t: [7, 14, 30], r: [{ coins: 300 }, { gems: 10 }, { chest: 'gold' }] },
    { id: 'wballs', ico: '🔮', name: 'Bolas especiales', txt: 'Usa {n} bolas de los mundos', v: () => st().wballs || 0, t: [10, 50, 150], r: [{ coins: 200 }, { coins: 600 }, { gems: 15 }] },
    { id: 'friends', ico: '👥', name: 'Sociable', txt: 'Ten {n} amigos', v: () => (S().friends || []).length, t: [1, 5, 10], r: [{ coins: 200 }, { gems: 10 }, { gems: 20 }] },
    { id: 'gifts', ico: '🎁', name: 'Generoso', txt: 'Envía {n} regalos a amigos', v: () => st().giftsSent || 0, t: [5, 25, 100], r: [{ coins: 200 }, { coins: 600 }, { gems: 15 }] },
    { id: 'skins', ico: '🎨', name: 'Fashionista', txt: 'Ten {n} aspectos de cañón', v: () => Math.max(0, S().skins.owned.length - 1), t: [2, 6, 12], r: [{ coins: 300 }, { gems: 10 }, { gems: 25 }] },
    { id: 'balls', ico: '⚽', name: 'Bolas con estilo', txt: 'Ten {n} aspectos de bola', v: () => Math.max(0, X.cosApi.bSave().own.length - 1), t: [1, 4, 8], r: [{ coins: 200 }, { gems: 10 }, { gems: 20 }] },
    { id: 'trails', ico: '✨', name: 'Rastro brillante', txt: 'Ten {n} estelas', v: () => Math.max(0, X.cosApi.tSave().own.length - 1), t: [1, 3, 6], r: [{ coins: 200 }, { gems: 10 }, { gems: 20 }] },
    { id: 'upgrade', ico: '🔧', name: 'Mecánico', txt: 'Mejora el cañón al nivel {n}', v: () => X.cosApi.canSave().lv, t: [3, 5], r: [{ coins: 500 }, { gems: 20 }] },
    { id: 'weekly', ico: '⚔️', name: 'Retador', txt: 'Juega {n} veces el desafío de la semana', v: () => st().weeklyPlays || 0, t: [1, 10, 30], r: [{ coins: 200 }, { gems: 10 }, { gems: 20 }] },
    { id: 'free', ico: '📦', name: 'Madrugador', txt: 'Abre {n} cofres gratis', v: () => st().freeChests || 0, t: [5, 25, 100], r: [{ coins: 200 }, { coins: 600 }, { gems: 15 }] },
    { id: 'club', ico: '🛡️', name: 'En equipo', txt: 'Únete a un club', v: () => (S().club && S().club.cid ? 1 : 0) || st().clubJoined || 0, t: [1], r: [{ gems: 10 }] },
  ];
  const CHEST = { gold: { coins: 800, gems: 8, bomb: 2, rainbow: 2 }, crystal: { coins: 1500, gems: 15, bomb: 3, rainbow: 3, golden: 1 } };
  const ROMAN = ['I', 'II', 'III'];
  function achS() { if (!S().ach || typeof S().ach !== 'object') S().ach = { got: {}, seen: {} }; return S().ach; }
  const achTier = a => achS().got[a.id] || 0;                                  // niveles ya cobrados
  const achReady = a => achTier(a) < a.t.length && a.v() >= a.t[achTier(a)];
  const achCount = () => ACH.filter(achReady).length;
  const achDone = () => ACH.reduce((n, a) => n + achTier(a), 0), achAll = ACH.reduce((n, a) => n + a.t.length, 0);
  function achToast() {
    const s = achS();
    for (const a of ACH) {
      const k = achTier(a); if (!achReady(a)) continue;
      const key = a.id + ':' + k; if (s.seen[key]) continue;
      s.seen[key] = 1; X.persist();
      setTimeout(() => { X.toast('🏆 ' + T('¡Logro conseguido!') + ' ' + T(a.name) + ' ' + ROMAN[k], 3000); X.Audio.special && X.Audio.special(); }, 900);
      break;
    }
    if (X.updateTitle) X.updateTitle();
    achBtn();
  }
  function achRow(a) {
    const k = achTier(a), done = k >= a.t.length, n = done ? a.t[a.t.length - 1] : a.t[k], v = a.v(), ready = !done && v >= n;
    const rw = done ? '' : a.r[k].chest ? chip(`<i class="chest ${a.r[k].chest}" style="margin:0;transform:scale(.55)"><i></i></i>${T(a.r[k].chest === 'gold' ? 'Cofre de oro' : 'Cofre de cristal')}`) : rewardChips(a.r[k]);
    return `<div class="achrow${ready ? ' ready' : ''}${done ? ' done' : ''}"><div class="aic">${a.ico}</div><div class="abd"><b>${T(a.name)} ${ROMAN[Math.min(k, a.t.length - 1)]}</b>
      <small>${T(a.txt).replace('{n}', fmt(n))}${done ? ' · ' + T('completado') : ' · ' + fmt(Math.min(v, n)) + '/' + fmt(n)}</small>
      ${done ? '' : `<div class="abar"><i style="width:${Math.min(100, Math.round(100 * v / n))}%"></i></div><div class="arw">${rw}</div>`}</div>
      ${ready ? `<button class="btn green small" data-ach="${a.id}">${T('COBRAR')}</button>` : done ? '<span class="adone">✅</span>' : ''}</div>`;
  }
  function achOpen() {
    const list = ACH.slice().sort((x, y) => (achReady(y) - achReady(x)) || ((achTier(x) >= x.t.length) - (achTier(y) >= y.t.length)));
    const b = popOpen(T('LOGROS'), 'purple', `<div class="rpsub">${T('{x} de {y} completados').replace('{x}', achDone()).replace('{y}', achAll)} · ${T('algunos premios no se pueden comprar')}</div>
      <div class="achlist">${list.map(achRow).join('')}</div><button class="btn gray" id="rpX">${T('CERRAR')}</button>`, () => { achBtn(); if (X.updateTitle) X.updateTitle(); });
    $('rpX').addEventListener('click', () => { click(); popHide(); });
    b.querySelectorAll('[data-ach]').forEach(el => el.addEventListener('click', () => {
      const a = ACH.find(q => q.id === el.dataset.ach); if (!a || !achReady(a)) return;
      click(); const k = achTier(a), r = a.r[k];
      achS().got[a.id] = k + 1; X.persist();
      const sc = b.querySelector('.achlist').scrollTop;
      if (r.chest) { popHide(); give(CHEST[r.chest], r.chest, () => achOpen()); }
      else { give(r); X.toast(T('¡Logro cobrado!') + ' ' + T(a.name) + ' ' + ROMAN[k], 2400); achOpen(); const l = pop.querySelector('.achlist'); if (l) l.scrollTop = sc; }
    }));
  }
  function achBtn() {
    let b = $('btnAch');
    if (!b) {
      const ph = document.querySelector('#missions .passhead'); if (!ph) return;
      b = document.createElement('button'); b.id = 'btnAch'; b.className = 'btn gold small achbtn';
      ph.insertAdjacentElement('afterend', b); b.addEventListener('click', () => { click(); achOpen(); });
    }
    const n = achCount();
    b.innerHTML = `🏆 ${T('LOGROS')} <small>${achDone()}/${achAll}</small>${n ? `<i class="bdg">${n}</i>` : ''}`;
  }

  // =====================================================================
  // 3 · DESAFÍO DE LA SEMANA (nivel igual para todos, 3 intentos, clasificación y premios por puesto)
  // =====================================================================
  const WEEK0 = Date.UTC(2026, 9, 5), TRIES = 3;                                 // lunes 5 oct 2026 (UTC)
  const wkIdx = () => Math.floor((Date.now() - WEEK0) / (7 * 864e5));
  const wkEnd = i => WEEK0 + (i + 1) * 7 * 864e5;
  const WK_REW = [[1, { gems: 150 }], [10, { gems: 60 }], [100, { chest: 'gold' }], [Infinity, { coins: 300, gems: 3 }]];
  function wk() {
    const id = 'S' + wkIdx(); let w = S().wk;
    if (!w || w.id !== id) {
      if (w && w.best > 0) S().wkPrev = { id: w.id, best: w.best, sent: !!w.sent, paid: false };
      S().wk = w = { id, tries: 0, extra: 0, best: 0, sent: false };
      X.persist();
    }
    return w;
  }
  const wkLevel = () => window.Levels.byId(43001) && window.Levels.byId(43001).weekly === wk().id ? window.Levels.byId(43001) : window.Levels.weekly(wk().id);
  const triesLeft = () => { const w = wk(); return Math.max(0, TRIES + (w.extra || 0) - w.tries); };
  const rewardFor = rank => (WK_REW.find(([n]) => rank && rank <= n) || WK_REW[WK_REW.length - 1])[1];
  const online = () => !!(window.Social && window.Social.weekly && window.Social.weekly.online);
  function wkOpen() {
    const w = wk(), L = wkLevel(), left = triesLeft();
    const rw = WK_REW.map(([n, r], i) => chip((i === 0 ? '🥇 ' : i === 1 ? 'Top 10: ' : i === 2 ? 'Top 100: ' : T('Resto') + ': ') + (r.chest ? T('cofre de oro') : r.gems && !r.coins ? `${r.gems} <i class="gem"></i>` : `${fmt(r.coins)} <i class="coin"></i>`))).join('');
    const b = popOpen(T('DESAFÍO'), 'fire', `<div class="rpban" style="background:linear-gradient(135deg,#ff7a1a,#e8203a)"><b>⚔️ ${esc(T(L.name))}</b><small>${T('Igual para todos')} · ${T('{x} intentos').replace('{x}', TRIES)} · ${T('quedan')} ${X.leftTxt(wkEnd(wkIdx()) - Date.now())}</small></div>
      <div class="rchips">${rw}</div>
      <div class="wkme">${T('Tu mejor puntuación')}: <b>${fmt(w.best)}</b> · ${T('intentos')}: <b>${left}</b></div>
      <div class="wklb" id="wkLb"><div class="sempty">${online() ? T('Cargando clasificación…') : T('Sin conexión: tu puntuación cuenta solo para ti.')}</div></div>
      <div class="row"><button class="btn gray" style="flex:.45" id="rpX">✕</button>${left ? `<button class="btn green" id="wkGo">${T('¡A DEMOLER!')}</button>` : (w.extra || 0) < 1 ? `<button class="btn purple" id="wkAd">▶ ${T('+1 intento')}</button>` : `<button class="btn gray" disabled>${T('Sin intentos')}</button>`}</div>`);
    $('rpX').addEventListener('click', () => { click(); popHide(); });
    if ($('wkGo')) $('wkGo').addEventListener('click', () => { click(); popHide(); X.openPre(L.id); });
    if ($('wkAd')) $('wkAd').addEventListener('click', () => { click(); X.showRewarded(ok => { if (ok) { wk().extra = (wk().extra || 0) + 1; X.persist(); wkOpen(); } }); });
    if (online() && window.Social.hasAccount !== undefined) {
      window.Social.weekly.board(w.id, w.best).then(c => {
        const el = $('wkLb'); if (!el || !pop.classList.contains('on')) return;
        const me = window.Social.uid, rows = c.rows.slice(0, 5);
        el.innerHTML = (rows.length ? rows.map((r, i) => `<div class="wkrow${r._id === me ? ' me' : ''}"><span class="p">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><span class="a">${esc(r.avatar || '🙂')}</span><span class="n" translate="no">${esc(r.name || '?')}</span><span class="s">${fmt(r.score)}</span></div>`).join('') : `<div class="sempty">${T('Aún no ha jugado nadie: ¡sé el primero!')}</div>`)
          + (w.best && c.rank > 5 ? `<div class="wkrow me"><span class="p">${fmt(c.rank)}</span><span class="a">🦊</span><span class="n">${T('Tú')}</span><span class="s">${fmt(w.best)}</span></div>` : '');
      }).catch(() => { const el = $('wkLb'); if (el) el.innerHTML = `<div class="sempty">${T('No se ha podido cargar la clasificación.')}</div>`; });
    }
    navUi();
  }
  // resultado de la semana pasada: puesto y premio (una vez)
  function wkPrevCheck() {
    const p = S().wkPrev; if (!p || p.paid || !titleFree()) return;
    const pay = rank => {
      const r = rewardFor(rank);
      popOpen(T('DESAFÍO'), 'fire', `<p class="rptxt">${T('Resultado del desafío de la semana pasada')}</p>
        <div class="wkres">${rank ? T('Puesto {x}').replace('{x}', fmt(rank)) : T('¡Gracias por jugar!')}<small>${fmt(p.best)} ${T('puntos')}</small></div>
        <div class="rchips">${r.chest ? chip(`<i class="chest gold" style="margin:0;transform:scale(.55)"><i></i></i>${T('Cofre de oro')}`) : rewardChips(r)}</div>
        <div class="row"><button class="btn green" id="rpOk">${T('¡RECOGER!')}</button></div>`);
      $('rpOk').addEventListener('click', () => { click(); popHide(); p.paid = true; X.persist(); r.chest ? give(CHEST.gold, 'gold') : give(r); });
    };
    p.paid = 'asking';
    if (p.sent && online()) window.Social.weekly.board(p.id, p.best).then(c => { p.paid = false; pay(c.rank); }).catch(() => { p.paid = false; pay(0); });
    else { p.paid = false; pay(0); }
  }
  function navUi() {
    const nav = document.querySelector('#map .hwnav'); if (!nav) return;
    let b = $('navWk');
    if (!b) {
      b = document.createElement('button'); b.id = 'navWk'; b.className = 'wkb';
      const club = $('navClub'); club.insertAdjacentElement('afterend', b);
      b.addEventListener('click', () => { click(); wkOpen(); });
    }
    const n = triesLeft();
    b.innerHTML = `<span>⚔️</span><b>${T('Desafío')}</b>${n ? `<i>${n}</i>` : ''}`;
  }

  // ---------------- enganches con el juego ----------------
  let booted = false;
  window.Retencion = { notices: { plan: () => plan(), sync: () => noticesSync() }, weekly: { open: () => wkOpen(), tries: () => triesLeft() },
    boot() { if (booted) return; booted = true; seen(); fcUi(); fcNotify(); noticesSync(); miniUi(); navUi(); achBtn(); wk(); },
    title() { fcUi(); miniUi(); achBtn(); navUi(); },
    achCount,
    // al ganar un nivel: fichas del mini-evento, desafío y logros. Devuelve el texto que se añade al premio.
    win(d) {
      let out = '';
      const m = miniNow();
      if (m && !d.L.weekly && !d.L.club) {
        const M = MINI[m.theme], n = (d.L.boss ? 5 : 1) + (d.stars || 0), s = miniState(m);
        s.tok += n; st().miniTok = (st().miniTok || 0) + n; out += ` · +${n} ${M.tok}`;
      }
      if (d.L.weekly) out += weeklyEnd(d.score);
      X.persist(); setTimeout(achToast, 600);
      return out;
    },
    lose(d) { if (d.L.weekly) weeklyEnd(d.score); setTimeout(achToast, 600); },
    weeklyStart() { const w = wk(); w.tries++; w.cur = true; st().weeklyPlays = (st().weeklyPlays || 0) + 1; X.persist(); navUi(); },
    weeklyBack() { setTimeout(wkOpen, 200); },
    shopTop: () => miniShopHtml(),
    shopTab() { const m = miniNow(); return m ? `<button data-to="sMini" class="hwtab minitab" aria-label="${esc(T(MINI[m.theme].name))}">${MINI[m.theme].ico}</button>` : ''; },
    shopBind(box) {
      box.querySelectorAll('[data-mini]').forEach(b => b.addEventListener('click', () => { click(); miniBuy(b.dataset.mini); }));
    },
    open: { ach: () => achOpen(), weekly: () => wkOpen(), chest: () => fcOpen() },
    _mini: () => miniNow(), _wk: () => wk(), ACH, MINI,
  };
  function weeklyEnd(score) {
    const w = wk(); if (!w.cur) return '';
    w.cur = false;
    const better = score > w.best; if (better) w.best = score;
    X.persist(); navUi();
    if (better && online() && score > 0) window.Social.weekly.submit(w.id, w.best).then(() => { w.sent = true; X.persist(); }).catch(() => { /* se intentará con la siguiente */ });
    return better ? ' · ' + T('¡nuevo récord del desafío!') : '';
  }
  // cada 30 s: cuentas atrás y ventanas que esperan a que la portada esté libre
  setInterval(() => { if (document.hidden) return; fcUi(); miniUi(); welcomeTry(); wkPrevCheck(); }, 30000);
  setInterval(() => { if (document.hidden) return; welcomeTry(); wkPrevCheck(); }, 1500);
  setTimeout(() => window.Retencion.boot(), 0);   // el juego también lo llama; lo que llegue primero
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { seen(); fcUi(); fcNotify(); noticesSync(); } });
})();
