// Chroma Crash 3D — reglas y física (cannon-es). Sin dibujo: sirve al juego y al validador.
(function (root) {
  'use strict';
  const CANNON = root.CANNON || (typeof require !== 'undefined' ? require('../vendor/cannon-es.cjs.js') : null);

  const C = {
    G: -15, DT: 1 / 120,
    ISLAND_R: 5.6, ISLAND_H: 1.4,      // isla: cilindro con la cara superior en y = 0
    SEA_Y: -7,
    FALL_Y: -1.5,                      // por debajo de esto un bloque cuenta como derribado
    BALL_R: 0.34,
    ADJ: 0.08,                         // distancia para considerar dos bloques pegados
    CASCADE_V: 3.6, GLASS_V: 3.2, TNT_V: 5.5,
    BOMB_R: 2.2, TNT_R: 2.6,
    COLORS: ['r', 'b', 'g', 'y', 'p'],
    CANNON_POS: { x: 0, y: 1.3, z: 10.5 },
    SHIP_S: 1.6,                       // escala del velero (el dibujo usa la misma)
    SHIP_Z: -72, SHIP_ZR: 8, SHIP_X: 28, // distancia del velero y hasta dónde navega a cada lado
    // medidas del velero en sus propias coordenadas (antes de escalar); el dibujo y el choque usan las mismas
    BOAT: { hull: [-1.2, 1.4, 0.5, 0.44], ballR: 0.42, ballX: [-0.62, 0.62], ballY: 0.93, boomY: 1.42,
      main: [0, -1.1, 3.4], jib: [0.1, 1.25, 3.05] },
    SAND_V: 2.2, PRIZE_V: 3.0,          // arena: se deshace con un golpe flojo · bola congelada: se rompe al caer
    // En los mundos sin mar el velero se cambia por otro objeto que cruza el cielo con 2 bolas.
    // Piezas para el choque, en coordenadas del propio objeto: esferas [x, y, z, r] y cajas [x, y, z, mx, my, mz] (medias medidas).
    // 'balls' = dónde van las 2 bolas a la vista (también cuentan para el choque).
    CARRIERS: {
      desert: { name: 'globo', s: 1.0, z: -30, zr: 6, speed: [2.8, 3.6], bob: 0.35, bobF: 0.9,
        spheres: [[0, 2.55, 0, 1.25]], boxes: [[0, 0.45, 0, 0.5, 0.32, 0.5]], ballR: 0.27, balls: [[-0.24, 0.92, 0.12], [0.24, 0.92, 0.12]] },
      snow: { name: 'teleférico', s: 1.0, z: -32, zr: 6, speed: [3.0, 3.8], bob: 0, bobF: 0, cable: 1.55,
        spheres: [], boxes: [[0, 0, 0, 0.72, 0.55, 0.5]], ballR: 0.27, balls: [[-0.3, -0.12, 0.05], [0.3, -0.12, 0.05]] },
      jungle: { name: 'mono', s: 1.0, z: -28, zr: 5, speed: [4.4, 5.4], bob: 0, bobF: 0, slope: 0.16, cable: 0.15,
        spheres: [[0, -0.75, 0, 0.42], [0.05, -0.2, 0, 0.3]], boxes: [], ballR: 0.27, balls: [[-0.25, -1.45, 0], [0.25, -1.45, 0]] },
      volcano: { name: 'dragón', s: 1.1, z: -30, zr: 6, speed: [3.2, 4.0], bob: 0.45, bobF: 1.4,
        spheres: [[0, 0, 0, 0.55], [0.85, 0.3, 0, 0.36]], boxes: [[0, -0.85, 0, 0.42, 0.26, 0.36]], ballR: 0.26, balls: [[-0.22, -0.66, 0.08], [0.22, -0.66, 0.08]] },
      space: { name: 'ovni', s: 1.0, z: -30, zr: 6, speed: [3.4, 4.4], bob: 0.5, bobF: 1.7,
        spheres: [[0, 0.32, 0, 0.62]], boxes: [[0, 0, 0, 1.35, 0.2, 1.35]], ballR: 0.25, balls: [[-0.24, 0.32, 0], [0.24, 0.32, 0]] },
    },
  };
  const isColor = k => C.COLORS.indexOf(k) >= 0;
  const BALL_CODES = { r: 'r', b: 'b', g: 'g', y: 'y', p: 'p', B: 'bomb', R: 'rainbow', H: 'heavy' };

  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  // separación aproximada entre dos cajas orientadas (SAT 15 ejes); negativa si se solapan
  const _ax = [new CANNON.Vec3(), new CANNON.Vec3(), new CANNON.Vec3()], _bx = [new CANNON.Vec3(), new CANNON.Vec3(), new CANNON.Vec3()];
  const _l = new CANNON.Vec3(), _t = new CANNON.Vec3();
  const UNIT = [new CANNON.Vec3(1, 0, 0), new CANNON.Vec3(0, 1, 0), new CANNON.Vec3(0, 0, 1)];
  function obbGap(A, B) {
    const ha = A.half, hb = B.half;
    for (let i = 0; i < 3; i++) { A.quaternion.vmult(UNIT[i], _ax[i]); B.quaternion.vmult(UNIT[i], _bx[i]); }
    B.position.vsub(A.position, _t);
    let best = -Infinity;
    const test = L => {
      const len = Math.sqrt(L.x * L.x + L.y * L.y + L.z * L.z);
      if (len < 1e-6) return;
      const lx = L.x / len, ly = L.y / len, lz = L.z / len;
      const dot = (v) => Math.abs(v.x * lx + v.y * ly + v.z * lz);
      const ra = ha.x * dot(_ax[0]) + ha.y * dot(_ax[1]) + ha.z * dot(_ax[2]);
      const rb = hb.x * dot(_bx[0]) + hb.y * dot(_bx[1]) + hb.z * dot(_bx[2]);
      const s = Math.abs(_t.x * lx + _t.y * ly + _t.z * lz) - ra - rb;
      if (s > best) best = s;
    };
    for (let i = 0; i < 3; i++) { test(_ax[i]); test(_bx[i]); }
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { _ax[i].cross(_bx[j], _l); test(_l); }
    return best;
  }

  // Cámara de referencia (móvil vertical 9:19,5), igual que el encuadre del juego.
  // Sirve para saber si un bloque se ve y se puede apuntar cuando no hay pantalla (validador).
  function referenceCam(level) {
    let maxY = 3;
    for (const b of level.blocks) maxY = Math.max(maxY, b.y + b.h / 2);
    const cp = level.cannon || C.CANNON_POS, fov = 56, aspect = 0.46, back = 3.4;
    const half = fov / 2 * Math.PI / 180, lookY = Math.max(1.4, maxY * 0.42), want = half * 0.8;
    let best = 2.2, err = 1e9;
    for (let u = 1.6; u <= 7; u += 0.05) {
      const e = Math.abs(Math.atan2(u, back) - Math.atan2(cp.y + u - lookY, cp.z + back) - want);
      if (e < err) { err = e; best = u; }
    }
    const pos = { x: 0, y: cp.y + best, z: cp.z + back };
    let fx = 0, fy = lookY - pos.y, fz = -pos.z; const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
    let rx = -fz, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;      // derecha = adelante × arriba
    const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;                      // arriba de cámara = derecha × adelante
    const tanV = Math.tan(half), tanH = tanV * aspect;
    // proyección a la pantalla de referencia (-1..1); null si queda detrás
    const project = p => {
      const vx = p.x - pos.x, vy = p.y - pos.y, vz = p.z - pos.z;
      const z = vx * fx + vy * fy + vz * fz;
      if (z < 0.5) return null;
      return { x: (vx * rx + vz * rz) / (z * tanH), y: (vx * ux + vy * uy + vz * uz) / (z * tanV) };
    };
    return { pos, tanH, project };
  }
  function referenceView(level) {
    const cam = referenceCam(level);
    return p => { const q = cam.project(p); return !!q && inAimZone(q.x, q.y); };
  }
  // zona de pantalla donde un bloque se ve y se puede tocar (coordenadas -1..1):
  // fuera quedan los bordes, la franja del marcador, la bandeja de bolas y el cañón
  function inAimZone(x, y) {
    if (Math.abs(x) > 0.86 || y > 0.86 || y < -0.62) return false;
    if (Math.abs(x) < 0.3 && y < -0.4) return false;
    return true;
  }

  class Sim {
    constructor(level, opts) {
      opts = opts || {};
      this.level = level;
      this.events = [];
      this.t = 0; this.acc = 0;
      this.score = 0;
      this.queue = level.balls.split('').map(ch => BALL_CODES[ch]);
      if (opts.boosters) for (const k of opts.boosters) this.queue.unshift(k);
      this.balls = []; this.blocks = []; this.pending = [];
      this.rand = rng(level.id * 7919 + 13);
      this.state = 'settle'; this.silent = true; this.armed = false;
      this.chain = 1; this.shotPops = 0; this.shotOpen = false;
      this.sinceFire = 99; this.idle = 0; this.shots = 0; this.popped = 0; this.fallen = 0;
      this.target = level.target || 0.8;
      this.goalReached = false; this.leftover = 0; this.bonus = 0; this.coins = 0;
      this.prevPairs = new Set();
      this.cannon = Object.assign({}, C.CANNON_POS, level.cannon || {});
      this.viewTest = opts.viewTest || referenceView(level);   // el juego lo cambia por la cámara real
      this.build();
      this.gems = 0;
      if (opts.gems) this.placeGems(opts.gems, opts.gemSeed || 1);
      for (let i = 0; i < 30; i++) { this.applyFloat(); this.world.step(C.DT); }
      for (const b of this.blocks) b.sleep();
      this.events.length = 0;
      this.silent = false; this.state = 'play';
      // pájaro y barco de premio: aparecen al azar
      this.movers = []; this.moverId = 0;
      this.nextBird = 9 + this.rand() * 10; this.nextShip = 16 + this.rand() * 12;
    }

    build() {
      const w = this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, C.G, 0) });
      w.broadphase = new CANNON.SAPBroadphase(w);
      w.allowSleep = true;
      w.solver.iterations = 18;
      w.solver.tolerance = 1e-4;
      w.defaultContactMaterial.friction = 0.55;
      w.defaultContactMaterial.restitution = 0.05;
      w.defaultContactMaterial.contactEquationStiffness = 5e7;
      w.defaultContactMaterial.contactEquationRelaxation = 3;
      w.defaultContactMaterial.frictionEquationStiffness = 5e7;
      // isla
      const isl = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
      isl.addShape(new CANNON.Cylinder(C.ISLAND_R, C.ISLAND_R, C.ISLAND_H, 28));
      isl.position.set(0, -C.ISLAND_H / 2, 0);
      isl.userData = { kind: 'island' };
      w.addBody(isl); this.island = isl;
      // plataformas extra del nivel (estáticas)
      for (const p of this.level.statics || []) {
        const b = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
        b.addShape(new CANNON.Box(new CANNON.Vec3(p.w / 2, p.h / 2, p.d / 2)));
        b.position.set(p.x, p.y + p.h / 2, p.z);
        b.half = new CANNON.Vec3(p.w / 2, p.h / 2, p.d / 2);
        b.userData = { kind: 'plat', w: p.w, h: p.h, d: p.d };
        w.addBody(b);
      }
      let id = 0;
      for (const d of this.level.blocks) {
        const t = d.t || 'n';
        let data, density = 1, friction = 0.55;
        if (t === 's') { data = { kind: 'stone' }; density = 2.6; friction = 0.7; }
        else if (t === 'tnt') { data = { kind: 'tnt', lit: false }; density = 0.8; }
        else if (t === 'gl') { data = { kind: 'glass' }; density = 0.9; friction = 0.35; }
        else if (t === 'gold') { data = { kind: 'gold' }; density = 1.6; friction = 0.6; }
        else if (t === 'sand') { data = { kind: 'sand' }; density = 1.1; friction = 0.8; }
        else if (t === 'prize') { data = { kind: 'prize', c: d.c || 'r' }; density = 0.9; friction = 0.3; }
        else if (t === 'magma') { data = { kind: 'magma' }; density = 2.2; friction = 0.7; }
        else data = { kind: 'block', c: d.c, ice: t === 'i', stripe: t === 'st', bomb: t === 'bm', cham: t === 'cham', hp: t === 'i' ? 2 : 1, popping: false };
        if (d.fl) data.float = true;
        data.id = id++; data.w = d.w; data.h = d.h; data.d = d.d;
        const half = new CANNON.Vec3(d.w / 2 - 0.002, d.h / 2 - 0.002, d.d / 2 - 0.002);
        const body = new CANNON.Body({ mass: density * d.w * d.h * d.d, material: new CANNON.Material({ friction, restitution: 0.04 }) });
        body.addShape(new CANNON.Box(half));
        body.position.set(d.x, d.y, d.z);
        if (d.ry) body.quaternion.setFromEuler(0, d.ry, 0);
        body.linearDamping = data.float ? 0.45 : 0.04; body.angularDamping = data.float ? 0.5 : 0.08;
        body.sleepSpeedLimit = 0.12; body.sleepTimeLimit = 0.6;
        body.half = half; body.userData = data;
        data.alive = true; data.destroyed = false;
        w.addBody(body); this.blocks.push(body);
      }
      this.total = this.blocks.filter(b => b.userData.kind !== 'stone').length;   // la piedra no cuenta
      this.floating = this.blocks.filter(b => b.userData.float);
      this.chams = this.blocks.filter(b => b.userData.cham);
      this.levelColors = C.COLORS.filter(c => this.level.blocks.some(b => b.c === c && b.t !== 'prize'));
      if (!this.levelColors.length) this.levelColors = ['r', 'b'];
    }

    // gemas: algunos bloques de color de la cara delantera (los que se ven) llevan una gema dentro
    placeGems(n, seed) {
      const r = rng(seed);
      const col = this.blocks.filter(b => b.userData.kind === 'block' && !b.userData.ice && !b.userData.stripe && !b.userData.bomb);
      if (!col.length) return;
      const front = Math.max(...col.map(b => b.position.z));
      let pool = col.filter(b => b.position.z > front - 0.6 && b.position.y > 0.6);
      if (pool.length < n) pool = col;
      for (let i = 0; i < n && pool.length; i++) {
        const k = Math.floor(r() * pool.length);
        pool[k].userData.gem = true;
        pool.splice(k, 1);
      }
    }
    takeGem(b) {
      const d = b.userData;
      if (!d.gem || d.gemTaken) return;
      d.gemTaken = true; this.gems++; this.score += 100;
      this.emit({ type: 'gem', x: b.position.x, y: b.position.y, z: b.position.z });
    }
    emit(e) { if (!this.silent) this.events.push(e); }
    progress() { return this.total ? (this.popped + this.fallen) / this.total : 0; }

    // ---------- disparo ----------
    canFire() { return this.state === 'play' && this.queue.length > 0 && this.sinceFire > 0.6; }
    muzzle() { return { x: this.cannon.x, y: this.cannon.y + 0.35, z: this.cannon.z - 0.9 }; }
    // altura y cara delantera de lo que queda en pie (se recalcula una vez por paso)
    silhouette() {
      if (this._silT === this.t && this._sil) return this._sil;
      let top = 0, front = 0;
      for (const b of this.blocks) { const d = b.userData; if (!d.alive || d.destroyed) continue; top = Math.max(top, b.position.y + d.h / 2); front = Math.max(front, b.position.z + d.d / 2); }
      this._silT = this.t; return (this._sil = { top, front });
    }
    // velocidad para que la bola pase por el punto apuntado
    launch(tx, ty, tz) {
      const m = this.muzzle();
      const dx = tx - m.x, dy = ty - m.y, dz = tz - m.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      // cerca (la estructura): tiro tenso; lejos (pájaro, barco): parábola alta que pasa por encima
      let T = dist <= 19 ? Math.max(0.42, Math.min(0.95, dist / 17)) : Math.min(2.8, 0.95 + (dist - 19) / 20);
      // tiros al mar (el velero, por detrás de la estructura): la parábola sube lo justo para pasar por encima
      const sil = this.silhouette();
      if (dist > 19 && tz < sil.front - 1) {
        const f = (sil.front - m.z) / (tz - m.z);
        if (f > 0 && f < 1) { const need = (sil.top + 1.2 - m.y - dy * f) / (0.5 * -C.G * f * (1 - f)); if (need > T * T) T = Math.min(3.6, Math.sqrt(need)); }
      }
      return { m, T, vx: dx / T, vy: dy / T - 0.5 * C.G * T, vz: dz / T };
    }
    trajectory(tx, ty, tz, n) {
      const L = this.launch(tx, ty, tz), pts = [];
      for (let i = 0; i <= n; i++) {
        const t = (i / n) * L.T;
        pts.push({ x: L.m.x + L.vx * t, y: L.m.y + L.vy * t + 0.5 * C.G * t * t, z: L.m.z + L.vz * t });
      }
      return pts;
    }
    fire(tx, ty, tz) {
      if (!this.canFire()) return false;
      const kind = this.queue.shift();
      this.spawnBall(kind, tx, ty, tz);
      this.armed = true; this.chain = 1; this.shotPops = 0; this.shotOpen = true; this.shotGolden = kind === 'golden';
      this.sinceFire = 0; this.idle = 0; this.shots++;
      if (this.chams && this.chams.length) this.chamPending = true;
      this.emit({ type: 'shoot', kind });
      return true;
    }
    spawnBall(kind, tx, ty, tz) {
      const L = this.launch(tx, ty, tz);
      const heavy = kind === 'heavy';
      const r = heavy ? 0.42 : kind === 'golden' ? 0.4 : C.BALL_R;
      const b = new CANNON.Body({ mass: (heavy ? 12 : 3.4) * (4 / 3) * Math.PI * r * r * r, material: new CANNON.Material({ friction: 0.4, restitution: 0.3 }) });
      b.addShape(new CANNON.Sphere(r));
      b.position.set(L.m.x, L.m.y, L.m.z);
      b.velocity.set(L.vx, L.vy, L.vz);
      b.linearDamping = 0.01; b.angularDamping = 0.3;
      b.allowSleep = false;
      b.userData = { kind: 'ball', ball: kind, c: isColor(kind) ? kind : null, age: 0, slow: 0, dead: false, r };
      this.world.addBody(b); this.balls.push(b);
      return b;
    }
    // carga en el cañón la bola i de la bandeja (la del cañón pasa a ocupar su sitio)
    select(i) {
      if (this.state !== 'play' || i < 1 || i >= this.queue.length) return false;
      const t = this.queue[0]; this.queue[0] = this.queue[i]; this.queue[i] = t;
      this.emit({ type: 'swap' });
      return true;
    }
    swap() { return this.select(1); }
    addBalls(n) {
      const counts = {};
      for (const b of this.blocks) { const d = b.userData; if (d.alive && !d.destroyed && d.kind === 'block' && !d.popping) counts[d.c] = (counts[d.c] || 0) + 1; }
      const cols = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
      for (let i = 0; i < n; i++) this.queue.push(cols.length ? cols[i % cols.length] : 'heavy');
      if (this.state === 'lost') this.state = 'play';
      this.sinceFire = 99; this.idle = 0;
    }

    // ---------- contactos ----------
    processContacts() {
      const now = new Set();
      for (const eq of this.world.contacts) {
        const A = eq.bi, B = eq.bj;
        const key = A.id < B.id ? A.id * 100000 + B.id : B.id * 100000 + A.id;
        now.add(key);
        if (this.prevPairs.has(key)) continue;
        const pa = A.userData && A.userData._pv, pb = B.userData && B.userData._pv;
        const vax = pa ? pa[0] : 0, vay = pa ? pa[1] : 0, vaz = pa ? pa[2] : 0;
        const vbx = pb ? pb[0] : 0, vby = pb ? pb[1] : 0, vbz = pb ? pb[2] : 0;
        const n = eq.ni;
        const v = Math.abs((vbx - vax) * n.x + (vby - vay) * n.y + (vbz - vaz) * n.z);
        const px = A.position.x + eq.ri.x, py = A.position.y + eq.ri.y, pz = A.position.z + eq.ri.z;
        this.onContact(A, B, v, px, py, pz);
      }
      this.prevPairs = now;
    }
    onContact(A, B, v, px, py, pz) {
      const da = A.userData, db = B.userData;
      if (!da || !db) return;
      if (da.kind === 'ball') return this.ballHit(A, B, v, px, py, pz);
      if (db.kind === 'ball') return this.ballHit(B, A, v, px, py, pz);
      if (v > 2.4 && this.impactBudget > 0) { this.impactBudget--; this.emit({ type: 'impact', x: px, y: py, z: pz, v, stone: da.kind === 'stone' || db.kind === 'stone' }); }
      if (v > C.GLASS_V) { if (da.kind === 'glass') this.shatter(A); if (db.kind === 'glass') this.shatter(B); }
      if (v > C.SAND_V) { if (da.kind === 'sand') this.crumble(A); if (db.kind === 'sand') this.crumble(B); }
      if (v > C.PRIZE_V) { if (da.kind === 'prize') this.breakPrize(A); if (db.kind === 'prize') this.breakPrize(B); }
      if (v > C.TNT_V) { if (da.kind === 'tnt') this.ignite(A); if (db.kind === 'tnt') this.ignite(B); }
      if (this.armed && v > C.CASCADE_V && da.kind === 'block' && db.kind === 'block' && da.c === db.c && !da.popping && !db.popping && !da.destroyed && !db.destroyed) {
        this.chain++;
        this.emit({ type: 'cascade', x: px, y: py, z: pz, chain: this.chain, c: da.c });
        this.popGroup(A, true);
      }
    }
    ballHit(ball, other, v, px, py, pz) {
      const d = ball.userData, od = other.userData;
      if (d.dead) return;
      if (d.ball === 'golden') { this.goldenHit(ball, other); return; }
      if (d.ball === 'bomb' && od.kind !== 'island' || d.ball === 'bomb' && v > 2) { this.explode(ball.position.x, ball.position.y, ball.position.z, C.BOMB_R, true); this.killBall(ball, false); return; }
      if (v > 1.5 && this.impactBudget > 0) { this.impactBudget--; this.emit({ type: 'thud', x: px, y: py, z: pz, v }); }
      if (od.kind === 'gold' && !od.popping && !od.destroyed) this.popSingle(other, 0.02);
      else if (od.kind === 'glass' && v > 1.5) this.shatter(other);
      else if (od.kind === 'sand' && v > 1) this.crumble(other);
      else if (od.kind === 'prize' && v > 1) this.breakPrize(other);
      else if (od.kind === 'tnt') this.ignite(other);
      else if (od.kind === 'block' && !od.popping && !od.destroyed) {
        if (d.ball === 'rainbow' && !d.c) d.c = od.c;
        if (d.c && d.c === od.c) this.popGroup(other, false);
      }
    }
    // bola dorada: revienta TODOS los bloques del color que toca, estén donde estén (también el hielo),
    // y suelta una onda expansiva; si toca algo sin color, explota a lo grande
    goldenHit(ball, other) {
      const od = other.userData, p = ball.position;
      const c = od && od.c;
      this.killBall(ball, false);
      this.chain = Math.max(this.chain, 2);
      this.emit({ type: 'golden', x: p.x, y: p.y, z: p.z, c: c || null });
      this.explode(p.x, p.y, p.z, c ? 1.6 : 3.2, true);
      if (!c) return;
      for (const b of this.liveBlocks()) {
        const bd = b.userData;
        if (bd.kind === 'block' && bd.c === c && !bd.popping) {
          const dist = b.position.distanceTo(p);
          this.popSingle(b, 0.06 + dist * 0.05);
        }
      }
    }
    // Un bloque que se ha movido y se queda quieto donde no se ve o no se puede apuntar
    // (esquinas delante del cañón, detrás de la bandeja...) se empuja fuera de la isla y cuenta como derribado.
    sweepHidden(dt) {
      for (const b of this.blocks) {
        const d = b.userData;
        if (!d.alive || d.destroyed || d.popping) continue;
        if (!d.home) d.home = { x: b.position.x, y: b.position.y, z: b.position.z };
        const p = b.position;
        const moved = Math.hypot(p.x - d.home.x, p.y - d.home.y, p.z - d.home.z) > 0.6;
        const still = b.sleepState === CANNON.Body.SLEEPING || b.velocity.lengthSquared() < 0.25;
        if (!moved || !still || this.viewTest(p)) { d.hiddenT = 0; continue; }
        d.hiddenT = (d.hiddenT || 0) + dt;
        if (d.hiddenT < 0.8) continue;
        d.hiddenT = -0.6;                                   // si no cae, lo vuelve a intentar con más fuerza
        d.sweeps = (d.sweeps || 0) + 1;
        let ox = p.x, oz = p.z; const ol = Math.hypot(ox, oz) || 1; ox /= ol; oz /= ol;
        const f = 4.5 + d.sweeps * 2;
        b.wakeUp();
        b.velocity.set(ox * f, 3 + d.sweeps, oz * f);
        b.angularVelocity.set(oz * 4, 0, -ox * 4);
        this.emit({ type: 'sweep', id: d.id, x: p.x, y: p.y, z: p.z });
      }
    }
    killBall(b, poof) {
      const d = b.userData;
      if (d.dead) return;
      d.dead = true; this.world.removeBody(b);
      this.balls = this.balls.filter(x => x !== b);
      if (poof) this.emit({ type: 'poof', x: b.position.x, y: b.position.y, z: b.position.z, c: d.c });
    }

    liveBlocks() { return this.blocks.filter(b => b.userData.alive && !b.userData.destroyed); }

    popGroup(start, cascade) {
      const sd = start.userData;
      if (sd.popping || sd.destroyed) return;
      const c = sd.c;
      const cands = this.blocks.filter(b => { const d = b.userData; return d.alive && !d.destroyed && d.kind === 'block' && d.c === c && !d.popping; });
      const seen = new Set([start]);
      let frontier = [start], depth = 0, n = 0;
      while (frontier.length) {
        const next = [];
        for (const b of frontier) {
          const bd = b.userData;
          if (bd.ice && bd.hp > 1) { bd.hp--; this.emit({ type: 'crack', id: bd.id, x: b.position.x, y: b.position.y, z: b.position.z }); continue; }
          bd.popping = true; n++;
          const delay = depth * 0.05;
          this.later(delay, () => this.removeBlock(b));
          for (const o of cands) { if (!seen.has(o) && obbGap(b, o) < C.ADJ) { seen.add(o); next.push(o); } }
          for (const o of this.blocks) {
            const od = o.userData;
            if (od.alive && !od.destroyed && od.kind === 'tnt' && !od.lit && obbGap(b, o) < C.ADJ) this.later(delay + 0.05, () => this.ignite(o));
          }
        }
        frontier = next; depth++;
      }
      if (n > 0) this.emit({ type: 'group', n, c, chain: this.chain, cascade, x: start.position.x, y: start.position.y, z: start.position.z });
    }
    // al reventar un bloque, la arena pegada se desmorona y el magma pegado entra en erupción
    touchNeighbors(b) {
      for (const o of this.blocks) {
        const od = o.userData;
        if (o === b || !od.alive || od.destroyed || (od.kind !== 'sand' && od.kind !== 'magma')) continue;
        if (obbGap(b, o) >= C.ADJ + 0.02) continue;
        if (od.kind === 'sand') this.later(0.1 + this.rand() * 0.12, () => this.crumble(o));
        else this.heat(o);
      }
    }
    removeBlock(b) {
      const d = b.userData;
      if (!d.alive || d.destroyed) return;
      this.touchNeighbors(b);
      d.alive = false; d.destroyed = true;
      this.world.removeBody(b);
      this.popped++; this.shotPops++;
      this.takeGem(b);
      if (d.kind === 'gold') { this.coins += 10; this.emit({ type: 'coin', x: b.position.x, y: b.position.y, z: b.position.z, n: 10 }); }
      const pts = (d.kind === 'gold' ? 25 : 10) * this.chain;
      this.score += pts;
      this.emit({ type: 'pop', id: d.id, x: b.position.x, y: b.position.y, z: b.position.z, c: d.c, chain: this.chain, pts, w: d.w, h: d.h, d: d.d });
      this.wakeAll();
      if (d.stripe) this.later(0.04, () => this.stripeBlast(b.position.x, b.position.y, b.position.z));
      if (d.bomb) this.later(0.04, () => this.explode(b.position.x, b.position.y, b.position.z, C.BOMB_R, false));
    }
    stripeBlast(x, y, z) {
      this.emit({ type: 'stripe', x, y, z });
      for (const o of this.liveBlocks()) {
        const od = o.userData;
        if (Math.abs(o.position.y - y) > 0.55) continue;
        if ((od.kind === 'block' || od.kind === 'gold') && !od.popping) this.popSingle(o, Math.abs(o.position.x - x) * 0.03);
        else if (od.kind === 'glass') this.shatter(o);
        else if (od.kind === 'sand') this.crumble(o);
        else if (od.kind === 'prize') this.breakPrize(o);
        else if (od.kind === 'magma') this.heat(o);
        else if (od.kind === 'tnt') this.ignite(o);
      }
    }
    shatter(b) {
      const d = b.userData;
      if (!d.alive || d.destroyed) return;
      d.alive = false; d.destroyed = true;
      this.world.removeBody(b);
      this.popped++; this.score += 20;
      this.emit({ type: 'glass', id: d.id, x: b.position.x, y: b.position.y, z: b.position.z, w: d.w, h: d.h, d: d.d });
      this.wakeAll();
    }
    // antigravedad: los bloques flotantes anulan su propio peso (si les cae algo encima, bajan)
    applyFloat() {
      if (!this.floating || !this.floating.length) return;
      for (const b of this.floating) { const d = b.userData; if (d.alive && !d.destroyed && b.sleepState !== CANNON.Body.SLEEPING) b.force.y -= C.G * b.mass; }
    }
    // arena: se deshace en polvo (cuenta como derribada)
    crumble(b) {
      const d = b.userData;
      if (!d.alive || d.destroyed) return;
      d.alive = false; d.destroyed = true;
      this.world.removeBody(b);
      this.popped++; this.score += 15;
      this.emit({ type: 'crumble', id: d.id, x: b.position.x, y: b.position.y, z: b.position.z, w: d.w, h: d.h, d: d.d });
      this.wakeAll();
    }
    // bola congelada: al romper el hielo, la bola de dentro pasa a tu bandeja
    breakPrize(b) {
      const d = b.userData;
      if (!d.alive || d.destroyed) return;
      d.alive = false; d.destroyed = true;
      this.world.removeBody(b);
      this.popped++; this.score += 30;
      if (this.state === 'play') this.giveBalls([d.c]);
      this.emit({ type: 'prize', id: d.id, x: b.position.x, y: b.position.y, z: b.position.z, c: d.c });
      this.wakeAll();
    }
    // magma: se calienta y estalla hacia arriba, fundiendo toda su columna (de cualquier color)
    heat(b) {
      const d = b.userData;
      if (!d.alive || d.destroyed || d.hot) return;
      d.hot = true;
      this.emit({ type: 'heat', id: d.id, x: b.position.x, y: b.position.y, z: b.position.z });
      this.later(0.45, () => this.erupt(b));
    }
    erupt(b) {
      const d = b.userData;
      if (!d.alive || d.destroyed) return;
      const x = b.position.x, y = b.position.y, z = b.position.z;
      d.alive = false; d.destroyed = true; this.popped++; this.score += 40;
      this.world.removeBody(b);
      this.emit({ type: 'erupt', id: d.id, x, y, z });
      this.wakeAll();
      let k = 0;
      for (const o of this.liveBlocks()) {
        const od = o.userData, p = o.position;
        if (Math.abs(p.x - x) > 0.6 || Math.abs(p.z - z) > 0.6 || p.y < y - 0.3) continue;
        const delay = 0.04 + (p.y - y) * 0.05; k++;
        if ((od.kind === 'block' || od.kind === 'gold') && !od.popping) this.popSingle(o, delay);
        else if (od.kind === 'glass') this.later(delay, () => this.shatter(o));
        else if (od.kind === 'sand') this.later(delay, () => this.crumble(o));
        else if (od.kind === 'prize') this.later(delay, () => this.breakPrize(o));
        else if (od.kind === 'magma') this.heat(o);
        else if (od.kind === 'tnt') this.later(delay, () => this.ignite(o));
        else { o.velocity.y += 7; }
      }
      // empuja un poco lo de alrededor
      for (const o of this.liveBlocks()) {
        const p = o.position, dx = p.x - x, dz = p.z - z, dist = Math.hypot(dx, p.y - y, dz);
        if (dist > 1.8 || dist < 0.01) continue;
        o.velocity.x += dx / dist * 2.5; o.velocity.y += 2; o.velocity.z += dz / dist * 2.5;
      }
    }
    // camaleón: cuando termina cada tiro, todos cambian al siguiente color del nivel
    shiftChams() {
      const cols = this.levelColors;
      for (const b of this.chams) {
        const d = b.userData;
        if (!d.alive || d.destroyed || d.popping) continue;
        const i = cols.indexOf(d.c);
        d.c = cols[(i + 1) % cols.length];
        this.emit({ type: 'cham', id: d.id, c: d.c, x: b.position.x, y: b.position.y, z: b.position.z });
      }
    }
    ignite(b) {
      const d = b.userData;
      if (!d.alive || d.destroyed || d.lit) return;
      d.lit = true;
      this.emit({ type: 'fuse', id: d.id, x: b.position.x, y: b.position.y, z: b.position.z });
      this.later(0.16, () => {
        if (!d.alive || d.destroyed) return;
        d.alive = false; d.destroyed = true; this.popped++;
        this.world.removeBody(b);
        this.emit({ type: 'gone', id: d.id });
        this.explode(b.position.x, b.position.y, b.position.z, C.TNT_R, false);
      });
    }
    explode(x, y, z, R, isBomb) {
      this.emit({ type: 'explode', x, y, z, r: R, bomb: isBomb });
      this.score += 50;
      this.wakeAll();
      for (const b of this.liveBlocks()) {
        const d = b.userData;
        const dx = b.position.x - x, dy = b.position.y - y, dz = b.position.z - z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist > R + 0.8) continue;
        if ((d.kind === 'block' || d.kind === 'gold') && dist < R * 0.65) { this.popSingle(b, 0.02 + dist * 0.02); continue; }
        if (d.kind === 'glass' && dist < R) { this.shatter(b); continue; }
        if (d.kind === 'sand' && dist < R) { this.crumble(b); continue; }
        if (d.kind === 'prize' && dist < R * 0.8) { this.breakPrize(b); continue; }
        if (d.kind === 'magma' && dist < R) this.heat(b);
        if (d.kind === 'tnt' && !d.lit) { this.later(0.1, () => this.ignite(b)); }
        const f = 11 * Math.max(0.2, 1 - dist / (R + 0.8));
        const nx = dist > 1e-6 ? dx / dist : 0, ny = dist > 1e-6 ? dy / dist : 1, nz = dist > 1e-6 ? dz / dist : 0;
        b.velocity.x += nx * f; b.velocity.y += ny * f + 2.5; b.velocity.z += nz * f;
        b.angularVelocity.x += (nz * 3 - ny); b.angularVelocity.z += (-nx * 3 + ny);
      }
    }
    popSingle(b, delay) {
      const d = b.userData;
      if (d.popping || d.destroyed) return;
      d.popping = true;
      this.later(delay || 0.02, () => this.removeBlock(b));
    }
    wakeAll() { for (const b of this.blocks) if (b.userData.alive) b.wakeUp(); }
    later(t, fn) { this.pending.push({ t: this.t + t, fn }); }

    // ---------- bucle ----------
    update(dt) {
      this.acc += Math.min(dt, 0.1);
      let steps = 0;
      while (this.acc >= C.DT && steps < 6) { this.step(); this.acc -= C.DT; steps++; }
      if (steps >= 6) this.acc = 0;
    }
    step() {
      const dt = C.DT;
      this.t += dt; this.sinceFire += dt;
      this.impactBudget = 3;
      for (const b of this.world.bodies) if (b.userData && b.type !== CANNON.Body.STATIC) {
        const v = b.velocity; b.userData._pv = [v.x, v.y, v.z];
      }
      this.applyFloat();
      this.world.step(dt);
      this.processContacts();
      if (this.pending.length) {
        const due = this.pending.filter(p => p.t <= this.t);
        if (due.length) { this.pending = this.pending.filter(p => p.t > this.t); for (const p of due) p.fn(); }
      }
      let maxV = 0;
      for (const b of this.blocks) {
        const d = b.userData;
        if (!d.alive) continue;
        const p = b.position;
        if (!d.destroyed && (p.y < C.FALL_Y || Math.hypot(p.x, p.z) > C.ISLAND_R + 2.5)) {
          d.destroyed = true; if (d.kind !== 'stone') { this.fallen++; this.score += 5; }
          this.takeGem(b);
          if (d.kind === 'gold') { this.coins += 10; this.emit({ type: 'coin', x: p.x, y: p.y, z: p.z, n: 10 }); }
          this.emit({ type: 'fall', id: d.id, x: p.x, y: p.y, z: p.z });
        }
        if (p.y < C.SEA_Y) {
          d.alive = false; this.world.removeBody(b);
          this.emit({ type: 'splash', id: d.id, x: p.x, y: C.SEA_Y, z: p.z, s: Math.max(d.w, d.h, d.d) });
          continue;
        }
        if (!d.destroyed && b.sleepState !== CANNON.Body.SLEEPING) {
          const s = b.velocity.length() + b.angularVelocity.length() * 0.3;
          if (s > maxV) maxV = s;
        }
      }
      this.updateMovers(dt);
      for (const b of this.balls.slice()) {
        const d = b.userData, p = b.position;
        d.age += dt;
        if (p.y < C.SEA_Y) { this.killBall(b, false); this.emit({ type: 'splash', x: p.x, y: C.SEA_Y, z: p.z, s: 0.7 }); continue; }
        const sp = b.velocity.length();
        if (sp < 0.6) d.slow += dt; else d.slow = 0;
        if (d.slow > 0.4 || d.age > 6) { this.killBall(b, true); continue; }
      }
      this.maxV = maxV;
      if (this.state === 'play' && (this.stepN = (this.stepN || 0) + 1) % 12 === 0) this.sweepHidden(12 * dt);
      // objetivo cumplido: el nivel sigue y el jugador decide cuándo terminar
      if (this.state === 'play' && !this.goalReached && this.progress() >= this.target) {
        this.goalReached = true;
        this.emit({ type: 'goal' });
      }
      if (this.state === 'play' && this.goalReached && this.progress() >= 0.995 && this.pending.length === 0) this.finish();
      if (this.chamPending && this.balls.length === 0 && this.pending.length === 0 && this.sinceFire > 0.6 && maxV < 1.2) { this.chamPending = false; this.shiftChams(); }
      if (this.shotOpen && this.balls.length === 0 && this.pending.length === 0 && this.sinceFire > 0.5) {
        this.shotOpen = false;
        if (this.state === 'play' && !this.shotGolden) {
          if (this.shotPops >= 10) { this.queue.unshift('rainbow'); this.emit({ type: 'special', kind: 'rainbow', n: this.shotPops }); }
          else if (this.shotPops >= 6) { this.queue.unshift('bomb'); this.emit({ type: 'special', kind: 'bomb', n: this.shotPops }); }
        }
      }
      if (this.state === 'play' && this.queue.length === 0 && this.balls.length === 0 && this.pending.length === 0) {
        if (maxV < 0.35) this.idle += dt; else this.idle = 0;
        if (this.idle > 0.8 || this.sinceFire > 9) {
          if (this.goalReached) this.finish();
          else { this.state = 'lost'; this.emit({ type: 'lose', progress: this.progress() }); }
        }
      }
    }
    stars() {
      const p = this.progress();
      return p >= 0.995 ? 3 : p >= (this.target + 1) / 2 ? 2 : 1;
    }

    // ---------- pájaro y barco de premio ----------
    // Cruzan la escena de vez en cuando. Darles es difícil (se mueven y están lejos) y regala 2 bolas al azar.
    updateMovers(dt) {
      if (!this.movers) return;
      const t = this.t;
      if (this.state === 'play') {
        if (t >= this.nextBird && !this.movers.some(m => m.kind === 'bird' && m.active)) {
          const dir = this.rand() < 0.5 ? 1 : -1;
          // vuela justo por encima de la estructura, por detrás, para que se vea en el cielo
          let top = 3; for (const b of this.liveBlocks()) top = Math.max(top, b.position.y + 0.5);
          this.movers.push({ id: ++this.moverId, kind: 'bird', active: true, dir, x: -dir * 11, y0: top + 1.0 + this.rand() * 1.4, y: 0, z: -4 - this.rand() * 2,
            speed: 5.6 + this.rand() * 1.6, ph: this.rand() * 6, r: 0.7 });
          this.nextBird = t + 16 + this.rand() * 16;
          this.emit({ type: 'moverSpawn', kind: 'bird' });
        }
        if (t >= this.nextShip && !this.movers.some(m => m.kind === 'ship' && m.active) && this.level.biome && this.level.biome !== 'sea') {
          this.spawnCarrier(this.level.biome);
          this.nextShip = t + 22 + this.rand() * 16;
        } else if (t >= this.nextShip && !this.movers.some(m => m.kind === 'ship' && m.active)) {
          const dir = this.rand() < 0.5 ? 1 : -1;
          // un velero pequeño cruza el mar con 2 bolas a bordo: son las que ganas si lo tumbas (cambian en cada pasada)
          this.movers.push({ id: ++this.moverId, kind: 'ship', active: true, dir, x: -dir * C.SHIP_X, y0: C.SEA_Y + 0.1, y: 0, z: C.SHIP_Z - this.rand() * C.SHIP_ZR,
            speed: 3.8 + this.rand() * 1.0, ph: this.rand() * 6, balls: this.pickRewardBalls(2) });
          this.nextShip = t + 22 + this.rand() * 16;
          this.emit({ type: 'moverSpawn', kind: 'ship', balls: this.movers[this.movers.length - 1].balls });
        }
      }
      for (const m of this.movers) {
        if (!m.active) continue;
        m.x += m.dir * m.speed * dt;
        if (m.carrier) {
          const K = C.CARRIERS[m.carrier];
          m.y = m.y0 + (K.bob ? Math.sin(t * K.bobF + m.ph) * K.bob : 0) - (K.slope ? K.slope * m.dir * m.x : 0);
          if (Math.abs(m.x) > m.xr + 1) { m.active = false; m.gone = true; continue; }
        } else {
          m.y = m.kind === 'bird' ? m.y0 + Math.sin(t * 2.2 + m.ph) * 0.45 : m.y0 + Math.sin(t * 1.3 + m.ph) * 0.12;
          if (Math.abs(m.x) > (m.kind === 'bird' ? 12 : C.SHIP_X + 1)) { m.active = false; m.gone = true; continue; }
        }
        for (const b of this.balls) {
          const bd = b.userData; if (bd.dead) continue;
          const p = b.position, r = bd.r;
          let hit;
          if (m.kind === 'bird') hit = Math.hypot(p.x - m.x, p.y - m.y, p.z - m.z) < m.r + r;
          else if (m.carrier) hit = this.carrierHit(m, p, r);
          else {
            // solo cuenta el velero de verdad: casco, las 2 bolas y las velas triangulares (en coordenadas del barco)
            const S = C.SHIP_S, B = C.BOAT, lx = (p.x - m.x) * m.dir / S, ly = (p.y - m.y) / S, lz = Math.abs(p.z - m.z) / S, rr = r / S;
            const hull = lx > B.hull[0] - rr && lx < B.hull[1] + rr && ly > -0.1 - rr && ly < B.hull[2] + rr && lz < B.hull[3] + rr;
            const ball = B.ballX.some(bx => Math.hypot(lx - bx, ly - B.ballY, lz) < B.ballR + rr);
            const thin = lz < 0.12 + rr;
            const [mx, mb, mt] = B.main, [jx, jb, jt] = B.jib;
            const main = thin && lx < mx + rr && lx > mb - rr && ly > B.boomY - rr && ly < B.boomY + (mt - B.boomY) * Math.min(1, 1 - (mx - lx) / (mx - mb)) + rr;
            const jib = thin && lx > jx - rr && lx < jb + rr && ly > B.boomY - 0.1 - rr && ly < B.boomY + (jt - B.boomY) * Math.min(1, 1 - (lx - jx) / (jb - jx)) + rr;
            hit = hull || ball || main || jib;
          }
          if (!hit) continue;
          m.active = false; m.hitT = t;
          this.killBall(b, false);
          const won = m.balls ? this.giveBalls(m.balls) : this.rewardBalls(2);
          this.score += 200;
          this.emit({ type: 'moverHit', kind: m.kind, id: m.id, x: m.x, y: m.y, z: m.z, balls: won });
          break;
        }
      }
      this.movers = this.movers.filter(m => m.active || (m.hitT && t - m.hitT < 3));
    }
    // objeto que cruza el cielo (mundos sin mar): vuela por encima de la estructura, a la vista, con 2 bolas a bordo
    spawnCarrier(biome) {
      const K = C.CARRIERS[biome]; if (!K) return;
      const dir = this.rand() < 0.5 ? 1 : -1, z = K.z - this.rand() * K.zr;
      const cam = referenceCam(this.level), sil = this.silhouette();
      const topQ = cam.project({ x: 0, y: sil.top, z: sil.front }) || { y: 0 };
      const want = Math.min(0.62, Math.max(0.28, topQ.y + 0.24)) + this.rand() * 0.08;
      let lo = -5, hi = 60;                                   // altura que cae en esa franja de la pantalla
      for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2, q = cam.project({ x: 0, y: mid, z }); if (q && q.y < want) lo = mid; else hi = mid; }
      const xr = (cam.pos.z - z) * cam.tanH + 3.5;
      const m = { id: ++this.moverId, kind: 'ship', carrier: biome, active: true, dir, x: -dir * xr, xr, y0: lo, y: lo, z,
        speed: K.speed[0] + this.rand() * (K.speed[1] - K.speed[0]), ph: this.rand() * 6, balls: this.pickRewardBalls(2) };
      this.movers.push(m);
      this.emit({ type: 'moverSpawn', kind: 'ship', carrier: biome, balls: m.balls });
    }
    carrierHit(m, p, r) {
      const K = C.CARRIERS[m.carrier], S = K.s;
      const lx = (p.x - m.x) * m.dir / S, ly = (p.y - m.y) / S, lz = (p.z - m.z) / S, rr = r / S;
      for (const [x, y, z, R] of K.spheres) if (Math.hypot(lx - x, ly - y, lz - z) < R + rr) return true;
      for (const [x, y, z, hx, hy, hz] of K.boxes) if (Math.abs(lx - x) < hx + rr && Math.abs(ly - y) < hy + rr && Math.abs(lz - z) < hz + rr) return true;
      for (const [x, y, z] of K.balls) if (Math.hypot(lx - x, ly - y, lz - z) < K.ballR + rr) return true;
      return false;
    }
    rewardBalls(n) { return this.giveBalls(this.pickRewardBalls(n)); }
    pickRewardBalls(n) {
      const cols = [...new Set(this.liveBlocks().filter(b => b.userData.kind === 'block' && !b.userData.popping).map(b => b.userData.c))];
      if (!cols.length) cols.push('r', 'b', 'g', 'y');
      const out = [];
      for (let i = 0; i < n; i++) {
        const q = this.rand();
        out.push(q < 0.08 ? 'rainbow' : q < 0.16 ? 'bomb' : cols[Math.floor(this.rand() * cols.length)]);
      }
      return out;
    }
    giveBalls(list) {
      const out = list.slice();
      this.queue.splice(this.queue.length ? 1 : 0, 0, ...out);   // justo detrás de la bola que hay en el cañón
      this.sinceFire = Math.max(this.sinceFire, 0); this.idle = 0;
      return out;
    }

    // ---------- final del nivel ----------
    // el jugador pulsa Terminar, se queda sin bolas o lo derriba todo
    finish() {
      if (this.state !== 'play' || !this.goalReached) return false;
      this.state = 'won';
      // la bola dorada sin usar vuelve al inventario del jugador
      this.goldenLeft = this.queue.filter(k => k === 'golden').length;
      this.queue = this.queue.filter(k => k !== 'golden');
      this.leftover = this.queue.length;
      this.bonus = this.leftover * 300;
      this.score += this.bonus;
      this.queue = [];
      this.emit({ type: 'win', left: this.leftover, bonus: this.bonus });
      return true;
    }
    // vuelve a jugar un nivel ya terminado: devuelve las bolas sobrantes (sin su bonus) y suma n más
    resume(n) {
      if (this.state !== 'won') return false;
      this.score -= this.bonus;
      this.queue = [];
      this.addBalls(n + this.leftover);
      for (let i = 0; i < (this.goldenLeft || 0); i++) this.queue.unshift('golden');
      this.leftover = 0; this.bonus = 0; this.goldenLeft = 0;
      this.state = 'play'; this.idle = 0; this.sinceFire = 99;
      return true;
    }
  }

  const SimLib = { Sim, C, isColor, obbGap, rng, referenceCam };
  if (typeof module !== 'undefined' && module.exports) module.exports = SimLib;
  else root.SimLib = SimLib;
})(typeof globalThis !== 'undefined' ? globalThis : this);
