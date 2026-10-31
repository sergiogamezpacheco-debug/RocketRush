// Rocket Rush — tutorial con Cubi (un bloque amarillo del juego) que explica y señala.
// · La primera vez: unos pocos pasos por la portada, el mapa y la primera partida. Solo obliga a tocar lo que lleva a jugar
//   (¡A DEMOLER!, el nivel 1, empezar la partida y el primer disparo). Lo demás se pasa tocando, y se puede saltar.
// · Después, un consejo corto la primera vez que abres la tienda, el pase, las misiones, los amigos, un evento o un jefe.
// Los bloques nuevos no salen aquí: ya tienen su propia tarjeta «¡BLOQUE NUEVO!».
(function () {
  'use strict';
  const X = window.RRGame;
  if (!X) return;
  const $ = id => document.getElementById(id);
  const T = s => (window.I18N ? I18N.t(s) : s);
  const on = id => { const e = $(id); return !!e && e.classList.contains('on'); };
  const dimOpen = () => !!document.querySelector('.screen.dim.on') || on('chestOpen') || on('ad') || ($('langPick') && !$('langPick').hidden);

  // ---------- estado guardado ----------
  const TIP_KEYS = ['candy', 'xgift', 'shop', 'pass', 'missions', 'social', 'daily', 'hw', 'xm', 'boss', 'club', 'clubIn', 'clubEx', 'clubBoss', 'clubLg'];
  function st() {
    const s = X.save;
    if (!s.tut) {
      // quien ya jugaba antes de que existiera el tutorial no lo ve (se puede ver desde Ajustes)
      const veteran = (s.played || 0) > 0 || (s.unlocked || 1) > 1;
      s.tut = { main: veteran, tips: {} };
      if (veteran) for (const k of TIP_KEYS) s.tut.tips[k] = 1;
      X.persist();
    }
    return s.tut;
  }

  // ---------- pasos ----------
  const ids = list => list.map(i => typeof i === 'string' && !/^[.#]/.test(i) ? '#' + i : i);
  const visible = list => ids(list).filter(sel => { const e = document.querySelector(sel); return e && !e.hidden && e.offsetParent !== null; });
  const titleReady = () => on('title') && !dimOpen() && !on('daily');
  const mapReady = () => on('map') && !dimOpen() && !on('daily');
  const clubReady = () => on('club') && !dimOpen() && !!window.Club;
  const playReady = () => X.G.mode === 'play' && !X.G.paused && (X.G.introT || 0) <= 0 && !dimOpen() && !on('newCard');
  // Los nuevos, al tocar ¡A DEMOLER!, van directos a la ficha del nivel 1: el mapa se explica al volver de la primera partida.
  const MAIN = [
    { when: titleReady, title: '¡Bienvenido!', text: '¡Hola! Soy Cubi. En un momento te enseño cómo funciona Rocket Rush.' },
    { when: titleReady, target: () => visible(['btnDailyT', 'btnPassT', 'btnMisT']), title: 'Tus recompensas', text: 'Aquí tienes la racha diaria, el pase de temporada y las misiones. Cuando tengan algo para ti, verás un aviso rojo.' },
    { when: titleReady, target: () => visible(['btnSocT', 'btnShopT', 'btnSetT']), title: 'Amigos, tienda y ajustes', text: 'Añade amigos y mira la clasificación, compra en la tienda y cambia el idioma o el sonido en los ajustes.' },
    { when: titleReady, target: () => ['#btnPlay'], must: () => on('map') || on('pre'), title: '¡A jugar!', text: 'Toca ¡A DEMOLER! para empezar.' },
    { when: () => on('pre'), target: () => ['#preGo'], must: () => X.G.mode === 'play', title: 'Antes de jugar', text: 'Aquí ves el objetivo del nivel y puedes llevar ventajas como la bomba o el arcoíris. Toca ¡A DEMOLER!' },
    { when: playReady, aim: true, must: () => X.G.sim && X.G.sim.shots > 0, title: 'Apunta y dispara', text: 'Arrastra el dedo para apuntar y suéltalo para disparar. Cada bola revienta los bloques de su color; los demás caen empujados.' },
    { when: () => playReady() && X.G.sim && X.G.sim.state === 'play', auto: 6, title: '¡Así se hace!', text: 'Derriba el porcentaje que marca la barra de arriba para superar el nivel. ¡Suerte!' },
    { when: mapReady, target: () => ['#btnMis'], title: 'Tu nivel de jugador', text: 'Al jugar ganas experiencia y subes de nivel. Toca aquí cuando quieras ver tus misiones y sus premios.' },
    { when: mapReady, target: () => ['.hwnav'], title: 'Modos de juego', text: () => !$('navXm').hidden ? 'Además de los mundos tienes el Club y los eventos, como el de Navidad, con sus propios niveles y premios.' : !$('navHw').hidden ? 'Además de los mundos tienes el Club y los eventos, como el de Halloween, con sus propios niveles y premios.' : 'Además de los mundos tienes el Club y los eventos especiales, con sus propios niveles y premios.' },
    { when: mapReady, target: () => ['#navClub'], point: true, title: 'El Club', text: 'Únete a un club para jugar en equipo: expedición semanal, jefe colosal y liga del fin de semana, con premios para todos.' },
    { when: mapReady, target: () => ['#mapList .lv.cur'], scroll: '#mapList .lv.cur', point: true, last: true, title: 'Tu camino', text: 'Cada mundo tiene sus niveles y un jefe al final. Toca el siguiente nivel cuando quieras seguir.' },
  ];
  const PLAY0 = 5, MAP0 = 7;
  // rectángulo en pantalla de un bloque de caramelo (para señalarlo)
  function candyRect(list) {
    const G = X.G, c = (list || G.candies) && (list || G.candies)[0]; if (!c || !window.THREE) return null;
    const host = G.meshes[c.id]; if (!host) return null;
    const b = G.sim && G.sim.blocks[c.id], d = b && b.userData; if (!d) return null;
    const box = new THREE.Box3(new THREE.Vector3(-d.w / 2, -d.h / 2, -d.d / 2).add(b.position), new THREE.Vector3(d.w / 2, d.h / 2, d.d / 2).add(b.position)), p = new THREE.Vector3();
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < 8; i++) {
      p.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(X.camera);
      const sx = (p.x * 0.5 + 0.5) * innerWidth, sy = (-p.y * 0.5 + 0.5) * innerHeight;
      x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  const TIPS = {
    candy: { when: () => playReady() && X.G.sim && X.G.sim.state === 'play' && X.G.candies && X.G.candies.length > 0 && X.hw && X.hw.active(), rect: candyRect, point: true, title: 'Bloques de caramelo', text: 'Durante Halloween, los bloques con rayas llevan caramelos: el del bastón da 2 y el del envoltorio, 1. Si revientan o se caen, son tuyos. Gástalos en la tienda de Halloween.' },
    shop: { when: () => on('shop'), target: () => ['#shopTabs'], title: 'La tienda', text: 'Compra gemas, monedas y potenciadores. Durante los eventos aparece un apartado especial con sus propios premios.' },
    pass: { when: () => on('pass') && !dimOpen(), target: () => ['#pass .passhead'], title: 'Pase de temporada', text: 'Cada estrella que ganas suma al pase y desbloquea premios. Con el Pase Pro te llevas también los de la columna dorada.' },
    missions: { when: () => on('missions') && !dimOpen(), target: () => ['#misList .mcard'], title: 'Misiones', text: 'Cumple misiones para ganar experiencia, monedas y gemas. Cuando una esté lista, toca COBRAR.' },
    social: { when: () => on('social') && !dimOpen(), target: () => ['#socTabs'], title: 'Amigos', text: 'Comparte tu código para añadir amigos, mira las clasificaciones y elige tu nombre y avatar en el perfil.' },
    daily: { when: () => on('daily') && $('dBtns') && $('dBtns').innerHTML, title: 'Racha diaria', text: 'Entra cada día para recoger tu premio. Cada 5 días toca un cofre, y cada cofre es mejor que el anterior.' },
    xgift: { when: () => playReady() && X.G.sim && X.G.sim.state === 'play' && X.G.xgifts && X.G.xgifts.length > 0 && X.xm && X.xm.active(), rect: () => candyRect(X.G.xgifts), point: true, title: 'Regalos de Navidad', text: 'Los bloques envueltos para regalo llevan premio: el del bastón da 2 caramelos navideños y el del caramelo de menta, 1. Rómpelos o tíralos y gástalos en la tienda de Navidad.' },
    xm: { when: () => on('xmmap') && !dimOpen(), target: () => ['#xmmap .xmhead'], title: 'Evento de Navidad', text: 'Un pueblo nevado con 50 niveles y 5 jefes: el Cascanueces, la Caja Sorpresa y el Capitán Escarcha. Rompe los regalos para conseguir caramelos navideños.' },
    hw: { when: () => on('hwmap') && !dimOpen(), target: () => ['#hwmap .hwhead'], title: 'Evento de Halloween', text: 'Un mundo especial con 50 niveles y 5 jefes. Rompe los bloques con caramelo para ganar caramelos y gástalos en la tienda de Halloween.' },
    // clubes: un consejo al abrirlos sin club y otro la primera vez en cada pestaña de tu club
    club: { when: () => clubReady() && !window.Club.inClub, target: () => ['#clubHead .kltabs'], title: 'Clubes', text: 'Juega en equipo con hasta 30 jugadores. Busca un club y entra, o crea el tuyo por 500 monedas.' },
    clubIn: { when: () => clubReady() && window.Club.inClub && window.Club.tab === 'club', target: () => ['#clubHead .kltabs'], title: 'Tu club', text: 'Cada semana hay tres retos: la expedición, el jefe colosal y la liga del fin de semana. En esta pestaña ves a los miembros y lo que aporta cada uno.' },
    clubEx: { when: () => clubReady() && window.Club.inClub && window.Club.tab === 'ex', target: () => ['#clubList .klday'], title: 'Expedición', text: 'De lunes a viernes se abren 10 niveles cada día. Tus estrellas llenan el cofre del club y cada una te da 15 monedas al acabar la semana.' },
    clubBoss: { when: () => clubReady() && window.Club.inClub && window.Club.tab === 'boss', target: () => visible(['clubAttack']).length ? ['#clubAttack'] : ['#clubList .klbosscard'], point: true, title: 'Jefe colosal', text: 'Todo el club ataca al mismo jefe. Tienes 3 ataques al día: cuanta más vida le quites, más daño sumas para el club.' },
    clubLg: { when: () => clubReady() && window.Club.inClub && window.Club.tab === 'lg', target: () => ['#clubHead .kltabs'], title: 'Liga del fin de semana', text: 'De viernes a lunes, 10 niveles difíciles. Gana el club que más estrellas consiga entre todos sus miembros.' },
    boss: { when: () => playReady() && X.G.level && X.G.level.boss && X.G.sim && X.G.sim.state === 'play', title: '¡Un jefe!', text: 'Los jefes tienen su barra de vida arriba. Lee lo que pide cada uno y derríbalo antes de quedarte sin bolas.' },
  };

  // ---------- capa en pantalla ----------
  const HAND = '<svg viewBox="-2 0 78 90" width="100%" height="100%"><defs><linearGradient id="tuhg" x1="0" y1="0" x2="1" y2="1"><stop offset=".5" stop-color="#ffffff"/><stop offset="1" stop-color="#dcd2f4"/></linearGradient></defs>' +
    '<path d="M21 17 C21 3 43 3 43 17 L43 37 C43 27 57 27 57 37 L57 41 C57 31 71 31 71 41 L71 62 C71 78 61 87 47 87 L36 87 C26 87 18 81 14 73 L3 54 C-1 45 10 38 17 45 L21 50 Z" fill="url(#tuhg)" stroke="#1a0a2e" stroke-width="4.5" stroke-linejoin="round"/>' +
    '<path d="M43 39 L43 54 M57 42 L57 55" stroke="#1a0a2e" stroke-width="3.5" stroke-linecap="round"/><path d="M28 14 L28 30" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/></svg>';
  const root = document.createElement('div');
  root.id = 'tut'; root.hidden = true;
  root.innerHTML = '<div class="tu-hole"></div><div class="tu-ring"></div><div class="tu-blk"></div><div class="tu-blk"></div><div class="tu-blk"></div><div class="tu-blk"></div>' +
    '<div class="tu-hand">' + HAND + '</div><div class="tu-path"></div><div class="tu-cubi"><img alt=""></div>' +
    '<div class="tu-bub"><b class="tu-tt"></b><div class="tu-tx"></div><div class="tu-ft"><span class="tu-skip">Saltar tutorial</span><i class="tu-go"></i></div></div>';
  document.body.appendChild(root);
  const Q = s => root.querySelector(s);
  const hole = Q('.tu-hole'), ring = Q('.tu-ring'), blk = [...root.querySelectorAll('.tu-blk')], hand = Q('.tu-hand'), path = Q('.tu-path'),
    cubi = Q('.tu-cubi'), img = Q('.tu-cubi img'), bub = Q('.tu-bub'), tt = Q('.tu-tt'), tx = Q('.tu-tx'), skip = Q('.tu-skip'), go = Q('.tu-go');

  let cur = null;           // { kind: 'main' | 'tip', i | key, step, t0 }
  let frames = null;
  function cubiImg(mood) {
    if (!frames) frames = X.cubiFrames ? X.cubiFrames() : {};
    return frames[mood] || frames.normal || '';
  }
  function show(step, kind, key) {
    cur = { kind, key, step, t0: performance.now() };
    const s = st();
    tt.textContent = T(step.title);
    tx.textContent = T(typeof step.text === 'function' ? step.text() : step.text);
    skip.hidden = kind !== 'main';
    const n = MAIN.length;
    go.className = 'tu-go' + (step.must || step.aim ? ' must' : '');
    go.textContent = step.aim ? T('¡Dispara!') : step.must ? T('¡Tócalo!') : kind === 'tip' ? T('Entendido') : T('Toca para seguir') + ' · ' + (key + 1) + '/' + n;
    img.src = cubiImg('normal');
    root.hidden = false; root.className = (step.must || step.aim ? 'must' : '') + (step.aim ? ' aim' : '');
    cubi.classList.remove('talk'); void cubi.offsetWidth; cubi.classList.add('talk');
    if (step.scroll) { const e = document.querySelector(step.scroll); if (e) e.scrollIntoView({ block: 'center' }); }
    if (X.Audio && X.Audio.click) X.Audio.click();
    layout();
  }
  function hide() { cur = null; root.hidden = true; }
  // dónde está lo que se señala (unión de varios elementos)
  function targetRect(step) {
    if (step.rect) return step.rect();
    if (!step.target) return null;
    const list = step.target();
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, ok = false;
    for (const sel of list) {
      const e = document.querySelector(sel); if (!e) continue;
      const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
      ok = true; x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
    }
    return ok ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
  }
  const px = v => Math.round(v) + 'px';
  function place(el, x, y, w, h) { el.style.left = px(x); el.style.top = px(y); if (w != null) el.style.width = px(w); if (h != null) el.style.height = px(h); }
  // posición en pantalla de un bloque del color de la bola cargada (para el gesto de apuntar)
  function aimPoint() {
    const G = X.G, sim = G.sim; if (!sim || !window.THREE) return null;
    const k = sim.queue[0], live = sim.liveBlocks();
    const b = live.find(o => o.userData.c === k) || live[0]; if (!b) return null;
    const v = new THREE.Vector3().copy(b.position).project(X.camera);
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
  }
  function layout() {
    if (!cur) return;
    const step = cur.step, W = innerWidth, H = innerHeight, pad = 8;
    const r = targetRect(step);
    // oscurecido con hueco (o entero) y zonas que recogen el toque
    if (r) {
      const hx = r.x - pad, hy = r.y - pad, hw = r.w + pad * 2, hh = r.h + pad * 2;
      hole.hidden = false; ring.hidden = false;
      place(hole, hx, hy, hw, hh); place(ring, hx - 2, hy - 2, hw, hh);
      // con «must», el hueco deja pasar el toque al botón de verdad
      place(blk[0], 0, 0, W, Math.max(0, hy)); place(blk[1], 0, hy + hh, W, Math.max(0, H - hy - hh));
      place(blk[2], 0, hy, Math.max(0, hx), hh); place(blk[3], hx + hw, hy, Math.max(0, W - hx - hw), hh);
      blk.forEach(b => { b.hidden = false; });
      if (!step.must) { place(blk[0], 0, 0, W, H); [1, 2, 3].forEach(i => { blk[i].hidden = true; }); }
    } else {
      hole.hidden = true; ring.hidden = true;
      place(blk[0], 0, 0, W, H); blk[0].hidden = !!step.aim; [1, 2, 3].forEach(i => { blk[i].hidden = true; });
    }
    root.classList.toggle('full', !r && !step.aim);
    // bocadillo y Cubi: debajo de lo señalado si está arriba; encima si está abajo
    const bw = Math.min(W - 128, 340), bx = W - bw - 14;
    bub.style.width = px(bw); bub.style.left = px(bx);
    const bh = bub.offsetHeight || 120;
    let by;
    if (step.aim) by = Math.max(80, H * 0.11);
    else if (!r) by = H * 0.5 - bh / 2;
    else if (r.y + r.h / 2 < H * 0.5) by = r.y + r.h + pad + 26;
    else by = r.y - pad - 26 - bh;
    by = Math.max(12, Math.min(H - bh - 12, by));
    bub.style.top = px(by);
    place(cubi, 8, by + bh / 2 - 52);
    // mano: toca lo que hay que tocar; en la partida, dibuja el gesto de apuntar
    if (step.aim) {
      const p = aimPoint();
      if (p) {
        const sx = W / 2, sy = H * 0.78, k = ((performance.now() - cur.t0) / 1400) % 1, e = Math.min(1, k / 0.7);
        const hx2 = sx + (p.x - sx) * e, hy2 = sy + (p.y - sy) * e;
        hand.hidden = false; hand.classList.remove('tap'); place(hand, hx2 - 14, hy2 - 6);
        hand.style.opacity = k > 0.85 ? '0' : '1';
        const ln = Math.hypot(p.x - sx, p.y - sy);
        path.hidden = false; place(path, sx, sy, ln); path.style.transform = `rotate(${Math.atan2(p.y - sy, p.x - sx)}rad)`;
      } else { hand.hidden = true; path.hidden = true; }
    } else if (r && (step.must || step.point)) {
      hand.hidden = false; hand.classList.add('tap'); hand.style.opacity = '1'; path.hidden = true;
      place(hand, r.x + r.w * 0.5 - 14, r.y + r.h * 0.5);
    } else { hand.hidden = true; path.hidden = true; }
  }

  // ---------- avance ----------
  function next() {
    if (!cur) return;
    const s = st();
    if (cur.kind === 'tip') { s.tips[cur.key] = 1; X.persist(); hide(); return; }
    const step = cur.step;
    if (step.last || cur.key >= MAIN.length - 1) { finish(); return; }
    s.step = cur.key + 1; X.persist(); hide();
  }
  function finish() { const s = st(); s.main = true; s.step = MAIN.length; X.persist(); hide(); }
  blk.forEach(b => b.addEventListener('click', e => { e.stopPropagation(); if (cur && !cur.step.must && !cur.step.aim && performance.now() - cur.t0 > 350) next(); }));
  bub.addEventListener('click', e => { e.stopPropagation(); if (cur && !cur.step.must && !cur.step.aim) next(); });
  skip.addEventListener('click', e => { e.stopPropagation(); finish(); });

  const testing = () => navigator.webdriver && !window.RR_TUT_TEST;
  let blinkAt = 0;
  function tick() {
    requestAnimationFrame(tick);
    if (testing()) { if (cur) hide(); return; }
    const s = st(), now = performance.now();
    if (cur) {
      const step = cur.step;
      // paso obligatorio cumplido, paso fuera de su sitio o consejo de tiempo
      if ((step.must || step.aim) && step.must()) { next(); return; }
      if (step.auto && now - cur.t0 > step.auto * 1000) { next(); return; }
      if (!step.when() && !(step.must && step.must())) {
        if (cur.kind === 'tip') { hide(); return; }       // el consejo ya no pinta nada aquí: saldrá la próxima vez
        root.hidden = true; return;
      }
      root.hidden = false;
      if (now > blinkAt) { img.src = cubiImg('blink'); setTimeout(() => { if (cur) img.src = cubiImg('normal'); }, 140); blinkAt = now + 2200 + Math.random() * 2500; }
      layout();
      return;
    }
    // nada en pantalla: ¿toca un paso del tutorial o un consejo?
    if (!s.main) {
      const i = Math.min(s.step || 0, MAIN.length - 1), step = MAIN[i];
      // si se sale del camino, se salta al paso que le toca
      if (i < PLAY0 && X.G.mode === 'play') { s.step = PLAY0; return; }
      if (i >= PLAY0 && i < MAP0 && X.G.mode !== 'play' && on('map')) { s.step = MAP0; return; }
      if (step.when() && (!step.target || targetRect(step))) show(step, 'main', i);
      return;
    }
    for (const k of TIP_KEYS) {
      if (s.tips[k]) continue;
      const tp = TIPS[k];
      if (tp.when() && (!(tp.target || tp.rect) || targetRect(tp))) { show(tp, 'tip', k); return; }
    }
  }
  requestAnimationFrame(tick);
  addEventListener('resize', layout);

  // desde Ajustes: volver a ver el tutorial
  const again = $('sTut');
  if (again) again.addEventListener('click', () => {
    X.save.tut = { main: false, tips: {}, step: 0 }; X.persist();
    $('settings').classList.remove('on');
    if (X.goTitle) X.goTitle();
  });

  window.Tutorial = {
    busy: () => !testing() && !st().main && (st().step || 0) < MAP0,
    get step() { return cur ? (cur.kind === 'main' ? cur.key : cur.key) : null; },
    get visible() { return !!cur && !root.hidden; },
    next, finish,
  };
})();
