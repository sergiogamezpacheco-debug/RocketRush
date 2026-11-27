// Rocket Rush — jefes: el último nivel de cada paisaje. Tres tipos que rotan (barco pirata, pirámide con escudo
// de color y gólem que camina) con nombre y aspecto según el paisaje. Usa el motor del juego a través de window.RRGame.
(function () {
  'use strict';
  const X = window.RRGame, G = X.G;
  const $ = id => document.getElementById(id);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const RULES = {
    ship: 'Derriba el barco y su tesoro dorado. Su cañón se carga con cada tiro y con el tiempo: cada cañonazo te quita una bola.',
    pyramid: 'Rompe bloques del color de su escudo antes de que cambie (cada 2 tiros) para abrirlo y dispara a la máscara de oro. Cinco golpes y cae. Cuidado con su maldición de arena.',
    golem: 'Camina de lado a lado. Sus 3 núcleos de lava se encienden de uno en uno: revienta el encendido antes de que cargue el golpe sísmico, o derriba todos sus bloques de colores.',
    golemArmor: 'Camina de lado a lado. Sus 3 núcleos de lava se encienden de uno en uno y llevan coraza: dale varias veces al encendido, o derriba todos sus bloques de colores.',
    brush: 'Revienta bloques para cargar su paleta. Cuando brille la mancha, dale con una bola de ESE color: le quitas una vida. Cada 3 tiros repinta una fila de tu muro.',
    crane: 'Revienta bloques para que la grúa traiga el contenedor. Dale para que caiga: la grúa se queda aturdida y entonces dispárale a la cabina.',
    nimbo: 'Con cada tiro se carga un poco. Al tercer tiro, dale al pararrayos: le devuelves el rayo y pierde una vida. Si fallas, te suelta la descarga y te quita 2 bolas.',
    nut: 'Mientras sonríe es inmune. Cada bloque que derribas llena una barra (un tiro puede llenar las 3): con las 3 se enfada y entonces dispárale a la cara para quitarle una vida. Si fallas 2 tiros, vuelve a sonreír.',
  };
  // colores del escudo del faraón
  const PC = { r: { hex: 0xff4f6d, css: '#ff4f6d', name: 'ROJO' }, b: { hex: 0x3d9bff, css: '#3d9bff', name: 'AZUL' }, g: { hex: 0x5fd45a, css: '#5fd45a', name: 'VERDE' }, y: { hex: 0xffd23f, css: '#e8b400', name: 'AMARILLO' }, p: { hex: 0xa66bff, css: '#a66bff', name: 'MORADO' } };
  const MASK = { y: 8.4, r: 1.05 }, HITS = 5, NEED = [4, 5, 6, 7, 8], ROT = 2, CURSE = 3;
  // color de la roca del gólem según el paisaje
  const GOLEM_SKIN = { snow: [0xbfe0ff, 0.2, 0.2], space: [0xb8bcd0, 0.8, 0.3], candy: [0xffa8d8, 0, 0.4], temple: [0x9aa86a, 0, 0.9], neon: [0x3a3a5a, 0.7, 0.3], volcano: [0x3b3236, 0, 0.9], desert: [0xd8b078, 0, 0.9], reef: [0xff8aa8, 0, 0.7], dino: [0xd8902a, 0.1, 0.25], forest: [0x5a7a4a, 0, 0.9], orchard: [0x8ac84a, 0, 0.6] };
  const css = `
  body.bossmode #meter{visibility:hidden}
  #bossBar{position:fixed;left:50%;transform:translateX(-50%);top:calc(max(10px,var(--sat,env(safe-area-inset-top))) + 64px);width:min(94vw,460px);z-index:4;display:none;pointer-events:none}
  #bossBar.on{display:block}
  .bbTop{display:flex;align-items:center;gap:8px;color:#fff;font-weight:900;font-size:16px;margin-bottom:5px;text-shadow:0 2px 0 rgba(0,0,0,.6)}
  .bbTop svg{width:30px;height:30px;flex:none;filter:drop-shadow(0 2px 0 rgba(0,0,0,.5))}
  #bbName{flex:1;-webkit-text-stroke:4px var(--panel-edge);paint-order:stroke fill;font-size:18px;letter-spacing:.01em}
  #bbPhase{font-size:12px;background:var(--panel-edge);border:2px solid rgba(255,255,255,.35);border-radius:999px;padding:3px 9px;letter-spacing:.06em}
  #bbExit{pointer-events:auto;width:30px;height:30px;border-radius:50%;border:3px solid var(--panel-edge);background:#ff4f6d;color:#fff;font-weight:900;font-size:14px;cursor:pointer;font-family:inherit;padding:0;box-shadow:0 3px 0 var(--panel-edge)}
  .bbHp{position:relative;height:24px;border-radius:12px;border:4px solid var(--panel-edge);background:#3a2a5a;overflow:hidden;box-shadow:0 4px 0 var(--panel-edge)}
  #bbLag{position:absolute;inset:0 auto 0 0;background:#fff3b0;transition:width .7s ease .25s}
  #bbFill{position:absolute;inset:0 auto 0 0;background:linear-gradient(180deg,#ff8a9a,#ff3355 55%,#c4123a);transition:width .25s}
  .bbHp.hit{animation:bbhit .35s}
  @keyframes bbhit{0%,100%{transform:none}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
  .bbSeg{position:absolute;top:0;bottom:0;width:4px;margin-left:-2px;background:var(--panel-edge)}
  #bbPct{position:absolute;right:8px;top:50%;transform:translateY(-50%);color:#fff;font-weight:900;font-size:13px;text-shadow:0 1px 0 #000}
  #bbSub{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:8px;color:#fff;font-weight:900;font-size:13px;text-shadow:0 2px 0 rgba(0,0,0,.6)}
  .pip{width:16px;height:16px;border-radius:50%;border:3px solid var(--panel-edge);background:#5a4a7a}
  .pip.on{background:radial-gradient(circle at 35% 35%,#ffb4a0,#ff3a1a 60%,#8a1000)}
  .pip.warn{animation:pipw .5s infinite alternate}
  @keyframes pipw{to{transform:scale(1.25)}}
  .chg{width:150px;height:14px;border-radius:8px;border:3px solid var(--panel-edge);background:#3a2a5a;overflow:hidden}
  .chg i{display:block;height:100%;background:linear-gradient(90deg,#ffb03a,#ff4a1a)}
  .chg.full i{animation:chgf .25s infinite alternate}
  .npips{display:inline-flex;gap:5px;align-items:center}
  .npips i{display:block;width:30px;height:14px;border-radius:6px;border:3px solid var(--panel-edge);background:#3a2a5a}
  .npips.prog i.on{background:linear-gradient(180deg,#fff6c0,#ffd23f 55%,#e89a00);box-shadow:0 0 8px #ffd23f;animation:npop .35s ease-out}
  .npips.miss i.on{background:#ff3a4a;box-shadow:0 0 8px #ff3a4a;animation:npop .35s ease-out}
  @keyframes npop{0%{transform:scale(1.8)}100%{transform:scale(1)}}
  @keyframes chgf{to{filter:brightness(1.8)}}
  .shchip{padding:3px 10px;border-radius:999px;border:3px solid var(--panel-edge);color:#fff;-webkit-text-stroke:3px var(--panel-edge);paint-order:stroke fill}

  #bossIntro{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:8;width:min(90vw,400px);text-align:center;pointer-events:none;display:none}
  #bossIntro.on{display:block;animation:biIn 3.6s ease forwards}
  @keyframes biIn{0%{opacity:0;transform:translate(-50%,-50%) scale(.6)}10%{opacity:1;transform:translate(-50%,-50%) scale(1.06)}16%{transform:translate(-50%,-50%) scale(1)}85%{opacity:1}100%{opacity:0;transform:translate(-50%,-60%) scale(1)}}
  .biTag{display:inline-block;font-weight:900;font-size:13px;letter-spacing:.16em;color:#fff;background:#ff3355;border:3px solid var(--panel-edge);border-radius:999px;padding:4px 12px;box-shadow:0 3px 0 var(--panel-edge)}
  .biName{margin:8px 0 6px;font-size:clamp(30px,9vw,44px);font-weight:900;line-height:1;color:#fff;-webkit-text-stroke:7px var(--panel-edge);paint-order:stroke fill;text-shadow:0 5px 0 var(--panel-edge)}
  .biRule{background:var(--panel);color:var(--ink);border:4px solid var(--panel-edge);border-radius:16px;padding:10px 12px;font-weight:800;font-size:14.5px;line-height:1.35;box-shadow:0 5px 0 var(--panel-edge)}

  #bossBanner{position:fixed;left:0;right:0;top:38%;z-index:8;text-align:center;pointer-events:none;display:none}
  #bossBanner.on{display:block;animation:bbn 2.2s ease forwards}
  @keyframes bbn{0%{opacity:0;transform:scale(1.6)}12%{opacity:1;transform:scale(1)}80%{opacity:1}100%{opacity:0;transform:translateY(-20px)}}
  #bossBanner b{display:block;font-size:clamp(28px,8vw,42px);font-weight:900;color:#fff;-webkit-text-stroke:7px var(--panel-edge);paint-order:stroke fill;text-shadow:0 5px 0 var(--panel-edge)}
  #bossBanner span{display:inline-block;max-width:86vw;margin-top:8px;font-weight:900;font-size:15px;color:var(--ink);background:var(--panel);border:4px solid var(--panel-edge);border-radius:12px;padding:6px 12px;box-shadow:0 4px 0 var(--panel-edge)}

  #bossSand{position:fixed;inset:0;z-index:3;pointer-events:none;display:none;background:linear-gradient(100deg,rgba(255,200,120,0) 0%,rgba(230,170,90,.75) 35%,rgba(255,215,150,.6) 55%,rgba(255,200,120,0) 80%);background-size:250% 100%}
  #bossSand.on{display:block;animation:sand 1.8s ease-in-out forwards}
  .eye{width:22px;height:14px;flex:none}
  .shchip.sm{padding:1px 7px;font-size:11px;border-width:2px;-webkit-text-stroke:2px var(--panel-edge)}
  .shcnt{font-size:15px}
  .openGo{color:#ffd23f;font-size:15px;animation:pipw .4s infinite alternate}
  .curse{background:#c8a060;border:2px solid var(--panel-edge);border-radius:999px;padding:1px 7px;font-size:12px;color:#fff;-webkit-text-stroke:2px var(--panel-edge);paint-order:stroke fill}
  @keyframes sand{0%{background-position:120% 0;opacity:0}20%{opacity:1}80%{opacity:1}100%{background-position:-60% 0;opacity:0}}

`;
  document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);
  const SKULL = '<svg viewBox="0 0 32 32"><path d="M4 7l5 4 3-7 4 6 4-6 3 7 5-4-2 12H6z" fill="#ffd23f" stroke="#2a1d5c" stroke-width="2.4" stroke-linejoin="round"/><rect x="6" y="18" width="20" height="9" rx="3" fill="#ff4f6d" stroke="#2a1d5c" stroke-width="2.4"/><circle cx="12" cy="22.5" r="2" fill="#2a1d5c"/><circle cx="20" cy="22.5" r="2" fill="#2a1d5c"/></svg>';
  document.body.insertAdjacentHTML('beforeend', `
    <div id="bossBar"><div class="bbTop">${SKULL}<b id="bbName"></b><span id="bbPhase"></span></div>
      <div class="bbHp" id="bbHp"><div id="bbLag"></div><div id="bbFill"></div><div id="bbSegs"></div><span id="bbPct"></span></div><div id="bbSub"></div></div>
    <div id="bossIntro"></div><div id="bossBanner"></div><div id="bossSand"></div>`);

  let S = null;
  const banner = (big, small) => { const el = $('bossBanner'); el.innerHTML = `<b>${big}</b>${small ? `<span>${small}</span>` : ''}`; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); };
  const tr = t => (window.I18N && I18N.t ? I18N.t(t) : t);
  const ft = (x, y, z, txt, col, size) => X.floatText(x, y, z, txt, col, size || 22, true, true);
  const centerOf = () => {
    const live = S.sim.liveBlocks(); if (!live.length) return { x: 0, y: 1.5, z: 0 };
    let x = 0, y = 0, z = 0; for (const b of live) { x += b.position.x; y += b.position.y; z += b.position.z; }
    return { x: x / live.length, y: y / live.length, z: z / live.length };
  };

  function stop() {
    if (S) for (const o of S.extras) { if (o.parent) o.parent.remove(o); }
    if (X.auxLight && X.auxLight.userData.owner === 'boss') { X.auxLight.intensity = 0; X.auxLight.userData.owner = null; }
    X.aimObjs.length = 0;
    S = null;
    document.body.classList.remove('bossmode');
    for (const id of ['bossBar', 'bossIntro', 'bossBanner', 'bossSand']) $(id).classList.remove('on');
  }
  function start(L) {
    stop();
    const sim = G.sim;
    S = { key: L.boss, L, sim, t: 0, counted: new Set(), extras: [], hp: 1, done: false, phase: 1, center: centerOf, removed: 0, gold: 0 };
    S.total = sim.blocks.filter(b => b.userData.kind !== 'stone').length;
    S.d = L.bossD || 0;                // dificultad del jefe: sube cada vez que se repite en mundos más altos (0 → 1)
    if (S.key === 'ship') { S.charge = 0; S.lastShots = 0; S.ball = null; initShip(); }
    if (S.key === 'pyramid') initPyramid();
    if (S.key === 'golem') initGolem();
    if (SPOT[S.key]) initSpot();
    document.body.classList.add('bossmode');
    $('hudLevel').textContent = 'JEFE';
    $('bbName').textContent = L.bossName;
    const segs = S.key === 'ship' ? [50] : S.key === 'pyramid' ? [20, 40, 60, 80] : S.nut || SPOT[S.key] ? Array.from({ length: S.lives - 1 }, (_, i) => (i + 1) * 100 / S.lives) : [33.33, 66.66];
    $('bbSegs').innerHTML = segs.map(x => `<div class="bbSeg" style="left:${x}%"></div>`).join('');
    $('bossBar').classList.add('on');
    const intro = $('bossIntro');
    intro.innerHTML = `<span class="biTag">JEFE FINAL</span><div class="biName">${L.bossName}</div><div class="biRule">${RULES[S.nut ? 'nut' : S.key === 'golem' && S.armor ? 'golemArmor' : S.key]}</div>`;
    intro.classList.remove('on'); void intro.offsetWidth; intro.classList.add('on');
    S.introT = 3.4;
    X.Audio.horn && X.Audio.horn();
    // Navidad: Cascanueces, Caja Sorpresa y Capitán Escarcha (christmas.js cambia el aspecto; el combate es el mismo)
    if (L.xm && window.Christmas && window.Christmas.boss) window.Christmas.boss(S);
    updateBar(true);
  }

  function victory() {
    S.done = true;
    const sim = S.sim, c = S.center();
    const left = sim.queue.length;
    G.bossStars = left >= 3 ? 3 : left >= 1 ? 2 : 1;
    G.slowT = 1.4; G.shake = Math.max(G.shake, 1);
    sim.sinceFire = -1000;          // ya no se dispara (y sin vaciar la bandeja, para que no cuente como derrota)
    sim.explode(c.x, c.y, c.z, 3.4, true);
    sim.later(0.35, () => sim.explode(c.x - 1.5, c.y + 1.5, c.z, 2.6, true));
    sim.later(0.6, () => sim.explode(c.x + 1.5, c.y + 0.5, c.z, 2.6, true));
    X.Audio.win && X.Audio.win(); X.vibe && X.vibe([60, 40, 120]);
    banner('¡JEFE DERROTADO!', 'Recompensa: cofre de oro');
    $('bossBar').classList.remove('on');
    const me = S;
    setTimeout(() => {
      if (S !== me || G.mode !== 'play') return;
      const r = { coins: 250, gems: 5, golden: 1, bomb: 1 };
      const s = X.save; s.coins += r.coins; s.gems = (s.gems || 0) + r.gems;
      s.boosters = s.boosters || {}; s.boosters.golden = (s.boosters.golden || 0) + 1; s.boosters.bomb = (s.boosters.bomb || 0) + 1;
      X.persist(); X.setCoins();
      X.openChestFX('gold', r, () => { if (S !== me) return; X.bossWin(left); });
    }, 2600);
  }

  function shipTick(dt) {
    const sim = S.sim;
    if (S.hull) { S.hull.rotation.z = Math.sin(S.t * 0.9) * 0.012; if (S.flag) S.flag.rotation.y = Math.sin(S.t * 3) * 0.25; }
    S.hp = Math.max(0, 1 - Math.min(1, S.removed / (0.95 * S.total) + S.gold * 0.2));
    if (S.phase === 1 && S.hp < 0.5) { S.phase = 2; banner('¡A TODA VELA!', 'Ahora carga el cañón mucho más rápido'); X.Audio.horn && X.Audio.horn(); G.shake = Math.max(G.shake, 0.4); }
    // el cañón se carga con cada tiro y con el tiempo (sin disparar también acaba disparando); más rápido en los jefes de mundos altos
    const d = S.d, rage = S.phase === 2 ? 1.35 : 1;           // con la mitad de los bloques derribados carga más rápido
    const every = 3.5 - d, full = 25 - 8 * d;                 // tiros y segundos que harían falta para cargarlo (cada uno por su cuenta)
    const shotsNow = sim.shots - S.lastShots; S.lastShots = sim.shots;
    if (!S.ball && !S.done && S.introT <= 0) S.charge = Math.min(1, S.charge + (shotsNow / every + dt / full) * rage);
    if (!S.ball && !S.done && S.charge >= 1 && (sim.balls.length === 0 || sim.sinceFire > 1.6)) { S.charge = 0; fireCannonball(); }
    if (S.ball) {
      const B = S.ball; B.t += dt / 1.25;
      const k = Math.min(1, B.t), p = B.mesh.position;
      p.set(B.a.x + (B.b.x - B.a.x) * k, B.a.y + (B.b.y - B.a.y) * k + Math.sin(Math.PI * k) * 5, B.a.z + (B.b.z - B.a.z) * k);
      B.mesh.rotation.x += dt * 8;
      if (Math.random() < 0.5) X.spawnSprite(p.x, p.y, p.z, 0x6a6470, 0.5, 1.6, 0.6, { alpha: 0.5 });
      if (k >= 1) {
        B.mesh.parent && B.mesh.parent.remove(B.mesh); S.ball = null;
        G.shake = Math.max(G.shake, 0.8); X.Audio.explode && X.Audio.explode(); X.vibe && X.vibe([40, 30, 80]);
        X.spawnDebris(p.x, p.y, p.z, 0x3a3440, 14, 6, 0.2, 1);
        X.spawnSprite(p.x, p.y, p.z, 0xffa040, 2.4, 1.4, 0.35, { add: true });
        if (sim.queue.length > 1) { sim.queue.pop(); X.refreshTray(); ft(p.x, p.y + 0.6, p.z - 1.5, '-1 BOLA', '#ff4f6d', 26); }
        else ft(p.x, p.y + 0.6, p.z - 1.5, '¡FALLÓ!', '#ffffff', 22);
      }
    }
    S.sub = `<span>CAÑONAZO</span><span class="chg${S.charge > 0.8 ? ' full' : ''}"><i style="width:${Math.round(S.charge * 100)}%"></i></span>${S.ball ? '<span style="color:#ffb050">¡FUEGO!</span>' : ''}`;
  }
  function initShip() {
    const g = new THREE.Group();
    const sh = new THREE.Shape();
    sh.moveTo(-4.3, 1.55); sh.lineTo(3.95, 1.55); sh.lineTo(3.85, 0.9); sh.quadraticCurveTo(3.4, -0.05, 2.4, -0.1);
    sh.lineTo(-2.2, -0.1); sh.quadraticCurveTo(-3.6, 0.1, -4.3, 1.55);
    const HULL = { candy: 0xff8ac8, neon: 0x2a2a48, fair: 0xd8463a, forest: 0x5a7a3a, crystal: 0x8a6ad8, toys: 0xe8372c, reef: 0x3a6a6a };
    const wood = new THREE.MeshStandardMaterial({ color: HULL[S.L.biome] || 0x9a5f2c, roughness: 0.75 }), dark = new THREE.MeshStandardMaterial({ color: 0x5e3416, roughness: 0.8 });
    const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 3.1, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 }), wood);
    hull.position.z = -1.55; hull.castShadow = hull.receiveShadow = true; g.add(hull);
    for (const zz of [1.62, -1.62]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.16, 0.06), dark); band.position.set(-0.1, 1.05, zz); g.add(band);
      const band2 = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.1, 0.06), dark); band2.position.set(0.1, 0.35, zz); g.add(band2);
    }
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 0.6, roughness: 0.3 }), hole = new THREE.MeshBasicMaterial({ color: 0x241408 });
    for (const x of [-2.1, -0.7, 0.7, 2.1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 20), gold); ring.position.set(x, 0.7, 1.66); g.add(ring);
      const h = new THREE.Mesh(new THREE.CircleGeometry(0.17, 18), hole); h.position.set(x, 0.7, 1.665); g.add(h);
    }
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 7.6, 10), dark); mast.position.set(0, 5.2, -1.05); mast.castShadow = true; g.add(mast);
    const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.6, 8), dark); yard.rotation.z = Math.PI / 2; yard.position.set(0, 7.9, -1.05); g.add(yard);
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 84; const c = cv.getContext('2d');
    c.fillStyle = '#1d1430'; c.fillRect(0, 0, 128, 84); c.fillStyle = '#fff';
    c.beginPath(); c.arc(64, 36, 17, 0, Math.PI * 2); c.fill(); c.fillRect(54, 44, 20, 14);
    c.fillStyle = '#1d1430'; c.beginPath(); c.arc(57, 35, 5, 0, 7); c.arc(71, 35, 5, 0, 7); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(36, 62); c.lineTo(92, 78); c.moveTo(92, 62); c.lineTo(36, 78); c.stroke();
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })); flag.position.set(0.8, 8.45, -1.05); g.add(flag); S.flag = flag;
    X.world.add(g); S.extras.push(g); S.hull = g;
  }
  function fireCannonball() {
    const cp = G.level.cannon;
    const a = { x: rnd(-2.5, 2.5), y: 3.2, z: 0.6 }, b = { x: cp.x + rnd(-0.6, 0.6), y: cp.y + 0.6, z: cp.z - 0.4 };
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.38, 18, 12), new THREE.MeshStandardMaterial({ color: 0x24212b, metalness: 0.6, roughness: 0.35 }));
    mesh.position.set(a.x, a.y, a.z); mesh.castShadow = true; X.scene.add(mesh); S.extras.push(mesh);
    S.ball = { mesh, a, b, t: 0 };
    X.spawnSprite(a.x, a.y, a.z + 0.4, 0xffb050, 2, 1.6, 0.3, { add: true });
    for (let i = 0; i < 6; i++) X.spawnSprite(a.x + rnd(-0.5, 0.5), a.y + rnd(0, 0.5), a.z + 0.6, 0xe8e2f0, 0.9, 2.2, 1, { vy: 0.8, alpha: 0.6 });
    X.Audio.thud && X.Audio.thud(9, true); X.Audio.shoot && X.Audio.shoot();
    G.shake = Math.max(G.shake, 0.25);
    ft(a.x, a.y + 1.2, a.z, '¡CAÑONAZO!', '#ffb050', 24);
  }

  // ---------- Faraón: la vida está en su máscara de oro; la pirámide es su armadura ----------
  // Su escudo es de un color que cambia cada 2 tiros (el ojo de la máscara avisa del siguiente). Al romper
  // bastantes bloques de ese color el escudo cae unos tiros y se puede golpear la máscara. Tras cada golpe la
  // arena reconstruye parte de la pirámide, así que nunca se queda sin bloques.
  function liveColors() {
    const n = {};
    for (const b of S.sim.liveBlocks()) { const d = b.userData; if (d.kind === 'block' && !d.popping && PC[d.c]) n[d.c] = (n[d.c] || 0) + 1; }
    return n;
  }
  // ayuda del faraón: en el primero el escudo siempre cambia a un color del que tienes bolas; en los siguientes, cada vez menos
  const helpOn = () => Math.random() < (S.help || 0);
  function pickColor(excl) {
    const n = liveColors(), q = S.sim.queue.slice(0, 4), have = new Set(S.sim.queue.filter(k => PC[k]));
    const onlyHave = helpOn() && Object.keys(n).some(c => c !== excl && n[c] >= 2 && have.has(c));
    let best = null, bw = -1;
    for (const c of Object.keys(n)) {
      if (c === excl || n[c] < 2) continue;
      if (onlyHave && !have.has(c)) continue;
      const w = Math.min(n[c], 8) + (q.includes(c) ? 6 : 0) + Math.random() * 4;
      if (w > bw) { bw = w; best = c; }
    }
    return best || Object.keys(n).find(c => c !== excl) || excl || 'r';
  }
  function maskMesh() {
    const g = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 0.75, roughness: 0.28, emissive: 0x3a2200 });
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const c = cv.getContext('2d');
    for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#2a4fd8' : '#ffc83d'; c.fillRect(0, i * 8, 64, 8); }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const stripes = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.5, roughness: 0.35 });
    // tocado de rayas (nemes) visto de frente: ancho abajo, redondeado arriba
    const sh = new THREE.Shape();
    sh.moveTo(-1.15, -1.05); sh.lineTo(-0.85, 0.2); sh.quadraticCurveTo(-0.85, 1.05, 0, 1.08); sh.quadraticCurveTo(0.85, 1.05, 0.85, 0.2); sh.lineTo(1.15, -1.05); sh.lineTo(-1.15, -1.05);
    const nemes = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 }), stripes);
    nemes.position.z = -0.45; nemes.castShadow = true; g.add(nemes);
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.98, 1.12, 0.36), gold); face.position.set(0, 0.02, 0.18); g.add(face);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.12, 0.42), gold); brow.position.set(0, 0.62, 0.2); g.add(brow);
    const kohl = new THREE.MeshBasicMaterial({ color: 0x1a1030 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2 });
    for (const sx of [-1, 1]) {
      const k = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.04), kohl); k.position.set(sx * 0.24, 0.28, 0.375); g.add(k);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.04), kohl); tail.position.set(sx * 0.46, 0.25, 0.375); tail.rotation.z = sx * -0.35; g.add(tail);
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.05), eyeMat); e.position.set(sx * 0.24, 0.28, 0.39); g.add(e);
    }
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.12), gold); nose.position.set(0, 0.02, 0.4); g.add(nose);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.04), kohl); mouth.position.set(0, -0.28, 0.375); g.add(mouth);
    const beard = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.62, 10), stripes); beard.position.set(0, -0.84, 0.2); g.add(beard);
    // cobra de la frente
    const cobra = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.11, 0.34, 8), gold); cobra.position.set(0, 0.86, 0.4); g.add(cobra);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshStandardMaterial({ color: 0x2a4fd8, metalness: 0.5, roughness: 0.3 })); hood.position.set(0, 1.04, 0.42); g.add(hood);
    // zona de tiro (invisible): se puede apuntar a la máscara directamente
    const hit = new THREE.Mesh(new THREE.SphereGeometry(MASK.r, 12, 10), new THREE.MeshBasicMaterial({ visible: false })); g.add(hit);
    const halo = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.55, 40), new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    halo.position.z = -0.5; g.add(halo);
    g.userData = { gold, eyeMat, hit, halo };
    return g;
  }
  function initPyramid() {
    const sim = S.sim;
    S.hits = 0; S.prog = 0; S.open = false; S.immuneT = 0; S.rebuildT = 0; S.flash = 0; S.curseAt = 0;
    S.mpos = { x: 0, y: MASK.y, z: 0 };
    S.curse = S.d >= 0.66 ? 2 : CURSE; S.needAdd = S.d >= 0.5 ? 1 : 0; S.spin = 1 + 0.4 * S.d;
    S.help = Math.max(0, 1 - S.d * 1.6);                // 1 en el primer faraón, nada a partir de los dos tercios del juego
    S.windShots = Math.round(2 + 4 * S.d); S.windUntil = -1;   // la tormenta dura 2 tiros en el primero y hasta 6 en los últimos
    S.slots = S.L.blocks.filter(b => b.c && !b.t).map(b => ({ x: b.x, y: b.y, z: b.z }));
    S.shieldC = pickColor(null); S.nextC = pickColor(S.shieldC); S.rotAt = sim.shots;
    const g = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(5.2, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: PC[S.shieldC].hex, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    dome.scale.y = 1.8;
    const wire = new THREE.Mesh(new THREE.SphereGeometry(5.22, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: PC[S.shieldC].hex, wireframe: true, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending }));
    wire.scale.y = 1.8;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.08, 8, 64), new THREE.MeshBasicMaterial({ color: PC[S.shieldC].hex, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.06;
    g.add(dome, wire, ring); X.world.add(g); S.extras.push(g);
    S.shield = { g, dome, wire, ring, k: 1 };
    const mask = maskMesh(); mask.position.set(0, MASK.y, 0); X.world.add(mask); S.extras.push(mask); S.mask = mask;
    X.aimObjs.length = 0; X.aimObjs.push(mask.userData.hit);
    paintShield();
  }
  function paintShield() {
    const sh = S.shield, c = PC[S.shieldC];
    for (const m of [sh.dome, sh.wire, sh.ring]) m.material.color.setHex(c.hex);
    const n = PC[S.nextC] || c;
    S.mask.userData.eyeMat.color.setHex(n.hex); S.mask.userData.eyeMat.emissive.setHex(n.hex);
  }
  function rotateShield(force) {
    const n = liveColors();
    if (S.nextC && helpOn() && !S.sim.queue.includes(S.nextC)) S.nextC = null;      // ya no te quedan bolas de ese color: se elige otro
    S.shieldC = n[S.nextC] ? S.nextC : pickColor(S.shieldC);
    S.nextC = pickColor(S.shieldC); S.rotAt = S.sim.shots;
    paintShield();
    if (!force) {
      const c = PC[S.shieldC]; X.centerText('ESCUDO ' + c.name, c.css, 30); X.Audio.swap && X.Audio.swap();
      if (S.prog > 0) { S.prog--; ft(0, 4, 2, 'El escudo se recupera: ' + S.prog + '/' + (NEED[Math.min(HITS - 1, S.hits)] + (S.needAdd || 0)), '#e6e2f5', 20); }
    }
  }
  function openShield() {
    S.open = true; S.openAt = S.sim.shots; S.prog = 0;
    G.shake = Math.max(G.shake, 0.6); X.Audio.special && X.Audio.special(); X.vibe && X.vibe([40, 30, 60]);
    S.window = S.hits >= 3 && S.help < 0.5 ? 1 : 2;      // en los primeros faraones, siempre 2 tiros
    banner('¡ESCUDO ROTO!', 'Dispara a la máscara de oro: tienes ' + (S.window === 1 ? '1 tiro' : '2 tiros'));
    for (let r = 0; r < 3; r++) X.spawnRing(0, 0.2, 0, PC[S.shieldC].hex, 5 + r * 1.5, 0.5 + r * 0.2);
  }
  function closeShield(hit) {
    S.open = false; S.rotAt = S.sim.shots;
    rotateShield(true);
    if (!hit) { banner('¡ESCUDO RECUPERADO!', 'Vuelve a romper bloques de su color'); X.Audio.horn && X.Audio.horn(); }
  }
  // la arena del desierto rellena huecos de la pirámide: los más bajos primero
  function rebuild(n) {
    const sim = S.sim, live = sim.liveBlocks();
    const free = S.slots.filter(s => !live.some(b => Math.abs(b.position.x - s.x) < 0.8 && Math.abs(b.position.y - s.y) < 0.8 && Math.abs(b.position.z - s.z) < 0.8)
      && !sim.balls.some(b => Math.hypot(b.position.x - s.x, b.position.y - s.y, b.position.z - s.z) < 1.2));
    free.sort((a, b) => a.y - b.y || Math.abs(a.x) - Math.abs(b.x));
    const cols = [S.shieldC, S.nextC, S.shieldC, ...Object.keys(PC)];
    let k = 0;
    for (const s of free.slice(0, n)) {
      const want = k < 6 ? [cols[k % 3]] : [], pool = want.concat(Object.keys(PC).sort(() => Math.random() - 0.5));
      const same = c => live.filter(b => b.userData.c === c && Math.abs(b.position.x - s.x) < 1.6 && Math.abs(b.position.y - s.y) < 1.6 && Math.abs(b.position.z - s.z) < 1.6).length;
      let c = pool[0]; for (const q of pool) if (same(q) < same(c)) c = q;
      if (same(c) > 1) c = pool.reduce((a, q) => same(q) < same(a) ? q : a, pool[0]);
      live.push({ position: s, userData: { c } });          // para que los siguientes huecos también lo tengan en cuenta
      const delay = 0.15 + k * 0.07; k++;
      sim.later(delay, () => {
        if (!S || S.sim !== sim) return;
        const body = sim.addBlock({ x: s.x, y: s.y + 0.04, z: s.z, w: 1, h: 1, d: 1, c });
        X.addBlockView(body.userData);
        for (let i = 0; i < 5; i++) X.spawnSprite(s.x + rnd(-0.5, 0.5), s.y + rnd(0.3, 1.6), s.z + rnd(-0.3, 0.6), 0xe8c47a, 0.7, 1.4, 0.7, { vy: -1.5, alpha: 0.8 });
      });
    }
    if (k) { $('bossSand').classList.remove('on'); void $('bossSand').offsetWidth; $('bossSand').classList.add('on'); X.Audio.thud && X.Audio.thud(4, true); }
    S.rebuildT = 4;
    return k;
  }
  function hitMask(ball) {
    const sim = S.sim, p = S.mask.position;
    sim.killBall(ball, false);
    S.hits++; S.flash = 1;
    G.shake = Math.max(G.shake, 0.9); X.Audio.explode && X.Audio.explode(); X.Audio.crown && X.Audio.crown(); X.vibe && X.vibe([60, 40, 100]);
    X.spawnSprite(p.x, p.y, p.z + 0.6, 0xffe27a, 3, 1.4, 0.4, { add: true });
    X.spawnDebris(p.x, p.y, p.z + 0.4, 0xffc83d, 18, 6, 0.14, 1);
    for (let r = 0; r < 2; r++) X.spawnRing(p.x, p.y, p.z + 0.3, 0xffd23f, 2.5 + r * 1.5, 0.4 + r * 0.2);
    ft(p.x, p.y + 1.4, p.z, S.hits < HITS ? '¡GOLPE AL FARAÓN!' : '¡MÁSCARA ROTA!', '#ffd23f', 30);
    if (S.hits >= HITS) { S.hp = 0; return; }
    closeShield(true);
    const move = S.hits === 1 ? ' · ahora la máscara se mueve' : S.hits === 3 ? ' · ahora da vueltas a la pirámide' : '';
    banner('¡EL FARAÓN SE ENFURECE!', 'La arena reconstruye la pirámide · +' + (S.help >= 0.5 ? 4 : 3) + ' bolas' + move);
    X.Audio.horn && X.Audio.horn();
    sim.later(0.9, () => {
      if (!S || S.sim !== sim) return;
      rebuild(9 + S.hits * 2);
      sim.giveBalls(S.help >= 0.5 ? [S.shieldC, S.shieldC, S.nextC, S.nextC] : [S.shieldC, S.shieldC, S.nextC]); X.refreshTray();
      if (S.hits >= 2) {                       // desde la mitad del combate: tras cada golpe, una tormenta de arena con viento durante unos tiros
        sim.weather = 'sandstorm'; sim.windBase = (S.hits % 2 ? -1 : 1) * 4.2; S.windUntil = sim.shots + S.windShots;
        X.weatherChip && X.weatherChip('sandstorm'); X.weatherFx && X.weatherFx('sandstorm');
        sim.later(2.4, () => { if (S && S.sim === sim) banner('¡TORMENTA DE ARENA!', 'Durante ' + S.windShots + ' tiros el viento desvía la bola'); });
      }
    });
  }
  function maskTarget(t) {
    const bob = Math.sin(t * 1.6) * 0.18, tg = { x: 0, y: MASK.y + bob, z: 0 };
    if (S.hits >= 3) { const a = t * 0.45; tg.x = Math.sin(a) * 3.6; tg.z = Math.cos(a) * 3.6; tg.y = 6 + bob; }
    else if (S.hits >= 1) tg.x = Math.sin(t * 0.75) * 2.6;
    return tg;
  }
  function pyramidTick(dt) {
    const sim = S.sim, M = S.mask;
    S.phase = Math.min(HITS, S.hits + 1);
    const need = (NEED[Math.min(HITS - 1, S.hits)] + (S.needAdd || 0));
    S.hp = Math.max(0, (HITS - S.hits - (S.open ? 0.3 : 0.3 * Math.min(1, S.prog / need))) / HITS);
    if (S.hits >= HITS) S.hp = 0;
    // escudo: aparece y desaparece con suavidad
    const sh = S.shield; sh.k += ((S.open ? 0 : 1) - sh.k) * Math.min(1, dt * 5);
    sh.g.visible = sh.k > 0.02; sh.g.scale.setScalar(1 + (1 - sh.k) * 0.25);
    sh.dome.material.opacity = (0.08 + Math.sin(S.t * 3) * 0.03) * sh.k; sh.wire.material.opacity = 0.14 * sh.k; sh.ring.material.opacity = 0.9 * sh.k;
    sh.wire.rotation.y += dt * 0.25;
    // máscara: flota y mira al cañón; brilla cuando está al descubierto
    // la máscara: quieta (1.er golpe), de lado a lado (2.º y 3.º) y dando vueltas a la pirámide, a veces escondida detrás (4.º y 5.º)
    // con el escudo roto la máscara va más despacio, para que se le pueda dar
    S.mt = (S.mt || 0) + dt * (S.open ? 0.45 : 1) * S.spin;
    const tg = maskTarget(S.mt);
    const kk = Math.min(1, dt * 2.5);
    S.mpos.x += (tg.x - S.mpos.x) * kk; S.mpos.y += (tg.y - S.mpos.y) * kk; S.mpos.z += (tg.z - S.mpos.z) * kk;
    M.position.set(S.mpos.x, S.mpos.y, S.mpos.z); M.rotation.y = Math.sin(S.t * 0.7) * 0.12;
    S.flash = Math.max(0, S.flash - dt * 2.5);
    M.userData.gold.emissive.setHex(S.flash > 0 ? 0xffffff : S.open ? 0x8a5a00 : 0x3a2200);
    M.userData.gold.emissiveIntensity = S.flash > 0 ? S.flash * 2 : S.open ? 0.8 + Math.sin(S.t * 8) * 0.4 : 1;
    M.userData.halo.material.opacity = S.open ? 0.45 + Math.sin(S.t * 6) * 0.25 : 0;
    M.userData.halo.rotation.z += dt;
    M.scale.setScalar(1 + S.flash * 0.15 - (S.hits >= 3 ? 0 : 0));
    // bolas contra la máscara
    for (const b of sim.balls.slice()) {
      const d = b.userData, p = b.position, mp = M.position;
      if (d.dead || d.maskT > S.t) continue;
      const dx = p.x - mp.x, dy = p.y - mp.y, dz = p.z - mp.z, dist = Math.hypot(dx, dy, dz);
      if (dist > MASK.r + 0.34) continue;
      if (S.open && !S.done) { hitMask(b); break; }
      // con el escudo puesto rebota
      d.maskT = S.t + 0.5;
      const nx = dx / dist, ny = dy / dist, nz = dz / dist, vn = b.velocity.x * nx + b.velocity.y * ny + b.velocity.z * nz;
      if (vn < 0) { b.velocity.x -= 1.6 * vn * nx; b.velocity.y -= 1.6 * vn * ny; b.velocity.z -= 1.6 * vn * nz; }
      ft(mp.x, mp.y + 1.3, mp.z, '¡INMUNE!', '#e6e2f5', 22); X.Audio.thud && X.Audio.thud(5, true);
      X.spawnRing(mp.x, mp.y, mp.z + 0.4, PC[S.shieldC].hex, 2.2, 0.35);
    }
    if (S.done) return;
    const idle = sim.balls.length === 0 && sim.pending.length === 0;
    if (S.open) {
      if (sim.shots - S.openAt >= S.window && idle && sim.sinceFire > 1.2) closeShield(false);
    } else {
      const n = liveColors(), total = Object.values(n).reduce((a, b) => a + b, 0);
      S.rebuildT -= dt;
      // se queda sin bloques: la arena rellena la pirámide (nunca se atasca)
      if (total < 16 && S.rebuildT <= 0 && idle) { if (rebuild(12)) ft(0, 3, 1, '¡LA ARENA LA RECONSTRUYE!', '#ffe6a0', 24); }
      if (!n[S.shieldC] && S.rebuildT <= 3.5) rotateShield(true);                     // ya no quedan de ese color
      else if (sim.shots - S.rotAt >= ROT && idle && sim.sinceFire > 1) rotateShield();
    }
    // la tormenta amaina
    if (S.windUntil >= 0 && sim.shots >= S.windUntil && idle && sim.sinceFire > 1) {
      S.windUntil = -1; sim.weather = null; sim.windBase = 0; sim.wind = 0;
      X.weatherFx && X.weatherFx(null); ft(0, 5, 2, 'La tormenta amaina', '#ffe6a0', 22);
    }
    // maldición de arena: cada 3 tiros convierte una bola de color de la bandeja en bola de arena (no revienta nada, solo empuja)
    if (!S.done && sim.shots - S.curseAt >= S.curse && idle && sim.sinceFire > 1.4) {
      S.curseAt = sim.shots;
      const idx = sim.queue.map((k, i) => i).filter(i => i > 0 && PC[sim.queue[i]]);
      if (idx.length) {
        const i = idx[Math.floor(Math.random() * idx.length)]; sim.queue[i] = 'sand'; X.refreshTray();
        X.centerText('¡MALDICIÓN DE ARENA!', '#e8c47a', 28); X.Audio.thud && X.Audio.thud(6, true); X.vibe && X.vibe([30, 30, 30]);
        $('bossSand').classList.remove('on'); void $('bossSand').offsetWidth; $('bossSand').classList.add('on');
      }
    }
    const c = PC[S.shieldC], nc = PC[S.nextC] || c, left = ROT - (sim.shots - S.rotAt), cl = Math.max(1, S.curse - (sim.shots - S.curseAt)), wl = Math.max(0, (S.window || 2) - (sim.shots - S.openAt));
    const CURSE_I = `<span class="curse" title="Maldición de arena">⌛${cl}</span>`;
    const EYE = `<svg class="eye" viewBox="0 0 22 14"><path d="M1 7Q11-3 21 7Q11 17 1 7z" fill="#fff" stroke="#2a1d5c" stroke-width="2"/><circle cx="11" cy="7" r="3.4" fill="${nc.css}" stroke="#2a1d5c" stroke-width="1.5"/></svg>`;
    S.sub = S.open
      ? `<span class="openGo">¡A LA MÁSCARA!</span><span style="opacity:.85">${wl} tiro${wl === 1 ? '' : 's'}</span>${CURSE_I}`
      : `<span class="shchip" style="background:${c.css}">${c.name}</span><span class="shcnt">${Math.min(S.prog, need)}/${need}</span>${EYE}<span class="shchip sm" style="background:${nc.css}">${nc.name}</span><span style="opacity:.75">en ${Math.max(1, left)}</span>${CURSE_I}`;
  }

  let coreMat = null, sealedMat = null;
  const CORE_WAIT = 3.2;      // segundos hasta que se enciende el siguiente núcleo (pasa el aturdimiento y da un respiro)
  // enciende el siguiente núcleo sellado que quede
  function nextCore(first) {
    const sim = S.sim;
    const id = S.order.find(i => { const d = sim.blocks[i].userData; return d.sealed && d.alive && !d.destroyed && !S.counted.has(i); });
    S.activeCore = id === undefined ? null : id;
    if (S.activeCore === null) return;
    const b = sim.blocks[id], d = b.userData, m = G.meshes[id];
    d.kind = 'gold'; d.sealed = false; d.armor = S.armor; b.wakeUp();
    if (m) { m.userData.body.material = coreMat; m.scale.setScalar(1); }
    if (!first) {
      const p = b.position;
      for (let k = 0; k < 10; k++) X.spawnSprite(p.x + rnd(-0.4, 0.4), p.y + rnd(-0.4, 0.4), p.z + 0.5, 0xff7a2a, 0.7, 1.4, 0.5, { add: true });
      ft(p.x, p.y + 1.2, p.z + 0.5, '¡NÚCLEO ENCENDIDO!', '#ffb050', 24);
    }
  }
  function initGolem() {
    const sim = S.sim;
    S.plats = sim.world.bodies.filter(b => b.userData && b.userData.kind === 'plat');
    S.plat = S.plats.find(b => b.userData.w === 6);
    if (S.plat) {
      for (const p of S.plats) { p.type = CANNON.Body.KINEMATIC; p.updateMassProperties(); }
      sim.world.allowSleep = false; sim.wakeAll();
      const g = new THREE.Group();
      const slab = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 3), new THREE.MeshStandardMaterial({ color: 0x3b3236, roughness: 0.9 }));
      slab.castShadow = slab.receiveShadow = true; g.add(slab);
      const lava = new THREE.MeshBasicMaterial({ color: 0xff6a1a });
      for (const [x, w] of [[-1.8, 1.4], [0.4, 2], [2.2, 0.9]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.08), lava); c.position.set(x, 0.17, 1.52); g.add(c); }
      X.world.add(g); S.extras.push(g); S.slab = g;
    }
    coreMat = coreMat || new THREE.MeshStandardMaterial({ color: 0xff7a2a, emissive: 0xff3a00, emissiveIntensity: 1.6, roughness: 0.4 });
    S.cores = sim.blocks.filter(b => b.userData.kind === 'gold').map(b => b.userData.id);
    // del primero al último: los núcleos llevan coraza (1 golpe en el primero, 2 desde el 4.º gólem, 3 desde el 8.º)
    S.armor = S.d < 0.3 ? 0 : S.d < 0.7 ? 1 : 2;
    // solo hay un núcleo encendido cada vez (primero los de delante); los demás están sellados en roca hasta que les toca
    S.order = S.cores.slice().sort((a, b) => sim.blocks[b].position.z - sim.blocks[a].position.z || sim.blocks[b].position.y - sim.blocks[a].position.y);
    sealedMat = sealedMat || new THREE.MeshStandardMaterial({ color: 0x4a2a1c, emissive: 0x1a0600, roughness: 0.85 });
    for (const id of S.cores) { const d = sim.blocks[id].userData; d.kind = 'stone'; d.sealed = true; const m = G.meshes[id]; if (m) m.userData.body.material = sealedMat; }
    S.activeCore = null;
    // Navidad: el Cascanueces no tiene núcleos (se quedan sellados, como parte del cuerpo): se le pega en la cara (initNut)
    S.nut = !!S.L.xm;
    if (S.nut) initNut(); else nextCore(true);
    const sk = GOLEM_SKIN[S.L.biome];
    if (sk) { const rock = new THREE.MeshStandardMaterial({ color: sk[0], metalness: sk[1], roughness: sk[2] }); for (const b of sim.blocks) if (b.userData.kind === 'stone') { const m = G.meshes[b.userData.id]; if (m) m.userData.body.material = rock; } }
    // la luz del gólem es la luz de apoyo del juego (siempre en la escena): añadir una luz nueva obligaría a recompilar todos los shaders
    const light = X.auxLight; light.color.set(0xff5a10); light.intensity = 6; light.distance = 9; light.position.set(0, 5, 2); light.userData.owner = 'boss'; S.light = light;
    S.walk = 0; S.stun = 0; S.charge = 0; S.coresHit = 0;
    // las piezas del gólem agarran más entre sí: al caminar no se le desmonta el cuerpo solo
    for (const b of sim.blocks) if (b.material) { b.material.friction = 1; b.linearDamping = Math.max(b.linearDamping, 0.08); }
    // sitio de cada núcleo dentro del cuerpo (relativo a la losa, que camina)
    const px0 = S.plat ? S.plat.position.x : 0;
    S.px0 = px0; sim.carrierDX = 0;                  // lo que ha caminado la losa: sus bloques no cuentan como «movidos»
    S.home = {}; S.rest = {};
    for (const id of S.cores) { const b = sim.blocks[id]; S.home[id] = { x: b.position.x - px0, y: b.position.y, z: b.position.z }; S.rest[id] = 0; }
  }
  // un núcleo que se cae del gólem (detrás, a un lado o al suelo) no se queda inalcanzable: sube flotando delante del gólem
  // y se queda allí, siguiéndolo, hasta que le das
  function looseCores(dt) {
    const sim = S.sim, px = S.plat ? S.plat.position.x : 0;
    S.cores.forEach((id, i) => {
      const b = sim.blocks[id], d = b.userData, h = S.home[id];
      if (!d.alive || d.destroyed || d.popping || S.counted.has(id)) return;
      if (d.floatCore) {             // ya flota: va hasta su sitio delante del gólem
        // en los gólems de más adelante el núcleo flotante se mueve de lado a lado
        const tx = px + (i - 1) * 1.4 + Math.sin(S.t * (1 + 1.5 * S.d) + i * 2) * 1.3 * S.d, ty = 2.4 + Math.sin(S.t * 2 + i) * 0.15, tz = 1.9, k = Math.min(1, dt * 3);
        b.position.set(b.position.x + (tx - b.position.x) * k, b.position.y + (ty - b.position.y) * k, b.position.z + (tz - b.position.z) * k);
        b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 2, 0);
        if (Math.random() < 0.15) X.spawnSprite(b.position.x, b.position.y - 0.5, b.position.z, 0xff7a2a, 0.5, 1, 0.5, { add: true, vy: -0.5 });
        return;
      }
      const off = Math.hypot(b.position.x - px - h.x, b.position.y - h.y, b.position.z - h.z);
      const still = b.velocity.length() < 0.5 + (S.plat ? Math.abs(S.plat.velocity.x) : 0);
      S.rest[id] = off > 1.2 && still ? S.rest[id] + dt : 0;
      if (S.rest[id] > 0.8 || b.position.y < -0.5) {
        d.floatCore = true; b.type = CANNON.Body.KINEMATIC; b.updateMassProperties(); b.quaternion.set(0, 0, 0, 1);
        const p = b.position;
        for (let k = 0; k < 8; k++) X.spawnSprite(p.x + rnd(-0.4, 0.4), p.y + rnd(-0.3, 0.5), p.z + rnd(-0.3, 0.4), 0xff7a2a, 0.6, 1.2, 0.6, { add: true });
        ft(p.x, p.y + 1.2, p.z + 0.6, '¡EL NÚCLEO VUELVE!', '#ffb050', 22);
      }
    });
  }
  // ---------- Cascanueces (Navidad): sonriendo es inmune; 3 tiros que rompen bloques lo enfadan; enfadado, a la cara ----------
  const NUT_NEED = 3, NUT_MISS = 2, NUT_R = 1.05;
  function initNut() {
    S.lives = S.d >= 0.5 ? 4 : 3; S.livesLeft = S.lives;
    // huecos de su cuerpo (relativos a la losa que camina): ahí le caen regalos nuevos para que siempre haya bloques que romper
    const px0 = S.plat ? S.plat.position.x : 0;
    S.nutSlots = S.sim.blocks.filter(b => b.userData.kind === 'block').map(b => ({ x: b.position.x - px0, y: b.position.y, z: b.position.z }));
    S.refillT = 0;
    S.mood = 'happy'; S.prog = 0; S.miss = 0; S.wasOpen = false; S.angryAt = 0; S.missShot = -1; S.faceHit = false; S.faceFlash = 0;
  }
  function nutHappy(title, sub) {
    S.mood = 'happy'; S.prog = 0; S.miss = 0;
    if (title) banner(title, sub || 'Derriba ' + NUT_NEED + ' bloques para enfadarlo');
  }
  function nutAngry() {
    S.mood = 'angry'; S.miss = 0; S.angryAt = S.sim.shots;      // solo cuentan como fallo los tiros disparados después de enfadarse
    banner('¡EL CASCANUECES SE ENFADA!', 'Dispárale a la cara: tienes ' + NUT_MISS + ' tiros');
    X.Audio.horn && X.Audio.horn(); G.shake = Math.max(G.shake, 0.4);
  }
  // le caen regalos nuevos en los huecos de su cuerpo (como la arena del faraón)
  function nutRefill(n) {
    const sim = S.sim, live = sim.liveBlocks(), px = S.plat ? S.plat.position.x - S.px0 : 0;
    const free = S.nutSlots.map(s => ({ x: s.x + px, y: s.y, z: s.z })).filter(s => !live.some(b => Math.abs(b.position.x - s.x) < 0.8 && Math.abs(b.position.y - s.y) < 0.8 && Math.abs(b.position.z - s.z) < 0.8)
      && !sim.balls.some(b => Math.hypot(b.position.x - s.x, b.position.y - s.y, b.position.z - s.z) < 1.2));
    free.sort((a, b) => a.y - b.y || Math.abs(a.x - px) - Math.abs(b.x - px));
    let cols = [...new Set(live.map(b => b.userData.c).filter(c => PC[c]))]; if (cols.length < 3) cols = Object.keys(PC);
    let k = 0;
    for (const s of free.slice(0, n)) {
      const same = c => live.filter(b => b.userData.c === c && Math.abs(b.position.x - s.x) < 1.6 && Math.abs(b.position.y - s.y) < 1.6 && Math.abs(b.position.z - s.z) < 1.6).length;
      const pool = cols.slice().sort(() => Math.random() - 0.5); let c = pool[0]; for (const q of pool) if (same(q) < same(c)) c = q;
      live.push({ position: s, userData: { c } });
      const delay = 0.15 + k * 0.08; k++;
      sim.later(delay, () => {
        if (!S || S.sim !== sim || S.done) return;
        const dx = S.plat ? S.plat.position.x - S.px0 - px : 0;           // ha seguido caminando
        const body = sim.addBlock({ x: s.x + dx, y: s.y + 0.04, z: s.z, w: 1, h: 1, d: 1, c });
        if (body.material) body.material.friction = 1; body.linearDamping = Math.max(body.linearDamping, 0.08);
        X.addBlockView(body.userData);
        for (let i = 0; i < 4; i++) X.spawnSprite(s.x + dx + rnd(-0.5, 0.5), s.y + rnd(0.3, 1.4), s.z + rnd(-0.3, 0.6), 0xffffff, 0.6, 1.4, 0.7, { vy: -1.5, alpha: 0.8 });
      });
    }
    if (k) X.Audio.thud && X.Audio.thud(4, true);
    S.refillT = 4;
    return k;
  }
  function nutHitFace(ball) {
    const sim = S.sim, f = S.xm.face;
    sim.killBall(ball, false);
    S.faceHit = true; S.livesLeft--; S.faceFlash = 1; S.stun = 2.5; S.charge = 0;
    G.shake = Math.max(G.shake, 0.9); X.Audio.explode && X.Audio.explode(); X.Audio.crown && X.Audio.crown(); X.vibe && X.vibe([60, 40, 100]);
    X.spawnSprite(f.x, f.y, f.z + 0.8, 0xffe27a, 3, 1.4, 0.4, { add: true });
    X.spawnDebris(f.x, f.y, f.z + 0.6, 0xffffff, 16, 6, 0.14, 1);
    for (let r = 0; r < 2; r++) X.spawnRing(f.x, f.y, f.z + 0.6, 0xff4f6d, 2.4 + r * 1.4, 0.4 + r * 0.2);
    ft(f.x, f.y + 1.6, f.z, S.livesLeft > 0 ? '¡EN TODA LA CARA!' : '¡K.O.!', '#ffd23f', 30);
    if (S.livesLeft <= 0) { S.hp = 0; return; }
    nutHappy('¡VUELVE A SONREÍR!', 'Le traen regalos nuevos · +3 bolas');
    sim.later(0.9, () => {
      if (!S || S.sim !== sim || S.done) return;
      nutRefill(10);
      const n = {}; for (const b of sim.liveBlocks()) if (b.userData.kind === 'block' && b.userData.c) n[b.userData.c] = (n[b.userData.c] || 0) + 1;
      const top = Object.keys(n).sort((a, b) => n[b] - n[a]);
      sim.giveBalls([top[0] || 'r', top[1] || top[0] || 'b', top[0] || 'y']); X.refreshTray();
    });
  }
  function nutTick(dt) {
    const sim = S.sim, f = S.xm && S.xm.face;
    S.hp = Math.max(0, S.livesLeft / S.lives);
    S.faceFlash = Math.max(0, S.faceFlash - dt * 2.5);
    // bolas contra la cara: enfadado, le quita una vida; sonriendo, rebota
    if (f && !S.done) for (const b of sim.balls.slice()) {
      const d = b.userData, p = b.position;
      if (d.dead || d.faceT > S.t) continue;
      const dx = p.x - f.x, dy = p.y - f.y, dz = p.z - f.z, dist = Math.hypot(dx, dy, dz);
      if (dist > NUT_R + 0.34) continue;
      if (S.mood === 'angry') { nutHitFace(b); break; }
      d.faceT = S.t + 0.5;
      const nx = dx / dist, ny = dy / dist, nz = dz / dist, vn = b.velocity.x * nx + b.velocity.y * ny + b.velocity.z * nz;
      if (vn < 0) { b.velocity.x -= 1.6 * vn * nx; b.velocity.y -= 1.6 * vn * ny; b.velocity.z -= 1.6 * vn * nz; }
      ft(f.x, f.y + 1.5, f.z, '¡INMUNE!', '#ffe27a', 22); X.Audio.thud && X.Audio.thud(5, true);
    }
    // sin apenas bloques que romper: le caen regalos nuevos (nunca se queda sin poder enfadarse)
    S.refillT -= dt;
    if (!S.done && S.refillT <= 0 && sim.balls.length === 0 && sim.pending.length === 0) {
      let n = 0; for (const b of sim.liveBlocks()) if (b.userData.kind === 'block' && !b.userData.popping) n++;
      if (n < 12 && nutRefill(10) && f) ft(f.x, f.y + 1.5, f.z, '¡REGALOS NUEVOS!', '#ffe27a', 24);
    }
    // cuenta por tiros: un tiro empieza al disparar y acaba cuando no queda nada en juego
    if (sim.shotOpen && !S.wasOpen) S.faceHit = false;
    // un tiro enfadado que no da en la cara es un fallo (no cuenta el tiro que lo ha enfadado)
    if (!sim.shotOpen && S.wasOpen && !S.done && S.livesLeft > 0 && S.mood === 'angry' && !S.faceHit && sim.shots > S.angryAt && sim.shots !== S.missShot) {
      S.missShot = sim.shots;
      S.miss++;
      if (f) ft(f.x, f.y + 1.5, f.z, '¡FALLO! ' + S.miss + '/' + NUT_MISS, '#ff6a7a', 24);
      if (S.miss >= NUT_MISS) nutHappy('¡HA VUELTO A SONREÍR!', 'Derriba ' + NUT_NEED + ' bloques para enfadarlo otra vez');
    }
    S.wasOpen = sim.shotOpen;
  }
  function golemTick(dt) {
    const sim = S.sim;
    if (!S.done && !S.nut) looseCores(dt);
    if (S.nut) nutTick(dt);
    else S.hp = Math.max(0, (S.cores.length - S.coresHit) / S.cores.length);
    // sin bloques de colores en pie, el gólem está desmontado: cae solo
    if (!S.done && !S.nut && S.introT <= 0 && !sim.liveBlocks().some(b => b.userData.kind === 'block' && !b.userData.popping && b.position.y > -1)) {
      S.coresHit = S.cores.length; S.hp = 0; if (S.nut) S.livesLeft = 0;
      banner(S.nut ? '¡CASCANUECES DESMONTADO!' : '¡GÓLEM DESMONTADO!', S.nut ? 'Sin cuerpo no se tiene en pie' : 'Sin cuerpo no hay núcleos que lo aguanten');
    }
    if (S.stun > 0) S.stun -= dt;
    const moving = S.stun <= 0 && !S.done && S.introT <= 0;
    if (S.plat) {
      const vx = moving ? 0.95 * 0.6 * (1 + 0.6 * S.d)   // camina ±0,95: todo el gólem se queda dentro de la vista
         * Math.cos((S.walk += dt * (1 + 0.6 * S.d)) * 0.6) : 0;
      for (const p of S.plats) p.velocity.set(vx, 0, 0);
      sim.carrierDX = S.plat.position.x - S.px0;
      S.slab.position.copy(S.plat.position);
    }
    if (coreMat) coreMat.emissiveIntensity = 1.4 + Math.sin(S.t * (4 + S.charge * 10)) * 0.6 + S.charge * 1.5;
    if (S.light) { S.light.position.x = S.plat ? S.plat.position.x : 0; S.light.intensity = 4 + S.charge * 10; }
    if (moving && !S.done && !S.nut) S.charge = Math.min(1, S.charge + dt / (9 - 3.5 * S.d));   // el Cascanueces no cuenta tiempo: solo tiros
    if (S.charge >= 1 && !S.done) {
      S.charge = 0;
      const px = S.plat ? S.plat.position.x : 0, cp = G.level.cannon;
      G.shake = Math.max(G.shake, 1); X.Audio.explode && X.Audio.explode(); X.Audio.thud && X.Audio.thud(9, true); X.vibe && X.vibe([60, 40, 120]);
      for (let r = 0; r < 3; r++) X.spawnRing(px, 0.3, 0, 0xff6a1a, 4 + r * 3, 0.6 + r * 0.25);
      X.spawnDebris(px, 0.4, 1.5, 0xff7a2a, 24, 8, 0.2, 1.2);
      banner('¡GOLPE SÍSMICO!', 'Te ha quitado una bola');
      if (sim.queue.length > 1) { sim.queue.pop(); X.refreshTray(); ft(cp.x, cp.y + 1, cp.z - 2, '-1 BOLA', '#ff4f6d', 26); }
    }
    const chg = `<span class="chg${S.charge > 0.85 ? ' full' : ''}"><i style="width:${Math.round(S.charge * 100)}%"></i></span>`;
    // Cascanueces: el contador no es de tiempo. Sonriendo, 3 barras: cada bloque derribado llena una (lo que sobra de un tiro se
    // pierde); enfadado, los fallos
    const pips = (n, of, cls) => `<span class="npips ${cls}">${Array.from({ length: of }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
    S.sub = S.nut ? (S.mood === 'angry' ? `<span style="color:#ff6a7a">😠 ¡A LA CARA!</span><span style="color:#ff6a7a">FALLOS</span>${pips(S.miss, NUT_MISS, 'miss')}`
      : `<span style="color:#ffe27a">😊 INMUNE</span><span style="color:#ffe27a">BLOQUES</span>${pips(S.prog, NUT_NEED, 'prog')}`)
      : `<span>GOLPE SÍSMICO</span>${chg}${S.stun > 0 ? '<span style="color:#ffd23f">¡ATURDIDO!</span>' : ''}`;
  }

  // =====================================================================
  // 25-11 · jefes de los mundos nuevos: Maese Brochazo (paleta), Grúa Mordisco y Nimbo (nube de tormenta)
  // Los tres tienen vidas y un punto débil (X.aimObjs: se puede apuntar a él). Muro de colores delante (levels3d).
  // =====================================================================
  const SPOT = { brush: 1, crane: 1, nimbo: 1 }, SPOT_R = 0.95;
  const T3 = () => window.THREE;
  const std3 = (c, o) => new (T3().MeshStandardMaterial)(Object.assign({ color: c, roughness: 0.5 }, o || {}));
  const bas3 = (c, o) => new (T3().MeshBasicMaterial)(Object.assign({ color: c }, o || {}));
  const mesh3 = (geo, mat, x, y, z, parent) => { const m = new (T3().Mesh)(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; if (parent) parent.add(m); return m; };
  function spotAdd(o) { X.world.add(o); S.extras.push(o); return o; }
  function spotTarget(parent, x, y, z, r) {
    const T = T3(), hit = new T.Mesh(new T.SphereGeometry(r || SPOT_R, 12, 10), new T.MeshBasicMaterial({ visible: false })); hit.position.set(x, y, z); parent.add(hit);
    X.aimObjs.length = 0; X.aimObjs.push(hit); return hit;
  }
  function wallBox() { const live = S.sim.liveBlocks(); let x0 = 9, x1 = -9, y1 = 0, z1 = -9; for (const b of live) { x0 = Math.min(x0, b.position.x); x1 = Math.max(x1, b.position.x); y1 = Math.max(y1, b.position.y); z1 = Math.max(z1, b.position.z); } return { x0, x1, top: y1 + 0.5, front: z1 + 0.5 }; }
  function initSpot() {
    const T = T3(), sim = S.sim;
    S.lives = 3; S.livesLeft = 3; S.hp = 1; S.shotsSeen = 0; S.wasOpen = false; S.flash = 0; S.stun = 0; S.cages = [];
    S.fired = sim.shots; S.charge = 0; S.ready = false; S.quietT = 0;   // 27-11: carga por bloques (Brochazo, Grúa) o por tiros (Nimbo)
    const wb = wallBox(); S.wb = wb;
    if (S.key === 'brush') {
      // paleta de pintor con boina, bigote y pincel; la mancha que brilla es el punto débil
      const B = spotAdd(new T.Group()); B.position.set(0, wb.top + 3.6, -1.6); B.rotation.x = 0.12; S.model = B;
      const sh = new T.Shape(); sh.moveTo(-2.6, 0.2); sh.bezierCurveTo(-2.8, 2.0, 0.6, 2.4, 2.4, 1.3); sh.bezierCurveTo(3.3, 0.6, 2.8, -1.4, 1.4, -1.6); sh.bezierCurveTo(0.6, -1.7, 0.6, -0.9, -0.2, -1.0); sh.bezierCurveTo(-1.4, -1.2, -2.5, -1.2, -2.6, 0.2);
      const hole = new T.Path(); hole.absarc(1.6, -0.5, 0.38, 0, Math.PI * 2, true); sh.holes.push(hole);
      mesh3(new T.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 3 }), std3(0xd8a060, { roughness: 0.6 }), 0, 0, 0, B);
      S.spots = []; const P = [['r', -1.9, 0.9], ['y', -0.9, 1.5], ['g', 0.4, 1.6], ['b', 1.6, 1.1], ['p', 2.3, 0.1]];
      for (const [c, x, y] of P) { const m = mesh3(new T.SphereGeometry(0.42, 22, 14), new T.MeshPhysicalMaterial({ color: PC[c].hex, clearcoat: 1, roughness: 0.1, emissive: PC[c].hex, emissiveIntensity: 0 }), x, y, 0.45, B); m.scale.z = 0.45; S.spots.push({ c, m, x, y }); }
      S.ring = mesh3(new T.TorusGeometry(0.62, 0.06, 10, 36), bas3(0xffffff), 0, 0, 0.62, B); S.ring.castShadow = false;
      const eyeW = std3(0xffffff, { roughness: 0.2 }), pup = bas3(0x1d1440);
      for (const sx of [-1, 1]) { const e = mesh3(new T.SphereGeometry(0.36, 20, 14), eyeW, -0.7 + sx * 0.55, 0.15, 0.5, B); e.scale.z = 0.5; mesh3(new T.SphereGeometry(0.16, 14, 10), pup, -0.65 + sx * 0.55, 0.1, 0.72, B); const br = mesh3(new T.BoxGeometry(0.5, 0.1, 0.1), bas3(0x3a2010), -0.7 + sx * 0.55, 0.62, 0.62, B); br.rotation.z = sx * 0.35; }
      for (const sx of [-1, 1]) { const m = mesh3(new T.TorusGeometry(0.3, 0.08, 10, 20, Math.PI), std3(0x2a1a10), -0.7 + sx * 0.32, -0.4, 0.62, B); m.rotation.z = sx > 0 ? Math.PI : 0; }
      const beret = mesh3(new T.SphereGeometry(0.9, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.2), std3(0xc8202a, { roughness: 0.7 }), -1.2, 1.55, 0.15, B); beret.scale.set(1.25, 0.45, 1); beret.rotation.z = 0.35;
      const brush = new T.Group(); brush.position.set(2.6, -0.6, 0.7); brush.rotation.z = -0.9; B.add(brush); S.brush = brush;
      mesh3(new T.CylinderGeometry(0.13, 0.16, 3.2, 14), std3(0x2a2a8a), 0, 1.6, 0, brush); mesh3(new T.CylinderGeometry(0.2, 0.14, 0.45, 16), std3(0xc8ccd4, { metalness: 0.9, roughness: 0.25 }), 0, -0.2, 0, brush);
      S.tip = mesh3(new T.ConeGeometry(0.28, 0.9, 16), new T.MeshPhysicalMaterial({ color: PC.b.hex, clearcoat: 1 }), 0, -0.85, 0, brush); S.tip.rotation.x = Math.PI;
      S.hit = spotTarget(B, 0, 0, 0.5, 0.75);
      brushPick();
    } else if (S.key === 'crane') {
      const Y = std3(0xffc21a, { metalness: 0.35, roughness: 0.45 }), D = std3(0x2a2a30, { metalness: 0.6, roughness: 0.4 });
      const C = spotAdd(new T.Group()); S.model = C;
      const tx = 3.6, tz = -2.6;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh3(new T.BoxGeometry(0.12, 8.2, 0.12), Y, tx + sx * 0.42, 4.1, tz + sz * 0.42, C);
      for (let y = 0.6; y < 8; y += 0.8) for (const sz of [-1, 1]) { const b = mesh3(new T.BoxGeometry(1.2, 0.07, 0.07), Y, tx, y, tz + sz * 0.42, C); b.rotation.z = 0.5 * (Math.round(y / 0.8) % 2 ? 1 : -1); }
      const jib = new T.Group(); jib.position.set(-0.9, 8.6, tz); C.add(jib);
      for (const sy of [0, 0.6]) for (const sz of [-0.32, 0.32]) mesh3(new T.BoxGeometry(10, 0.12, 0.12), Y, 0, sy, sz, jib);
      for (let x = -4.8; x < 5; x += 0.7) { const d = mesh3(new T.BoxGeometry(0.07, 0.85, 0.07), Y, x, 0.3, 0.32, jib); d.rotation.z = 0.7; }
      mesh3(new T.BoxGeometry(1.5, 1.0, 1.2), D, 4.6, 0.3, 0, jib);
      // cabina (cara): punto débil cuando está aturdida
      const cab = new T.Group(); cab.position.set(tx - 0.6, 7.7, tz + 0.9); cab.rotation.y = -0.25; C.add(cab); S.cab = cab;
      mesh3(new T.BoxGeometry(1.7, 1.4, 1.5), Y, 0, 0, 0, cab);
      mesh3(new T.BoxGeometry(1.45, 0.75, 0.05), new T.MeshPhysicalMaterial({ color: 0x9fdcff, roughness: 0.05, transparent: true, opacity: 0.85 }), 0, 0.15, 0.76, cab);
      S.eyes = [];
      for (const sx of [-1, 1]) { mesh3(new T.SphereGeometry(0.2, 16, 12), bas3(0xffffff), sx * 0.35, 0.18, 0.8, cab); S.eyes.push(mesh3(new T.SphereGeometry(0.1, 12, 8), bas3(0x111111), sx * 0.33, 0.14, 0.97, cab)); const br = mesh3(new T.BoxGeometry(0.42, 0.1, 0.08), bas3(0x111111), sx * 0.35, 0.47, 0.82, cab); br.rotation.z = sx * -0.45; }
      mesh3(new T.BoxGeometry(1.0, 0.3, 0.06), D, 0, -0.42, 0.78, cab); for (let i = -2; i <= 2; i++) mesh3(new T.BoxGeometry(0.05, 0.25, 0.08), bas3(0xffffff), i * 0.18, -0.42, 0.8, cab);
      S.beacon = mesh3(new T.SphereGeometry(0.16, 14, 10), bas3(0xff7a1a), 0, 0.85, 0, cab);
      S.stars = new T.Group(); S.stars.position.set(0, 1.25, 0); cab.add(S.stars); S.stars.visible = false;
      for (let i = 0; i < 3; i++) { const st = mesh3(new T.OctahedronGeometry(0.16), bas3(0xffe27a), Math.cos(i * 2.1) * 0.55, 0, Math.sin(i * 2.1) * 0.55, S.stars); st.castShadow = false; }
      S.cabHit = new T.Mesh(new T.SphereGeometry(1.0, 12, 10), new T.MeshBasicMaterial({ visible: false })); cab.add(S.cabHit);
      // carro, cable y contenedor
      S.trolley = mesh3(new T.BoxGeometry(0.8, 0.3, 0.9), D, 0, 8.45, tz, C); S.cable = mesh3(new T.CylinderGeometry(0.025, 0.025, 1, 6), std3(0x222222), 0, 7.5, tz, C);
      S.crateG = new T.Group(); C.add(S.crateG);
      const ct = new T.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = 256; c.height = 192; const g = c.getContext('2d'); g.fillStyle = '#2f6ab8'; g.fillRect(0, 0, 256, 192); g.fillStyle = '#245494'; for (let x = 0; x < 256; x += 22) g.fillRect(x, 0, 10, 192); g.fillStyle = '#ffd23f'; g.font = '900 70px Arial'; g.textAlign = 'center'; g.fillText('!', 128, 120); return c; })());
      mesh3(new T.BoxGeometry(1.5, 1.1, 1.1), new T.MeshStandardMaterial({ map: ct, metalness: 0.4, roughness: 0.5 }), 0, 0, 0, S.crateG);
      const r1 = mesh3(new T.TorusGeometry(0.5, 0.05, 8, 30), bas3(0xffffff), 0, 0, 0.6, S.crateG), r2 = mesh3(new T.TorusGeometry(0.28, 0.05, 8, 30), bas3(0xff4f6d), 0, 0, 0.6, S.crateG); r1.castShadow = r2.castShadow = false;
      S.crateHit = new T.Mesh(new T.SphereGeometry(0.95, 12, 10), new T.MeshBasicMaterial({ visible: false })); S.crateG.add(S.crateHit);
      X.aimObjs.length = 0; X.aimObjs.push(S.crateHit, S.cabHit);
      S.tz = tz; S.crate = 'gone'; S.crateG.visible = false; S.cx = 0; S.cDir = 1; S.crateY = wb.top + 2.6;
    } else if (S.key === 'nimbo') {
      const N = spotAdd(new T.Group()); N.position.set(0.3, wb.top + 4.2, -3.2); S.model = N;
      const cm = std3(0x4a5070, { roughness: 1 }), cm2 = std3(0x343a54, { roughness: 1 });
      for (const [x, y, z, r] of [[0, 0, 0, 1.9], [-1.8, -0.2, 0.1, 1.4], [1.9, -0.1, 0.1, 1.5], [-0.9, 1.0, -0.2, 1.3], [1.0, 1.1, -0.2, 1.35], [-3.0, -0.4, -0.2, 1.0], [3.1, -0.3, -0.2, 1.05], [0, -0.8, 0.4, 1.3]]) mesh3(new T.SphereGeometry(r, 24, 16), r > 1.3 ? cm : cm2, x, y, z, N);
      S.eyes = [];
      for (const sx of [-1, 1]) { const e = mesh3(new T.SphereGeometry(0.36, 18, 12), bas3(0xfff36a), sx * 0.75, 0.25, 1.75, N); e.scale.set(1.1, 0.6, 0.6); S.eyes.push(e); const br = mesh3(new T.BoxGeometry(0.85, 0.2, 0.2), bas3(0x1a1d2e), sx * 0.72, 0.75, 1.85, N); br.rotation.z = sx * 0.5; }
      const mo = mesh3(new T.TorusGeometry(0.45, 0.1, 10, 24, Math.PI), bas3(0x1a1d2e), 0, -0.55, 1.95, N);
      S.glow = mesh3(new T.SphereGeometry(3.6, 20, 14), bas3(0xfff36a, { transparent: true, opacity: 0, depthWrite: false }), 0, 0, 0, N); S.glow.castShadow = false;
      // pararrayos encima del muro: el punto débil (le devuelve el rayo)
      const rod = spotAdd(new T.Group()); rod.position.set(-1.0, wb.top, 0.1); S.rod = rod;
      mesh3(new T.CylinderGeometry(0.06, 0.08, 1.8, 10), std3(0xd8a040, { metalness: 0.95, roughness: 0.2 }), 0, 0.9, 0, rod); mesh3(new T.ConeGeometry(0.12, 0.4, 10), std3(0xd8a040, { metalness: 0.95, roughness: 0.2 }), 0, 1.95, 0, rod);
      mesh3(new T.CylinderGeometry(0.3, 0.34, 0.2, 16), std3(0x3a3f50, { metalness: 0.6 }), 0, 0.1, 0, rod);
      S.rodGlow = mesh3(new T.SphereGeometry(0.5, 14, 10), bas3(0xfff36a, { transparent: true, opacity: 0.2, depthWrite: false }), 0, 1.95, 0, rod); S.rodGlow.castShadow = false;
      S.hit = spotTarget(rod, 0, 1.6, 0, 0.8);
      S.charging = false; S.shotsN = 0; S.cages = [];
    }
    S.sub = spotSub();
  }
  function spotSub() {
    if (S.key === 'brush') return S.ready ? 'Dale a la mancha que brilla con una bola <b style="color:' + PC[S.want].css + '">' + PC[S.want].name + '</b>' : tr('Revienta bloques para cargar la paleta') + ' (' + S.charge + '/' + spotNeed() + ')';
    if (S.key === 'crane') return S.stun > 0 ? '¡ATURDIDA! Dispárale a la cabina' : S.crate === 'hang' ? 'Dale al contenedor que cuelga' : S.crate === 'fall' ? '¡CAE!' : tr('Revienta bloques para que traiga el contenedor') + ' (' + S.charge + '/' + spotNeed() + ')';
    return S.charging ? '¡CARGADO! Dale al pararrayos en este tiro' : tr('Nimbo se carga') + ' (' + S.charge + '/3)';
  }
  function brushPick() {
    const cols = [...new Set(S.sim.liveBlocks().map(b => b.userData.c).filter(c => PC[c]))], q = S.sim.queue.filter(c => PC[c]);
    const pool = (cols.length ? cols : Object.keys(PC)).filter(c => c !== S.want);
    S.want = (q.find(c => pool.includes(c))) || pool[Math.floor(Math.random() * pool.length)] || 'r';
    for (const sp of S.spots) sp.m.material.emissiveIntensity = sp.c === S.want && S.ready ? 0.9 : 0;
    const sp = S.spots.find(o => o.c === S.want); S.ring.position.set(sp.x, sp.y, 0.62); S.hit.position.set(sp.x, sp.y, 0.5); S.ring.visible = !!S.ready;
    S.sub = spotSub();
  }
  // bloques que hay que reventar para habilitar el punto débil (sube con cada vida que pierde; nunca más de los que quedan)
  function spotNeed() {
    const base = S.key === 'brush' ? [5, 7, 9] : [4, 6, 8], n = base[Math.min(2, S.lives - S.livesLeft)];
    const live = S.sim.liveBlocks().filter(b => b.userData.kind === 'block' && !b.userData.popping).length;
    return Math.max(1, Math.min(n, S.charge + live));
  }
  function spotRemoved(b, d) {
    if (S.done || d.kind !== 'block' || S.ready || S.key === 'nimbo') return;
    if (S.key === 'crane' && (S.crate !== 'gone' || S.stun > 0 || S.t < (S.landT || 0) + 1.2)) return;   // lo que rompe el propio contenedor no cuenta
    S.charge++;
    const p = b.position, need = spotNeed();
    ft(p.x, p.y + 0.6, p.z, Math.min(S.charge, need) + '/' + need, S.key === 'brush' ? '#ffd23f' : '#ffc21a', 20);
    if (S.charge >= need) spotCharged();
    S.sub = spotSub();
  }
  function spotCharged() {
    S.charge = 0;
    if (S.key === 'brush') { S.ready = true; brushPick(); banner(tr('¡LA PALETA BRILLA!'), tr('Dale a la mancha del color que brilla')); X.Audio.horn && X.Audio.horn(); }
    else if (S.key === 'crane') { S.crate = 'hang'; S.crateG.visible = true; S.cx = S.wb.x0 + Math.random() * (S.wb.x1 - S.wb.x0); S.crateY = S.wb.top + 2.6; banner('¡OTRO CONTENEDOR!', 'Dale para que caiga'); X.Audio.horn && X.Audio.horn(); }
  }
  // Nimbo: cada tiro lo carga (1/3, 2/3); el tercero es el bueno: o le das al pararrayos o te suelta la descarga (-2 bolas)
  function nimboShot(ball) {
    if (S.charging) { S.decBall = ball; return; }
    S.charge++;
    if (S.charge >= 2) { S.charging = true; S.charge = 2; banner('¡NIMBO CARGA UN RAYO!', tr('Dale al pararrayos en el próximo tiro o te quita 2 bolas')); X.Audio.horn && X.Audio.horn(); }
    else ft(S.rod.position.x, S.wb.top + 2.6, 0.1, S.charge + '/3', '#9ff0ff', 22);
  }
  function nimboDischarge() {
    const sim = S.sim; S.charging = false; S.charge = 0; S.decBall = null;
    let n = 0; while (n < 2 && sim.queue.length > 1) { sim.queue.pop(); n++; }
    X.refreshTray();
    const m = spotPos(S.model), c = { x: 0, y: 1.2, z: 13 };
    for (let i = 0; i <= 12; i++) { const t = i / 12; X.spawnSprite(m.x + (c.x - m.x) * t + rnd(-0.4, 0.4), m.y + (c.y - m.y) * t, m.z + (c.z - m.z) * t, 0x9ff0ff, 0.9, 1.6, 0.4, { add: true }); }
    G.shake = Math.max(G.shake, 0.7); X.Audio.explode && X.Audio.explode(); X.vibe && X.vibe([80, 40, 80]);
    banner('¡RAYO!', n ? tr('Te ha quitado {x} bolas').replace('{x}', n) : tr('¡Por los pelos!'));
    S.sub = spotSub();
  }
  function spotPos(o) { const v = new (T3().Vector3)(); o.getWorldPosition(v); return v; }
  function spotDamage(at, txt) {
    S.livesLeft--; S.flash = 1; G.shake = Math.max(G.shake, 0.9);
    X.Audio.explode && X.Audio.explode(); X.Audio.crown && X.Audio.crown(); X.vibe && X.vibe([60, 40, 100]);
    X.spawnSprite(at.x, at.y, at.z + 0.8, 0xffe27a, 3, 1.4, 0.4, { add: true }); X.spawnDebris(at.x, at.y, at.z + 0.6, 0xffffff, 16, 6, 0.14, 1);
    for (let r = 0; r < 2; r++) X.spawnRing(at.x, at.y, at.z + 0.6, 0xff4f6d, 2.4 + r * 1.4, 0.4 + r * 0.2);
    ft(at.x, at.y + 1.4, at.z, S.livesLeft > 0 ? txt : '¡K.O.!', '#ffd23f', 30);
    S.hp = Math.max(0, S.livesLeft / S.lives); S.ready = false; S.charge = 0;
    if (S.livesLeft > 0) { S.sim.giveBalls(['r', 'b', 'y'].map(() => { const c = [...new Set(S.sim.liveBlocks().map(b => b.userData.c).filter(k => PC[k]))]; return c[Math.floor(Math.random() * c.length)] || 'r'; })); X.refreshTray(); }
  }
  // cada 3 tiros: Brochazo repinta una fila (mezclando colores), la grúa trae otro contenedor, Nimbo carga el rayo
  function spotEveryThree() {
    const sim = S.sim;
    if (S.key === 'brush') {
      const live = sim.liveBlocks().filter(b => b.userData.kind === 'block' && !b.userData.popping);
      if (!live.length) return;
      const ys = [...new Set(live.map(b => Math.round(b.position.y)))], y = ys[Math.floor(Math.random() * ys.length)], cols = Object.keys(PC);
      S.brush.rotation.z = -0.4; setTimeout(() => { if (S && S.brush) S.brush.rotation.z = -0.9; }, 500);
      let i = 0; for (const b of live) if (Math.round(b.position.y) === y) { const c = cols[(i++ + Math.floor(Math.random() * 5)) % 5]; if (c === b.userData.c) continue; b.userData.c = c; sim.emit({ type: 'recolor', id: b.userData.id, c, x: b.position.x, y: b.position.y, z: b.position.z }); }
      banner('¡BROCHAZO!', 'Ha repintado una fila de tu muro');
    }
    S.sub = spotSub();
  }
  function nimboStrike() {
    // suelta el rayo: electrifica (encierra) 2 bloques durante 3 tiros
    const sim = S.sim, live = sim.liveBlocks().filter(b => b.userData.kind === 'block' && !b.userData.locked && !b.userData.popping);
    const T = T3();
    for (let k = 0; k < 2 && live.length; k++) {
      const b = live.splice(Math.floor(Math.random() * live.length), 1)[0]; b.userData.locked = true; b.userData.nimboLock = S.shotsSeen + 3;
      const cage = new T.Group(); for (let i = 0; i < 3; i++) { const r = new T.Mesh(new T.TorusGeometry(0.62, 0.025, 6, 30), new T.MeshBasicMaterial({ color: 0x9ff0ff })); r.rotation.set(i * 1.1, i * 0.7, 0); cage.add(r); }
      const g = G.meshes[b.userData.id]; if (g) { g.add(cage); S.cages.push({ b, cage, g }); }
      X.spawnSprite(b.position.x, b.position.y + 1, b.position.z + 0.5, 0x9ff0ff, 2, 1.5, 0.35, { add: true });
    }
    G.shake = Math.max(G.shake, 0.5); X.Audio.explode && X.Audio.explode();
    banner('¡RAYO!', 'Ha electrificado 2 bloques (3 tiros)');
  }
  function spotTick(dt) {
    const sim = S.sim, T = T3();
    S.flash = Math.max(0, S.flash - dt * 2.5); if (S.stun > 0 && S.key !== 'crane') S.stun -= dt;
    // Nimbo: los tiros cuentan al disparar (si se dispara rápido, el tiro no llega a «cerrarse» y antes no contaba)
    if (S.key === 'nimbo' && !S.done) {
      while (S.fired < sim.shots) { S.fired++; nimboShot(sim.balls[sim.balls.length - 1] || null); S.sub = spotSub(); }
      if (S.charging && S.decBall && (S.decBall.userData.dead || !sim.balls.includes(S.decBall))) nimboDischarge();
    }
    // tiros: cuentan al acabar cada uno
    if (!sim.shotOpen && S.wasOpen && !S.done) {
      S.shotsSeen++;
      for (const c of S.cages.slice()) if (S.shotsSeen >= c.b.userData.nimboLock) { c.b.userData.locked = false; c.g.remove(c.cage); S.cages.splice(S.cages.indexOf(c), 1); }
      if (S.key === 'crane' && S.stun > 0 && --S.stun <= 0) { S.stun = 0; S.stars.visible = false; ft(S.cab.position.x, 8.8, S.tz, 'SE DESPIERTA', '#ffe27a', 22); }
      if (S.shotsSeen % 3 === 0 && S.key === 'brush') spotEveryThree();
      S.sub = spotSub();
    }
    S.wasOpen = sim.shotOpen;
    // animación
    if (S.model) { S.model.position.y += Math.sin(S.t * 1.6) * dt * 0.25; }
    if (S.key === 'brush') { S.ring.scale.setScalar(1 + Math.sin(S.t * 6) * 0.1); S.tip.material.color.setHex(PC[S.want].hex); }
    if (S.key === 'nimbo') { S.glow.material.opacity = S.charging ? 0.14 + 0.1 * Math.sin(S.t * 10) : S.charge * 0.05; S.rodGlow.material.opacity = S.charging ? 0.5 + 0.3 * Math.sin(S.t * 10) : 0.15; for (const e of S.eyes) e.material.color.setHex(S.charging ? 0xffffff : 0xfff36a); }
    if (S.key === 'crane') {
      S.beacon.material.color.setHex(Math.sin(S.t * 8) > 0 ? 0xff7a1a : 0x7a2a00);
      if (S.stun > 0) S.stars.rotation.y += dt * 4;
      if (S.crate === 'hang') { S.cx += S.cDir * dt * 0.7; if (S.cx > S.wb.x1) S.cDir = -1; if (S.cx < S.wb.x0) S.cDir = 1; }
      if (S.crate === 'fall') { S.cv = (S.cv || 0) + 18 * dt; S.crateY -= S.cv * dt; if (S.crateY <= S.wb.top + 0.4) craneLand(); }
      S.trolley.position.x = S.cx; S.cable.position.x = S.cx; const top = 8.3, len = Math.max(0.2, top - (S.crateY + 0.55)); S.cable.scale.y = S.crate === 'hang' ? len : 0.01; S.cable.position.y = top - len / 2;
      S.crateG.position.set(S.cx, S.crateY, S.tz + 2.0);
    }
    // bolas contra el punto débil
    if (S.done) return;
    for (const b of sim.balls.slice()) {
      const d = b.userData, p = b.position; if (d.dead || d.spotT > S.t) continue;
      if (S.key === 'crane') {
        if (S.crate === 'hang') { const c = spotPos(S.crateHit); if (Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z) < 1.15) { d.spotT = S.t + 0.5; sim.killBall(b, false); S.crate = 'fall'; S.cv = 0; ft(c.x, c.y + 1, c.z, '¡CAE!', '#ffe27a', 26); X.Audio.thud && X.Audio.thud(5, true); continue; } }
        const c = spotPos(S.cabHit); if (Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z) < 1.25) { d.spotT = S.t + 0.5; if (S.stun > 0) { sim.killBall(b, false); S.stun = 0; S.stars.visible = false; spotDamage(c, '¡EN LA CABINA!'); } else { bounce(b, c); ft(c.x, c.y + 1.2, c.z, '¡INMUNE!', '#ffe27a', 22); } }
        continue;
      }
      const c = spotPos(S.hit), dist = Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z);
      if (dist > (S.key === 'nimbo' ? 1.05 : 1.0)) continue;
      d.spotT = S.t + 0.5;
      if (S.key === 'brush') {
        if (!S.ready) { bounce(b, c); ft(c.x, c.y + 1.2, c.z, tr('¡Aún no! Revienta bloques'), '#ffe27a', 20); }
        else if (d.c === S.want || d.ball === 'golden' || d.ball === 'rainbow') { sim.killBall(b, false); spotDamage(c, '¡MANCHA!'); if (S.livesLeft > 0) brushPick(); }
        else { bounce(b, c); ft(c.x, c.y + 1.2, c.z, '¡ESE COLOR NO!', '#ff6a7a', 22); }
      } else if (S.key === 'nimbo') {
        sim.killBall(b, false);
        if (S.charging) { S.charging = false; S.charge = 0; S.decBall = null; const m = spotPos(S.model); for (let i = 0; i <= 10; i++) { const t = i / 10; X.spawnSprite(c.x + (m.x - c.x) * t + rnd(-0.3, 0.3), c.y + (m.y - c.y) * t, c.z + (m.z - c.z) * t, 0x9ff0ff, 0.9, 1.6, 0.4, { add: true }); } spotDamage(m, '¡RAYO DEVUELTO!'); }
        else { ft(c.x, c.y + 1.2, c.z, 'Aún no carga', '#ffe27a', 20); X.Audio.thud && X.Audio.thud(4, false); }
        S.sub = spotSub();
      }
    }
  }
  function bounce(b, c) { const p = b.position, dx = p.x - c.x, dy = p.y - c.y, dz = p.z - c.z, dist = Math.hypot(dx, dy, dz) || 1, nx = dx / dist, ny = dy / dist, nz = dz / dist, vn = b.velocity.x * nx + b.velocity.y * ny + b.velocity.z * nz; if (vn < 0) { b.velocity.x -= 1.6 * vn * nx; b.velocity.y -= 1.6 * vn * ny; b.velocity.z -= 1.6 * vn * nz; } X.Audio.thud && X.Audio.thud(5, true); }
  function craneLand() {
    const sim = S.sim, x = S.cx, y = S.wb.top, z = 0;
    S.crate = 'gone'; S.crateG.visible = false; S.landT = S.t; S.charge = 0;
    sim.explode(x, y, z, 1.7, true);
    S.stun = 2; S.stars.visible = true;           // aturdida durante 2 tiros
    G.shake = Math.max(G.shake, 0.8);
    banner('¡GRÚA ATURDIDA!', 'Dispárale a la cabina (2 tiros)');
    S.sub = spotSub();
  }
  function onRemoved(b, d) {
    if (SPOT[S.key]) return spotRemoved(b, d);
    const p = b.position;
    if (S.key === 'ship') {
      if (d.kind !== 'stone') S.removed++;
      if (d.kind === 'gold') { S.gold++; ft(p.x, p.y + 0.8, p.z, '¡TESORO!', '#ffd23f', 28); G.shake = Math.max(G.shake, 0.4); }
    } else if (S.key === 'pyramid') {
      if (d.kind === 'block' && !S.open && !S.done) {
        const need = NEED[Math.min(2, S.hits)];
        if (d.c === S.shieldC) { S.prog++; if (S.prog <= need) ft(p.x, p.y + 0.6, p.z, S.prog + '/' + need, PC[d.c].css, 22); if (S.prog >= need) openShield(); }
        else if (d.popping && S.t - S.immuneT > 0.9) { S.immuneT = S.t; ft(p.x, p.y + 0.6, p.z, '¡INMUNE!', '#e6e2f5', 20); }
      }
    } else if (S.key === 'golem' && S.nut) {
      // cada bloque derribado llena una barra; con las 3 se enfada en ese mismo momento (lo que sobre de ese tiro se pierde)
      if (d.kind === 'block' && S.mood === 'happy' && !S.done && S.livesLeft > 0 && S.prog < NUT_NEED) {
        S.prog++;
        const p = b.position; ft(p.x, p.y + 0.6, p.z, '🎁 ' + S.prog + '/' + NUT_NEED, '#ffe27a', 26);
        if (S.prog >= NUT_NEED) nutAngry();
      }
    } else if (S.key === 'golem') {
      if (S.cores.includes(d.id) && !S.done && S.coresHit < S.cores.length) {   // un núcleo (encendido, o sellado que alguna explosión ha roto): cuenta y se enciende otro
        S.coresHit++; S.charge = 0; S.stun = 2.5;
        G.shake = Math.max(G.shake, 0.5); X.Audio.crown && X.Audio.crown();
        ft(p.x, p.y + 0.8, p.z, S.coresHit < S.cores.length ? '¡ATURDIDO!' : '¡NÚCLEO!', '#ffd23f', 28);
        if (d.id === S.activeCore || !S.activeCore || S.counted.has(S.activeCore)) S.sim.later(CORE_WAIT, () => { if (S && S.key === 'golem' && !S.done) nextCore(false); });   // 22-11: antes 0,6 s (salía otro al momento)
      }
    }
    if (S.hp !== undefined) { const el = $('bbHp'); el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
  }

  function updateBar(force) {
    const pct = Math.max(0, Math.min(1, S.hp));
    const w = (pct * 100).toFixed(1) + '%', txt = Math.ceil(pct * 100) + '%';
    if (S.barW !== w) { S.barW = w; $('bbFill').style.width = w; $('bbLag').style.width = w; }
    if ($('bbPct').__esv !== txt) { $('bbPct').__esv = txt; $('bbPct').textContent = txt; }
    const ph = S.key === 'ship' ? 'FASE ' + S.phase + '/2' : S.key === 'pyramid' ? 'GOLPES ' + (S.hits || 0) + '/' + HITS : S.nut || SPOT[S.key] ? 'VIDA ' + S.livesLeft + '/' + S.lives : 'NÚCLEOS ' + ((S.cores ? S.cores.length : 3) - (S.coresHit || 0)) + '/' + (S.cores ? S.cores.length : 3);
    if ($('bbPhase').__esv !== ph) { $('bbPhase').__esv = ph; $('bbPhase').textContent = ph; }
    if (S.sub !== S.subShown || force) { $('bbSub').innerHTML = S.sub || ''; S.subShown = S.sub; }
  }
  function tick(dt) {
    if (!S || G.level !== S.L || G.sim !== S.sim) return;
    const sim = S.sim;
    S.t += dt; if (S.introT > 0) S.introT -= dt;
    if (sim.shotOpen) sim.shotGolden = true;      // contra un jefe no se regalan bombas ni arcoíris por combo
    for (const b of sim.blocks) {
      const d = b.userData;
      if (S.counted.has(d.id)) continue;
      if (S.key === 'golem' && S.cores && S.cores.includes(d.id) && d.alive && !d.destroyed && !d.popping) continue;   // un núcleo que cae al agua vuelve flotando
      if (!d.alive || d.destroyed || d.popping || b.position.y < (S.key === 'ship' ? 0.9 : -1.2)) { S.counted.add(d.id); onRemoved(b, d); }
    }
    if (S.key === 'ship') shipTick(dt);
    else if (S.key === 'pyramid') pyramidTick(dt);
    else if (SPOT[S.key]) spotTick(dt);
    else golemTick(dt);
    if (!S.done) updateBar();
    if (!S.done && S.hp <= 0) victory();
  }
  window.Bosses = { start, stop, tick, hp: () => (S ? S.hp : 1), active: () => !!S, state: () => S,
    // para las pruebas: dónde estará la máscara dentro de dt segundos
    maskAt: dt => S && S.mask ? maskTarget((S.mt || 0) + dt * (S.open ? 0.45 : 1) * (S.spin || 1)) : null };
})();
