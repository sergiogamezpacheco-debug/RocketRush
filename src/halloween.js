// Rocket Rush — evento de Halloween: paisaje (castillo encantado con murciélagos, cementerio y calabazas),
// la bruja en escoba (en lugar del pájaro), el galeón pirata de velas negras (en lugar del velero) y los caramelos.
// Usa las piezas del motor que expone game3d.js en RRGame.hw.
(function () {
  'use strict';
  const X = window.RRGame;
  if (!X || !X.hw) return;
  const H = X.hw, T = H.THREE, C = H.C, TAU = Math.PI * 2, rnd = H.rnd;
  const std = (color, o) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.75 }, o || {}));
  const basic = (color, o) => new T.MeshBasicMaterial(Object.assign({ color }, o || {}));
  const mesh = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); return m; };

  // ---------- texturas ----------
  const faceTex = H.canvasTex(128, 128, (g) => {          // cara tallada de la calabaza (brilla por dentro)
    g.clearRect(0, 0, 128, 128);
    const path = () => {
      g.beginPath(); g.moveTo(24, 54); g.lineTo(52, 54); g.lineTo(38, 26); g.closePath();
      g.moveTo(76, 54); g.lineTo(104, 54); g.lineTo(90, 26); g.closePath();
      g.moveTo(57, 70); g.lineTo(71, 70); g.lineTo(64, 58); g.closePath();
      g.moveTo(16, 76); g.quadraticCurveTo(64, 126, 112, 76);
      for (let i = 0; i <= 8; i++) { const x = 112 - i * 12, y = 84 + (i % 2 ? 0 : 10); g.lineTo(x, y); }
      g.closePath();
    };
    path(); g.lineJoin = 'round'; g.strokeStyle = '#7a2a00'; g.lineWidth = 9; g.stroke();
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, '#fff27a'); gr.addColorStop(1, '#ffb000');
    g.fillStyle = gr; path(); g.fill();
  }, true);
  const caneTex = H.canvasTex(128, 32, (g) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 32); g.fillStyle = '#e8203a'; for (let i = -2; i < 12; i++) { g.beginPath(); g.moveTo(i * 16, 32); g.lineTo(i * 16 + 8, 32); g.lineTo(i * 16 + 20, 0); g.lineTo(i * 16 + 12, 0); g.fill(); } g.fillStyle = '#3fb84a'; for (let i = -2; i < 12; i++) { g.beginPath(); g.moveTo(i * 16 + 8, 32); g.lineTo(i * 16 + 10, 32); g.lineTo(i * 16 + 22, 0); g.lineTo(i * 16 + 20, 0); g.fill(); } }, true);
  caneTex.wrapS = T.RepeatWrapping; caneTex.repeat.set(4, 1);
  const flagTex = H.canvasTex(128, 96, (g) => {           // bandera pirata: calavera y tibias
    g.fillStyle = '#111014'; g.fillRect(0, 0, 128, 96);
    g.strokeStyle = '#f2efe6'; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.moveTo(34, 78); g.lineTo(94, 30); g.moveTo(34, 30); g.lineTo(94, 78); g.stroke();
    g.fillStyle = '#f2efe6'; g.beginPath(); g.arc(64, 42, 21, 0, TAU); g.fill(); g.fillRect(52, 52, 24, 16);
    g.fillStyle = '#111014'; g.beginPath(); g.arc(56, 42, 6, 0, TAU); g.arc(72, 42, 6, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(64, 48); g.lineTo(60, 55); g.lineTo(68, 55); g.fill();
    for (let i = 0; i < 3; i++) g.fillRect(56 + i * 7, 62, 3, 6);
  }, true);
  const sailTex = H.canvasTex(128, 128, (g) => {          // vela negra gastada, con remiendos y rotos
    g.fillStyle = '#25202c'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(${60 + i * 6},${50 + i * 4},${70 + i * 6},.5)`; g.fillRect(i * 22, 0, 2, 128); }
    g.fillStyle = 'rgba(90,70,60,.55)'; g.fillRect(70, 30, 26, 20); g.fillRect(18, 80, 20, 16);
    g.strokeStyle = 'rgba(200,180,150,.35)'; g.setLineDash([3, 4]); g.lineWidth = 2; g.strokeRect(70, 30, 26, 20); g.strokeRect(18, 80, 20, 16);
    g.clearRect(100, 96, 14, 18); g.clearRect(30, 40, 8, 12);
    g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(0, 128);
    for (let x = 0; x <= 128; x += 8) g.lineTo(x, 118 + (x / 8 % 2 ? 10 : 0)); g.lineTo(128, 128); g.fill();
  }, true);
  const stockTex = H.canvasTex(32, 64, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#1a1020' : '#9a3ad8'; g.fillRect(0, i * 8, 32, 8); } }, true);
  const craterTex = H.canvasTex(256, 256, (g) => {
    const gr = g.createRadialGradient(110, 100, 20, 128, 128, 128); gr.addColorStop(0, '#fffbe8'); gr.addColorStop(0.8, '#ffe9a8'); gr.addColorStop(1, '#f2c870'); g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 126, 0, TAU); g.fill();
    for (const [x, y, r] of [[90, 80, 22], [160, 150, 30], [120, 190, 14], [180, 80, 12], [70, 160, 16]]) { g.fillStyle = 'rgba(210,170,90,.35)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  }, true);

  // ---------- piezas ----------
  const MAT = {
    pumpkin: std(0xff7a1a, { roughness: 0.55 }), stem: std(0x3f7a2a), face: new T.MeshBasicMaterial({ map: faceTex, transparent: true, depthWrite: false, fog: false }),
    rock: std(0x3a3248, { roughness: 1, flatShading: true }), grass: std(0x2a3326, { roughness: 1 }), grave: std(0x8a8698, { roughness: 0.9, flatShading: true }),
    bark: std(0x2a1a16, { roughness: 1, flatShading: true }), roof: std(0x3a1460, { roughness: 0.55, flatShading: true }), win: basic(0xffb03a, { fog: false }),
    bat: std(0x16101c, { roughness: 0.6, side: T.DoubleSide }), batEye: basic(0xffd23f, { fog: false }), dark: basic(0x07040c),
    cane: new T.MeshStandardMaterial({ map: caneTex, roughness: 0.25, metalness: 0.05 }),
  };
  function pumpkin(s, glow) {                              // calabaza tallada (gajos, tallo y cara que brilla)
    const g = new T.Group();
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const lobe = mesh(new T.SphereGeometry(0.42, 16, 12), MAT.pumpkin, Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2); lobe.scale.set(0.8, 0.85, 0.8); g.add(lobe); }
    const st = mesh(new T.CylinderGeometry(0.05, 0.08, 0.28, 6), MAT.stem, 0, 0.42, 0); st.rotation.z = 0.3; g.add(st);
    if (glow !== false) { const f = mesh(new T.PlaneGeometry(0.66, 0.66), MAT.face, 0, 0.02, 0.47); f.renderOrder = 2; g.add(f); }
    g.scale.setScalar(s || 1);
    return g;
  }
  function bat() {
    const g = new T.Group();
    const body = mesh(new T.SphereGeometry(0.28, 12, 10), MAT.bat); body.scale.set(0.85, 1, 0.85); g.add(body);
    const head = mesh(new T.SphereGeometry(0.18, 12, 10), MAT.bat, 0, 0.3, 0.06); g.add(head);
    for (const s of [-1, 1]) {
      const ear = mesh(new T.ConeGeometry(0.07, 0.2, 4), MAT.bat, s * 0.1, 0.48, 0.04); g.add(ear);
      const eye = mesh(new T.SphereGeometry(0.035, 6, 6), MAT.batEye, s * 0.07, 0.33, 0.21); g.add(eye);
    }
    const shape = new T.Shape(); shape.moveTo(0, 0.12); shape.quadraticCurveTo(0.5, 0.42, 1.05, 0.2); shape.quadraticCurveTo(0.9, 0.02, 0.86, -0.12); shape.quadraticCurveTo(0.7, -0.02, 0.6, -0.14); shape.quadraticCurveTo(0.45, -0.04, 0.32, -0.14); shape.quadraticCurveTo(0.2, -0.04, 0, -0.1); shape.lineTo(0, 0.12);
    const wg = new T.ShapeGeometry(shape, 8);
    const wings = [];
    for (const s of [-1, 1]) { const p = new T.Group(); const w = new T.Mesh(wg, MAT.bat); w.scale.x = s; p.add(w); p.position.set(s * 0.12, 0.05, 0); g.add(p); wings.push(p); }
    g.userData.wings = wings;
    return g;
  }
  function grave(x, z, s, kind) {
    const g = new T.Group();
    if (kind === 'cross') { g.add(mesh(new T.BoxGeometry(0.22, 1.5, 0.18), MAT.grave, 0, 0.75, 0), mesh(new T.BoxGeometry(0.9, 0.22, 0.18), MAT.grave, 0, 1.05, 0)); }
    else { g.add(mesh(new T.BoxGeometry(0.9, 1.0, 0.25), MAT.grave, 0, 0.5, 0)); const top = mesh(new T.CylinderGeometry(0.45, 0.45, 0.25, 14, 1, false, 0, Math.PI), MAT.grave, 0, 1.0, 0); top.rotation.set(Math.PI / 2, Math.PI / 2, 0); g.add(top); }
    g.position.set(x, 0, z); g.rotation.set(rnd(-0.12, 0.12), rnd(-0.4, 0.4), rnd(-0.15, 0.15)); g.scale.setScalar(s);
    return g;
  }
  function deadTree(s) {
    const g = new T.Group();
    const trunk = mesh(new T.CylinderGeometry(0.18, 0.42, 4, 7), MAT.bark, 0, 2, 0); trunk.rotation.z = 0.12; g.add(trunk);
    const branch = (x, y, len, a, r) => { const b = mesh(new T.CylinderGeometry(r * 0.4, r, len, 5), MAT.bark); b.position.set(x, y, 0); b.rotation.z = a; b.translateY(len / 2); g.add(b); return b; };
    branch(0.1, 3.2, 2.2, 0.9, 0.16); branch(0, 3.4, 2.4, -0.8, 0.16); branch(-0.05, 2.4, 1.6, 1.3, 0.12); branch(0.2, 3.9, 1.4, -0.2, 0.1);
    g.scale.setScalar(s);
    return g;
  }
  // castillo encantado: torreones con tejado puntiagudo, almenas y ventanas encendidas
  function castle() {
    const g = new T.Group();
    const stoneTex = H.tiles('#4a4458', 'rgba(16,10,26,0.75)', 6, (c, x, y, s) => { if (Math.random() < 0.25) { c.fillStyle = 'rgba(130,100,170,.25)'; c.fillRect(x + 4, y + 4, s - 8, s - 8); } });
    stoneTex.wrapS = stoneTex.wrapT = T.RepeatWrapping; stoneTex.repeat.set(3, 3);
    const stone = new T.MeshStandardMaterial({ map: stoneTex, color: 0x9a90b4, roughness: 0.95 });
    const win = (w, h, x, y, z, ry) => { const m = mesh(new T.PlaneGeometry(w, h), MAT.win, x, y, z); m.rotation.y = ry || 0; g.add(m); const a = mesh(new T.CircleGeometry(w / 2, 10, 0, Math.PI), MAT.win, x, y + h / 2, z); a.rotation.y = ry || 0; g.add(a); };
    const merlons = (x, y, z, w, d) => { for (let i = -w / 2 + 0.6; i <= w / 2 - 0.4; i += 1.6) { g.add(mesh(new T.BoxGeometry(0.9, 1.1, 0.9), stone, x + i, y + 0.55, z + d / 2 - 0.45)); g.add(mesh(new T.BoxGeometry(0.9, 1.1, 0.9), stone, x + i, y + 0.55, z - d / 2 + 0.45)); } };
    const tower = (x, z, r, h, roofH) => {
      g.add(mesh(new T.CylinderGeometry(r, r * 1.08, h, 16), stone, x, h / 2, z));
      g.add(mesh(new T.CylinderGeometry(r * 1.22, r * 1.05, 1.2, 16), stone, x, h + 0.2, z));
      const roof = mesh(new T.ConeGeometry(r * 1.35, roofH, 16), MAT.roof, x, h + 0.8 + roofH / 2, z); g.add(roof);
      const fl = mesh(new T.ConeGeometry(0.35, 1.6, 4), basic(0xff7a1a), x + 0.5, h + 1.2 + roofH, z); fl.rotation.z = -1.3; g.add(fl);
      for (let k = 0; k < Math.floor(h / 7); k++) if (Math.random() < 0.8) win(r * 0.36, r * 0.55, x, 4 + k * 6.5, z + r + 0.05);
    };
    // muralla y torre del homenaje
    g.add(mesh(new T.BoxGeometry(40, 11, 6), stone, 0, 5.5, 4)); merlons(0, 11, 4, 40, 6);
    g.add(mesh(new T.BoxGeometry(18, 22, 12), stone, 0, 11, -4)); merlons(0, 22, -4, 18, 12);
    for (let i = -1; i <= 1; i++) win(1.4, 2.4, i * 4.5, 15, 2.06);
    win(1.8, 3.2, 0, 18.5, 2.06);
    // puerta
    g.add(mesh(new T.PlaneGeometry(4, 5), MAT.dark, 0, 2.5, 7.06)); const arch = mesh(new T.CircleGeometry(2, 16, 0, Math.PI), MAT.dark, 0, 5, 7.06); g.add(arch);
    tower(-20, 4, 3.4, 20, 9); tower(20, 4, 3.4, 18, 8); tower(-8, -9, 3, 34, 12); tower(9, -8, 2.6, 29, 10); tower(0, -12, 2.2, 40, 11);
    // colina rocosa
    const hill = mesh(new T.CylinderGeometry(26, 40, 16, 12, 2), MAT.rock, 0, -8, 0); g.add(hill);
    return g;
  }
  function islet(x, z, r, fill) {                          // islote con cementerio
    const g = new T.Group();
    g.add(mesh(new T.CylinderGeometry(r, r * 1.3, 3, 10), MAT.rock, 0, -1.2, 0));
    const top = mesh(new T.CylinderGeometry(r * 0.98, r, 0.4, 10), MAT.grass, 0, 0.4, 0); g.add(top);
    fill(g, r);
    g.position.set(x, C.SEA_Y, z);
    return g;
  }

  // ---------- paisaje ----------
  function build() {
    const env = new T.Group();
    const cs = castle(); cs.position.set(-24, C.SEA_Y + 10, -128); cs.rotation.y = 0.25; env.add(cs);
    // luna enorme detrás del castillo
    const moon = mesh(new T.CircleGeometry(20, 48), new T.MeshBasicMaterial({ map: craterTex, fog: false, transparent: true }), 34, 74, -240); moon.lookAt(0, 20, 0); env.add(moon);
    const halo = new T.Sprite(new T.SpriteMaterial({ map: H.TEX.soft, color: 0xffe2a0, transparent: true, opacity: 0.55, depthWrite: false, fog: false })); halo.scale.set(120, 120, 1); halo.position.set(34, 74, -242); env.add(halo);
    // islotes con tumbas, árboles muertos y calabazas
    const lanterns = [];
    const fillGraves = (g, r) => {
      for (let i = 0; i < 6; i++) { const a = rnd(0, TAU), d = rnd(0, r * 0.7); g.add(grave(Math.cos(a) * d, Math.sin(a) * d, rnd(0.8, 1.3), i % 3 ? 'stone' : 'cross')).children; }
      const t = deadTree(rnd(1.1, 1.5)); t.position.set(rnd(-r * 0.4, r * 0.4), 0.5, rnd(-r * 0.4, 0)); g.add(t);
      for (let i = 0; i < 3; i++) { const p = pumpkin(rnd(1.1, 1.6)); p.position.set(rnd(-r * 0.6, r * 0.6), 0.85, rnd(0, r * 0.5)); p.rotation.y = rnd(-0.5, 0.5); g.add(p); lanterns.push(p); }
      g.children.forEach(c => { if (c.type === 'Group') c.position.y = Math.max(c.position.y, 0.55); });
    };
    env.add(islet(-36, -34, 9, fillGraves), islet(42, -46, 11, fillGraves), islet(-62, 8, 8, fillGraves), islet(66, -6, 8, fillGraves));
    // murciélagos alrededor de los torreones y algunos cerca
    const bats = [];
    for (let i = 0; i < 18; i++) {
      const b = bat(); const near = i >= 13;
      b.userData.o = near ? new T.Vector3(rnd(-10, 10), C.SEA_Y + rnd(16, 24), rnd(-30, -16)) : new T.Vector3(cs.position.x + rnd(-14, 14), cs.position.y + rnd(26, 52), cs.position.z + rnd(-8, 8));
      b.userData.r = near ? rnd(10, 18) : rnd(5, 16); b.userData.w = rnd(0.5, 1.1) * (i % 2 ? 1 : -1); b.userData.ph = rnd(0, TAU); b.userData.f = rnd(14, 20);
      b.scale.setScalar(near ? 1.2 : rnd(2.2, 3.4)); env.add(b); bats.push(b);
    }
    // niebla morada sobre el agua y brasas
    const mist = [];
    for (let i = 0; i < 14; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: H.TEX.soft, color: 0x8a5ad8, transparent: true, opacity: 0.22, depthWrite: false })); const a = rnd(0, TAU), d = rnd(26, 90); s.position.set(Math.cos(a) * d, C.SEA_Y + rnd(0.5, 3), Math.sin(a) * d - 30); s.scale.set(rnd(26, 46), rnd(6, 10), 1); env.add(s); mist.push(s); }
    const embers = H.points(160, 0, 0xffa040, 0.35, () => { const a = rnd(0, TAU), r = rnd(12, 60); return [Math.cos(a) * r, C.SEA_Y + rnd(1, 14), Math.sin(a) * r - 18]; });
    embers.material.sizeAttenuation = true; embers.material.map = H.TEX.soft; embers.material.blending = T.AdditiveBlending; embers.material.size = 0.9; env.add(embers);
    H.scene.add(env); env.visible = false;
    // plataforma: losas oscuras, borde naranja y farolillos de calabaza
    const slab = H.tiles('#3a3448', 'rgba(20,12,32,0.8)', 7, (c, x, y, s) => { if (Math.random() < 0.12) { c.fillStyle = 'rgba(90,200,90,.18)'; c.fillRect(x + 6, y + 6, s * 0.5, s * 0.3); } });
    const under = new T.Group();
    const rock = mesh(new T.CylinderGeometry(C.ISLAND_R * 0.97, 1.6, 9, 12), MAT.rock, 0, -4.8, 0); under.add(rock);
    const platform = H.makePlatform({ top: new T.MeshStandardMaterial({ map: slab, roughness: 0.9 }), side: std(0x2a2236, { roughness: 0.9 }), trim: std(0xff7a1a, { emissive: 0xff5a00, emissiveIntensity: 0.35, roughness: 0.4 }), under,
      flags: [0xff7a1a, 0x6a2aa8, 0x16101c, 0x7ad04a], line: 0x16101c, postTop: 2.6,
      post: () => { const p = new T.Group(); p.add(mesh(new T.CylinderGeometry(0.07, 0.1, 2.2, 6), MAT.bark, 0, 1.1, 0)); const pk = pumpkin(0.7); pk.position.y = 2.45; pk.lookAt(0, 2.45, 0); p.add(pk); lanterns.push(pk); return p; } });
    // relámpagos: en la portada cada 1-2 s; jugando (y en el mapa), cada 5 s
    const boltMat = new T.MeshBasicMaterial({ color: 0xf4eeff, fog: false, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
    let bolt = null; const LT = { next: H.G.t + 1.5, t0: -1, base: null, n: 0 };
    const boltGlow = new T.Sprite(new T.SpriteMaterial({ map: H.TEX.soft, color: 0xc8b8ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false })); boltGlow.scale.set(140, 140, 1); env.add(boltGlow);
    function newBolt() {
      if (bolt) { env.remove(bolt); bolt.geometry.dispose(); }
      const x0 = rnd(-80, 70), z = rnd(-190, -150), pts = []; let x = x0, y = 95;
      while (y > C.SEA_Y + 4) { pts.push(new T.Vector3(x, y, z)); y -= rnd(5, 11); x += rnd(-6, 6); }
      bolt = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts, false, 'catmullrom', 0.1), pts.length * 3, 0.55, 5, false), boltMat);
      const br = pts[Math.floor(pts.length * (0.3 + Math.random() * 0.3))], b2 = [br.clone()]; let bx = br.x, by = br.y, s = Math.random() < 0.5 ? -1 : 1;
      for (let i = 0; i < 4; i++) { by -= rnd(5, 9); bx += s * rnd(4, 9); b2.push(new T.Vector3(bx, by, z)); }
      bolt.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(b2), 12, 0.3, 4, false), boltMat));
      boltGlow.position.set(x0, 60, z + 5); env.add(bolt);
    }
    function flashLevel(k) {           // k: 0 (nada) … 1 (destello)
      if (!LT.base) LT.base = { hemi: H.hemi.intensity, top: H.skyMat.uniforms.top.value.clone(), mid: H.skyMat.uniforms.mid.value.clone() };
      const B = LT.base;
      H.hemi.intensity = B.hemi + k * 2.8;
      H.skyMat.uniforms.top.value.copy(B.top).lerp(new T.Color(0x8a78d8), k * 0.8);
      H.skyMat.uniforms.mid.value.copy(B.mid).lerp(new T.Color(0xc8b8ff), k * 0.7);
      boltGlow.material.opacity = k * 0.8; if (bolt) bolt.visible = k > 0.25;
      const el = document.getElementById('ltFlash'); if (el) el.style.opacity = (k * (H.G.mode === 'title' ? 0.55 : 0.3)).toFixed(3);
      if (k === 0) { LT.base = null; }
    }
    function lightning(t) {
      if (LT.t0 < 0 && t >= LT.next) {
        LT.t0 = t; LT.n++; newBolt();
        const title = H.G.mode === 'title';
        const big = title ? LT.n % 3 === 0 : true;
        if (X.Audio && X.Audio.thunder) X.Audio.thunder(big);
        if (!title && X.vibe) X.vibe(12);
      }
      if (LT.t0 >= 0) {
        const e = t - LT.t0, k = e < 0.06 ? 1 : e < 0.12 ? 0.25 : e < 0.2 ? 0.85 : e < 0.45 ? 0.85 * (1 - (e - 0.2) / 0.25) : 0;
        flashLevel(Math.max(0, k) * (X.save && X.save.calm ? 0.18 : 1));
        if (e >= 0.45) { LT.t0 = -1; LT.next = t + (H.G.mode === 'title' ? rnd(1, 2) : 5); }
      }
    }
    return { env: [env], platform, noSun: true, water: true,
      leave() { if (LT.t0 >= 0 || LT.base) flashLevel(0); LT.t0 = -1; },
      update(dt) {
        const t = H.G.t;
        lightning(t);
        for (const b of bats) { const u = b.userData, a = t * u.w + u.ph; b.position.set(u.o.x + Math.cos(a) * u.r, u.o.y + Math.sin(t * 1.3 + u.ph) * 1.2, u.o.z + Math.sin(a) * u.r * 0.6); b.rotation.y = -a + (u.w > 0 ? 0 : Math.PI); const f = Math.sin(t * u.f + u.ph) * 0.9; u.wings[0].rotation.y = f; u.wings[1].rotation.y = -f; }
        for (const p of lanterns) { const f = p.children[p.children.length - 1]; if (f && f.material === MAT.face) f.material.opacity = 0.85 + Math.sin(t * 9 + p.id) * 0.15; }
        for (let i = 0; i < mist.length; i++) mist[i].position.x += Math.sin(t * 0.2 + i) * dt * 0.8;
        embers.material.opacity = 0.6 + Math.sin(t * 3) * 0.25;
      } };
  }

  // ---------- bruja en escoba (en lugar del pájaro) ----------
  function makeWitch() {
    const g = new T.Group();
    const skin = std(0x8ad05a, { roughness: 0.5 }), dress = std(0x5a2a9a, { roughness: 0.6 }), capeM = std(0x2a1040, { roughness: 0.7, side: T.DoubleSide }),
      hatM = std(0x1c1028, { roughness: 0.45 }), band = std(0xff7a1a, { roughness: 0.4 }), gold = std(0xffc83d, { metalness: 0.8, roughness: 0.25 }),
      wood = std(0x7a4a22, { roughness: 0.8 }), straw = std(0xd8a84a, { roughness: 0.9, flatShading: true }), hair = std(0xff6a1a, { roughness: 0.7, flatShading: true }),
      white = basic(0xffffff), black = basic(0x111111), boot = std(0x1a1020, { roughness: 0.4 }), stock = new T.MeshStandardMaterial({ map: stockTex, roughness: 0.7 });
    // escoba
    const stick = mesh(new T.CylinderGeometry(0.045, 0.055, 2.3, 8), wood, 0.05, 0, 0); stick.rotation.z = Math.PI / 2; g.add(stick);
    const knob = mesh(new T.SphereGeometry(0.075, 10, 8), wood, 1.2, 0, 0); g.add(knob);
    const bristles = mesh(new T.ConeGeometry(0.3, 0.8, 12, 1, true), straw, -1.35, 0, 0); bristles.rotation.z = -Math.PI / 2; g.add(bristles);
    const bcap = mesh(new T.CircleGeometry(0.3, 12), straw, -1.75, 0, 0); bcap.rotation.y = -Math.PI / 2; g.add(bcap);
    const tie = mesh(new T.TorusGeometry(0.09, 0.03, 6, 14), band, -0.95, 0, 0); tie.rotation.y = Math.PI / 2; g.add(tie);
    // piernas con medias de rayas y botas puntiagudas
    for (const s of [-1, 1]) {
      const leg = mesh(new T.CylinderGeometry(0.06, 0.07, 0.55, 8), stock, 0.22, -0.28, s * 0.12); leg.rotation.z = 0.5; g.add(leg);
      const bt = mesh(new T.ConeGeometry(0.08, 0.32, 8), boot, 0.4, -0.5, s * 0.12); bt.rotation.z = -Math.PI / 2 - 0.2; g.add(bt);
    }
    // cuerpo: vestido, torso y brazos que agarran la escoba
    const skirt = mesh(new T.ConeGeometry(0.34, 0.55, 14), dress, 0.02, 0.12, 0); g.add(skirt);
    const torso = mesh(new T.CylinderGeometry(0.13, 0.2, 0.42, 12), dress, 0.06, 0.46, 0); torso.rotation.z = -0.25; g.add(torso);
    const belt = mesh(new T.CylinderGeometry(0.165, 0.18, 0.06, 16), band, 0.02, 0.3, 0); belt.rotation.z = -0.25; g.add(belt);
    g.add(mesh(new T.BoxGeometry(0.03, 0.08, 0.08), gold, 0.2, 0.33, 0));
    // brazos: del hombro a la escoba
    const limb = (a, b, r0, r1, mat) => { const A = new T.Vector3(...a), Bv = new T.Vector3(...b), len = A.distanceTo(Bv); const l = new T.Mesh(new T.CylinderGeometry(r1, r0, len, 8), mat); l.position.copy(A).add(Bv).multiplyScalar(0.5); l.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), Bv.clone().sub(A).normalize()); g.add(l); return l; };
    for (const s of [-1, 1]) {
      limb([0.12, 0.6, s * 0.15], [0.32, 0.3, s * 0.13], 0.07, 0.06, dress);
      limb([0.32, 0.3, s * 0.13], [0.5, 0.06, s * 0.06], 0.06, 0.045, dress);
      g.add(mesh(new T.SphereGeometry(0.065, 8, 6), skin, 0.52, 0.04, s * 0.05));
      g.add(mesh(new T.ConeGeometry(0.09, 0.12, 8, 1, true), dress, 0.47, 0.1, s * 0.07).rotateZ(-2.3));
    }
    // cabeza: nariz larga, ojos, verruga y pelo naranja
    const head = mesh(new T.SphereGeometry(0.2, 16, 12), skin, 0.14, 0.82, 0); g.add(head);
    const nose = mesh(new T.ConeGeometry(0.05, 0.24, 8), skin, 0.36, 0.8, 0); nose.rotation.z = -Math.PI / 2 - 0.35; g.add(nose);
    g.add(mesh(new T.SphereGeometry(0.02, 6, 4), std(0x4a8a2a), 0.4, 0.76, 0.03));
    for (const s of [-1, 1]) { g.add(mesh(new T.SphereGeometry(0.05, 8, 6), white, 0.29, 0.88, s * 0.08)); g.add(mesh(new T.SphereGeometry(0.025, 6, 4), black, 0.33, 0.88, s * 0.085)); }
    const grin = mesh(new T.TorusGeometry(0.06, 0.012, 4, 10, Math.PI), black, 0.3, 0.72, 0); grin.rotation.set(0, Math.PI / 2, Math.PI); g.add(grin);
    // melena naranja que ondea hacia atrás
    g.userData.hair = [];
    for (let i = 0; i < 9; i++) { const z = (i - 4) * 0.045, h = new T.Group(); h.position.set(0.02, 0.86 - Math.abs(i - 4) * 0.012, z);
      const c = mesh(new T.ConeGeometry(0.065, 0.55, 6), hair, 0, -0.26, 0); h.add(c); h.rotation.z = 1.95 + (i % 2) * 0.12; h.rotation.x = z * 1.5; g.add(h); g.userData.hair.push(h); }
    // sombrero: ala ancha, copa doblada, cinta naranja y hebilla dorada
    const brim = mesh(new T.CylinderGeometry(0.42, 0.42, 0.03, 24), hatM, 0.12, 0.97, 0); brim.rotation.z = -0.15; g.add(brim);
    const cone1 = mesh(new T.ConeGeometry(0.22, 0.42, 16, 1, true), hatM, 0.1, 1.18, 0); cone1.rotation.z = 0.12; g.add(cone1);
    const tip = mesh(new T.ConeGeometry(0.11, 0.34, 12), hatM, -0.02, 1.43, 0); tip.rotation.z = 0.9; g.add(tip);
    const hb = mesh(new T.CylinderGeometry(0.205, 0.215, 0.07, 16, 1, true), band, 0.1, 1.02, 0); hb.rotation.z = 0.12; g.add(hb);
    g.add(mesh(new T.BoxGeometry(0.03, 0.08, 0.08), gold, 0.31, 1.03, 0));
    // capa que ondea (hace de «alas»: el juego la mueve al volar)
    const capes = [];
    const cs = new T.Shape(); cs.moveTo(0, 0.05); cs.lineTo(-0.35, 0.08); cs.quadraticCurveTo(-0.8, 0.04, -1.05, -0.05);
    cs.lineTo(-0.92, -0.14); cs.lineTo(-0.98, -0.24); cs.lineTo(-0.78, -0.22); cs.lineTo(-0.72, -0.34); cs.lineTo(-0.52, -0.28); cs.quadraticCurveTo(-0.2, -0.36, 0, -0.1); cs.lineTo(0, 0.05);
    const cg = new T.ShapeGeometry(cs, 10);
    for (const s of [-1, 1]) {
      const p = new T.Group(); p.position.set(0.04, 0.66, s * 0.08);
      const c = new T.Mesh(cg, capeM); c.rotation.x = s * 0.55; p.add(c); g.add(p); capes.push(p);
    }
    const collar = mesh(new T.TorusGeometry(0.15, 0.04, 6, 16), capeM, 0.08, 0.66, 0); collar.rotation.set(Math.PI / 2, 0.25, 0); g.add(collar);
    g.userData.wings = capes;
    // estela de chispas
    const sp = H.points(24, 0, 0xffd27a, 0.08, () => [-1.8 - Math.random() * 1.2, rnd(-0.2, 0.2), rnd(-0.2, 0.2)]);
    sp.material.sizeAttenuation = true; sp.material.map = H.TEX.soft; sp.material.size = 0.22; sp.material.blending = T.AdditiveBlending; g.add(sp);
    g.scale.setScalar(1.35);
    g.traverse(o => { if (o.isMesh) o.castShadow = false; });
    return g;
  }

  // ---------- galeón pirata de velas negras (en lugar del velero; misma silueta para el choque) ----------
  function makePirate(m) {
    const g = new T.Group(), B = C.BOAT, [hx0, hx1, hy, hz] = B.hull;
    const hull = std(0x5a3418, { roughness: 0.6, emissive: 0x2a1408, emissiveIntensity: 0.6 }), plank = std(0x7a4f2a, { roughness: 0.8, emissive: 0x24140a, emissiveIntensity: 0.5 }), trim = std(0xffc24a, { metalness: 0.6, roughness: 0.3, emissive: 0x6a4a10, emissiveIntensity: 0.8 }),
      black = std(0x141018, { roughness: 0.5 }), deck = std(0x7a5430, { roughness: 0.85 }), glow = basic(0xffc85a, { fog: false }),
      sail = new T.MeshStandardMaterial({ map: sailTex, side: T.DoubleSide, roughness: 0.9, transparent: true, alphaTest: 0.5, emissive: 0x3a2a4a, emissiveIntensity: 0.7 }), flag = new T.MeshStandardMaterial({ map: flagTex, side: T.DoubleSide, roughness: 0.8 });
    // casco: la forma del velero, más alta y con popa elevada
    const shape = new T.Shape();
    shape.moveTo(hx0 - 0.05, hy + 0.35); shape.lineTo(hx0 + 0.3, hy + 0.35); shape.lineTo(hx0 + 0.3, hy); shape.lineTo(hx1, hy + 0.05);
    shape.quadraticCurveTo(hx1 - 0.12, 0.12, hx1 - 0.55, -0.02); shape.lineTo(hx0 + 0.2, -0.02); shape.quadraticCurveTo(hx0 - 0.1, 0.15, hx0 - 0.05, hy + 0.35);
    const hg = new T.ExtrudeGeometry(shape, { depth: hz * 2 - 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 }); hg.translate(0, 0, -(hz - 0.04));
    g.add(new T.Mesh(hg, hull));
    for (const y of [hy - 0.08, 0.2]) g.add(mesh(new T.BoxGeometry(hx1 - hx0 - 0.4, 0.05, hz * 2 + 0.04), trim, (hx0 + hx1) / 2 - 0.1, y, 0));
    g.add(mesh(new T.BoxGeometry(hx1 - hx0 - 0.45, 0.04, hz * 2 - 0.08), deck, (hx0 + hx1) / 2 + 0.15, hy + 0.01, 0));
    // cañones asomando por las troneras y ventanas de popa encendidas
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const x = -0.55 + i * 0.6; g.add(mesh(new T.BoxGeometry(0.16, 0.12, 0.02), black, x, 0.34, s * (hz + 0.03)));
      const c = mesh(new T.CylinderGeometry(0.035, 0.045, 0.2, 8), black, x, 0.34, s * (hz + 0.1)); c.rotation.x = Math.PI / 2; g.add(c);
    }
    for (let i = 0; i < 3; i++) g.add(mesh(new T.PlaneGeometry(0.1, 0.12), glow, hx0 - 0.08, hy + 0.15, (i - 1) * 0.22).rotateY(-Math.PI / 2));
    // barandillas
    for (const s of [-1, 1]) g.add(mesh(new T.BoxGeometry(hx1 - hx0 - 0.5, 0.06, 0.03), plank, (hx0 + hx1) / 2 + 0.2, hy + 0.16, s * (hz - 0.02)));
    // bauprés y farol de popa
    const bow = mesh(new T.CylinderGeometry(0.025, 0.04, 0.9, 6), plank, hx1 + 0.3, hy + 0.2, 0); bow.rotation.z = -1.2; g.add(bow);
    // faroles (con halo para que el barco se vea de noche)
    for (const [x, y] of [[hx0 + 0.05, hy + 0.55], [hx1 + 0.05, hy + 0.3], [0, 2.75]]) {
      g.add(mesh(new T.SphereGeometry(0.07, 10, 8), glow, x, y, 0));
      const h = new T.Sprite(new T.SpriteMaterial({ map: H.TEX.soft, color: 0xffb040, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false, fog: false })); h.scale.set(0.9, 0.9, 1); h.position.set(x, y, 0); g.add(h);
    }
    // mástiles con vergas y velas cuadradas negras (curvadas por el viento)
    // vela cuadrada hinchada, con la verga girada (así se ve bien desde el costado)
    const sq = (w, h, x, y) => { const rig = new T.Group(); rig.position.set(x, y, 0); rig.rotation.y = Math.PI / 2 - 0.75; g.add(rig);
      const geo = new T.PlaneGeometry(w, h, 8, 6); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const u = p.getX(i) / w, v = p.getY(i) / h; p.setZ(i, (1 - 4 * u * u) * 0.22 * (0.6 + 0.4 * Math.cos(v * Math.PI))); } geo.computeVertexNormals();
      rig.add(mesh(geo, sail, 0, 0, 0.03)); const yard = mesh(new T.CylinderGeometry(0.025, 0.025, w + 0.2, 6), plank, 0, h / 2, 0); yard.rotation.z = Math.PI / 2; rig.add(yard);
      const yard2 = yard.clone(); yard2.position.y = -h / 2; rig.add(yard2); };
    const masts = [[0, 3.6, [[1.55, 1.05, 1.85], [1.25, 0.8, 2.85]]], [1.0, 3.0, [[1.3, 0.9, 1.75], [1.0, 0.6, 2.5]]], [-1.05, 2.8, [[1.0, 0.75, 2.0]]]];
    for (const [x, h, sails] of masts) {
      g.add(mesh(new T.CylinderGeometry(0.035, 0.05, h - hy, 8), plank, x, (h + hy) / 2, 0));
      for (const [w, sh, y] of sails) sq(w, sh, x + 0.02, y);
    }
    const nest = mesh(new T.CylinderGeometry(0.15, 0.12, 0.14, 10, 1, true), plank, 0, 2.35, 0); g.add(nest);
    const fl = mesh(new T.PlaneGeometry(0.7, 0.52, 4, 1), flag, -0.35, 3.8, 0); g.add(fl); g.userData.flag = fl;
    // castillo de popa con galería dorada y ventanas encendidas
    g.add(mesh(new T.BoxGeometry(0.5, 0.32, hz * 2 + 0.06), hull, hx0 + 0.2, hy + 0.5, 0));
    g.add(mesh(new T.BoxGeometry(0.54, 0.04, hz * 2 + 0.1), trim, hx0 + 0.2, hy + 0.67, 0));
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) g.add(mesh(new T.PlaneGeometry(0.09, 0.12), glow, hx0 + 0.08 + i * 0.2, hy + 0.48, s * (hz + 0.035)).rotateY(s > 0 ? 0 : Math.PI));
    // mascarón de proa
    const fig = mesh(new T.ConeGeometry(0.06, 0.28, 8), trim, hx1 - 0.02, hy - 0.02, 0); fig.rotation.z = -1.1; g.add(fig);
    // las 2 bolas del premio en cubierta
    g.userData.balls = [];
    (m.balls || ['r', 'b']).forEach((k, i) => {
      const mat = H.ballMaterial(k).clone(); mat.fog = false;
      if (mat.emissive && H.COL[k]) { mat.emissive.set(H.COL[k]); mat.emissiveIntensity = 0.3; }
      const b = mesh(new T.SphereGeometry(B.ballR, 20, 14), mat, B.ballX[i] || 0, B.ballY, 0); g.add(b); g.userData.balls.push(b);
    });
    g.scale.setScalar(C.SHIP_S);
    g.traverse(o => { if (o.isMesh) { o.castShadow = false; if (!g.userData.balls.includes(o)) o.material.fog = false; } });
    return g;
  }

  // ---------- caramelos que se recogen en la partida ----------
  function candyCane() {
    const path = new T.CurvePath();
    path.add(new T.LineCurve3(new T.Vector3(0, -0.45, 0), new T.Vector3(0, 0.15, 0)));
    path.add(new T.QuadraticBezierCurve3(new T.Vector3(0, 0.15, 0), new T.Vector3(0, 0.5, 0), new T.Vector3(0.25, 0.45, 0)));
    path.add(new T.QuadraticBezierCurve3(new T.Vector3(0.25, 0.45, 0), new T.Vector3(0.42, 0.4, 0), new T.Vector3(0.4, 0.2, 0)));
    const g = new T.Group(); g.add(new T.Mesh(new T.TubeGeometry(path, 40, 0.075, 10, false), MAT.cane));
    return g;
  }
  function wrapped(col) {
    const g = new T.Group(), m = std(col, { roughness: 0.25 });
    const c = mesh(new T.SphereGeometry(0.2, 14, 10), m); c.scale.set(1.3, 1, 1); g.add(c);
    for (const s of [-1, 1]) { const e = mesh(new T.ConeGeometry(0.16, 0.22, 8), m, s * 0.33, 0, 0); e.rotation.z = s * Math.PI / 2; g.add(e); }
    return g;
  }
  // Bloques de caramelo: durante el evento, algunos bloques que dan la cara al cañón se vuelven caramelos
  // (rayas blancas en espiral sobre su color, con brillo). Dos tipos: «caramelo» (lazos de envoltorio a los lados, 1 🍬)
  // y «bastón» (un bastón de caramelo colgado del borde de delante, 2 🍬). Si el bloque revienta o cae, son tuyos.
  const stripeTex = {};
  function candyStripes(c) {
    if (stripeTex[c]) return stripeTex[c];
    const base = '#' + (H.COL[c] || 0xffffff).toString(16).padStart(6, '0');
    return (stripeTex[c] = H.canvasTex(256, 256, (g) => {
      g.fillStyle = base; g.fillRect(0, 0, 256, 256); g.fillStyle = '#ffffff';
      for (let k = -4; k < 8; k++) { g.beginPath(); g.moveTo(k * 64, 0); g.lineTo(k * 64 + 26, 0); g.lineTo(k * 64 + 26 - 256, 256); g.lineTo(k * 64 - 256, 256); g.fill(); }
      const gr = g.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    }, true));
  }
  const sparkMat = new T.SpriteMaterial({ map: H.TEX.soft, color: 0xffffff, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
  function hangingCane(w, h, d) {
    const s = Math.min(w, h), x = w * 0.3, zf = d / 2 + 0.07 * s;
    const p = new T.CurvePath();
    p.add(new T.LineCurve3(new T.Vector3(x, -h * 0.18, zf), new T.Vector3(x, h * 0.48, zf)));
    p.add(new T.QuadraticBezierCurve3(new T.Vector3(x, h * 0.48, zf), new T.Vector3(x, h * 0.5 + 0.22 * s, zf - 0.05 * s), new T.Vector3(x, h * 0.5 + 0.08 * s, zf - 0.26 * s)));
    p.add(new T.LineCurve3(new T.Vector3(x, h * 0.5 + 0.08 * s, zf - 0.26 * s), new T.Vector3(x, h * 0.5 - 0.02 * s, zf - 0.3 * s)));
    return new T.Mesh(new T.TubeGeometry(p, 40, 0.075 * s, 10, false), MAT.cane);
  }
  function decorate(G, n) {
    const sim = G.sim; G.candies = []; G.candyHosts = 0; if (!sim) return;
    const ok = b => { const d = b.userData; return d.c && d.kind === 'block' && !d.stripe && !d.bomb && !d.cham && !d.float && !d.ice && G.meshes[d.id]; };
    const blocks = sim.blocks.filter(ok);
    // solo los que dan la cara al cañón (no hay nada delante), repartidos por toda la estructura
    const all = sim.blocks.filter(b => b.userData.alive !== false);
    let front = blocks.filter(b => !all.some(o => o !== b && o.position.z > b.position.z + 0.3 && Math.abs(o.position.x - b.position.x) < 0.5 && Math.abs(o.position.y - b.position.y) < 0.5));
    if (!front.length) front = blocks;
    front.sort((a, b) => (a.position.y - b.position.y) || (a.position.x - b.position.x));
    const idx = [...new Set(Array.from({ length: Math.min(n, front.length) }, (_, i) => Math.round((i + 0.5) / n * (front.length - 1) + (Math.random() - 0.5) * front.length / (n * 2))))];
    idx.forEach((k, i) => {
      const b = front[Math.max(0, Math.min(front.length - 1, k))], d = b.userData, host = G.meshes[d.id];
      if (!host || G.candies.some(c => c.id === d.id)) return;
      let body = null; host.traverse(o => { if (!body && o.isMesh && o.material && !o.material.transparent) body = o; });
      if (body) { body.material = body.material.clone(); body.material.map = candyStripes(d.c); body.material.color.set(0xffffff); body.material.needsUpdate = true; }
      const deco = new T.Group(), cane = i % 2 === 0, sz = Math.min(d.w, d.h);
      if (cane) deco.add(hangingCane(d.w, d.h, d.d));
      else for (const s of [-1, 1]) { const tw = mesh(new T.ConeGeometry(0.2 * sz, 0.32 * sz, 10), std(H.COL[d.c], { roughness: 0.25, emissive: H.COL[d.c], emissiveIntensity: 0.15 }), s * (d.w / 2 + 0.1 * sz), 0, 0); tw.rotation.z = s * Math.PI / 2; tw.scale.z = 0.55; deco.add(tw); }
      const sp = new T.Sprite(sparkMat.clone()); sp.scale.set(0.5 * sz, 0.5 * sz, 1); sp.position.set(-d.w * 0.3, d.h * 0.3, d.d / 2 + 0.05); deco.add(sp); deco.userData.spark = sp;
      deco.userData.ph = i * 1.7; host.add(deco);
      G.candies.push({ id: d.id, mesh: deco, n: cane ? 2 : 1 });
    });
    G.candyHosts = G.candies.length;
    if (H.chip) H.chip();
  }
  const _v = new T.Vector3();
  // bruja que cruza la portada riéndose
  const TW = { g: null, t0: -99 };
  function titleWitch(G) {
    const on = G.mode === 'title' && G.hwWorld;
    if (!on) { if (TW.g) TW.g.visible = false; return; }
    if (!TW.g) { TW.g = makeWitch(); TW.g.scale.setScalar(3.4); H.scene.add(TW.g); TW.t0 = G.t - 6; }
    const e = G.t - TW.t0, dur = 7.5;
    if (e > dur + 2.5) { TW.t0 = G.t; TW.dir = Math.random() < 0.5 ? 1 : -1; if (X.Audio && X.Audio.cackle) X.Audio.cackle(); }
    const k = (G.t - TW.t0) / dur, dir = TW.dir || 1;
    TW.g.visible = k >= 0 && k <= 1;
    if (!TW.g.visible) return;
    TW.g.position.set(dir * (-40 + k * 80) - 6, 16 + Math.sin(k * Math.PI * 3) * 2 - k * 3, -62);
    TW.g.rotation.set(0, dir > 0 ? -0.15 : Math.PI + 0.15, Math.sin(G.t * 2) * 0.06);
    const f = Math.sin(G.t * 10) * 0.5; TW.g.userData.wings[0].rotation.x = -0.4 - f; TW.g.userData.wings[1].rotation.x = 0.4 + f;
  }
  // cámara de la portada: mira al castillo, con un vaivén suave
  function titleCam(cam, t) {
    cam.position.set(Math.sin(t * 0.07) * 2, 3, -20);
    cam.lookAt(-18 + Math.sin(t * 0.05) * 1.5, 30, -128);
  }
  function tick(G, dt) {
    for (const g of (G.moverMeshes ? G.moverMeshes.values() : [])) {
      if (g.userData.hair) g.userData.hair.forEach((h, i) => { h.rotation.y = Math.sin(G.t * 9 + i) * 0.18; });
      if (g.userData.flag) g.userData.flag.rotation.y = Math.sin(G.t * 4) * 0.25;
    }
    if (TW.g || G.mode === 'title') titleWitch(G);
    if (!G.candies || !G.candies.length) return;
    const sim = G.sim;
    for (let i = G.candies.length - 1; i >= 0; i--) {
      const c = G.candies[i];
      const sp = c.mesh.userData.spark; if (sp) { const k = Math.max(0, Math.sin(G.t * 2.4 + c.mesh.userData.ph)); sp.material.opacity = k * k; sp.material.rotation = G.t; }
      if (G.mode !== 'play' || !sim || G.demo) continue;
      const b = sim.blocks[c.id], d = b && b.userData;
      const gone = !d || d.alive === false || d.destroyed || (d.hy != null && b.position.y < d.hy - 0.45);
      if (!gone) continue;
      c.mesh.getWorldPosition(_v);
      if (c.mesh.parent) c.mesh.parent.remove(c.mesh);
      G.candies.splice(i, 1);
      if (H.active && H.active()) H.collect(c.n, _v.x, _v.y, _v.z);
    }
  }

  window.Halloween = { build, makeWitch, makePirate, decorate, tick, titleCam, pumpkin };
  // la portada ya se pintó antes de cargar este archivo: se vuelve a abrir con el castillo
  if (X.G.mode === 'title' && H.active && H.active() && X.goTitle) X.goTitle();
})();
