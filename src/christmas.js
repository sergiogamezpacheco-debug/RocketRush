// Rocket Rush — evento de Navidad: pueblo nevado de noche (árbol gigante, casas con luces en la ladera, luna y nieve),
// plataforma de hielo con bastones de caramelo, el trineo de Papá Noel con sus renos (en lugar del pájaro y en la portada),
// bloques envueltos para regalo que llevan caramelos de menta (1) o bastones (2) y los jefes de Navidad:
// Cascanueces (gólem), Caja Sorpresa (faraón) y Capitán Escarcha (barco). Usa las piezas del motor de RRGame.hw.
(function () {
  'use strict';
  const X = window.RRGame;
  if (!X || !X.hw) return;
  const H = X.hw, T = H.THREE, C = H.C, TAU = Math.PI * 2, Y0 = C.SEA_Y;
  let seed = 11; const rnd = (a, b) => { seed = (seed * 16807) % 2147483647; return a + (seed / 2147483647) * (b - a); };
  const std = (color, o) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.7 }, o || {}));
  const basic = (color, o) => new T.MeshBasicMaterial(Object.assign({ color }, o || {}));
  const mesh = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); return m; };
  const tex = (w, h, draw) => H.canvasTex(w, h, draw, true);
  const glowSprite = (col, s, op, normal) => { const sp = new T.Sprite(new T.SpriteMaterial({ map: H.TEX.soft, color: col, transparent: true, opacity: op == null ? 0.8 : op, depthWrite: false, blending: normal ? T.NormalBlending : T.AdditiveBlending, fog: false })); sp.scale.set(s, s, 1); return sp; };

  // ---------- texturas y materiales ----------
  const caneTex = tex(128, 32, g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 32); g.fillStyle = '#e8203a'; for (let i = -2; i < 12; i++) { g.beginPath(); g.moveTo(i * 16, 32); g.lineTo(i * 16 + 8, 32); g.lineTo(i * 16 + 20, 0); g.lineTo(i * 16 + 12, 0); g.fill(); } });
  caneTex.wrapS = caneTex.wrapT = T.RepeatWrapping;
  const caneMats = {};
  const caneMat = rep => { rep = Math.max(1, Math.round(rep || 4)); if (caneMats[rep]) return caneMats[rep]; const t = caneTex.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep, 1); return (caneMats[rep] = new T.MeshStandardMaterial({ map: t, roughness: 0.25 })); };
  const snowTex = tex(256, 256, g => { g.fillStyle = '#eef4ff'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${170 + rnd(0, 60)},${190 + rnd(0, 50)},255,${rnd(0.05, 0.25)})`; g.fillRect(rnd(0, 256), rnd(0, 256), rnd(1, 4), rnd(1, 4)); } for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(rnd(0, 256), rnd(0, 256), 2, 2); } });
  snowTex.wrapS = snowTex.wrapT = T.RepeatWrapping;
  const M = {
    snow: new T.MeshStandardMaterial({ map: snowTex, roughness: 0.95 }), ice: std(0xbfe6ff, { roughness: 0.15, metalness: 0.1, flatShading: true }),
    pine: std(0x1f6a44, { roughness: 0.8, flatShading: true }), pineD: std(0x15523a, { roughness: 0.85, flatShading: true }), bark: std(0x5a3a22, { roughness: 1 }),
    gold: std(0xffc83d, { metalness: 0.8, roughness: 0.25, emissive: 0x3a2400 }), red: std(0xd8203a, { roughness: 0.35 }), green: std(0x1f8a4a, { roughness: 0.4 }),
    win: basic(0xffc46a, { fog: false }), white: std(0xffffff, { roughness: 0.6 }), black: basic(0x15121c), coal: std(0x1a1820, { roughness: 0.9 }),
    carrot: std(0xff8a1a, { roughness: 0.5 }), skin: std(0xffc8a8, { roughness: 0.6 }), fur: std(0x8a5530, { roughness: 0.85 }), furL: std(0xd8b48a, { roughness: 0.85 }), antler: std(0xe8d2a8, { roughness: 0.7 }),
  };
  const bulbCols = [0xff3a4a, 0x3aff7a, 0xffd23a, 0x3ab4ff, 0xff7af0];
  const bulbMats = bulbCols.map(c => basic(c, { fog: false }));

  // ---------- piezas ----------
  function star(r, mat, depth) {
    const s = new T.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    const m = new T.Mesh(new T.ExtrudeGeometry(s, { depth: depth || r * 0.35, bevelEnabled: true, bevelThickness: r * 0.08, bevelSize: r * 0.08, bevelSegments: 2 }), mat); m.geometry.center(); return m;
  }
  function pine(h, o) {
    o = o || {}; const g = new T.Group(), r = h * 0.36;
    g.add(mesh(new T.CylinderGeometry(r * 0.12, r * 0.16, h * 0.2, 7), M.bark, 0, h * 0.1, 0));
    const tiers = o.tiers || 4;
    for (let i = 0; i < tiers; i++) {
      const k = i / tiers, tr = r * (1 - k * 0.62), th = h * 0.42, y = h * 0.16 + k * h * 0.62, ry = rnd(0, 3);
      const c = mesh(new T.ConeGeometry(tr, th, 9), i % 2 ? M.pineD : M.pine, 0, y + th / 2, 0); c.rotation.y = ry; g.add(c);
      const s = mesh(new T.ConeGeometry(tr * 0.72, th * 0.42, 9), M.snow, 0, y + th * 0.79, 0); s.rotation.y = ry; g.add(s);
      if (o.lights) for (let j = 0; j < 7 + (tiers - i) * 2; j++) { const a = rnd(0, TAU), yy = rnd(0.05, 0.6), rr = tr * (1 - yy) * 0.98; g.add(mesh(new T.SphereGeometry(h * 0.012 + 0.05, 6, 5), bulbMats[(j + i) % 5], Math.cos(a) * rr, y + yy * th, Math.sin(a) * rr)); }
    }
    if (o.star) { const st = star(h * 0.07, M.gold); st.position.y = h * 1.18; g.add(st); const gl = glowSprite(0xffe27a, h * 0.35, 0.75); gl.position.copy(st.position); g.add(gl); g.userData.glow = gl; }
    return g;
  }
  const giftTex = {};
  function wrapTex(base, style, ribbon) {
    const k = base + style + ribbon; if (giftTex[k]) return giftTex[k];
    return (giftTex[k] = tex(256, 256, g => {
      g.fillStyle = base; g.fillRect(0, 0, 256, 256);
      if (style === 'flakes') { g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3; g.lineCap = 'round'; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const cx = x * 64 + (y % 2) * 32 + 16, cy = y * 64 + 22; for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; g.beginPath(); g.moveTo(cx - Math.cos(a) * 11, cy - Math.sin(a) * 11); g.lineTo(cx + Math.cos(a) * 11, cy + Math.sin(a) * 11); g.stroke(); } } }
      if (style === 'dots') { g.fillStyle = 'rgba(255,255,255,.85)'; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.beginPath(); g.arc(x * 32 + (y % 2) * 16 + 8, y * 32 + 16, 5, 0, TAU); g.fill(); } }
      g.fillStyle = ribbon; g.fillRect(108, 0, 40, 256); g.fillRect(0, 108, 256, 40);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(112, 0, 6, 256); g.fillRect(0, 112, 256, 6);
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(142, 0, 6, 256); g.fillRect(0, 142, 256, 6);
      const gr = g.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0, 'rgba(255,255,255,.28)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    }));
  }
  function bow(s, mat) {
    const g = new T.Group();
    for (const sx of [-1, 1]) { const l = mesh(new T.TorusGeometry(0.22 * s, 0.07 * s, 8, 16), mat, sx * 0.2 * s, 0.12 * s, 0); l.rotation.set(0, sx * 0.5, sx * 0.6); l.scale.set(1, 0.75, 0.6); g.add(l); }
    g.add(mesh(new T.SphereGeometry(0.1 * s, 10, 8), mat, 0, 0.06 * s, 0));
    for (const sx of [-1, 1]) { const t = mesh(new T.BoxGeometry(0.1 * s, 0.03 * s, 0.4 * s), mat, sx * 0.1 * s, 0, 0.18 * s); t.rotation.y = sx * 0.5; g.add(t); }
    return g;
  }
  function giftBox(w, h, d, col, style) {
    const g = new T.Group();
    g.add(mesh(new T.BoxGeometry(w, h, d), new T.MeshStandardMaterial({ map: wrapTex(col, style || 'plain', '#ffd86a'), roughness: 0.45 }), 0, h / 2, 0));
    const b = bow(Math.min(w, d) * 0.9, M.gold); b.position.y = h; g.add(b);
    return g;
  }
  function house(w, h, d, wall, roof) {
    const g = new T.Group();
    g.add(mesh(new T.BoxGeometry(w, h, d), std(wall, { roughness: 0.85 }), 0, h / 2, 0));
    const rs = new T.Shape(); rs.moveTo(-w / 2 - 0.35, 0); rs.lineTo(0, h * 0.7); rs.lineTo(w / 2 + 0.35, 0); rs.lineTo(-w / 2 - 0.35, 0);
    const r = new T.Mesh(new T.ExtrudeGeometry(rs, { depth: d + 0.5, bevelEnabled: false }), std(roof, { roughness: 0.8, flatShading: true })); r.position.set(0, h, -d / 2 - 0.25); g.add(r);
    const ss = new T.Shape(); ss.moveTo(-w / 2 - 0.45, -0.05); ss.lineTo(0, h * 0.7 + 0.25); ss.lineTo(w / 2 + 0.45, -0.05); ss.lineTo(w / 2 + 0.1, -0.05); ss.lineTo(0, h * 0.7 - 0.1); ss.lineTo(-w / 2 - 0.1, -0.05);
    const sn = new T.Mesh(new T.ExtrudeGeometry(ss, { depth: d + 0.7, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 2 }), M.snow); sn.position.set(0, h + 0.02, -d / 2 - 0.35); g.add(sn);
    g.add(mesh(new T.BoxGeometry(w * 0.16, h * 0.55, w * 0.16), std(0x8a3a2a, { roughness: 0.9 }), w * 0.24, h + h * 0.45, -d * 0.15));
    g.add(mesh(new T.BoxGeometry(w * 0.2, 0.2, w * 0.2), M.snow, w * 0.24, h + h * 0.73, -d * 0.15));
    for (const x of [-w * 0.28, w * 0.28]) { g.add(mesh(new T.PlaneGeometry(w * 0.2, h * 0.28), M.win, x, h * 0.55, d / 2 + 0.01)); g.add(mesh(new T.BoxGeometry(w * 0.26, 0.08, 0.12), M.snow, x, h * 0.38, d / 2 + 0.05)); }
    g.add(mesh(new T.PlaneGeometry(w * 0.2, h * 0.42), std(0x5a2a1a), 0, h * 0.21, d / 2 + 0.01));
    g.add(mesh(new T.TorusGeometry(w * 0.07, w * 0.025, 6, 14), M.green, 0, h * 0.32, d / 2 + 0.04));
    for (let i = 0; i <= 10; i++) { const t = i / 10; for (const sx of [-1, 1]) g.add(mesh(new T.SphereGeometry(0.09, 6, 5), bulbMats[(i + (sx > 0 ? 2 : 0)) % 5], sx * (w / 2 + 0.3) * (1 - t), h + t * h * 0.7 - 0.05, d / 2 + 0.3)); }
    const gl = glowSprite(0xffb050, w * 1.4, 0.35); gl.position.set(0, h * 0.55, d / 2 + 0.4); g.add(gl);
    return g;
  }
  function cane(h, r) {
    const p = new T.CurvePath(); p.add(new T.LineCurve3(new T.Vector3(0, 0, 0), new T.Vector3(0, h * 0.78, 0)));
    p.add(new T.QuadraticBezierCurve3(new T.Vector3(0, h * 0.78, 0), new T.Vector3(0, h, 0), new T.Vector3(h * 0.16, h, 0)));
    p.add(new T.QuadraticBezierCurve3(new T.Vector3(h * 0.16, h, 0), new T.Vector3(h * 0.32, h, 0), new T.Vector3(h * 0.32, h * 0.84, 0)));
    return new T.Mesh(new T.TubeGeometry(p, 60, r || h * 0.045, 12), caneMat(h * 1.4));
  }
  function snowman(s) {
    const g = new T.Group();
    g.add(mesh(new T.SphereGeometry(0.9 * s, 16, 12), M.snow, 0, 0.8 * s, 0), mesh(new T.SphereGeometry(0.65 * s, 16, 12), M.snow, 0, 2.0 * s, 0), mesh(new T.SphereGeometry(0.46 * s, 16, 12), M.snow, 0, 2.9 * s, 0));
    for (const sx of [-1, 1]) g.add(mesh(new T.SphereGeometry(0.06 * s, 6, 5), M.coal, sx * 0.16 * s, 3.0 * s, 0.4 * s));
    const n = mesh(new T.ConeGeometry(0.08 * s, 0.45 * s, 8), M.carrot, 0, 2.88 * s, 0.6 * s); n.rotation.x = Math.PI / 2; g.add(n);
    for (let i = 0; i < 3; i++) g.add(mesh(new T.SphereGeometry(0.07 * s, 6, 5), M.coal, 0, (1.75 + i * 0.25) * s, 0.62 * s));
    const sc = mesh(new T.TorusGeometry(0.46 * s, 0.13 * s, 8, 20), M.red, 0, 2.55 * s, 0); sc.rotation.x = Math.PI / 2; g.add(sc);
    g.add(mesh(new T.CylinderGeometry(0.42 * s, 0.42 * s, 0.06 * s, 18), M.coal, 0, 3.3 * s, 0), mesh(new T.CylinderGeometry(0.28 * s, 0.3 * s, 0.5 * s, 16), M.coal, 0, 3.58 * s, 0));
    return g;
  }
  function bigTree(h) {
    const g = pine(h, { tiers: 6, lights: true, star: true });
    const balls = [M.red, M.gold, std(0x2a6aff, { metalness: 0.5, roughness: 0.25 }), std(0xc8c8d8, { metalness: 0.8, roughness: 0.2 })];
    for (let i = 0; i < 40; i++) { const k = rnd(0.08, 0.85), y = h * 0.16 + k * h * 0.78, rr = h * 0.36 * (1 - k * 0.9) * 0.95, a = rnd(0, TAU); g.add(mesh(new T.SphereGeometry(h * 0.018, 10, 8), balls[i % 4], Math.cos(a) * rr, y, Math.sin(a) * rr)); }
    const pts = []; for (let i = 0; i <= 120; i++) { const k = i / 120, y = h * 0.2 + k * h * 0.72, rr = h * 0.36 * (1 - k * 0.92) * 1.02 + 0.2; pts.push(new T.Vector3(Math.cos(k * TAU * 4.5) * rr, y, Math.sin(k * TAU * 4.5) * rr)); }
    g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 400, h * 0.006 + 0.04, 6), std(0xffd86a, { metalness: 0.9, roughness: 0.2, emissive: 0x4a3000 })));
    for (let i = 0; i < 9; i++) { const a = rnd(0, TAU), d = rnd(h * 0.1, h * 0.28); const b = giftBox(rnd(1, 2.2), rnd(0.8, 1.6), rnd(1, 2), ['#d8203a', '#1f8a4a', '#2a6aff', '#ffc83d', '#a66bff'][i % 5]); b.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); b.rotation.y = rnd(0, 3); g.add(b); }
    return g;
  }

  // ---------- trineo de Papá Noel con renos ----------
  function reindeer() {
    const g = new T.Group();
    const body = mesh(new T.SphereGeometry(0.5, 14, 10), M.fur); body.scale.set(1.25, 0.62, 0.55); g.add(body);
    const belly = mesh(new T.SphereGeometry(0.42, 12, 8), M.furL, 0.05, -0.1, 0); belly.scale.set(1.1, 0.5, 0.5); g.add(belly);
    const neck = mesh(new T.CylinderGeometry(0.13, 0.2, 0.55, 8), M.fur, 0.55, 0.28, 0); neck.rotation.z = -0.7; g.add(neck);
    const head = mesh(new T.SphereGeometry(0.2, 12, 10), M.fur, 0.78, 0.52, 0); head.scale.set(1.3, 0.95, 0.9); g.add(head);
    const snout = mesh(new T.SphereGeometry(0.12, 10, 8), M.furL, 0.98, 0.46, 0); snout.scale.set(1.2, 0.8, 0.9); g.add(snout);
    g.add(mesh(new T.SphereGeometry(0.06, 8, 6), M.coal, 1.1, 0.48, 0));
    for (const s of [-1, 1]) {
      g.add(mesh(new T.SphereGeometry(0.035, 6, 5), M.black, 0.86, 0.6, s * 0.13));
      const ear = mesh(new T.ConeGeometry(0.05, 0.18, 6), M.fur, 0.7, 0.66, s * 0.15); ear.rotation.x = s * 0.9; g.add(ear);
      g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(0.72, 0.66, s * 0.08), new T.Vector3(0.66, 0.9, s * 0.2), new T.Vector3(0.58, 1.12, s * 0.3)]), 10, 0.028, 5), M.antler));
      for (const [p0, p1] of [[[0.66, 0.9, s * 0.2], [0.82, 1.06, s * 0.24]], [[0.6, 1.04, s * 0.27], [0.72, 1.2, s * 0.3]]]) g.add(new T.Mesh(new T.TubeGeometry(new T.LineCurve3(new T.Vector3(...p0), new T.Vector3(...p1)), 2, 0.022, 5), M.antler));
    }
    const harness = mesh(new T.TorusGeometry(0.33, 0.045, 6, 18), M.red, 0.32, 0.02, 0); harness.rotation.y = Math.PI / 2; harness.scale.set(0.75, 1.05, 1); g.add(harness);
    for (const s of [-1, 1]) g.add(mesh(new T.SphereGeometry(0.06, 8, 6), M.gold, 0.32, -0.2, s * 0.22));
    g.add(mesh(new T.SphereGeometry(0.09, 8, 6), M.white, -0.6, 0.1, 0));
    g.userData.legs = [];
    for (const [x, z] of [[0.38, 0.14], [0.38, -0.14], [-0.38, 0.14], [-0.38, -0.14]]) {
      const p = new T.Group(); p.position.set(x, -0.18, z);
      p.add(mesh(new T.CylinderGeometry(0.05, 0.04, 0.55, 6), M.fur, 0, -0.27, 0)); p.add(mesh(new T.CylinderGeometry(0.05, 0.06, 0.08, 6), M.coal, 0, -0.56, 0));
      g.add(p); g.userData.legs.push(p);
    }
    return g;
  }
  function makeSleigh() {
    const g = new T.Group(), body = new T.Group(); g.add(body);
    const sh = new T.Shape();
    sh.moveTo(-1.1, 0); sh.lineTo(0.9, 0); sh.quadraticCurveTo(1.4, 0, 1.45, 0.5); sh.quadraticCurveTo(1.5, 1.05, 1.12, 1.08); sh.quadraticCurveTo(1.32, 0.74, 0.98, 0.6);
    sh.lineTo(-0.55, 0.6); sh.quadraticCurveTo(-0.85, 0.62, -0.92, 1.22); sh.quadraticCurveTo(-1.32, 1.3, -1.34, 0.85); sh.quadraticCurveTo(-1.35, 0.2, -1.1, 0);
    const hull = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: 1.0, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 3 }), std(0xd8203a, { roughness: 0.3, metalness: 0.1 }));
    hull.position.z = -0.5; body.add(hull);
    for (const z of [0.58, -0.58]) {
      body.add(mesh(new T.BoxGeometry(2.3, 0.07, 0.03), M.gold, 0.05, 0.3, z));
      const sw = new T.Mesh(new T.TorusGeometry(0.16, 0.035, 6, 16, Math.PI * 1.5), M.gold); sw.position.set(1.18, 0.82, z); body.add(sw);
      const rp = new T.CurvePath(); rp.add(new T.LineCurve3(new T.Vector3(-1.4, -0.45, z * 0.75), new T.Vector3(1.35, -0.45, z * 0.75))); rp.add(new T.QuadraticBezierCurve3(new T.Vector3(1.35, -0.45, z * 0.75), new T.Vector3(2.0, -0.45, z * 0.75), new T.Vector3(1.85, 0.15, z * 0.75)));
      body.add(new T.Mesh(new T.TubeGeometry(rp, 30, 0.05, 6), M.gold));
      for (const x of [-0.8, 0.7]) body.add(mesh(new T.CylinderGeometry(0.03, 0.03, 0.46, 6), M.gold, x, -0.22, z * 0.75));
    }
    const sack = mesh(new T.SphereGeometry(0.55, 14, 10), std(0x7a4a2a, { roughness: 0.95 }), -0.75, 1.05, 0); sack.scale.set(0.9, 1.05, 0.95); body.add(sack);
    for (const [x, y, z, c] of [[-0.95, 1.55, 0.15, '#2a6aff'], [-0.6, 1.6, -0.15, '#1f8a4a'], [-0.85, 1.65, -0.25, '#ffc83d']]) { const b = giftBox(0.36, 0.3, 0.36, c); b.position.set(x, y - 0.1, z); b.rotation.set(0.3, 0.5, 0.2); body.add(b); }
    const suit = std(0xd8203a, { roughness: 0.45 });
    const torso = mesh(new T.SphereGeometry(0.5, 16, 12), suit, 0.15, 0.95, 0); torso.scale.set(0.95, 1.05, 0.95); body.add(torso);
    const belt = mesh(new T.TorusGeometry(0.47, 0.06, 6, 24), M.coal, 0.15, 0.78, 0); belt.rotation.x = Math.PI / 2; body.add(belt);
    body.add(mesh(new T.BoxGeometry(0.06, 0.16, 0.18), M.gold, 0.62, 0.78, 0));
    body.add(mesh(new T.SphereGeometry(0.27, 16, 12), M.skin, 0.2, 1.62, 0));
    const beard = mesh(new T.SphereGeometry(0.3, 14, 10, 0, TAU, Math.PI * 0.35, Math.PI * 0.65), M.white, 0.27, 1.6, 0); beard.scale.set(0.9, 1.25, 1.05); body.add(beard);
    for (const s of [-1, 1]) { const mo = mesh(new T.SphereGeometry(0.1, 8, 6), M.white, 0.45, 1.6, s * 0.09); mo.scale.set(0.7, 0.55, 1.2); body.add(mo); body.add(mesh(new T.SphereGeometry(0.035, 6, 5), M.black, 0.43, 1.72, s * 0.1)); body.add(mesh(new T.BoxGeometry(0.03, 0.03, 0.1), M.white, 0.44, 1.79, s * 0.1)); }
    body.add(mesh(new T.SphereGeometry(0.06, 8, 6), std(0xff8a8a), 0.47, 1.66, 0));
    const hat = mesh(new T.ConeGeometry(0.27, 0.6, 14), suit, 0.08, 1.98, 0); hat.rotation.z = 0.55; body.add(hat);
    const brim = mesh(new T.TorusGeometry(0.25, 0.07, 8, 18), M.white, 0.18, 1.82, 0); brim.rotation.x = Math.PI / 2; brim.rotation.y = 0.3; body.add(brim);
    body.add(mesh(new T.SphereGeometry(0.1, 8, 6), M.white, -0.18, 2.12, 0));
    for (const s of [-1, 1]) {
      const A = new T.Vector3(0.22, 1.2, s * 0.42), B = new T.Vector3(0.78, 1.0, s * 0.3);
      const arm = new T.Mesh(new T.CylinderGeometry(0.11, 0.12, A.distanceTo(B), 8), suit); arm.position.copy(A).add(B).multiplyScalar(0.5); arm.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), B.clone().sub(A).normalize()); body.add(arm);
      body.add(mesh(new T.TorusGeometry(0.1, 0.04, 6, 12), M.white, 0.78, 1.0, s * 0.3).rotateY(Math.PI / 2)); body.add(mesh(new T.SphereGeometry(0.09, 8, 6), M.coal, 0.86, 0.98, s * 0.28));
    }
    g.userData.deer = [];
    for (let i = 0; i < 2; i++) for (const s of [-1, 1]) { const r = reindeer(); r.position.set(2.5 + i * 1.75, 0.65 + i * 0.25, s * 0.42); g.add(r); g.userData.deer.push(r); }
    const reinMat = new T.LineBasicMaterial({ color: 0x7a2a1a });
    for (const s of [-1, 1]) g.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(0.86, 0.98, s * 0.28), new T.Vector3(2.8, 0.75, s * 0.42), new T.Vector3(4.55, 0.95, s * 0.42)]), reinMat));
    const sp = H.points(40, 0, 0xffe08a, 0.1, () => [-1.6 - rnd(0, 3), rnd(-0.5, 0.4), rnd(-0.3, 0.3)]); sp.material.map = H.TEX.soft; sp.material.size = 0.3; sp.material.blending = T.AdditiveBlending; g.add(sp);
    // el juego «agita las alas» del pájaro: aquí no hay alas, solo hace falta que existan
    g.userData.wings = [new T.Object3D(), new T.Object3D()];
    g.traverse(o => { if (o.isMesh) o.castShadow = false; });
    return g;
  }
  // como pájaro de premio: más pequeño y con el trineo (no los renos) donde estaría el pájaro
  function makeBird() { const g = makeSleigh(); g.scale.setScalar(0.62); g.children.forEach(c => { c.position.x -= 1.6; }); return g; }
  function gallop(g, t) { (g.userData.deer || []).forEach((d, i) => { d.position.y = (i < 2 ? 0.65 : 0.9) + Math.sin(t * 9 + i) * 0.06; d.userData.legs.forEach((l, j) => { l.rotation.z = Math.sin(t * 12 + i + (j < 2 ? 0 : Math.PI)) * 0.7; }); }); }

  // ---------- paisaje: pueblo nevado de noche ----------
  function build() {
    seed = 11;
    const env = new T.Group();
    const stars = H.points(400, 0, 0xffffff, 0.6, () => { const a = rnd(0, TAU), e = rnd(0.12, 1.2); return [Math.cos(a) * Math.cos(e) * 260, 30 + Math.sin(e) * 220, Math.sin(a) * Math.cos(e) * 260 - 60]; }); stars.material.fog = false; env.add(stars);
    const groundTex = snowTex.clone(); groundTex.needsUpdate = true; groundTex.wrapS = groundTex.wrapT = T.RepeatWrapping; groundTex.repeat.set(60, 60);
    const ground = mesh(new T.CircleGeometry(420, 64), new T.MeshStandardMaterial({ map: groundTex, roughness: 1 }), 0, Y0 + 0.05, 0); ground.rotation.x = -Math.PI / 2; env.add(ground);
    const moon = mesh(new T.CircleGeometry(9, 48), basic(0xfff6dc, { fog: false }), 25, 44, -138); moon.lookAt(0, 20, 0); env.add(moon);
    const mh = glowSprite(0xdde6ff, 66, 0.5); mh.position.set(29, 50, -158); env.add(mh);
    const tree = bigTree(46); tree.position.set(-30, Y0, -105); env.add(tree);
    const cols = [[0xd8a070, 0x8a2a2a], [0xf0e0c0, 0x2a5a3a], [0xc85a4a, 0x3a3048], [0x8ab0d8, 0x6a2a3a], [0xf0d090, 0x8a3a2a]];
    [[-14, -44], [-24, -58], [15, -46], [26, -60], [38, -78], [-40, -80], [8, -70], [-6, -66], [52, -100], [-56, -105]].forEach(([x, z], i) => { const c = cols[i % 5], hs = house(rnd(5, 7.5), rnd(4, 6), rnd(4.5, 6), c[0], c[1]); hs.position.set(x, Y0, z); hs.lookAt(0, Y0, 10); env.add(hs); });
    const hill = (x, z, r, h) => { const m = mesh(new T.SphereGeometry(r, 28, 14, 0, TAU, 0, Math.PI / 2), M.snow, x, Y0, z); m.scale.y = h / r; env.add(m); };
    hill(-6, -150, 70, 26); hill(60, -140, 50, 20); hill(-70, -130, 45, 16);
    [[-30, -128, 18], [-14, -132, 22], [4, -138, 25], [20, -134, 22], [36, -126, 17], [52, -122, 14], [-46, -118, 12], [12, -150, 26]].forEach(([x, z, y], i) => { const c = cols[i % 5]; const hs = house(rnd(7, 10), rnd(6, 8), rnd(6, 8), c[0], c[1]); hs.position.set(x, Y0 + y - 2, z); hs.lookAt(0, Y0 + y, 10); hs.scale.setScalar(1.15); env.add(hs); });
    const tw = house(5, 16, 5, 0xc8b8a0, 0x2a3a5a); tw.position.set(22, Y0, -120); env.add(tw);
    env.add(mesh(new T.CircleGeometry(1.3, 24), basic(0xfff2c8, { fog: false }), 22, Y0 + 12, -117.4));
    for (let i = 0; i < 40; i++) { const x = rnd(-90, 90), z = rnd(-150, -40); if (Math.abs(x) < 10 && z > -90) continue; const t = pine(rnd(6, 12), { lights: i % 4 === 0 }); t.position.set(x, Y0, z); env.add(t); }
    for (let i = 0; i < 30; i++) { const x = rnd(-80, 80), z = rnd(-170, -120); const t = pine(rnd(8, 13), { lights: i % 3 === 0 }); const hy = Math.max(0, 26 * Math.sqrt(Math.max(0, 1 - ((x + 6) ** 2 + (z + 150) ** 2) / 4900))); t.position.set(x, Y0 + hy - 1, z); env.add(t); }
    for (const [x, z] of [[-11, -30], [12, -32]]) { const s = snowman(1.2); s.position.set(x, Y0, z); s.lookAt(0, Y0, 10); env.add(s); }
    const snow = H.points(500, 0, 0xffffff, 0.3, () => [rnd(-40, 40), rnd(-6, 34), rnd(-60, 8)]); snow.material.map = H.TEX.soft; snow.material.size = 0.34; snow.material.transparent = true; env.add(snow);
    H.scene.add(env); env.visible = false;
    // plataforma: losas de hielo, borde y postes de bastón de caramelo, banderines rojos, verdes, dorados y blancos
    const top = H.tiles('#dff4ff', 'rgba(110,170,210,.55)', 7, (c, x, y, s) => { if (Math.random() < 0.15) { c.fillStyle = 'rgba(255,255,255,.8)'; c.fillRect(x + 4, y + 4, s * 0.4, s * 0.2); } });
    const under = new T.Group();
    under.add(mesh(new T.CylinderGeometry(C.ISLAND_R * 0.97, 1.8, 7, 14), M.snow, 0, -3.8, 0));
    for (let i = 0; i < 26; i++) { const a = i / 26 * TAU, h = rnd(1, 3), ic = mesh(new T.ConeGeometry(rnd(0.15, 0.4), h, 6), M.ice, Math.cos(a) * C.ISLAND_R * 0.9, -0.6 - h / 2, Math.sin(a) * C.ISLAND_R * 0.9); ic.rotation.x = Math.PI; under.add(ic); }
    const platform = H.makePlatform({ top: new T.MeshStandardMaterial({ map: top, roughness: 0.85 }), side: std(0xd8e8ff, { roughness: 0.9 }), trim: caneMat(40), under,
      flags: [0xd8203a, 0x1f8a4a, 0xffc83d, 0xffffff], line: 0x2a3a2a, postTop: 2.8, post: () => { const p = new T.Group(); p.add(cane(3.0, 0.11)); return p; } });
    const sa = snow.geometry.attributes.position;
    return { env: [env], platform, noSun: true, water: false,
      update(dt) {
        const t = H.G.t;
        for (let i = 0; i < sa.count; i++) { let y = sa.getY(i) - dt * (1.2 + (i % 5) * 0.25); if (y < -6) y = 34; sa.setY(i, y); sa.setX(i, sa.getX(i) + Math.sin(t * 0.7 + i) * dt * 0.3); }
        sa.needsUpdate = true;
        if (tree.userData.glow) tree.userData.glow.material.opacity = 0.6 + Math.sin(t * 2.2) * 0.2;
        for (let i = 0; i < bulbMats.length; i++) bulbMats[i].color.setHex(bulbCols[(i + Math.floor(t * 1.5)) % 5]);
      } };
  }

  // ---------- bloques envueltos para regalo ----------
  // Algunos bloques que dan la cara al cañón se envuelven (papel de su color con copos blancos y lazo blanco) y llevan
  // un bastón metido bajo la cinta (2) o un caramelo de menta encima del lazo (1). Si revientan o caen, son tuyos.
  // En los jefes se envuelven todos los bloques de colores (y solo unos pocos llevan premio).
  const bowMat = std(0xffffff, { roughness: 0.35 });
  const peppTex = tex(128, 128, g => { g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 62, 0, TAU); g.fill(); g.fillStyle = '#e8203a'; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(64, 64); g.arc(64, 64, 62, i * TAU / 8, i * TAU / 8 + TAU / 16); g.fill(); } g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(46, 44, 14, 0, TAU); g.fill(); });
  const peppMat = new T.MeshStandardMaterial({ map: peppTex, roughness: 0.2 });
  const sparkMat = new T.SpriteMaterial({ map: H.TEX.soft, color: 0xffffff, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
  function wrapBlock(G, b, prize, withBow) {
    const d = b.userData, host = G.meshes[d.id]; if (!host) return null;
    let body = null; host.traverse(o => { if (!body && o.isMesh && o.material && !o.material.transparent) body = o; });
    const base = '#' + (H.COL[d.c] || 0xffffff).toString(16).padStart(6, '0');
    if (body) { body.material = body.material.clone(); body.material.map = wrapTex(base, 'flakes', '#ffffff'); body.material.color.set(0xffffff); body.material.needsUpdate = true; }
    if (!prize && !withBow) return null;
    const s = Math.min(d.w, d.h), deco = new T.Group();
    const bw = bow(s * 0.72, bowMat); bw.position.set(0, d.h / 2, 0); deco.add(bw);
    if (prize === 2) { const c = cane(s * 0.85, s * 0.05); c.position.set(d.w * 0.18, -d.h * 0.42, d.d / 2 + 0.06 * s); c.rotation.z = -0.25; deco.add(c); }
    else if (prize === 1) {
      const p = mesh(new T.CylinderGeometry(s * 0.2, s * 0.2, s * 0.08, 24), [M.white, peppMat, peppMat], d.w * 0.22, d.h * 0.5 + s * 0.12, d.d * 0.3); p.rotation.x = Math.PI / 2 - 0.5; deco.add(p);
      for (const sx of [-1, 1]) { const tw = mesh(new T.ConeGeometry(s * 0.09, s * 0.16, 8), M.red, d.w * 0.22 + sx * s * 0.27, d.h * 0.5 + s * 0.12, d.d * 0.3); tw.rotation.z = sx * Math.PI / 2; deco.add(tw); }
    }
    if (prize) { const sp = new T.Sprite(sparkMat.clone()); sp.scale.set(0.32 * s, 0.32 * s, 1); sp.position.set(-d.w * 0.32, d.h * 0.32, d.d / 2 + 0.05); deco.add(sp); deco.userData.spark = sp; }
    host.add(deco);
    return deco;
  }
  function decorate(G, n, all) {
    const sim = G.sim; G.xgifts = []; G.xgiftHosts = 0; if (!sim) return;
    const ok = b => { const d = b.userData; return d.c && d.kind === 'block' && !d.stripe && !d.bomb && !d.cham && !d.float && !d.ice && G.meshes[d.id]; };
    const blocks = sim.blocks.filter(ok);
    const alive = sim.blocks.filter(b => b.userData.alive !== false);
    let front = blocks.filter(b => !alive.some(o => o !== b && o.position.z > b.position.z + 0.3 && Math.abs(o.position.x - b.position.x) < 0.5 && Math.abs(o.position.y - b.position.y) < 0.5));
    if (!front.length) front = blocks;
    front.sort((a, b) => (a.position.y - b.position.y) || (a.position.x - b.position.x));
    const idx = n ? [...new Set(Array.from({ length: Math.min(n, front.length) }, (_, i) => Math.round((i + 0.5) / n * (front.length - 1) + (Math.random() - 0.5) * front.length / (n * 2))))] : [];
    const hosts = new Set(idx.map(k => front[Math.max(0, Math.min(front.length - 1, k))]));
    let i = 0;
    for (const b of all ? blocks : hosts) {
      const host = hosts.has(b), prize = host ? (i++ % 2 === 0 ? 2 : 1) : 0;
      const deco = wrapBlock(G, b, prize, host);
      if (deco && prize) { deco.userData.ph = i * 1.7; G.xgifts.push({ id: b.userData.id, mesh: deco, n: prize }); }
    }
    G.xgiftHosts = G.xgifts.length;
    if (X.xm && X.xm.chip) X.xm.chip();
  }

  // ---------- jefes ----------
  const lacq = c => std(c, { roughness: 0.3, metalness: 0.1 });
  function setName(n) { const e = document.getElementById('bbName'); if (e) e.textContent = n; }
  function bodyBox(sim, G) { const box = new T.Box3(); for (const b of sim.blocks) if (b.userData.alive !== false && G.meshes[b.userData.id]) box.expandByObject(G.meshes[b.userData.id]); return box; }
  function boss(S) {
    const G = H.G, sim = S.sim, add = o => { X.world.add(o); S.extras.push(o); return o; };
    if (S.L.bossName) setName(S.L.bossName);
    const box = bodyBox(sim, G), cx = (box.min.x + box.max.x) / 2, top = box.max.y, cz = (box.min.z + box.max.z) / 2;
    if (S.key === 'golem') {
      // Cascanueces: botas negras, base dorada, cabeza con chacó y penacho, cinturón dorado y brazos rojos con hombreras
      for (const b of sim.blocks) if (b.userData.kind === 'stone' && !b.userData.sealed) { const m = G.meshes[b.userData.id]; if (m && m.userData.body) m.userData.body.material = std(0x1a1a2a, { roughness: 0.4 }); }
      if (S.slab) S.slab.traverse(o => { if (o.isMesh) o.material = M.gold; });
      const deco = add(new T.Group());
      const hd = new T.Group(); hd.position.set(cx, top + 0.2, cz + 0.2); deco.add(hd);
      hd.add(mesh(new T.CylinderGeometry(1.0, 1.05, 1.7, 24), M.skin, 0, 1.0, 0));
      for (const sx of [-1, 1]) { hd.add(mesh(new T.SphereGeometry(0.16, 10, 8), M.black, sx * 0.36, 1.35, 0.95)); const br = mesh(new T.BoxGeometry(0.42, 0.12, 0.12), M.black, sx * 0.36, 1.62, 0.96); br.rotation.z = sx * 0.4; hd.add(br); hd.add(mesh(new T.SphereGeometry(0.17, 10, 8), std(0xff8a8a), sx * 0.62, 1.0, 0.86)); }
      const ms = mesh(new T.BoxGeometry(1.1, 0.22, 0.25), M.white, 0, 0.82, 1.02); ms.rotation.x = 0.2; hd.add(ms);
      const jaw = mesh(new T.BoxGeometry(1.15, 0.55, 0.5), M.white, 0, 0.32, 0.86); hd.add(jaw); deco.userData.jaw = jaw;
      for (let i = 0; i < 6; i++) hd.add(mesh(new T.BoxGeometry(0.14, 0.14, 0.06), M.white, -0.36 + i * 0.145, 0.62, 1.12));
      hd.add(mesh(new T.ConeGeometry(0.15, 0.4, 8), M.skin, 0, 1.1, 1.12).rotateX(Math.PI / 2));
      hd.add(mesh(new T.CylinderGeometry(1.0, 0.92, 1.6, 24), std(0x15121c, { roughness: 0.5 }), 0, 2.6, -0.05));
      hd.add(mesh(new T.CylinderGeometry(1.06, 1.06, 0.18, 24), M.gold, 0, 1.9, -0.05));
      const plate = star(0.42, M.gold, 0.12); plate.position.set(0, 2.6, 0.95); hd.add(plate);
      const plume = mesh(new T.SphereGeometry(0.35, 12, 10), M.red, 0, 3.55, 0); plume.scale.set(0.7, 1.4, 0.7); hd.add(plume);
      const belt = mesh(new T.TorusGeometry(1.25, 0.2, 8, 32), M.gold, cx, top - 0.1, cz + 0.2); belt.rotation.x = Math.PI / 2; belt.scale.set(1.35, 0.8, 1); deco.add(belt);
      const red = lacq(0xc8102a);
      for (const sx of [-1, 1]) {
        const ex = cx + sx * (box.max.x - cx - 0.2), pts = [new T.Vector3(ex, top - 3.4, cz), new T.Vector3(ex + sx * 0.9, top - 2.6, cz + 0.3), new T.Vector3(ex + sx * 1.6, top - 1.6, cz + 0.5)];
        deco.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 12, 0.32, 10), red)); deco.add(mesh(new T.SphereGeometry(0.4, 12, 10), M.white, pts[2].x, pts[2].y + 0.15, pts[2].z));
        const ep = mesh(new T.CylinderGeometry(0.55, 0.55, 0.2, 16), M.gold, cx + sx * (box.max.x - cx + 0.1), top - 3.2, cz); ep.rotation.z = sx * 0.4; deco.add(ep);
      }
      S.xm = { deco, x0: S.slab ? S.slab.position.x : 0, top0: top, cx, dy: 0 };
      if (H.G.mode === 'play') X.camera && (S.xm.camUp = true);
    }
    if (S.key === 'pyramid' && S.mask) {
      // Caja Sorpresa: un payaso de muelle (el punto débil) sale de un regalo gigante con la tapa abierta
      const g = S.mask;
      g.children.forEach(o => { if (o !== g.userData.hit && o !== g.userData.halo) o.visible = false; });
      g.add(mesh(new T.SphereGeometry(0.85, 24, 18), M.white, 0, 0.1, 0));
      for (const sx of [-1, 1]) { g.add(mesh(new T.SphereGeometry(0.13, 10, 8), M.black, sx * 0.3, 0.3, 0.75)); const br = mesh(new T.BoxGeometry(0.34, 0.08, 0.06), M.black, sx * 0.3, 0.55, 0.74); br.rotation.z = sx * 0.5; g.add(br); g.add(mesh(new T.SphereGeometry(0.16, 8, 6), std(0xff8aa8), sx * 0.52, -0.05, 0.62)); }
      g.add(mesh(new T.SphereGeometry(0.2, 12, 10), M.red, 0, 0.08, 0.86));
      const mo = mesh(new T.TorusGeometry(0.3, 0.06, 6, 14, Math.PI), M.red, 0, -0.3, 0.72); mo.rotation.z = Math.PI; g.add(mo);
      for (const [sx, c] of [[-1, M.red], [1, M.green]]) { const h = mesh(new T.ConeGeometry(0.42, 1.2, 12), c, sx * 0.55, 0.95, 0); h.rotation.z = -sx * 1.0; g.add(h); g.add(mesh(new T.SphereGeometry(0.16, 8, 6), M.gold, sx * 1.12, 1.25, 0)); }
      const ruff = mesh(new T.TorusGeometry(0.75, 0.22, 8, 20), std(0xffd23f, { roughness: 0.4 }), 0, -0.75, 0); ruff.rotation.x = Math.PI / 2; g.add(ruff);
      const coil = []; for (let i = 0; i <= 120; i++) { const t = i / 120; coil.push(new T.Vector3(Math.cos(t * TAU * 7) * 0.4, -0.9 - t * 1.2, Math.sin(t * TAU * 7) * 0.4)); }
      g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(coil), 300, 0.06, 6), std(0xc8c8d8, { metalness: 0.9, roughness: 0.2 })));
      const bm = new T.MeshStandardMaterial({ map: wrapTex('#2a6aff', 'flakes', '#ffd86a'), roughness: 0.45 });
      add(mesh(new T.BoxGeometry(9.5, 6.6, 2), bm, 0, 3.3, -2.6));
      const lid = add(mesh(new T.BoxGeometry(10, 0.6, 2.4), bm, -2.2, 7.6, -2.8)); lid.rotation.z = 0.5;
      const bb = add(bow(2.2, M.gold)); bb.position.set(-2.4, 8.1, -2.8); bb.rotation.z = 0.5;
    }
    if (S.key === 'ship' && S.hull) {
      // Capitán Escarcha: rompehielos con nieve en la borda, carámbanos, luces, corona, mástil de bastón y bandera de copo
      const iceM = new T.MeshStandardMaterial({ color: 0xbfe8ff, roughness: 0.15, metalness: 0.15 });
      S.hull.traverse(o => {
        if (!o.isMesh) return; const t = o.geometry.type;
        if (t === 'ExtrudeGeometry') o.material = iceM;
        else if (t === 'BoxGeometry') o.material = std(0xffffff, { roughness: 0.4 });
        else if (t === 'CylinderGeometry' && o.geometry.parameters.height > 5) o.material = caneMat(14);
        else if (t === 'CylinderGeometry') o.material = M.gold;
        else if (t === 'CircleGeometry') o.material = basic(0xffd890, { fog: false });
      });
      const h = S.hull;
      h.add(mesh(new T.BoxGeometry(8.4, 0.28, 3.3), M.snow, -0.15, 1.7, 0));
      for (let i = 0; i < 16; i++) { const ic = mesh(new T.ConeGeometry(0.1, 0.4 + (i * 37 % 10) / 20, 5), M.ice, -3.6 + i * 0.47, 1.25, 1.64); ic.rotation.x = Math.PI; h.add(ic); }
      for (let i = 0; i < 22; i++) h.add(mesh(new T.SphereGeometry(0.1, 8, 6), bulbMats[i % 5], -3.9 + i * 0.37, 1.5, 1.68));
      h.add(mesh(new T.TorusGeometry(0.42, 0.13, 8, 18), M.green, 3.55, 1.0, 1.7)); h.add(mesh(new T.SphereGeometry(0.12, 8, 6), M.red, 3.55, 0.6, 1.8));
      if (S.flag) S.flag.material = new T.MeshBasicMaterial({ side: T.DoubleSide, map: tex(128, 84, g => { g.fillStyle = '#1f8a4a'; g.fillRect(0, 0, 128, 84); g.strokeStyle = '#d8203a'; g.lineWidth = 8; g.strokeRect(4, 4, 120, 76); g.strokeStyle = '#fff'; g.lineWidth = 6; g.lineCap = 'round'; for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; g.beginPath(); g.moveTo(64 - Math.cos(a) * 26, 42 - Math.sin(a) * 26); g.lineTo(64 + Math.cos(a) * 26, 42 + Math.sin(a) * 26); g.stroke(); } }) });
      const hat = mesh(new T.ConeGeometry(0.55, 1.3, 14), M.red, 0, 9.55, -1.05); hat.rotation.z = 0.35; h.add(hat);
      h.add(mesh(new T.TorusGeometry(0.5, 0.14, 8, 18), M.white, 0, 9.0, -1.05).rotateX(Math.PI / 2));
      h.add(mesh(new T.SphereGeometry(0.2, 8, 6), M.white, -0.42, 10.1, -1.05));
      for (const [x, z, c] of [[-3.4, 0.9, '#d8203a'], [3.3, 0.9, '#2a6aff'], [-3.0, -0.9, '#ffc83d']]) { const b = giftBox(0.8, 0.7, 0.8, c); b.position.set(x, 1.84, z); h.add(b); }
    }
  }
  // el Cascanueces camina: la cabeza, el cinturón y los brazos lo siguen y bajan si le rompes la parte de arriba
  function bossTick(dt) {
    const B = window.Bosses, S = B && B.state && B.state(); if (!S || !S.xm) return;
    const G = H.G, sim = S.sim, x = S.slab ? S.slab.position.x - S.xm.x0 : 0;
    let top = -1; for (const b of sim.blocks) { const d = b.userData; if (d.alive === false || d.destroyed) continue; if (Math.abs(b.position.x - (S.xm.cx + x)) < 2.4 && b.position.y > top) top = b.position.y + 0.5; }
    const want = top < 0 ? -30 : Math.min(0, top - S.xm.top0);
    S.xm.dy += (want - S.xm.dy) * Math.min(1, dt * 6);
    S.xm.deco.position.set(x, S.xm.dy, 0);
    if (S.xm.deco.userData.jaw) S.xm.deco.userData.jaw.position.y = 0.32 - Math.max(0, Math.sin(G.t * 5)) * 0.12;   // la mandíbula se abre y se cierra
    if (S.done) S.xm.deco.position.y -= 0;
  }

  // ---------- portada: trineo que cruza el cielo con cascabeles ----------
  const TS = { g: null, t0: -99, dir: 1 };
  function titleSleigh(G) {
    const on = G.mode === 'title' && G.xmWorld;
    if (!on) { if (TS.g) TS.g.visible = false; return; }
    if (!TS.g) { TS.g = makeSleigh(); TS.g.scale.setScalar(1.9); H.scene.add(TS.g); TS.t0 = G.t - 5; }
    const e = G.t - TS.t0, dur = 8;
    if (e > dur + 3) { TS.t0 = G.t; TS.dir = Math.random() < 0.5 ? 1 : -1; if (X.Audio && X.Audio.bells) X.Audio.bells(); }
    const k = (G.t - TS.t0) / dur, dir = TS.dir;
    TS.g.visible = k >= 0 && k <= 1; if (!TS.g.visible) return;
    TS.g.position.set(dir * (-34 + k * 68) - 2, 12 + Math.sin(k * Math.PI) * 3 + Math.sin(G.t * 3) * 0.3, -32);
    TS.g.rotation.set(0.1, dir > 0 ? -0.45 : Math.PI + 0.45, Math.sin(G.t * 2) * 0.05);
    gallop(TS.g, G.t);
  }
  function titleCam(cam, t) {
    cam.position.set(4 + Math.sin(t * 0.07) * 1.5, 5, 18);
    cam.lookAt(-4 + Math.sin(t * 0.05) * 1.5, 17, -80);
  }

  const _v = new T.Vector3();
  function tick(G, dt) {
    for (const g of (G.moverMeshes ? G.moverMeshes.values() : [])) if (g.userData.deer) gallop(g, G.t);
    if (TS.g || G.mode === 'title') titleSleigh(G);
    bossTick(dt);
    if (!G.xgifts || !G.xgifts.length) return;
    const sim = G.sim;
    for (let i = G.xgifts.length - 1; i >= 0; i--) {
      const c = G.xgifts[i];
      const sp = c.mesh.userData.spark; if (sp) { const k = Math.max(0, Math.sin(G.t * 2.4 + c.mesh.userData.ph)); sp.material.opacity = k * k; sp.material.rotation = G.t; }
      if (G.mode !== 'play' || !sim || G.demo) continue;
      const b = sim.blocks[c.id], d = b && b.userData;
      const gone = !d || d.alive === false || d.destroyed || (d.hy != null && b.position.y < d.hy - 0.45);
      if (!gone) continue;
      c.mesh.getWorldPosition(_v);
      if (c.mesh.parent) c.mesh.parent.remove(c.mesh);
      G.xgifts.splice(i, 1);
      if (X.xm && X.xm.active && X.xm.active()) X.xm.collect(c.n, _v.x, _v.y, _v.z);
    }
  }

  window.Christmas = { build, makeSleigh, makeBird, decorate, boss, tick, titleCam, caneTex, cane, giftBox };
  if (X.G.mode === 'title' && X.xm && X.xm.active && X.xm.active() && X.goTitle) X.goTitle();
})();
