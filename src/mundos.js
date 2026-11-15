// Rocket Rush — 4 paisajes nuevos (desde el mundo 52, intercalados con los demás):
// · Huerto frutal: bloques de fruta (sandía, tomate, piña, arándano y uva), árboles frutales, granero y pétalos; abeja con cesta.
// · Arrecife: bloques de escamas, corales, algas, peces, burbujas y rayos de luz bajo el agua; submarino.
// · Juguetería: cubos de madera con letras (sin caras), ceras gigantes, pelotas y cuarto de juegos; avión de juguete.
// · Era de los dinosaurios: bloques de ámbar con fósiles (sin caras), helechos, volcán y dinosaurios; pterodáctilo.
// Cada mundo conserva el contenido y la dificultad que tenía (ver levels3d.js); aquí solo está lo que se ve.
// Usa las piezas del motor que expone game3d.js en RRGame.hw.
(function () {
  'use strict';
  const X = window.RRGame;
  if (!X || !X.hw) return;
  const H = X.hw, T = H.THREE, C = H.C, TAU = Math.PI * 2, rnd = H.rnd;
  const std = (color, o) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.7 }, o || {}));
  const mesh = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); return m; };
  const tex = (draw, w, h) => H.canvasTex(w || 256, h || 256, draw);
  const seeded = s => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;

  // ---------------- texturas de los bloques ----------------
  const R = seeded(7);
  const rr = (a, b) => a + R() * (b - a);
  const FRUIT = {
    g: g => { g.fillStyle = '#1f6b2a'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#7bd14a';                      // sandía
      for (let x = -20; x < 280; x += 46) { g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= 256; y += 16) g.lineTo(x + Math.sin(y / 22 + x) * 7, y); for (let y = 256; y >= 0; y -= 16) g.lineTo(x + 16 + Math.sin(y / 18 + x) * 6, y); g.fill(); } },
    r: g => { const gr = g.createRadialGradient(90, 80, 10, 128, 128, 190); gr.addColorStop(0, '#ff7a5a'); gr.addColorStop(0.5, '#e8281e'); gr.addColorStop(1, '#a8100c'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);   // tomate
      g.strokeStyle = 'rgba(120,0,0,.25)'; g.lineWidth = 5; for (const x of [70, 128, 186]) { g.beginPath(); g.moveTo(x, 30); g.quadraticCurveTo(x + (x - 128) * 0.3, 128, x, 240); g.stroke(); }
      g.fillStyle = '#2f9a2a'; g.translate(128, 14); for (let i = 0; i < 5; i++) { g.rotate(TAU / 5); g.beginPath(); g.ellipse(0, 16, 7, 18, 0, 0, TAU); g.fill(); } g.setTransform(1, 0, 0, 1, 0, 0); },
    y: g => { g.fillStyle = '#f2b81e'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#a8700a'; g.lineWidth = 6;                // piña
      for (let i = -256; i < 512; i += 42) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 256, 256); g.stroke(); g.beginPath(); g.moveTo(i, 256); g.lineTo(i + 256, 0); g.stroke(); }
      g.fillStyle = '#7a4a05'; for (let x = 0; x < 7; x++) for (let y = 0; y < 13; y++) { g.beginPath(); g.arc(x * 42 + (y % 2) * 21, y * 21, 4, 0, TAU); g.fill(); } },
    b: g => { const gr = g.createRadialGradient(100, 90, 10, 128, 128, 190); gr.addColorStop(0, '#8fb4ff'); gr.addColorStop(0.6, '#3a5fd0'); gr.addColorStop(1, '#22348a'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);   // arándano
      g.fillStyle = 'rgba(220,235,255,.25)'; for (let i = 0; i < 60; i++) { g.beginPath(); g.arc(rr(0, 256), rr(0, 256), rr(4, 14), 0, TAU); g.fill(); }
      g.fillStyle = '#1a1f55'; g.translate(128, 128); for (let i = 0; i < 5; i++) { g.rotate(TAU / 5); g.beginPath(); g.moveTo(-8, 0); g.lineTo(0, 26); g.lineTo(8, 0); g.fill(); } g.setTransform(1, 0, 0, 1, 0, 0); },
    p: g => { g.fillStyle = '#4a1460'; g.fillRect(0, 0, 256, 256);                                                              // uva
      for (let y = 0; y < 6; y++) for (let x = 0; x < 7; x++) { const cx = x * 46 + (y % 2) * 23, cy = y * 44 + 20, gr = g.createRadialGradient(cx - 8, cy - 9, 2, cx, cy, 26); gr.addColorStop(0, '#e2a6ff'); gr.addColorStop(0.45, '#9a3cc8'); gr.addColorStop(1, '#4a1460'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 24, 0, TAU); g.fill(); } },
  };
  const scales = (base, dark, light) => g => { g.fillStyle = dark; g.fillRect(0, 0, 256, 256);
    for (let y = -1; y < 9; y++) for (let x = -1; x < 7; x++) { const cx = x * 44 + (y % 2) * 22, cy = y * 32; const gr = g.createLinearGradient(cx, cy, cx, cy + 30); gr.addColorStop(0, light); gr.addColorStop(1, base); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 25, 0, Math.PI); g.fill(); g.strokeStyle = dark; g.lineWidth = 3; g.stroke(); } };
  const SCALES = { g: scales('#2fd08a', '#0a5a40', '#a8ffd8'), r: scales('#ff5a4a', '#8a1010', '#ffc0a8'), y: scales('#ffd23f', '#a07000', '#fff6b0'), b: scales('#3d9bff', '#0a3a8a', '#b8e4ff'), p: scales('#b04ae0', '#4a106a', '#efc0ff') };
  const abc = (col, L) => g => { g.fillStyle = col; g.fillRect(0, 0, 256, 256); const gr = g.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0, '#f7dcae'); gr.addColorStop(1, '#e2b77a'); g.fillStyle = gr; g.fillRect(30, 30, 196, 196);
    g.strokeStyle = 'rgba(150,100,40,.25)'; g.lineWidth = 2; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(30, 40 + i * 22); g.bezierCurveTo(100, 30 + i * 22, 160, 52 + i * 22, 226, 40 + i * 22); g.stroke(); }
    g.fillStyle = col; g.font = '900 150px Arial Black, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(L, 128, 138); };
  const ABC = { r: abc('#e8372c', 'A'), b: abc('#2a6ee0', 'B'), g: abc('#2aa848', 'C'), y: abc('#f2b01e', 'D'), p: abc('#9a3cc8', 'E') };
  const amber = (c1, c2, kind) => g => { const gr = g.createRadialGradient(110, 100, 10, 128, 128, 200); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(rr(0, 256), rr(0, 256), rr(2, 7), 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(40,20,0,.55)'; g.fillStyle = 'rgba(40,20,0,.45)'; g.lineWidth = 5; g.translate(128, 128); g.rotate(rr(-0.6, 0.6));
    if (kind === 'amon') { g.beginPath(); for (let a = 0; a < 18; a += 0.1) { const r = 4 + a * 3.6; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.stroke(); for (let a = 1; a < 18; a += 0.6) { const r = 4 + a * 3.6; g.beginPath(); g.moveTo(Math.cos(a) * r, Math.sin(a) * r); g.lineTo(Math.cos(a) * (r + 10), Math.sin(a) * (r + 10)); g.stroke(); } }
    else if (kind === 'hoja') { g.beginPath(); g.ellipse(0, 0, 30, 70, 0, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(0, -70); g.lineTo(0, 80); g.stroke(); for (let y = -50; y < 60; y += 18) { g.beginPath(); g.moveTo(0, y); g.lineTo(26, y - 14); g.moveTo(0, y); g.lineTo(-26, y - 14); g.stroke(); } }
    else if (kind === 'bicho') { g.beginPath(); g.ellipse(0, 10, 14, 30, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(0, -28, 11, 0, TAU); g.fill(); g.lineWidth = 3; for (const s of [-1, 1]) { for (const y of [-5, 8, 22]) { g.beginPath(); g.moveTo(0, y); g.lineTo(s * 34, y + 12); g.stroke(); } g.globalAlpha = 0.35; g.beginPath(); g.ellipse(s * 30, -6, 30, 11, s * 0.5, 0, TAU); g.fill(); g.globalAlpha = 1; } }
    else { g.lineWidth = 6; g.beginPath(); g.moveTo(-60, 40); g.lineTo(60, -30); g.stroke(); for (let i = -40; i < 60; i += 16) { const o = (i + 40) * 0.58; g.beginPath(); g.moveTo(i, 28 - o); g.lineTo(i + 8, 50 - o); g.stroke(); g.beginPath(); g.moveTo(i, 28 - o); g.lineTo(i - 10, 8 - o); g.stroke(); } g.beginPath(); g.arc(-66, 44, 12, 0, TAU); g.fill(); }
    g.setTransform(1, 0, 0, 1, 0, 0); };
  const AMBER = { y: amber('#ffe27a', '#d88a0a', 'amon'), r: amber('#ff8a5a', '#a8200a', 'bicho'), g: amber('#c8f07a', '#4a8a10', 'hoja'), b: amber('#a8d8ff', '#2a5aa8', 'amon'), p: amber('#e8a8ff', '#6a1a8a', 'pez') };

  // materiales de los bloques de cada paisaje (se crean al cargar: así se compilan durante el logo con los demás)
  const SKIN_DEF = { orchard: { t: FRUIT }, reef: { t: SCALES }, toys: { t: ABC, noFace: true, rough: 0.55, coat: 0.2 }, dino: { t: AMBER, noFace: true, rough: 0.15, coat: 1 } };
  const SKINS = {};
  for (const k in SKIN_DEF) {
    const d = SKIN_DEF[k], mat = {};
    for (const c of 'rbgyp') mat[c] = new T.MeshPhysicalMaterial({ map: tex(d.t[c]), color: 0xffffff, roughness: d.rough != null ? d.rough : 0.38, metalness: 0, clearcoat: d.coat != null ? d.coat : 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.45 });
    SKINS[k] = { mat, noFace: !!d.noFace };
  }

  // ---------------- piezas comunes ----------------
  // muchas copias de una pieza en un solo dibujo (con color por copia si se da)
  function inst(geo, mat, list, place) {
    const im = new T.InstancedMesh(geo, mat, list.length), m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), p = new T.Vector3(), s = new T.Vector3(), col = new T.Color();
    list.forEach((o, i) => { place(o, p, e, s); q.setFromEuler(e); m4.compose(p, q, s); im.setMatrixAt(i, m4); if (o.c != null) im.setColorAt(i, col.set(o.c)); });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    return im;
  }
  const spots = (n, r0, r1, skipFront) => { const out = []; H.around(n, r0, r1, (x, z, i) => out.push({ x, z, i }), skipFront); return out; };

  // ---------------- Huerto frutal ----------------
  function buildOrchard() {
    const env = new T.Group();
    env.add(H.ground(0x6cbf4a, 1, (x, z) => { const d = Math.hypot(x, z), k = Math.min(1, Math.max(0, (d - 9) / 20)); return k * (1.6 * Math.sin(x * 0.06) * Math.cos(z * 0.07)); }, { roughness: 0.95 }));
    // surcos de cultivo y sandías en el suelo
    const melons = spots(40, 16, 60, true);
    env.add(inst(new T.SphereGeometry(1, 16, 12), new T.MeshStandardMaterial({ map: tex(FRUIT.g), roughness: 0.5 }), melons, (o, p, e, s) => { p.set(o.x, C.SEA_Y + 0.55, o.z); e.set(0, rnd(0, TAU), 0); s.set(1.3, 0.75, 0.9); }));
    // árboles frutales: tronco, copa y frutas (un dibujo por tipo de pieza)
    const trees = spots(30, 22, 95, true);
    env.add(inst(new T.CylinderGeometry(0.5, 0.75, 4, 8), std(0x7a4a24, { roughness: 0.9 }), trees, (o, p, e, s) => { p.set(o.x, C.SEA_Y + 2, o.z); e.set(0, 0, 0); s.set(1, 1, 1); }));
    env.add(inst(new T.IcosahedronGeometry(3.4, 1), std(0x3f9a3a, { flatShading: true, roughness: 0.85 }), trees, (o, p, e, s) => { p.set(o.x, C.SEA_Y + 6, o.z); e.set(rnd(0, 1), rnd(0, 3), 0); s.set(1, 0.9, 1); }));
    const fruits = []; const FC = [0xe8281e, 0xff9a1e, 0xffd23f, 0xe8281e];
    trees.forEach((t, k) => { for (let i = 0; i < 7; i++) { const a = rnd(0, TAU), b = rnd(-0.2, 1.1); fruits.push({ x: t.x + Math.cos(a) * Math.cos(b) * 3.3, y: C.SEA_Y + 6 + Math.sin(b) * 3, z: t.z + Math.sin(a) * Math.cos(b) * 3.3, c: FC[k % 4] }); } });
    env.add(inst(new T.SphereGeometry(0.45, 10, 8), std(0xffffff, { roughness: 0.35 }), fruits, (o, p, e, s) => { p.set(o.x, o.y, o.z); e.set(0, 0, 0); s.set(1, 1, 1); }));
    // granero rojo y molino
    const barn = new T.Group();
    barn.add(mesh(new T.BoxGeometry(14, 9, 10), std(0xc8302a), 0, 4.5, 0));
    const roof = mesh(new T.CylinderGeometry(7.6, 7.6, 10.4, 3), std(0x6a3a2a), 0, 10.4, 0); roof.rotation.z = Math.PI / 2; roof.rotation.y = Math.PI / 2; roof.scale.set(1, 1, 0.6); barn.add(roof);
    barn.add(mesh(new T.BoxGeometry(5, 6, 0.3), std(0xf4ead8), 0, 3, 5.05)); barn.add(mesh(new T.BoxGeometry(4.2, 5.2, 0.4), std(0xa8261e), 0, 2.8, 5.1));
    barn.position.set(-38, C.SEA_Y, -70); barn.rotation.y = 0.4; env.add(barn);
    const mill = new T.Group(); mill.add(mesh(new T.CylinderGeometry(1.6, 2.6, 16, 10), std(0xf4ead8), 0, 8, 0)); mill.add(mesh(new T.ConeGeometry(2.4, 3, 10), std(0xc8302a), 0, 17.5, 0));
    const blades = new T.Group(); for (let i = 0; i < 4; i++) { const b = mesh(new T.BoxGeometry(0.6, 7, 0.15), std(0xffffff), 0, 3.5, 0); const piv = new T.Group(); piv.rotation.z = i * TAU / 4; piv.add(b); blades.add(piv); }
    blades.position.set(0, 14, 2); mill.add(blades); mill.position.set(42, C.SEA_Y, -80); env.add(mill);
    // valla de madera
    const fence = []; for (let i = -18; i <= 18; i++) fence.push({ x: i * 2.2, z: -34 + Math.sin(i * 0.3) * 1.5 });
    env.add(inst(new T.BoxGeometry(0.3, 1.8, 0.3), std(0xe8d0a8), fence, (o, p, e, s) => { p.set(o.x, C.SEA_Y + 1, o.z); e.set(0, 0, 0); s.set(1, 1, 1); }));
    const rail = mesh(new T.BoxGeometry(80, 0.25, 0.2), std(0xe8d0a8), 0, C.SEA_Y + 1.4, -34); env.add(rail);
    // pétalos que caen
    const pet = H.points(320, 0, 0xffc4e4, 0.32, () => [rnd(-30, 30), rnd(-4, 16), rnd(-40, 12)]); pet.material.sizeAttenuation = true; env.add(pet);
    H.gpuMotion(pet, { vy: -0.7, vyStep: 0.15, vyMod: 4, ymin: -4, yr: 20, swx: 0.8, swxF: 1.2 });
    H.scene.add(env); env.visible = false;
    const grass = H.tiles('#6cbf4a', 'rgba(40,90,30,0.45)', 6, (g, x, y, s) => { if (Math.random() < 0.35) { g.fillStyle = ['#ffffff', '#ffd23f', '#ff7ab8'][(Math.random() * 3) | 0]; g.beginPath(); g.arc(x + rnd(6, s - 6), y + rnd(6, s - 6), 4, 0, TAU); g.fill(); } });
    const under = new T.Group();
    const crate = mesh(new T.CylinderGeometry(C.ISLAND_R * 0.97, C.ISLAND_R * 0.62, 5, 24), new T.MeshStandardMaterial({ map: H.tiles('#b07a44', 'rgba(80,45,15,0.7)', 3), roughness: 0.9 }), 0, -2.8, 0); under.add(crate);
    const stemM = std(0x3f9a3a), petM = std(0xffd23f, { roughness: 0.5 }), seedM = std(0x6a3a1a);
    const platform = H.makePlatform({ top: new T.MeshStandardMaterial({ map: grass, roughness: 0.95 }), side: std(0x8a5a2a, { roughness: 0.9 }), trim: std(0xffd23f, { roughness: 0.5 }), under,
      flags: [0xe8281e, 0xffd23f, 0x5fd45a, 0xff9a1e], line: 0x6a4a2a,
      post: () => { const p = new T.Group(); p.add(mesh(new T.CylinderGeometry(0.07, 0.09, 2.9, 6), stemM, 0, 1.45, 0)); const f = mesh(new T.CylinderGeometry(0.48, 0.48, 0.1, 14), petM, 0, 3.05, 0.05); f.rotation.x = 1.2; p.add(f); const c = mesh(new T.CylinderGeometry(0.24, 0.24, 0.14, 12), seedM, 0, 3.07, 0.1); c.rotation.x = 1.2; p.add(c); return p; } });
    return { env: [env], platform, update: () => { blades.rotation.z += 0.012; }, splash: H.splashCol(0xd8f0c8, 0x6cbf4a) };
  }

  // ---------------- Arrecife (bajo el agua) ----------------
  function buildReef() {
    const env = new T.Group();
    env.add(H.ground(0xd8c08a, 1, (x, z) => { const d = Math.hypot(x, z), k = Math.min(1, Math.max(0, (d - 9) / 16)); return k * (1.8 * Math.sin(x * 0.09 + z * 0.03) * Math.cos(z * 0.08)); }, { roughness: 1 }));
    const CC = [0xff5a8a, 0xff8a3a, 0xffd23f, 0xb04ae0, 0x3dc8ff, 0xff4f6d];
    const corals = spots(70, 13, 70, true).map(o => Object.assign(o, { c: CC[o.i % CC.length], s: rnd(0.7, 2.2) }));
    env.add(inst(new T.ConeGeometry(0.9, 3.2, 7), std(0xffffff, { roughness: 0.6, flatShading: true }), corals.filter(o => o.i % 3 === 0), (o, p, e, s) => { p.set(o.x, C.SEA_Y + 1.4 * o.s, o.z); e.set(rnd(-0.2, 0.2), 0, rnd(-0.2, 0.2)); s.set(o.s, o.s, o.s); }));
    env.add(inst(new T.SphereGeometry(1.2, 14, 10), std(0xffffff, { roughness: 0.8 }), corals.filter(o => o.i % 3 === 1), (o, p, e, s) => { p.set(o.x, C.SEA_Y + 0.5 * o.s, o.z); e.set(0, 0, 0); s.set(o.s, o.s * 0.75, o.s); }));
    const branches = []; corals.filter(o => o.i % 3 === 2).forEach(o => { for (let k = 0; k < 5; k++) branches.push({ x: o.x, z: o.z, c: o.c, s: o.s, a: k * TAU / 5 + rnd(-0.3, 0.3), t: rnd(0.3, 0.7) }); });
    env.add(inst(new T.CylinderGeometry(0.16, 0.24, 2.6, 6), std(0xffffff, { roughness: 0.6 }), branches, (o, p, e, s) => { p.set(o.x + Math.cos(o.a) * 0.5 * o.s, C.SEA_Y + 1.1 * o.s, o.z + Math.sin(o.a) * 0.5 * o.s); e.set(Math.sin(o.a) * o.t, 0, -Math.cos(o.a) * o.t); s.set(o.s, o.s, o.s); }));
    // algas altas
    const kelp = []; spots(30, 15, 80, true).forEach(o => { const h = rnd(4, 9); for (let k = 0; k < 6; k++) kelp.push({ x: o.x + Math.sin(k * 0.9) * 0.4, z: o.z, y: k * h / 6, h: h / 6, r: Math.cos(k * 0.9) * 0.25 }); });
    env.add(inst(new T.BoxGeometry(0.5, 1, 0.12), std(0x2fa060, { roughness: 0.8 }), kelp, (o, p, e, s) => { p.set(o.x, C.SEA_Y + o.y + o.h / 2, o.z); e.set(0, 0, o.r); s.set(1, o.h * 1.05, 1); }));
    // rocas
    env.add(inst(new T.DodecahedronGeometry(2, 0), std(0x6a7a8a, { flatShading: true, roughness: 0.95 }), spots(18, 20, 90, true), (o, p, e, s) => { const k = rnd(1, 3); p.set(o.x, C.SEA_Y + 0.6 * k, o.z); e.set(rnd(0, 3), rnd(0, 3), 0); s.set(k, k * 0.7, k); }));
    // bancos de peces (se mueven en círculo)
    const fishGeo = new T.SphereGeometry(0.4, 10, 8); fishGeo.scale(1.6, 0.9, 0.5);
    const FCOL = [0xff8a3a, 0xffd23f, 0x3dc8ff, 0xff5a8a, 0xffffff];
    const fishList = []; for (let s = 0; s < 5; s++) { const cx = rnd(-30, 30), cz = rnd(-60, -25), cy = rnd(4, 14), r = rnd(6, 14), sp = rnd(0.15, 0.3) * (s % 2 ? 1 : -1); for (let k = 0; k < 8; k++) fishList.push({ cx, cz, cy: cy + rnd(-1, 1), r: r + rnd(-1.5, 1.5), sp, a: k * 0.22 + rnd(0, 0.1), c: FCOL[s] }); }
    const fish = inst(fishGeo, std(0xffffff, { roughness: 0.4 }), fishList, (o, p, e, s) => { p.set(o.cx + o.r, o.cy, o.cz); e.set(0, 0, 0); s.set(1, 1, 1); });
    fish.frustumCulled = false; env.add(fish);
    const m4 = new T.Matrix4(), q = new T.Quaternion(), pv = new T.Vector3(), sv = new T.Vector3(1, 1, 1), up = new T.Vector3(0, 1, 0);
    // burbujas que suben
    const bub = H.points(360, 0, 0xdff8ff, 0.28, () => [rnd(-30, 30), rnd(-4, 22), rnd(-45, 12)]); bub.material.sizeAttenuation = true; bub.material.map = H.TEX.soft; env.add(bub);
    H.gpuMotion(bub, { vy: 1.1, vyStep: 0.25, vyMod: 5, ymin: -4, yr: 26, swx: 0.25, swxF: 2 });
    // rayos de luz desde la superficie
    const rayM = new T.MeshBasicMaterial({ color: 0xbff8ff, transparent: true, opacity: 0.08, depthWrite: false, blending: T.AdditiveBlending, fog: false, side: T.DoubleSide });
    for (let i = 0; i < 7; i++) { const r = mesh(new T.PlaneGeometry(rnd(2, 4.5), 70), rayM, rnd(-40, 40), 22, rnd(-70, -30)); r.rotation.z = rnd(-0.38, -0.18); env.add(r); }
    H.scene.add(env); env.visible = false;
    const sand = H.tiles('#e2cc96', 'rgba(150,120,70,0.35)', 5, (g, x, y, s) => { if (Math.random() < 0.3) { g.fillStyle = ['#ffb8c8', '#fff4e0', '#ffd0a0'][(Math.random() * 3) | 0]; g.beginPath(); g.arc(x + rnd(8, s - 8), y + rnd(8, s - 8), 6, Math.PI, TAU); g.fill(); } });
    const under = new T.Group(); under.add(mesh(new T.ConeGeometry(C.ISLAND_R * 0.98, 8, 18), std(0x8a7a6a, { flatShading: true, roughness: 0.95 }), 0, -4.3, 0)); under.children[0].rotation.x = Math.PI;
    const cm = std(0xff6a9a, { roughness: 0.6 });
    const platform = H.makePlatform({ top: new T.MeshStandardMaterial({ map: sand, roughness: 0.95 }), side: std(0xff8aa8, { roughness: 0.7 }), trim: std(0xffd23f, { metalness: 0.6, roughness: 0.3 }), under,
      post: (i) => { const p = new T.Group(), m = i % 2 ? cm : std(0xff9a3a, { roughness: 0.6 }); p.add(mesh(new T.CylinderGeometry(0.1, 0.16, 2.4, 6), m, 0, 1.2, 0)); for (const s of [-1, 1]) { const b = mesh(new T.CylinderGeometry(0.07, 0.1, 1.1, 6), m, s * 0.3, 2.1, 0); b.rotation.z = -s * 0.6; p.add(b); } return p; } });
    let t = 0;
    return { env: [env], platform, noSun: true,
      update: (dt) => { t += dt; fishList.forEach((o, i) => { const a = o.a + t * o.sp; pv.set(o.cx + Math.cos(a) * o.r, o.cy + Math.sin(t * 1.5 + i) * 0.3, o.cz + Math.sin(a) * o.r); q.setFromAxisAngle(up, -a + (o.sp > 0 ? -Math.PI / 2 : Math.PI / 2)); m4.compose(pv, q, sv); fish.setMatrixAt(i, m4); }); fish.instanceMatrix.needsUpdate = true; },
      splash: e => { for (let i = 0; i < 6; i++) X.spawnSprite(e.x + rnd(-0.6, 0.6), C.SEA_Y + 0.8 + i * 0.3, e.z, 0xdff8ff, 0.5 * e.s, 1.6, 1.2, { vy: 2.4, alpha: 0.7 }); X.spawnDebris(e.x, C.SEA_Y + 0.8, e.z, 0xd8c08a, 8, 4, 0.12, 0.8); } };
  }

  // ---------------- Juguetería ----------------
  function buildToys() {
    const env = new T.Group();
    const planks = tex(g => { for (let i = 0; i < 8; i++) { g.fillStyle = ['#d8a868', '#cf9c5c', '#e0b478', '#c89458'][i % 4]; g.fillRect(0, i * 32, 256, 32); g.fillStyle = 'rgba(90,50,20,0.45)'; g.fillRect(0, i * 32, 256, 2); g.fillRect((i * 97) % 256, i * 32, 2, 32); } });
    planks.wrapS = planks.wrapT = T.RepeatWrapping; planks.repeat.set(40, 40);
    const floor = mesh(new T.PlaneGeometry(600, 600), new T.MeshStandardMaterial({ map: planks, roughness: 0.75 }), 0, C.SEA_Y, 0); floor.rotation.x = -Math.PI / 2; env.add(floor);
    // paredes del cuarto con papel pintado y una ventana
    const paper = tex(g => { g.fillStyle = '#ffe0ec'; g.fillRect(0, 0, 256, 256); for (let x = 0; x < 256; x += 32) { g.fillStyle = '#ffc4dc'; g.fillRect(x, 0, 12, 256); } g.fillStyle = '#ffffff'; for (let y = 16; y < 256; y += 48) for (let x = 22; x < 256; x += 64) { g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill(); } });
    paper.wrapS = paper.wrapT = T.RepeatWrapping; paper.repeat.set(12, 3);
    const wallM = new T.MeshStandardMaterial({ map: paper, roughness: 0.9 });
    const back = mesh(new T.PlaneGeometry(400, 90), wallM, 0, C.SEA_Y + 45, -140); env.add(back);
    for (const s of [-1, 1]) { const w = mesh(new T.PlaneGeometry(400, 90), wallM, s * 150, C.SEA_Y + 45, 0); w.rotation.y = -s * Math.PI / 2; env.add(w); }
    const win = mesh(new T.PlaneGeometry(40, 26), new T.MeshBasicMaterial({ color: 0xbfe8ff, fog: false }), 30, C.SEA_Y + 42, -139.5); env.add(win);
    const frameM = std(0xffffff); [[0, 13.5, 42, 1.5], [0, -13.5, 42, 1.5], [-20.5, 0, 1.5, 28], [20.5, 0, 1.5, 28], [0, 0, 1, 26]].forEach(([x, y, w, h]) => env.add(mesh(new T.BoxGeometry(w, h, 0.6), frameM, 30 + x, C.SEA_Y + 42 + y, -139.2)));
    // cubos gigantes con letras (los mismos materiales que los bloques)
    const big = spots(26, 18, 80, true);
    for (const c of 'rbgyp') env.add(inst(new T.BoxGeometry(1, 1, 1), SKINS.toys.mat[c], big.filter(o => 'rbgyp'[o.i % 5] === c), (o, p, e, s) => { const k = rnd(3, 6); p.set(o.x, C.SEA_Y + k / 2 + (o.i % 7 === 0 ? k : 0), o.z); e.set(0, rnd(0, TAU), 0); s.set(k, k, k); }));
    // ceras gigantes tumbadas
    const CR = [0xe8372c, 0x2a6ee0, 0x2aa848, 0xf2b01e, 0x9a3cc8, 0xff8a3a];
    const crayons = spots(16, 16, 60, true).map(o => Object.assign(o, { c: CR[o.i % 6], a: rnd(0, TAU) }));
    env.add(inst(new T.CylinderGeometry(0.8, 0.8, 9, 12), std(0xffffff, { roughness: 0.6 }), crayons, (o, p, e, s) => { p.set(o.x, C.SEA_Y + 0.8, o.z); e.set(0, o.a, Math.PI / 2); s.set(1, 1, 1); }));
    env.add(inst(new T.ConeGeometry(0.8, 1.8, 12), std(0xffffff, { roughness: 0.6 }), crayons, (o, p, e, s) => { p.set(o.x + Math.cos(o.a) * 5.4, C.SEA_Y + 0.8, o.z - Math.sin(o.a) * 5.4); e.set(0, o.a, -Math.PI / 2); s.set(1, 1, 1); }));
    // pelotas de playa
    const ball = tex(g => { const cs = ['#e8372c', '#ffffff', '#2a6ee0', '#ffffff', '#f2b01e', '#ffffff']; for (let i = 0; i < 6; i++) { g.fillStyle = cs[i]; g.fillRect(i * 43, 0, 43, 256); } });
    [[-24, -40, 3], [30, -48, 4], [-50, -10, 3.5], [55, -12, 2.6]].forEach(([x, z, r]) => env.add(mesh(new T.SphereGeometry(r, 24, 16), new T.MeshPhysicalMaterial({ map: ball, roughness: 0.3, clearcoat: 1 }), x, C.SEA_Y + r, z)));
    // confeti que cae despacio
    for (const c of [0xff5a8a, 0x5fd4ff, 0xffd23f]) { const cf = H.points(110, 0, c, 0.3, () => [rnd(-30, 30), rnd(-3, 16), rnd(-40, 12)]); cf.material.sizeAttenuation = true; env.add(cf); H.gpuMotion(cf, { vy: -0.5, vyStep: 0.1, vyMod: 3, ymin: -3, yr: 19, swx: 0.6, swxF: 1.6 }); }
    H.scene.add(env); env.visible = false;
    const mat = tex(g => { const cs = ['#ff7a8a', '#ffd23f', '#5fd4ff', '#7ad86a']; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = cs[(x + y) % 4]; g.fillRect(x * 64, y * 64, 64, 64); } g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 4; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke(); } });
    const under = new T.Group(); under.add(mesh(new T.CylinderGeometry(C.ISLAND_R * 0.97, C.ISLAND_R * 0.97, 4.4, 28), new T.MeshStandardMaterial({ map: H.stripes('#2a6ee0', '#ffffff', 10), roughness: 0.6 }), 0, -2.5, 0));
    const platform = H.makePlatform({ top: new T.MeshStandardMaterial({ map: mat, roughness: 0.85 }), side: std(0x2a6ee0, { roughness: 0.6 }), trim: std(0xffd23f, { roughness: 0.4 }), under,
      flags: [0xe8372c, 0xffd23f, 0x2a6ee0, 0x2aa848, 0x9a3cc8], line: 0x6a4a8a,
      post: (i) => { const p = new T.Group(), m = std(CR[i % 6], { roughness: 0.6 }); p.add(mesh(new T.CylinderGeometry(0.16, 0.16, 2.6, 10), m, 0, 1.3, 0)); p.add(mesh(new T.ConeGeometry(0.16, 0.45, 10), m, 0, 2.82, 0)); return p; } });
    return { env: [env], platform, splash: H.splashCol(0xffe8c8, 0xd8a868) };
  }

  // ---------------- Era de los dinosaurios ----------------
  function buildDino() {
    const env = new T.Group();
    env.add(H.ground(0x7a6a3a, 1, (x, z) => { const d = Math.hypot(x, z), k = Math.min(1, Math.max(0, (d - 9) / 22)); return k * (2.2 * Math.sin(x * 0.05) * Math.cos(z * 0.06) + 0.8 * Math.sin(x * 0.17 + z * 0.11)); }, { roughness: 1 }));
    // volcán al fondo con cráter brillante
    const volc = mesh(new T.ConeGeometry(38, 46, 14, 1, true), std(0x4a3a34, { flatShading: true, roughness: 1 }), 20, C.SEA_Y + 21, -150); env.add(volc);
    const crater = mesh(new T.CircleGeometry(9, 20), new T.MeshBasicMaterial({ color: 0xff7a2a, fog: false }), 20, C.SEA_Y + 43.5, -150); crater.rotation.x = -Math.PI / 2; env.add(crater);
    const glow = new T.Sprite(new T.SpriteMaterial({ map: H.TEX.soft, color: 0xff8a3a, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false, fog: false })); glow.scale.set(40, 26, 1); glow.position.set(20, C.SEA_Y + 47, -150); env.add(glow);
    // helechos y cícadas
    const fern = spots(60, 13, 80, true);
    env.add(inst(new T.ConeGeometry(1.4, 2.6, 6), std(0x3f8a2a, { flatShading: true, roughness: 0.9 }), fern, (o, p, e, s) => { const k = rnd(0.7, 1.8); p.set(o.x, C.SEA_Y + 1.1 * k, o.z); e.set(rnd(-0.2, 0.2), rnd(0, 3), 0); s.set(k, k, k); }));
    const cyc = spots(20, 22, 90, true);
    env.add(inst(new T.CylinderGeometry(0.5, 0.8, 7, 8), std(0x6a4a2a, { roughness: 0.95 }), cyc, (o, p, e, s) => { p.set(o.x, C.SEA_Y + 3.5, o.z); e.set(0, 0, 0); s.set(1, 1, 1); }));
    const leaves = []; cyc.forEach(o => { for (let k = 0; k < 7; k++) leaves.push({ x: o.x, z: o.z, a: k * TAU / 7 }); });
    env.add(inst(new T.ConeGeometry(0.5, 4.2, 4), std(0x4f9a3a, { flatShading: true }), leaves, (o, p, e, s) => { p.set(o.x + Math.cos(o.a) * 1.6, C.SEA_Y + 7.3, o.z + Math.sin(o.a) * 1.6); e.set(Math.sin(o.a) * 1.1, 0, -Math.cos(o.a) * 1.1); s.set(1, 1, 1); }));
    // dinosaurios de cuello largo a lo lejos
    const skin = std(0x7a8a5a, { roughness: 0.85 });
    const bronto = (x, z, s, ry) => { const g = new T.Group();
      const body = mesh(new T.SphereGeometry(4, 18, 12), skin); body.scale.set(1.5, 0.9, 0.9); body.position.y = 7; g.add(body);
      const neck = mesh(new T.CylinderGeometry(0.9, 1.6, 11, 10), skin, 6.5, 11.5, 0); neck.rotation.z = -0.6; g.add(neck);
      g.add(mesh(new T.SphereGeometry(1.5, 12, 10), skin, 10.2, 16, 0));
      const tail = mesh(new T.ConeGeometry(1.6, 12, 10), skin, -9.5, 5.5, 0); tail.rotation.z = Math.PI / 2 + 0.35; g.add(tail);
      for (const [lx, lz] of [[-2.8, -1.8], [-2.8, 1.8], [2.6, -1.8], [2.6, 1.8]]) g.add(mesh(new T.CylinderGeometry(0.9, 1, 5, 8), skin, lx, 2.5, lz));
      g.scale.setScalar(s); g.rotation.y = ry; g.position.set(x, C.SEA_Y, z); env.add(g); };
    bronto(-55, -95, 1, 0.3); bronto(65, -70, 0.8, 2.6);
    // huevos de dinosaurio
    const eggs = [[-12, -24], [-10.5, -25.5], [-13.5, -26]].map(([x, z]) => ({ x, z }));
    env.add(inst(new T.SphereGeometry(0.8, 14, 10), std(0xf0e6c8, { roughness: 0.6 }), eggs, (o, p, e, s) => { p.set(o.x, C.SEA_Y + 0.9, o.z); e.set(rnd(-0.2, 0.2), 0, rnd(-0.2, 0.2)); s.set(1, 1.35, 1); }));
    H.scene.add(env); env.visible = false;
    const stone = H.tiles('#8a7a5a', 'rgba(50,35,20,0.6)', 5, (g, x, y, s) => { if (Math.random() < 0.18) { g.strokeStyle = 'rgba(40,25,10,0.6)'; g.lineWidth = 3; g.beginPath(); for (let a = 0; a < 12; a += 0.3) { const r = 2 + a * 1.4; g.lineTo(x + s / 2 + Math.cos(a) * r, y + s / 2 + Math.sin(a) * r); } g.stroke(); } });
    const under = new T.Group(); const rock = mesh(new T.ConeGeometry(C.ISLAND_R * 0.98, 8, 12), std(0x5a4a3a, { flatShading: true, roughness: 1 }), 0, -4.3, 0); rock.rotation.x = Math.PI; under.add(rock);
    const boneM = std(0xf0e6c8, { roughness: 0.6 });
    const platform = H.makePlatform({ top: new T.MeshStandardMaterial({ map: stone, roughness: 0.95 }), side: std(0x6a5a3a, { roughness: 0.95 }), trim: std(0xffb030, { emissive: 0xc06a00, emissiveIntensity: 0.5, roughness: 0.3 }), under,
      post: () => { const p = new T.Group(); p.add(mesh(new T.CylinderGeometry(0.12, 0.12, 2.6, 8), boneM, 0, 1.3, 0)); for (const y of [0.05, 2.65]) for (const s of [-1, 1]) p.add(mesh(new T.SphereGeometry(0.2, 10, 8), boneM, s * 0.14, y, 0)); return p; } });
    return { env: [env], platform, update: () => { glow.material.opacity = 0.65 + Math.sin(H.G.t * 1.7) * 0.15; }, splash: H.splashCol(0xc8a878, 0x7a6a3a) };
  }

  // ---------------- lo que cruza el cielo (con 2 bolas) ----------------
  // Las piezas de choque están en sim3d.js (C.CARRIERS); aquí solo el dibujo, en las mismas coordenadas.
  function carrier(kind, g, K) {
    if (kind === 'orchard') {                       // abeja con una cesta colgando
      const yel = std(0xffd23f, { roughness: 0.4 }), blk = std(0x2a1d3a), wingM = new T.MeshPhysicalMaterial({ color: 0xe8f8ff, transparent: true, opacity: 0.55, roughness: 0.1, side: T.DoubleSide, depthWrite: false });
      const body = mesh(new T.SphereGeometry(0.55, 18, 12), yel, 0, 0.2, 0); body.scale.set(1.35, 1, 1); g.add(body);
      for (const x of [-0.3, 0.1]) { const st = mesh(new T.CylinderGeometry(0.56, 0.56, 0.16, 18, 1, true), blk, x, 0.2, 0); st.rotation.z = Math.PI / 2; st.scale.set(1, 1, 0.98); g.add(st); }
      g.add(mesh(new T.SphereGeometry(0.34, 14, 10), blk, 0.68, 0.35, 0));
      for (const z of [-0.14, 0.14]) { g.add(mesh(new T.SphereGeometry(0.08, 8, 6), new T.MeshBasicMaterial({ color: 0xffffff }), 0.92, 0.42, z)); const an = mesh(new T.CylinderGeometry(0.02, 0.02, 0.4, 4), blk, 0.75, 0.75, z); an.rotation.z = -0.4; g.add(an); }
      const stinger = mesh(new T.ConeGeometry(0.1, 0.3, 8), blk, -0.8, 0.2, 0); stinger.rotation.z = Math.PI / 2; g.add(stinger);
      const wl = new T.Group(), wr = new T.Group();
      for (const [w, s] of [[wl, 1], [wr, -1]]) { const m = mesh(new T.CircleGeometry(0.5, 16), wingM, 0, 0, s * 0.45); m.scale.set(1.2, 0.7, 1); m.rotation.x = Math.PI / 2; w.add(m); w.position.set(0, 0.7, 0); g.add(w); }
      g.userData.wings = [wl, wr];
      g.add(mesh(new T.CylinderGeometry(0.015, 0.015, 0.5, 4), blk, 0, -0.3, 0));
      const basket = mesh(new T.CylinderGeometry(0.42, 0.34, 0.42, 14, 1, true), std(0xb07a44, { roughness: 0.9, side: T.DoubleSide }), 0, -0.72, 0); g.add(basket);
      return true;
    }
    if (kind === 'reef') {                          // submarino amarillo con ojo de buey (se ven las 2 bolas)
      const hullM = std(0xffc83d, { roughness: 0.35, metalness: 0.2 }), dark = std(0x3a3a4a, { metalness: 0.6, roughness: 0.3 });
      const hull = mesh(new T.CapsuleGeometry(0.5, 1.3, 8, 16), hullM); hull.rotation.z = Math.PI / 2; g.add(hull);
      g.add(mesh(new T.BoxGeometry(0.5, 0.42, 0.42), hullM, 0.1, 0.55, 0));
      const peri = mesh(new T.CylinderGeometry(0.04, 0.04, 0.5, 6), dark, 0.25, 0.95, 0); g.add(peri);
      const win = mesh(new T.SphereGeometry(0.42, 18, 12, 0, TAU, 0, Math.PI / 2), new T.MeshPhysicalMaterial({ color: 0xbff4ff, transparent: true, opacity: 0.3, roughness: 0.05, clearcoat: 1, depthWrite: false }), 0, 0.05, 0.3); win.rotation.x = Math.PI / 2; g.add(win);
      const ring = mesh(new T.TorusGeometry(0.42, 0.05, 8, 24), dark, 0, 0.05, 0.32); g.add(ring);
      const prop = new T.Group(); for (let i = 0; i < 3; i++) { const b = mesh(new T.BoxGeometry(0.06, 0.4, 0.12), dark, 0, 0.2, 0); const pv = new T.Group(); pv.rotation.x = i * TAU / 3; pv.add(b); prop.add(pv); } prop.position.x = -1.2; g.add(prop); g.userData.prop = prop;
      const fin = mesh(new T.BoxGeometry(0.3, 0.06, 0.8), hullM, -0.95, 0, 0); g.add(fin);
      return true;
    }
    if (kind === 'toys') {                          // avión de juguete con una caja colgando
      const red = std(0xe8372c, { roughness: 0.4 }), blue = std(0x2a6ee0, { roughness: 0.4 }), wood = std(0xd8a868, { roughness: 0.8 });
      const fus = mesh(new T.BoxGeometry(1.7, 0.42, 0.42), red); g.add(fus);
      g.add(mesh(new T.BoxGeometry(0.5, 0.06, 2.1), blue, 0.1, 0.05, 0));
      g.add(mesh(new T.BoxGeometry(0.3, 0.45, 0.06), blue, -0.75, 0.35, 0));
      g.add(mesh(new T.BoxGeometry(0.3, 0.06, 0.8), blue, -0.75, 0.15, 0));
      const prop = new T.Group(); prop.add(mesh(new T.BoxGeometry(0.05, 0.7, 0.1), wood)); prop.position.x = 0.9; g.add(prop); g.userData.prop2 = prop;
      g.add(mesh(new T.SphereGeometry(0.1, 10, 8), std(0xffd23f), 0.9, 0, 0));
      for (const x of [-0.25, 0.25]) g.add(mesh(new T.CylinderGeometry(0.01, 0.01, 0.4, 4), std(0x5a4a3a), x, -0.38, 0));
      const crate = new T.Group(); crate.add(mesh(new T.BoxGeometry(0.84, 0.06, 0.6), wood, 0, -0.82, 0)); crate.add(mesh(new T.BoxGeometry(0.84, 0.22, 0.06), wood, 0, -0.7, 0.28)); crate.add(mesh(new T.BoxGeometry(0.84, 0.3, 0.06), wood, 0, -0.66, -0.28));
      for (const x of [-0.42, 0.42]) crate.add(mesh(new T.BoxGeometry(0.06, 0.3, 0.6), wood, x, -0.66, 0));
      g.add(crate);
      return true;
    }
    if (kind === 'dino') {                          // pterodáctilo con una cesta en las garras
      const skin = std(0xc8784a, { roughness: 0.7 }), wingM = std(0xa85a3a, { side: T.DoubleSide, roughness: 0.6 });
      const body = mesh(new T.SphereGeometry(0.45, 16, 12), skin); body.scale.set(1.5, 0.8, 0.8); g.add(body);
      g.add(mesh(new T.SphereGeometry(0.28, 14, 10), skin, 0.75, 0.22, 0));
      const beak = mesh(new T.ConeGeometry(0.12, 0.7, 8), std(0xe8c890), 1.15, 0.18, 0); beak.rotation.z = -Math.PI / 2; g.add(beak);
      const crest = mesh(new T.ConeGeometry(0.1, 0.6, 6), skin, 0.5, 0.42, 0); crest.rotation.z = 1.2; g.add(crest);
      for (const z of [-0.15, 0.15]) g.add(mesh(new T.SphereGeometry(0.05, 8, 6), new T.MeshBasicMaterial({ color: 0x1a1020 }), 0.86, 0.3, z));
      const wingGeo = new T.BufferGeometry().setFromPoints([new T.Vector3(-0.4, 0, 0), new T.Vector3(0.45, 0, 0), new T.Vector3(0.1, 0.1, 1.9), new T.Vector3(-0.4, 0, 0), new T.Vector3(0.1, 0.1, 1.9), new T.Vector3(-0.7, 0, 1.2)]);
      wingGeo.computeVertexNormals();
      const wl = new T.Group(), wr = new T.Group(); wl.add(new T.Mesh(wingGeo, wingM)); const wrm = new T.Mesh(wingGeo, wingM); wrm.scale.z = -1; wr.add(wrm);
      wl.position.set(0, 0.15, 0.2); wr.position.set(0, 0.15, -0.2); g.add(wl); g.add(wr); g.userData.wings = [wl, wr];
      for (const x of [-0.25, 0.25]) g.add(mesh(new T.CylinderGeometry(0.04, 0.04, 0.45, 6), skin, x, -0.45, 0));
      g.add(mesh(new T.BoxGeometry(0.84, 0.5, 0.72), std(0x6b4423, { roughness: 0.9 }), 0, -0.88, 0));
      return true;
    }
    return false;
  }
  function syncCarrier(m, g, t) {
    if (m.carrier === 'orchard' || m.carrier === 'dino') { const f = Math.sin(t * (m.carrier === 'orchard' ? 40 : 7) + m.ph) * (m.carrier === 'orchard' ? 0.5 : 0.8); const w = g.userData.wings; if (w) { w[0].rotation.x = -f; w[1].rotation.x = f; } }
    else if (m.carrier === 'reef') { g.rotation.z = Math.sin(t * 1.2 + m.ph) * 0.05; if (g.userData.prop) g.userData.prop.rotation.x = t * 10; }
    else if (m.carrier === 'toys') { g.rotation.z = Math.sin(t * 2 + m.ph) * 0.08; if (g.userData.prop2) g.userData.prop2.rotation.x = t * 25; }
  }
  // en el arrecife el pájaro es un pez (las aletas hacen de alas)
  function makeFish() {
    const g = new T.Group(), m = std(0xff8a3a, { roughness: 0.4 }), w = std(0xffffff, { roughness: 0.4 });
    const body = mesh(new T.SphereGeometry(0.42, 18, 12), m); body.scale.set(1.4, 0.9, 0.55); g.add(body);
    for (const x of [-0.15, 0.2]) { const st = mesh(new T.CylinderGeometry(0.4, 0.4, 0.09, 16, 1, true), w, x, 0, 0); st.rotation.z = Math.PI / 2; st.scale.set(0.95, 1, 0.6); g.add(st); }
    const tail = mesh(new T.ConeGeometry(0.32, 0.5, 4), m, -0.72, 0, 0); tail.rotation.z = Math.PI / 2; g.add(tail);
    for (const z of [-0.18, 0.18]) g.add(mesh(new T.SphereGeometry(0.06, 8, 6), new T.MeshBasicMaterial({ color: 0x111122 }), 0.4, 0.1, z));
    const wl = new T.Group(), wr = new T.Group();
    for (const [p, s] of [[wl, 1], [wr, -1]]) { const f = mesh(new T.ConeGeometry(0.16, 0.4, 4), m, 0, 0, s * 0.2); f.rotation.x = s * Math.PI / 2; p.add(f); g.add(p); }
    g.userData.wings = [wl, wr];
    return g;
  }

  const BUILD = { orchard: buildOrchard, reef: buildReef, toys: buildToys, dino: buildDino };
  window.Mundos = {
    build: name => (BUILD[name] ? BUILD[name]() : null),
    skin: name => SKINS[name] || null,
    carrier, syncCarrier, makeFish,
    // materiales de los bloques para la precarga
    warm: () => { const g = new T.Group(); for (const k in SKINS) for (const c of 'rbgyp') g.add(new T.Mesh(new T.BoxGeometry(1, 1, 1), SKINS[k].mat[c])); return g; },
  };
})();
