// Rocket Rush — Torre sin fin (25-11).
// Un nivel que no se acaba: cuando la torre está casi derribada cae un piso nuevo desde arriba (más alto y con más
// colores cada vez) y te da unas bolas más. Se juega hasta quedarse sin bolas. Cuenta el piso al que llegas: récord
// propio, clasificación de la semana (weekly/T<semana>) y premio en monedas (y gemas cada 5 pisos).
// game3d.js llama a Torre.start(L) / Torre.stop() al empezar un nivel, Torre.tick(dt) cada fotograma, Torre.hud() para
// la barra de arriba y Torre.end() cuando se acaban las bolas (en vez de la pantalla de «¡CASI!»).
(function () {
  'use strict';
  const X = () => window.RRGame;
  const T = s => (window.I18N ? I18N.t(s) : s);
  const $ = id => document.getElementById(id);
  const fmt = n => (+n || 0).toLocaleString('es-ES');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ID = 44001, COLS = ['r', 'b', 'g', 'y', 'p'], W = 7;
  const WEEK0 = Date.UTC(2026, 9, 5);
  const weekId = () => 'T' + Math.floor((Date.now() - WEEK0) / (7 * 864e5));

  let S = null;   // partida en curso: { L, floor, grid[col][fila] = cuerpo | null, base, need, earned, ... }
  // 25-11 (2): la torre ya no se cae ni se cambia por pisos. Es una pared fija de W×H bloques que no se mueven (no se
  // desprenden ni ruedan, y además la física no tiene que mover nada): lo que revientas deja hueco, lo de arriba baja a
  // ocuparlo y por arriba entran bloques nuevos de colores al azar (de vez en cuando uno especial). Las bolas también se
  // ganan sobre la marcha (1 cada pocos bloques, a veces una bomba o un arcoíris) y cada «piso» (N bloques reventados)
  // trae más colores y un regalo de bolas. Se acaba al quedarse sin bolas.
  const H = 8, X0 = -(W - 1) / 2, Y0 = 0.5, Z0 = 0, FALL = 9;
  const sv = () => { const s = X().save; if (!s.torre) s.torre = { best: 0, games: 0, wk: null, wkBest: 0 }; return s.torre; };
  const colorsFor = f => COLS.slice(0, Math.min(5, 4 + Math.floor(f / 4)));          // 4 colores; 5 desde el piso 4
  const needFor = f => 24 + 4 * Math.min(f, 10);                                      // bloques por piso
  const everyFor = f => Math.min(18, 8 + Math.round(f * 0.8));                         // cada cuántos bloques, +1 bola
  const bonusFor = f => Math.max(1, 4 - Math.floor(f / 3));                           // regalo al subir de piso
  const SPECIALS = [['bm', 3], ['st', 3], ['tnt', 2], ['gift', 2], ['i', 2]];          // bloques especiales (y su peso)
  const rnd = Math.random;
  const pickW = list => { let t = 0; for (const [, w] of list) t += w; let r = rnd() * t; for (const [k, w] of list) if ((r -= w) < 0) return k; return list[0][0]; };

  // color de un bloque nuevo: a veces el de al lado o el de debajo, para que salgan grupos
  function colorAt(grid, c, r, f) {
    const cols = colorsFor(f), side = grid[c - 1] && grid[c - 1][r], below = r > 0 && grid[c][r - 1];
    const cOf = b => b && b.userData.alive && b.userData.kind === 'block' ? b.userData.c : null;
    if (cOf(side) && rnd() < 0.22) return cOf(side);
    if (cOf(below) && rnd() < 0.16) return cOf(below);
    return cols[Math.floor(rnd() * cols.length)];
  }
  function blockDef(grid, c, r, y, f, special) {
    const d = { x: X0 + c, y, z: Z0, w: 1, h: 1, d: 1, fixed: true };
    const t = special ? pickW(SPECIALS) : null;
    if (t === 'tnt' || t === 'gift') d.t = t;
    else { d.c = colorAt(grid, c, r, f); if (t) d.t = t; }
    return d;
  }
  // bolas: de los colores que hay en la pared (los que más hay, más a menudo)
  function ballColor(sim) {
    const n = {}; let tot = 0;
    for (const col of S.grid) for (const b of col) if (b && b.userData.alive && !b.userData.popping && b.userData.c) { n[b.userData.c] = (n[b.userData.c] || 0) + 1; tot++; }
    if (!tot) { const cs = colorsFor(S.floor); return cs[Math.floor(rnd() * cs.length)]; }
    let r = rnd() * tot; for (const k in n) if ((r -= n[k]) < 0) return k; return Object.keys(n)[0];
  }

  // nivel 44001 (se crea al empezar; cada partida es distinta)
  function level() {
    const Lv = window.Levels, ALL = Lv.ALL;
    for (let i = ALL.length - 1; i >= 0; i--) if (ALL[i].endless) ALL.splice(i, 1);
    const neon = Lv.LEVELS.find(l => l.biome === 'neon' && l.variant === 'noche') || Lv.LEVELS.find(l => l.biome === 'neon') || Lv.LEVELS[0];
    const grid = [], blocks = [];
    for (let c = 0; c < W; c++) grid.push([]);
    // la pared se rellena por filas (así el color «de al lado» ya existe)
    const fake = d => ({ userData: { alive: true, kind: d.t ? 'x' : 'block', c: d.c } });
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) { const d = blockDef(grid, c, r, Y0 + r, 1, false); grid[c][r] = fake(d); blocks.push(d); }
    const L = { id: ID, endless: true, name: 'Torre sin fin', goal: 'Revienta bloques sin parar: la torre se rellena y cada piso trae más colores. ¿Hasta dónde llegas?',
      world: neon.world, biome: neon.biome, variant: neon.variant, weather: null, pos: 1, nb: 12, target: 99, viewTop: Y0 + H + 0.6,
      cannon: { x: 0, y: 1.2, z: 15.5 }, blocks, balls0: '', balls: '' };
    let b = ''; const cs = colorsFor(1); for (let i = 0; i < 12; i++) b += cs[Math.floor(rnd() * cs.length)];
    L.balls = b; L.balls0 = b;
    ALL.push(L);
    return L;
  }

  function start(L) {
    S = { L, floor: 1, grid: null, base: 0, need: needFor(1), earned: 0, wait: 0, dead: [] };
    sv().games++; X().persist();
    const lab = document.querySelector('.meterlabel small'); if (lab) lab.textContent = '';
  }
  function stop() {
    if (!S) return; S = null;
    const lab = document.querySelector('.meterlabel small'); if (lab && !lab.textContent) lab.textContent = T('DEMOLICIÓN');
  }
  // la rejilla se saca de los bloques del nivel la primera vez (por su posición)
  function buildGrid(sim) {
    const g = []; for (let c = 0; c < W; c++) g.push(new Array(H).fill(null));
    for (const b of sim.blocks) {
      const d = b.userData; if (!d.alive || d.destroyed) continue;
      const c = Math.round(b.position.x - X0), r = Math.round(b.position.y - Y0);
      if (c >= 0 && c < W && r >= 0 && r < H) g[c][r] = b;
    }
    S.grid = g;
  }
  const gone = b => !b || !b.userData.alive || b.userData.destroyed;
  function tick(dt) {
    const A = X(), G = A.G, sim = G.sim; if (!S || !sim || G.level !== S.L || sim.state !== 'play') return;
    if (!S.grid) buildGrid(sim);
    let moving = false;
    if (!S.hole) S.hole = new Array(W).fill(0);
    for (let c = 0; c < W; c++) {
      const col = S.grid[c];
      for (let r = 0; r < col.length; r++) if (col[r] && gone(col[r])) { S.dead.push([col[r].userData.id, sim.t]); col[r] = null; }
      // lo que queda baja a ocupar los huecos (sin física: se mueve a mano, como una cinta)
      const keep = col.filter(Boolean);
      for (let r = 0; r < keep.length; r++) {
        const b = keep[r], ty = Y0 + r;
        if (b.position.y > ty + 1e-4) {
          b.position.y = Math.max(ty, b.position.y - FALL * dt); b.aabbNeedsUpdate = true; moving = true;
        }
      }
      for (let r = 0; r < H; r++) col[r] = keep[r] || null;
      // y por arriba entran bloques nuevos en cuanto se abre hueco (un momento después, para que se vea caer lo de arriba)
      if (keep.length < H) S.hole[c] += dt; else S.hole[c] = 0;
      if (keep.length < H && S.hole[c] >= 0.15) {
        S.hole[c] = 0;
        const top = keep.length ? keep[keep.length - 1].position.y : Y0 - 1;
        for (let r = keep.length, k = 0; r < H; r++, k++) {
          const special = S.floor >= 1 && rnd() < Math.min(0.09, 0.04 + S.floor * 0.008);
          const d = blockDef(S.grid, c, r, Math.max(Y0 + H + 0.4, top + 1.2) + k * 1.05, S.floor, special);
          const body = sim.addBlock(d); A.addBlockView(body.userData);
          col[r] = body; moving = true;
        }
      }
    }
    // bloques reventados: fuera de la escena al rato (la partida no tiene fin y se irían acumulando)
    while (S.dead.length && sim.t - S.dead[0][1] > 1.5) {
      const [id] = S.dead.shift(), m = G.meshes && G.meshes[id];
      if (m) { if (m.parent) m.parent.remove(m); delete G.meshes[id]; }
    }
    // bolas que se ganan sobre la marcha y pisos
    const done = sim.popped - S.base, every = everyFor(S.floor);
    while (done >= (S.earned + 1) * every) {
      S.earned++;
      const r = rnd(), k = r < 0.035 ? 'bomb' : r < 0.055 ? 'rainbow' : ballColor(sim);
      sim.queue.push(k); sim.idle = 0;
    }
    if (done >= S.need) floorUp(sim);
  }
  function floorUp(sim) {
    const A = X();
    S.floor++; S.base = sim.popped; S.need = needFor(S.floor); S.earned = 0;
    const n = bonusFor(S.floor), add = [];
    for (let i = 0; i < n; i++) add.push(ballColor(sim));
    if (S.floor % 3 === 0) add.push(rnd() < 0.5 ? 'bomb' : 'rainbow');      // cada 3 pisos, una bola especial
    sim.queue.push(...add); sim.idle = 0;
    A.centerText && A.centerText(T('¡PISO {x}!').replace('{x}', S.floor), '#7fe6ff', 40);
    A.toast && A.toast(T('+{x} bolas').replace('{x}', add.length), 1400);
    A.Audio && A.Audio.special && A.Audio.special();
    if (colorsFor(S.floor).length > colorsFor(S.floor - 1).length) setTimeout(() => A.toast && A.toast(T('¡Nuevo color en la torre!'), 1600), 1500);
  }
  // barra de arriba: lo reventado del piso actual
  function hud() {
    const sim = X().G.sim; if (!S || !sim) return null;
    const p = Math.min(1, Math.max(0, sim.popped - S.base) / S.need);
    return { p, txt: T('PISO') + ' ' + S.floor };
  }

  // ---------------- final: resultado, récord, premio y clasificación ----------------
  let pop = null;
  function end() {
    if (!S) return;
    const A = X(), f = S.floor, s = sv(), wk = weekId();
    const rec = f > s.best; if (rec) s.best = f;
    if (s.wk !== wk) { s.wk = wk; s.wkBest = 0; }
    const sendable = f > s.wkBest; if (sendable) s.wkBest = f;
    const sim = A.G.sim, blocks = sim ? sim.popped + sim.fallen : 0;
    const coins = 20 * (f - 1) + Math.min(200, Math.round(blocks / 2)), gems = Math.floor((f - 1) / 5) * 2;
    A.save.coins = (A.save.coins || 0) + coins; if (gems) A.save.gems = (A.save.gems || 0) + gems;
    A.persist(); A.setCoins && A.setCoins();
    const score = f * 10000 + Math.min(9999, blocks);
    if (sendable && window.Social && window.Social.weekly && window.Social.weekly.online) window.Social.weekly.submit(wk, score).catch(() => {});
    if (!pop) {
      pop = document.createElement('div'); pop.className = 'screen dim'; pop.id = 'torrePop';
      pop.innerHTML = '<div class="panel"><div class="ribbon purple">' + T('TORRE SIN FIN') + '</div><div id="tpBody"></div></div>';
      document.body.appendChild(pop);
    }
    $('tpBody').innerHTML = `<div class="tpfloor">${T('Has llegado al')}<b>${T('PISO')} ${f}</b>${rec ? `<span class="tprec">🏆 ${T('¡Nuevo récord!')}</span>` : `<small>${T('Tu récord')}: ${T('piso')} ${s.best}</small>`}</div>
      <div class="reward"><i class="coin"></i><span>+${fmt(coins)}</span>${gems ? ` · <i class="gem"></i><span>+${gems}</span>` : ''}</div>
      <div class="wklb" id="tpLb"><div class="sempty">${window.Social && window.Social.weekly && window.Social.weekly.online ? T('Cargando clasificación…') : T('Sin conexión: la clasificación necesita internet. Tu récord se guarda en el móvil.')}</div></div>
      <div class="row"><button class="btn gray" style="flex:.45" id="tpOut">✕</button><button class="btn green" id="tpAgain">${T('OTRA VEZ')}</button></div>`;
    $('tpOut').addEventListener('click', () => { click(); close(); A.goMap && A.goMap(); });
    $('tpAgain').addEventListener('click', () => { click(); close(); play(); });
    pop.classList.add('on');
    if (window.Social && window.Social.weekly && window.Social.weekly.online) {
      setTimeout(() => window.Social.weekly.board(wk, s.wkBest * 10000).then(c => {
        const el = $('tpLb'); if (!el || !pop.classList.contains('on')) return;
        const me = window.Social.uid, rows = c.rows.slice(0, 5);
        el.innerHTML = `<div class="tplbh">${T('Esta semana')}</div>` + (rows.length ? rows.map((r, i) => `<div class="wkrow${r._id === me ? ' me' : ''}"><span class="p">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><span class="a">${esc(r.avatar || '🙂')}</span><span class="n" translate="no">${esc(r.name || '?')}</span><span class="s">${T('piso')} ${Math.floor(r.score / 10000)}</span></div>`).join('') : `<div class="sempty">${T('Sé el primero de la semana')}</div>`)
          + (c.rank > 5 ? `<div class="wkrow me"><span class="p">${fmt(c.rank)}</span><span class="a">🙂</span><span class="n">${T('Tú')}</span><span class="s">${T('piso')} ${s.wkBest}</span></div>` : '');
      }).catch(() => { const el = $('tpLb'); if (el) el.innerHTML = `<div class="sempty">${T('No se ha podido cargar la clasificación.')}</div>`; }), 800);
    }
  }
  function close() { if (pop) pop.classList.remove('on'); }
  function click() { try { X().Audio.init && X().Audio.init(); X().Audio.click(); } catch (e) { /* nada */ } }
  function play() { const L = level(); X().hideAll && X().hideAll(); X().startLevel(L.id, []); }

  // ---------------- «Retos» en la portada: desafío de la semana (torneo para todos) y torre sin fin ----------------
  let hub = null;
  function hubOpen() {
    if (!hub) {
      hub = document.createElement('div'); hub.className = 'screen dim'; hub.id = 'retosPop';
      hub.innerHTML = '<div class="panel"><div class="ribbon fire">' + T('RETOS') + '</div><div id="rtBody"></div><button class="btn gray" id="rtX">' + T('CERRAR') + '</button></div>';
      document.body.appendChild(hub);
      $('rtX').addEventListener('click', () => { click(); hub.classList.remove('on'); });
    }
    const R = window.Retencion && window.Retencion.weekly, tries = R ? R.tries() : 0;
    $('rtBody').innerHTML = `<div class="rtcard wk"><div class="rti">⚔️</div><div class="rtt"><b>${T('Desafío de la semana')}</b><small>${T('Torneo para todos: el mismo nivel, 3 intentos y premios por puesto.')}</small><small class="rtx">🥇 150 💎 · Top 10: 60 💎</small></div><button class="btn green small" id="rtWk">${T('JUGAR')}${tries ? ` <i class="rtn">${tries}</i>` : ''}</button></div>
      <div class="rtcard tw"><div class="rti">🗼</div><div class="rtt"><b>${T('Torre sin fin')}</b><small>${T('Revienta bloques sin parar: la torre se rellena sola y cada piso trae más colores. ¿Hasta dónde llegas?')}</small><small class="rtx">${sv().best ? T('Tu récord') + ': ' + T('piso') + ' ' + sv().best : T('Clasificación semanal')}</small></div><button class="btn green small" id="rtTw">${T('JUGAR')}</button></div>`;
    $('rtBody').insertAdjacentHTML('beforeend', `<div class="rtnet">🌐 ${T('Las clasificaciones necesitan conexión a internet.')}</div>`);
    $('rtWk').addEventListener('click', () => { click(); hub.classList.remove('on'); if (R) R.open(); });
    $('rtTw').addEventListener('click', () => { click(); hub.classList.remove('on'); play(); });
    hub.classList.add('on');
  }
  function hubBtn() {
    if ($('btnRetosT')) return;
    const col = document.querySelector('#title .tside.right'); if (!col) return;
    const b = document.createElement('button'); b.className = 'sb retossb'; b.id = 'btnRetosT'; b.setAttribute('aria-label', T('Retos'));
    b.innerHTML = '<span>🏆</span><b>' + T('Retos') + '</b>';
    col.insertBefore(b, col.firstChild); col.classList.add('five');
    b.addEventListener('click', () => { click(); hubOpen(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hubBtn); else hubBtn();

  const prevBack = window.ChromaBack;
  window.ChromaBack = () => { if (hub && hub.classList.contains('on')) { hub.classList.remove('on'); return true; } if (pop && pop.classList.contains('on')) { close(); X().goMap && X().goMap(); return true; } return prevBack ? prevBack() : false; };

  window.Torre = { start, stop, tick, hud, end, play, level, hubOpen, best: () => sv().best, weekId, get state() { return S; }, isOpen: () => !!(pop && pop.classList.contains('on')) };
})();
