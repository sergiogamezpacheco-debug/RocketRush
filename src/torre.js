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
  const ID = 44001, COLS = ['r', 'b', 'g', 'y', 'p'], W = 6;
  const WEEK0 = Date.UTC(2026, 9, 5);
  const weekId = () => 'T' + Math.floor((Date.now() - WEEK0) / (7 * 864e5));

  let S = null;   // partida en curso: { L, floor, floorN, dropping, blocksAtFloor }

  const sv = () => { const s = X().save; if (!s.torre) s.torre = { best: 0, games: 0, wk: null, wkBest: 0 }; return s.torre; };
  // colores del piso: van entrando más colores cuanto más alto
  const colorsFor = f => COLS.slice(0, Math.min(5, 3 + Math.floor((f - 1) / 3)));
  const rowsFor = f => Math.min(6, 2 + Math.ceil(f / 2));
  const bonusFor = f => Math.max(3, 6 - Math.floor(f / 3));

  // bloques de un piso: grupos de 2-3 del mismo color (se copia el color de al lado o de abajo a veces)
  function floorBlocks(f, y0, rnd) {
    const cols = colorsFor(f), rows = rowsFor(f), out = [], grid = [];
    for (let j = 0; j < rows; j++) {
      grid[j] = [];
      for (let i = 0; i < W; i++) {
        let c = cols[Math.floor(rnd() * cols.length)];
        if (i > 0 && rnd() < 0.42) c = grid[j][i - 1];
        else if (j > 0 && rnd() < 0.35) c = grid[j - 1][i];
        grid[j][i] = c;
        out.push({ x: -2.5 + i, y: y0 + j, z: 0, w: 1, h: 1, d: 1, c });
      }
    }
    return out;
  }
  const rand = () => Math.random;
  function ballsFor(cols, n, rnd) { let s = ''; for (let i = 0; i < n; i++) s += cols[Math.floor(rnd() * cols.length)]; return s; }

  // nivel 44001 (se crea al empezar; cada partida es distinta)
  function level() {
    const Lv = window.Levels, ALL = Lv.ALL;
    for (let i = ALL.length - 1; i >= 0; i--) if (ALL[i].endless) ALL.splice(i, 1);
    const neon = Lv.LEVELS.find(l => l.biome === 'neon' && l.variant === 'noche') || Lv.LEVELS.find(l => l.biome === 'neon') || Lv.LEVELS[0];
    const r = rand(), blocks = floorBlocks(1, 0.5, r);
    const L = { id: ID, endless: true, name: 'Torre sin fin', goal: 'Derriba la torre: cada vez que caiga casi entera, llegará un piso nuevo. ¿Hasta dónde llegas?',
      world: neon.world, biome: neon.biome, variant: neon.variant, weather: null, pos: 1, nb: 9, target: 99, viewTop: 7.5,
      cannon: { x: 0, y: 1.2, z: 14.5 }, blocks, balls0: '', balls: ballsFor(colorsFor(1), 9, r) };
    ALL.push(L);
    return L;
  }

  function start(L) {
    S = { L, floor: 1, floorN: L.blocks.length, base: 0, dropping: 0, wait: 0 };
    sv().games++; X().persist();
    const lab = document.querySelector('.meterlabel small'); if (lab) lab.textContent = '';
  }
  function stop() {
    if (!S) return; S = null;
    const lab = document.querySelector('.meterlabel small'); if (lab && !lab.textContent) lab.textContent = T('DEMOLICIÓN');
  }
  function live(sim) { return sim.liveBlocks().filter(b => !b.userData.falling); }
  function tick(dt) {
    const G = X().G, sim = G.sim; if (!S || !sim || G.level !== S.L || sim.state !== 'play') return;
    if (S.dropping > 0) { S.dropping -= dt; return; }
    const lv = live(sim);
    const quiet = sim.balls.length === 0 && sim.pending.length === 0;
    if (!quiet) { S.wait = 0; return; }
    if (lv.length > Math.max(4, Math.round(S.floorN * 0.22))) { S.wait = 0; return; }
    if ((S.wait += dt) < 0.5) return;       // que se asiente lo que cae
    dropFloor(sim, lv);
  }
  function dropFloor(sim, lv) {
    S.floor++; S.wait = 0; S.dropping = 1.6;
    const f = S.floor, top = lv.reduce((m, b) => Math.max(m, b.position.y), 0);
    const y0 = Math.max(0.5, top + 3.2), r = rand(), bl = floorBlocks(f, y0, r);
    S.floorN = bl.length; S.base = sim.popped + sim.fallen;
    bl.forEach((d, k) => sim.later(0.05 + (k % W) * 0.04 + Math.floor(k / W) * 0.12, () => {
      if (!S || X().G.sim !== sim) return;
      const body = sim.addBlock(d); X().addBlockView(body.userData);
    }));
    // bolas de regalo, de los colores del piso nuevo
    const n = bonusFor(f), add = ballsFor(colorsFor(f), n, r).split('');
    sim.queue.push(...add); sim.idle = 0; sim.sinceFire = Math.min(sim.sinceFire, 0.5);
    const A = X();
    A.centerText && A.centerText(T('¡PISO {x}!').replace('{x}', f), '#7fe6ff', 40);
    A.toast && A.toast(T('+{x} bolas').replace('{x}', n), 1400);
    A.Audio && A.Audio.special && A.Audio.special();
    if (f > sv().best) { /* récord en directo */ }
  }
  // barra de arriba: lo derribado del piso actual
  function hud() {
    const sim = X().G.sim; if (!S || !sim) return null;
    const done = Math.max(0, sim.popped + sim.fallen - S.base), p = Math.min(1, done / Math.max(1, S.floorN * 0.78));
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
      <div class="wklb" id="tpLb"><div class="sempty">${window.Social && window.Social.weekly && window.Social.weekly.online ? T('Cargando clasificación…') : T('Sin conexión: tu puntuación cuenta solo para ti.')}</div></div>
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
      <div class="rtcard tw"><div class="rti">🗼</div><div class="rtt"><b>${T('Torre sin fin')}</b><small>${T('Cada vez que la derribas cae un piso nuevo, más alto. ¿Hasta dónde llegas?')}</small><small class="rtx">${sv().best ? T('Tu récord') + ': ' + T('piso') + ' ' + sv().best : T('Clasificación semanal')}</small></div><button class="btn green small" id="rtTw">${T('JUGAR')}</button></div>`;
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
