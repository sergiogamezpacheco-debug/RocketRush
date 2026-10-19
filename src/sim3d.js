// Rocket Rush — reglas y física (cannon-es). Sin dibujo: sirve al juego y al validador.
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
  // bloques que no cuentan para el porcentaje (no se pueden quitar del todo o no son estructura)
  const NOCOUNT = { stone: 1, mirror: 1, spring: 1, portal: 1, magnet: 1, fan: 1, cloud: 1 };
  // Bolas de los mundos (una por cada uno de los 10 primeros mundos). 'lv' = nivel de la bola (1-10): sube su poder.
  const WBALLS = {
    w1: { name: 'Bola demoledora', world: 1, r: 0.4 },     // atraviesa la estructura rompiendo todo lo que toca
    w2: { name: 'Bola de fuegos artificiales', world: 2, r: 0.34 }, // estalla en chispas que revientan bloques al azar
    w3: { name: 'Bola de escarcha', world: 3, r: 0.34 },   // onda helada: rompe todo el piso donde golpea
    w4: { name: 'Bola ancla', world: 4, r: 0.42 },         // parte la estructura de arriba abajo
    w5: { name: 'Bola prisma', world: 5, r: 0.34 },        // pinta lo de alrededor de un color y lo revienta junto
    w6: { name: 'Bola tornado', world: 6, r: 0.34 },       // remolino de arena que lo levanta todo y lo lanza fuera
    w7: { name: 'Bola de nieve gigante', world: 7, r: 0.62 }, // enorme: rueda arrasando lo que pilla
    w8: { name: 'Bola camaleón', world: 8, r: 0.34 },      // cada vez que toca un bloque, se vuelve de su color y revienta su grupo
    w9: { name: 'Bola meteoro', world: 9, r: 0.4 },        // funde las columnas de alrededor del impacto
    w10: { name: 'Bola agujero negro', world: 10, r: 0.36 }, // remolino que se traga lo que tiene cerca
  };
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
      this.wlv = opts.wlv || {};
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
      // clima de las vueltas: viento (tormenta, tormenta de arena), suelo resbaladizo (ventisca, lluvia), brasas y meteoritos
      this.weather = level.weather || null;
      this.wind = 0; this.windBase = 0;
      if (this.weather === 'storm') this.windBase = (level.id % 2 ? 1 : -1) * 3.2;
      if (this.weather === 'sandstorm') this.windBase = (level.id % 2 ? -1 : 1) * 4.2;
      this.wind = this.windBase;
      const slip = this.weather === 'blizzard' ? 0.5 : this.weather === 'rain' ? 0.72 : 1;
      if (slip < 1) { this.world.defaultContactMaterial.friction *= slip; for (const b of this.blocks) if (b.material) b.material.friction *= slip; }
      this.nextEmber = 4 + this.rand() * 3; this.nextMeteor = 6 + this.rand() * 4;

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
        else if (t === 'rocket') { data = { kind: 'rocket' }; density = 0.8; }
        else if (t === 'pinata') { data = { kind: 'pinata', hp: 2 }; density = 0.7; }
        else if (t === 'hourglass') { data = { kind: 'hourglass' }; density = 0.9; }
        else if (t === 'mirror') { data = { kind: 'mirror' }; density = 3.2; friction = 0.3; }
        else if (t === 'spring') { data = { kind: 'spring', cd: 0 }; density = 1.4; friction = 0.8; }
        else if (t === 'geyser') { data = { kind: 'geyser' }; density = 2.4; friction = 0.7; }
        else if (t === 'portal') { data = { kind: 'portal', a: !!d.pairA, b: !!d.pairB }; }
        else if (t === 'gift') { data = { kind: 'gift' }; density = 0.8; }
        else if (t === 'prism') { data = { kind: 'prism' }; density = 1.1; friction = 0.4; }
        else if (t === 'key') { data = { kind: 'key' }; density = 0.6; }
        else if (t === 'cloud') { data = { kind: 'cloud' }; }
        else if (t === 'balloon') { data = { kind: 'balloon' }; density = 0.25; friction = 0.6; }
        else if (t === 'magnet') { data = { kind: 'magnet' }; density = 3.2; friction = 0.8; }
        else if (t === 'snowball') { data = { kind: 'snowball', hits: 0 }; density = 1.4; friction = 0.3; }
        else if (t === 'gum') { data = { kind: 'gum' }; density = 1.0; friction = 0.9; }
        else if (t === 'fan') { data = { kind: 'fan', dir: d.dir || (d.x > 0 ? -1 : 1) }; density = 3.0; friction = 0.8; }
        else data = { kind: 'block', c: d.c, ice: t === 'i', stripe: t === 'st', bomb: t === 'bm', cham: t === 'cham', hp: t === 'i' ? 2 : 1, popping: false,
          locked: t === 'lock', totem: t === 'totem', bubble: !!d.bub, vine: t === 'vine' };
        if (d.bub) d.fl = true;            // burbuja: el bloque flota dentro hasta que la revientas
        if (d.fl) data.float = true;
        data.id = id++; data.w = d.w; data.h = d.h; data.d = d.d;
        const half = new CANNON.Vec3(d.w / 2 - 0.002, d.h / 2 - 0.002, d.d / 2 - 0.002);
        const fixed = t === 'portal' || t === 'cloud' || d.fixed;     // portales, nubes y espejos de pared: no se mueven
        const body = new CANNON.Body({ mass: fixed ? 0 : density * d.w * d.h * d.d, type: fixed ? CANNON.Body.STATIC : CANNON.Body.DYNAMIC, material: new CANNON.Material({ friction, restitution: 0.04 }) });
        if (t === 'portal' || t === 'cloud') body.collisionResponse = false;
        if (t === 'balloon') { body.linearDamping = 0.55; body.angularDamping = 0.6; }
        body.addShape(new CANNON.Box(half));
        body.position.set(d.x, d.y, d.z);
        if (d.ry) body.quaternion.setFromEuler(0, d.ry, 0);
        body.linearDamping = data.float ? 0.45 : 0.04; body.angularDamping = data.float ? 0.5 : 0.08;
        body.sleepSpeedLimit = 0.12; body.sleepTimeLimit = 0.6;
        body.half = half; body.userData = data;
        data.alive = true; data.destroyed = false;
        w.addBody(body); this.blocks.push(body);
      }
      this.total = this.blocks.filter(b => !NOCOUNT[b.userData.kind]).length;   // la piedra (y espejos, muelles y portales) no cuentan
      this.portals = this.blocks.filter(b => b.userData.kind === 'portal');
      this.clouds = this.blocks.filter(b => b.userData.kind === 'cloud');
      this.balloons = this.blocks.filter(b => b.userData.kind === 'balloon');
      this.snowballs = this.blocks.filter(b => b.userData.kind === 'snowball');
      this.locks = this.blocks.filter(b => b.userData.locked);
      // lianas: cuelgan de un punto fijo y se balancean
      this.vines = [];
      for (const b of this.blocks) {
        const d = b.userData, src = this.level.blocks[d.id]; if (!d.vine || !src) continue;
        const anchor = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC }); anchor.position.set(src.ax, src.ay, src.z); anchor.collisionResponse = false; w.addBody(anchor);
        const len = Math.hypot(src.ax - src.x, src.ay - src.y);
        const con = new CANNON.DistanceConstraint(anchor, b, len); w.addConstraint(con);
        d.vineC = con; d.anchor = [src.ax, src.ay, src.z]; d.vinePush = src.push || 5;
        b.linearDamping = 0.01; b.angularDamping = 0.3; this.vines.push(b);
      }
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
    canFire() { return this.state === 'play' && (this.stuck ? this.stuck.t > 0.25 : this.queue.length > 0 && this.sinceFire > 0.6); }
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
        pts.push({ x: L.m.x + L.vx * t + 0.5 * this.wind * t * t, y: L.m.y + L.vy * t + 0.5 * C.G * t * t, z: L.m.z + L.vz * t });
      }
      return pts;
    }
    fire(tx, ty, tz) {
      if (!this.canFire()) return false;
      if (this.stuck) return this.unstick(tx, ty, tz);
      const kind = this.queue.shift();
      this.spawnBall(kind, tx, ty, tz);
      this.armed = true; this.chain = 1; this.shotPops = 0; this.shotOpen = true; this.shotGolden = kind === 'golden' || !!WBALLS[kind];
      this.sinceFire = 0; this.idle = 0; this.shots++;
      if (this.chams && this.chams.length) this.chamPending = true;
      this.emit({ type: 'shoot', kind });
      return true;
    }
    spawnBall(kind, tx, ty, tz) {
      const L = this.launch(tx, ty, tz);
      const heavy = kind === 'heavy';
      const W = WBALLS[kind];
      const r = heavy ? 0.42 : kind === 'golden' ? 0.4 : W ? W.r : C.BALL_R;
      const dens = heavy || kind === 'w1' || kind === 'w4' || kind === 'w7' ? 12 : 3.4;
      const b = new CANNON.Body({ mass: dens * (4 / 3) * Math.PI * r * r * r, material: new CANNON.Material({ friction: 0.4, restitution: 0.3 }) });
      b.addShape(new CANNON.Sphere(r));
      b.position.set(L.m.x, L.m.y, L.m.z);
      b.velocity.set(L.vx, L.vy, L.vz);
      b.linearDamping = 0.01; b.angularDamping = 0.3;
      b.allowSleep = false;
      b.userData = { kind: 'ball', ball: kind, c: isColor(kind) ? kind : null, age: 0, slow: 0, dead: false, r, hits: 0, lv: W ? Math.max(1, Math.min(10, this.wlv[kind] || 1)) : 0 };
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
      if (da.kind === 'portal' || db.kind === 'portal') return;
      if (da.kind === 'ball') return this.ballHit(A, B, v, px, py, pz);
      if (db.kind === 'ball') return this.ballHit(B, A, v, px, py, pz);
      if (v > 2.4 && this.impactBudget > 0) { this.impactBudget--; this.emit({ type: 'impact', x: px, y: py, z: pz, v, stone: da.kind === 'stone' || db.kind === 'stone' }); }
      if (v > C.GLASS_V) { if (da.kind === 'glass') this.shatter(A); if (db.kind === 'glass') this.shatter(B); }
      if (v > C.SAND_V) { if (da.kind === 'sand') this.crumble(A); if (db.kind === 'sand') this.crumble(B); }
      if (v > C.PRIZE_V) { if (da.kind === 'prize') this.breakPrize(A); if (db.kind === 'prize') this.breakPrize(B); }
      if (v > C.TNT_V) { if (da.kind === 'tnt') this.ignite(A); if (db.kind === 'tnt') this.ignite(B); }
      if (this.armed && v > C.CASCADE_V && da.kind === 'block' && db.kind === 'block' && da.c === db.c && !da.popping && !db.popping && !da.destroyed && !db.destroyed && !da.locked && !db.locked && !da.bubble && !db.bubble) {
        this.chain++;
        this.emit({ type: 'cascade', x: px, y: py, z: pz, chain: this.chain, c: da.c });
        this.popGroup(A, true);
      }
    }
    ballHit(ball, other, v, px, py, pz) {
      const d = ball.userData, od = other.userData;
      if (d.dead) return;
      if (d.ball === 'golden') { this.goldenHit(ball, other); return; }
      if (WBALLS[d.ball]) { this.worldBallHit(ball, other, v, px, py, pz); return; }
      if (d.ball === 'bomb' && od.kind !== 'island' || d.ball === 'bomb' && v > 2) { this.explode(ball.position.x, ball.position.y, ball.position.z, C.BOMB_R, true); this.killBall(ball, false); return; }
      if (v > 1.5 && this.impactBudget > 0) { this.impactBudget--; this.emit({ type: 'thud', x: px, y: py, z: pz, v }); }
      if (this.special(other, d.ball, ball, v)) return;
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
    // rompe un bloque de cualquier tipo (las bolas de los mundos); la piedra solo la mueven las fuertes
    smash(o, delay, strong) {
      const od = o.userData;
      if (!od.alive || od.destroyed || od.popping) return false;
      if (od.kind === 'block' || od.kind === 'gold') { this.popSingle(o, delay); return true; }
      if (od.kind === 'glass') { this.later(delay, () => this.shatter(o)); return true; }
      if (od.kind === 'sand') { this.later(delay, () => this.crumble(o)); return true; }
      if (od.kind === 'prize') { this.later(delay, () => this.breakPrize(o)); return true; }
      if (od.kind === 'tnt') { this.later(delay, () => this.ignite(o)); return true; }
      if (od.kind === 'magma') { this.heat(o); return true; }
      if (this.trigger(o, delay)) return true;
      if (od.kind === 'stone' && strong) { this.later(delay, () => { if (!od.alive || od.destroyed) return; od.alive = false; od.destroyed = true; this.world.removeBody(o); this.emit({ type: 'glass', id: od.id, x: o.position.x, y: o.position.y, z: o.position.z, stone: true }); this.wakeAll(); }); return true; }
      return false;
    }
    worldBallHit(ball, other, v, px, py, pz) {
      const d = ball.userData, od = other.userData, lv = d.lv, k = d.ball, p = ball.position;
      if (od.kind === 'island' && k !== 'w7' && k !== 'w1') {   // si cae en el suelo sin tocar nada, hace su efecto ahí mismo
        if (d.hits) return;
      }
      this.chain = Math.max(this.chain, 2);
      const near = (R, f) => this.liveBlocks().filter(o => o.position.distanceTo(p) < R && (!f || f(o)));
      const emit = (extra) => this.emit(Object.assign({ type: 'wball', kind: k, x: p.x, y: p.y, z: p.z, lv }, extra || {}));
      if (k === 'w1') {            // demoledora: sigue su camino rompiendo hasta 4 + nivel bloques
        if (od.kind === 'island') return;
        if (this.smash(other, 0.01, true)) { d.hits++; emit({ hit: true }); }
        const pv = d._pv; if (pv && d.hits <= 3 + lv) ball.velocity.set(pv[0] * 0.92, pv[1] * 0.92, pv[2] * 0.92);
        return;
      }
      if (k === 'w7') {            // bola de nieve: rueda (es pesada) y rompe lo que toca, hasta 5 + nivel
        if (od.kind === 'island' || d.hits >= 5 + lv) return;
        if (this.smash(other, 0.02, false)) { d.hits++; emit({ hit: true }); }
        return;
      }
      if (k === 'w8') {            // camaleón: revienta el grupo de cada bloque de color que toca (hasta 2 + nivel/3 grupos)
        if (od.kind === 'block' && !od.popping && !od.destroyed) { d.c = od.c; this.popGroup(other, false); d.hits++; emit({ c: od.c, hit: true }); }
        else if (od.kind !== 'island') this.smash(other, 0.02, false);
        const pv = d._pv; if (pv && d.hits < 2 + Math.floor(lv / 3)) ball.velocity.set(-pv[0] * 0.5, Math.abs(pv[1]) * 0.6 + 3, -pv[2] * 0.5);
        if (d.hits >= 2 + Math.floor(lv / 3)) this.killBall(ball, true);
        return;
      }
      // el resto actúa una sola vez, en el primer golpe
      this.killBall(ball, false);
      if (k === 'w2') {            // fuegos artificiales: 5 + nivel bloques al azar a su alrededor
        const pool = near(3.6 + lv * 0.1).sort(() => this.rand() - 0.5).slice(0, 5 + lv);
        pool.forEach((o, i) => this.smash(o, 0.12 + i * 0.07, false));
        emit({ targets: pool.map(o => [o.position.x, o.position.y, o.position.z]) });
      } else if (k === 'w3') {     // escarcha: todo el piso a la altura del golpe, en un radio de 2,4 + nivel·0,12
        const R = 2.4 + lv * 0.12;
        near(R + 1, o => Math.abs(o.position.y - py) < 0.62 && Math.hypot(o.position.x - px, o.position.z - pz) < R).forEach(o => this.smash(o, 0.05 + Math.hypot(o.position.x - px, o.position.z - pz) * 0.08, false));
        emit({ r: R });
      } else if (k === 'w4') {     // ancla: una franja vertical de arriba abajo (toda la profundidad)
        const half = 0.62 + lv * 0.05;
        this.liveBlocks().filter(o => Math.abs(o.position.x - px) < half).forEach(o => this.smash(o, 0.04 + Math.max(0, py - o.position.y) * 0.03 + Math.max(0, o.position.y - py) * 0.03, true));
        emit({ half });
      } else if (k === 'w5') {     // prisma: pinta de un color todo lo que hay cerca y lo revienta en un solo grupo
        const R = 2.1 + lv * 0.12;
        const area = near(R, o => o.userData.kind === 'block' && !o.userData.popping);
        let c = od.kind === 'block' ? od.c : null;
        if (!c) { const cnt = {}; for (const o of area) cnt[o.userData.c] = (cnt[o.userData.c] || 0) + 1; c = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0]; }
        if (c) { for (const o of area) { o.userData.c = c; o.userData.ice = false; o.userData.hp = 1; this.emit({ type: 'cham', id: o.userData.id, c, x: o.position.x, y: o.position.y, z: o.position.z }); } const start = area.find(o => o === other) || area[0]; if (start) this.later(0.25, () => this.popGroup(start, false)); }
        emit({ r: R, c });
      } else if (k === 'w6') {     // tornado: levanta y lanza todo lo de alrededor; revienta 2 + nivel/2 bloques del centro
        const R = 3.0 + lv * 0.12;
        this.wakeAll();
        for (const o of near(R)) {
          const dx = o.position.x - px, dz = o.position.z - pz, dist = Math.hypot(dx, dz) || 1, f = 3.8 + lv * 0.3;
          o.velocity.x += dx / dist * f * 0.6 + -dz / dist * f * 0.8; o.velocity.z += dz / dist * f * 0.6 + dx / dist * f * 0.8; o.velocity.y += f * 0.9;
          o.angularVelocity.set(this.rand() * 6 - 3, this.rand() * 8, this.rand() * 6 - 3);
        }
        near(R).sort((a, b) => a.position.distanceTo(p) - b.position.distanceTo(p)).slice(0, 2 + Math.floor(lv / 2)).forEach((o, i) => this.smash(o, 0.2 + i * 0.1, false));
        emit({ r: R });
      } else if (k === 'w9') {     // meteoro: funde las columnas en un radio de 1,6 + nivel·0,1, de abajo arriba
        const R = 1.6 + lv * 0.1;
        this.liveBlocks().filter(o => Math.hypot(o.position.x - px, o.position.z - pz) < R).forEach(o => this.smash(o, 0.08 + Math.abs(o.position.y - py) * 0.05, true));
        emit({ r: R });
        this.explode(px, py, pz, 1.4, true);
      } else if (k === 'w10') {    // agujero negro: durante 1,8 s atrae lo cercano y se traga hasta 8 + nivel bloques
        this.vortex = { x: px, y: py, z: pz, t: 1.8, n: 8 + lv, R: 3.6 + lv * 0.1 };
        emit({ r: this.vortex.R });
      }
    }
    updateVortex(dt) {
      const V = this.vortex; if (!V) return;
      V.t -= dt;
      for (const o of this.liveBlocks()) {
        const od = o.userData; if (od.popping || od.kind === 'magnet' || od.kind === 'cloud' || od.kind === 'portal') continue;
        const dx = V.x - o.position.x, dy = V.y - o.position.y, dz = V.z - o.position.z, dist = Math.hypot(dx, dy, dz);
        if (dist > V.R) continue;
        if (dist < 0.95 && V.n > 0) { if (this.smash(o, 0.01, true)) { V.n--; this.emit({ type: 'swallow', x: o.position.x, y: o.position.y, z: o.position.z }); } continue; }
        o.wakeUp(); const f = 22 * dt * (1 - dist / V.R + 0.3);
        o.velocity.x += dx / dist * f; o.velocity.y += dy / dist * f + 0.15; o.velocity.z += dz / dist * f;
      }
      if (V.t <= 0 || V.n <= 0) { this.vortex = null; this.emit({ type: 'vortexEnd', x: V.x, y: V.y, z: V.z }); }
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
      if (sd.locked || sd.bubble) return;
      const cands = this.blocks.filter(b => { const d = b.userData; return d.alive && !d.destroyed && d.kind === 'block' && d.c === c && !d.popping && !d.locked && !d.bubble; });
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
      if (d.vineC) { this.world.removeConstraint(d.vineC); d.vineC = null; }
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
    // ---------- bloques nuevos ----------
    // golpe directo de una bola: devuelve true si el bloque se ha encargado del golpe
    special(o, kind, ball, v) {
      const od = o.userData;
      if (!od.alive || od.destroyed) return false;
      if (od.kind === 'mirror') {            // espejo: refleja la bola sobre la cara que ha tocado y no se rompe
        const pv = ball.userData._pv; if (!pv) return true;
        const q = o.quaternion, inv = q.conjugate(), rel = inv.vmult(ball.position.vsub(o.position));
        const ax = Math.abs(rel.x) / od.w, ay = Math.abs(rel.y) / od.h, az = Math.abs(rel.z) / od.d;
        const nl = ax >= ay && ax >= az ? new CANNON.Vec3(Math.sign(rel.x), 0, 0) : ay >= az ? new CANNON.Vec3(0, Math.sign(rel.y), 0) : new CANNON.Vec3(0, 0, Math.sign(rel.z));
        const n = q.vmult(nl), vin = new CANNON.Vec3(pv[0], pv[1], pv[2]), dn = vin.dot(n);
        if (dn < 0) { ball.velocity.set((pv[0] - 2 * dn * n.x) * 0.95, (pv[1] - 2 * dn * n.y) * 0.95, (pv[2] - 2 * dn * n.z) * 0.95); }
        this.emit({ type: 'mirror', id: od.id, x: ball.position.x, y: ball.position.y, z: ball.position.z });
        return true;
      }
      if (od.kind === 'spring') { this.spring(o); return true; }
      if (od.kind === 'block' && od.locked) { this.emit({ type: 'locked', id: od.id, x: o.position.x, y: o.position.y, z: o.position.z }); return true; }
      if (od.kind === 'block' && od.bubble) { this.unbubble(o); return true; }
      if (od.kind === 'block' && od.vine && ball.userData.c !== od.c) {     // liana: el golpe la lanza contra la estructura
        o.wakeUp(); o.velocity.x = (o.position.x > 0 ? -1 : 1) * 11; o.velocity.y += 2; this.chain = Math.max(this.chain, 2);
        this.emit({ type: 'vine', id: od.id, x: o.position.x, y: o.position.y, z: o.position.z }); return true;
      }
      if (od.kind === 'block' && od.totem) {     // tótem: con su color revienta; si no, gira y cambia de color
        const bc = ball.userData.c || (kind === 'rainbow' ? od.c : null);
        if (bc === od.c || kind === 'heavy' || kind === 'bomb') return false;
        const cols = this.levelColors, i = cols.indexOf(od.c); od.c = cols[(i + 1) % cols.length];
        this.emit({ type: 'cham', id: od.id, c: od.c, x: o.position.x, y: o.position.y, z: o.position.z }); this.emit({ type: 'totem', id: od.id, x: o.position.x, y: o.position.y, z: o.position.z });
        return true;
      }
      if (od.kind === 'magnet') { this.magnet(o); return true; }
      if (od.kind === 'fan') { this.fan(o); return true; }
      if (od.kind === 'gum') { this.stick(ball, o); return true; }
      if (od.kind === 'snowball') { this.rollSnow(o, ball); return true; }
      if (od.kind === 'prism') { this.prism(o, ball.userData.c); return true; }
      if (od.kind === 'gift' || od.kind === 'key' || od.kind === 'balloon') return this.trigger(o, 0.02);
      if (od.kind === 'pinata') {            // piñata: dos golpes
        if (v < 0.8 && kind !== 'heavy') return true;
        od.hp--; this.emit({ type: 'pinataHit', id: od.id, x: o.position.x, y: o.position.y, z: o.position.z, hp: od.hp });
        o.wakeUp(); o.angularVelocity.set(this.rand() * 4 - 2, this.rand() * 4 - 2, this.rand() * 4 - 2);
        if (od.hp <= 0) this.burstPinata(o);
        return true;
      }
      if (od.kind === 'rocket' || od.kind === 'hourglass' || od.kind === 'geyser') return this.trigger(o, 0.02);
      return false;
    }
    // explosiones, rayados, chorros y bolas de mundo también los activan
    trigger(o, delay) {
      const od = o.userData;
      if (!od.alive || od.destroyed) return false;
      if (od.kind === 'rocket') { if (!od.fired) { od.fired = true; this.later(delay || 0.02, () => this.launchRocket(o)); } return true; }
      if (od.kind === 'pinata') { if (!od.bursting) { od.bursting = true; this.later(delay || 0.02, () => this.burstPinata(o)); } return true; }
      if (od.kind === 'hourglass') { if (!od.broken) { od.broken = true; this.later(delay || 0.02, () => this.breakHourglass(o)); } return true; }
      if (od.kind === 'geyser') { if (!od.hot) { od.hot = true; this.emit({ type: 'geyserCharge', id: od.id, x: o.position.x, y: o.position.y, z: o.position.z }); this.later(0.7, () => this.erupt(o, 'geyser')); } return true; }
      if (od.kind === 'spring') { this.spring(o); return true; }
      if (od.kind === 'gift') { if (!od.opened) { od.opened = true; this.later(delay || 0.02, () => this.openGift(o)); } return true; }
      if (od.kind === 'key') { if (!od.used) { od.used = true; this.later(delay || 0.02, () => this.useKey(o)); } return true; }
      if (od.kind === 'balloon') { this.later(delay || 0.02, () => { if (od.alive && !od.destroyed) { this.removeSpecial(o, 20); this.emit({ type: 'balloonPop', id: od.id, x: o.position.x, y: o.position.y, z: o.position.z }); } }); return true; }
      if (od.kind === 'prism') { this.later(delay || 0.02, () => this.prism(o, null)); return true; }
      if (od.kind === 'gum') { if (!od.used) { od.used = true; this.later(delay || 0.02, () => { if (od.alive) this.removeSpecial(o, 10); }); } return true; }
      if (od.kind === 'cloud') { this.disperse(o); return true; }
      if (od.kind === 'block' && od.bubble) { this.unbubble(o); return true; }
      if (od.kind === 'magnet') { this.magnet(o); return true; }
      if (od.kind === 'fan') { this.fan(o); return true; }
      return false;
    }
    // caja sorpresa: un potenciador al azar
    openGift(o) {
      const d = o.userData; if (!d.alive || d.destroyed) return;
      this.removeSpecial(o, 40);
      const r = this.rand(), what = r < 0.35 ? 'bomb' : r < 0.65 ? 'rainbow' : 'plus2';
      if (this.state === 'play') { if (what === 'plus2') this.addBalls(2); else this.queue.unshift(what); }
      this.emit({ type: 'gift', id: d.id, x: o.position.x, y: o.position.y, z: o.position.z, what });
    }
    // cubo arcoíris: revienta todos los bloques del color de la bola (o del color que más hay)
    prism(o, c) {
      const d = o.userData; if (!d.alive || d.destroyed) return;
      if (!c) { const cnt = {}; for (const b of this.liveBlocks()) { const bd = b.userData; if (bd.kind === 'block' && !bd.locked) cnt[bd.c] = (cnt[bd.c] || 0) + 1; } c = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0]; }
      const x = o.position.x, y = o.position.y, z = o.position.z;
      this.removeSpecial(o, 60); this.chain = Math.max(this.chain, 2);
      this.emit({ type: 'prism', id: d.id, x, y, z, c });
      for (const b of this.liveBlocks()) { const bd = b.userData; if (bd.kind === 'block' && bd.c === c && !bd.popping && !bd.locked) this.popSingle(b, 0.08 + b.position.distanceTo(o.position) * 0.05); }
    }
    // llave: abre todos los candados
    useKey(o) {
      const d = o.userData; if (!d.alive || d.destroyed) return;
      this.removeSpecial(o, 40);
      const ids = [];
      for (const b of this.locks || []) { const bd = b.userData; if (bd.locked) { bd.locked = false; ids.push(bd.id); } }
      this.emit({ type: 'unlock', id: d.id, x: o.position.x, y: o.position.y, z: o.position.z, ids });
    }
    // burbuja: al reventarla, el bloque vuelve a pesar
    unbubble(b) {
      const d = b.userData; if (!d.bubble) return;
      d.bubble = false; d.float = false; b.wakeUp();
      this.emit({ type: 'bubblePop', id: d.id, x: b.position.x, y: b.position.y, z: b.position.z });
    }
    disperse(o) {
      const d = o.userData; if (!d.alive) return;
      d.alive = false; d.destroyed = true; this.world.removeBody(o);
      this.emit({ type: 'cloudGone', id: d.id, x: o.position.x, y: o.position.y, z: o.position.z });
    }
    // imán: durante un momento atrae todo lo que tiene cerca
    magnet(o) {
      const d = o.userData;
      if (this.t - (d.cd || -9) < 1.5) return; d.cd = this.t;
      this.vortex = { x: o.position.x, y: o.position.y + 0.5, z: o.position.z, t: 1.3, n: 5, R: 3.6 };
      this.wakeAll(); this.chain = Math.max(this.chain, 2);
      this.emit({ type: 'magnet', id: d.id, x: o.position.x, y: o.position.y, z: o.position.z, r: 3.6 });
    }
    // ventilador: sopla hacia la estructura
    fan(o) {
      const d = o.userData;
      if (this.t - (d.cd || -9) < 1.6) return; d.cd = this.t;
      this.gust = { x: o.position.x, y: o.position.y, dir: d.dir, t: 1.4 };
      this.wakeAll(); this.chain = Math.max(this.chain, 2);
      this.emit({ type: 'fan', id: d.id, x: o.position.x, y: o.position.y, z: o.position.z, dir: d.dir });
    }
    // bola de nieve: sale rodando hacia la estructura y arrasa lo que toca
    rollSnow(o, ball) {
      const d = o.userData; if (d.rolling) return;
      d.rolling = true; d.rollT = 0; o.wakeUp();
      const dir = Math.abs(o.position.x) > 0.5 ? -Math.sign(o.position.x) : (ball.velocity.x >= 0 ? 1 : -1);
      o.velocity.set(dir * 7, 1.5, -1); o.angularVelocity.set(0, 0, -dir * 8);
      this.chain = Math.max(this.chain, 2);
      this.emit({ type: 'snowball', id: d.id, x: o.position.x, y: o.position.y, z: o.position.z });
    }
    // chicle: la bola se queda pegada hasta el siguiente toque
    stick(ball, gum) {
      if (this.stuck) return;
      const bd = ball.userData;
      this.stuck = { ball, gum, t: 0, p: [ball.position.x, ball.position.y, ball.position.z] };
      ball.velocity.set(0, 0, 0); ball.angularVelocity.set(0, 0, 0); bd.slow = 0; bd.age = 0;
      this.emit({ type: 'gumStick', id: gum.userData.id, x: ball.position.x, y: ball.position.y, z: ball.position.z });
    }
    unstick(tx, ty, tz) {
      const S = this.stuck; this.stuck = null;
      const b = S.ball, p = b.position;
      const dx = tx - p.x, dy = ty - p.y, dz = tz - p.z, dist = Math.hypot(dx, dy, dz);
      const T = Math.max(0.5, Math.min(0.95, dist / 12));
      b.velocity.set(dx / T, dy / T - 0.5 * C.G * T, dz / T); b.userData.age = 0; b.userData.slow = 0; b.userData.hits = 0;
      const g = S.gum.userData; if (g.alive && !g.destroyed) this.removeSpecial(S.gum, 20);
      this.armed = true; this.sinceFire = 0;
      this.emit({ type: 'gumGo', x: p.x, y: p.y, z: p.z });
      return true;
    }
    removeSpecial(o, pts) {
      const d = o.userData;
      if (d.vineC) { this.world.removeConstraint(d.vineC); d.vineC = null; }
      d.alive = false; d.destroyed = true;
      this.world.removeBody(o);
      this.popped++; this.shotPops++; this.score += pts * this.chain;
      this.wakeAll();
    }
    // cohete: cruza su fila de punta a punta y revienta lo que encuentra
    launchRocket(o) {
      const d = o.userData;
      if (!d.alive || d.destroyed) return;
      const x = o.position.x, y = o.position.y, z = o.position.z;
      const row = this.liveBlocks().filter(b => b !== o && Math.abs(b.position.y - y) < 0.55);
      const left = row.filter(b => b.position.x < x).length, right = row.length - left;
      const dir = right >= left ? 1 : -1;
      this.removeSpecial(o, 50);
      this.chain = Math.max(this.chain, 2);
      this.emit({ type: 'rocket', id: d.id, x, y, z, dir, x1: dir * (C.ISLAND_R + 2) });
      for (const b of row) {
        const od = b.userData, dist = Math.max(0, (b.position.x - x) * dir);
        const delay = 0.05 + Math.abs(b.position.x - x) * 0.045;
        if ((od.kind === 'block' || od.kind === 'gold') && !od.popping) this.popSingle(b, delay);
        else if (od.kind === 'glass') this.later(delay, () => this.shatter(b));
        else if (od.kind === 'sand') this.later(delay, () => this.crumble(b));
        else if (od.kind === 'prize') this.later(delay, () => this.breakPrize(b));
        else if (od.kind === 'magma') this.heat(b);
        else if (od.kind === 'tnt') this.later(delay, () => this.ignite(b));
        else if (!this.trigger(b, delay) && dist >= 0) { b.wakeUp(); b.velocity.x += dir * 4; }
      }
    }
    burstPinata(o) {
      const d = o.userData;
      if (!d.alive || d.destroyed) return;
      this.removeSpecial(o, 60);
      this.coins += 15;
      this.emit({ type: 'pinata', id: d.id, x: o.position.x, y: o.position.y, z: o.position.z, n: 15 });
    }
    breakHourglass(o) {
      const d = o.userData;
      if (!d.alive || d.destroyed) return;
      this.removeSpecial(o, 30);
      if (this.state === 'play') this.addBalls(1);
      this.emit({ type: 'hourglass', id: d.id, x: o.position.x, y: o.position.y, z: o.position.z });
    }
    // muelle: lanza hacia arriba lo que tiene encima (se puede usar varias veces)
    spring(o) {
      const d = o.userData;
      if (this.t - (d.cd || -9) < 0.5) return;
      d.cd = this.t;
      const x = o.position.x, y = o.position.y, z = o.position.z;
      this.wakeAll();
      let n = 0;
      for (const b of this.liveBlocks()) {
        if (b === o) continue;
        const p = b.position;
        if (p.y < y + 0.3 || Math.abs(p.x - x) > 1.55 || Math.abs(p.z - z) > 1.2) continue;
        b.velocity.y += Math.max(5, 12.5 - (p.y - y) * 0.8); b.velocity.x += (this.rand() - 0.5) * 6; b.velocity.z += (this.rand() - 0.5) * 3;
        b.angularVelocity.set(this.rand() * 6 - 3, this.rand() * 4 - 2, this.rand() * 6 - 3); n++;
      }
      this.chain = Math.max(this.chain, 2);
      this.emit({ type: 'spring', id: d.id, x, y, z, n });
    }
    updateExtras(dt) {
      // bola pegada al chicle: se queda quieta (3,5 s como mucho)
      if (this.stuck) {
        const S = this.stuck, b = S.ball; S.t += dt;
        b.position.set(S.p[0], S.p[1], S.p[2]); b.velocity.set(0, 0, 0); b.userData.slow = 0; b.userData.age = 0;
        if (S.t > 3.5 || b.userData.dead) { this.stuck = null; const g = S.gum.userData; if (g.alive && !g.destroyed) this.removeSpecial(S.gum, 10); }
      }
      // las nubes se deshacen cuando las atraviesa una bola
      for (const c of this.clouds || []) {
        const d = c.userData; if (!d.alive) continue;
        for (const b of this.balls) { const p = b.position; if (Math.abs(p.x - c.position.x) < d.w / 2 + 0.3 && Math.abs(p.y - c.position.y) < d.h / 2 + 0.3 && Math.abs(p.z - c.position.z) < 0.6) { this.disperse(c); break; } }
      }
      // globos que se escapan hacia arriba cuentan como derribados
      for (const b of this.balloons || []) { const d = b.userData; if (d.alive && !d.destroyed && b.position.y > 12) { this.removeSpecial(b, 20); this.emit({ type: 'balloonAway', id: d.id, x: b.position.x, y: b.position.y, z: b.position.z }); } }
      // bola de nieve rodando: rompe lo que toca hasta 6 bloques
      for (const o of this.snowballs || []) {
        const d = o.userData; if (!d.rolling || !d.alive || d.destroyed) continue;
        d.rollT += dt;
        for (const b of this.liveBlocks()) {
          if (b === o || b.userData.popping) continue;
          const dd = b.position.distanceTo(o.position);
          if (dd < 1.15 && o.velocity.length() > 1.2) { if (this.smash(b, 0.02, false)) { d.hits++; this.emit({ type: 'snowHit', id: d.id, n: d.hits, x: b.position.x, y: b.position.y, z: b.position.z }); } }
        }
        if (d.hits >= 6 || (d.rollT > 1 && o.velocity.length() < 0.6) || d.rollT > 5) { this.removeSpecial(o, 30); this.emit({ type: 'snowEnd', id: d.id, x: o.position.x, y: o.position.y, z: o.position.z }); }
      }
      // ráfaga del ventilador
      if (this.gust) {
        const G = this.gust; G.t -= dt;
        for (const b of this.liveBlocks()) { const d = b.userData; if (NOCOUNT[d.kind] && d.kind !== 'spring') continue; const p = b.position; const ahead = (p.x - G.x) * G.dir;
          if (ahead > 0 && ahead < 10 && Math.abs(p.y - G.y) < 3) { b.wakeUp(); b.velocity.x += G.dir * 14 * dt * (1 - ahead / 12); } }
        if (G.t <= 0) this.gust = null;
      }
      // clima
      if (this.state !== 'play' && this.state !== 'won') return;
      if (this.weather === 'sandstorm') this.wind = this.windBase * (0.55 + 0.45 * Math.sin(this.t * 0.7));
      if (this.wind) for (const b of this.balls) if (!b.userData.dead && b !== (this.stuck && this.stuck.ball)) b.velocity.x += this.wind * dt;
      if (this.state !== 'play') return;
      if (this.weather === 'ash' && this.t > this.nextEmber) {      // brasa: cae sobre un bloque de arriba y lo rompe
        this.nextEmber = this.t + 6 + this.rand() * 4;
        const live = this.liveBlocks().filter(b => b.userData.kind === 'block' && !b.userData.locked && !b.userData.popping);
        if (live.length) { const top = Math.max(...live.map(b => b.position.y)); const pool = live.filter(b => b.position.y > top - 1.2); const b = pool[Math.floor(this.rand() * pool.length)];
          this.emit({ type: 'ember', x: b.position.x, y: b.position.y, z: b.position.z }); this.later(0.6, () => this.popSingle(b, 0.01)); }
      }
      if (this.weather === 'meteors' && this.t > this.nextMeteor) {  // meteorito: golpea la estructura y ayuda
        this.nextMeteor = this.t + 8 + this.rand() * 5;
        const live = this.liveBlocks().filter(b => !NOCOUNT[b.userData.kind]);
        if (live.length) { const b = live[Math.floor(this.rand() * live.length)], x = b.position.x, y = b.position.y, z = b.position.z;
          this.emit({ type: 'meteor', x, y, z }); this.later(0.8, () => this.explode(x, y, z, 1.3, false)); }
      }
    }
    // portal: la bola que entra por el primero sale por el segundo, hacia abajo
    updatePortals(dt) {
      const A = this.portals.find(p => p.userData.a), B = this.portals.find(p => p.userData.b);
      if (!A || !B) return;
      for (const ball of this.balls) {
        const bd = ball.userData;
        bd.pcd = (bd.pcd || 0) - dt;
        if (bd.pcd > 0 || bd.dead) continue;
        if (ball.position.distanceTo(A.position) > 0.85) continue;
        const sp = Math.max(7, ball.velocity.length() * 0.8);
        this.emit({ type: 'portal', x: A.position.x, y: A.position.y, z: A.position.z, x2: B.position.x, y2: B.position.y, z2: B.position.z });
        ball.position.set(B.position.x, B.position.y - 0.9, B.position.z);
        ball.velocity.set(-B.position.x * 0.2, -sp, -0.3);
        bd.pcd = 0.8; bd.age = 0;
      }
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
        else this.trigger(o, Math.abs(o.position.x - x) * 0.03);
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
      for (const b of this.floating) { const d = b.userData; if (d.alive && !d.destroyed && d.float && b.sleepState !== CANNON.Body.SLEEPING) b.force.y -= C.G * b.mass; }
      for (const b of this.balloons || []) { const d = b.userData; if (d.alive && !d.destroyed) { b.force.y -= C.G * b.mass * 2.4; if (b.sleepState === CANNON.Body.SLEEPING && this.t > 0.3) b.wakeUp(); } }
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
    erupt(b, type) {
      const d = b.userData;
      if (!d.alive || d.destroyed) return;
      const x = b.position.x, y = b.position.y, z = b.position.z;
      d.alive = false; d.destroyed = true; this.popped++; this.score += 40;
      this.world.removeBody(b);
      this.emit({ type: type || 'erupt', id: d.id, x, y, z });
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
        else if (!this.trigger(o, delay)) { o.velocity.y += 7; }
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
        if (dist < R && this.trigger(b, 0.05 + dist * 0.03)) continue;
        if (d.bubble && dist < R) this.unbubble(b);
        const f = 11 * Math.max(0.2, 1 - dist / (R + 0.8));
        const nx = dist > 1e-6 ? dx / dist : 0, ny = dist > 1e-6 ? dy / dist : 1, nz = dist > 1e-6 ? dz / dist : 0;
        b.velocity.x += nx * f; b.velocity.y += ny * f + 2.5; b.velocity.z += nz * f;
        b.angularVelocity.x += (nz * 3 - ny); b.angularVelocity.z += (-nx * 3 + ny);
      }
    }
    popSingle(b, delay) {
      const d = b.userData;
      if (d.popping || d.destroyed || d.locked) return;
      if (d.bubble) { this.unbubble(b); return; }
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
      if (this.vortex) this.updateVortex(dt);
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
          d.destroyed = true; if (!NOCOUNT[d.kind]) { this.fallen++; this.score += 5; }
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
      if (this.portals && this.portals.length >= 2) this.updatePortals(dt);
      this.updateExtras(dt);
      for (const b of this.balls.slice()) {
        const d = b.userData, p = b.position;
        d.age += dt;
        if (p.y < C.SEA_Y) { this.killBall(b, false); this.emit({ type: 'splash', x: p.x, y: C.SEA_Y, z: p.z, s: 0.7 }); continue; }
        const sp = b.velocity.length();
        if (sp < 0.6) d.slow += dt; else d.slow = 0;
        if (this.stuck && this.stuck.ball === b) continue;
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
      if (!C.CARRIERS[biome]) biome = { candy: 'desert', crystal: 'snow', temple: 'jungle', forest: 'jungle', fair: 'desert', neon: 'space' }[biome];
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
      this.wLeft = this.queue.filter(k => WBALLS[k]);                 // las bolas de los mundos sin usar también vuelven
      this.queue = this.queue.filter(k => k !== 'golden' && !WBALLS[k]);
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
      for (const k of this.wLeft || []) this.queue.unshift(k);
      this.wLeft = [];
      this.leftover = 0; this.bonus = 0; this.goldenLeft = 0;
      this.state = 'play'; this.idle = 0; this.sinceFire = 99;
      return true;
    }
  }

  const SimLib = { Sim, C, isColor, obbGap, rng, referenceCam, WBALLS };
  if (typeof module !== 'undefined' && module.exports) module.exports = SimLib;
  else root.SimLib = SimLib;
})(typeof globalThis !== 'undefined' ? globalThis : this);
