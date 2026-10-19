// Rocket Rush — jefes: el último nivel de cada paisaje. Tres tipos que rotan (barco pirata, pirámide con escudo
// de color y gólem que camina) con nombre y aspecto según el paisaje. Usa el motor del juego a través de window.RRGame.
(function () {
  'use strict';
  const X = window.RRGame, G = X.G;
  const $ = id => document.getElementById(id);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const RULES = {
    ship: 'Derriba el barco y su tesoro dorado. Cada 3 tiros dispara un cañonazo que te quita una bola.',
    pyramid: 'Solo le hace daño el color de su escudo: primero rojo, luego azul y al final el sarcófago dorado.',
    golem: 'Camina de lado a lado. Revienta sus 3 núcleos de lava antes de que cargue el golpe sísmico.',
  };
  const SHIELD = { 1: { c: 'r', hex: 0xff4f6d, css: '#ff4f6d', name: 'ROJO' }, 2: { c: 'b', hex: 0x3d9bff, css: '#3d9bff', name: 'AZUL' }, 3: { c: 'o', hex: 0xffd23f, css: '#ffd23f', name: 'SARCÓFAGO' } };
  // color de la roca del gólem según el paisaje
  const GOLEM_SKIN = { snow: [0xbfe0ff, 0.2, 0.2], space: [0xb8bcd0, 0.8, 0.3], candy: [0xffa8d8, 0, 0.4], temple: [0x9aa86a, 0, 0.9], neon: [0x3a3a5a, 0.7, 0.3], volcano: [0x3b3236, 0, 0.9], desert: [0xd8b078, 0, 0.9] };
  const css = `
  body.bossmode #meter{visibility:hidden}
  #bossBar{position:fixed;left:50%;transform:translateX(-50%);top:calc(max(10px,env(safe-area-inset-top)) + 64px);width:min(94vw,460px);z-index:4;display:none;pointer-events:none}
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
  const ft = (x, y, z, txt, col, size) => X.floatText(x, y, z, txt, col, size || 22, true, true);
  const centerOf = () => {
    const live = S.sim.liveBlocks(); if (!live.length) return { x: 0, y: 1.5, z: 0 };
    let x = 0, y = 0, z = 0; for (const b of live) { x += b.position.x; y += b.position.y; z += b.position.z; }
    return { x: x / live.length, y: y / live.length, z: z / live.length };
  };

  function stop() {
    if (S) for (const o of S.extras) { if (o.parent) o.parent.remove(o); }
    S = null;
    document.body.classList.remove('bossmode');
    for (const id of ['bossBar', 'bossIntro', 'bossBanner', 'bossSand']) $(id).classList.remove('on');
  }
  function start(L) {
    stop();
    const sim = G.sim;
    S = { key: L.boss, L, sim, t: 0, counted: new Set(), extras: [], hp: 1, done: false, phase: 1, center: centerOf, removed: 0, gold: 0 };
    S.total = sim.blocks.filter(b => b.userData.kind !== 'stone').length;
    if (S.key === 'ship') { S.every = 3; S.lastShots = 0; S.ball = null; initShip(); }
    if (S.key === 'pyramid') initPyramid();
    if (S.key === 'golem') initGolem();
    document.body.classList.add('bossmode');
    $('hudLevel').textContent = 'JEFE';
    $('bbName').textContent = L.bossName;
    $('bbSegs').innerHTML = S.key === 'ship' ? '<div class="bbSeg" style="left:50%"></div>' : '<div class="bbSeg" style="left:33.33%"></div><div class="bbSeg" style="left:66.66%"></div>';
    $('bossBar').classList.add('on');
    const intro = $('bossIntro');
    intro.innerHTML = `<span class="biTag">JEFE FINAL</span><div class="biName">${L.bossName}</div><div class="biRule">${RULES[S.key]}</div>`;
    intro.classList.remove('on'); void intro.offsetWidth; intro.classList.add('on');
    S.introT = 3.4;
    X.Audio.horn && X.Audio.horn();
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
    if (S.phase === 1 && S.hp < 0.5) { S.phase = 2; S.every = 2; banner('¡A TODA VELA!', 'Ahora dispara cada 2 tiros'); X.Audio.horn && X.Audio.horn(); G.shake = Math.max(G.shake, 0.4); }
    const waiting = sim.shots - S.lastShots;
    if (!S.ball && !S.done && waiting >= S.every && (sim.sinceFire > 2.4 || (sim.balls.length === 0 && sim.sinceFire > 1.0)) && S.introT <= 0) fireCannonball();
    if (S.ball) {
      const B = S.ball; B.t += dt / 1.25;
      const k = Math.min(1, B.t), p = B.mesh.position;
      p.set(B.a.x + (B.b.x - B.a.x) * k, B.a.y + (B.b.y - B.a.y) * k + Math.sin(Math.PI * k) * 5, B.a.z + (B.b.z - B.a.z) * k);
      B.mesh.rotation.x += dt * 8;
      if (Math.random() < 0.5) X.spawnSprite(p.x, p.y, p.z, 0x6a6470, 0.5, 1.6, 0.6, { alpha: 0.5 });
      if (k >= 1) {
        B.mesh.parent && B.mesh.parent.remove(B.mesh); S.ball = null; S.lastShots = sim.shots;
        G.shake = Math.max(G.shake, 0.8); X.Audio.explode && X.Audio.explode(); X.vibe && X.vibe([40, 30, 80]);
        X.spawnDebris(p.x, p.y, p.z, 0x3a3440, 14, 6, 0.2, 1);
        X.spawnSprite(p.x, p.y, p.z, 0xffa040, 2.4, 1.4, 0.35, { add: true });
        if (sim.queue.length > 1) { sim.queue.pop(); X.refreshTray(); ft(p.x, p.y + 0.6, p.z - 1.5, '-1 BOLA', '#ff4f6d', 26); }
        else ft(p.x, p.y + 0.6, p.z - 1.5, '¡FALLÓ!', '#ffffff', 22);
      }
    }
    const pips = [];
    for (let i = 0; i < S.every; i++) pips.push(`<span class="pip${i < Math.min(S.every, waiting) ? ' on' : ''}${waiting >= S.every - 1 && i < waiting ? ' warn' : ''}"></span>`);
    S.sub = `<span>CAÑONAZO</span>${pips.join('')}<span style="opacity:.75">${S.ball ? '¡fuego!' : waiting >= S.every ? 'al parar la bola' : (S.every - waiting) + ' tiro' + (S.every - waiting === 1 ? '' : 's')}</span>`;
  }
  function initShip() {
    const g = new THREE.Group();
    // casco visto de lado: proa en punta a la izquierda, popa alta a la derecha
    const sh = new THREE.Shape();
    sh.moveTo(-4.3, 1.55); sh.lineTo(3.95, 1.55); sh.lineTo(3.85, 0.9); sh.quadraticCurveTo(3.4, -0.05, 2.4, -0.1);
    sh.lineTo(-2.2, -0.1); sh.quadraticCurveTo(-3.6, 0.1, -4.3, 1.55);
    const wood = new THREE.MeshStandardMaterial({ color: 0x9a5f2c, roughness: 0.75 }), dark = new THREE.MeshStandardMaterial({ color: 0x5e3416, roughness: 0.8 });
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
    // mástil, verga y bandera pirata (solo decoración)
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


  function initShip() {
    const g = new THREE.Group();
    const sh = new THREE.Shape();
    sh.moveTo(-4.3, 1.55); sh.lineTo(3.95, 1.55); sh.lineTo(3.85, 0.9); sh.quadraticCurveTo(3.4, -0.05, 2.4, -0.1);
    sh.lineTo(-2.2, -0.1); sh.quadraticCurveTo(-3.6, 0.1, -4.3, 1.55);
    const HULL = { candy: 0xff8ac8, neon: 0x2a2a48, fair: 0xd8463a, forest: 0x5a7a3a };
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

  function initPyramid() {
    const bl = S.sim.blocks.map(b => b.userData);
    S.need = { 1: Math.ceil(bl.filter(d => d.c === 'r' && d.kind === 'block').length * 0.6), 2: Math.ceil(bl.filter(d => d.c === 'b' && d.kind === 'block').length * 0.7), 3: bl.filter(d => d.kind === 'gold').length };
    S.dmg = { 1: 0, 2: 0, 3: 0 }; S.immuneT = 0;
    S.sarc = S.sim.blocks.filter(b => b.userData.kind === 'gold');
    const sealed = new THREE.MeshStandardMaterial({ color: 0x7a5a24, metalness: 0.7, roughness: 0.45, emissive: 0x2a1a00 });
    for (const b of S.sarc) { b.userData.kind = 'stone'; const m = G.meshes[b.userData.id]; if (m) { m.userData.goldMat = m.userData.body.material; m.userData.body.material = sealed; } }
    const g = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(5.2, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: SHIELD[1].hex, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    dome.scale.y = 1.55;
    const wire = new THREE.Mesh(new THREE.SphereGeometry(5.22, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: SHIELD[1].hex, wireframe: true, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending }));
    wire.scale.y = 1.55;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.08, 8, 64), new THREE.MeshBasicMaterial({ color: SHIELD[1].hex, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.06;
    g.add(dome, wire, ring); X.world.add(g); S.extras.push(g);
    S.shield = { g, dome, wire, ring };
  }
  function setShield(ph) {
    const sh = S.shield, c = SHIELD[ph];
    if (ph === 3) { sh.g.visible = false; return; }
    for (const m of [sh.dome, sh.wire, sh.ring]) m.material.color.setHex(c.hex);
  }
  function pyramidTick(dt) {
    const sim = S.sim, ph = S.phase;
    const prog = Math.min(1, S.dmg[ph] / Math.max(1, S.need[ph]));
    S.hp = Math.max(0, (3 - (ph - 1) - prog) / 3);
    if (S.shield) { const sh = S.shield; sh.dome.material.opacity = 0.08 + Math.sin(S.t * 3) * 0.03; sh.wire.rotation.y += dt * 0.25; }
    if (prog >= 1 && ph < 3 && !S.done) {
      S.phase = ph + 1; setShield(S.phase);
      $('bossSand').classList.remove('on'); void $('bossSand').offsetWidth; $('bossSand').classList.add('on');
      G.shake = Math.max(G.shake, 0.6); X.Audio.special && X.Audio.special();
      const keep = sim.queue.filter(k => k === 'bomb' || k === 'rainbow' || k === 'heavy');
      if (S.phase === 2) { sim.queue.splice(0, sim.queue.length, 'b', 'b', 'b', 'b', 'b', 'b', ...keep); banner('¡ESCUDO AZUL!', 'Tormenta de arena: ahora solo daña el azul'); }
      else {
        sim.queue.splice(0, sim.queue.length, 'y', 'y', 'heavy', 'y', ...keep); banner('¡SARCÓFAGO AL DESCUBIERTO!', 'Rompe el oro con cualquier bola');
        for (const b of S.sarc) {
          const d = b.userData, m = G.meshes[d.id];
          if (S.counted.has(d.id)) { S.dmg[3]++; continue; }      // ya se había caído al agua
          d.kind = 'gold'; b.wakeUp(); if (m && m.userData.goldMat) m.userData.body.material = m.userData.goldMat;
          for (let i = 0; i < 6; i++) X.spawnSprite(b.position.x + rnd(-0.5, 0.5), b.position.y + rnd(-0.4, 0.6), b.position.z + 0.6, 0xfff2b0, 0.8, 1.2, 0.8, { add: true });
        }
      }
      X.refreshTray();
      // la tormenta arranca la fachada: deja a la vista la capa de dentro (fase 2) o el sarcófago (fase 3)
      const strip = S.phase === 2 ? (d, b) => d.c === 'y' && b.position.z > 0.4 : (d, b) => (d.c === 'g' || d.c === 'b' || d.c === 'y') && b.position.z > -0.4;
      let n = 0;
      for (const b of sim.liveBlocks()) { const d = b.userData; if (d.kind === 'block' && strip(d, b)) { sim.popSingle(b, 0.25 + Math.abs(b.position.x) * 0.06 + b.position.y * 0.04); S.counted.add(d.id); n++; } }
      if (S.phase === 3 && S.dmg[3] >= S.need[3]) S.hp = 0;
    }
    const c = SHIELD[S.phase];
    S.sub = S.phase < 3
      ? `<span>ESCUDO</span><span class="shchip" style="background:${c.css}">${c.name}</span><span style="opacity:.8">solo le daña este color</span>`
      : `<span class="shchip" style="background:${c.css}">${c.name}</span><span style="opacity:.8">sin escudo: cualquier bola</span>`;
  }

  let coreMat = null;
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
    for (const id of S.cores) { const m = G.meshes[id]; if (m) m.userData.body.material = coreMat; }
    const sk = GOLEM_SKIN[S.L.biome];
    if (sk) { const rock = new THREE.MeshStandardMaterial({ color: sk[0], metalness: sk[1], roughness: sk[2] }); for (const b of sim.blocks) if (b.userData.kind === 'stone') { const m = G.meshes[b.userData.id]; if (m) m.userData.body.material = rock; } }
    const light = new THREE.PointLight(0xff5a10, 6, 9, 2); light.position.set(0, 5, 2); X.world.add(light); S.extras.push(light); S.light = light;
    S.walk = 0; S.stun = 0; S.charge = 0; S.coresHit = 0;
  }
  function golemTick(dt) {
    const sim = S.sim;
    S.hp = Math.max(0, (S.cores.length - S.coresHit) / S.cores.length);
    if (S.stun > 0) S.stun -= dt;
    const moving = S.stun <= 0 && !S.done && S.introT <= 0;
    if (S.plat) {
      const vx = moving ? 1.15 * 0.6 * Math.cos((S.walk += dt) * 0.6) : 0;
      for (const p of S.plats) p.velocity.set(vx, 0, 0);
      S.slab.position.copy(S.plat.position);
    }
    if (coreMat) coreMat.emissiveIntensity = 1.4 + Math.sin(S.t * (4 + S.charge * 10)) * 0.6 + S.charge * 1.5;
    if (S.light) { S.light.position.x = S.plat ? S.plat.position.x : 0; S.light.intensity = 4 + S.charge * 10; }
    if (moving && !S.done) S.charge = Math.min(1, S.charge + dt / 9);
    if (S.charge >= 1 && !S.done) {
      S.charge = 0;
      const px = S.plat ? S.plat.position.x : 0, cp = G.level.cannon;
      G.shake = Math.max(G.shake, 1); X.Audio.explode && X.Audio.explode(); X.Audio.thud && X.Audio.thud(9, true); X.vibe && X.vibe([60, 40, 120]);
      for (let r = 0; r < 3; r++) X.spawnRing(px, 0.3, 0, 0xff6a1a, 4 + r * 3, 0.6 + r * 0.25);
      X.spawnDebris(px, 0.4, 1.5, 0xff7a2a, 24, 8, 0.2, 1.2);
      banner('¡GOLPE SÍSMICO!', 'Te ha quitado una bola');
      if (sim.queue.length > 1) { sim.queue.pop(); X.refreshTray(); ft(cp.x, cp.y + 1, cp.z - 2, '-1 BOLA', '#ff4f6d', 26); }
    }
    S.sub = `<span>GOLPE SÍSMICO</span><span class="chg${S.charge > 0.85 ? ' full' : ''}"><i style="width:${Math.round(S.charge * 100)}%"></i></span>${S.stun > 0 ? '<span style="color:#ffd23f">¡ATURDIDO!</span>' : ''}`;
  }

  function onRemoved(b, d) {
    const p = b.position;
    if (S.key === 'ship') {
      if (d.kind !== 'stone') S.removed++;
      if (d.kind === 'gold') { S.gold++; ft(p.x, p.y + 0.8, p.z, '¡TESORO!', '#ffd23f', 28); G.shake = Math.max(G.shake, 0.4); }
    } else if (S.key === 'pyramid') {
      const sc = SHIELD[S.phase].c;
      if (d.kind === 'gold') { S.dmg[3]++; if (S.phase === 3) ft(p.x, p.y + 0.8, p.z, '¡CRACK!', '#ffd23f', 28); }
      else if (d.kind === 'block' && d.c === sc && S.phase < 3) S.dmg[S.phase]++;
      else if (d.kind === 'block' && d.popping && S.t - S.immuneT > 0.9 && S.phase < 3) { S.immuneT = S.t; ft(p.x, p.y + 0.6, p.z, '¡INMUNE!', '#e6e2f5', 20); }
    } else if (S.key === 'golem') {
      if (d.kind === 'gold') {
        S.coresHit++; S.charge = 0; S.stun = 2.5;
        G.shake = Math.max(G.shake, 0.5); X.Audio.crown && X.Audio.crown();
        ft(p.x, p.y + 0.8, p.z, S.coresHit < S.cores.length ? '¡ATURDIDO!' : '¡NÚCLEO!', '#ffd23f', 28);
      }
    }
    if (S.hp !== undefined) { const el = $('bbHp'); el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
  }

  function updateBar(force) {
    const pct = Math.max(0, Math.min(1, S.hp));
    $('bbFill').style.width = (pct * 100).toFixed(1) + '%';
    $('bbLag').style.width = (pct * 100).toFixed(1) + '%';
    $('bbPct').textContent = Math.ceil(pct * 100) + '%';
    $('bbPhase').textContent = S.key === 'ship' ? 'FASE ' + S.phase + '/2' : S.key === 'pyramid' ? 'FASE ' + S.phase + '/3' : 'NÚCLEOS ' + ((S.cores ? S.cores.length : 3) - (S.coresHit || 0)) + '/' + (S.cores ? S.cores.length : 3);
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
      if (!d.alive || d.destroyed || d.popping || b.position.y < (S.key === 'ship' ? 0.9 : -1.2)) { S.counted.add(d.id); onRemoved(b, d); }
    }
    if (S.key === 'ship') shipTick(dt);
    else if (S.key === 'pyramid') pyramidTick(dt);
    else golemTick(dt);
    if (!S.done) updateBar();
    if (!S.done && S.hp <= 0) victory();
  }
  window.Bosses = { start, stop, tick, hp: () => (S ? S.hp : 1), active: () => !!S };
})();
