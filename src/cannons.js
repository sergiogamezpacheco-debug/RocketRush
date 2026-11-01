// Rocket Rush — el cañón: aspectos (tienda, temporales, Pase Pro y eventos), mejoras por niveles, cañones con más fuerza
// y aspectos de las bolas (cada bola conserva su color de juego, solo cambia el dibujo).
// Dibuja el cañón dentro de los grupos que le da el juego (game3d.js) y pinta las miniaturas de la tienda.
(function () {
  'use strict';
  const T = THREE;
  const COL = { r: 0xff4f6d, b: 0x3d9bff, g: 0x5fd45a, y: 0xffd23f, p: 0xa66bff };
  const hooks = { tex: () => null };            // texturas que ya tiene el juego (fuego, bastón de caramelo, arcoíris)

  // ---------------- texturas pintadas (cada una se pinta una sola vez) ----------------
  const texCache = {};
  function tex(key, w, h, draw, rep, nearest) {
    if (texCache[key]) return texCache[key];
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    draw(g, w, h, rnd);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping;
    if (rep) t.repeat.set(rep[0], rep[1]);
    if (nearest) t.magFilter = T.NearestFilter;
    t.anisotropy = 4;
    return (texCache[key] = t);
  }
  const TX = {
    camo: () => tex('camo', 256, 256, (g, w, h, rnd) => { g.fillStyle = '#5f7a3a'; g.fillRect(0, 0, 256, 256); for (const c of ['#3d5226', '#8a9a55', '#2e3a1c', '#a08a5a']) { g.fillStyle = c; for (let i = 0; i < 14; i++) { g.beginPath(); g.ellipse(rnd() * 256, rnd() * 256, 18 + rnd() * 30, 10 + rnd() * 18, rnd() * 3, 0, 7); g.fill(); } } }, [2, 1]),
    bubble: () => tex('bubble', 256, 256, (g) => { g.fillStyle = '#ff8ac2'; g.fillRect(0, 0, 256, 256); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = ['#fff', '#7ee0ff', '#ffe86b'][(x + y) % 3]; g.beginPath(); g.arc(x * 32 + (y % 2) * 16 + 8, y * 32 + 16, 7, 0, 7); g.fill(); } }, [2, 1]),
    galaxy: () => tex('galaxy', 512, 256, (g, w, h, rnd) => { const gr = g.createLinearGradient(0, 0, 512, 256); gr.addColorStop(0, '#1a0a4a'); gr.addColorStop(0.5, '#5a1a8a'); gr.addColorStop(1, '#0a2a6a'); g.fillStyle = gr; g.fillRect(0, 0, 512, 256); for (let i = 0; i < 40; i++) { const x = rnd() * 512, y = rnd() * 256, r = 20 + rnd() * 60; const n = g.createRadialGradient(x, y, 0, x, y, r); n.addColorStop(0, ['rgba(255,80,200,.35)', 'rgba(80,200,255,.3)', 'rgba(160,100,255,.35)'][i % 3]); n.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = n; g.fillRect(0, 0, 512, 256); } for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.4 + rnd() * 0.6) + ')'; g.fillRect(rnd() * 512, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2); } }),
    scales: () => tex('scales', 256, 256, (g) => { g.fillStyle = '#1f6a3a'; g.fillRect(0, 0, 256, 256); for (let y = -1; y < 9; y++) for (let x = -1; x < 9; x++) { const cx = x * 32 + (y % 2) * 16, cy = y * 28; const gr = g.createRadialGradient(cx, cy + 6, 2, cx, cy + 6, 20); gr.addColorStop(0, '#6fe08a'); gr.addColorStop(0.7, '#2a8a4a'); gr.addColorStop(1, '#0f3a1f'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 17, 0, Math.PI); g.fill(); g.strokeStyle = '#d8b64a'; g.lineWidth = 2; g.stroke(); } }, [3, 1]),
    lava: () => tex('lava', 256, 256, (g, w, h, rnd) => { g.fillStyle = '#1a0d0a'; g.fillRect(0, 0, 256, 256); g.lineCap = 'round'; for (let i = 0; i < 22; i++) { let x = rnd() * 256, y = rnd() * 256; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 60; y += (rnd() - 0.5) * 60; g.lineTo(x, y); } g.strokeStyle = '#ff6a1a'; g.lineWidth = 5; g.shadowColor = '#ffb21a'; g.shadowBlur = 12; g.stroke(); g.strokeStyle = '#ffe080'; g.lineWidth = 1.5; g.stroke(); } }, [2, 1]),
    neon: () => tex('neon', 512, 128, (g) => { g.fillStyle = '#0a0a18'; g.fillRect(0, 0, 512, 128); g.lineWidth = 6; for (const [c, y] of [['#00e5ff', 30], ['#ff2bd6', 64], ['#00e5ff', 98]]) { g.strokeStyle = c; g.shadowColor = c; g.shadowBlur = 16; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= 512; x += 64) g.lineTo(x, y + ((x / 64) % 2 ? 10 : -10)); g.stroke(); } }),
    copper: () => tex('copper', 256, 128, (g, w, h, rnd) => { const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#e8955a'); gr.addColorStop(0.5, '#b8642e'); gr.addColorStop(1, '#8a4520'); g.fillStyle = gr; g.fillRect(0, 0, 256, 128); g.fillStyle = '#ffd0a0'; for (let x = 8; x < 256; x += 32) for (const y of [10, 118]) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); } g.fillStyle = 'rgba(60,140,110,.35)'; for (let i = 0; i < 18; i++) { g.beginPath(); g.arc(rnd() * 256, rnd() * 128, 4 + rnd() * 10, 0, 7); g.fill(); } }, [2, 1]),
    skull: () => tex('skull', 512, 128, (g) => { g.fillStyle = '#26262e'; g.fillRect(0, 0, 512, 128); g.fillStyle = '#e8e2d0'; for (const x of [128, 384]) { g.beginPath(); g.arc(x, 56, 26, 0, 7); g.fill(); g.fillRect(x - 16, 70, 32, 20); g.fillStyle = '#26262e'; g.beginPath(); g.arc(x - 10, 54, 7, 0, 7); g.arc(x + 10, 54, 7, 0, 7); g.fill(); g.fillStyle = '#e8e2d0'; } }),
    chrome: () => tex('chrome', 256, 64, (g) => { const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, '#f4f8ff'); gr.addColorStop(0.45, '#8a98b0'); gr.addColorStop(0.55, '#2a3448'); gr.addColorStop(1, '#c8d4e8'); g.fillStyle = gr; g.fillRect(0, 0, 256, 64); g.fillStyle = '#39f'; for (let x = 10; x < 256; x += 40) g.fillRect(x, 28, 18, 8); }, [2, 1]),
    stripes: (a, b) => tex('st' + a + b, 64, 64, (g) => { g.fillStyle = a; g.fillRect(0, 0, 64, 64); g.fillStyle = b; for (let i = -2; i < 4; i++) { g.save(); g.translate(i * 32, 0); g.transform(1, 0, -1, 1, 0, 0); g.fillRect(0, 0, 16, 64); g.restore(); } }, [6, 2]),
    arcade: () => tex('arcade', 64, 32, (g) => { const c = ['#ff4f6d', '#3d9bff', '#5fd45a', '#ffd23f', '#a66bff', '#1a1a2e']; for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) { g.fillStyle = c[(x * 3 + y * 5) % 6]; g.fillRect(x * 8, y * 8, 8, 8); } }, [2, 1], true),
  };
  // materiales que se guardan (no se borran al cambiar de cañón)
  const keep = m => { m.userData.keep = 1; return m; };
  const M = o => new T.MeshPhysicalMaterial(Object.assign({ roughness: 0.35, metalness: 0.3, clearcoat: 0.6 }, o));
  const S = o => new T.MeshStandardMaterial(o);
  const B = o => new T.MeshBasicMaterial(o);
  const mesh = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); return m; };
  const tube = (a, b, r, mat) => { const d = new T.Vector3().subVectors(b, a), m = new T.Mesh(new T.CylinderGeometry(r, r, d.length(), 14), mat); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); return m; };
  const V = (x, y, z) => new T.Vector3(x, y, z);

  // ---------------- aspectos del cañón ----------------
  // rar: base | common | rare | epic | legend | pass | event | streak · how: free | shop | temp (pestaña Temporales) | pass | event | streak
  // c: precio en monedas · g: precio en gemas · m(): materiales {body, ring, wood, band, hub, wheel} · x(): piezas de adorno
  const gold = () => S({ color: 0xffc83d, metalness: 0.85, roughness: 0.25 });
  const legacy = (o) => () => { const map = o.map ? hooks.tex(o.map) : null; return { body: M({ color: o.color, metalness: o.metal, roughness: o.rough, map, emissive: o.glow || 0x000000 }), ring: gold(), wood: S({ color: 0x9a5f32, roughness: 0.75 }), _miss: !!o.map && !map }; };
  const SKINS = [
    { id: 'classic', name: 'Clásico', rar: 'base', how: 'free', css: '#3a2f6e', m: legacy({ color: 0x3a2f6e, metal: 0.3, rough: 0.35 }) },
    { id: 'cobre', name: 'Cañón Cobre', rar: 'common', how: 'shop', c: 2000, css: 'linear-gradient(180deg,#e8955a,#8a4520)', m: () => ({ body: M({ map: TX.copper(), color: 0xffffff, metalness: 0.75, roughness: 0.35 }), ring: M({ color: 0x5a3418, metalness: 0.9, roughness: 0.3 }), band: M({ color: 0x3aa88a, roughness: 0.5 }), wood: M({ color: 0x5a3a22, roughness: 0.8, metalness: 0 }) }) },
    { id: 'camuflaje', name: 'Cañón Camuflaje', rar: 'common', how: 'shop', c: 2500, css: 'radial-gradient(circle at 30% 30%,#3d5226 0 25%,transparent 26%),radial-gradient(circle at 70% 65%,#a08a5a 0 22%,transparent 23%),#5f7a3a', m: () => ({ body: M({ map: TX.camo(), color: 0xffffff, metalness: 0.1, roughness: 0.75, clearcoat: 0.1 }), ring: M({ color: 0x3d4a2a, metalness: 0.6, roughness: 0.5 }), band: M({ color: 0x1a1a1a, roughness: 0.6 }), wood: M({ color: 0x8a7a50, roughness: 0.9, metalness: 0 }) }) },
    { id: 'chicle', name: 'Cañón Chicle', rar: 'common', how: 'shop', c: 3000, css: 'radial-gradient(circle,#fff 0 18%,transparent 20%) 0 0/12px 12px,#ff8ac2', m: () => ({ body: M({ map: TX.bubble(), color: 0xffffff, metalness: 0.05, roughness: 0.3, clearcoat: 1 }), ring: M({ color: 0xffffff, metalness: 0.1, roughness: 0.2, clearcoat: 1 }), band: M({ color: 0x7ee0ff, roughness: 0.3 }), wood: M({ color: 0xff6aa8, roughness: 0.5, metalness: 0 }) }) },
    { id: 'sandia', name: 'Cañón Sandía', rar: 'common', how: 'shop', c: 2000, css: 'repeating-linear-gradient(135deg,#2f8a3a 0 6px,#7fd45a 6px 12px)', m: () => ({ body: M({ map: TX.stripes('#2f8a3a', '#7fd45a'), color: 0xffffff, metalness: 0, roughness: 0.4 }), ring: M({ color: 0xf2f2e0, roughness: 0.4, metalness: 0 }), band: M({ color: 0xff4f6d, roughness: 0.4 }), wood: M({ color: 0xff6a7a, roughness: 0.5, metalness: 0 }), hub: M({ color: 0x1a1a1a }) }),
      x: (piv) => { const k = M({ color: 0x111111 }); for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, sd = mesh(new T.SphereGeometry(0.035, 8, 6), k, Math.cos(a) * 0.2, Math.sin(a) * 0.2, -1.5); sd.scale.set(1, 1.6, 1); piv.add(sd); } } },
    { id: 'tigre', name: 'Cañón Tigre', rar: 'common', how: 'shop', c: 2500, css: 'repeating-linear-gradient(135deg,#ff8a1a 0 7px,#1a1a1a 7px 11px)', m: () => ({ body: M({ map: TX.stripes('#ff8a1a', '#1a1a1a'), color: 0xffffff, metalness: 0.1, roughness: 0.5 }), ring: M({ color: 0xffffff, roughness: 0.4 }), band: M({ color: 0x1a1a1a }), wood: M({ color: 0x5a3a1a, roughness: 0.8, metalness: 0 }) }),
      x: (piv) => { const o = M({ color: 0xff8a1a }); [-1, 1].forEach(sx => piv.add(mesh(new T.ConeGeometry(0.14, 0.25, 4), o, sx * 0.28, 0.48, 0.45))); } },
    { id: 'pirata', name: 'Cañón Pirata', rar: 'rare', how: 'shop', g: 60, css: 'radial-gradient(circle at 50% 45%,#e8e2d0 0 22%,transparent 24%),#26262e', spokes: true, m: () => ({ body: M({ map: TX.skull(), color: 0xffffff, metalness: 0.5, roughness: 0.45 }), ring: M({ color: 0xffc83d, metalness: 0.9, roughness: 0.25 }), band: M({ color: 0xc81e2a, roughness: 0.5 }), wood: M({ color: 0x3a2214, roughness: 0.85, metalness: 0 }) }),
      x: (piv, root) => { root.add(mesh(new T.CylinderGeometry(0.03, 0.03, 1.1, 8), M({ color: 0x3a2214 }), 0.55, 0.15, 0.7)); const f = mesh(new T.PlaneGeometry(0.55, 0.36), S({ map: TX.skull(), side: T.DoubleSide }), 0.55, 0.55, 0.42); f.rotation.y = Math.PI / 2; root.add(f); } },
    { id: 'neon', name: 'Cañón Neón', rar: 'rare', how: 'shop', g: 80, css: 'linear-gradient(180deg,#0a0a18 30%,#00e5ff 31% 38%,#0a0a18 39% 60%,#ff2bd6 61% 68%,#0a0a18 69%)', m: () => { const t = TX.neon(); return { body: M({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.9, color: 0xffffff, metalness: 0.4, roughness: 0.3 }), ring: M({ color: 0x111122, metalness: 1, roughness: 0.15 }), band: M({ color: 0xff2bd6, emissive: 0xff2bd6, emissiveIntensity: 1.2 }), wood: M({ color: 0x15152a, roughness: 0.4, metalness: 0.6 }), hub: M({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 1.5 }) }; } },
    { id: 'cubi', name: 'Cañón Cubi', rar: 'rare', how: 'shop', g: 70, css: 'radial-gradient(circle at 35% 40%,#1d1440 0 8%,#fff 9% 16%,transparent 17%),radial-gradient(circle at 65% 40%,#1d1440 0 8%,#fff 9% 16%,transparent 17%),#ffc83d', m: () => ({ body: M({ color: 0xffc83d, metalness: 0.05, roughness: 0.35, clearcoat: 1 }), ring: M({ color: 0xff9a1a, roughness: 0.3 }), band: M({ color: 0xff6a8a }), wood: M({ color: 0x8a5cff, roughness: 0.4, metalness: 0 }) }),
      x: (piv) => { const w = M({ color: 0xffffff, metalness: 0, roughness: 0.2 }), k = M({ color: 0x1d1440 }), ck = M({ color: 0xff8aa8 }); [-1, 1].forEach(sx => { piv.add(mesh(new T.SphereGeometry(0.13, 16, 12), w, sx * 0.2, 0.18, 0.78)); piv.add(mesh(new T.SphereGeometry(0.065, 12, 8), k, sx * 0.2, 0.18, 0.89)); const ch = mesh(new T.SphereGeometry(0.07, 12, 8), ck, sx * 0.33, -0.02, 0.76); ch.scale.set(1, 0.6, 0.4); piv.add(ch); });
        const sm = mesh(new T.TorusGeometry(0.1, 0.025, 8, 16, Math.PI), k, 0, 0.02, 0.86); sm.rotation.z = Math.PI; piv.add(sm); } },
    { id: 'samurai', name: 'Cañón Samurái', rar: 'rare', how: 'shop', g: 90, css: 'linear-gradient(180deg,#c8102e 0 70%,#ffc83d 71% 80%,#1a1a1a 81%)', m: () => ({ body: M({ color: 0xc8102e, metalness: 0.2, roughness: 0.15, clearcoat: 1 }), ring: M({ color: 0x1a1a1a, metalness: 0.6, roughness: 0.3 }), band: M({ color: 0xffc83d, metalness: 0.9, roughness: 0.2 }), wood: M({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.2 }), hub: M({ color: 0xffc83d, metalness: 0.9 }) }),
      x: (piv) => { const gd = M({ color: 0xffc83d, metalness: 0.9, roughness: 0.2 }); const mon = mesh(new T.TorusGeometry(0.18, 0.03, 8, 24), gd, 0, 0.47, -0.35); mon.rotation.x = Math.PI / 2; piv.add(mon); [-1, 1].forEach(sx => { const h = mesh(new T.BoxGeometry(0.06, 0.5, 0.06), gd, sx * 0.22, 0.6, 0.55); h.rotation.z = sx * 0.5; piv.add(h); }); } },
    { id: 'galaxia', name: 'Cañón Galaxia', rar: 'epic', how: 'shop', g: 120, css: 'radial-gradient(circle at 30% 30%,#fff 0 3%,transparent 4%),radial-gradient(circle at 70% 60%,rgba(255,80,200,.7),transparent 50%),linear-gradient(135deg,#1a0a4a,#5a1a8a,#0a2a6a)', m: () => { const t = TX.galaxy(); return { body: M({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.35, color: 0xffffff, metalness: 0.2, roughness: 0.2, clearcoat: 1 }), ring: M({ color: 0xdfe6ff, metalness: 1, roughness: 0.1 }), band: M({ color: 0xa66bff, emissive: 0x7a3aff, emissiveIntensity: 0.8 }), wood: M({ color: 0x2a1a5a, roughness: 0.4, metalness: 0.5 }) }; },
      x: (piv) => { const st = B({ color: 0xfff6b0 }); for (let i = 0; i < 5; i++) piv.add(mesh(new T.OctahedronGeometry(0.07), st, Math.cos(i * 1.3) * 0.75, 0.35 + Math.sin(i * 2.1) * 0.3, -0.4 - i * 0.25)); } },
    { id: 'dragon', name: 'Cañón Dragón', rar: 'epic', how: 'shop', g: 150, css: 'radial-gradient(circle at 50% 0,#6fe08a,#2a8a4a 60%,#0f3a1f)', m: () => ({ body: M({ map: TX.scales(), color: 0xffffff, metalness: 0.35, roughness: 0.4 }), ring: M({ color: 0xffc83d, metalness: 0.9, roughness: 0.2 }), band: M({ color: 0xc81e2a, roughness: 0.4 }), wood: M({ color: 0x3a1a0a, roughness: 0.7, metalness: 0 }) }),
      x: (piv) => { const horn = M({ color: 0xf0e6c8, roughness: 0.4, metalness: 0 }), sp = M({ color: 0xffc83d, metalness: 0.8, roughness: 0.3 }), eye = B({ color: 0xffe14a });
        [-1, 1].forEach(sx => { const h = mesh(new T.ConeGeometry(0.1, 0.55, 12), horn, sx * 0.3, 0.42, 0.5); h.rotation.set(0.6, 0, -sx * 0.5); piv.add(h); piv.add(mesh(new T.SphereGeometry(0.06, 12, 8), eye, sx * 0.2, 0.25, 0.78)); });
        for (let i = 0; i < 6; i++) piv.add(mesh(new T.ConeGeometry(0.07, 0.22, 4), sp, 0, 0.46 - i * 0.012, 0.15 - i * 0.28)); } },
    { id: 'submarino', name: 'Cañón Submarino', rar: 'epic', how: 'shop', g: 130, css: 'radial-gradient(circle at 70% 50%,#5fd4ff 0 10%,#9aa6c8 11% 15%,transparent 16%),#ffd23f', m: () => ({ body: M({ color: 0xffd23f, metalness: 0.4, roughness: 0.3 }), ring: M({ color: 0x3a3a48, metalness: 0.9, roughness: 0.3 }), band: M({ color: 0x3a3a48 }), wood: M({ color: 0x2a6a9a, roughness: 0.4, metalness: 0.4 }) }),
      x: (piv) => { const met = M({ color: 0x9aa6c8, metalness: 1, roughness: 0.2 }), gl = B({ color: 0x5fd4ff });
        for (let i = 0; i < 3; i++) { const po = mesh(new T.TorusGeometry(0.1, 0.03, 8, 20), met, 0.44, 0.05, 0.1 - i * 0.45); po.rotation.y = Math.PI / 2; piv.add(po); const g = mesh(new T.CircleGeometry(0.09, 16), gl, 0.445, 0.05, 0.1 - i * 0.45); g.rotation.y = Math.PI / 2; piv.add(g); }
        piv.add(mesh(new T.CylinderGeometry(0.05, 0.05, 0.6, 12), met, -0.32, 0.6, 0.2)); const top = mesh(new T.CylinderGeometry(0.06, 0.06, 0.25, 12), met, -0.32, 0.9, 0.1); top.rotation.x = Math.PI / 2; piv.add(top); } },
    { id: 'fantasma', name: 'Cañón Fantasma', rar: 'epic', how: 'shop', g: 160, css: 'radial-gradient(circle at 50% 40%,#e8fff4,#9affd0 50%,#2aaa70)', m: () => ({ body: M({ color: 0x9affd0, transparent: true, opacity: 0.6, emissive: 0x2affa0, emissiveIntensity: 0.6, roughness: 0.2, metalness: 0, clearcoat: 0.4, depthWrite: false }), ring: M({ color: 0xe8fff4, emissive: 0x6affc0, emissiveIntensity: 0.6 }), band: M({ color: 0x5affb0, emissive: 0x2aff90, emissiveIntensity: 1 }), wood: M({ color: 0x6affc0, transparent: true, opacity: 0.45, emissive: 0x1a8a5a, metalness: 0, depthWrite: false }) }),
      x: (piv) => { const k = B({ color: 0x0a2a1a }); [-1, 1].forEach(sx => { const e = mesh(new T.SphereGeometry(0.08, 12, 8), k, sx * 0.18, 0.15, 0.82); e.scale.set(1, 1.4, 0.5); piv.add(e); }); } },
    { id: 'arcade', name: 'Cañón Arcade', rar: 'epic', how: 'shop', g: 180, css: 'conic-gradient(#ff4f6d 0 25%,#3d9bff 0 50%,#5fd45a 0 75%,#ffd23f 0) 0 0/14px 14px', m: () => { const t = TX.arcade(); return { body: M({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.25, color: 0xffffff, roughness: 0.5, metalness: 0 }), ring: M({ color: 0x1a1a2e }), band: M({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.4 }), wood: M({ color: 0x1a1a2e, roughness: 0.4 }), hub: M({ color: 0xffd23f, emissive: 0xffd23f, emissiveIntensity: 0.6 }) }; } },
    { id: 'diamante', name: 'Cañón Diamante', rar: 'legend', how: 'temp', g: 250, css: 'linear-gradient(135deg,#ffffff,#bfefff 35%,#7ad8ff 55%,#e8f8ff 70%,#9fe6ff)', m: () => ({ body: M({ color: 0xbfefff, metalness: 0.1, roughness: 0.03, transparent: true, opacity: 0.82, iridescence: 1, iridescenceIOR: 1.6, clearcoat: 1, emissive: 0x2a5a8a, emissiveIntensity: 0.35, envMapIntensity: 1.6 }), ring: M({ color: 0xf2f6ff, metalness: 1, roughness: 0.05 }), band: M({ color: 0x9fe6ff, metalness: 0.2, roughness: 0.05 }), wood: M({ color: 0xeef2f8, roughness: 0.25, metalness: 0.1 }), hub: M({ color: 0x9fe6ff, metalness: 1, roughness: 0.1 }) }),
      x: (piv) => { const gm = M({ color: 0xffffff, roughness: 0, metalness: 0.2, iridescence: 1, clearcoat: 1, envMapIntensity: 2 }); for (let i = 0; i < 6; i++) piv.add(mesh(new T.OctahedronGeometry(0.09), gm, Math.cos(i) * 0.48, Math.sin(i) * 0.48, 0.25)); } },
    { id: 'volcan', name: 'Cañón Volcán', rar: 'legend', how: 'temp', g: 300, css: 'radial-gradient(circle at 30% 60%,#ffe080 0 6%,#ff6a1a 7% 14%,transparent 15%),radial-gradient(circle at 70% 30%,#ff6a1a 0 9%,transparent 10%),#1a0d0a', m: () => { const t = TX.lava(); return { body: M({ map: t, emissiveMap: t, emissive: 0xff7a1a, emissiveIntensity: 1.4, color: 0xffffff, metalness: 0.2, roughness: 0.75, clearcoat: 0.1 }), ring: M({ color: 0x1a1210, metalness: 0.7, roughness: 0.5 }), band: M({ color: 0xff5a1a, emissive: 0xff3a00, emissiveIntensity: 1.5 }), wood: M({ color: 0x2a1a14, roughness: 0.95, metalness: 0 }), hub: M({ color: 0xff6a1a, emissive: 0xff4a00, emissiveIntensity: 1.6 }) }; } },
    { id: 'tesoro', name: 'Cañón Tesoro', rar: 'legend', how: 'temp', g: 280, css: 'radial-gradient(circle at 30% 50%,#ff3a5a 0 8%,transparent 9%),radial-gradient(circle at 70% 50%,#3dc8ff 0 8%,transparent 9%),linear-gradient(180deg,#fff0a0,#ffc83d 50%,#c9890f)', m: () => ({ body: M({ color: 0xffc83d, metalness: 1, roughness: 0.18 }), ring: M({ color: 0xfff0a0, metalness: 1, roughness: 0.08 }), band: M({ color: 0xc81e2a, metalness: 0.3, roughness: 0.2 }), wood: M({ color: 0x6a3a14, roughness: 0.6, metalness: 0.1 }), hub: M({ color: 0xfff0a0, metalness: 1 }) }),
      x: (piv) => { const gc = [0xff3a5a, 0x3dc8ff, 0x5fd45a, 0xa66bff].map(c => M({ color: c, roughness: 0, metalness: 0.2, clearcoat: 1, emissive: c, emissiveIntensity: 0.3 })); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; piv.add(mesh(new T.OctahedronGeometry(0.08), gc[i % 4], Math.cos(a) * 0.47, Math.sin(a) * 0.47, -0.75)); } } },
    { id: 'holo', name: 'Cañón Holográfico', rar: 'legend', how: 'temp', g: 320, css: 'linear-gradient(135deg,#ff9ad5,#9ad8ff 30%,#c8ff9a 50%,#ffe69a 70%,#d29aff)', m: () => ({ body: M({ color: 0xf0f4ff, metalness: 0.9, roughness: 0.08, iridescence: 1, iridescenceIOR: 2.0, iridescenceThicknessRange: [200, 900], clearcoat: 1 }), ring: M({ color: 0xffffff, metalness: 1, roughness: 0.05, iridescence: 1 }), band: M({ color: 0xff6ad5, emissive: 0xff2bd6, emissiveIntensity: 0.6 }), wood: M({ color: 0xdfe6ff, metalness: 0.8, roughness: 0.1, iridescence: 1 }) }) },
    { id: 'robot', name: 'Cañón Robot', rar: 'pass', how: 'pass', css: 'linear-gradient(180deg,#f4f8ff,#8a98b0 45%,#2a3448 55%,#c8d4e8)', m: () => ({ body: M({ map: TX.chrome(), color: 0xffffff, metalness: 1, roughness: 0.12 }), ring: M({ color: 0x3d9bff, emissive: 0x1a6aff, emissiveIntensity: 1.2, metalness: 0.5 }), band: M({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 1.3 }), wood: M({ color: 0x5a6478, roughness: 0.3, metalness: 0.9 }), hub: M({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 1.5 }) }),
      x: (piv) => { piv.add(mesh(new T.CylinderGeometry(0.02, 0.02, 0.5, 8), M({ color: 0xcccccc, metalness: 1 }), 0.32, 0.62, 0.45)); piv.add(mesh(new T.SphereGeometry(0.06, 12, 8), B({ color: 0xff3a5a }), 0.32, 0.88, 0.45)); piv.add(mesh(new T.BoxGeometry(0.5, 0.12, 0.08), B({ color: 0x00e5ff }), 0, 0.2, 0.86)); } },
    { id: 'bosque', name: 'Cañón Bosque Encantado', rar: 'pass', how: 'pass', css: 'radial-gradient(circle at 35% 35%,#ff3a3a 0 10%,transparent 11%),radial-gradient(circle at 65% 60%,#ff3a3a 0 8%,transparent 9%),#5a8a4a', m: () => ({ body: M({ map: TX.scales(), color: 0x9adf9a, metalness: 0, roughness: 0.8, clearcoat: 0 }), ring: M({ color: 0x6a4a2a, roughness: 0.8, metalness: 0 }), band: M({ color: 0xff8ad0 }), wood: M({ color: 0x5a3a1a, roughness: 0.9, metalness: 0 }) }),
      x: (piv) => { const stm = M({ color: 0xfff6e0 }), cap = M({ color: 0xff3a3a }); for (let i = 0; i < 3; i++) { piv.add(mesh(new T.CylinderGeometry(0.04, 0.05, 0.16, 8), stm, -0.25 + i * 0.22, 0.48, 0.2 - i * 0.35)); piv.add(mesh(new T.SphereGeometry(0.11, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), cap, -0.25 + i * 0.22, 0.56, 0.2 - i * 0.35)); }
        const fl = [0xffffff, 0xffd23f, 0xff8ad0].map(c => M({ color: c })); for (let i = 0; i < 6; i++) { const a = i * 1.1; piv.add(mesh(new T.SphereGeometry(0.05, 8, 6), fl[i % 3], Math.cos(a) * 0.47, Math.sin(a) * 0.47, -1.0 + i * 0.12)); } } },
    // los de antes (Pase, eventos y racha): se ganan, no se compran
    { id: 'royal', name: 'Cañón Real', rar: 'pass', how: 'pass', css: '#ffc83d', m: legacy({ color: 0xffc83d, metal: 0.9, rough: 0.2 }) },
    { id: 'ice', name: 'Cañón de Hielo', rar: 'pass', how: 'pass', css: '#9fe6ff', m: legacy({ color: 0x9fe6ff, metal: 0.1, rough: 0.05 }) },
    { id: 'rainbow', name: 'Cañón Arcoíris', rar: 'pass', how: 'pass', css: 'conic-gradient(#ff4f6d,#ffd23f,#5fd45a,#3d9bff,#a66bff,#ff4f6d)', m: legacy({ color: 0xffffff, metal: 0.2, rough: 0.25, map: 'rainbow' }) },
    { id: 'candycane', name: 'Cañón Bastón', rar: 'event', how: 'event', css: 'repeating-linear-gradient(135deg,#fff 0 8px,#e8203a 8px 16px)', m: legacy({ color: 0xffffff, metal: 0.1, rough: 0.3, map: 'cane', glow: 0x2a0008 }) },
    { id: 'pumpkin', name: 'Cañón Calabaza', rar: 'event', how: 'event', css: 'linear-gradient(180deg,#ffb347,#ff7a12 55%,#a83a00)', m: legacy({ color: 0xff7a1a, metal: 0.2, rough: 0.4, glow: 0x4a1400 }) },
    { id: 'fire', name: 'Cañón de Fuego', rar: 'streak', how: 'streak', css: 'linear-gradient(180deg,#ffe066,#ff6a1a 50%,#8a1010)', m: legacy({ color: 0xffffff, metal: 0.25, rough: 0.3, map: 'fire', glow: 0x7a1c00 }) },
  ];
  const SKIN = {}; for (const s of SKINS) SKIN[s.id] = s;
  const matCache = {};
  function skinMats(id) {
    if (matCache[id]) return matCache[id];
    const s = SKIN[id] || SKIN.classic, m = s.m();
    if (m._miss) { delete m._miss; return m; }     // la textura aún no está (el bastón llega con christmas.js): sin guardar
    delete m._miss;
    for (const k in m) if (m[k]) keep(m[k]);
    return (matCache[id] = m);
  }

  // ---------------- mejoras (sirven para cualquier cañón) ----------------
  // f: fuerza (×) · aim: la guía de tiro sigue más allá de la diana · combo: los combos dan +25 % de puntos
  const UPGRADES = [
    { lv: 1, name: 'Básico', f: 1, desc: 'El cañón de siempre' },
    { lv: 2, name: 'Aros reforzados', f: 1.1, c: 1000, desc: '+10 % de fuerza' },
    { lv: 3, name: 'Mira telescópica', f: 1.1, aim: true, c: 2500, desc: '+10 % de fuerza y la guía de tiro sigue más allá de la diana' },
    { lv: 4, name: 'Tubos de presión', f: 1.2, aim: true, c: 5000, desc: '+20 % de fuerza y guía larga' },
    { lv: 5, name: 'Turbo', f: 1.35, aim: true, combo: true, c: 10000, desc: '+35 % de fuerza, guía larga y los combos dan +25 % de puntos' },
  ];

  // ---------------- piezas comunes ----------------
  function barrel(piv, k, P, out) {
    const L = P.len || 2, r0 = P.r0 || 0.34, r1 = P.r1 || 0.46, z0 = 0.4;
    const b = mesh(new T.CylinderGeometry(r0, r1, L, 32, 1, true), k.body, 0, 0, z0 - L / 2); b.rotation.x = Math.PI / 2; piv.add(b);
    const inner = mesh(new T.CircleGeometry(r0 * 0.92, 24), B({ color: 0x0a0618 }), 0, 0, z0 - L + 0.02); inner.rotation.y = Math.PI; piv.add(inner);
    piv.add(mesh(new T.SphereGeometry(r1, 24, 16), k.body, 0, 0, z0));
    (P.rings || [-1.45, -0.2, 0.25]).forEach(z => { const t = mesh(new T.TorusGeometry(z < -1 ? r0 + 0.04 : r1 + 0.01, P.ringT || 0.07, 10, 32), k.ring, 0, 0, z); piv.add(t); });
    if (!P.noBand) {
      const bd = mesh(new T.CylinderGeometry(r1 - 0.03, r1 - 0.02, 0.22, 32, 1, true), k.band || S({ color: 0xff4f6d, roughness: 0.4 }), 0, 0, -0.75); bd.rotation.x = Math.PI / 2; piv.add(bd);
      if (!k.band) out.tint.push(bd);            // sin banda propia: toma el color de la bola cargada
    }
    holder(piv, out, 0, 0, P.ballZ != null ? P.ballZ : -1.45, P.ballR || 0.3);
  }
  function holder(piv, out, x, y, z, r) { const h = new T.Group(); h.position.set(x, y, z); h.userData.ball = 1; h.userData.r = r; piv.add(h); out.holders.push(h); return h; }
  function carriage(root, k, P) {
    root.add(mesh(P.carGeo || new T.BoxGeometry(1.3, 0.5, 1.6), k.wood, 0, -0.55, 0.15));
    const hub = k.hub || k.ring;
    [-0.72, 0.72].forEach(x => {
      const w = mesh(new T.CylinderGeometry(0.55, 0.55, 0.16, 28), k.wheel || k.wood, x, -0.62, 0.15); w.rotation.z = Math.PI / 2; root.add(w);
      const h = mesh(new T.CylinderGeometry(0.16, 0.16, 0.2, 16), hub, x * 1.03, -0.62, 0.15); h.rotation.z = Math.PI / 2; root.add(h);
      if (P.spokes) for (let i = 0; i < 6; i++) { const s = mesh(new T.BoxGeometry(0.17, 0.9, 0.08), hub, x * 1.06, -0.62, 0.15); s.rotation.x = i * Math.PI / 6; root.add(s); }
    });
  }
  // piezas de las mejoras (en el cañón normal): cada nivel añade las suyas
  const UP_RINGS = [-1.45, -1.1, -0.5, -0.2, 0.25];
  function upgradeParts(piv, k, lv) {
    if (lv >= 2) for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; piv.add(mesh(new T.SphereGeometry(0.045, 10, 8), k.ring, Math.cos(a) * 0.5, Math.sin(a) * 0.5, -0.2)); }
    if (lv >= 3) {
      const dk = M({ color: 0x222233, metalness: 0.8, roughness: 0.3 });
      // mira de lado (desde detrás no tapa la diana)
      const sc = mesh(new T.CylinderGeometry(0.09, 0.09, 1.0, 20), dk, 0.44, 0.36, -0.25); sc.rotation.x = Math.PI / 2; piv.add(sc);
      const lens = mesh(new T.CircleGeometry(0.08, 20), B({ color: 0x5fd4ff }), 0.44, 0.36, -0.76); lens.rotation.y = Math.PI; piv.add(lens);
      [-0.05, -0.5].forEach(z => { const st = mesh(new T.BoxGeometry(0.16, 0.06, 0.06), k.ring, 0.36, 0.3, z); st.rotation.z = -0.6; piv.add(st); });
    }
    if (lv >= 4) {
      const cu = M({ color: 0xd8823a, metalness: 0.85, roughness: 0.3 });
      [-1, 1].forEach(sx => { piv.add(tube(V(sx * 0.52, 0, 0.45), V(sx * 0.45, 0.05, -1.3), 0.06, cu)); piv.add(mesh(new T.SphereGeometry(0.09, 12, 8), cu, sx * 0.52, 0, 0.45)); const v = mesh(new T.CylinderGeometry(0.08, 0.08, 0.06, 6), k.ring, sx * 0.5, 0.02, -0.4); v.rotation.z = Math.PI / 2; piv.add(v); });
    }
    if (lv >= 5) {
      // turbo: depósito detrás (por debajo de la culata) y dos escapes a los lados
      const tk = mesh(new T.CylinderGeometry(0.25, 0.25, 0.8, 24), M({ color: 0xc81e2a, metalness: 0.5, roughness: 0.3 }), 0, -0.02, 0.98); tk.rotation.z = Math.PI / 2; piv.add(tk);
      const gauge = mesh(new T.CylinderGeometry(0.12, 0.12, 0.05, 24), M({ color: 0xffffff, metalness: 0.1 }), 0, 0.02, 1.24); gauge.rotation.x = Math.PI / 2; piv.add(gauge);
      piv.add(mesh(new T.BoxGeometry(0.03, 0.09, 0.02), B({ color: 0xc81e2a }), 0.02, 0.05, 1.27));
      const ex = M({ color: 0x444455, metalness: 0.9, roughness: 0.3 });
      [-1, 1].forEach(sx => { const e = mesh(new T.CylinderGeometry(0.06, 0.09, 0.36, 16), ex, sx * 0.5, 0.22, 0.95); e.rotation.set(-0.5, 0, -sx * 0.35); piv.add(e); });
    }
  }

  // ---------------- cañones (el normal y los que tiran con más fuerza) ----------------
  // f: fuerza (×) · heavy: la fuerza va en el peso de la bola (mismo tiro) · boom: pequeña explosión al chocar que empuja
  // own(): materiales propios del modelo cuando llevas el aspecto Clásico; con otro aspecto, el cañón se pinta con él
  const MODELS = [
    { id: 'base', name: 'Cañón normal', f: 1, desc: 'El de siempre. Las mejoras le añaden piezas',
      make(piv, root, k, o, out) {
        const lv = o.lv || 1;
        barrel(piv, k, lv >= 2 ? { rings: UP_RINGS, ringT: 0.08 } : {}, out);
        carriage(root, k, { spokes: o.spokes });
        upgradeParts(piv, k, lv);
        return true;
      } },
    { id: 'doble', name: 'Cañón Doble', f: 1.25, g: 150, desc: 'Dos bocas: +25 % de fuerza',
      own: () => ({ body: M({ color: 0x2a5fd6, metalness: 0.5, roughness: 0.3 }) }),
      make(piv, root, k, o, out) {
        [-0.3, 0.3].forEach(x => {
          const b = mesh(new T.CylinderGeometry(0.24, 0.32, 2.0, 28, 1, true), k.body, x, 0, -0.6); b.rotation.x = Math.PI / 2; piv.add(b);
          const inner = mesh(new T.CircleGeometry(0.22, 20), B({ color: 0x0a0618 }), x, 0, -1.58); inner.rotation.y = Math.PI; piv.add(inner);
          piv.add(mesh(new T.SphereGeometry(0.32, 20, 14), k.body, x, 0, 0.4));
          [-1.45, -0.6, 0.2].forEach(z => piv.add(mesh(new T.TorusGeometry(z < -1 ? 0.27 : 0.33, 0.05, 10, 28), k.ring, x, 0, z)));
          holder(piv, out, x, 0, -1.5, 0.2);
        });
        piv.add(mesh(new T.BoxGeometry(0.9, 0.18, 0.3), k.ring, 0, 0, -0.2));
        carriage(root, k, {});
      } },
    { id: 'mortero', name: 'Mortero Pesado', f: 1.5, heavy: true, g: 200, desc: 'Bola un 50 % más pesada: empuja más (el tiro va igual de rápido)',
      own: () => ({ body: M({ color: 0x4a4a55, metalness: 0.8, roughness: 0.45 }), ring: M({ color: 0x22222a, metalness: 0.9, roughness: 0.4 }), wood: M({ color: 0x8a8a8a, roughness: 0.95, metalness: 0 }) }),
      make(piv, root, k, o, out) {
        barrel(piv, k, { len: 1.3, r0: 0.42, r1: 0.5, rings: [-0.65, -0.05, 0.3], ringT: 0.09, noBand: true, ballZ: -0.82, ballR: 0.34 }, out);
        for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; piv.add(mesh(new T.SphereGeometry(0.045, 8, 6), k.ring, Math.cos(a) * 0.52, Math.sin(a) * 0.52, -0.05)); }
        carriage(root, k, { carGeo: new T.CylinderGeometry(0.85, 1.0, 0.5, 8) });
      } },
    { id: 'vapor', name: 'Cañón de Vapor', f: 1.4, g: 250, desc: '+40 % de fuerza',
      own: () => ({ body: M({ color: 0xc89a3a, metalness: 0.9, roughness: 0.3 }), ring: M({ color: 0x6a3a1a, metalness: 0.8, roughness: 0.4 }), band: M({ color: 0x2a6a5a, roughness: 0.4 }), wood: M({ color: 0x4a2a14, roughness: 0.8, metalness: 0 }) }),
      make(piv, root, k, o, out) {
        barrel(piv, k, {}, out);
        carriage(root, k, { spokes: true });
        const brass = M({ color: 0xd8b04a, metalness: 0.95, roughness: 0.25 });
        // chimenea a un lado (desde detrás no tapa la diana)
        piv.add(mesh(new T.CylinderGeometry(0.11, 0.09, 0.7, 16), M({ color: 0x2a2a30, metalness: 0.8, roughness: 0.4 }), 0.55, 0.45, 0.55));
        piv.add(mesh(new T.CylinderGeometry(0.17, 0.11, 0.1, 16), brass, 0.55, 0.83, 0.55));
        piv.add(tube(V(0.3, 0.1, 0.55), V(0.55, 0.15, 0.55), 0.06, brass));
        const puff = [];
        for (let i = 0; i < 3; i++) { const p = mesh(new T.SphereGeometry(0.12 + i * 0.04, 12, 8), S({ color: 0xffffff, transparent: true, opacity: 0.6 - i * 0.15, depthWrite: false }), 0.6 + 0.05 * i, 1.0 + i * 0.2, 0.55 - i * 0.05); piv.add(p); puff.push(p); }
        out.puff = puff;
        const g = mesh(new T.CylinderGeometry(0.15, 0.15, 0.06, 24), M({ color: 0xfff8e0 }), -0.5, 0.15, 0.2); g.rotation.z = Math.PI / 2; piv.add(g);
        piv.add(tube(V(0.45, 0.2, 0.6), V(0.45, 0.2, -1.2), 0.05, brass)); piv.add(tube(V(-0.45, 0.2, 0.6), V(-0.45, 0.2, -1.2), 0.05, brass));
      } },
    { id: 'riel', name: 'Cañón de Riel', f: 1.7, g: 350, desc: '+70 % de fuerza: tiro más rápido y recto',
      own: () => ({ body: M({ color: 0x2a3040, metalness: 0.9, roughness: 0.3 }), ring: M({ color: 0x8a96b0, metalness: 1, roughness: 0.15 }), wood: M({ color: 0x2a3040, roughness: 0.4, metalness: 0.8 }), hub: M({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 1.4 }) }),
      make(piv, root, k, o, out) {
        const glow = M({ color: 0x00e5ff, emissive: 0x00a8ff, emissiveIntensity: 2 });
        [-0.22, 0.22].forEach(x => piv.add(mesh(new T.BoxGeometry(0.12, 0.3, 2.6), k.ring, x, 0, -0.75)));
        for (let i = 0; i < 6; i++) piv.add(mesh(new T.TorusGeometry(0.36, 0.05, 10, 28), glow, 0, 0, 0.2 - i * 0.38));
        piv.add(mesh(new T.BoxGeometry(0.7, 0.5, 0.6), k.body, 0, 0, 0.45));
        holder(piv, out, 0, 0, -1.75, 0.22);
        carriage(root, k, {});
      } },
    { id: 'cohete', name: 'Lanzacohetes', f: 2, boom: true, g: 400, desc: '+100 % de fuerza y cada bola hace una pequeña explosión al chocar que empuja los bloques',
      own: () => ({ body: M({ color: 0xffffff, metalness: 0.1, roughness: 0.3, clearcoat: 1 }), ring: M({ color: 0xff3a3a, metalness: 0.3, roughness: 0.3, clearcoat: 1 }), wood: M({ color: 0x3a2f6e, roughness: 0.4, metalness: 0.4 }) }),
      make(piv, root, k, o, out) {
        const tb = mesh(new T.CylinderGeometry(0.4, 0.4, 2.1, 32, 1, true), k.body, 0, 0, -0.55); tb.rotation.x = Math.PI / 2; piv.add(tb);
        const nose = mesh(new T.ConeGeometry(0.36, 0.6, 32), k.ring, 0, 0, -1.85); nose.rotation.x = -Math.PI / 2; piv.add(nose);
        [-1.0, -0.2].forEach(z => { const b = mesh(new T.CylinderGeometry(0.41, 0.41, 0.18, 32, 1, true), k.ring, 0, 0, z); b.rotation.x = Math.PI / 2; piv.add(b); });
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, f = mesh(new T.BoxGeometry(0.05, 0.45, 0.6), k.ring, Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0.35); f.rotation.z = a - Math.PI / 2; piv.add(f); }
        const noz = mesh(new T.CylinderGeometry(0.3, 0.22, 0.3, 24), M({ color: 0x333344, metalness: 0.9, roughness: 0.3 }), 0, 0, 0.6); noz.rotation.x = Math.PI / 2; piv.add(noz);
        const fl = mesh(new T.ConeGeometry(0.22, 0.7, 20), B({ color: 0xffb21a, transparent: true, opacity: 0.85, depthWrite: false }), 0, 0, 1.05); fl.rotation.x = Math.PI / 2; piv.add(fl); out.flame = fl;
        // ventanilla: se ve el color de la bola cargada
        const win = mesh(new T.SphereGeometry(0.15, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), S({ color: 0x5fd4ff }), 0, 0.36, -0.6); piv.add(win); out.tint.push(win);
        carriage(root, k, {});
      } },
  ];
  const MODEL = {}; for (const m of MODELS) MODEL[m.id] = m;

  // ---------------- juntar piezas (menos llamadas de dibujo en móviles modestos) ----------------
  // Las piezas fijas con el mismo material se funden en una sola malla: el cañón de nivel 5 pasa de ~40 dibujos a ~10.
  function mergeGeos(items) {
    const geos = items.map(([g, m]) => {
      const c = g.clone(); c.applyMatrix4(m);
      if (!c.index) { const n = c.attributes.position.count, a = new Uint32Array(n); for (let i = 0; i < n; i++) a[i] = i; c.setIndex(new T.BufferAttribute(a, 1)); }
      return c;
    });
    const hasUv = geos.every(g => g.attributes.uv);
    let nv = 0, ni = 0; for (const g of geos) { nv += g.attributes.position.count; ni += g.index.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = hasUv ? new Float32Array(nv * 2) : null, idx = new Uint32Array(ni);
    let vo = 0, io = 0;
    for (const g of geos) {
      pos.set(g.attributes.position.array, vo * 3); nor.set(g.attributes.normal.array, vo * 3); if (uv) uv.set(g.attributes.uv.array, vo * 2);
      const ia = g.index.array; for (let i = 0; i < ia.length; i++) idx[io + i] = ia[i] + vo;
      vo += g.attributes.position.count; io += ia.length; g.dispose();
    }
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('normal', new T.BufferAttribute(nor, 3));
    if (uv) out.setAttribute('uv', new T.BufferAttribute(uv, 2));
    out.setIndex(new T.BufferAttribute(idx, 1)); out.computeBoundingSphere();
    return out;
  }
  function mergeStatic(parent, skip) {
    const by = new Map();
    for (const o of parent.children) {
      if (!o.isMesh || o.isInstancedMesh || o.children.length || skip.has(o)) continue;
      const a = o.geometry.attributes; if (!a.position || !a.normal || a.position.isInterleavedBufferAttribute) continue;
      if (!by.has(o.material)) by.set(o.material, []);
      by.get(o.material).push(o);
    }
    for (const [mat, list] of by) {
      if (list.length < 2) continue;
      const geo = mergeGeos(list.map(o => { o.updateMatrix(); return [o.geometry, o.matrix]; }));
      for (const o of list) { parent.remove(o); if (!o.geometry.userData.keep) o.geometry.dispose(); }
      parent.add(new T.Mesh(geo, mat));
    }
  }

  // ---------------- montar el cañón ----------------
  function dispose(o) {
    if (o.userData && o.userData.ball) return;   // la bola cargada la pone el juego (geometría y material compartidos)
    for (const c of o.children) dispose(c);
    if (o.isMesh) {
      if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose();
      for (const m of [].concat(o.material)) if (m && !m.userData.keep) m.dispose();
    }
  }
  function clear(g, except) { for (const o of g.children.slice()) { if (o === except) continue; g.remove(o); dispose(o); } }
  const ownCache = {};
  // o: { skin, model, lv } → { holders: [grupos donde va la bola cargada], tint: [piezas que toman el color de la bola] }
  function build(root, piv, o) {
    clear(root, piv); clear(piv);
    const sk = SKIN[o.skin] || SKIN.classic, md = MODEL[o.model] || MODEL.base;
    let k = Object.assign({}, skinMats(sk.id));
    if (md.own && sk.id === 'classic') {
      if (!ownCache[md.id]) { const m = md.own(); for (const n in m) keep(m[n]); ownCache[md.id] = m; }
      k = Object.assign(k, ownCache[md.id]);
    }
    const out = { holders: [], tint: [], model: md.id };
    md.make(piv, root, k, { lv: o.lv || 1, spokes: sk.spokes }, out);
    if (sk.x && md.id === 'base') sk.x(piv, root, k);       // adornos del aspecto (en el cañón normal)
    const skip = new Set([].concat(out.tint, out.puff || [], out.flame ? [out.flame] : []));
    mergeStatic(piv, skip); mergeStatic(root, skip);
    root.traverse(x => { if (x.isMesh) x.castShadow = false; });
    return out;
  }
  // animación suave (humo del vapor, llama del cohete)
  function tick(out, t) {
    if (!out) return;
    if (out.puff) out.puff.forEach((p, i) => { const k = ((t * 0.6 + i / 3) % 1); p.position.y = 0.95 + k * 0.7; p.material.opacity = 0.6 * (1 - k); p.scale.setScalar(0.7 + k * 0.8); });
    if (out.flame) { const s = 0.85 + 0.2 * Math.sin(t * 30); out.flame.scale.set(1, s, 1); }
  }

  // ---------------- aspectos de las bolas ----------------
  // mk(c): Object3D de radio 0.85 (el juego lo escala al radio de la bola). Solo cambian las bolas de color.
  const R0 = 0.85;
  const css = c => '#' + new T.Color(COL[c]).getHexString();
  const dark = (c, k) => '#' + new T.Color(COL[c]).multiplyScalar(k).getHexString();
  const light = (c, k) => '#' + new T.Color(COL[c]).lerp(new T.Color(0xffffff), k).getHexString();
  const G = {};                                   // geometrías compartidas
  const geo = (k, f) => { if (!G[k]) { G[k] = f(); G[k].userData.keep = 1; } return G[k]; };
  const sph = (r) => geo('s' + (r || R0), () => new T.SphereGeometry(r || R0, 32, 20));
  const bm = {};                                  // materiales por aspecto y color
  const mat = (k, f) => bm[k] || (bm[k] = keep(f()));
  const jellyM = c => mat('j' + c, () => new T.MeshPhysicalMaterial({ color: COL[c], roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.18, envMapIntensity: 0.45, emissive: new T.Color(COL[c]).multiplyScalar(0.12) }));
  const texM = (k, c, draw, o) => mat(k + c, () => new T.MeshPhysicalMaterial(Object.assign({ map: tex('b' + k + c, 512, 256, (g, w, h) => draw(g, w, h, c)), roughness: 0.3, clearcoat: 0.8, envMapIntensity: 0.5 }, o || {})));
  const grp = (...ms) => { const g = new T.Group(); for (const m of ms) g.add(m); return g; };
  const one = (g, m) => new T.Mesh(g, m);
  const BALLS = [
    { id: 'clasica', name: 'Gominola', rar: 'base', how: 'free', desc: 'La de siempre', mk: null },
    { id: 'playa', name: 'Pelota de playa', rar: 'common', how: 'shop', c: 1500, desc: 'Gajos de su color y blanco',
      mk: c => one(sph(), texM('playa', c, (x, w, h, c) => { for (let i = 0; i < 6; i++) { x.fillStyle = i % 2 ? '#ffffff' : css(c); x.fillRect(i * w / 6, 0, w / 6 + 1, h); } x.fillStyle = '#fff'; x.fillRect(0, 0, w, 14); x.fillRect(0, h - 14, w, 14); })) },
    { id: 'futbol', name: 'Balón', rar: 'common', how: 'shop', c: 2000, desc: 'Parches oscuros de su color',
      mk: c => { const k = mat('fb' + c, () => new T.MeshPhysicalMaterial({ color: dark(c, 0.45), roughness: 0.4, clearcoat: 0.6 }));
        const patches = geo('fbpatches', () => {        // 12 parches pentagonales en una sola geometría
          const ico = new T.IcosahedronGeometry(0.86, 0), pos = ico.attributes.position, seen = [], items = [], pg = new T.CircleGeometry(0.2, 5), o = new T.Object3D();
          for (let i = 0; i < pos.count; i++) { const v = new T.Vector3().fromBufferAttribute(pos, i).normalize(); if (seen.some(u => u.distanceTo(v) < 0.1)) continue; seen.push(v); o.position.copy(v).multiplyScalar(0.855); o.lookAt(v.clone().multiplyScalar(2)); o.updateMatrix(); items.push([pg, o.matrix.clone()]); }
          const g = mergeGeos(items); ico.dispose(); pg.dispose(); return g; });
        return grp(one(sph(), jellyM(c)), one(patches, k)); } },
    { id: 'billar', name: 'Bola de billar', rar: 'common', how: 'shop', c: 2500, desc: 'Círculo blanco con número',
      mk: c => { const n = { r: 3, b: 2, g: 6, y: 1, p: 4 }[c]; return one(sph(), texM('billar', c, (x, w, h, c) => { x.fillStyle = css(c); x.fillRect(0, 0, w, h); for (const u of [0, 0.25, 0.5, 0.75, 1]) { x.fillStyle = '#fff'; x.beginPath(); x.ellipse(w * u, h / 2, 30, 46, 0, 0, 7); x.fill(); if (u) { x.fillStyle = '#111'; x.font = 'bold 50px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(n, w * u, h / 2 + 2); } } }, { roughness: 0.08, clearcoat: 1 })); } },
    { id: 'canica', name: 'Canica', rar: 'rare', how: 'shop', g: 40, desc: 'Cristal con remolino de su color',
      mk: c => grp(one(geo('knot', () => new T.TorusKnotGeometry(0.3, 0.07, 64, 8, 2, 3)), mat('ck' + c, () => new T.MeshPhysicalMaterial({ color: COL[c], emissive: COL[c], emissiveIntensity: 0.35, roughness: 0.3 }))),
        one(sph(), mat('cg' + c, () => new T.MeshPhysicalMaterial({ color: light(c, 0.75), transparent: true, opacity: 0.42, roughness: 0, metalness: 0, clearcoat: 1, envMapIntensity: 1.4, depthWrite: false })))) },
    { id: 'planeta', name: 'Planeta', rar: 'rare', how: 'shop', g: 50, desc: 'Con anillo como Saturno',
      mk: c => { const ring = one(geo('pring', () => new T.RingGeometry(0.95, 1.2, 40)), mat('pr' + c, () => new T.MeshStandardMaterial({ color: light(c, 0.55), side: T.DoubleSide, transparent: true, opacity: 0.9 }))); ring.rotation.x = Math.PI / 2.3;
        return grp(one(sph(0.74), texM('planeta', c, (x, w, h, c) => { for (let i = 0; i < 9; i++) { x.fillStyle = i % 2 ? css(c) : light(c, 0.35); x.fillRect(0, i * h / 9, w, h / 9 + 1); } })), ring); } },
    { id: 'carita', name: 'Carita', rar: 'rare', how: 'shop', g: 50, desc: 'Con ojos y sonrisa',
      mk: c => { const w = mat('cw', () => new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.2 })), k = mat('ck', () => new T.MeshBasicMaterial({ color: 0x1d1440 }));
        const at = (x, y, z, rz) => { const o = new T.Object3D(); o.position.set(x, y, z); o.rotation.z = rz || 0; o.updateMatrix(); return o.matrix; };
        const eyes = geo('eyes', () => { const e = new T.SphereGeometry(0.17, 14, 10), g = mergeGeos([[e, at(-0.27, 0.2, 0.72)], [e, at(0.27, 0.2, 0.72)]]); e.dispose(); return g; });
        const face = geo('face', () => { const p = new T.SphereGeometry(0.09, 10, 8), sm = new T.TorusGeometry(0.17, 0.035, 8, 20, Math.PI), g = mergeGeos([[p, at(-0.27, 0.2, 0.87)], [p, at(0.27, 0.2, 0.87)], [sm, at(0, -0.15, 0.8, Math.PI)]]); p.dispose(); sm.dispose(); return g; });
        return grp(one(sph(), jellyM(c)), one(eyes, w), one(face, k)); } },
    { id: 'frutas', name: 'Frutas', rar: 'epic', how: 'shop', g: 80, desc: 'Fresa, arándano, lima, limón y uva',
      mk: c => { const leaf = mat('leaf', () => new T.MeshPhysicalMaterial({ color: 0x2f9a3a, roughness: 0.5 })), g = new T.Group();
        if (c === 'r') g.add(one(sph(), texM('fresa', c, (x, w, h) => { x.fillStyle = css('r'); x.fillRect(0, 0, w, h); x.fillStyle = '#ffe680'; for (let i = 0; i < 70; i++) { x.beginPath(); x.ellipse((i * 53) % w, (i * 37) % h, 3, 5, 0, 0, 7); x.fill(); } })));
        else if (c === 'y') { const l = one(sph(), texM('limon', c, (x, w, h) => { x.fillStyle = css('y'); x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(200,150,0,.25)'; for (let i = 0; i < 200; i++) { x.beginPath(); x.arc((i * 47) % w, (i * 29) % h, 2, 0, 7); x.fill(); } })); l.scale.set(1, 0.88, 0.88); g.add(l); }
        else if (c === 'p') [[0, 0.3, 0], [-0.35, -0.05, 0.1], [0.35, -0.05, 0.1], [0, -0.42, 0.15], [0, 0, 0.4], [0, 0, -0.38]].forEach(q => { const m = one(sph(0.42), jellyM('p')); m.position.set(q[0], q[1], q[2]); g.add(m); });
        else g.add(one(sph(), jellyM(c)));
        const st = one(geo('stem', () => new T.ConeGeometry(0.2, 0.25, 6)), leaf); st.position.y = c === 'p' ? 0.7 : 0.86; g.add(st); return g; } },
    { id: 'rayo', name: 'Eléctrica', rar: 'epic', how: 'shop', g: 100, desc: 'Rayos que brillan en su color',
      mk: c => { const t = tex('rayo' + c, 512, 256, (x, w, h) => { x.fillStyle = dark(c, 0.55); x.fillRect(0, 0, w, h); x.strokeStyle = light(c, 0.6); x.lineWidth = 7; x.shadowColor = css(c); x.shadowBlur = 18; for (let k = 0; k < 6; k++) { let px = k * 90, py = 0; x.beginPath(); x.moveTo(px, py); while (py < h) { px += Math.sin(k * 7 + py) * 30; py += 30; x.lineTo(px, py); } x.stroke(); } });
        return one(sph(), mat('rayo' + c, () => new T.MeshPhysicalMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.8, roughness: 0.3, clearcoat: 1 }))); } },
    { id: 'gema', name: 'Gema', rar: 'legend', how: 'temp', g: 180, desc: 'Tallada en facetas',
      mk: c => one(geo('ico', () => new T.IcosahedronGeometry(0.9, 1)), mat('gema' + c, () => new T.MeshPhysicalMaterial({ color: COL[c], roughness: 0.04, metalness: 0.35, clearcoat: 1, flatShading: true, iridescence: 0.6, emissive: new T.Color(COL[c]).multiplyScalar(0.2) }))) },
    { id: 'pixel', name: 'Píxel', rar: 'legend', how: 'temp', g: 200, desc: 'Hecha de cubitos',
      mk: c => { const cells = geo('pxl', () => { const a = []; for (let x = -3; x <= 3; x++) for (let y = -3; y <= 3; y++) for (let z = -3; z <= 3; z++) { const d = Math.hypot(x, y, z); if (d <= 3.4 && d >= 2.4) a.push([x, y, z]); } const gg = new T.BoxGeometry(0.25, 0.25, 0.25); gg.userData.cells = a; return gg; });
        const list = cells.userData.cells, im = new T.InstancedMesh(cells, mat('px' + c, () => new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, clearcoat: 0.6 })), list.length);
        const cs = [new T.Color(COL[c]), new T.Color(light(c, 0.35)), new T.Color(dark(c, 0.7))], m4 = new T.Matrix4();
        list.forEach((p, i) => { m4.makeTranslation(p[0] * 0.25, p[1] * 0.25, p[2] * 0.25); im.setMatrixAt(i, m4); im.setColorAt(i, cs[(p[0] + p[1] * 2 + p[2] * 3 + 30) % 3]); });
        im.userData.inst = 1; return im; } },
    { id: 'dragonb', name: 'Huevo de dragón', rar: 'pass', how: 'pass', desc: 'Escamas de su color',
      mk: c => { const m = one(sph(), texM('dragonb', c, (x, w, h, c) => { x.fillStyle = dark(c, 0.6); x.fillRect(0, 0, w, h); for (let yy = -1; yy < 10; yy++) for (let xx = -1; xx < 18; xx++) { const cx = xx * 32 + (yy % 2) * 16, cy = yy * 28, gr = x.createRadialGradient(cx, cy + 6, 2, cx, cy + 6, 20); gr.addColorStop(0, light(c, 0.5)); gr.addColorStop(0.7, css(c)); gr.addColorStop(1, dark(c, 0.4)); x.fillStyle = gr; x.beginPath(); x.arc(cx, cy, 17, 0, Math.PI); x.fill(); } })); m.scale.set(0.92, 1.06, 0.92); return m; } },
  ];
  const BALL = {}; for (const b of BALLS) BALL[b.id] = b;
  // bola con aspecto (o null: la de siempre). r: radio de la bola en el juego
  function ballMesh(id, c, r) {
    const b = BALL[id]; if (!b || !b.mk || !COL[c]) return null;
    const inner = b.mk(c), g = new T.Group(); g.add(inner); inner.scale.multiplyScalar(r / R0);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.userData.skin = id;
    return g;
  }
  // al quitar una bola de la escena: solo se borra lo que no se comparte
  function freeBall(g) { g.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); }

  // ---------------- miniaturas para la tienda ----------------
  // Se pintan poco a poco con un WebGL propio (una a una, sin parar el juego) y se guardan mientras dura la partida.
  const thumbs = {}, queue = []; let tr = null, tsc = null, tcam = null, tcam2 = null, troot = null, tpiv = null, busy = false, idle = 0, env = null;
  function thumbKey(q) { return q.kind + ':' + q.id + (q.lv ? ':' + q.lv : ''); }
  function setup() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 192;
    tr = new T.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true });
    tr.setClearColor(0x000000, 0); tr.outputColorSpace = T.SRGBColorSpace; tr.toneMapping = T.NeutralToneMapping; tr.toneMappingExposure = 1.0;
    tsc = new T.Scene(); tsc.environment = env;
    tsc.add(new T.HemisphereLight(0xffffff, 0x6a5aa0, 1.6));
    const sun = new T.DirectionalLight(0xffffff, 2.6); sun.position.set(4, 7, 5); tsc.add(sun);
    const rim = new T.DirectionalLight(0xa8c8ff, 1.2); rim.position.set(-5, 3, -4); tsc.add(rim);
    tcam = new T.PerspectiveCamera(30, 1, 0.1, 100); tcam.position.set(5.7, 2.5, -2.3); tcam.lookAt(0, 0.05, -0.8);
    tcam2 = new T.PerspectiveCamera(30, 1, 0.1, 100); tcam2.position.set(0, 0.6, 7.2); tcam2.lookAt(0, 0, 0);
    troot = new T.Group(); tpiv = new T.Group(); troot.add(tpiv); tsc.add(troot);
  }
  function renderOne(q) {
    if (!tr) setup();
    let url = '';
    try {
      if (q.kind === 'ball') {
        clear(troot, tpiv); clear(tpiv); tpiv.rotation.set(0, 0, 0); troot.rotation.set(0, 0, 0); troot.position.set(0, 0, 0);
        const spots = [['r', -0.95, -0.55], ['y', 0.95, -0.55], ['b', 0, 0.75]];
        for (const [c, x, y] of spots) { const m = BALL[q.id] && BALL[q.id].mk ? ballMesh(q.id, c, 0.85) : new T.Mesh(sph(), jellyM(c)); m.position.set(x, y, 0); m.rotation.set(0.25, -0.5, 0); m.userData.ball = 1; troot.add(m); }
        tr.render(tsc, tcam2);
        url = tr.domElement.toDataURL('image/png');
        for (const o of troot.children.slice()) if (o !== tpiv) { troot.remove(o); freeBall(o); }
      } else {
        build(troot, tpiv, { skin: q.kind === 'skin' ? q.id : 'classic', model: q.kind === 'model' ? q.id : 'base', lv: q.lv || 1 });
        tpiv.rotation.set(0.32, 0, 0); troot.rotation.y = 0.15; troot.position.set(0, 0.1, 0);
        tr.render(tsc, tcam);
        url = tr.domElement.toDataURL('image/png');
        clear(troot, tpiv); clear(tpiv);
      }
    } catch (e) { url = ''; }
    return url;
  }
  function pump() {
    if (!queue.length) { busy = false; clearTimeout(idle); idle = setTimeout(() => { if (!queue.length && tr) { try { tr.dispose(); if (tr.forceContextLoss) tr.forceContextLoss(); } catch (e) { /* nada */ } tr = null; } }, 8000); return; }
    busy = true;
    const q = queue.shift(), key = thumbKey(q);
    if (!(key in thumbs)) { thumbs[key] = renderOne(q); if (q.cb) try { q.cb(key, thumbs[key]); } catch (e) { /* nada */ } }
    else if (q.cb) try { q.cb(key, thumbs[key]); } catch (e) { /* nada */ }
    setTimeout(pump, 16);
  }
  // pide miniaturas: cb(clave, imagen) cuando esté cada una (si ya estaba, al momento)
  function thumb(list, cb) {
    for (const q of list) { const key = thumbKey(q); if (key in thumbs) { cb(key, thumbs[key]); continue; } queue.push(Object.assign({ cb }, q)); }
    if (!busy && queue.length) { busy = true; setTimeout(pump, 0); }
  }

  // ---------------- fuerza del cañón ----------------
  // f total = cañón × mejora. En la física: parte va en la velocidad (tiro más rápido y recto, como mucho ×1,5) y el resto en
  // el peso de la bola, de modo que el empujón (cantidad de movimiento) sale multiplicado por f.
  function power(model, lv) {
    const md = MODEL[model] || MODEL.base, up = UPGRADES[Math.max(0, Math.min(4, (lv || 1) - 1))];
    const f = md.f * up.f;
    const s = md.heavy ? 1 : Math.min(1.5, 1 + 0.4 * (f - 1));
    return { f, speed: s, mass: f / s, boom: !!md.boom, combo: !!up.combo, aim: !!up.aim };
  }

  window.Cannons = { SKINS, SKIN, MODELS, MODEL, UPGRADES, BALLS, BALL, COL, hooks, build, tick, ballMesh, freeBall, thumb, thumbKey, power, thumbs, setEnv(e) { env = e; if (tsc) tsc.environment = e; } };
})();
