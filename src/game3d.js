// Rocket Rush — dibujo (three.js), controles, efectos, sonido, menús y guardado.
(function () {
  'use strict';
  const { Sim, C, WBALLS } = SimLib;
  const { LEVELS, BONUS, WORLDS, byId } = Levels;
  const $ = id => document.getElementById(id);
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ---------------- modo prueba ----------------
  // Permite desbloquear todos los niveles (y los niveles extra) desde Ajustes para probar el juego.
  // QUITAR AL PUBLICAR: compila con `node tools/build.js --release` y esto queda en false (sin botón).
  const TEST_MODE = true;

  // ---------------- guardado ----------------
  const SAVE_KEY = 'chromacrash3d.v1';
  const DEFAULT_SAVE = () => ({ unlocked: 1, stars: {}, best: {}, coins: 300, boosters: { bomb: 2, rainbow: 1, extra: 1, golden: 0 }, gems: 0, gemDry: 0, gemRoll: null, bonusGemRoll: {}, pass: null, skins: { owned: ['classic'], equip: 'classic' }, streak: 0, sound: true, vibe: true, music: true, adsRemoved: false, starter: false, played: 0, lastInter: 0 });
  let save;
  try { save = Object.assign(DEFAULT_SAVE(), JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { save = DEFAULT_SAVE(); }
  // partidas antiguas: los niveles extra eran 101-110; ahora son 10001-10100 (101-1000 son niveles normales)
  if (!save.bonusIds2) {
    for (const key of ['stars', 'best', 'bonusDone', 'bonusSeen', 'bonusGemRoll']) {
      const o = save[key]; if (!o) continue;
      for (let i = 101; i <= 110; i++) if (o[i] !== undefined) { o[10000 + i - 100] = o[i]; delete o[i]; }
    }
    save.bonusIds2 = true;
  }
  // mundos nuevos (cortos al principio, jefes y estrenos): cada nivel viejo se busca por su forma y conserva sus estrellas
  if (!save.worlds3) {
    const byOld = {};
    for (const l of LEVELS) { if (l.oid) byOld[l.oid] = l.id; else if (l.gid) byOld[l.gid] = l.id; }
    for (const key of ['stars', 'best']) {
      const o = save[key]; if (!o) continue; const n = {};
      for (const k in o) { const id = +k; if (id >= 10001) n[k] = o[k]; else if (byOld[id]) n[byOld[id]] = o[k]; }
      save[key] = n;
    }
    // el nivel abierto: justo después del último nivel viejo superado
    const old = save.unlocked || 1;
    let last = 0;
    for (const l of LEVELS) { const o = l.oid || l.gid; if (o && o < old) last = Math.max(last, l.id); }
    save.unlocked = Math.min(LEVELS.length, last + 1);
    save.worlds3 = true;
  }
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* sin almacenamiento */ } }

  // ---------------- audio ----------------
  const Audio = (() => {
    let ac = null, master = null, sfx = null, mus = null, noiseBuf = null, musicOn = false, musicTimer = null;
    let popRun = 0, popT = 0;
    function init() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain(); master.gain.value = 0.8; master.connect(ac.destination);
      sfx = ac.createGain(); sfx.gain.value = 0.9; sfx.connect(master);
      mus = ac.createGain(); mus.gain.value = 0.22; mus.connect(master);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 1.2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      if (save.music) startMusic();
    }
    const ok = () => ac && save.sound;
    function tone(freq, dur, type, vol, slide, when, dest) {
      const t = ac.currentTime + (when || 0);
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest || sfx); o.start(t); o.stop(t + dur + 0.02);
    }
    function noise(dur, vol, f0, f1, type, when) {
      const t = ac.currentTime + (when || 0);
      const s = ac.createBufferSource(); s.buffer = noiseBuf;
      const f = ac.createBiquadFilter(); f.type = type || 'lowpass';
      f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(sfx); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    }
    const A = {
      init,
      shoot() { if (!ok()) return; tone(140, 0.25, 'sine', 0.55, 0.4); noise(0.18, 0.35, 1800, 300); },
      pop(chain) {
        if (!ok()) return;
        const now = ac.currentTime;
        if (now - popT > 0.35) popRun = 0;
        popT = now; popRun = Math.min(popRun + 1, 14);
        const semis = popRun + (chain - 1) * 3;
        const f = 520 * Math.pow(2, semis / 12);
        tone(f, 0.12, 'sine', 0.32, 1.6); tone(f * 2, 0.06, 'triangle', 0.08, 1.2);
      },
      thud(v, stone) { if (!ok()) return; const vol = Math.min(0.5, 0.08 + v * 0.05); noise(0.12, vol, stone ? 900 : 500, 120); tone(stone ? 90 : 120, 0.12, 'sine', vol * 0.8, 0.6); },
      glass() { if (!ok()) return; for (let i = 0; i < 5; i++) tone(1800 + Math.random() * 2400, 0.18, 'triangle', 0.08, 0.9, i * 0.018); noise(0.25, 0.25, 4000, 9000, 'highpass'); },
      explode() { if (!ok()) return; noise(0.9, 0.9, 1200, 60); tone(70, 0.6, 'sine', 0.8, 0.35); },
      splash(s) { if (!ok()) return; noise(0.35, Math.min(0.35, 0.12 + s * 0.1), 2600, 300, 'bandpass'); },
      crown() { if (!ok()) return; [0, 4, 7, 12].forEach((n, i) => tone(660 * Math.pow(2, n / 12), 0.25, 'triangle', 0.22, 1, i * 0.07)); },
      cascade(c) { if (!ok()) return; tone(300, 0.3, 'sawtooth', 0.12, 3); tone(450, 0.3, 'square', 0.06, 2.5, 0.05); },
      swap() { if (!ok()) return; tone(700, 0.07, 'square', 0.08, 1.4); tone(980, 0.07, 'square', 0.06, 1.2, 0.05); },
      click() { if (!ok()) return; tone(880, 0.05, 'triangle', 0.15, 0.8); },
      special() { if (!ok()) return; [0, 5, 9, 12, 16].forEach((n, i) => tone(520 * Math.pow(2, n / 12), 0.2, 'square', 0.08, 1, i * 0.05)); },
      fuse() { if (!ok()) return; noise(0.14, 0.2, 5000, 2000, 'highpass'); },
      win() { if (!ok()) return; [0, 4, 7, 12, 7, 12, 16, 19].forEach((n, i) => tone(523 * Math.pow(2, n / 12), 0.3, 'triangle', 0.22, 1, i * 0.09)); },
      lose() { if (!ok()) return; [7, 4, 0, -5].forEach((n, i) => tone(392 * Math.pow(2, n / 12), 0.32, 'triangle', 0.18, 0.98, i * 0.14)); },
      star(i) { if (!ok()) return; tone(784 * Math.pow(2, i * 4 / 12), 0.35, 'triangle', 0.25, 1.01); tone(1568 * Math.pow(2, i * 4 / 12), 0.2, 'sine', 0.1, 1); },
      coin() { if (!ok()) return; tone(1320, 0.08, 'square', 0.07, 1); tone(1760, 0.12, 'square', 0.07, 1, 0.06); },
      chirp() { if (!ok()) return; tone(2200, 0.09, 'sine', 0.12, 1.5); tone(2600, 0.08, 'sine', 0.1, 1.4, 0.12); tone(2300, 0.1, 'sine', 0.1, 1.6, 0.24); },
      horn() { if (!ok()) return; tone(165, 0.9, 'sawtooth', 0.08, 0.98); tone(220, 0.9, 'triangle', 0.08, 0.98); },
      startMusic, stopMusic,
    };
    // música generativa suave (4 acordes en bucle)
    function startMusic() {
      if (!ac || musicOn) return;
      musicOn = true;
      const chords = [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]];
      const root = 261.63, beat = 60 / 96;
      let bar = 0;
      const playBar = () => {
        if (!musicOn) return;
        const ch = chords[bar % 4];
        const fr = n => root * Math.pow(2, n / 12);
        tone(fr(ch[0] - 12), beat * 4, 'triangle', 0.35, 1, 0, mus);
        const arp = [0, 1, 2, 1, 0, 2, 1, 2];
        for (let i = 0; i < 8; i++) tone(fr(ch[arp[i]] + 12), beat * 0.45, 'sine', 0.18, 1, i * beat * 0.5, mus);
        bar++;
        musicTimer = setTimeout(playBar, beat * 4 * 1000);
      };
      playBar();
    }
    function stopMusic() { musicOn = false; clearTimeout(musicTimer); }
    return A;
  })();
  function vibe(ms) {
    if (!save.vibe) return;
    try {
      if (window.ChromaAndroid && window.ChromaAndroid.vibrate) window.ChromaAndroid.vibrate(Array.isArray(ms) ? ms.reduce((a, b) => a + b, 0) : ms);
      else if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) { /* sin vibración */ }
  }


  // ---------------- paleta ----------------
  const COL = { r: 0xff4f6d, b: 0x3d9bff, g: 0x5fd45a, y: 0xffd23f, p: 0xa66bff };
  const SWAP_COST = 10;   // precio de cambiar la bola del cañón por otra de la bandeja
  const CSSB = { r: 'bR', b: 'bB', g: 'bG', y: 'bY', p: 'bP', bomb: 'bBomb', rainbow: 'bRainbow', heavy: 'bHeavy', golden: 'bGolden' };
  const THEMES = {
    1: { top: 0x48a8ff, mid: 0x9fd8ff, hor: 0xffe8c4, fog: 0xcfe9ff, sea: 0x1f8fd6, sun: 0xfff0d0, hemi: [0xcfe9ff, 0x8a6a4a] },
    2: { top: 0x3b2c8f, mid: 0x9a6ad6, hor: 0xffb08a, fog: 0xc79ad6, sea: 0x3b55b0, sun: 0xffd2a8, hemi: [0xd8c2ff, 0x6a4a6a] },
    3: { top: 0x5fb6e8, mid: 0xc4ecff, hor: 0xffffff, fog: 0xe4f6ff, sea: 0x2f9ec9, sun: 0xf2fbff, hemi: [0xe8f8ff, 0x7a8aa0] },
    4: { top: 0x2f6fd6, mid: 0x7fb8f0, hor: 0xffc27a, fog: 0xf0c9a0, sea: 0x1a6fb8, sun: 0xffd9a0, hemi: [0xcfe2ff, 0x8a5a3a] },
    5: { top: 0x1f2a6b, mid: 0x5d4bb8, hor: 0xf59ad6, fog: 0xb28ad6, sea: 0x2a3f9a, sun: 0xffe2f2, hemi: [0xd6c8ff, 0x5a4a7a] },
    6: { top: 0x2f86e0, mid: 0x9fd0f5, hor: 0xffe0a0, fog: 0xf2d6a2, sea: 0x1f8fd6, sun: 0xfff0c8, hemi: [0xffe8c0, 0xb07a40], biome: 'desert' },
    7: { top: 0x5f9fd8, mid: 0xc8e4ff, hor: 0xf7fbff, fog: 0xe6f2ff, sea: 0x1f8fd6, sun: 0xf6fbff, hemi: [0xeaf6ff, 0x9fb0c8], biome: 'snow', fogNear: 40, fogFar: 150 },
    8: { top: 0x3a9a90, mid: 0x9fdcc4, hor: 0xe6f6d0, fog: 0xbfe0b8, sea: 0x1f8fd6, sun: 0xfff6d8, hemi: [0xe0ffd8, 0x3a6a2a], biome: 'jungle', fogNear: 38, fogFar: 135 },
    9: { top: 0x2a0f1e, mid: 0x7a2a2a, hor: 0xff8a3d, fog: 0x6e2a20, sea: 0x1f8fd6, sun: 0xffb070, hemi: [0xffb080, 0x4a1a1a], biome: 'volcano', fogNear: 40, fogFar: 160 },
    10: { top: 0x04051a, mid: 0x12123a, hor: 0x2a1f5a, fog: 0x0a0a22, sea: 0x1f8fd6, sun: 0xf2f6ff, hemi: [0xb8c0ff, 0x2a2440], biome: 'space', fogNear: 160, fogFar: 400 },
  };

  // ---------------- motor 3D ----------------
  const canvas = $('game');
  const mobile = Math.min(window.innerWidth, window.innerHeight) < 820;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 1.5);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 400);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;

  // ---------------- texturas por código ----------------
  function canvasTex(w, h, draw, srgb) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }
  function softCircle() {
    return canvasTex(64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
  }
  const TEX = { soft: softCircle() };
  // caras: ojos según el color (ayuda a daltónicos), tres expresiones
  function faceTex(c, mood) {
    return canvasTex(128, 128, (g) => {
      const ink = '#1d1440';
      const eye = (x, y, r) => {
        g.fillStyle = '#fff'; g.beginPath();
        if (c === 'b') { const s = r * 1.7; g.roundRect ? g.roundRect(x - s / 2, y - s / 2, s, s, r * 0.5) : g.rect(x - s / 2, y - s / 2, s, s); }
        else if (c === 'g') g.ellipse(x, y, r * 1.15, r * 0.85, 0, 0, TAU);
        else if (c === 'p') g.ellipse(x, y, r * 0.85, r * 1.15, 0, 0, TAU);
        else g.arc(x, y, r, 0, TAU);
        g.fill();
        g.lineWidth = 3; g.strokeStyle = 'rgba(29,20,64,0.35)'; g.stroke();
      };
      if (mood === 'blink') {
        g.strokeStyle = ink; g.lineWidth = 7; g.lineCap = 'round';
        g.beginPath(); g.moveTo(26, 54); g.lineTo(50, 54); g.moveTo(78, 54); g.lineTo(102, 54); g.stroke();
      } else {
        const r = mood === 'scared' ? 17 : 15;
        eye(38, 54, r); eye(90, 54, r);
        const pr = mood === 'scared' ? 6 : 8;
        g.fillStyle = ink;
        g.beginPath(); g.arc(40, 57, pr, 0, TAU); g.arc(92, 57, pr, 0, TAU); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(43, 53, pr * 0.38, 0, TAU); g.arc(95, 53, pr * 0.38, 0, TAU); g.fill();
        if (c === 'y') { g.strokeStyle = ink; g.lineWidth = 3; g.beginPath(); g.moveTo(24, 40); g.lineTo(18, 33); g.moveTo(104, 40); g.lineTo(110, 33); g.stroke(); }
      }
      g.strokeStyle = ink; g.lineWidth = 6; g.lineCap = 'round';
      if (mood === 'scared') { g.fillStyle = ink; g.beginPath(); g.ellipse(64, 92, 9, 11, 0, 0, TAU); g.fill(); }
      else { g.beginPath(); g.moveTo(52, 86); g.quadraticCurveTo(64, 98, 76, 86); g.stroke(); }
      g.fillStyle = 'rgba(255,110,150,0.45)'; g.beginPath(); g.arc(22, 80, 9, 0, TAU); g.arc(106, 80, 9, 0, TAU); g.fill();
    });
  }
  // gema: esmeralda de talla brillante (facetas planas que brillan con el entorno)
  const gemGeo = (() => {
    const pts = [[0, -0.62], [0.5, 0.02], [0.5, 0.1], [0.3, 0.36], [0, 0.36]].map(([x, y]) => new THREE.Vector2(x, y));
    const g = new THREE.LatheGeometry(pts, 8); g.computeVertexNormals(); return g;
  })();
  const gemMat = new THREE.MeshPhysicalMaterial({ color: 0x2ee59d, emissive: 0x13a86a, emissiveIntensity: 0.7, metalness: 0.15, roughness: 0.04,
    clearcoat: 1, clearcoatRoughness: 0, flatShading: true, envMapIntensity: 2.2 });
  // cubo que guarda una gema: cristal de su color, marco dorado y la gema girando dentro
  const gemCubeMat = {}, gemFrameMat = new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 0.9, roughness: 0.25, envMapIntensity: 1.5 });
  for (const c of 'rbgyp') gemCubeMat[c] = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(COL[c]).lerp(new THREE.Color(0xffffff), 0.6), roughness: 0.06, metalness: 0, clearcoat: 1,
    transparent: true, opacity: 0.42, emissive: 0x000000, envMapIntensity: 1.6, depthWrite: false });
  function gemFrame(w, h, d) {
    const grp = new THREE.Group(), t = Math.min(w, h, d) * 0.1;
    const bar = (sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), gemFrameMat); m.position.set(x, y, z); grp.add(m); };
    for (const sy of [-1, 1]) for (const sz of [-1, 1]) bar(w + t, t, t, 0, sy * h / 2, sz * d / 2);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bar(t, h + t, t, sx * w / 2, 0, sz * d / 2);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) bar(t, t, d + t, sx * w / 2, sy * h / 2, 0);
    return grp;
  }
  const FACES = {};
  for (const c of 'rbgyp') FACES[c] = { normal: faceTex(c, 'normal'), blink: faceTex(c, 'blink'), scared: faceTex(c, 'scared') };
  const stripeTex = canvasTex(128, 128, (g) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#7d7d7d';
    for (let y = -128; y < 256; y += 42) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y - 48); g.lineTo(128, y - 30); g.lineTo(0, y + 18); g.fill(); }
  });
  const bombBlockTex = canvasTex(128, 128, (g) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#8a8a8a';
    for (let y = 12; y < 128; y += 26) for (let x = 12 + ((y / 26) % 2) * 13; x < 128; x += 26) { g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill(); }
  });
  const stoneTex = canvasTex(128, 128, (g) => {
    g.fillStyle = '#a9a6bc'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 220; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(80,76,100,0.18)' : 'rgba(255,255,255,0.12)'; g.beginPath(); g.arc(Math.random() * 128, Math.random() * 128, Math.random() * 5 + 1, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(60,56,80,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(20, 30); g.lineTo(48, 52); g.lineTo(40, 80); g.moveTo(90, 100); g.lineTo(110, 70); g.stroke();
  });
  const tntTex = canvasTex(256, 256, (g) => {
    g.fillStyle = '#d9271f'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#a8170f'; for (let x = 10; x < 256; x += 42) g.fillRect(x, 0, 16, 256);
    g.fillStyle = '#fff1d0'; g.fillRect(0, 92, 256, 72);
    g.fillStyle = '#b81f1a'; g.font = '900 64px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TNT', 128, 130);
  });
  const deckTex = canvasTex(1024, 1024, (g) => {
    g.fillStyle = '#e9dcc0'; g.fillRect(0, 0, 1024, 1024);
    const t = 64;
    for (let y = 0; y < 1024; y += t) for (let x = 0; x < 1024; x += t) {
      g.fillStyle = ((x + y) / t) % 2 ? '#efe3c9' : '#e2d3b3'; g.fillRect(x + 2, y + 2, t - 4, t - 4);
    }
    g.strokeStyle = '#c99a3a'; g.lineWidth = 14; g.beginPath(); g.arc(512, 512, 470, 0, TAU); g.stroke();
    g.strokeStyle = '#8f6a2a'; g.lineWidth = 4; g.beginPath(); g.arc(512, 512, 452, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(255,200,61,0.35)';
    g.beginPath(); g.moveTo(400, 600); g.lineTo(400, 460); g.lineTo(456, 520); g.lineTo(512, 420); g.lineTo(568, 520); g.lineTo(624, 460); g.lineTo(624, 600); g.closePath(); g.fill();
  });
  const rainbowTex = canvasTex(256, 64, (g) => {
    const cols = ['#ff4f6d', '#ffd23f', '#5fd45a', '#3d9bff', '#a66bff'];
    for (let i = 0; i < 10; i++) { g.fillStyle = cols[i % 5]; g.fillRect(i * 25.6, 0, 26, 64); }
  });
  const fireTex = canvasTex(256, 128, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, '#5a0a06'); gr.addColorStop(0.45, '#d8320e'); gr.addColorStop(0.8, '#ff9a2a'); gr.addColorStop(1, '#ffe066');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 9; i++) {           // lenguas de fuego
      const x = i * 32 - 4, h = 50 + (i % 3) * 18;
      const f = g.createLinearGradient(0, 128, 0, 128 - h); f.addColorStop(0, 'rgba(255,230,110,.95)'); f.addColorStop(1, 'rgba(255,120,30,0)');
      g.fillStyle = f; g.beginPath(); g.moveTo(x, 128); g.quadraticCurveTo(x + 8, 128 - h * 0.6, x + 18, 128 - h); g.quadraticCurveTo(x + 22, 128 - h * 0.5, x + 36, 128); g.fill();
    }
  });
  // mar: mapa de normales a partir de ruido
  const seaNormal = (() => {
    const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d'), img = g.createImageData(N, N);
    const h = new Float32Array(N * N);
    for (let k = 0; k < 6; k++) {
      const fx = (k + 1) * 2, fy = (k % 3 + 1) * 2, ph = k * 1.7, amp = 1 / (k + 1);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) h[y * N + x] += amp * Math.sin((x / N) * TAU * fx + ph) * Math.cos((y / N) * TAU * fy + ph * 0.7);
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = h[y * N + (x + 1) % N] - h[y * N + (x - 1 + N) % N], dy = h[((y + 1) % N) * N + x] - h[((y - 1 + N) % N) * N + x];
      const nx = -dx * 2, ny = -dy * 2, nz = 1, l = Math.hypot(nx, ny, nz), i = (y * N + x) * 4;
      img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(30, 30);
    return t;
  })();

  // ---------------- materiales ----------------
  const jelly = {}, jellyStripe = {}, jellyBomb = {};
  for (const c of 'rbgyp') {
    const base = { color: COL[c], roughness: 0.32, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.18, envMapIntensity: 0.45, emissive: new THREE.Color(COL[c]).multiplyScalar(0.12) };
    jelly[c] = new THREE.MeshPhysicalMaterial(base);
    jellyStripe[c] = new THREE.MeshPhysicalMaterial(Object.assign({}, base, { map: stripeTex }));
    jellyBomb[c] = new THREE.MeshPhysicalMaterial(Object.assign({}, base, { map: bombBlockTex }));
  }
  const goldTex = canvasTex(128, 128, (g) => {
    const gr = g.createLinearGradient(0, 0, 128, 128); gr.addColorStop(0, '#fff3b0'); gr.addColorStop(0.5, '#ffc83d'); gr.addColorStop(1, '#c9890f');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(140,90,0,0.6)'; g.lineWidth = 6; g.strokeRect(10, 10, 108, 108);
    g.fillStyle = '#fff6c8'; g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 16 : 36; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); }
    g.closePath(); g.fill();
  });
  const iceMat = {};
  for (const c of 'rbgyp') iceMat[c] = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(COL[c]).lerp(new THREE.Color(0xffffff), 0.55), roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.3, transparent: true, opacity: 0.9 });
  const MAT = {
    gold: new THREE.MeshStandardMaterial({ map: goldTex, metalness: 0.85, roughness: 0.22, envMapIntensity: 1.4 }),
    stone: new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.92, metalness: 0, color: 0xd0cde0 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xcff3ff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.38, clearcoat: 1, envMapIntensity: 1.6, depthWrite: false }),
    tnt: new THREE.MeshStandardMaterial({ map: tntTex, roughness: 0.55 }),
    pop: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
  };
  // ---- bloques de los mundos nuevos ----
  const sandTex = canvasTex(128, 128, (g) => {
    g.fillStyle = '#e6bf78'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(150,100,40,0.22)' : 'rgba(255,240,200,0.3)'; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
    g.strokeStyle = 'rgba(255,236,190,0.45)'; g.lineWidth = 2;
    for (let y = 24; y < 128; y += 26) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(40, y - 5, 80, y + 5, 128, y - 1); g.stroke(); }
    g.strokeStyle = 'rgba(170,120,60,0.3)'; g.lineWidth = 6; g.strokeRect(3, 3, 122, 122);
  });
  const magmaTex = canvasTex(128, 128, (g) => {
    g.fillStyle = '#2b2026'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 160; i++) { g.fillStyle = 'rgba(80,60,70,0.5)'; g.beginPath(); g.arc(Math.random() * 128, Math.random() * 128, Math.random() * 6 + 2, 0, TAU); g.fill(); }
    g.strokeStyle = '#ff7a1a'; g.lineCap = 'round';
    const crack = (x, y, n) => { g.beginPath(); g.moveTo(x, y); for (let k = 0; k < n; k++) { x += rnd(-18, 18); y += rnd(-18, 18); g.lineTo(x, y); } g.stroke(); };
    g.lineWidth = 5; for (let i = 0; i < 5; i++) crack(rnd(10, 118), rnd(10, 118), 5);
    g.strokeStyle = '#ffe066'; g.lineWidth = 1.6; for (let i = 0; i < 4; i++) crack(rnd(10, 118), rnd(10, 118), 4);
  });
  const magmaGlow = canvasTex(128, 128, (g) => { const img = magmaTex.image; g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, 128, 128); for (let i = 0; i < d.data.length; i += 4) { const hot = d.data[i] > 180; d.data[i] = hot ? 255 : 0; d.data[i + 1] = hot ? 160 : 0; d.data[i + 2] = 0; } g.putImageData(d, 0, 0); });
  const scaleTex = canvasTex(128, 128, (g) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 136; y += 14) for (let x = (y / 14) % 2 ? 0 : 8; x < 136; x += 16) {
      g.fillStyle = 'rgba(0,0,0,0.13)'; g.beginPath(); g.arc(x, y, 8, 0, Math.PI); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(x - 2, y + 2, 2.5, 0, TAU); g.fill();
    }
  });
  const chamFaceTex = canvasTex(128, 128, (g) => {
    const ink = '#1d1440';
    for (const x of [36, 92]) {     // ojos de camaleón: torretas con espiral
      g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(x, 56, 21, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(29,20,64,0.55)'; g.lineWidth = 4; g.beginPath(); g.arc(x, 56, 21, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(29,20,64,0.35)'; g.lineWidth = 2.5; g.beginPath(); for (let a = 0; a < 9; a += 0.2) { const r = 3 + a * 1.9; g.lineTo(x + Math.cos(a * 2) * r, 56 + Math.sin(a * 2) * r); } g.stroke();
      g.fillStyle = ink; g.beginPath(); g.arc(x + (x < 64 ? 6 : -6), 54, 6.5, 0, TAU); g.fill();
    }
    g.strokeStyle = ink; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(42, 96); g.quadraticCurveTo(64, 104, 86, 92); g.stroke();
  });
  const jellyCham = {};
  for (const c of 'rbgyp') jellyCham[c] = new THREE.MeshPhysicalMaterial({ color: COL[c], map: scaleTex, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.2, sheen: 0.4 });
  const prizeMat = new THREE.MeshPhysicalMaterial({ color: 0xd8f4ff, roughness: 0.08, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.5, envMapIntensity: 1.8, depthWrite: false });
  const floatRingMat = new THREE.MeshBasicMaterial({ color: 0x7ff7ff, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
  Object.assign(MAT, {
    sand: new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1, metalness: 0 }),
    magma: new THREE.MeshStandardMaterial({ map: magmaTex, emissiveMap: magmaGlow, emissive: 0xff6a1a, emissiveIntensity: 1.3, roughness: 0.85 }),
  });
  const geoCache = {};
  function roundedGeo(w, h, d) {
    const k = `${w}|${h}|${d}`;
    if (!geoCache[k]) geoCache[k] = new THREE.RoundedBoxGeometry(w, h, d, 3, Math.min(0.14, Math.min(w, h, d) * 0.22));
    return geoCache[k];
  }
  const faceGeo = new THREE.PlaneGeometry(1, 1);

  // ---------------- escenario fijo ----------------
  const world = new THREE.Group(); scene.add(world);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, hor: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 hor; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.18 ? mix(mid, top, smoothstep(0.18, 0.75, h)) : mix(hor, mid, smoothstep(-0.05, 0.18, h)); gl_FragColor = vec4(c, 1.0); }',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), skyMat);
  scene.add(sky);
  const sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.soft, color: 0xfff3c4, transparent: true, depthWrite: false, fog: false }));
  sunDisc.scale.set(60, 60, 1); sunDisc.position.set(-70, 70, -200); scene.add(sunDisc);

  const hemi = new THREE.HemisphereLight(0xcfe9ff, 0x8a6a4a, 0.9); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.6);
  sun.position.set(7, 15, 9); sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 11, bottom: -5, near: 1, far: 50 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target);
  const flashLight = new THREE.PointLight(0xffb040, 0, 18, 2); scene.add(flashLight);

  // isla flotante de feria
  const island = new THREE.Group(); world.add(island);
  {
    const R = C.ISLAND_R;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.98, 0.5, 72), [
      new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.75 }),
      new THREE.MeshStandardMaterial({ color: 0x6b4f33, roughness: 0.9 }),
    ]);
    top.position.y = -0.25; top.receiveShadow = true; island.add(top);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.09, 10, 96), new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 0.8, roughness: 0.25 }));
    trim.rotation.x = Math.PI / 2; trim.position.y = 0.01; island.add(trim);
    const grass = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.02, R * 0.92, 0.7, 40), new THREE.MeshStandardMaterial({ color: 0x67c35a, roughness: 0.85 }));
    grass.position.y = -0.85; island.add(grass);
    const rockGeo = new THREE.ConeGeometry(R * 0.93, 5.5, 11, 4);
    const pos = rockGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y < 2.6) { pos.setX(i, pos.getX(i) * (0.85 + Math.sin(i * 7.3) * 0.12)); pos.setZ(i, pos.getZ(i) * (0.85 + Math.cos(i * 3.1) * 0.12)); } }
    rockGeo.computeVertexNormals();
    const rock = new THREE.Mesh(rockGeo, new THREE.MeshStandardMaterial({ color: 0x8a6448, roughness: 0.95, flatShading: true }));
    rock.rotation.x = Math.PI; rock.position.y = -3.95; island.add(rock);
    // banderines en la mitad trasera
    const posts = [];
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI + 0.25 + i * (Math.PI - 0.5) / 6;
      const x = Math.cos(a) * (R - 0.25), z = Math.sin(a) * (R - 0.25);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 3.2, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
      post.position.set(x, 1.6, z); post.castShadow = true; island.add(post);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 0.7, roughness: 0.3 }));
      knob.position.set(x, 3.25, z); island.add(knob);
      posts.push(new THREE.Vector3(x, 3.1, z));
    }
    const flagCols = [0xff4f6d, 0xffd23f, 0x5fd45a, 0x3d9bff, 0xa66bff];
    const tri = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.17, 0, 0), new THREE.Vector3(0.17, 0, 0), new THREE.Vector3(0, -0.42, 0)]);
    tri.computeVertexNormals();
    let fi = 0;
    for (let i = 0; i < posts.length - 1; i++) {
      const a = posts[i], b = posts[i + 1];
      const pts = [];
      for (let k = 0; k <= 12; k++) { const t = k / 12, p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * 0.55; pts.push(p); }
      island.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x5a4a7a })));
      for (let k = 1; k < 12; k += 2) {
        const f = new THREE.Mesh(tri, new THREE.MeshStandardMaterial({ color: flagCols[fi++ % 5], side: THREE.DoubleSide, roughness: 0.6 }));
        f.position.copy(pts[k]); f.lookAt(0, pts[k].y, 0); island.add(f);
      }
    }
  }
  // mar
  const seaMat = new THREE.MeshStandardMaterial({ color: 0x1f8fd6, roughness: 0.18, metalness: 0.1, normalMap: seaNormal, normalScale: new THREE.Vector2(0.6, 0.6), envMapIntensity: 0.9 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), seaMat);
  sea.rotation.x = -Math.PI / 2; sea.position.y = C.SEA_Y; scene.add(sea);
  // islas lejanas con castillos, nubes y globos
  const decor = new THREE.Group(); scene.add(decor);
  function farIsland(x, z, s, roofCol) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3 * s, 2.6 * s, 0.8 * s, 20), new THREE.MeshStandardMaterial({ color: 0x67c35a, roughness: 0.9 }));
    g.add(base);
    const rock = new THREE.Mesh(new THREE.ConeGeometry(2.7 * s, 5 * s, 9), new THREE.MeshStandardMaterial({ color: 0x8a6448, roughness: 0.95, flatShading: true }));
    rock.rotation.x = Math.PI; rock.position.y = -2.9 * s; g.add(rock);
    const wall = new THREE.MeshStandardMaterial({ color: 0xf3e9da, roughness: 0.8 }), roof = new THREE.MeshStandardMaterial({ color: roofCol, roughness: 0.6 });
    [[-1, 0, 2.2], [1.1, -0.4, 3.0], [0, 0.9, 1.6], [-0.2, -1, 2.6]].forEach(([tx, tz, th]) => {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.45 * s, 0.5 * s, th * s, 12), wall); t.position.set(tx * s, (0.4 + th / 2) * s, tz * s); g.add(t);
      const r = new THREE.Mesh(new THREE.ConeGeometry(0.62 * s, 1.1 * s, 12), roof); r.position.set(tx * s, (0.4 + th + 0.55) * s, tz * s); g.add(r);
    });
    g.position.set(x, -1 + Math.sin(x) * 1.5, z);
    decor.add(g); return g;
  }
  farIsland(-26, -38, 1.6, 0xff4f6d); farIsland(24, -46, 2.0, 0x3d9bff); farIsland(-5, -70, 2.6, 0xa66bff); farIsland(40, -20, 1.2, 0xffd23f);
  const clouds = [];
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.25 });
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    for (let k = 0; k < 5; k++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(rnd(1.4, 2.4), 2), cloudMat); s.position.set(k * 1.6 - 3, Math.sin(k) * 0.5, rnd(-0.6, 0.6)); s.scale.y = 0.7; g.add(s); }
    g.position.set(rnd(-60, 60), rnd(10, 26), rnd(-110, -35)); g.userData.v = rnd(0.3, 0.8);
    decor.add(g); clouds.push(g);
  }
  const balloons = [];
  [[-9, 9, -12, 0xff4f6d], [10, 11, -16, 0xffd23f], [-14, 14, -24, 0x5fd45a], [15, 7, -9, 0xa66bff]].forEach(([x, y, z, c]) => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, clearcoat: 1 })); b.scale.set(1, 1.2, 1); g.add(b);
    const basket = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), new THREE.MeshStandardMaterial({ color: 0x8a5a2a })); basket.position.y = -1.9; g.add(basket);
    g.position.set(x, y, z); g.userData.y0 = y; g.userData.ph = Math.random() * 6; decor.add(g); balloons.push(g);
  });


  // ---------------- paisajes de los mundos 6-10 ----------------
  // Cada paisaje tiene suelo y decorado (env), su propia plataforma y efectos propios. Se construyen la primera vez que hacen falta.
  const mats = {};
  const M = (k, o) => mats[k] || (mats[k] = new THREE.MeshStandardMaterial(o));
  function tiles(base, line, n, extra) {
    return canvasTex(256, 256, (g) => {
      g.fillStyle = base; g.fillRect(0, 0, 256, 256);
      const s = 256 / n;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        g.fillStyle = `rgba(0,0,0,${(Math.random() * 0.12).toFixed(2)})`; g.fillRect(x * s + 3, y * s + 3, s - 6, s - 6);
        if (extra) extra(g, x * s, y * s, s);
      }
      g.strokeStyle = line; g.lineWidth = 4;
      for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, 256); g.moveTo(0, i * s); g.lineTo(256, i * s); g.stroke(); }
    });
  }
  // plataforma: disco superior con su textura, borde y la parte de abajo de cada paisaje
  function makePlatform(o) {
    const g = new THREE.Group(), R = C.ISLAND_R;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.98, 0.5, 72), [o.side, o.top, o.side]);
    top.position.y = -0.25; top.receiveShadow = true; g.add(top);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.1, 10, 96), o.trim);
    trim.rotation.x = Math.PI / 2; trim.position.y = 0.01; g.add(trim);
    if (o.under) g.add(o.under);
    // postes en la mitad trasera, con guirnalda opcional
    const posts = [];
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI + 0.25 + i * (Math.PI - 0.5) / 6;
      const x = Math.cos(a) * (R - 0.25), z = Math.sin(a) * (R - 0.25);
      const p = o.post(i); p.position.set(x, 0, z); g.add(p);
      posts.push(new THREE.Vector3(x, o.postTop || 3.1, z));
    }
    if (o.flags) {
      const tri = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.17, 0, 0), new THREE.Vector3(0.17, 0, 0), new THREE.Vector3(0, -0.42, 0)]);
      tri.computeVertexNormals();
      let fi = 0;
      for (let i = 0; i < posts.length - 1; i++) {
        const a = posts[i], b = posts[i + 1], pts = [];
        for (let k = 0; k <= 12; k++) { const t = k / 12, p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * 0.55; pts.push(p); }
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: o.line || 0x5a4a7a })));
        for (let k = 1; k < 12; k += 2) {
          const f = new THREE.Mesh(tri, M('flag' + o.flags[fi % o.flags.length], { color: o.flags[fi % o.flags.length], side: THREE.DoubleSide, roughness: 0.6 })); fi++;
          f.position.copy(pts[k]); f.lookAt(0, pts[k].y, 0); g.add(f);
        }
      }
    }
    g.visible = false; world.add(g);
    return g;
  }
  // suelo ondulado a la altura del mar
  function ground(color, amp, fn, opts) {
    const geo = new THREE.PlaneGeometry(600, 600, 160, 160); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, fn(x, z) * amp); }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 1, metalness: 0 }, opts || {})));
    m.position.y = C.SEA_Y; m.receiveShadow = false;
    return m;
  }
  const around = (n, r0, r1, f, skipFront) => {   // reparte cosas alrededor (menos delante del cañón)
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, r = rnd(r0, r1), x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (skipFront && z > 4 && Math.abs(x) < 14) continue;
      f(x, z, i);
    }
  };
  function points(n, spread, color, size, place) {
    const geo = new THREE.BufferGeometry(), arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const p = place(i); arr[i * 3] = p[0]; arr[i * 3 + 1] = p[1]; arr[i * 3 + 2] = p[2]; }
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({ color, size, sizeAttenuation: size < 1, transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
  }

  function buildDesert() {
    const env = new THREE.Group();
    env.add(ground(0xe7b86b, 1, (x, z) => { const d = Math.hypot(x, z); const k = Math.min(1, Math.max(0, (d - 8) / 20)); return k * (2.4 * Math.sin(x * 0.045 + z * 0.02) * Math.cos(z * 0.05) + 1.1 * Math.sin(x * 0.12 - z * 0.08)); }));
    const stoneM = M('pyr', { color: 0xdaa75c, roughness: 0.9, flatShading: true });
    [[-38, -95, 22], [8, -128, 30], [52, -88, 16], [-95, 20, 20], [90, 55, 24], [-30, 110, 18]].forEach(([x, z, s]) => {
      const p = new THREE.Mesh(new THREE.ConeGeometry(s, s * 0.95, 4), stoneM); p.rotation.y = Math.PI / 4; p.position.set(x, C.SEA_Y + s * 0.45, z); env.add(p);
    });
    const mesaM = M('mesa', { color: 0xc0703a, roughness: 0.95, flatShading: true });
    [[-75, -60, 9], [85, -30, 7], [70, 95, 10]].forEach(([x, z, s]) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(s, s * 1.3, s * 1.6, 7), mesaM); m.position.set(x, C.SEA_Y + s * 0.8, z); env.add(m); });
    const cactusM = M('cactus', { color: 0x4f9a3e, roughness: 0.7 });
    around(26, 13, 70, (x, z) => {
      const c = new THREE.Group(), h = rnd(2.2, 4.2);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, h, 10), cactusM); t.position.y = h / 2; c.add(t);
      for (const sx of [-1, 1]) { if (Math.random() < 0.3) continue; const ah = rnd(0.8, 1.5), y = rnd(h * 0.35, h * 0.6);
        const a1 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.7, 8), cactusM); a1.rotation.z = Math.PI / 2; a1.position.set(sx * 0.6, y, 0); c.add(a1);
        const a2 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, ah, 8), cactusM); a2.position.set(sx * 0.92, y + ah / 2, 0); c.add(a2); }
      c.position.set(x, C.SEA_Y + 0.6, z); c.rotation.y = rnd(0, TAU); env.add(c);
    }, true);
    // palmeras del oasis
    const trunkM = M('palm', { color: 0x9a6a3a, roughness: 0.9 }), leafM = M('leaf', { color: 0x3fa14a, roughness: 0.7, side: THREE.DoubleSide });
    [[-16, -22], [-19, -18], [17, -20], [21, -25]].forEach(([x, z]) => {
      const p = new THREE.Group(), h = rnd(5, 7);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, h, 8), trunkM); t.position.y = h / 2; t.rotation.z = rnd(-0.15, 0.15); p.add(t);
      for (let k = 0; k < 6; k++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 3.2), leafM); l.position.set(0, h, 0); l.rotation.set(-1.1, k * TAU / 6, 0, 'YXZ'); l.translateY(1.4); p.add(l); }
      p.position.set(x, C.SEA_Y + 0.4, z); env.add(p);
    });
    const pool = new THREE.Mesh(new THREE.CircleGeometry(7, 32), new THREE.MeshStandardMaterial({ color: 0x2fb3c9, roughness: 0.15, metalness: 0.1 })); pool.rotation.x = -Math.PI / 2; pool.position.set(0, C.SEA_Y + 0.5, -22); env.add(pool);
    scene.add(env); env.visible = false;
    const sandstone = tiles('#e2b46e', 'rgba(140,90,40,0.55)', 6, (g, x, y, s) => { if (Math.random() < 0.15) { g.fillStyle = 'rgba(180,90,40,0.35)'; g.fillRect(x + s * 0.3, y + s * 0.3, s * 0.4, s * 0.4); } });
    const strata = canvasTex(64, 256, (g) => { const cs = ['#c4733a', '#d98c4c', '#b5652f', '#e3a060', '#a85a2a']; for (let y = 0; y < 256; y += 16) { g.fillStyle = cs[(y / 16) % cs.length]; g.fillRect(0, y, 64, 16); } });
    const under = new THREE.Mesh(new THREE.CylinderGeometry(C.ISLAND_R * 0.97, C.ISLAND_R * 0.6, 8, 28), new THREE.MeshStandardMaterial({ map: strata, roughness: 0.95, flatShading: true }));
    under.position.y = -4.4;
    const colM = M('dcol', { color: 0xe6c08a, roughness: 0.8 }), capM = M('dcap', { color: 0xffc83d, metalness: 0.8, roughness: 0.3 });
    const platform = makePlatform({ top: new THREE.MeshStandardMaterial({ map: sandstone, roughness: 0.9 }), side: M('dside', { color: 0xc98a4a, roughness: 0.9 }), trim: M('dtrim', { color: 0xc8602a, roughness: 0.6 }), under,
      flags: [0xff7a3d, 0xffd23f, 0x3dc8ff, 0xe24f6d], line: 0x6a4a2a,
      post: () => { const p = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 3.2, 10), colM); c.position.y = 1.6; p.add(c); const k = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 4), capM); k.position.y = 3.35; p.add(k); return p; } });
    return { env: [env], platform, splash: e => { for (let i = 0; i < 3; i++) spawnSprite(e.x + rnd(-0.6, 0.6), C.SEA_Y + 0.8, e.z, 0xe8c48a, 1.6 * e.s, 1.4, 1.1, { vy: 1.2, alpha: 0.7 }); spawnDebris(e.x, C.SEA_Y + 0.8, e.z, 0xd9a85b, 8, 4, 0.12, 0.8); } };
  }

  function buildSnow() {
    const env = new THREE.Group();
    env.add(ground(0xf4f8ff, 1, (x, z) => { const d = Math.hypot(x, z); const k = Math.min(1, Math.max(0, (d - 8) / 24)); return k * (1.6 * Math.sin(x * 0.06) * Math.cos(z * 0.05) + 0.8 * Math.sin(z * 0.13 + x * 0.04)); }, { roughness: 0.85, color: 0xeef5ff }));
    const rockM = M('mnt', { color: 0x8796b8, roughness: 0.95, flatShading: true }), capM = M('mntcap', { color: 0xffffff, roughness: 0.9, flatShading: true });
    for (let i = 0; i < 11; i++) {
      const a = -Math.PI / 2 + (i - 5) * 0.36 + (i > 8 ? 2.4 : 0), r = rnd(120, 165), s = rnd(26, 44);
      const m = new THREE.Group();
      const body = new THREE.Mesh(new THREE.ConeGeometry(s, s * 1.5, 7), rockM); body.position.y = s * 0.75; m.add(body);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(s * 0.42, s * 0.62, 7), capM); cap.position.y = s * 1.5 - s * 0.31 + 0.2; m.add(cap);
      m.position.set(Math.cos(a) * r, C.SEA_Y - 2, Math.sin(a) * r); m.rotation.y = rnd(0, TAU); env.add(m);
    }
    const pineM = M('pine', { color: 0x2e6b4a, roughness: 0.85, flatShading: true }), snowM = M('pinesnow', { color: 0xffffff, roughness: 0.9 });
    around(40, 13, 80, (x, z) => {
      const t = new THREE.Group(), s = rnd(0.8, 1.6);
      for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry((1.5 - k * 0.38) * s, 1.8 * s, 8), pineM); c.position.y = (1 + k * 1.05) * s; t.add(c);
        const sn = new THREE.Mesh(new THREE.ConeGeometry((0.7 - k * 0.15) * s, 0.7 * s, 8), snowM); sn.position.y = (1.6 + k * 1.05) * s; t.add(sn); }
      t.position.set(x, C.SEA_Y + 0.3, z); env.add(t);
    }, true);
    // nieve cayendo
    const flakes = points(700, 0, 0xffffff, 0.16, () => [rnd(-30, 30), rnd(-6, 26), rnd(-40, 14)]);
    flakes.material.sizeAttenuation = true; env.add(flakes);
    scene.add(env); env.visible = false;
    const snowTop = canvasTex(256, 256, (g) => { g.fillStyle = '#f6fbff'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 500; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(150,190,230,0.18)' : 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, Math.random() * 6 + 1, 0, TAU); g.fill(); } });
    const iceM = new THREE.MeshPhysicalMaterial({ color: 0x9fd8ff, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.88, envMapIntensity: 1.5, flatShading: true });
    const under = new THREE.Group();
    const berg = new THREE.Mesh(new THREE.ConeGeometry(C.ISLAND_R * 0.97, 6.5, 9, 3), iceM); berg.rotation.x = Math.PI; berg.position.y = -3.75; under.add(berg);
    for (let i = 0; i < 18; i++) { const a = i / 18 * TAU, h = rnd(0.6, 1.6); const ic = new THREE.Mesh(new THREE.ConeGeometry(0.16, h, 6), iceM); ic.rotation.x = Math.PI; ic.position.set(Math.cos(a) * (C.ISLAND_R - 0.2), -0.5 - h / 2, Math.sin(a) * (C.ISLAND_R - 0.2)); under.add(ic); }
    const poleM = M('icepole', { color: 0xcdeeff, roughness: 0.2, metalness: 0.2 });
    const platform = makePlatform({ top: new THREE.MeshStandardMaterial({ map: snowTop, roughness: 0.85 }), side: M('sside', { color: 0xd6ecff, roughness: 0.6 }), trim: M('strim', { color: 0x7fd0ff, roughness: 0.2, metalness: 0.3, emissive: 0x1a4a6a }), under,
      flags: [0xffffff, 0x7fd0ff, 0x3d8bff], line: 0x3a5a8a,
      post: () => { const p = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 3.2, 8), poleM); c.position.y = 1.6; p.add(c); const k = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), M('sflake', { color: 0xffffff, emissive: 0x6ab8ff, emissiveIntensity: 0.4 })); k.position.y = 3.3; p.add(k); return p; } });
    return { env: [env], platform,
      update: (dt) => { const a = flakes.geometry.attributes.position; for (let i = 0; i < a.count; i++) { let y = a.getY(i) - dt * 1.4; if (y < -6) y = 26; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(G.t + i) * dt * 0.3); } a.needsUpdate = true; },
      splash: e => { for (let i = 0; i < 3; i++) spawnSprite(e.x + rnd(-0.6, 0.6), C.SEA_Y + 0.6, e.z, 0xffffff, 1.6 * e.s, 1.4, 1.1, { vy: 1.2, alpha: 0.85 }); spawnDebris(e.x, C.SEA_Y + 0.6, e.z, 0xeef6ff, 8, 4, 0.12, 0.8); } };
  }

  function buildJungle() {
    const env = new THREE.Group();
    env.add(ground(0x2f7a3a, 1, (x, z) => 0.8 * Math.sin(x * 0.1) * Math.cos(z * 0.08), { roughness: 0.95 }));
    const leafMs = [0x2f8a3e, 0x3fa34a, 0x247035, 0x58b84a].map((c, i) => M('jl' + i, { color: c, roughness: 0.85, flatShading: true }));
    const barkM = M('bark', { color: 0x6b4423, roughness: 0.95 });
    const crown = (x, y, z, s) => { const g = new THREE.Group(); for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(s * rnd(0.7, 1.1), 1), leafMs[(Math.random() * 4) | 0]); b.position.set(rnd(-s, s) * 0.7, rnd(-0.3, 0.4) * s, rnd(-s, s) * 0.7); g.add(b); } g.position.set(x, y, z); return g; };
    around(70, 14, 120, (x, z) => env.add(crown(x, C.SEA_Y + rnd(0.5, 2.5), z, rnd(2, 4.5) * (Math.hypot(x, z) < 30 ? 0.7 : 1))), true);
    around(16, 30, 75, (x, z) => {
      if (z < 0 && Math.abs(x) < 30) return;            // nada alto detrás de la estructura: ahí cruza el mono
      const t = new THREE.Group(), h = rnd(10, 16);
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, h, 9), barkM); tr.position.y = h / 2; t.add(tr);
      t.add(crown(0, h, 0, rnd(3, 4.5)));
      for (let k = 0; k < 3; k++) { const v = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, rnd(3, 6), 4), leafMs[2]); v.position.set(rnd(-2, 2), h - 2.5, rnd(-2, 2)); t.add(v); }
      t.position.set(x, C.SEA_Y, z); env.add(t);
    }, true);
    // templo maya a lo lejos
    const stoneM = M('maya', { color: 0x8a9a7a, roughness: 0.95, flatShading: true }), mossM = M('moss', { color: 0x4f8a3a, roughness: 1 });
    [[0, -120, 1], [-85, -70, 0.6], [95, -55, 0.55]].forEach(([x, z, s]) => {
      const t = new THREE.Group();
      for (let k = 0; k < 6; k++) { const w = (30 - k * 4.5) * s; const b = new THREE.Mesh(new THREE.BoxGeometry(w, 4 * s, w), k % 2 ? mossM : stoneM); b.position.y = (2 + k * 4) * s; t.add(b); }
      const shrine = new THREE.Mesh(new THREE.BoxGeometry(5 * s, 5 * s, 5 * s), stoneM); shrine.position.y = 26.5 * s; t.add(shrine);
      t.position.set(x, C.SEA_Y, z); env.add(t);
    });
    scene.add(env); env.visible = false;
    const mossTiles = tiles('#8f9a86', 'rgba(50,60,40,0.6)', 5, (g, x, y, s) => { if (Math.random() < 0.45) { g.fillStyle = 'rgba(70,150,60,0.55)'; g.beginPath(); g.arc(x + rnd(0, s), y + rnd(0, s), rnd(6, 18), 0, TAU); g.fill(); } });
    const barkTex = canvasTex(128, 256, (g) => { g.fillStyle = '#6b4423'; g.fillRect(0, 0, 128, 256); g.strokeStyle = 'rgba(40,24,10,0.6)'; g.lineWidth = 4; for (let x = 6; x < 128; x += 14) { g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= 256; y += 32) g.lineTo(x + rnd(-4, 4), y); g.stroke(); } });
    const under = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(C.ISLAND_R * 0.8, 1.6, 7, 14), new THREE.MeshStandardMaterial({ map: barkTex, roughness: 0.95 })); trunk.position.y = -4; under.add(trunk);
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU, r = new THREE.Mesh(new THREE.ConeGeometry(0.55, 6, 6), barkM); r.position.set(Math.cos(a) * 3.2, -4.2, Math.sin(a) * 3.2); r.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); r.rotation.x += Math.PI; under.add(r); }
    const leaves = crown(0, -1.9, 0, 3.5); leaves.scale.set(1.3, 0.3, 1.3); under.add(leaves);
    const bambooM = M('bamboo', { color: 0xb8c25a, roughness: 0.6 });
    const platform = makePlatform({ top: new THREE.MeshStandardMaterial({ map: mossTiles, roughness: 0.95 }), side: M('jside', { color: 0x6a7a5a, roughness: 0.95 }), trim: M('jtrim', { color: 0x3fa34a, roughness: 0.7 }), under,
      flags: [0xff4f6d, 0xffd23f, 0xff7a3d, 0x3fa34a], line: 0x2f5a2a,
      post: () => { const p = new THREE.Group(); for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.06, 8), bambooM); c.position.y = 0.53 + k * 1.08; p.add(c); const n = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 12), M('bnode', { color: 0x8a9a3a })); n.rotation.x = Math.PI / 2; n.position.y = (k + 1) * 1.08; p.add(n); } return p; } });
    return { env: [env], platform, splash: e => { spawnDebris(e.x, C.SEA_Y + 1, e.z, 0x3fa34a, 10, 4, 0.14, 1, { flat: true, g: 0.3 }); spawnSprite(e.x, C.SEA_Y + 1, e.z, 0xcfe8c0, 1.4 * e.s, 1.4, 0.9, { vy: 1, alpha: 0.5 }); } };
  }

  function buildVolcano() {
    const env = new THREE.Group();
    const lavaTex = canvasTex(256, 256, (g) => {
      g.fillStyle = '#ff6a1a'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 70; i++) { g.fillStyle = Math.random() < 0.5 ? '#ffb03a' : '#ffe066'; g.globalAlpha = 0.5; g.beginPath(); g.arc(rnd(0, 256), rnd(0, 256), rnd(4, 18), 0, TAU); g.fill(); }
      g.globalAlpha = 1;
      for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(40,20,20,0.85)'; g.beginPath(); const x = rnd(0, 256), y = rnd(0, 256); for (let k = 0; k < 7; k++) { const a = k / 7 * TAU; g.lineTo(x + Math.cos(a) * rnd(8, 22), y + Math.sin(a) * rnd(8, 22)); } g.fill(); }
    });
    lavaTex.wrapS = lavaTex.wrapT = THREE.RepeatWrapping; lavaTex.repeat.set(30, 30);
    const lava = ground(0xffffff, 1, (x, z) => 0.3 * Math.sin(x * 0.2) * Math.cos(z * 0.2), { map: lavaTex, emissiveMap: lavaTex, emissive: 0xff5a10, emissiveIntensity: 0.85, roughness: 0.6 });
    lava.material.fog = true; env.add(lava);
    const rockM = M('vrock', { color: 0x2c2228, roughness: 0.95, flatShading: true });
    const volcano = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(12, 60, 62, 12, 3, true), rockM); cone.position.y = 31; volcano.add(cone);
    const crater = new THREE.Mesh(new THREE.CircleGeometry(12, 20), new THREE.MeshBasicMaterial({ color: 0xff7a1a })); crater.rotation.x = -Math.PI / 2; crater.position.y = 61; volcano.add(crater);
    volcano.position.set(-30, C.SEA_Y, -150); env.add(volcano);
    around(26, 14, 90, (x, z) => { const s = rnd(1.5, 5); const r = new THREE.Mesh(new THREE.ConeGeometry(s, s * rnd(1.5, 3.2), 6), rockM); r.position.set(x, C.SEA_Y + s, z); r.rotation.y = rnd(0, TAU); env.add(r); }, true);
    around(30, 12, 70, (x, z) => { const s = rnd(1, 3); const r = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), rockM); r.scale.y = 0.35; r.position.set(x, C.SEA_Y + 0.2, z); env.add(r); }, true);
    // humo del volcán y brasas
    const smoke = [];
    for (let i = 0; i < 10; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.soft, color: 0x3a3036, transparent: true, opacity: 0.6, depthWrite: false })); s.userData.t = i / 10; env.add(s); smoke.push(s); }
    const embers = points(260, 0, 0xffa040, 0.14, () => [rnd(-25, 25), rnd(-7, 18), rnd(-40, 12)]);
    embers.material.sizeAttenuation = true; embers.material.blending = THREE.AdditiveBlending; env.add(embers);
    scene.add(env); env.visible = false;
    const basalt = canvasTex(256, 256, (g) => {
      g.fillStyle = '#3a3238'; g.fillRect(0, 0, 256, 256);
      const s = 32; for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) { const cx = x * s + (y % 2) * s / 2, cy = y * s * 0.87; g.fillStyle = `rgb(${50 + rnd(0, 20) | 0},${42 + rnd(0, 14) | 0},${48 + rnd(0, 16) | 0})`; g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + Math.PI / 6; g.lineTo(cx + Math.cos(a) * 15, cy + Math.sin(a) * 15); } g.fill(); }
      g.strokeStyle = '#ff7a1a'; g.lineWidth = 2.5; for (let i = 0; i < 9; i++) { g.beginPath(); let x = rnd(0, 256), y = rnd(0, 256); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += rnd(-20, 20); y += rnd(-20, 20); g.lineTo(x, y); } g.stroke(); }
    });
    const glow = canvasTex(256, 256, (g) => { g.drawImage(basalt.image, 0, 0); const d = g.getImageData(0, 0, 256, 256); for (let i = 0; i < d.data.length; i += 4) { const hot = d.data[i] > 160; d.data[i] = hot ? 255 : 0; d.data[i + 1] = hot ? 120 : 0; d.data[i + 2] = 0; } g.putImageData(d, 0, 0); });
    const veins = canvasTex(128, 256, (g) => { g.fillStyle = '#2a2026'; g.fillRect(0, 0, 128, 256); g.strokeStyle = '#ff6a1a'; g.lineWidth = 4; for (let i = 0; i < 6; i++) { g.beginPath(); let x = rnd(0, 128), y = 0; g.moveTo(x, y); while (y < 256) { x += rnd(-10, 10); y += rnd(10, 30); g.lineTo(x, y); } g.stroke(); } });
    const under = new THREE.Mesh(new THREE.ConeGeometry(C.ISLAND_R * 0.95, 7, 10, 3), new THREE.MeshStandardMaterial({ map: veins, emissiveMap: veins, emissive: 0xff4a10, emissiveIntensity: 0.55, roughness: 0.9, flatShading: true }));
    under.rotation.x = Math.PI; under.position.y = -4;
    const obsM = M('obs', { color: 0x1d161c, roughness: 0.25, metalness: 0.4, flatShading: true }), fireM = new THREE.MeshBasicMaterial({ color: 0xffa040 });
    const fires = [];
    const platform = makePlatform({ top: new THREE.MeshStandardMaterial({ map: basalt, emissiveMap: glow, emissive: 0xff5a10, emissiveIntensity: 0.9, roughness: 0.85 }), side: M('vside', { color: 0x2a2026, roughness: 0.9 }), trim: new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff5a10, emissiveIntensity: 1 }), under,
      post: () => { const p = new THREE.Group(); const c = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.6, 5), obsM); c.position.y = 1.3; p.add(c); const f = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), fireM); f.position.y = 2.75; p.add(f); fires.push(f); return p; } });
    return { env: [env], platform,
      update: (dt) => {
        lavaTex.offset.x = G.t * 0.004; lavaTex.offset.y = G.t * 0.002;
        for (const s of smoke) { s.userData.t = (s.userData.t + dt * 0.05) % 1; const k = s.userData.t; s.position.set(-30 + k * 25, C.SEA_Y + 62 + k * 50, -150); s.scale.setScalar(14 + k * 40); s.material.opacity = 0.55 * (1 - k); }
        const a = embers.geometry.attributes.position; for (let i = 0; i < a.count; i++) { let y = a.getY(i) + dt * (0.8 + (i % 5) * 0.2); if (y > 18) y = -7; a.setY(i, y); } a.needsUpdate = true;
        for (let i = 0; i < fires.length; i++) fires[i].scale.setScalar(0.8 + Math.sin(G.t * 9 + i * 2) * 0.25);
      },
      splash: e => { for (let i = 0; i < 4; i++) spawnSprite(e.x + rnd(-0.5, 0.5), C.SEA_Y + 0.5, e.z, 0xffa040, 1.4 * e.s, 1.6, 0.8, { vy: 2, alpha: 1, add: true }); spawnDebris(e.x, C.SEA_Y + 0.5, e.z, 0xff7a1a, 8, 6, 0.12, 0.9); } };
  }

  function buildSpace() {
    const env = new THREE.Group();
    const stars = points(1800, 0, 0xffffff, 2, () => { const u = rnd(-1, 1), a = rnd(0, TAU), r = 260; const q = Math.sqrt(1 - u * u); return [Math.cos(a) * q * r, u * r, Math.sin(a) * q * r]; });
    env.add(stars);
    const earthTex = canvasTex(256, 128, (g) => { g.fillStyle = '#2a6fd6'; g.fillRect(0, 0, 256, 128); for (let i = 0; i < 26; i++) { g.fillStyle = Math.random() < 0.7 ? '#4fb85a' : '#e8d08a'; g.beginPath(); g.ellipse(rnd(0, 256), rnd(20, 108), rnd(8, 26), rnd(5, 14), rnd(0, 3), 0, TAU); g.fill(); } g.fillStyle = 'rgba(255,255,255,0.55)'; for (let i = 0; i < 30; i++) { g.beginPath(); g.ellipse(rnd(0, 256), rnd(0, 128), rnd(10, 30), rnd(2, 5), 0, 0, TAU); g.fill(); } });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(40, 40, 24), new THREE.MeshStandardMaterial({ map: earthTex, roughness: 0.8, fog: false }));
    earth.position.set(-110, -40, -190); env.add(earth);
    const ringed = new THREE.Group();
    ringed.add(new THREE.Mesh(new THREE.SphereGeometry(18, 32, 20), new THREE.MeshStandardMaterial({ color: 0xf0a860, roughness: 0.7, fog: false })));
    const ring = new THREE.Mesh(new THREE.RingGeometry(24, 36, 64), new THREE.MeshBasicMaterial({ color: 0xffd8a0, side: THREE.DoubleSide, transparent: true, opacity: 0.65, fog: false }));
    ring.rotation.x = 1.2; ringed.add(ring); ringed.position.set(120, 55, -170); env.add(ringed);
    const moon2 = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 16), new THREE.MeshStandardMaterial({ color: 0xc8c4d8, roughness: 0.9, fog: false })); moon2.position.set(60, -30, 140); env.add(moon2);
    const astM = M('ast', { color: 0x6a6878, roughness: 0.95, flatShading: true });
    const asts = [];
    around(36, 16, 80, (x, z) => { const s = rnd(0.6, 2.6); const a = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), astM); a.position.set(x, rnd(-14, 8), z); a.userData.spin = rnd(-0.4, 0.4); env.add(a); asts.push(a); }, true);
    scene.add(env); env.visible = false;
    const regolith = canvasTex(256, 256, (g) => { g.fillStyle = '#a7a3b8'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 400; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(60,58,80,0.15)' : 'rgba(255,255,255,0.15)'; g.fillRect(rnd(0, 256), rnd(0, 256), 3, 3); } for (let i = 0; i < 16; i++) { const x = rnd(0, 256), y = rnd(0, 256), r = rnd(6, 22); g.fillStyle = 'rgba(70,66,90,0.35)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.beginPath(); g.arc(x - 1, y - 1, r, Math.PI, TAU * 0.9); g.stroke(); } });
    const rockGeo = new THREE.IcosahedronGeometry(C.ISLAND_R * 0.95, 1);
    const pos = rockGeo.attributes.position; for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y > 0) pos.setY(i, 0);   // cara de arriba plana: nada asoma por encima de la plataforma
      pos.setX(i, pos.getX(i) * rnd(0.9, 1.05)); pos.setZ(i, pos.getZ(i) * rnd(0.9, 1.05)); }
    rockGeo.computeVertexNormals();
    const under = new THREE.Mesh(rockGeo, M('astbig', { color: 0x77748a, roughness: 0.95, flatShading: true })); under.scale.y = 1.2; under.position.y = -0.52;
    const metalM = M('ant', { color: 0xd0d4e0, metalness: 0.8, roughness: 0.3 }), lights = [];
    const platform = makePlatform({ top: new THREE.MeshStandardMaterial({ map: regolith, roughness: 0.95 }), side: M('spside', { color: 0x8a8aa0, roughness: 0.9 }), trim: new THREE.MeshStandardMaterial({ color: 0x5ff7ff, emissive: 0x2ad8ff, emissiveIntensity: 1.2 }), under,
      post: (i) => { const p = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 3, 6), metalM); c.position.y = 1.5; p.add(c); const d = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8, 0, TAU, 0, Math.PI / 2), metalM); d.rotation.x = Math.PI * 0.8; d.position.y = 2.8; p.add(d); const l = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff4f6d : 0x5fff8a })); l.position.y = 3.1; p.add(l); lights.push(l); return p; } });
    return { env: [env], platform, noSun: true,
      update: (dt) => { for (const a of asts) { a.rotation.x += a.userData.spin * dt; a.rotation.y += a.userData.spin * 0.7 * dt; } lights.forEach((l, i) => { l.visible = Math.sin(G.t * 3 + i) > -0.3; }); earth.rotation.y += dt * 0.02; },
      splash: e => { spawnSprite(e.x, Math.max(e.y || C.SEA_Y, C.SEA_Y), e.z, 0xbfe8ff, 0.8, 1.2, 0.6, { add: true, alpha: 0.8 }); } };
  }


  // ---------------- paisajes nuevos (desde el mundo 52) ----------------
  const stripes = (a, b, n, diag) => canvasTex(64, 64, (g) => { g.fillStyle = a; g.fillRect(0, 0, 64, 64); g.fillStyle = b; for (let i = -n; i < n * 2; i++) { g.save(); g.translate(i * 64 / n, 0); if (diag) g.transform(1, 0, -1, 1, 0, 0); g.fillRect(0, 0, 32 / n, 64); g.restore(); } });
  const splashCol = (col, col2) => e => { for (let i = 0; i < 3; i++) spawnSprite(e.x + rnd(-0.6, 0.6), C.SEA_Y + 0.8, e.z, col, 1.6 * e.s, 1.4, 1.0, { vy: 1.2, alpha: 0.75 }); spawnDebris(e.x, C.SEA_Y + 0.8, e.z, col2 || col, 8, 4, 0.12, 0.8); };
  const ringPosts = (mk) => (i) => mk(i);

  function buildCandy() {
    const env = new THREE.Group();
    env.add(ground(0xffb6dc, 1, (x, z) => { const d = Math.hypot(x, z); const k = Math.min(1, Math.max(0, (d - 8) / 22)); return k * (1.8 * Math.sin(x * 0.07) * Math.cos(z * 0.06)); }, { roughness: 0.6 }));
    // río de chocolate
    const choc = new THREE.Mesh(new THREE.PlaneGeometry(14, 400), M('chocriver', { color: 0x6b3a1e, roughness: 0.25, metalness: 0.1 })); choc.rotation.x = -Math.PI / 2; choc.rotation.z = 0.5; choc.position.set(-30, C.SEA_Y + 0.6, -40); env.add(choc);
    const swirl = canvasTex(128, 128, (g) => { const c = ['#ff4f9a', '#ffffff', '#ffd23f', '#5fd4ff']; for (let r = 64; r > 0; r -= 8) { g.fillStyle = c[(r / 8) % 4]; g.beginPath(); g.arc(64, 64, r, 0, TAU); g.fill(); } });
    const lolly = (x, z, s) => { const g = new THREE.Group(); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.25 * s, 8 * s, 8), M('stick', { color: 0xffffff, roughness: 0.4 })); st.position.y = 4 * s; g.add(st);
      const d = new THREE.Mesh(new THREE.CylinderGeometry(3 * s, 3 * s, 0.8 * s, 32), [M('lside', { color: 0xff4f9a, roughness: 0.3 }), new THREE.MeshStandardMaterial({ map: swirl, roughness: 0.3 }), new THREE.MeshStandardMaterial({ map: swirl, roughness: 0.3 })]); d.rotation.x = Math.PI / 2; d.position.y = 9 * s; g.add(d);
      g.position.set(x, C.SEA_Y, z); g.rotation.y = Math.atan2(x, z); env.add(g); };
    [[-40, -70, 1.6], [35, -85, 2], [-75, -20, 1.4], [70, -35, 1.5], [-10, -120, 2.4]].forEach(([x, z, s]) => lolly(x, z, s));
    const gumCols = [0xff4f6d, 0xffd23f, 0x5fd45a, 0x3d9bff, 0xa66bff, 0xff9a3d];
    around(40, 14, 90, (x, z, i) => { const r = rnd(1, 3.2); const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 10, 0, TAU, 0, Math.PI / 2), M('gum' + (i % 6), { color: gumCols[i % 6], roughness: 0.35 })); m.position.set(x, C.SEA_Y + 0.2, z); env.add(m); }, true);
    // casitas de magdalena
    const paper = stripes('#ff9ac8', '#ffffff', 4);
    [[-28, -45], [24, -50], [-55, 10], [52, 5], [8, -75]].forEach(([x, z]) => { const g = new THREE.Group(); const base = new THREE.Mesh(new THREE.CylinderGeometry(4, 3, 4, 20), new THREE.MeshStandardMaterial({ map: paper, roughness: 0.6 })); base.position.y = 2; g.add(base);
      const cream = new THREE.Mesh(new THREE.SphereGeometry(4.4, 20, 12, 0, TAU, 0, Math.PI / 2), M('cream', { color: 0xfff4fa, roughness: 0.5 })); cream.position.y = 4; cream.scale.y = 0.8; g.add(cream);
      const ch = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), M('cherry', { color: 0xe0123a, roughness: 0.25 })); ch.position.y = 7.6; g.add(ch); g.position.set(x, C.SEA_Y, z); env.add(g); });
    scene.add(env); env.visible = false;
    const cookie = canvasTex(256, 256, (g) => { g.fillStyle = '#e8b878'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 70; i++) { g.fillStyle = Math.random() < 0.7 ? '#5a2e14' : '#ff7ab8'; g.beginPath(); g.ellipse(rnd(0, 256), rnd(0, 256), rnd(4, 9), rnd(3, 7), rnd(0, 3), 0, TAU); g.fill(); } });
    const cane = stripes('#ffffff', '#ff3a5a', 3, true);
    const under = new THREE.Group();
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(C.ISLAND_R * 0.98, C.ISLAND_R * 0.6, 4.5, 28), new THREE.MeshStandardMaterial({ map: stripes('#ff7ab8', '#ffd6ec', 6), roughness: 0.6 })); cup.position.y = -2.7; under.add(cup);
    const platform = makePlatform({ top: new THREE.MeshStandardMaterial({ map: cookie, roughness: 0.8 }), side: M('cside', { color: 0x8a4a24, roughness: 0.6 }), trim: M('ctrim', { color: 0xff7ab8, roughness: 0.35 }), under,
      flags: [0xff4f9a, 0xffd23f, 0x5fd4ff, 0xffffff], line: 0xa04a7a,
      post: () => { const p = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 3.2, 10), new THREE.MeshStandardMaterial({ map: cane, roughness: 0.4 })); c.position.y = 1.6; p.add(c); const k = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.11, 8, 16, Math.PI), new THREE.MeshStandardMaterial({ map: cane })); k.position.set(0.28, 3.2, 0); p.add(k); return p; } });
    return { env: [env], platform, splash: splashCol(0xffc4e4, 0xff7ab8) };
  }

  function buildCrystal() {
    const env = new THREE.Group();
    env.add(ground(0x2a1a4a, 1, (x, z) => { const d = Math.hypot(x, z); const k = Math.min(1, Math.max(0, (d - 8) / 18)); return k * (2.2 * Math.sin(x * 0.08) * Math.cos(z * 0.07)); }, { roughness: 0.9 }));
    const cryCols = [0x7fe6ff, 0xff7ad8, 0xb88aff, 0x7dffb0];
    const cluster = (x, y, z, s, i, down) => { const g = new THREE.Group(); const m = M('cry' + (i % 4), { color: cryCols[i % 4], emissive: cryCols[i % 4], emissiveIntensity: 0.55, roughness: 0.15, metalness: 0.1, flatShading: true });
      for (let k = 0; k < 5; k++) { const h = rnd(2, 6) * s; const c = new THREE.Mesh(new THREE.ConeGeometry(rnd(0.4, 0.9) * s, h, 6), m); c.position.set(rnd(-1, 1) * s, h / 2, rnd(-1, 1) * s); c.rotation.set(rnd(-0.4, 0.4), 0, rnd(-0.4, 0.4)); g.add(c); }
      if (down) g.rotation.x = Math.PI; g.position.set(x, y, z); env.add(g); };
    around(46, 14, 95, (x, z, i) => cluster(x, C.SEA_Y, z, rnd(0.8, 2.4), i), true);
    around(40, 20, 120, (x, z, i) => cluster(x, 38 + rnd(0, 10), z, rnd(1.4, 3), i, true));
    // techo de la cueva: una cúpula oscura con estalactitas
    const dome = new THREE.Mesh(new THREE.SphereGeometry(170, 24, 12, 0, TAU, 0, Math.PI / 2), M('cavedome', { color: 0x140a28, roughness: 1, side: THREE.BackSide, fog: false })); dome.position.y = -20; env.add(dome);
    const rockM = M('stal', { color: 0x3a2a5a, roughness: 0.95, flatShading: true });
    around(60, 25, 140, (x, z) => { const h = rnd(6, 18); const c = new THREE.Mesh(new THREE.ConeGeometry(rnd(1, 3), h, 6), rockM); c.rotation.x = Math.PI; c.position.set(x, 55 - h / 2 + rnd(-6, 6), z); env.add(c); });
    const sparks = points(500, 0, 0xcfe8ff, 0.18, () => [rnd(-40, 40), rnd(-6, 30), rnd(-60, 10)]); sparks.material.sizeAttenuation = true; env.add(sparks);
    const glow = new THREE.PointLight(0xb88aff, 30, 40, 2); glow.position.set(0, 8, -6); env.add(glow);
    scene.add(env); env.visible = false;
    const ame = tiles('#4a2f7a', 'rgba(190,150,255,0.55)', 6, (g, x, y, s) => { if (Math.random() < 0.3) { g.fillStyle = 'rgba(127,230,255,0.4)'; g.fillRect(x + s * 0.3, y + s * 0.3, s * 0.4, s * 0.4); } });
    const under = new THREE.Group();
    const geo = new THREE.Mesh(new THREE.IcosahedronGeometry(C.ISLAND_R * 0.95, 1), M('geode', { color: 0x4a3a6a, roughness: 0.9, flatShading: true })); geo.scale.y = 0.9; geo.position.y = -4.6; under.add(geo);
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; const c = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3, 6), M('cry' + (i % 4), {})); c.position.set(Math.cos(a) * 4.6, -2.2, Math.sin(a) * 4.6); c.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); under.add(c); }
    const platform = makePlatform({ top: new THREE.MeshStandardMaterial({ map: ame, roughness: 0.6 }), side: M('crside', { color: 0x3a2a5a, roughness: 0.9 }), trim: new THREE.MeshStandardMaterial({ color: 0x7fe6ff, emissive: 0x3fc8ff, emissiveIntensity: 1.2 }), under,
      post: (i) => { const p = new THREE.Group(); const c = new THREE.Mesh(new THREE.ConeGeometry(0.22, 3.2, 6), M('cry' + (i % 4), {})); c.position.y = 1.6; p.add(c); return p; } });
    return { env: [env], platform, noSun: true,
      update: (dt) => { sparks.rotation.y += dt * 0.02; glow.intensity = 26 + Math.sin(G.t * 1.3) * 6; },
      splash: splashCol(0xcfe8ff, 0xb88aff) };
  }

  function buildTemple() {
    const env = new THREE.Group();
    env.add(ground(0x9aa86a, 1, (x, z) => 0.6 * Math.sin(x * 0.09) * Math.cos(z * 0.07), { roughness: 0.95 }));
    const stoneM = M('tstone', { color: 0xbfae8a, roughness: 0.9, flatShading: true }), mossM = M('tmoss', { color: 0x6a8a4a, roughness: 1 });
    // columnas en ruinas
    around(26, 16, 70, (x, z, i) => { const h = rnd(3, 11); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1, h, 10), i % 3 ? stoneM : mossM); c.position.set(x, C.SEA_Y + h / 2, z); c.rotation.z = rnd(-0.08, 0.08); env.add(c);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 2.4), stoneM); cap.position.set(x, C.SEA_Y + h + 0.3, z); if (h > 6) env.add(cap); }, true);
    // escalinata y puerta del sol
    const stairs = new THREE.Group(); for (let k = 0; k < 8; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(46 - k * 5, 3, 30 - k * 3), k % 3 === 2 ? mossM : stoneM); b.position.y = 1.5 + k * 3; stairs.add(b); }
    const gate = new THREE.Mesh(new THREE.TorusGeometry(6, 1.2, 8, 24, Math.PI), M('tgold', { color: 0xffc83d, metalness: 0.7, roughness: 0.3 })); gate.position.y = 27; stairs.add(gate);
    stairs.position.set(0, C.SEA_Y, -125); env.add(stairs);
    const head = (x, z, s) => { const g = new THREE.Group(); const h = new THREE.Mesh(new THREE.BoxGeometry(6 * s, 8 * s, 5 * s), stoneM); h.position.y = 4 * s; g.add(h); const eyeM = M('teye', { color: 0x2a3a2a }); for (const ex of [-1.4, 1.4]) { const e = new THREE.Mesh(new THREE.BoxGeometry(1.2 * s, 0.6 * s, 0.3 * s), eyeM); e.position.set(ex * s, 5.5 * s, 2.55 * s); g.add(e); } g.position.set(x, C.SEA_Y, z); g.rotation.y = Math.atan2(-x, -z) + Math.PI; env.add(g); };
    head(-55, -60, 1.6); head(60, -50, 1.4);
    const fires = [];
    around(12, 14, 30, (x, z) => { const t = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 3, 8), stoneM); pole.position.y = 1.5; t.add(pole); const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.soft, color: 0xffa040, blending: THREE.AdditiveBlending, depthWrite: false })); f.scale.set(1.6, 2.2, 1); f.position.y = 3.6; t.add(f); fires.push(f); t.position.set(x, C.SEA_Y + 0.3, z); env.add(t); }, true);
    scene.add(env); env.visible = false;
    const carved = tiles('#c8b88e', 'rgba(90,70,40,0.55)', 4, (g, x, y, s) => { g.strokeStyle = 'rgba(90,70,40,0.35)'; g.lineWidth = 3; g.strokeRect(x + s * 0.25, y + s * 0.25, s * 0.5, s * 0.5); });
    const under = new THREE.Group();
    for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(C.ISLAND_R * (0.95 - k * 0.18), C.ISLAND_R * (0.95 - k * 0.18), 1.4, 4), k % 2 ? mossM : stoneM); b.rotation.y = Math.PI / 4; b.position.y = -1.2 - k * 1.4; under.add(b); }
    const platform = makePlatform({ top: new THREE.MeshStandardMaterial({ map: carved, roughness: 0.9 }), side: stoneM, trim: M('tgold', {}), under,
      flags: [0xffc83d, 0x3fa34a, 0xff7a3d], line: 0x5a4a2a,
      post: () => { const p = new THREE.Group(); const c = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.2, 0.35), stoneM); c.position.y = 1.6; p.add(c); const k = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), M('tgold', {})); k.position.y = 3.4; p.add(k); return p; } });
    return { env: [env], platform, update: () => { for (let i = 0; i < fires.length; i++) fires[i].scale.set(1.4 + Math.sin(G.t * 9 + i) * 0.25, 2 + Math.sin(G.t * 11 + i * 2) * 0.35, 1); }, splash: splashCol(0xcfe8c0, 0x6a8a4a) };
  }

  function buildForest() {
    const env = new THREE.Group();
    env.add(ground(0x2a5a3a, 1, (x, z) => 0.9 * Math.sin(x * 0.08) * Math.cos(z * 0.09), { roughness: 0.95 }));
    const capCols = [0xff4f6d, 0xa66bff, 0x3dc8ff, 0xffa040];
    const mush = (x, z, s, i, glowy) => { const g = new THREE.Group(); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * s, 0.7 * s, 4 * s, 10), M('mstem', { color: 0xf4ead8, roughness: 0.8 })); st.position.y = 2 * s; g.add(st);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(2.2 * s, 18, 10, 0, TAU, 0, Math.PI / 2), M('mcap' + (i % 4) + (glowy ? 'g' : ''), { color: capCols[i % 4], roughness: 0.5, emissive: glowy ? capCols[i % 4] : 0x000000, emissiveIntensity: glowy ? 0.6 : 0 })); cap.position.y = 4 * s; cap.scale.y = 0.7; g.add(cap);
      for (let k = 0; k < 5; k++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.28 * s, 8, 6), M('mdot', { color: 0xffffff })); const a = rnd(0, TAU), r = rnd(0.6, 1.6) * s; d.position.set(Math.cos(a) * r, 4 * s + Math.sqrt(Math.max(0, 4.8 * s * s - r * r)) * 0.68, Math.sin(a) * r); g.add(d); }
      g.position.set(x, C.SEA_Y, z); env.add(g); };
    around(34, 14, 90, (x, z, i) => mush(x, z, rnd(0.6, 1.8), i, i % 3 === 0), true);
    const barkM = M('fbark', { color: 0x4a3420, roughness: 0.95 }), leafM = M('fleaf', { color: 0x2f6a4a, roughness: 0.9, flatShading: true });
    around(18, 40, 110, (x, z) => { const t = new THREE.Group(), h = rnd(14, 24); const tr = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.8, h, 9), barkM); tr.position.y = h / 2; t.add(tr); const cr = new THREE.Mesh(new THREE.IcosahedronGeometry(rnd(6, 9), 1), leafM); cr.position.y = h; t.add(cr); t.position.set(x, C.SEA_Y, z); env.add(t); }, true);
    const flies = points(260, 0, 0xfff27a, 0.35, () => [rnd(-30, 30), rnd(-5, 14), rnd(-40, 12)]); flies.material.sizeAttenuation = true; flies.material.blending = THREE.AdditiveBlending; env.add(flies);
    const mist = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshBasicMaterial({ map: TEX.soft, color: 0xd8f0e8, transparent: true, opacity: 0.35, depthWrite: false })); mist.rotation.x = -Math.PI / 2; mist.position.y = C.SEA_Y + 1.5; env.add(mist);
    scene.add(env); env.visible = false;
    const moss = tiles('#4f7a4a', 'rgba(30,50,30,0.5)', 5, (g, x, y, s) => { if (Math.random() < 0.4) { g.fillStyle = 'rgba(150,230,140,0.35)'; g.beginPath(); g.arc(x + rnd(0, s), y + rnd(0, s), rnd(5, 14), 0, TAU); g.fill(); } });
    const under = new THREE.Group();
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(C.ISLAND_R * 0.92, C.ISLAND_R * 0.6, 6, 16), barkM); stump.position.y = -3.3; under.add(stump);
    const platform = makePlatform({ top: new THREE.MeshStandardMaterial({ map: moss, roughness: 0.95 }), side: barkM, trim: M('ftrim', { color: 0xfff27a, emissive: 0xffd23f, emissiveIntensity: 0.6 }), under,
      post: (i) => { const p = new THREE.Group(); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.6, 8), M('mstem', {})); st.position.y = 1.3; p.add(st); const cap = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8, 0, TAU, 0, Math.PI / 2), M('mcap' + (i % 4) + 'g', {})); cap.position.y = 2.6; p.add(cap); return p; } });
    return { env: [env], platform,
      update: (dt) => { const a = flies.geometry.attributes.position; for (let i = 0; i < a.count; i++) { a.setY(i, a.getY(i) + Math.sin(G.t * 1.5 + i) * dt * 0.6); a.setX(i, a.getX(i) + Math.cos(G.t + i * 0.7) * dt * 0.5); } a.needsUpdate = true; flies.material.opacity = 0.6 + Math.sin(G.t * 3) * 0.3; },
      splash: splashCol(0xd8f0e8, 0x2f6a4a) };
  }

  function buildFair() {
    const env = new THREE.Group();
    env.add(ground(0x5fb84a, 1, (x, z) => 0.5 * Math.sin(x * 0.07) * Math.cos(z * 0.06), { roughness: 0.9 }));
    // noria
    const wheel = new THREE.Group(), R = 16;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.4, 8, 64), M('frim', { color: 0xffffff, roughness: 0.4 })); wheel.add(rim);
    const cabCols = [0xff4f6d, 0xffd23f, 0x3d9bff, 0x5fd45a, 0xa66bff];
    const cabins = [];
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, R, 6), M('frim', {})); sp.position.set(Math.cos(a) * R / 2, Math.sin(a) * R / 2, 0); sp.rotation.z = a + Math.PI / 2; wheel.add(sp);
      const c = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), M('cab' + (i % 5), { color: cabCols[i % 5], roughness: 0.4 })); c.userData.a = a; wheel.add(c); cabins.push(c); }
    const legs = new THREE.Group(); for (const sx of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, R + 6, 8), M('frim', {})); l.position.set(sx * 5, -(R + 6) / 2 + 2, 0); l.rotation.z = sx * 0.28; legs.add(l); }
    const fw = new THREE.Group(); fw.add(wheel, legs); fw.position.set(-40, C.SEA_Y + R + 5, -80); env.add(fw);
    // carpa de circo
    const tentTex = stripes('#ff4f6d', '#ffffff', 4);
    [[45, -70, 1.4], [-70, -20, 1], [70, 0, 0.9]].forEach(([x, z, s]) => { const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(8 * s, 8 * s, 7 * s, 24), new THREE.MeshStandardMaterial({ map: tentTex, roughness: 0.6 })); body.position.y = 3.5 * s; g.add(body);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(9 * s, 7 * s, 24), new THREE.MeshStandardMaterial({ map: tentTex, roughness: 0.6 })); roof.position.y = 10.5 * s; g.add(roof); const fl = new THREE.Mesh(new THREE.ConeGeometry(0.6 * s, 1.6 * s, 4), M('fflag', { color: 0xffd23f })); fl.position.y = 14.6 * s; g.add(fl); g.position.set(x, C.SEA_Y, z); env.add(g); });
    // bombillas por todas partes
    const bulbs = points(400, 0, 0xfff2b0, 0.5, () => { const a = rnd(0, TAU), r = rnd(14, 60); return [Math.cos(a) * r, C.SEA_Y + rnd(1, 9), Math.sin(a) * r - 10]; }); bulbs.material.sizeAttenuation = true; bulbs.material.blending = THREE.AdditiveBlending; env.add(bulbs);
    scene.add(env); env.visible = false;
    const stage = tiles('#b07a4a', 'rgba(70,40,20,0.6)', 8);
    const under = new THREE.Group();
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(C.ISLAND_R * 0.98, C.ISLAND_R * 0.9, 4, 28), new THREE.MeshStandardMaterial({ map: stripes('#ffd23f', '#ff4f6d', 8), roughness: 0.5 })); drum.position.y = -2.3; under.add(drum);
    const platform = makePlatform({ top: new THREE.MeshStandardMaterial({ map: stage, roughness: 0.75 }), side: M('fside', { color: 0x8a5a2a, roughness: 0.8 }), trim: M('ftrim2', { color: 0xffd23f, metalness: 0.7, roughness: 0.3 }), under,
      flags: [0xff4f6d, 0xffd23f, 0x3d9bff, 0x5fd45a, 0xa66bff], line: 0x5a3a7a,
      post: () => { const p = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.2, 8), M('frim', {})); c.position.y = 1.6; p.add(c); const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffd23f, emissiveIntensity: 1.4 })); b.position.y = 3.3; p.add(b); return p; } });
    return { env: [env], platform,
      update: (dt) => { wheel.rotation.z += dt * 0.12; for (const c of cabins) { const a = c.userData.a + wheel.rotation.z; c.position.set(Math.cos(c.userData.a) * R, Math.sin(c.userData.a) * R, 0); c.rotation.z = -wheel.rotation.z; } bulbs.material.opacity = 0.7 + Math.sin(G.t * 5) * 0.25; },
      splash: splashCol(0xfff2b0, 0xff4f6d) };
  }

  function buildNeon() {
    const env = new THREE.Group();
    const gridTex = canvasTex(128, 128, (g) => { g.fillStyle = '#0a0a24'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#ff3ad8'; g.lineWidth = 3; g.strokeRect(0, 0, 128, 128); });
    gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping; gridTex.repeat.set(60, 60);
    const gnd = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshBasicMaterial({ map: gridTex })); gnd.rotation.x = -Math.PI / 2; gnd.position.y = C.SEA_Y; env.add(gnd);
    const winTex = (c) => canvasTex(64, 128, (g) => { g.fillStyle = '#0c0c2a'; g.fillRect(0, 0, 64, 128); for (let y = 6; y < 128; y += 10) for (let x = 6; x < 64; x += 12) { if (Math.random() < 0.55) { g.fillStyle = c[(Math.random() * c.length) | 0]; g.fillRect(x, y, 7, 5); } } });
    const wins = [winTex(['#7fe6ff', '#fff2b0']), winTex(['#ff7ad8', '#b88aff']), winTex(['#7dffb0', '#7fe6ff'])];
    around(70, 22, 140, (x, z, i) => { if (z > 0 && Math.abs(x) < 25) return; const h = rnd(12, 55), w = rnd(5, 11); const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshBasicMaterial({ map: wins[i % 3] })); b.position.set(x, C.SEA_Y + h / 2, z); env.add(b);
      if (i % 4 === 0) { const sign = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, 2), new THREE.MeshBasicMaterial({ color: [0xff3ad8, 0x3ae8ff, 0xffd23f][i % 3] })); sign.position.set(x, C.SEA_Y + h * 0.7, z + w / 2 + 0.05); sign.lookAt(0, sign.position.y, 0); env.add(sign); } });
    const cars = [];
    for (let i = 0; i < 8; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 1), new THREE.MeshBasicMaterial({ color: [0xff3ad8, 0x3ae8ff, 0xffd23f][i % 3] })); c.userData = { y: rnd(14, 34), z: rnd(-90, -30), v: rnd(8, 16) * (i % 2 ? 1 : -1), x: rnd(-80, 80) }; env.add(c); cars.push(c); }
    scene.add(env); env.visible = false;
    const metal = tiles('#2a2a48', 'rgba(58,232,255,0.6)', 6);
    const under = new THREE.Group();
    const core = new THREE.Mesh(new THREE.CylinderGeometry(C.ISLAND_R * 0.9, 1.4, 6, 8), M('nunder', { color: 0x2a2a48, metalness: 0.7, roughness: 0.35, flatShading: true })); core.position.y = -3.3; under.add(core);
    const ringL = new THREE.Mesh(new THREE.TorusGeometry(C.ISLAND_R * 0.7, 0.08, 6, 48), new THREE.MeshBasicMaterial({ color: 0xff3ad8 })); ringL.rotation.x = Math.PI / 2; ringL.position.y = -2.5; under.add(ringL);
    const platform = makePlatform({ top: new THREE.MeshStandardMaterial({ map: metal, roughness: 0.4, metalness: 0.5 }), side: M('nside', { color: 0x1a1a38, metalness: 0.6, roughness: 0.4 }), trim: new THREE.MeshStandardMaterial({ color: 0x3ae8ff, emissive: 0x3ae8ff, emissiveIntensity: 1.5 }), under,
      post: (i) => { const p = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 8), M('npole', { color: 0x9aa0c8, metalness: 0.8, roughness: 0.3 })); c.position.y = 1.6; p.add(c); const l = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.2), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff3ad8 : 0x3ae8ff })); l.position.set(0.2, 3.2, 0); p.add(l); return p; } });
    return { env: [env], platform, noSun: true,
      update: (dt) => { for (const c of cars) { c.userData.x += c.userData.v * dt; if (c.userData.x > 120) c.userData.x = -120; if (c.userData.x < -120) c.userData.x = 120; c.position.set(c.userData.x, c.userData.y, c.userData.z); } },
      splash: e => { spawnSprite(e.x, C.SEA_Y + 0.5, e.z, 0x3ae8ff, 1.4 * e.s, 1.4, 0.6, { add: true, alpha: 0.8 }); } };
  }

  // ---------------- clima de las vueltas (solo se ve: no cambia la física) ----------------
  const Weather = (() => {
    const grp = new THREE.Group(); scene.add(grp); grp.visible = false;
    let kind = null, sys = null, flashT = 6, meteorT = 2;
    const make = (n, color, size, opacity, place) => { const p = points(n, 0, color, size, place); p.material.sizeAttenuation = true; p.material.opacity = opacity; return p; };
    const lines = (n, color, len) => { const geo = new THREE.BufferGeometry(), a = new Float32Array(n * 6); for (let i = 0; i < n; i++) { const x = rnd(-30, 30), y = rnd(-6, 26), z = rnd(-40, 14); a.set([x, y, z, x - len * 0.15, y - len, z], i * 6); } geo.setAttribute('position', new THREE.BufferAttribute(a, 3)); return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false })); };
    const embers = [];
    function set(k) {
      kind = k; while (grp.children.length) grp.remove(grp.children[0]);
      sys = null; embers.length = 0;
      if (k === 'storm' || k === 'rain') { sys = lines(k === 'storm' ? 1400 : 1000, 0xcfd8ff, 0.9); grp.add(sys); }
      else if (k === 'sandstorm') { sys = make(1600, 0xe0a860, 0.14, 0.7, () => [rnd(-30, 30), rnd(-6, 18), rnd(-40, 14)]); grp.add(sys); }
      else if (k === 'blizzard') { sys = make(2200, 0xffffff, 0.16, 0.95, () => [rnd(-30, 30), rnd(-6, 26), rnd(-40, 14)]); grp.add(sys); }
      else if (k === 'ash') { sys = make(900, 0x8a8088, 0.16, 0.85, () => [rnd(-30, 30), rnd(-6, 26), rnd(-40, 14)]); grp.add(sys); const e = make(160, 0xff7a2a, 0.2, 1, () => [rnd(-20, 20), rnd(-6, 20), rnd(-30, 10)]); e.material.blending = THREE.AdditiveBlending; grp.add(e); embers.push(e); }
      grp.visible = !!k;
    }
    function update(dt) {
      if (!kind) return;
      if (sys && sys.geometry) {
        const a = sys.geometry.attributes.position, n = a.count;
        if (kind === 'storm' || kind === 'rain') { const v = (kind === 'storm' ? 38 : 26) * dt; for (let i = 0; i < n; i++) { let y = a.getY(i) - v; if (y < -7) y += 33; a.setY(i, y); a.setX(i, a.getX(i) - v * (kind === 'storm' ? 0.25 : 0.1)); if (a.getX(i) < -32) a.setX(i, a.getX(i) + 62); } }
        else if (kind === 'sandstorm') { for (let i = 0; i < n; i++) { let x = a.getX(i) + dt * (14 + (i % 7) * 2); if (x > 30) x -= 60; a.setX(i, x); a.setY(i, a.getY(i) + Math.sin(G.t * 2 + i) * dt * 0.8); } }
        else if (kind === 'blizzard') { for (let i = 0; i < n; i++) { let y = a.getY(i) - dt * (3 + (i % 5)); if (y < -6) y = 26; a.setY(i, y); let x = a.getX(i) + dt * 6; if (x > 30) x -= 60; a.setX(i, x); } }
        else if (kind === 'ash') { for (let i = 0; i < n; i++) { let y = a.getY(i) - dt * 1.2; if (y < -6) y = 26; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(G.t + i) * dt * 0.5); } for (const e of embers) { const b = e.geometry.attributes.position; for (let i = 0; i < b.count; i++) { let y = b.getY(i) + dt * 2; if (y > 20) y = -6; b.setY(i, y); } b.needsUpdate = true; } }
        a.needsUpdate = true;
      }
      // tormenta: relámpagos
      if (kind === 'storm' && (flashT -= dt) <= 0) { flashT = rnd(4, 9); hemi.intensity += 2.2; setTimeout(() => { hemi.intensity = Math.max(0.3, hemi.intensity - 2.2); }, 120); if (G.mode === 'play' && save.sound) Audio.thud(9, true); }
      // meteoritos que cruzan el cielo
      if (kind === 'meteors' && (meteorT -= dt) <= 0) { meteorT = rnd(1.2, 3.5); const x = rnd(-40, 20), y = rnd(18, 30), z = rnd(-70, -30); for (let i = 0; i < 10; i++) setTimeout(() => spawnSprite(x + i * 1.6, y - i * 0.9, z, i ? 0xffb050 : 0xffffff, 1.6 - i * 0.1, 1, 0.5, { add: true, alpha: 1 }), i * 25); }
    }
    return { set, update };
  })();
  const BIOMES = { sea: { env: [sea, decor], platform: island } };
  const biomeBuilders = { desert: buildDesert, snow: buildSnow, jungle: buildJungle, volcano: buildVolcano, space: buildSpace, candy: buildCandy, crystal: buildCrystal, temple: buildTemple, forest: buildForest, fair: buildFair, neon: buildNeon };
  let biome = 'sea';
  function setBiome(name) {
    if (!BIOMES[name] && biomeBuilders[name]) BIOMES[name] = biomeBuilders[name]();
    biome = BIOMES[name] ? name : 'sea';
    for (const k in BIOMES) { const on = k === biome; for (const o of BIOMES[k].env) o.visible = on; BIOMES[k].platform.visible = on; }
    sunDisc.visible = !BIOMES[biome].noSun;
  }

  // ---------------- cañón en primer plano ----------------
  const cannonG = new THREE.Group(); scene.add(cannonG);
  const barrelPivot = new THREE.Group(); cannonG.add(barrelPivot);
  const cannonMat = new THREE.MeshPhysicalMaterial({ color: 0x3a2f6e, roughness: 0.35, metalness: 0.3, clearcoat: 0.6 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 0.85, roughness: 0.25 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x9a5f32, roughness: 0.75 });
  let barrelBand, muzzleBall;
  {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.46, 2.0, 32, 1, true), cannonMat);
    barrel.rotation.x = Math.PI / 2; barrel.position.z = -0.6; barrelPivot.add(barrel);
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.46, 24, 16), cannonMat); back.position.z = 0.4; barrelPivot.add(back);
    [-1.45, -0.2, 0.25].forEach(z => { const r = new THREE.Mesh(new THREE.TorusGeometry(z < -1 ? 0.38 : 0.47, 0.07, 10, 32), goldMat); r.position.z = z; barrelPivot.add(r); });
    barrelBand = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.44, 0.22, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0xff4f6d, roughness: 0.4 }));
    barrelBand.rotation.x = Math.PI / 2; barrelBand.position.z = -0.75; barrelPivot.add(barrelBand);
    muzzleBall = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), jelly.r);
    muzzleBall.position.z = -1.45; barrelPivot.add(muzzleBall);
    const carriage = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 1.6), woodMat); carriage.position.set(0, -0.55, 0.15); cannonG.add(carriage);
    [-0.72, 0.72].forEach(x => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.16, 28), woodMat); w.rotation.z = Math.PI / 2; w.position.set(x, -0.62, 0.15); cannonG.add(w);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.2, 16), goldMat); hub.rotation.z = Math.PI / 2; hub.position.set(x * 1.03, -0.62, 0.15); cannonG.add(hub);
    });
    cannonG.traverse(o => { if (o.isMesh) o.castShadow = false; });
    cannonG.scale.setScalar(0.62);
  }
  barrelPivot.position.y = 0.0;

  // ---------------- trayectoria y diana ----------------
  const aimDots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }), 26);
  aimDots.visible = false; aimDots.frustumCulled = false; scene.add(aimDots);
  const reticle = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.4, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide }));
  reticle.renderOrder = 10; reticle.visible = false; scene.add(reticle);

  // ---------------- partículas ----------------
  const DEBRIS_N = 700;
  const debris = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0 }), DEBRIS_N);
  debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage); debris.frustumCulled = false; debris.castShadow = false;
  const dState = [];
  for (let i = 0; i < DEBRIS_N; i++) { dState.push({ life: 0 }); debris.setColorAt(i, new THREE.Color(1, 1, 1)); }
  scene.add(debris);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _col = new THREE.Color();
  let dNext = 0;
  function spawnDebris(x, y, z, color, n, speed, size, life, opts) {
    opts = opts || {};
    for (let k = 0; k < n; k++) {
      const p = dState[dNext]; dNext = (dNext + 1) % DEBRIS_N;
      const a = Math.random() * TAU, el = rnd(-0.3, 1.2), v = speed * rnd(0.4, 1.1);
      p.x = x + rnd(-0.3, 0.3); p.y = y + rnd(-0.3, 0.3); p.z = z + rnd(-0.3, 0.3);
      p.vx = Math.cos(a) * Math.cos(el) * v; p.vy = Math.sin(el) * v + speed * 0.3; p.vz = Math.sin(a) * Math.cos(el) * v;
      p.rx = rnd(0, TAU); p.ry = rnd(0, TAU); p.vr = rnd(-10, 10);
      p.s = size * rnd(0.5, 1.2); p.life = life * rnd(0.7, 1.2); p.max = p.life;
      p.flat = opts.flat; p.g = opts.g != null ? opts.g : 1;
      debris.setColorAt((dNext - 1 + DEBRIS_N) % DEBRIS_N, _col.set(color));
    }
    debris.instanceColor.needsUpdate = true;
  }
  function updateDebris(dt) {
    for (let i = 0; i < DEBRIS_N; i++) {
      const p = dState[i];
      if (p.life <= 0) { _m.makeScale(0, 0, 0); debris.setMatrixAt(i, _m); continue; }
      p.life -= dt;
      p.vy += C.G * 0.8 * p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.05 && Math.hypot(p.x, p.z) < C.ISLAND_R && p.vy < 0) { p.y = 0.05; p.vy *= -0.35; p.vx *= 0.7; p.vz *= 0.7; }
      p.rx += p.vr * dt; p.ry += p.vr * 0.7 * dt;
      const k = Math.min(1, p.life / p.max * 2.5);
      _q.setFromEuler(_e.set(p.rx, p.ry, 0));
      const s = p.s * k;
      _s.set(s, p.flat ? s * 0.15 : s, s);
      _m.compose(_v.set(p.x, p.y, p.z), _q, _s);
      debris.setMatrixAt(i, _m);
    }
    debris.instanceMatrix.needsUpdate = true;
  }
  // humo, destellos y anillos con sprites
  const sprites = [];
  function spawnSprite(x, y, z, color, size, grow, life, opts) {
    opts = opts || {};
    let s = sprites.find(o => o.life <= 0);
    if (!s) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.soft, transparent: true, depthWrite: false, blending: THREE.NormalBlending }));
      scene.add(m); s = { m, life: 0 }; sprites.push(s);
    }
    s.m.visible = true; s.m.position.set(x, y, z); s.m.material.color.set(color);
    s.m.material.blending = opts.add ? THREE.AdditiveBlending : THREE.NormalBlending;
    s.size = size; s.grow = grow; s.life = life; s.max = life; s.vy = opts.vy || 0; s.alpha = opts.alpha || 0.9;
    s.m.scale.set(size, size, 1);
  }
  function updateSprites(dt) {
    for (const s of sprites) {
      if (s.life <= 0) { s.m.visible = false; continue; }
      s.life -= dt;
      const k = 1 - s.life / s.max;
      const sz = s.size * (1 + s.grow * k);
      s.m.scale.set(sz, sz, 1); s.m.position.y += s.vy * dt;
      s.m.material.opacity = s.alpha * (1 - k);
    }
  }
  // anillos de onda y rayos de bloques rayados
  const rings = [];
  function spawnRing(x, y, z, color, r, life) {
    let o = rings.find(q => q.life <= 0);
    if (!o) { const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 40), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })); scene.add(m); o = { m, life: 0 }; rings.push(o); }
    o.m.visible = true; o.m.position.set(x, y, z); o.m.material.color.set(color); o.r = r; o.life = life; o.max = life;
    o.m.quaternion.copy(camera.quaternion);
  }
  function updateRings(dt) {
    for (const o of rings) {
      if (o.life <= 0) { o.m.visible = false; continue; }
      o.life -= dt; const k = 1 - o.life / o.max;
      const s = o.r * (0.2 + k); o.m.scale.set(s, s, s); o.m.material.opacity = 1 - k;
    }
  }
  const beams = [];
  function spawnBeam(y, z, color) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(14, 0.25, 0.25), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.set(0, y, z); scene.add(m); beams.push({ m, life: 0.45, max: 0.45 });
  }
  const flyers = [];
  const rocketGeo = (() => { const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.9, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })); body.rotation.z = Math.PI / 2; g.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 16), new THREE.MeshStandardMaterial({ color: 0xff4f6d, roughness: 0.4 })); nose.rotation.z = -Math.PI / 2; nose.position.x = 0.65; g.add(nose);
    for (const s of [1, -1]) { const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.3), new THREE.MeshStandardMaterial({ color: 0xff4f6d })); fin.position.set(-0.35, 0, s * 0.2); fin.rotation.y = s * 0.5; g.add(fin); const fin2 = fin.clone(); fin2.rotation.set(Math.PI / 2, 0, 0); fin2.position.set(-0.35, s * 0.2, 0); g.add(fin2); }
    return g; })();
  function launchFlyer(e) {
    const m = rocketGeo.clone(); m.position.set(e.x, e.y, e.z); if (e.dir < 0) m.rotation.y = Math.PI; scene.add(m);
    if (e.to) { m.lookAt(e.to[0], e.to[1], e.to[2]); m.rotateY(-Math.PI / 2); flyers.push({ m, p0: [e.x, e.y, e.z], to: e.to, life: 0, max: 0.38 }); return; }
    flyers.push({ m, x0: e.x, x1: e.x1, life: 0, max: Math.max(0.35, Math.abs(e.x1 - e.x) * 0.045 + 0.05) });
  }
  function updateFlyers(dt) {
    for (const f of flyers) {
      f.life += dt; const k = Math.min(1, f.life / f.max), p = f.m.position;
      if (f.to) { p.set(f.p0[0] + (f.to[0] - f.p0[0]) * k, f.p0[1] + (f.to[1] - f.p0[1]) * k + Math.sin(Math.PI * k) * 2.5, f.p0[2] + (f.to[2] - f.p0[2]) * k); spawnSprite(p.x, p.y, p.z, Math.random() < 0.5 ? 0xffb23a : 0xff6a1a, 0.6, 1.4, 0.3, { add: true, alpha: 1 }); }
      else {
      p.x = f.x0 + (f.x1 - f.x0) * k; f.m.rotation.x += dt * 14;
      spawnSprite(p.x - Math.sign(f.x1 - f.x0) * 0.5, p.y, p.z, Math.random() < 0.5 ? 0xffb23a : 0xff6a1a, 0.7, 1.4, 0.35, { add: true, alpha: 1 });
      if (Math.random() < 0.5) spawnSprite(p.x - Math.sign(f.x1 - f.x0) * 0.8, p.y, p.z, 0xe8e2f0, 0.6, 2, 0.7, { alpha: 0.5, vy: 0.4 });
      }
      if (k >= 1) { scene.remove(f.m); f.done = true; spawnSprite(p.x, p.y, p.z, 0xffd27a, 2, 1.5, 0.3, { add: true }); }
    }
    for (let i = flyers.length - 1; i >= 0; i--) if (flyers[i].done) flyers.splice(i, 1);
  }
  function rocketStrike() {
    const sim = G.sim; if (!sim) return;
    const live = sim.liveBlocks().filter(b => b.userData.kind === 'block');
    if (!live.length) return;
    const rows = {}; for (const b of live) { const k = Math.round(b.position.y * 2); rows[k] = (rows[k] || 0) + 1; }
    const best = +Object.keys(rows).sort((a, b) => rows[b] - rows[a])[0] / 2;
    const row = live.filter(b => Math.abs(b.position.y - best) < 0.55), z = Math.max(...row.map(b => b.position.z));
    launchFlyer({ x: -C.ISLAND_R - 2, y: best, z, dir: 1, x1: C.ISLAND_R + 2 });
    for (const b of row) sim.popSingle(b, 0.06 + (b.position.x + C.ISLAND_R + 2) * 0.045);
    centerText('¡COHETE DE RACHA!', '#ffb23a', 30); Audio.special(); Audio.shoot(); vibe([20, 20, 40]);
  }
  // clima de las vueltas: aviso arriba y explicación la primera vez
  const WX = {
    storm: ['VIENTO', 'Tormenta: el viento desvía la bola. Mira la guía al apuntar.'], sandstorm: ['RÁFAGAS', 'Tormenta de arena: ráfagas de viento que cambian de fuerza.'],
    blizzard: ['HIELO', 'Ventisca: todo resbala más. Las torres caen con poco.'], rain: ['LLUVIA', 'Lluvia: el suelo está mojado y los bloques resbalan.'],
    ash: ['BRASAS', 'Lluvia de ceniza: caen brasas que rompen bloques de arriba.'], meteors: ['METEORITOS', 'Meteoritos: de vez en cuando uno golpea la estructura.'] };
  function setWeatherChip(L) {
    const el = $('wxChip'), w = L.weather && WX[L.weather];
    el.hidden = !w; if (!w) return;
    el.dataset.w = L.weather; el.querySelector('b').textContent = w[0]; el.querySelector('i').textContent = '';
    save.seenWx = save.seenWx || {};
    if (!save.seenWx[L.weather]) { save.seenWx[L.weather] = true; persist(); setTimeout(() => { if (G.level === L) showHint(w[1], 5000); }, 1600); }
  }
  function updateWeatherChip() {
    const sim = G.sim, el = $('wxChip'); if (!sim || el.hidden || !sim.windBase) return;
    const a = el.querySelector('i'), w = sim.wind;
    a.textContent = Math.abs(w) < 0.3 ? '·' : (w < 0 ? '←' : '→').repeat(Math.max(1, Math.min(3, Math.round(Math.abs(w) / 1.6))));
  }
  function grandFinale(n) {
    const sim = G.sim, cp = G.level.cannon || C.CANNON_POS;
    sim.coins += n * 5;
    for (let i = 0; i < Math.min(n, 10); i++) setTimeout(() => {
      if (G.sim !== sim) return;
      const live = sim.liveBlocks().filter(b => b.userData.kind === 'block' && !b.userData.popping);
      const tgt = live.length ? live[(Math.random() * live.length) | 0] : null;
      const tx = tgt ? tgt.position.x : rnd(-3, 3), ty = tgt ? tgt.position.y : rnd(2, 5), tz = tgt ? tgt.position.z : 0;
      launchFlyer({ x: cp.x, y: cp.y + 0.5, z: cp.z - 1, dir: 1, x1: cp.x, to: [tx, ty, tz] });
      setTimeout(() => {
        if (G.sim !== sim) return;
        if (tgt) sim.popSingle(tgt, 0.01);
        for (const c of [0xff4f6d, 0xffd23f, 0x5fd45a, 0x3d9bff, 0xa66bff]) spawnDebris(tx, ty, tz, c, 4, 6, 0.1, 1, { flat: true });
        spawnSprite(tx, ty, tz, 0xffe27a, 2.4, 1.6, 0.35, { add: true, alpha: 1 });
        floatText(tx, ty + 0.8, tz, '+5', '#ffd23f', 24, true); Audio.coin(); vibe(15);
      }, 380);
    }, 250 + i * 220);
  }
  function updateBeams(dt) {
    for (const b of beams) { b.life -= dt; const k = 1 - b.life / b.max; b.m.scale.set(1, 1 + k * 3, 1 + k * 3); b.m.material.opacity = Math.max(0, 1 - k); if (b.life <= 0) scene.remove(b.m); }
    for (let i = beams.length - 1; i >= 0; i--) if (beams[i].life <= 0) beams.splice(i, 1);
  }

  // texto flotante en pantalla
  const ftBox = $('ftexts');
  let ftTimes = [];
  function floatText(x, y, z, txt, color, size, force, clampEdge) {
    const now = performance.now();
    ftTimes = ftTimes.filter(t => now - t < 450);
    if (!force && ftTimes.length >= 3) return;
    ftTimes.push(now);
    _v.set(x, y, z).project(camera);
    if (_v.z > 1) return;
    const el = document.createElement('div');
    el.className = 'ft'; el.textContent = txt;
    let fx = (_v.x * 0.5 + 0.5) * W, fy = (-_v.y * 0.5 + 0.5) * H;
    if (clampEdge) { fx = clamp(fx, 60, W - 60); fy = clamp(fy, 110, H - 190); }
    el.style.left = fx + 'px'; el.style.top = fy + 'px';
    el.style.color = color || '#fff'; el.style.fontSize = (size || 18) + 'px';
    ftBox.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }
  // textos grandes del centro: si llegan varios a la vez, salen uno detrás de otro (nunca encima)
  const ctQueue = []; let ctCur = null, ctFree = 0, ctTimer = 0;
  function centerText(txt, color, size) {
    if (ctQueue.some(q => q.txt === txt) || (ctCur && ctCur.textContent === txt && performance.now() < ctFree)) return;
    ctQueue.push({ txt, color, size });
    if (ctQueue.length > 4) ctQueue.splice(0, ctQueue.length - 4);
    pumpCenter();
  }
  function pumpCenter() {
    clearTimeout(ctTimer);
    if (!ctQueue.length) return;
    const now = performance.now();
    if (ctCur && now < ctFree) { ctTimer = setTimeout(pumpCenter, ctFree - now); return; }
    if (ctCur) { const old = ctCur; old.style.transition = 'opacity .12s'; old.style.opacity = '0'; setTimeout(() => old.remove(), 130); }
    const q = ctQueue.shift(), el = document.createElement('div');
    el.className = 'ft'; el.textContent = q.txt; el.style.left = '50%'; el.style.top = '38%';
    el.style.color = q.color || '#fff'; el.style.fontSize = (q.size || 30) + 'px'; el.style.animationDuration = '1.6s';
    ftBox.appendChild(el); setTimeout(() => el.remove(), 1600);
    ctCur = el; ctFree = now + 700;                 // cada texto se ve al menos 0,7 s antes de dar paso al siguiente
    if (ctQueue.length) ctTimer = setTimeout(pumpCenter, 700);
  }

  // ---------------- estado ----------------
  const G = {
    mode: 'title', sim: null, level: null, paused: false, t: 0,
    timeScale: 1, slowT: 0, shake: 0, flash: 0,
    meshes: [], ballMeshes: new Map(), aim: null, aimTarget: new THREE.Vector3(0, 2, 0),
    camBase: new THREE.Vector3(), camLook: new THREE.Vector3(), orbit: 0,
    recoil: 0, casi: 0, firstShot: false, swapped: false, winShown: false, ended: false, endT: 0, finalT: 0,
  };
  let W = 1, H = 1;
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    frameCamera();
  }
  window.addEventListener('resize', resize);

  // encuadre: el ancho del nivel cabe en pantalla con el cañón abajo
  // ¿se ve el punto y se puede tocar? (cámara real y tamaño real de la pantalla)
  const _vt = new THREE.Vector3();
  function viewTest(p) {
    if (G.introT > 0) return true;
    _vt.set(p.x, p.y, p.z).project(camera);
    if (_vt.z > 1) return false;
    const px = (_vt.x * 0.5 + 0.5) * W, py = (-_vt.y * 0.5 + 0.5) * H;
    const trayTop = H - 160, hudBottom = 74;
    if (px < W * 0.06 || px > W * 0.94 || py < hudBottom || py > trayTop) return false;
    if (Math.abs(_vt.x) < 0.3 && py > H * 0.68) return false;    // detrás del cañón
    return true;
  }
  function frameCamera() {
    const L = G.level;
    let maxY = 3;
    if (L) for (const b of L.blocks) maxY = Math.max(maxY, b.y + b.h / 2);
    const cp = L && L.cannon ? L.cannon : C.CANNON_POS;
    const aspect = W / H;
    camera.fov = aspect < 0.7 ? 56 : 46; camera.updateProjectionMatrix();
    const half = camera.fov / 2 * Math.PI / 180;
    const back = aspect < 0.7 ? 3.4 : 2.6;
    const lookY = Math.max(1.4, maxY * 0.42);
    // altura de cámara tal que el cañón quede justo encima de la bandeja (unos 3/4 de medio campo por debajo del centro)
    const want = half * 0.8;
    let best = 2.2, err = 1e9;
    for (let u = 1.6; u <= 7; u += 0.05) {
      const phi = Math.atan2(u, back), theta = Math.atan2(cp.y + u - lookY, cp.z + back);
      const e = Math.abs(phi - theta - want);
      if (e < err) { err = e; best = u; }
    }
    G.camBase.set(0, cp.y + best, cp.z + back);
    G.camLook.set(0, lookY, 0);
    cannonG.position.set(cp.x, cp.y, cp.z);
  }
  // mundos 11-100: el paisaje de su ciclo con la luz de su variante (día, atardecer, noche o aurora)
  const BIOME_THEME = { sea: THEMES[1], desert: THEMES[6], snow: THEMES[7], jungle: THEMES[8], volcano: THEMES[9], space: THEMES[10],
    candy: { top: 0xff8ad8, mid: 0xffc4ec, hor: 0xfff0d0, fog: 0xffd6ee, sea: 0xff8ac0, sun: 0xfff0f8, hemi: [0xffe0f4, 0xa05a8a], biome: 'candy', fogNear: 45, fogFar: 150 },
    crystal: { top: 0x150a30, mid: 0x3a1f6e, hor: 0x7a4ac8, fog: 0x24124a, sea: 0x3a2a8a, sun: 0xd8c8ff, hemi: [0xc8b8ff, 0x2a1a50], biome: 'crystal', fogNear: 30, fogFar: 120, sunI: 1.8, hemiI: 1.1 },
    temple: { top: 0x3f8fb8, mid: 0xa8d8c0, hor: 0xf0e2b0, fog: 0xc8d8b0, sea: 0x2f9a8a, sun: 0xfff0c8, hemi: [0xf0f0c8, 0x5a5a3a], biome: 'temple', fogNear: 40, fogFar: 140 },
    forest: { top: 0x2a5a6a, mid: 0x7ab8a8, hor: 0xd8f0d0, fog: 0x9ac8b0, sea: 0x2a7a6a, sun: 0xfff8e0, hemi: [0xd8ffe8, 0x2a4a2a], biome: 'forest', fogNear: 28, fogFar: 110 },
    fair: { top: 0x3a2a8f, mid: 0xb06ad6, hor: 0xffc08a, fog: 0xd8a0d0, sea: 0x4a3ab0, sun: 0xffe0b8, hemi: [0xf0d8ff, 0x6a4a6a], biome: 'fair', fogNear: 45, fogFar: 150 },
    neon: { top: 0x070a24, mid: 0x1a1a52, hor: 0x7a2a9a, fog: 0x1a1240, sea: 0x101a50, sun: 0xb8c8ff, hemi: [0xa0b0ff, 0x2a1a4a], biome: 'neon', fogNear: 40, fogFar: 160, sunI: 1.5, hemiI: 0.9 } };
  const mixC = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
  function themeFor(world) {
    const W = WORLDS[world - 1] || { biome: 'sea', variant: 'día' };
    const base = Object.assign({}, BIOME_THEME[W.biome] || THEMES[1], { variant: W.variant, weather: W.weather });
    if (W.biome === 'sea') { delete base.biome; if (world <= 3) Object.assign(base, THEMES[1]); }
    const v = W.variant;
    if (v === 'atardecer') Object.assign(base, { top: mixC(base.top, 0x4a2f8a, 0.6), mid: mixC(base.mid, 0xff9a6a, 0.55), hor: mixC(base.hor, 0xffa050, 0.7), fog: mixC(base.fog, 0xf0a080, 0.5), sun: 0xffb070, sea: mixC(base.sea, 0x6a3a8a, 0.35), sunI: 2.1, hemiI: 0.8 });
    else if (v === 'noche') Object.assign(base, { top: 0x060a26, mid: mixC(base.mid, 0x18245a, 0.8), hor: mixC(base.hor, 0x2a3a6a, 0.75), fog: mixC(base.fog, 0x141c3a, 0.8), sun: 0xa8b8ff, hemi: [0x8a9ad8, 0x2a2440], sea: mixC(base.sea, 0x0a1a40, 0.6), sunI: 1.3, hemiI: 0.6, stars: true });
    // el clima de las vueltas: cielo más cargado y niebla más cerca
    const wt = W.weather;
    if (wt === 'storm' || wt === 'rain') Object.assign(base, { top: mixC(base.top, 0x3a4256, 0.55), mid: mixC(base.mid, 0x6a7488, 0.5), hor: mixC(base.hor, 0x9aa2b0, 0.4), fog: mixC(base.fog, 0x8a92a0, 0.45), fogNear: 30, fogFar: 110, sunI: (base.sunI || 2.6) * 0.75 });
    else if (wt === 'sandstorm') Object.assign(base, { hor: mixC(base.hor, 0xe0a860, 0.6), fog: mixC(base.fog, 0xd8a060, 0.65), fogNear: 22, fogFar: 90 });
    else if (wt === 'blizzard') Object.assign(base, { fog: mixC(base.fog, 0xf0f6ff, 0.6), hor: mixC(base.hor, 0xffffff, 0.5), fogNear: 22, fogFar: 85 });
    else if (wt === 'ash') Object.assign(base, { top: mixC(base.top, 0x2a2224, 0.5), fog: mixC(base.fog, 0x4a3a38, 0.5), fogNear: 26, fogFar: 110 });
    if (W.biome === 'space') Object.assign(base, { top: THEMES[10].top, fogNear: 160, fogFar: 400, stars: false });
    if (W.biome === 'crystal') Object.assign(base, { stars: false });
    return base;
  }
  // cielo de noche (estrellas) y aurora boreal, compartidos por todos los paisajes
  const nightStars = (() => { const geo = new THREE.BufferGeometry(), a = new Float32Array(900 * 3); for (let i = 0; i < 900; i++) { const u = Math.random() * 0.95 + 0.05, t = Math.random() * TAU, q = Math.sqrt(1 - u * u); a[i * 3] = Math.cos(t) * q * 250; a[i * 3 + 1] = u * 250; a[i * 3 + 2] = Math.sin(t) * q * 250; } geo.setAttribute('position', new THREE.BufferAttribute(a, 3)); return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false, fog: false })); })();
  nightStars.visible = false; scene.add(nightStars);
  const auroraTex = canvasTex(256, 64, (g) => { const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(120,255,200,0)'); gr.addColorStop(0.5, 'rgba(120,255,190,0.9)'); gr.addColorStop(1, 'rgba(160,100,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 64); });
  const aurora = new THREE.Group();
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(180 - i * 15, 180 - i * 15, 40, 48, 1, true, Math.PI * (0.9 + i * 0.15), Math.PI * 0.7), new THREE.MeshBasicMaterial({ map: auroraTex, transparent: true, opacity: 0.55 - i * 0.12, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, fog: false })); m.position.y = 70 + i * 18; aurora.add(m); }
  aurora.visible = false; scene.add(aurora);
  function setTheme(world) {
    const th = themeFor(world);
    skyMat.uniforms.top.value.set(th.top); skyMat.uniforms.mid.value.set(th.mid); skyMat.uniforms.hor.value.set(th.hor);
    scene.fog = new THREE.Fog(th.fog, th.fogNear || 45, th.fogFar || 140);
    seaMat.color.set(th.sea); sun.color.set(th.sun); hemi.color.set(th.hemi[0]); hemi.groundColor.set(th.hemi[1]);
    sun.intensity = th.sunI || 2.6; hemi.intensity = th.hemiI || 0.9;
    setBiome(th.biome || 'sea');
    nightStars.visible = !!th.stars; aurora.visible = !!th.aurora;
    Weather.set(th.weather || null);
    if (th.stars) sunDisc.visible = false;
  }

  // ---------------- vista de un nivel ----------------
  function clearLevelView() {
    for (const m of G.meshes) { if (m) { world.remove(m); if (m.userData.rope) world.remove(m.userData.rope); } }
    G.meshes = [];
    for (const m of G.ballMeshes.values()) scene.remove(m);
    G.ballMeshes.clear();
    if (G.moverMeshes) { for (const m of G.moverMeshes.values()) scene.remove(m); G.moverMeshes.clear(); }
  }
  // ---- bloques nuevos: cohete, piñata, reloj de arena, espejo, muelle, géiser y portal ----
  const NEWK = (() => {
    const deco = (draw) => canvasTex(128, 128, (g) => { g.clearRect(0, 0, 128, 128); draw(g); }, true);
    const rocketTex = deco(g => {
      g.translate(64, 64); g.rotate(-Math.PI / 4);
      g.fillStyle = '#ffb23a'; g.beginPath(); g.moveTo(-10, 34); g.lineTo(0, 58); g.lineTo(10, 34); g.fill();
      g.fillStyle = '#ff4f6d'; g.beginPath(); g.moveTo(-18, 30); g.lineTo(-28, 44); g.lineTo(-10, 36); g.fill(); g.beginPath(); g.moveTo(18, 30); g.lineTo(28, 44); g.lineTo(10, 36); g.fill();
      g.fillStyle = '#fff'; g.strokeStyle = '#2a1d5c'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, -46); g.quadraticCurveTo(22, -20, 16, 34); g.lineTo(-16, 34); g.quadraticCurveTo(-22, -20, 0, -46); g.fill(); g.stroke();
      g.fillStyle = '#3d9bff'; g.beginPath(); g.arc(0, -6, 9, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#ff4f6d'; g.beginPath(); g.moveTo(0, -46); g.quadraticCurveTo(12, -34, 12, -26); g.lineTo(-12, -26); g.quadraticCurveTo(-12, -34, 0, -46); g.fill();
    });
    const pinataTex = canvasTex(128, 128, (g) => { const c = ['#ff4f6d', '#ffd23f', '#5fd45a', '#3d9bff', '#a66bff', '#ff9a3d']; for (let i = 0; i < 8; i++) { g.fillStyle = c[i % c.length]; g.fillRect(0, i * 16, 128, 16); g.fillStyle = 'rgba(255,255,255,.35)'; for (let x = 0; x < 128; x += 8) g.fillRect(x, i * 16 + 13, 4, 3); } }, true);
    const hourTex = deco(g => {
      g.strokeStyle = '#7a4a1a'; g.lineWidth = 8; g.beginPath(); g.moveTo(30, 18); g.lineTo(98, 18); g.moveTo(30, 110); g.lineTo(98, 110); g.stroke();
      g.fillStyle = 'rgba(220,240,255,.55)'; g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.moveTo(38, 22); g.lineTo(90, 22); g.lineTo(68, 64); g.lineTo(90, 106); g.lineTo(38, 106); g.lineTo(60, 64); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ffc23d'; g.beginPath(); g.moveTo(48, 40); g.lineTo(80, 40); g.lineTo(64, 62); g.fill(); g.beginPath(); g.moveTo(42, 104); g.lineTo(86, 104); g.lineTo(64, 84); g.fill(); g.fillRect(62, 62, 4, 30);
    });
    const springTex = deco(g => { g.strokeStyle = '#2a1d5c'; g.lineWidth = 10; g.lineCap = 'round'; g.beginPath(); for (let i = 0; i <= 5; i++) { const y = 100 - i * 15; g.moveTo(30, y); g.lineTo(98, y - 8); } g.stroke(); g.strokeStyle = '#ffd23f'; g.lineWidth = 6; g.stroke(); });
    const ventTex = deco(g => { g.fillStyle = '#1d1430'; g.beginPath(); g.ellipse(64, 70, 30, 18, 0, 0, 7); g.fill(); g.fillStyle = '#7fe6ff'; g.beginPath(); g.ellipse(64, 66, 18, 9, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(50 + i * 14, 40 - i * 6, 7 + i * 2, 0, 7); g.fill(); } });
    const decal = (tex) => new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const giftTex = deco(g => { g.fillStyle = '#ffd23f'; g.fillRect(54, 0, 20, 128); g.fillRect(0, 54, 128, 20); g.strokeStyle = '#2a1d5c'; g.lineWidth = 4; g.strokeRect(54, 0, 20, 128); g.strokeRect(0, 54, 128, 20);
      g.fillStyle = '#ffd23f'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(64 + s * 18, 50, 18, 11, s * 0.5, 0, 7); g.fill(); g.stroke(); } g.fillStyle = '#fff'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.fillText('?', 64, 100); });
    const rainbowTex = canvasTex(128, 128, (g) => { const c = ['#ff4f6d', '#ff9a3d', '#ffd23f', '#5fd45a', '#3d9bff', '#a66bff']; for (let i = -6; i < 12; i++) { g.fillStyle = c[((i % 6) + 6) % 6]; g.beginPath(); g.moveTo(i * 22, 0); g.lineTo(i * 22 + 22, 0); g.lineTo(i * 22 - 106, 128); g.lineTo(i * 22 - 128, 128); g.fill(); } g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(40, 36, 20, 0, 7); g.fill(); }, true);
    const keyTex = deco(g => { g.strokeStyle = '#7a4a08'; g.fillStyle = '#ffd23f'; g.lineWidth = 6; g.beginPath(); g.arc(40, 64, 22, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#7a4a08'; g.beginPath(); g.arc(40, 64, 8, 0, 7); g.fill();
      g.fillStyle = '#ffd23f'; g.fillRect(60, 56, 54, 16); g.strokeRect(60, 56, 54, 16); g.fillRect(92, 72, 10, 18); g.fillRect(106, 72, 8, 14); });
    const lockTex = deco(g => { g.strokeStyle = '#3a3448'; g.lineWidth = 10; g.beginPath(); g.arc(64, 54, 22, Math.PI, 0); g.stroke(); g.fillStyle = '#ffd23f'; g.strokeStyle = '#7a4a08'; g.lineWidth = 5; g.beginPath(); g.roundRect(34, 54, 60, 46, 10); g.fill(); g.stroke(); g.fillStyle = '#7a4a08'; g.beginPath(); g.arc(64, 72, 7, 0, 7); g.fill(); g.fillRect(61, 74, 6, 14);
      g.strokeStyle = 'rgba(60,52,72,.85)'; g.lineWidth = 7; for (const y of [12, 116]) { g.beginPath(); for (let x = 0; x <= 128; x += 16) { g.moveTo(x, y - 5); g.lineTo(x + 10, y + 5); } g.stroke(); } });
    const magnetTex = deco(g => { g.lineWidth = 26; g.strokeStyle = '#ff3a5a'; g.beginPath(); g.arc(64, 58, 32, Math.PI, 0); g.stroke(); g.fillStyle = '#ff3a5a'; g.fillRect(19, 56, 26, 30); g.fillRect(83, 56, 26, 30); g.fillStyle = '#e8eef8'; g.fillRect(19, 86, 26, 18); g.fillRect(83, 86, 26, 18); });
    const gumTex = deco(g => { g.fillStyle = '#ff8ad0'; g.beginPath(); g.arc(64, 64, 40, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(50, 48, 12, 0, 7); g.fill(); g.strokeStyle = '#c0408a'; g.lineWidth = 4; g.beginPath(); g.arc(64, 64, 40, 0, 7); g.stroke(); });
    const fanTex = deco(g => { g.translate(64, 64); g.fillStyle = '#cfd8e8'; g.strokeStyle = '#2a1d5c'; g.lineWidth = 4; for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.beginPath(); g.ellipse(0, -26, 14, 26, 0.4, 0, 7); g.fill(); g.stroke(); } g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(0, 0, 11, 0, 7); g.fill(); g.stroke(); });
    const tikiTex = deco(g => { g.fillStyle = 'rgba(40,20,60,.75)'; g.fillRect(28, 40, 26, 12); g.fillRect(74, 40, 26, 12); g.fillRect(40, 78, 48, 22); g.fillStyle = '#fff'; for (let x = 44; x < 88; x += 10) g.fillRect(x, 80, 6, 8); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(14, 18, 100, 6); });
    return {
      gift: { body: new THREE.MeshStandardMaterial({ color: 0xff4f6d, roughness: 0.45 }), deco: decal(giftTex) },
      prism: { body: new THREE.MeshPhysicalMaterial({ map: rainbowTex, roughness: 0.15, clearcoat: 1, emissive: 0x332244, emissiveIntensity: 0.4 }) },
      key: { body: new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.6 }), deco: decal(keyTex) },
      magnet: { body: new THREE.MeshStandardMaterial({ color: 0x3a3448, roughness: 0.5, metalness: 0.5 }), deco: decal(magnetTex) },
      gum: { body: new THREE.MeshStandardMaterial({ color: 0xffb8e2, roughness: 0.35 }), deco: decal(gumTex) },
      fan: { body: new THREE.MeshStandardMaterial({ color: 0x6a7a96, roughness: 0.5, metalness: 0.4 }), deco: decal(fanTex) },
      snowball: { body: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }) },
      balloon: { body: null }, cloud: { body: null },
      lockDeco: decal(lockTex), tikiDeco: decal(tikiTex),
      rocket: { body: new THREE.MeshStandardMaterial({ color: 0x3a2f6e, roughness: 0.4, metalness: 0.2 }), deco: decal(rocketTex) },
      pinata: { body: new THREE.MeshStandardMaterial({ map: pinataTex, roughness: 0.6 }) },
      hourglass: { body: new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, roughness: 0.1, transparent: true, opacity: 0.55, clearcoat: 1 }), deco: decal(hourTex) },
      mirror: { body: new THREE.MeshStandardMaterial({ color: 0xe8f2ff, metalness: 1, roughness: 0.04, envMapIntensity: 2 }) },
      spring: { body: new THREE.MeshStandardMaterial({ color: 0x5fd45a, roughness: 0.5 }), deco: decal(springTex) },
      geyser: { body: MAT.stone, deco: decal(ventTex) },
    };
  })();
  // icono de cada bloque nuevo para su tarjeta de estreno
  const DEBUT_KIND = { k: 'rocket', n: 'pinata', h: 'hourglass', e: 'mirror', u: 'spring', v: 'geyser', q: 'portal', j: 'gift', B: 'bubble', w: 'prism', F: 'fan', l: 'lock', S: 'snowball', N: 'cloud', V: 'vine', d: 'balloon', z: 'magnet', T: 'totem', C: 'gum' };
  const DEBUT_FIND = { lock: b => b.userData.kind === 'key', bubble: b => b.userData.bubble, totem: b => b.userData.totem, vine: b => b.userData.vine };
  function newKindIcon(kind) {
    const L = NEWK[kind];
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const ico = { bubble: '#cfefff', cloud: '#ffffff', vine: '#5fd45a', balloon: '#ff4f6d', totem: '#ffd23f', lock: '#3d9bff', snowball: '#ffffff' }[kind];
    if (ico) {
      g.fillStyle = kind === 'cloud' || kind === 'snowball' ? '#7fb8ff' : '#3a2f6e'; g.strokeStyle = '#2a1d5c'; g.lineWidth = 6; g.beginPath(); g.roundRect(10, 10, 108, 108, 22); g.fill(); g.stroke();
      if (kind === 'bubble') { g.fillStyle = '#ff4f6d'; g.fillRect(44, 44, 40, 40); g.strokeStyle = '#cfefff'; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 40, 0, 7); g.stroke(); }
      if (kind === 'cloud' || kind === 'snowball') { g.fillStyle = '#fff'; if (kind === 'cloud') { for (const [x, y, r] of [[44, 70, 22], [66, 58, 26], [88, 72, 20], [64, 80, 22]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } } else { g.beginPath(); g.arc(64, 66, 36, 0, 7); g.fill(); } }
      if (kind === 'vine') { g.strokeStyle = '#5fd45a'; g.lineWidth = 6; g.beginPath(); g.moveTo(64, 14); g.lineTo(64, 64); g.stroke(); g.fillStyle = '#ffd23f'; g.fillRect(44, 64, 40, 40); }
      if (kind === 'balloon') { g.fillStyle = '#ff4f6d'; g.beginPath(); g.ellipse(64, 54, 28, 34, 0, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(64, 88); g.quadraticCurveTo(54, 100, 64, 114); g.stroke(); }
      if (kind === 'totem') { g.fillStyle = '#ffd23f'; g.fillRect(34, 18, 60, 92); g.drawImage(NEWK.tikiDeco.map.image, 34, 30, 60, 60); }
      if (kind === 'lock') { g.fillStyle = '#3d9bff'; g.fillRect(24, 24, 80, 80); g.drawImage(NEWK.lockDeco.map.image, 24, 24, 80, 80); }
      return c.toDataURL();
    }
    if (kind === 'portal') { const gr = g.createRadialGradient(64, 64, 8, 64, 64, 56); gr.addColorStop(0, '#fff'); gr.addColorStop(0.45, '#c07bff'); gr.addColorStop(0.8, '#5a1fd6'); gr.addColorStop(1, 'rgba(90,31,214,0)'); g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.fill(); g.strokeStyle = '#2a1d5c'; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 44, 0, 7); g.stroke(); return c.toDataURL(); }
    g.fillStyle = kind === 'mirror' ? '#dfe8f5' : kind === 'geyser' ? '#9a94aa' : kind === 'spring' ? '#5fd45a' : kind === 'hourglass' ? '#cfeaff' : '#3a2f6e';
    g.strokeStyle = '#2a1d5c'; g.lineWidth = 6; g.beginPath(); g.roundRect(10, 10, 108, 108, 22); g.fill(); g.stroke();
    if (kind === 'pinata') { g.save(); g.clip(); g.drawImage(L.body.map.image, 10, 10, 108, 108); g.restore(); g.drawImage(FACES.p.normal.image, 24, 24, 80, 80); }
    if (kind === 'mirror') { const gr = g.createLinearGradient(10, 10, 118, 118); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#a8b8d8'); gr.addColorStop(1, '#f0f6ff'); g.fillStyle = gr; g.fillRect(20, 20, 88, 88); g.strokeStyle = '#ffd23f'; g.strokeRect(20, 20, 88, 88); }
    if (L && L.deco) g.drawImage(L.deco.map.image, 10, 10, 108, 108);
    return c.toDataURL();
  }
  function openNewCard(L) {
    const kind = DEBUT_KIND[L.debut]; if (!kind) return;
    $('ncIcon').src = newKindIcon(kind); $('ncName').textContent = L.debutTitle; $('ncWhat').textContent = L.debutWhat;
    G.paused = true; show('newCard'); Audio.special(); vibe([20, 30, 20]);
  }
  function closeNewCard() {
    if (!$('newCard').classList.contains('on')) return;
    $('newCard').classList.remove('on'); G.paused = false;
    const L = G.level, kind = DEBUT_KIND[L.debut], sim = G.sim;
    showHint(L.debutTip, 6000);
    // anillo que señala el bloque nuevo hasta el primer tiro
    const b = sim && sim.blocks.find(DEBUT_FIND[kind] || (x => x.userData.kind === kind && (kind !== 'portal' || x.userData.a)));
    if (b && G.meshes[b.userData.id]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.07, 10, 40), new THREE.MeshBasicMaterial({ color: 0x7dffb0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.position.z = b.userData.d / 2 + 0.15; G.meshes[b.userData.id].add(ring); G.debutRing = ring;
    }
  }
  function newKindMesh(d) {
    const g = new THREE.Group();
    if (d.kind === 'portal') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.11, 12, 40), new THREE.MeshStandardMaterial({ color: 0xc07bff, emissive: 0x9a3dff, emissiveIntensity: 1.6, roughness: 0.3 }));
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.55, 32), new THREE.MeshBasicMaterial({ map: TEX.soft, color: 0x7f5bff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      g.add(ring, disc); g.userData.body = ring; g.userData.spin = disc; g.userData.portal = true;
      return g;
    }
    if (d.kind === 'balloon') {
      const col = [0xff4f6d, 0xffd23f, 0x3d9bff, 0x5fd45a, 0xa66bff][d.id % 5];
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.52, 20, 14), new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.25, clearcoat: 1 })); b.scale.y = 1.12; b.castShadow = true; g.add(b);
      const knot = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.16, 8), b.material); knot.position.y = -0.6; knot.rotation.x = Math.PI; g.add(knot);
      g.userData.body = b; return g;
    }
    if (d.kind === 'cloud') {
      const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.93, emissive: 0xdfe8f5, emissiveIntensity: 0.35 });
      for (let i = 0; i < 9; i++) { const r = rnd(0.6, 1.05); const p = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), m); p.position.set(rnd(-d.w / 2 + 0.5, d.w / 2 - 0.5), rnd(-d.h / 2 + 0.5, d.h / 2 - 0.5), rnd(-0.2, 0.3)); g.add(p); }
      g.userData.body = g.children[0]; g.userData.cloud = true; return g;
    }
    if (d.kind === 'snowball') { const sb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.56, 2), NEWK.snowball.body); sb.castShadow = true; g.add(sb); g.userData.body = sb; g.userData.snow = sb; return g; }
    const L = NEWK[d.kind];
    const mesh = new THREE.Mesh(roundedGeo(d.w, d.h, d.d), L.body); mesh.castShadow = d.kind !== 'hourglass'; mesh.receiveShadow = true;
    g.add(mesh); g.userData.body = mesh;
    if (L.deco) for (const side of [1, -1]) { const f = new THREE.Mesh(faceGeo, L.deco); const fs = Math.min(d.w, d.h) * 0.92; f.scale.set(fs, fs, 1); f.position.z = side * (d.d / 2 + 0.006); if (side < 0) f.rotation.y = Math.PI; g.add(f); }
    if (d.kind === 'pinata') { const face = new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({ map: FACES.p.normal, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); face.scale.set(0.8, 0.8, 1); face.position.z = d.d / 2 + 0.007; g.add(face); }
    if (d.kind === 'mirror') { const fr = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(d.w, d.h, d.d)), new THREE.LineBasicMaterial({ color: 0xffd23f })); g.add(fr); }
    if (d.kind === 'hourglass') g.userData.sparkle = true;
    if (d.kind === 'geyser') g.userData.steam = true;
    if (d.kind === 'fan') g.userData.fanDeco = g.children.filter(c => c !== mesh);
    if (d.kind === 'prism' || d.kind === 'gift') g.userData.sparkle = true;
    return g;
  }
  function buildLevelView() {
    clearLevelView();
    const sim = G.sim;
    for (const b of sim.blocks) {
      const d = b.userData;
      if ((NEWK[d.kind] && d.kind !== 'lockDeco' && d.kind !== 'tikiDeco') || d.kind === 'portal') { const g = newKindMesh(d); world.add(g); G.meshes[d.id] = g; continue; }
      let mat;
      if (d.kind === 'stone') mat = MAT.stone;
      else if (d.kind === 'glass') mat = MAT.glass;
      else if (d.kind === 'tnt') mat = MAT.tnt;
      else if (d.kind === 'gold') mat = MAT.gold;
      else if (d.kind === 'sand') mat = MAT.sand;
      else if (d.kind === 'magma') mat = MAT.magma;
      else if (d.kind === 'prize') mat = prizeMat;
      else if (d.cham) mat = jellyCham[d.c];
      else if (d.ice && d.hp > 1) mat = iceMat[d.c];
      else mat = d.stripe ? jellyStripe[d.c] : d.bomb ? jellyBomb[d.c] : jelly[d.c];
      if (d.gem && d.kind === 'block') mat = gemCubeMat[d.c];
      const g = new THREE.Group();
      const geo = d.kind === 'tnt' ? new THREE.BoxGeometry(d.w, d.h, d.d) : roundedGeo(d.w, d.h, d.d);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = d.kind !== 'glass'; mesh.receiveShadow = true;
      g.add(mesh); g.userData.body = mesh;
      if (d.kind === 'glass') {
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(d.w, d.h, d.d)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
        g.add(edges);
      }
      if (d.kind === 'prize') {          // bola congelada: la bola se ve dentro del hielo
        const ball = new THREE.Mesh(new THREE.SphereGeometry(Math.min(d.w, d.h) * 0.3, 20, 14), jelly[d.c]); g.add(ball); g.userData.prizeBall = ball;
        const frost = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(d.w * 0.98, d.h * 0.98, d.d * 0.98)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })); g.add(frost);
      }
      if (d.float) {                     // antigravedad: anillo de luz que gira debajo
        const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.min(d.w, d.d) * 0.48, 0.04, 6, 28), floatRingMat); ring.rotation.x = Math.PI / 2; ring.position.y = -d.h / 2 - 0.06; g.add(ring); g.userData.floatRing = ring;
      }
      if (d.kind === 'magma') g.userData.magma = true;
      if (d.gem && d.kind === 'block') {
        // cubo de cristal: la gema gira dentro y el marco dorado lo distingue de lejos
        const inner = new THREE.Mesh(roundedGeo(d.w * 0.86, d.h * 0.86, d.d * 0.86), new THREE.MeshStandardMaterial({ color: COL[d.c], transparent: true, opacity: 0.2, roughness: 0.3, depthWrite: false }));
        g.add(inner);
        const gem = new THREE.Mesh(gemGeo, gemMat); gem.scale.setScalar(Math.min(d.w, d.h, d.d) * 0.62); gem.rotation.z = 0.15;
        g.add(gem); g.userData.gemMesh = gem;
        g.add(gemFrame(d.w, d.h, d.d));
      } else if (d.kind === 'block' && Math.min(d.w, d.h) >= 0.38) {
        const fs = Math.min(d.w, d.h) * 0.92;
        const face = new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({ map: d.cham ? chamFaceTex : FACES[d.c].normal, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
        face.scale.set(fs, fs, 1); face.position.z = d.d / 2 + 0.006; g.add(face);
        if (d.cham) { g.userData.chamFace = face; g.userData.blinkAt = 1e9; }
        g.userData.face = face;
        g.userData.blinkAt = rnd(1, 5);
      }
      if (d.kind === 'tnt') {
        const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.35, 6), new THREE.MeshStandardMaterial({ color: 0x2b2233 }));
        fuse.position.y = d.h / 2 + 0.15; g.add(fuse);
      }
      if (d.locked) { const L = new THREE.Mesh(faceGeo, NEWK.lockDeco); L.scale.set(0.95, 0.95, 1); L.position.z = d.d / 2 + 0.012; g.add(L); g.userData.lock = L; }
      if (d.totem) { if (g.userData.face) { g.userData.face.visible = false; g.userData.face = null; } const T = new THREE.Mesh(faceGeo, NEWK.tikiDeco); T.scale.set(0.95, 0.95, 1); T.position.z = d.d / 2 + 0.012; g.add(T); }
      if (d.bubble) { const bb = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 16), new THREE.MeshPhysicalMaterial({ color: 0xcfefff, transparent: true, opacity: 0.32, roughness: 0.05, clearcoat: 1, depthWrite: false })); g.add(bb); g.userData.bubble = bb; }
      if (d.vine && d.anchor) { const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]); const rope = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x3f8a3a })); world.add(rope); g.userData.rope = rope; g.userData.anchor = d.anchor; }
      world.add(g);
      G.meshes[d.id] = g;
    }
    syncView(0);
  }
  const fogMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc8, roughness: 0.9 });
  let cloudRects = [];
  function syncView(dt) {
    const sim = G.sim, t = G.t;
    cloudRects = (sim.clouds || []).filter(c => c.userData.alive).map(c => [c.position.x, c.position.y, c.userData.w / 2 + 0.2, c.userData.h / 2 + 0.2, c.position.z]);
    const look = sim.balls.length ? sim.balls[sim.balls.length - 1].position : null;
    for (const b of sim.blocks) {
      const d = b.userData, g = G.meshes[d.id];
      if (!g) continue;
      if (!d.alive && !d.popping) { g.visible = false; continue; }
      if (d.destroyed && !d.alive) { g.visible = false; continue; }
      g.position.copy(b.position); g.quaternion.copy(b.quaternion);
      if (d.popping && d.alive) {
        g.userData.pop = (g.userData.pop || 0) + dt * 8;
        const s = 1 + Math.min(0.3, g.userData.pop * 0.3); g.scale.set(s, s, s);
        g.userData.body.material = MAT.pop;
      }
      if (d.ice && d.hp <= 1 && !d.popping && g.userData.body.material !== jelly[d.c]) g.userData.body.material = jelly[d.c];
      if (g.userData.gemMesh) {
        const gm = g.userData.gemMesh; gm.rotation.y = t * 1.6 + d.id; gm.position.y = Math.sin(t * 2.2 + d.id) * d.h * 0.05;
        if (!d.popping && Math.random() < 0.025) spawnSprite(b.position.x + rnd(-0.3, 0.3), b.position.y + rnd(-0.2, 0.35), b.position.z + d.d / 2 + 0.1, 0xc9ffe6, 0.55, 0.55, 0.4, { add: true });
      }
      if (d.kind === 'gold' && Math.random() < 0.012) spawnSprite(b.position.x + rnd(-0.4, 0.4), b.position.y + rnd(-0.3, 0.5), b.position.z + 0.5, 0xfff2b0, 0.45, 0.5, 0.5, { add: true });
      const face = g.userData.chamFace ? null : g.userData.face;
      if (g.userData.floatRing) g.userData.floatRing.rotation.z = t * 2 + d.id;
      if (g.userData.prizeBall) g.userData.prizeBall.rotation.y = t;
      if (g.userData.rope) { const a = g.userData.rope.geometry.attributes.position; a.setXYZ(0, g.userData.anchor[0], g.userData.anchor[1], g.userData.anchor[2]); a.setXYZ(1, b.position.x, b.position.y + d.h / 2, b.position.z); a.needsUpdate = true; g.userData.rope.visible = d.alive && !d.destroyed && !!d.vineC; }
      if (g.userData.fanDeco) { const sp = sim.gust && Math.abs(sim.gust.x - b.position.x) < 0.1 ? 30 : 2; for (const f of g.userData.fanDeco) f.rotation.z += dt * sp; }
      if (cloudRects.length && d.kind === 'block') {
        const hide = cloudRects.some(c => Math.abs(b.position.x - c[0]) < c[2] && Math.abs(b.position.y - c[1]) < c[3] && b.position.z < c[4]);
        if (hide !== !!g.userData.fogged) { g.userData.fogged = hide; if (hide) { g.userData.mat0 = g.userData.body.material; g.userData.body.material = fogMat; } else if (g.userData.mat0) g.userData.body.material = g.userData.mat0; if (g.userData.face) g.userData.face.visible = !hide; }
      }
      if (g.userData.spin) { g.userData.spin.rotation.z = -t * 3; g.userData.body.rotation.z = t * 0.8; const k = 1 + Math.sin(t * 4 + d.id) * 0.06; g.scale.set(k, k, 1); }
      if (g.userData.sparkle && Math.random() < 0.02) spawnSprite(b.position.x + rnd(-0.3, 0.3), b.position.y + rnd(-0.3, 0.4), b.position.z + d.d / 2 + 0.1, 0xfff2b0, 0.4, 0.6, 0.5, { add: true });
      if (g.userData.steam && Math.random() < 0.03) spawnSprite(b.position.x + rnd(-0.2, 0.2), b.position.y + d.h / 2 + 0.2, b.position.z, 0xffffff, 0.5, 2, 1.1, { vy: 0.8, alpha: 0.45 });
      if (g.userData.magma && d.hot && !g.userData.hotMat) { g.userData.hotMat = MAT.magma.clone(); g.userData.body.material = g.userData.hotMat; }
      if (g.userData.hotMat) g.userData.hotMat.emissiveIntensity = 2 + Math.sin(t * 30) * 1.2;
      if (face) {
        const moving = b.sleepState !== 2 && b.velocity.lengthSquared() > 1.5;
        const danger = look && sim.balls.some(x => x.userData.c === d.c) && look.distanceTo(b.position) < 3.5;
        let mood = 'normal';
        if (moving || danger || d.popping) mood = 'scared';
        else if (t > g.userData.blinkAt) { mood = 'blink'; if (t > g.userData.blinkAt + 0.12) g.userData.blinkAt = t + rnd(2, 6); }
        const tex = FACES[d.c][mood];
        if (face.material.map !== tex) { face.material.map = tex; face.material.needsUpdate = true; }
      }
      if (d.kind === 'tnt' && d.lit) { g.userData.body.material.emissive = g.userData.body.material.emissive || new THREE.Color(); }
    }
    syncMovers();
    // agujero negro: disco oscuro con anillo morado que gira mientras dura
    if (sim.vortex) {
      if (!G.vortexMesh) {
        const gv = new THREE.Group();
        gv.add(new THREE.Mesh(new THREE.SphereGeometry(0.75, 24, 16), new THREE.MeshBasicMaterial({ color: 0x05020c })));
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.16, 8, 48), new THREE.MeshBasicMaterial({ color: 0xc07bff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
        ring.rotation.x = 1.2; gv.add(ring); gv.userData.ring = ring; scene.add(gv); G.vortexMesh = gv;
      }
      const V = sim.vortex, gv = G.vortexMesh; gv.visible = true; gv.position.set(V.x, V.y, V.z);
      gv.userData.ring.rotation.z += dt * 8; gv.scale.setScalar(0.8 + Math.min(1, (1.8 - V.t) * 3) * 0.4);
      if (Math.random() < 0.5) spawnSprite(V.x + rnd(-2.5, 2.5), V.y + rnd(-1.5, 1.5), V.z + rnd(-1, 1), 0xa66bff, 0.5, -0.8, 0.5, { add: true, alpha: 0.8 });
    } else if (G.vortexMesh) G.vortexMesh.visible = false;
    // bolas
    const live = new Set();
    for (const b of sim.balls) {
      live.add(b);
      let m = G.ballMeshes.get(b);
      if (!m) { m = makeBallMesh(b.userData.ball, b.userData.r); scene.add(m); G.ballMeshes.set(b, m); }
      m.position.copy(b.position); m.quaternion.copy(b.quaternion);
      const wt = W_TRAIL[b.userData.ball];
      if (Math.random() < 0.6) spawnSprite(b.position.x, b.position.y, b.position.z, wt || 0xffffff, b.userData.r * (wt ? 2 : 1.4), 0.4, wt ? 0.4 : 0.25, { alpha: wt ? 0.6 : 0.35, add: !!wt });
    }
    for (const [b, m] of G.ballMeshes) if (!live.has(b)) { scene.remove(m); G.ballMeshes.delete(b); }
  }
  const SPECIAL_MAT = {
    rainbow: new THREE.MeshPhysicalMaterial({ map: rainbowTex, roughness: 0.25, clearcoat: 1 }),
    bomb: new THREE.MeshPhysicalMaterial({ color: 0x2d2640, roughness: 0.35, metalness: 0.3, clearcoat: 1 }),
    heavy: new THREE.MeshPhysicalMaterial({ color: 0x9d9ab0, roughness: 0.3, metalness: 0.8 }),
    golden: new THREE.MeshPhysicalMaterial({ color: 0xffc83d, roughness: 0.12, metalness: 1, clearcoat: 1, emissive: new THREE.Color(0x7a4a00), envMapIntensity: 1.8 }),
  };
  // ---------- bolas de los mundos: aspecto ----------
  const wtex = (draw) => canvasTex(256, 128, draw);
  const W_TEX = {
    w1: wtex(g => { g.fillStyle = '#5c6274'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#3a3f4e'; g.fillRect(0, 56, 256, 16); g.fillStyle = '#c8ccd8'; for (let x = 8; x < 256; x += 22) { g.beginPath(); g.arc(x, 64, 4, 0, TAU); g.fill(); } g.strokeStyle = 'rgba(255,255,255,0.15)'; g.lineWidth = 3; for (let x = 0; x < 256; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 16, 128); g.stroke(); } }),
    w2: wtex(g => { g.fillStyle = '#1f1a5a'; g.fillRect(0, 0, 256, 128); const cs = ['#ff4f6d', '#ffd23f', '#5fd45a', '#3dc8ff', '#ff9ad6']; for (let i = 0; i < 14; i++) { const x = rnd(10, 246), y = rnd(10, 118), c = cs[i % 5]; g.strokeStyle = c; g.lineWidth = 2.5; for (let a = 0; a < 8; a++) { const t = a / 8 * TAU; g.beginPath(); g.moveTo(x + Math.cos(t) * 3, y + Math.sin(t) * 3); g.lineTo(x + Math.cos(t) * 11, y + Math.sin(t) * 11); g.stroke(); } } }),
    w3: wtex(g => { g.fillStyle = '#cfefff'; g.fillRect(0, 0, 256, 128); g.strokeStyle = '#ffffff'; g.lineWidth = 3; for (let i = 0; i < 8; i++) { const x = 16 + i * 32, y = i % 2 ? 40 : 88; for (let a = 0; a < 6; a++) { const t = a / 6 * TAU; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(t) * 13, y + Math.sin(t) * 13); g.stroke(); } } }),
    w4: wtex(g => { g.fillStyle = '#1f3f8a'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#e8c48a'; g.fillRect(0, 54, 256, 20); g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.lineCap = 'round'; for (const x of [64, 192]) { g.beginPath(); g.moveTo(x, 20); g.lineTo(x, 100); g.moveTo(x - 18, 34); g.lineTo(x + 18, 34); g.moveTo(x - 26, 82); g.quadraticCurveTo(x, 112, x + 26, 82); g.stroke(); } }),
    w6: wtex(g => { g.fillStyle = '#e2b46e'; g.fillRect(0, 0, 256, 128); g.strokeStyle = '#a8742e'; g.lineWidth = 6; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(0, 10 + i * 22); g.bezierCurveTo(80, i * 22 - 14, 170, 34 + i * 22, 256, 10 + i * 22); g.stroke(); } }),
    w7: wtex(g => { g.fillStyle = '#f6fbff'; g.fillRect(0, 0, 256, 128); for (let i = 0; i < 200; i++) { g.fillStyle = 'rgba(160,200,235,0.3)'; g.beginPath(); g.arc(rnd(0, 256), rnd(0, 128), rnd(2, 7), 0, TAU); g.fill(); } }),
    w10: wtex(g => { g.fillStyle = '#05030c'; g.fillRect(0, 0, 256, 128); const gr = g.createLinearGradient(0, 44, 0, 84); gr.addColorStop(0, 'rgba(160,80,255,0)'); gr.addColorStop(0.5, '#c07bff'); gr.addColorStop(1, 'rgba(160,80,255,0)'); g.fillStyle = gr; g.fillRect(0, 44, 256, 40); g.fillStyle = '#fff'; for (let i = 0; i < 30; i++) g.fillRect(rnd(0, 256), rnd(0, 128), 1.5, 1.5); }),
  };
  Object.assign(SPECIAL_MAT, {
    w1: new THREE.MeshPhysicalMaterial({ map: W_TEX.w1, metalness: 0.85, roughness: 0.3, clearcoat: 0.5 }),
    w2: new THREE.MeshPhysicalMaterial({ map: W_TEX.w2, emissiveMap: W_TEX.w2, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.3, clearcoat: 1 }),
    w3: new THREE.MeshPhysicalMaterial({ map: W_TEX.w3, roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.9, envMapIntensity: 1.6 }),
    w4: new THREE.MeshPhysicalMaterial({ map: W_TEX.w4, roughness: 0.35, metalness: 0.3, clearcoat: 0.8 }),
    w5: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0.2, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [200, 900], envMapIntensity: 2 }),
    w6: new THREE.MeshPhysicalMaterial({ map: W_TEX.w6, roughness: 0.9 }),
    w7: new THREE.MeshPhysicalMaterial({ map: W_TEX.w7, roughness: 0.95, sheen: 1, sheenColor: new THREE.Color(0xcfe8ff) }),
    w8: new THREE.MeshPhysicalMaterial({ color: COL.g, map: scaleTex, roughness: 0.3, clearcoat: 0.9 }),
    w9: new THREE.MeshStandardMaterial({ map: magmaTex, emissiveMap: magmaGlow, emissive: 0xff6a1a, emissiveIntensity: 1.6, roughness: 0.8 }),
    w10: new THREE.MeshPhysicalMaterial({ map: W_TEX.w10, emissiveMap: W_TEX.w10, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.15, clearcoat: 1 }),
  });
  Object.assign(CSSB, { w1: 'bW1', w2: 'bW2', w3: 'bW3', w4: 'bW4', w5: 'bW5', w6: 'bW6', w7: 'bW7', w8: 'bW8', w9: 'bW9', w10: 'bW10' });
  const W_TRAIL = { w1: 0xc8ccd8, w2: 0xffd23f, w3: 0xcfefff, w4: 0x3d6bff, w5: 0xffffff, w6: 0xe2b46e, w7: 0xffffff, w8: 0x5fd45a, w9: 0xff7a1a, w10: 0xa66bff };
  // ---------- pájaro y barco ----------
  const birdMats = {
    body: new THREE.MeshStandardMaterial({ color: 0x4fc3ff, roughness: 0.45 }),
    belly: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
    wing: new THREE.MeshStandardMaterial({ color: 0x2b8fe0, roughness: 0.5, side: THREE.DoubleSide }),
    beak: new THREE.MeshStandardMaterial({ color: 0xffb02e, roughness: 0.4 }),
    eye: new THREE.MeshBasicMaterial({ color: 0x1d1440 }),
    crest: new THREE.MeshStandardMaterial({ color: 0xffd23f, metalness: 0.6, roughness: 0.3 }),
  };
  function makeBird() {
    const g = new THREE.Group(), m = birdMats;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 14), m.body); body.scale.set(1.3, 0.92, 0.92); g.add(body);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), m.belly); belly.scale.set(1.15, 0.8, 0.8); belly.position.set(0.05, -0.1, 0); g.add(belly);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 12), m.body); head.position.set(0.5, 0.22, 0); g.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 10), m.beak); beak.rotation.z = -Math.PI / 2; beak.position.set(0.86, 0.18, 0); g.add(beak);
    for (const z of [-0.17, 0.17]) {
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), birdMats.belly); w.position.set(0.68, 0.3, z); g.add(w);
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), m.eye); e.position.set(0.74, 0.31, z * 1.12); g.add(e);
    }
    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 8), m.crest); crest.position.set(0.45, 0.55, 0); crest.rotation.z = 0.4; g.add(crest);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 4), m.wing); tail.rotation.z = Math.PI / 2; tail.position.set(-0.62, 0.05, 0); tail.scale.set(1, 1, 0.35); g.add(tail);
    const wingGeo = new THREE.SphereGeometry(0.5, 14, 8); wingGeo.scale(0.6, 0.08, 1.1); wingGeo.translate(0, 0, 0.5);
    const wl = new THREE.Group(), wr = new THREE.Group();
    const wlm = new THREE.Mesh(wingGeo, m.wing); wl.add(wlm); wl.position.set(0, 0.15, 0.18);
    const wrm = new THREE.Mesh(wingGeo, m.wing); wrm.scale.z = -1; wr.add(wrm); wr.position.set(0, 0.15, -0.18);
    g.add(wl); g.add(wr); g.userData.wings = [wl, wr];
    g.scale.setScalar(1.25);
    g.traverse(o => { if (o.isMesh) o.castShadow = false; });
    return g;
  }
  // velero: casco blanco, vela mayor y foque triangulares, y en cubierta las 2 bolas que regala
  const sailTex = canvasTex(128, 128, (g) => {
    g.fillStyle = '#fffaf0'; g.fillRect(0, 0, 128, 128);
    const cols = ['#ff4f6d', '#ffd23f', '#3d9bff'];
    for (let i = 0; i < 3; i++) { g.fillStyle = cols[i]; g.fillRect(0, 22 + i * 13, 128, 9); }
  });
  function triGeo(pts) {
    const geo = new THREE.BufferGeometry(), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap(p => [p[0], p[1], 0]), 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(pts.flatMap(p => [(p[0] - x0) / (x1 - x0), (p[1] - y0) / (y1 - y0)]), 2));
    geo.computeVertexNormals(); return geo;
  }
  const boatMats = {
    hull: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 }),
    band: new THREE.MeshStandardMaterial({ color: 0x3d6bff, roughness: 0.5 }),
    deck: new THREE.MeshStandardMaterial({ color: 0xe9c48a, roughness: 0.8 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.7 }),
    sail: new THREE.MeshStandardMaterial({ map: sailTex, side: THREE.DoubleSide, roughness: 0.85 }),
    jib: new THREE.MeshStandardMaterial({ color: 0xfff1b8, side: THREE.DoubleSide, roughness: 0.85 }),
    flag: new THREE.MeshStandardMaterial({ color: 0xff4f6d, side: THREE.DoubleSide }),
  };
  function makeShip(m) {
    const g = new THREE.Group(), B = C.BOAT, M = boatMats;
    const [hx0, hx1, hy, hz] = B.hull;
    const shape = new THREE.Shape();
    shape.moveTo(hx0, hy); shape.lineTo(hx1, hy); shape.quadraticCurveTo(hx1 - 0.15, 0.12, hx1 - 0.55, 0);
    shape.lineTo(hx0 + 0.2, 0); shape.quadraticCurveTo(hx0 - 0.02, 0.15, hx0, hy);
    const hullGeo = new THREE.ExtrudeGeometry(shape, { depth: hz * 2 - 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 });
    hullGeo.translate(0, 0, -(hz - 0.04));
    g.add(new THREE.Mesh(hullGeo, M.hull));
    const band = new THREE.Mesh(new THREE.BoxGeometry(hx1 - hx0 - 0.15, 0.09, hz * 2 + 0.02), M.band); band.position.set((hx0 + hx1) / 2 - 0.05, hy - 0.13, 0); g.add(band);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(hx1 - hx0 - 0.1, 0.04, hz * 2 - 0.06), M.deck); deck.position.set((hx0 + hx1) / 2, hy + 0.01, 0); g.add(deck);
    const [mx, mb, mt] = B.main, [jx, jb, jt] = B.jib;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, mt + 0.15 - hy, 8), M.wood); mast.position.set(mx, (mt + 0.15 + hy) / 2, 0); g.add(mast);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, mx - mb + 0.1, 8), M.wood); boom.rotation.z = Math.PI / 2; boom.position.set((mx + mb) / 2, B.boomY - 0.03, 0); g.add(boom);
    g.add(new THREE.Mesh(triGeo([[mx - 0.03, B.boomY], [mx - 0.03, mt], [mb, B.boomY]]), M.sail));
    g.add(new THREE.Mesh(triGeo([[jx, B.boomY - 0.05], [jb, B.boomY - 0.1], [jx, jt]]), M.jib));
    const flag = new THREE.Mesh(triGeo([[mx, mt + 0.15], [mx, mt - 0.1], [mx - 0.4, mt + 0.03]]), M.flag); g.add(flag);
    // las 2 bolas del premio, a la vista en cubierta
    g.userData.balls = [];
    (m.balls || ['r', 'b']).forEach((k, i) => {
      const mat = ballMaterial(k).clone(); mat.fog = false;
      if (mat.emissive && COL[k]) { mat.emissive.set(COL[k]); mat.emissiveIntensity = 0.25; }
      const b = new THREE.Mesh(new THREE.SphereGeometry(B.ballR, 20, 14), mat);
      b.position.set(B.ballX[i] || 0, B.ballY, 0); g.add(b); g.userData.balls.push(b);
    });
    g.scale.setScalar(C.SHIP_S);
    g.traverse(o => { if (o.isMesh) { o.castShadow = false; if (!g.userData.balls.includes(o)) o.material.fog = false; } });
    return g;
  }
  // ---------- objetos que cruzan el cielo en los mundos 6-10 (llevan a la vista las 2 bolas del premio) ----------
  const CARRIER_NAMES = { desert: 'globo', snow: 'teleférico', jungle: 'mono', volcano: 'dragón', space: 'ovni' };
  const CARRIER_TITLES = { desert: '¡GLOBO!', snow: '¡TELEFÉRICO!', jungle: '¡MONO!', volcano: '¡DRAGÓN!', space: '¡OVNI!' };
  const CARRIER_HINT = {
    desert: '¡Un globo con 2 bolas en la cesta! Si le das, son tuyas. Apunta por delante',
    snow: '¡Un teleférico con 2 bolas dentro! Si le das, son tuyas. Apunta por delante',
    jungle: '¡Un mono en tirolina con 2 bolas! Si le das, son tuyas. Apunta por delante',
    volcano: '¡Un dragón lleva 2 bolas en una cesta! Si le das, son tuyas. Apunta por delante',
    space: '¡Un ovni con 2 bolas en la cúpula! Si le das, son tuyas. Apunta por delante',
  };
  function carrierBalls(g, K, balls) {
    g.userData.balls = [];
    (balls || ['r', 'b']).forEach((k, i) => {
      const mat = ballMaterial(k).clone();
      if (mat.emissive && COL[k]) { mat.emissive.set(COL[k]); mat.emissiveIntensity = 0.3; }
      const b = new THREE.Mesh(new THREE.SphereGeometry(K.ballR, 18, 12), mat);
      b.position.set(...K.balls[i]); g.add(b); g.userData.balls.push(b);
    });
  }
  const stripesTex = canvasTex(256, 64, (g) => { const cs = ['#ff4f6d', '#ffd23f', '#3d9bff', '#ffd23f']; for (let i = 0; i < 16; i++) { g.fillStyle = cs[i % 4]; g.fillRect(i * 16, 0, 16, 64); } });
  function makeCarrier(m) {
    const K = C.CARRIERS[m.carrier], outer = new THREE.Group(), g = new THREE.Group(); outer.add(g);
    const std = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.6 }, o || {}));
    if (m.carrier === 'desert') {
      const env = new THREE.Mesh(new THREE.SphereGeometry(1.25, 24, 16), new THREE.MeshStandardMaterial({ map: stripesTex, roughness: 0.5 }));
      env.scale.y = 1.12; env.position.y = 2.55; g.add(env);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.25, 0.5, 16), std(0xff4f6d)); neck.position.y = 1.25; g.add(neck);
      const basket = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.64, 1.0), std(0x9a6a3a, { roughness: 0.9 })); basket.position.y = 0.45; g.add(basket);
      const rim = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.08, 1.06), std(0x6b4423)); rim.position.y = 0.78; g.add(rim);
      for (const [x, z] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.85, 4), std(0x4a3a2a)); r.position.set(x * 0.85, 1.12, z * 0.85); g.add(r); }
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 8), new THREE.MeshBasicMaterial({ color: 0xffb040 })); flame.position.y = 1.15; g.add(flame); g.userData.flame = flame;
    } else if (m.carrier === 'snow') {
      const red = std(0xe2403a, { roughness: 0.4 }), white = std(0xf4f6ff), dark = std(0x3a3a4a, { metalness: 0.6, roughness: 0.3 });
      const box = (w, h, d, x, y, z, mat) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, y, z); g.add(b); };
      box(1.44, 0.1, 1.0, 0, -0.5, 0, white); box(1.5, 0.14, 1.06, 0, 0.55, 0, red);           // suelo y techo
      box(1.44, 1.0, 0.06, 0, 0, -0.47, red); box(0.06, 1.0, 1.0, -0.69, 0, 0, red); box(0.06, 1.0, 1.0, 0.69, 0, 0, red);
      box(1.44, 0.34, 0.06, 0, -0.33, 0.47, red);                                              // frente bajo: se ven las bolas
      box(0.06, 0.66, 0.06, -0.69, 0.18, 0.47, white); box(0.06, 0.66, 0.06, 0.69, 0.18, 0.47, white);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, K.cable - 0.6, 6), dark); arm.position.y = 0.6 + (K.cable - 0.6) / 2; g.add(arm);
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 6, 14), dark); wheel.position.y = K.cable; g.add(wheel);
      // cable fijo de lado a lado del cielo
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 200, 6), dark); cable.rotation.z = Math.PI / 2; cable.position.set(0, m.y0 + K.cable * K.s, m.z); outer.add(cable);
      outer.userData.static = [cable];
    } else if (m.carrier === 'jungle') {
      const fur = std(0x7a4a28, { roughness: 0.9 }), skin = std(0xf0c890), ink = new THREE.MeshBasicMaterial({ color: 0x1d1440 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), fur); body.scale.set(0.9, 1.1, 0.9); body.position.y = -0.75; g.add(body);
      const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), skin); belly.position.set(0, -0.8, 0.2); belly.scale.z = 0.6; g.add(belly);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), fur); head.position.set(0.05, -0.2, 0); g.add(head);
      const face = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), skin); face.position.set(0.08, -0.24, 0.17); face.scale.z = 0.6; g.add(face);
      for (const z of [-0.09, 0.09]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), ink); e.position.set(0.12 + z, -0.15, 0.3); g.add(e); }
      for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), skin); ear.position.set(0.05 + s * 0.3, -0.15, 0); g.add(ear);
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 6), fur); arm.position.set(s * 0.18, -0.15, 0); arm.rotation.z = -s * 0.35; g.add(arm); }
      const pulley = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.04, 6, 12), std(0x555566, { metalness: 0.7 })); pulley.position.y = K.cable; g.add(pulley);
      const bag = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8, 0, TAU, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe8d8a0, wireframe: true })); bag.position.y = -1.3; g.add(bag);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 6), fur); leg.position.y = -1.15; g.add(leg);
      // tirolina inclinada
      const len = 200, ang = Math.atan(K.slope) * m.dir;
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 5), std(0x3a2a1a)); cable.rotation.z = Math.PI / 2 - ang;
      cable.position.set(0, m.y0 + K.cable * K.s, m.z); outer.add(cable); outer.userData.static = [cable];
    } else if (m.carrier === 'volcano') {
      const red = std(0xc8302a, { roughness: 0.5 }), yel = std(0xffc83d), wingM = std(0x7a3dff, { side: THREE.DoubleSide, roughness: 0.5 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 12), red); body.scale.set(1.4, 0.9, 0.9); g.add(body);
      const belly = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), yel); belly.scale.set(1.3, 0.7, 0.6); belly.position.set(0.05, -0.2, 0.2); g.add(belly);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), red); head.position.set(0.85, 0.3, 0); g.add(head);
      const snout = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), red); snout.scale.set(1.4, 0.8, 0.9); snout.position.set(1.15, 0.24, 0); g.add(snout);
      for (const z of [-0.18, 0.18]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); e.position.set(0.98, 0.42, z); g.add(e);
        const h = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 6), yel); h.position.set(0.75, 0.68, z); h.rotation.z = 0.5; g.add(h); }
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.1, 8), red); tail.rotation.z = Math.PI / 2; tail.position.set(-1.1, 0.05, 0); g.add(tail);
      const wingGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.3, 0, 0), new THREE.Vector3(0.4, 0, 0), new THREE.Vector3(0.2, 0.2, 1.5), new THREE.Vector3(-0.3, 0, 0), new THREE.Vector3(0.2, 0.2, 1.5), new THREE.Vector3(-0.6, 0.1, 1.2)]);
      wingGeo.computeVertexNormals();
      const wl = new THREE.Group(), wr = new THREE.Group();
      wl.add(new THREE.Mesh(wingGeo, wingM)); const wrm = new THREE.Mesh(wingGeo, wingM); wrm.scale.z = -1; wr.add(wrm);
      wl.position.set(0, 0.3, 0.25); wr.position.set(0, 0.3, -0.25); g.add(wl); g.add(wr); g.userData.wings = [wl, wr];
      const basket = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.5, 0.72), std(0x6b4423, { roughness: 0.9 })); basket.position.y = -0.88; g.add(basket);
      for (const x of [-0.3, 0.3]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), red); l.position.set(x, -0.45, 0); g.add(l); }
    } else if (m.carrier === 'space') {
      const metal = std(0xc8ccd8, { metalness: 0.85, roughness: 0.25 });
      const saucer = new THREE.Mesh(new THREE.SphereGeometry(1.35, 32, 12), metal); saucer.scale.y = 0.18; g.add(saucer);
      const band = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.06, 8, 40), std(0x7a3dff, { emissive: 0x3a10a0 })); band.rotation.x = Math.PI / 2; g.add(band);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 14, 0, TAU, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xbff4ff, transparent: true, opacity: 0.35, roughness: 0.05, clearcoat: 1, depthWrite: false }));
      dome.position.y = 0.05; g.add(dome);
      const lights = [];
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; const l = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: [0xff4f6d, 0xffd23f, 0x5fff8a, 0x3dc8ff][i % 4] })); l.position.set(Math.cos(a) * 1.1, -0.1, Math.sin(a) * 1.1); g.add(l); lights.push(l); }
      g.userData.lights = lights;
      const beam = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.4, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0x9ff7ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.y = -1.3; g.add(beam);
    }
    carrierBalls(g, K, m.balls);
    g.scale.setScalar(K.s);
    outer.traverse(o => { if (o.isMesh) o.castShadow = false; });
    outer.userData.inner = g;
    return outer;
  }
  function syncCarrier(m, outer, sim) {
    const g = outer.userData.inner, K = C.CARRIERS[m.carrier];
    g.position.set(m.x, m.y, m.z); g.scale.set(K.s * m.dir, K.s, K.s);   // espejo (no giro): el frente sigue mirando al jugador
    const t = G.t;
    if (m.carrier === 'desert') { g.rotation.z = Math.sin(t * 0.8 + m.ph) * 0.04; g.userData.flame.scale.setScalar(0.8 + Math.sin(t * 12) * 0.25); }
    else if (m.carrier === 'snow') { g.rotation.z = Math.sin(t * 1.6 + m.ph) * 0.06; }
    else if (m.carrier === 'jungle') { g.rotation.z = Math.sin(t * 3 + m.ph) * 0.12 - 0.08 * m.dir; }
    else if (m.carrier === 'volcano') { const f = Math.sin(t * 9 + m.ph) * 0.8; g.userData.wings[0].rotation.x = -f; g.userData.wings[1].rotation.x = f; }
    else if (m.carrier === 'space') { g.rotation.z = Math.sin(t * 2 + m.ph) * 0.08; g.userData.lights.forEach((l, i) => { l.visible = Math.sin(t * 8 + i) > 0; }); }
    g.userData.balls.forEach((b, i) => { b.position.y = K.balls[i][1] + Math.abs(Math.sin(t * 3 + i * 1.7)) * 0.04; });
    if (!m.active) {   // alcanzado: cae dando vueltas y las bolas salen volando hacia ti
      const k = sim.t - m.hitT;
      g.position.y = m.y - 6 * k * k; g.rotation.z += 0.12; g.rotation.x = k * 2;
      g.userData.balls.forEach(b => { b.visible = k < 0.05; });
      if (outer.userData.static) for (const s of outer.userData.static) s.visible = m.carrier !== 'jungle' || k < 0.4;
    }
  }
  // satélite: hace de pájaro en el espacio
  function makeSatellite() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 0.8, roughness: 0.3 })); g.add(body);
    const panelM = new THREE.MeshStandardMaterial({ color: 0x2a4fd6, metalness: 0.4, roughness: 0.3, emissive: 0x0a1a5a, side: THREE.DoubleSide });
    const wl = new THREE.Group(), wr = new THREE.Group();
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 1.1), panelM); p1.position.z = 0.75; wl.add(p1);
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 1.1), panelM); p2.position.z = -0.75; wr.add(p2);
    g.add(wl); g.add(wr); g.userData.wings = [wl, wr];
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8, 0, TAU, 0, Math.PI / 2.4), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide })); dish.position.x = 0.45; dish.rotation.z = -Math.PI / 2; g.add(dish);
    g.scale.setScalar(1.15);
    return g;
  }
  function syncMovers() {
    const sim = G.sim;
    if (!G.moverMeshes) G.moverMeshes = new Map();
    const live = new Set();
    for (const m of (sim && sim.movers) || []) {
      live.add(m.id);
      let g = G.moverMeshes.get(m.id);
      if (m.carrier) {
        if (!g) { g = makeCarrier(m); scene.add(g); G.moverMeshes.set(m.id, g); }
        syncCarrier(m, g, sim); continue;
      }
      if (!g) { g = m.kind === 'bird' ? (biome === 'space' ? makeSatellite() : makeBird()) : makeShip(m); g.rotation.y = m.dir > 0 ? 0 : Math.PI; scene.add(g); G.moverMeshes.set(m.id, g); }
      g.position.set(m.x, m.y, m.z);
      if (m.kind === 'bird') {
        const f = m.active ? (biome === 'space' ? 0 : Math.sin(G.t * 16 + m.ph) * 0.9) : 0.2;
        if (biome === 'space') g.rotation.x = G.t * 0.8;
        g.userData.wings[0].rotation.x = -f; g.userData.wings[1].rotation.x = f;
        if (!m.active) { const k = sim.t - m.hitT; g.position.y = m.y - 6 * k * k; g.rotation.z += 0.25; }
      } else {
        g.rotation.z = Math.sin(G.t * 1.6 + m.ph) * 0.06; g.rotation.x = Math.sin(G.t * 1.1 + m.ph) * 0.06;
        g.userData.balls.forEach((b, i) => { b.position.y = C.BOAT.ballY + Math.abs(Math.sin(G.t * 3 + i * 1.7)) * 0.05; });
        if (!m.active) {   // volcado: se tumba y se hunde; las bolas salen volando hacia ti
          const k = sim.t - m.hitT; g.position.y = m.y - 3 * k * k; g.rotation.x = Math.min(1.4, k * 2.2);
          g.userData.balls.forEach((b, i) => { b.visible = k < 0.05; });
        }
      }
    }
    for (const [id, g] of G.moverMeshes) if (!live.has(id)) { scene.remove(g); G.moverMeshes.delete(id); }
  }
  function ballMaterial(kind) { return jelly[kind] || SPECIAL_MAT[kind] || SPECIAL_MAT.heavy; }
  function makeBallMesh(kind, r) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), ballMaterial(kind));
    m.castShadow = true;
    return m;
  }

  // ---------------- eventos del simulador ----------------
  const hexCss = c => '#' + new THREE.Color(COL[c] || 0xffffff).getHexString();
  // ---- combo de cada tiro: notas que suben, textos por escalones y vibración ----
  const COMBO_EV = { pop: 1, glass: 1, crumble: 1, rocket: 1, pinata: 1, hourglass: 1, geyser: 1, erupt: 1, prize: 1, fall: 1 };
  const COMBO_TIERS = [[5, '¡GENIAL!', '#7dffb0'], [10, '¡INCREÍBLE!', '#ffd23f'], [15, '¡ROCKET RUSH!', '#ff7ad8'], [25, '¡IMPARABLE!', '#7fe6ff']];
  function comboStep(e) {
    G.combo = (G.combo || 0) + 1;
    if (save.sound && typeof SFX !== 'undefined' && SFX.note) SFX.note(G.combo - 1);
    const t = COMBO_TIERS.find(q => q[0] === G.combo);
    if (t) { centerText(t[1], t[2], 34 + COMBO_TIERS.indexOf(t) * 4); vibe([25, 25, 40 + COMBO_TIERS.indexOf(t) * 20]); flashLight.position.set(e.x || 0, (e.y || 2) + 1, (e.z || 0) + 1.5); flashLight.color.set(t[2]); flashLight.intensity = 40; G.shake = Math.max(G.shake, 0.15); }
  }
  function handleEvents() {
    const sim = G.sim;
    for (const e of sim.events) {
      if (COMBO_EV[e.type] && G.mode === 'play') comboStep(e);
      switch (e.type) {
        case 'shoot': G.combo = 0; if (WBALLS[e.kind]) stats().wballs = (stats().wballs || 0) + 1; {
          Audio.shoot(); G.recoil = 1; vibe(14);
          const m = sim.muzzle();
          spawnSprite(m.x, m.y, m.z - 0.5, 0xffd27a, 0.7, 1.2, 0.14, { add: true, alpha: 0.9 });
          for (let i = 0; i < 5; i++) spawnSprite(m.x + rnd(-0.25, 0.25), m.y + rnd(0, 0.25), m.z - 0.7, 0xf2eefc, 0.45, 2.2, 0.8, { vy: 0.5, alpha: 0.45 });
          if (!e.auto) G.firstShot = true;
          break;
        }
        case 'pop': {
          { const st = stats(); st.blocks++; const bd = G.sim.blocks[e.id] && G.sim.blocks[e.id].userData; if (bd && (bd.stripe || bd.bomb || bd.cham || bd.float || bd.ice || bd.kind === 'gold')) st.specials++; }
          const col = COL[e.c] || 0xffffff;
          spawnDebris(e.x, e.y, e.z, col, 12, 6.5, 0.22, 1.1);
          spawnDebris(e.x, e.y, e.z, 0xffffff, 3, 4, 0.12, 0.6);
          spawnSprite(e.x, e.y, e.z, col, 1.4, 1.2, 0.3, { add: true, alpha: 0.9 });
          spawnRing(e.x, e.y, e.z, col, 1.2, 0.35);
          Audio.pop(e.chain);
          G.shake = Math.max(G.shake, 0.05);
          break;
        }
        case 'group': if (e.n >= 3) vibe(Math.min(70, 15 + e.n * 5)); floatText(e.x, e.y + 0.8, e.z, '+' + (e.n * 10 * e.chain), '#fff', 20 + Math.min(14, e.n)); if (e.n >= 6) setTimeout(() => floatText(e.x, e.y + 1.8, e.z, '¡' + e.n + ' DE GOLPE!', hexCss(e.c), 26), 150); break;
        case 'cascade': stats().cascades++;
          floatText(e.x, e.y + 1, e.z, '¡CASCADA x' + e.chain + '!', hexCss(e.c), 26, e.chain <= 3);
          Audio.cascade(); G.shake = Math.max(G.shake, 0.25); vibe(40);
          break;
        case 'impact': case 'thud':
          if (e.v > 3.5) spawnSprite(e.x, e.y, e.z, 0xe8e2f5, 0.6, 1.5, 0.6, { alpha: 0.5, vy: 0.3 });
          Audio.thud(e.v, e.stone);
          if (e.v > 5) G.shake = Math.max(G.shake, Math.min(0.2, e.v * 0.02));
          break;
        case 'glass': stats().blocks++; stats().specials++;
          spawnDebris(e.x, e.y, e.z, 0xd8f6ff, 18, 6, 0.2, 1.0, { flat: true });
          Audio.glass(); G.shake = Math.max(G.shake, 0.08);
          break;
        case 'fuse': Audio.fuse(); spawnSprite(e.x, e.y + 0.6, e.z, 0xffe070, 0.5, 1, 0.3, { add: true }); break;
        case 'wball': {
          const k = e.kind, col = W_TRAIL[k] || 0xffffff;
          if (k === 'w1' || k === 'w7') { spawnDebris(e.x, e.y, e.z, col, 10, 4, 0.14, 0.8); G.shake = Math.max(G.shake, 0.18); Audio.thud(3, true); }
          else if (k === 'w8') { spawnSprite(e.x, e.y, e.z, COL[e.c] || col, 1.8, 1.4, 0.4, { add: true, alpha: 1 }); SPECIAL_MAT.w8.color.set(COL[e.c] || COL.g); Audio.special(); }
          else {
            spawnSprite(e.x, e.y, e.z, col, 3.2, 1.6, 0.5, { add: true, alpha: 1 }); spawnRing(e.x, e.y, e.z, col, e.r || 2.5, 0.6);
            G.shake = Math.max(G.shake, 0.3); vibe([30, 20, 50]); Audio.special(); Audio.explode();
            flashLight.position.set(e.x, e.y + 1, e.z + 1); flashLight.color.set(col); flashLight.intensity = 50;
            if (k === 'w2') (e.targets || []).forEach((t, i) => setTimeout(() => { const c = [0xff4f6d, 0xffd23f, 0x5fd45a, 0x3dc8ff, 0xff9ad6][i % 5]; spawnSprite(t[0], t[1], t[2], c, 1.8, 1.6, 0.6, { add: true, alpha: 1 }); spawnDebris(t[0], t[1], t[2], c, 10, 6, 0.1, 0.9); Audio.pop(i); }, 120 + i * 70));
            if (k === 'w3') for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; spawnSprite(e.x + Math.cos(a) * e.r * 0.6, e.y, e.z + Math.sin(a) * e.r * 0.6, 0xe0f6ff, 1, 1.5, 0.7, { alpha: 0.9 }); }
            if (k === 'w4') for (let i = 0; i < 10; i++) spawnSprite(e.x, i * 0.8, e.z, 0x8fb0ff, 1.2, 1.2, 0.6, { add: true, alpha: 0.9 });
            if (k === 'w5') { for (const c of Object.values(COL)) spawnRing(e.x, e.y, e.z, c, (e.r || 2) * (0.6 + Math.random() * 0.6), 0.7); }
            if (k === 'w6') for (let i = 0; i < 18; i++) { const a = i / 18 * TAU * 2; spawnSprite(e.x + Math.cos(a) * (0.3 + i * 0.1), e.y + i * 0.25, e.z + Math.sin(a) * (0.3 + i * 0.1), 0xe2b46e, 1.2, 1.2, 0.9, { vy: 2, alpha: 0.8 }); }
            if (k === 'w9') for (let i = 0; i < 8; i++) spawnSprite(e.x + rnd(-1, 1), e.y + i * 0.5, e.z, i % 2 ? 0xffd23f : 0xff6a1a, 1.4, 1.2, 0.7, { vy: 4, add: true, alpha: 1 });
          }
          if (!e.hit) centerText(WBALLS[k].name.toUpperCase().replace('BOLA ', '') + '!', '#' + new THREE.Color(col).getHexString(), 28);
          break;
        }
        case 'swallow': spawnSprite(e.x, e.y, e.z, 0xa66bff, 1.2, 0.2, 0.4, { add: true, alpha: 1 }); Audio.pop(2); break;
        case 'vortexEnd': spawnRing(e.x, e.y, e.z, 0xc07bff, 3, 0.5); break;
        case 'gone': stats().blocks++; stats().specials++; break;
        case 'fall': stats().blocks++; break;
        case 'crumble': stats().blocks++; stats().specials++;
          spawnDebris(e.x, e.y, e.z, 0xe6bf78, 16, 3, 0.16, 1.0); spawnDebris(e.x, e.y, e.z, 0xc9964a, 8, 2, 0.12, 0.9);
          spawnSprite(e.x, e.y, e.z, 0xf0d8a8, 1.6, 1.4, 0.8, { alpha: 0.8, vy: 0.3 });
          Audio.thud(1.5);
          break;
        case 'prize': { stats().blocks++; stats().specials++;
          spawnDebris(e.x, e.y, e.z, 0xd8f4ff, 16, 5, 0.16, 0.9, { flat: true });
          spawnSprite(e.x, e.y, e.z, COL[e.c] || 0xffffff, 1.6, 1.4, 0.5, { add: true, alpha: 1 });
          const nm = { r: 'ROJA', b: 'AZUL', g: 'VERDE', y: 'AMARILLA', p: 'MORADA' };
          floatText(e.x, e.y + 0.9, e.z, '+1 BOLA ' + (nm[e.c] || ''), hexCss(e.c), 24, true, true);
          Audio.glass(); Audio.coin(); vibe(25); lastTray = '';
          break;
        }
        case 'cham': {
          const g = G.meshes[e.id];
          if (g) { g.userData.body.material = jellyCham[e.c]; spawnSprite(e.x, e.y, e.z, COL[e.c], 1.3, 1.2, 0.35, { add: true, alpha: 0.9 }); }
          if (!G.chamSnd || G.t - G.chamSnd > 0.2) { G.chamSnd = G.t; Audio.swap(); }
          break;
        }
        case 'heat': spawnSprite(e.x, e.y, e.z, 0xff7a1a, 1.4, 1, 0.45, { add: true }); Audio.fuse(); break;
        case 'erupt': stats().blocks++; stats().specials++;
          for (let i = 0; i < 9; i++) spawnSprite(e.x + rnd(-0.2, 0.2), e.y + i * 0.6, e.z + 0.2, i % 2 ? 0xffd23f : 0xff6a1a, 1.4, 1.2, 0.7, { vy: 4, add: true, alpha: 1 });
          spawnDebris(e.x, e.y, e.z, 0xff7a1a, 18, 6, 0.16, 1.2); spawnDebris(e.x, e.y, e.z, 0x2b2026, 10, 5, 0.18, 1.1);
          flashLight.position.set(e.x, e.y + 1, e.z + 1); flashLight.intensity = 60;
          G.shake = Math.max(G.shake, 0.35); Audio.explode(); vibe([30, 20, 50]);
          break;
        case 'rocket': stats().blocks++; stats().specials++;
          launchFlyer(e); spawnSprite(e.x, e.y, e.z, 0xffb23a, 2.2, 1.4, 0.3, { add: true, alpha: 1 });
          Audio.special(); Audio.shoot(); G.shake = Math.max(G.shake, 0.3); vibe([20, 20, 40]);
          floatText(e.x, e.y + 1, e.z, '¡COHETE!', '#ffb23a', 26, true);
          break;
        case 'pinataHit': spawnDebris(e.x, e.y, e.z, [0xff4f6d, 0xffd23f, 0x5fd45a, 0x3d9bff][e.hp & 3], 8, 3, 0.1, 0.7, { flat: true }); Audio.thud(4); floatText(e.x, e.y + 0.9, e.z, e.hp > 0 ? '¡OTRA VEZ!' : '', '#ffd23f', 20, true); break;
        case 'pinata': stats().blocks++; stats().specials++;
          for (const c of [0xff4f6d, 0xffd23f, 0x5fd45a, 0x3d9bff, 0xa66bff]) spawnDebris(e.x, e.y, e.z, c, 8, 6, 0.12, 1.4, { flat: true });
          spawnSprite(e.x, e.y, e.z, 0xffe27a, 2.4, 1.5, 0.4, { add: true, alpha: 1 });
          floatText(e.x, e.y + 1, e.z, '¡PIÑATA! +' + e.n, '#ffd23f', 26, true, true); Audio.coin(); Audio.special(); vibe([20, 30, 20]);
          break;
        case 'hourglass': stats().blocks++; stats().specials++;
          spawnDebris(e.x, e.y, e.z, 0xd8f4ff, 12, 4, 0.12, 0.8, { flat: true }); spawnDebris(e.x, e.y, e.z, 0xffc23d, 10, 3, 0.08, 0.9);
          floatText(e.x, e.y + 0.9, e.z, '+1 BOLA', '#7dffb0', 26, true, true); Audio.glass(); Audio.crown(); lastTray = ''; vibe(25);
          break;
        case 'mirror': spawnSprite(e.x, e.y, e.z, 0xffffff, 1.4, 1.2, 0.25, { add: true, alpha: 1 }); Audio.glass(); break;
        case 'spring': spawnRing(e.x, e.y + 0.5, e.z, 0x7dffb0, 1.8, 0.4); floatText(e.x, e.y + 1.2, e.z, '¡BOING!', '#7dffb0', 26, true); Audio.chirp(); G.shake = Math.max(G.shake, 0.2); vibe(30); break;
        case 'geyserCharge': for (let i = 0; i < 4; i++) spawnSprite(e.x + rnd(-0.3, 0.3), e.y + 0.6, e.z, 0xffffff, 0.8, 1.6, 0.7, { vy: 1.5, alpha: 0.6 }); Audio.fuse(); break;
        case 'geyser': stats().blocks++; stats().specials++;
          for (let i = 0; i < 12; i++) spawnSprite(e.x + rnd(-0.25, 0.25), e.y + i * 0.55, e.z + 0.2, i % 2 ? 0xffffff : 0x9fe8ff, 1.5, 1.3, 0.8, { vy: 5, alpha: 0.85 });
          spawnDebris(e.x, e.y, e.z, 0x9fe8ff, 18, 6, 0.12, 1.1); G.shake = Math.max(G.shake, 0.35); Audio.explode(); vibe([30, 20, 50]);
          floatText(e.x, e.y + 1.2, e.z, '¡GÉISER!', '#9fe8ff', 26, true);
          break;
        case 'portal': spawnSprite(e.x, e.y, e.z, 0xc07bff, 2, 1.4, 0.35, { add: true, alpha: 1 }); spawnSprite(e.x2, e.y2, e.z2, 0xc07bff, 2.4, 1.4, 0.4, { add: true, alpha: 1 }); spawnRing(e.x2, e.y2, e.z2, 0xc07bff, 1.6, 0.4); Audio.special(); break;
        case 'gift': { stats().specials++;
          for (const c of [0xff4f6d, 0xffd23f, 0x5fd45a, 0x3d9bff]) spawnDebris(e.x, e.y, e.z, c, 6, 5, 0.1, 1.1, { flat: true });
          spawnSprite(e.x, e.y, e.z, 0xffe27a, 2.2, 1.4, 0.35, { add: true, alpha: 1 });
          floatText(e.x, e.y + 1, e.z, e.what === 'bomb' ? '¡BOMBA!' : e.what === 'rainbow' ? '¡ARCOÍRIS!' : '+2 BOLAS', '#ffd23f', 28, true, true); Audio.special(); Audio.coin(); lastTray = ''; vibe([20, 20, 40]);
          break; }
        case 'prism': stats().specials++;
          for (const c of Object.values(COL)) spawnRing(e.x, e.y, e.z, c, 2 + Math.random() * 2, 0.7);
          centerText('¡ARCOÍRIS!', hexCss(e.c), 34); Audio.special(); G.shake = Math.max(G.shake, 0.3); vibe([30, 20, 60]);
          break;
        case 'locked': floatText(e.x, e.y + 0.8, e.z, '¡CERRADO!', '#cfd3e0', 20); Audio.thud(4, true); break;
        case 'unlock':
          for (const id of e.ids || []) { const g = G.meshes[id]; if (g && g.userData.lock) { g.userData.lock.visible = false; spawnSprite(g.position.x, g.position.y, g.position.z + 0.6, 0xffe27a, 1.2, 1.4, 0.4, { add: true }); } }
          centerText('¡CANDADOS ABIERTOS!', '#ffd23f', 28); Audio.crown(); vibe([20, 30, 20]);
          break;
        case 'bubblePop': { const g = G.meshes[e.id]; if (g && g.userData.bubble) { g.remove(g.userData.bubble); g.userData.bubble = null; }
          for (let i = 0; i < 8; i++) spawnSprite(e.x + rnd(-0.6, 0.6), e.y + rnd(-0.6, 0.6), e.z + 0.5, 0xcfefff, 0.5, 1.2, 0.4, { add: true }); Audio.pop(2); floatText(e.x, e.y + 1, e.z, '¡POP!', '#cfefff', 22); break; }
        case 'cloudGone': for (let i = 0; i < 10; i++) spawnSprite(e.x + rnd(-1.5, 1.5), e.y + rnd(-1, 1), e.z, 0xffffff, 1.6, 1.6, 0.8, { alpha: 0.7, vy: 0.4 }); Audio.swap(); floatText(e.x, e.y + 1.2, e.z, '¡DESPEJADO!', '#ffffff', 24, true); break;
        case 'balloonPop': spawnDebris(e.x, e.y, e.z, [0xff4f6d, 0xffd23f, 0x3d9bff, 0x5fd45a, 0xa66bff][e.id % 5], 10, 4, 0.1, 0.9, { flat: true }); Audio.pop(3); break;
        case 'balloonAway': floatText(e.x, Math.min(e.y, 9), e.z, '+20', '#ffd23f', 22); Audio.chirp(); break;
        case 'magnet': spawnRing(e.x, e.y, e.z, 0xff3a5a, e.r, 0.8); spawnRing(e.x, e.y, e.z, 0xe8eef8, e.r * 0.7, 0.6); floatText(e.x, e.y + 1.2, e.z, '¡IMÁN!', '#ff6a80', 26, true); Audio.special(); G.shake = Math.max(G.shake, 0.25); break;
        case 'fan': for (let i = 0; i < 14; i++) setTimeout(() => spawnSprite(e.x + e.dir * rnd(1, 7), e.y + rnd(-0.5, 2.5), e.z + rnd(-1, 1), 0xe8f0ff, 0.5, 2.5, 0.5, { alpha: 0.6 }), i * 60); floatText(e.x, e.y + 1.2, e.z, '¡VENDAVAL!', '#cfe8ff', 24, true); Audio.swap(); vibe(30); break;
        case 'snowball': floatText(e.x, e.y + 1.2, e.z, '¡AVALANCHA!', '#ffffff', 26, true); Audio.special(); break;
        case 'snowHit': { spawnDebris(e.x, e.y, e.z, 0xffffff, 8, 4, 0.12, 0.8); const g = G.meshes[e.id]; if (g && g.userData.snow) g.userData.snow.scale.setScalar(1 + e.n * 0.12); break; }
        case 'snowEnd': for (let i = 0; i < 6; i++) spawnSprite(e.x + rnd(-0.5, 0.5), e.y, e.z, 0xffffff, 1.4, 1.4, 0.8, { alpha: 0.8, vy: 0.5 }); break;
        case 'gumStick': spawnSprite(e.x, e.y, e.z, 0xff8ad0, 1.2, 1.2, 0.4, { add: true }); showHint('¡Pegada! Toca dónde quieres lanzarla', 3500); Audio.thud(2); break;
        case 'gumGo': spawnSprite(e.x, e.y, e.z, 0xff8ad0, 1.6, 1.4, 0.35, { add: true }); Audio.shoot(); break;
        case 'vine': floatText(e.x, e.y + 1, e.z, '¡ALLÁ VA!', '#7dffb0', 24, true); Audio.swap(); vibe(25); break;
        case 'totem': floatText(e.x, e.y + 1, e.z, '¡GIRA!', '#ffffff', 20); break;
        case 'ember': for (let i = 0; i < 8; i++) setTimeout(() => spawnSprite(e.x + (8 - i) * 0.25, e.y + (8 - i) * 1.1, e.z, i % 2 ? 0xffb050 : 0xff5a1a, 0.9, 1, 0.4, { add: true, alpha: 1 }), i * 70); break;
        case 'meteor': for (let i = 0; i < 10; i++) setTimeout(() => spawnSprite(e.x - (10 - i) * 0.8, e.y + (10 - i) * 1.4, e.z - (10 - i) * 0.5, i === 9 ? 0xffffff : 0xffb050, 1.6 - i * 0.05, 1, 0.45, { add: true, alpha: 1 }), i * 70); setTimeout(() => floatText(e.x, e.y + 1, e.z, '¡METEORITO!', '#ffb050', 24, true), 750); break;
        case 'stripe':
          spawnBeam(e.y, e.z, 0xffffff); Audio.special(); G.shake = Math.max(G.shake, 0.2); vibe(45);
          break;
        case 'explode':
          spawnDebris(e.x, e.y, e.z, 0xffb13b, 16, 10, 0.18, 0.8);
          spawnDebris(e.x, e.y, e.z, 0x4a4060, 12, 8, 0.2, 1.2);
          spawnSprite(e.x, e.y, e.z, 0xffc560, e.r * 1.6, 1.4, 0.35, { add: true, alpha: 1 });
          for (let i = 0; i < 10; i++) spawnSprite(e.x + rnd(-1, 1), e.y + rnd(-0.5, 1), e.z + rnd(-1, 1), 0xd9d2ea, 1.4, 2, 1.4, { vy: 0.8, alpha: 0.7 });
          spawnRing(e.x, e.y, e.z, 0xfff2b0, e.r * 1.4, 0.45);
          flashLight.position.set(e.x, e.y + 0.5, e.z); flashLight.intensity = 60;
          G.shake = 0.6; vibe([30, 20, 60]);
          Audio.explode();
          break;
        case 'splash':
          if (BIOMES[biome].splash) { BIOMES[biome].splash(e); if (biome !== 'space') Audio.thud(1 + e.s); break; }
          for (let i = 0; i < 4; i++) spawnSprite(e.x + rnd(-0.5, 0.5), C.SEA_Y + 0.3, e.z + rnd(-0.5, 0.5), 0xffffff, 1.2 * e.s, 1.6, 0.9, { vy: 1.5, alpha: 0.8 });
          spawnDebris(e.x, C.SEA_Y + 0.2, e.z, 0xe6f7ff, 8, 5, 0.12, 0.9);
          Audio.splash(e.s);
          break;
        case 'poof': spawnSprite(e.x, e.y, e.z, 0xffffff, 0.8, 2, 0.5, { alpha: 0.7 }); break;
        case 'crack': spawnDebris(e.x, e.y, e.z, 0xe8fbff, 8, 3, 0.1, 0.5, { flat: true }); Audio.glass(); break;
        case 'special':
          centerText(e.kind === 'bomb' ? '¡BOMBA DE PREMIO!' : '¡BOLA ARCOÍRIS!', '#ffe27a', 30);
          toast(e.n + ' bloques en un disparo: ' + (e.kind === 'bomb' ? 'te llevas una bomba' : 'te llevas una bola arcoíris'));
          Audio.special();
          break;
        case 'swap': Audio.swap(); break;
        case 'golden':
          spawnSprite(e.x, e.y, e.z, 0xffe27a, 6, 1.2, 0.5, { add: true, alpha: 1 });
          spawnRing(e.x, e.y, e.z, 0xffd23f, 5, 0.6); spawnRing(e.x, e.y, e.z, 0xffffff, 3, 0.4);
          spawnDebris(e.x, e.y, e.z, 0xffc83d, 30, 9, 0.18, 1.3);
          flashLight.position.set(e.x, e.y + 0.5, e.z); flashLight.intensity = 90;
          centerText(e.c ? '¡BOLA DORADA! Adiós al ' + ({ r: 'rojo', b: 'azul', g: 'verde', y: 'amarillo', p: 'morado' })[e.c] : '¡BOLA DORADA!', '#ffe27a', 26);
          G.shake = 0.7; vibe([40, 30, 80]); Audio.special(); Audio.explode();
          break;
        case 'moverSpawn':
          if (e.kind === 'bird') Audio.chirp(); else Audio.horn();
          save.seen = save.seen || {};
          if (e.carrier) {
            const key = 'c_' + e.carrier, nm = { r: 'roja', b: 'azul', g: 'verde', y: 'amarilla', p: 'morada', bomb: 'bomba', rainbow: 'arcoíris' };
            if (!save.seen[key]) { save.seen[key] = true; persist(); showHint(CARRIER_HINT[e.carrier], 4500); }
            else showHint('Pasa un ' + CARRIER_NAMES[e.carrier] + ' con bola ' + e.balls.map(k => nm[k] || k).join(' y bola '), 3000);
            break;
          }
          if (!save.seen[e.kind]) {
            save.seen[e.kind] = true; persist();
            showHint(e.kind === 'bird' ? '¡Un pájaro! Si le das, ganas 2 bolas. Apunta por delante de él' : '¡Un velero con 2 bolas! Si lo tumbas, son tuyas. Apunta muy por delante', 4500);
          } else if (e.kind === 'ship' && e.balls) {
            // en cada pasada lleva otras: se dice cuáles para que se sepa qué hay en juego
            const nm = { r: 'roja', b: 'azul', g: 'verde', y: 'amarilla', p: 'morada', bomb: 'bomba', rainbow: 'arcoíris' };
            showHint('Pasa un velero con bola ' + e.balls.map(k => nm[k] || k).join(' y bola '), 3000);
          }
          break;
        case 'moverHit': { stats().movers++;
          const names = { r: 'roja', b: 'azul', g: 'verde', y: 'amarilla', p: 'morada', bomb: 'bomba', rainbow: 'arcoíris' };
          const mv = G.sim && G.sim.movers.find(x => x.id === e.id);
          if (e.kind === 'bird') {
            spawnDebris(e.x, e.y, e.z, 0x4fc3ff, 16, 5, 0.16, 1.4, { flat: true, g: 0.25 });
            spawnDebris(e.x, e.y, e.z, 0xffffff, 10, 4, 0.14, 1.4, { flat: true, g: 0.25 });
            Audio.chirp();
          } else {
            for (const k of e.balls) spawnDebris(e.x, e.y + 1.3, e.z, COL[k] || 0xffffff, 6, 8, 0.3, 1.5);
            spawnDebris(e.x, e.y + 0.6, e.z, 0xffffff, 8, 6, 0.25, 1.4, { flat: true });
            if (mv && mv.carrier) { spawnSprite(e.x, e.y + 0.5, e.z, 0xffffff, 3, 1.5, 0.6, { alpha: 0.8 }); Audio.explode(); }
            else { for (let i = 0; i < 4; i++) spawnSprite(e.x + rnd(-1.5, 1.5), C.SEA_Y + 0.4, e.z, 0xffffff, 1.8, 1.4, 1.1, { vy: 1.6, alpha: 0.8 }); Audio.splash(2); Audio.explode(); }
          }
          spawnSprite(e.x, e.y + 0.5, e.z, 0xffe27a, e.kind === 'bird' ? 2.5 : 5, 1.2, 0.4, { add: true, alpha: 1 });
          centerText((e.kind === 'bird' ? (biome === 'space' ? '¡SATÉLITE!' : '¡PÁJARO!') : mv && mv.carrier ? CARRIER_TITLES[mv.carrier] : '¡VELERO!') + ' +2 BOLAS', '#ffe27a', 28);
          showHint('Has ganado: bola ' + e.balls.map(k => names[k] || k).join(' y bola '), 2800);
          Audio.special(); vibe([30, 30, 60]); lastTray = '';
          break;
        }
        case 'gem':
          spawnDebris(e.x, e.y, e.z, 0x2ee59d, 10, 6, 0.14, 1.2); spawnDebris(e.x, e.y, e.z, 0xffc83d, 6, 5, 0.12, 1.2);
          spawnSprite(e.x, e.y, e.z, 0xc9ffe6, 2.2, 1.2, 0.45, { add: true, alpha: 1 });
          floatText(e.x, e.y + 1, e.z, '+1 GEMA', '#6dffbe', 26, true, true);
          save.gems = (save.gems || 0) + 1; if (G.gemRoll) G.gemRoll.got++; persist(); setCoins();
          Audio.coin(); Audio.special(); vibe([20, 20, 40]);
          break;
        case 'sweep':
          spawnSprite(e.x, e.y, e.z, 0xffffff, 1.2, 1.8, 0.6, { alpha: 0.7, vy: 0.5 });
          floatText(e.x, e.y, e.z, '¡FUERA!', '#ffffff', 18, true, true);
          Audio.swap();
          break;
        case 'coin':
          spawnDebris(e.x, e.y, e.z, 0xffc83d, 10, 6, 0.16, 1.1);
          spawnSprite(e.x, e.y, e.z, 0xffe27a, 1.4, 1, 0.35, { add: true });
          floatText(e.x, e.y + 0.9, e.z, '+' + e.n + ' monedas', '#ffd23f', 20, true);
          Audio.coin(); vibe(20);
          break;
        case 'goal':
          centerText('¡OBJETIVO CUMPLIDO!', '#a4f08f', 25); Audio.special(); vibe([20, 30, 20]);
          $('btnFinish').hidden = false;
          break;
        case 'win':
          G.slowT = 0.6; $('btnFinish').hidden = true;
          if (e.left > 0 && !G.level.boss) grandFinale(e.left);
          centerText(e.left ? '¡DEMOLIDO! +' + e.bonus + ' por ' + e.left + (e.left === 1 ? ' bola' : ' bolas') : '¡DEMOLIDO!', '#a4f08f', e.left ? 26 : 40);
          G.winAt = G.t;
          break;
        case 'lose': G.endT = 0.4; break;
      }
    }
    sim.events.length = 0;
  }

  // ---------------- controles ----------------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const aimPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  function pickTarget(px, py) {
    ndc.set((px / W) * 2 - 1, -(py / H) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const objs = [];
    for (const g of G.meshes) if (g && g.visible) objs.push(g.userData.body);
    const hits = ray.intersectObjects(objs, false);
    if (hits.length) return hits[0].point.clone();
    const p = new THREE.Vector3();
    for (const m of (G.sim && G.sim.movers) || []) {
      if (!m.active) continue;
      const AIM = { desert: [1.8, 2.6], snow: [0.4, 1.6], jungle: [-0.8, 1.6], volcano: [-0.25, 1.5], space: [0.3, 1.3] };
      const cy = m.kind === 'bird' ? m.y : m.carrier ? m.y + AIM[m.carrier][0] : m.y + 1.9 * C.SHIP_S, band = m.kind === 'bird' ? 1.8 : m.carrier ? AIM[m.carrier][1] : 2.1 * C.SHIP_S;
      if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -m.z), p) && Math.abs(p.y - cy) < band) return p.clone();
    }
    if (ray.ray.intersectPlane(aimPlane, p)) { p.y = clamp(p.y, 0.3, 14); p.x = clamp(p.x, -6, 6); return p; }
    return null;
  }
  let pointer = null;
  canvas.addEventListener('pointerdown', e => {
    Audio.init();
    if (G.mode !== 'play' || G.paused || !G.sim || G.sim.state !== 'play') return;
    pointer = { id: e.pointerId };
    updateAim(e.clientX, e.clientY);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
  });
  canvas.addEventListener('pointermove', e => { if (pointer && e.pointerId === pointer.id) updateAim(e.clientX, e.clientY); });
  canvas.addEventListener('pointerup', e => {
    if (!pointer || e.pointerId !== pointer.id) return;
    pointer = null;
    if (G.aim && G.sim && G.sim.canFire()) G.sim.fire(G.aim.x, G.aim.y, G.aim.z);
    G.aim = null;
  });
  canvas.addEventListener('pointercancel', () => { pointer = null; G.aim = null; });
  function updateAim(px, py) {
    const p = pickTarget(px, py);
    G.aim = p;
    if (p) G.aimTarget.copy(p);
  }
  $('tray').addEventListener('pointerdown', e => {
    e.stopPropagation(); e.preventDefault(); Audio.init();
    if (G.mode !== 'play' || G.paused || !G.sim) return;
    const el = e.target.closest('[data-i]');
    const i = el ? +el.dataset.i : 1;           // la bola del cañón o el icono ⇄ cambian con la siguiente
    const q = G.sim.queue, j = i > 0 ? i : 1;
    if (G.sim.state !== 'play' || j >= q.length || q[j] === q[0]) return;   // misma bola: no hay cambio ni cobro
    // cambiar de bola cuesta 10 monedas (el primer cambio del tutorial del nivel 2 es gratis)
    const free = G.level.id === 2 && !save.swapTaught;
    if (!free && save.coins < SWAP_COST) { Audio.click(); toast(`Cambiar de bola cuesta ${SWAP_COST} monedas y no tienes suficientes`); $('traySwap').classList.add('nope'); setTimeout(() => $('traySwap').classList.remove('nope'), 400); return; }
    if (G.sim.select(j)) {
      if (free) save.swapTaught = true; else { save.coins -= SWAP_COST; floatSwapCost(); }
      persist(); setCoins();
      G.swapped = true; handleEvents(); updateTray(); updateCannon(0);
    }
  });
  function floatSwapCost() {
    const r = $('traySwap').getBoundingClientRect(), f = document.createElement('div');
    f.className = 'ft swapft'; f.innerHTML = `-${SWAP_COST} <i class="coin"></i>`;
    f.style.left = (r.left + r.width / 2) + 'px'; f.style.top = (r.top - 6) + 'px'; f.style.fontSize = '20px';
    $('ftexts').appendChild(f); setTimeout(() => f.remove(), 1000);
  }

  function drawAim() {
    const sim = G.sim;
    const show = G.mode === 'play' && G.aim && sim && sim.canFire();
    aimDots.visible = reticle.visible = !!show;
    if (!show) return;
    const pts = sim.trajectory(G.aim.x, G.aim.y, G.aim.z, 26);
    const col = new THREE.Color(COL[sim.queue[0]] || 0xffffff);
    for (let i = 0; i < 26; i++) {
      const p = pts[i + 1] || pts[pts.length - 1];
      const s = i < 2 ? 0 : 0.6 + 0.4 * (1 - i / 26);
      _m.compose(_v.set(p.x, p.y, p.z), _q.identity(), _s.set(s, s, s));
      aimDots.setMatrixAt(i, _m);
    }
    aimDots.instanceMatrix.needsUpdate = true;
    aimDots.material.color.copy(col).lerp(new THREE.Color(0xffffff), 0.35);
    reticle.position.copy(G.aim); reticle.quaternion.copy(camera.quaternion);
    reticle.material.color.copy(col);
    const k = 1 + 0.12 * Math.sin(G.t * 10); reticle.scale.set(k, k, k);
  }

  // cañón apunta a la diana
  function updateCannon(dt) {
    const sim = G.sim;
    const target = G.aim || G.aimTarget;
    const m = cannonG.position;
    const dir = _v.set(target.x - m.x, target.y - m.y + 1.5, target.z - m.z).normalize();
    const yaw = Math.atan2(-dir.x, -dir.z), pitch = Math.asin(clamp(dir.y, -0.3, 0.9));
    barrelPivot.rotation.order = 'YXZ';
    barrelPivot.rotation.y = lerp(barrelPivot.rotation.y, yaw, Math.min(1, dt * 14));
    barrelPivot.rotation.x = lerp(barrelPivot.rotation.x, pitch, Math.min(1, dt * 14));
    barrelPivot.position.z = G.recoil * 0.35;
    const k = sim && sim.queue[0];
    muzzleBall.visible = !!k && sim.canFire();
    if (k && G.cannonKind !== k) { G.cannonKind = k; muzzleBall.material = ballMaterial(k); barrelBand.material = ballMaterial(k); }
  }

  // ---------------- HUD ----------------
  let lastTray = '';
  function updateTray() {
    const q = G.sim ? G.sim.queue : [];
    const key = q.join(',') + '|' + G.swapped + '|' + (G.level && G.level.id) + '|' + (save.coins >= SWAP_COST) + '|' + !!save.swapTaught;
    if (key === lastTray) return; lastTray = key;
    $('trayCur').className = 'ball big ' + (q[0] ? CSSB[q[0]] : '');
    $('trayCur').dataset.i = 0;
    $('trayCur').style.visibility = q[0] ? 'visible' : 'hidden';
    $('traySwap').style.visibility = q.length > 1 ? 'visible' : 'hidden';
    { const free = G.level && G.level.id === 2 && !save.swapTaught;
      $('swapCost').innerHTML = free ? 'GRATIS' : `<i class="coin"></i>${SWAP_COST}`;
      $('traySwap').classList.toggle('poor', !free && save.coins < SWAP_COST); }
    $('traySwap').classList.toggle('pulse', G.level && G.level.id === 2 && !G.swapped);
    $('trayNext').innerHTML = q.slice(1, 6).map((k, i) => `<button class="tslot" data-i="${i + 1}" aria-label="Cargar esta bola"><span class="ball ${CSSB[k]}"></span></button>`).join('') + (q.length > 6 ? `<span class="tmore">+${q.length - 6}</span>` : '');
    $('trayCount').textContent = q.length;
    $('trayCount').classList.toggle('low', q.length <= 1);
  }
  let shownScore = 0;
  function updateHud(dt) {
    const sim = G.sim; if (!sim) return;
    shownScore += (sim.score - shownScore) * Math.min(1, dt * 8);
    if (Math.abs(sim.score - shownScore) < 1) shownScore = sim.score;
    $('hudScore').textContent = Math.round(shownScore);
    const p = sim.progress();
    $('meterFill').style.width = (p * 100).toFixed(1) + '%';
    $('meterFill').classList.toggle('done', p >= sim.target);
    $('meterPct').textContent = Math.round(p * 100) + '%';
    updateTray();
    const hint = $('hint');
    let txt = '';
    if (G.mode === 'play' && !G.firstShot && G.level.id === 1) txt = 'Toca un bloque azul para disparar';
    else if (G.mode === 'play' && !G.swapped && G.level.id === 2 && !G.firstShot) txt = 'Toca la bandeja de abajo para cambiar de bola (la primera vez es gratis; luego cuesta ' + SWAP_COST + ' monedas)';
    else if (G.mode === 'play' && G.sim.goalReached && G.sim.state === 'play' && !G.aim) txt = 'Sigue disparando para más estrellas, o pulsa Terminar';
    else if (G.mode === 'play' && G.aim) txt = '';
    if (performance.now() < hintUntil) txt = hintMsg;
    hint.textContent = txt; hint.style.opacity = txt ? 1 : 0;
    const ng = save.boosters.golden || 0, gb = $('btnGold');
    gb.hidden = !(G.mode === 'play' && ng > 0 && sim.state === 'play');
    gb.disabled = sim.queue[0] === 'golden';
    $('goldCount').textContent = ng;
  }

  // ---------------- pantallas ----------------
  const screens = ['title', 'map', 'pass', 'missions', 'pre', 'win', 'lose', 'pause', 'shop', 'settings', 'newCard'];
  function show(id) { for (const s of screens) $(s).classList.toggle('on', s === id); }
  function hideAll() { for (const s of screens) $(s).classList.remove('on'); }
  // mensaje sobre la bandeja de bolas (no tapa el cielo ni la estructura)
  let hintUntil = 0, hintMsg = '';
  function showHint(msg, ms) { hintMsg = msg; hintUntil = performance.now() + (ms || 3000); }
  function toast(msg, ms) {
    const el = $('toast'); el.textContent = msg; el.style.display = 'block';
    clearTimeout(toast.t); toast.t = setTimeout(() => { el.style.display = 'none'; }, ms || 2200);
  }
  function setCoins() {
    document.querySelectorAll('.coinTxt').forEach(el => { el.textContent = save.coins; });
    document.querySelectorAll('.gemTxt').forEach(el => { el.textContent = save.gems || 0; });
    const dot = $('passDot'); if (dot) dot.hidden = !passClaimable();
    updateDailyBadges(); renderPlayer(); if (G.mode === 'title' && G.titleReady) updateTitle();
  }
  // ---------------- gemas ----------------
  // Partida normal: 25 % de probabilidad de gema y garantizada si llevas 2 partidas sin ninguna (1 de cada 2-3).
  // Nivel extra: 1 gema asegurada y hasta 3 (55 % una, 30 % dos, 15 % tres).
  // La tirada se guarda hasta que la partida termina (ganada o perdida): salir y volver a entrar no da otra.
  function gemRollFor(L) {
    if (L.bonus) {
      save.bonusGemRoll = save.bonusGemRoll || {};
      let r = save.bonusGemRoll[L.id];
      if (!r) { const q = Math.random(); r = save.bonusGemRoll[L.id] = { n: q < 0.15 ? 3 : q < 0.45 ? 2 : 1, got: 0 }; persist(); }
      return r;
    }
    let r = save.gemRoll;
    if (!r) { r = save.gemRoll = { n: (save.gemDry || 0) >= 2 ? 1 : (Math.random() < 0.25 ? 1 : 0), got: 0 }; persist(); }
    return r;
  }
  function consumeGemRoll(L) {
    if (!L) return;
    if (L.bonus) { if (save.bonusGemRoll) delete save.bonusGemRoll[L.id]; }
    else if (save.gemRoll) { save.gemDry = save.gemRoll.n > 0 ? 0 : (save.gemDry || 0) + 1; save.gemRoll = null; }
    persist();
  }

  function loadDemo(id) {
    let L = byId(id) || LEVELS[clamp(id, 1, LEVELS.length) - 1];
    if (L.boss) L = byId(L.id - 1) || L;          // de fondo no se ve al jefe (su barco o su losa solo existen en la partida)
    G.level = L; G.sim = new Sim(L); G.demo = true;
    setTheme(L.world); buildLevelView(); frameCamera(); lastTray = '';
  }
  // ---------- portada: demolición en bucle con la física del juego ----------
  // espera · dispara una bola dorada desde delante · todo vuela por los aires · la estructura vuelve a aparecer bloque a bloque
  const TD = { phase: 'idle', t: 0 };
  function titleDemo(dt) {
    if (!G.sim || !$('title').classList.contains('on') || document.querySelector('.screen.dim.on') || $('daily').classList.contains('on')) return;
    TD.t += dt;
    if (TD.phase === 'idle' && TD.t > 3.2) {
      const sim = G.sim, sil = sim.silhouette();
      sim.queue.unshift('golden'); sim.sinceFire = 1; sim.state = 'play';
      if (sim.fire(0, Math.max(1, sil.top * 0.45), 0)) { TD.phase = 'shot'; TD.t = 0; sim.events.length = 0; }
      else sim.queue.shift();
    } else if (TD.phase === 'shot' && TD.t > 3.6) {
      TD.phase = 'grow'; TD.t = 0;
      loadDemo(G.level.id);
      for (const g of G.meshes) if (g) { g.userData.grow = g.position.y * 0.09 + Math.random() * 0.12; g.scale.set(0.01, 0.01, 0.01); }
    } else if (TD.phase === 'grow') {
      let all = true;
      for (const g of G.meshes) {
        if (!g || g.userData.grow === undefined) continue;
        const k = (TD.t - g.userData.grow) / 0.35;
        if (k <= 0) { all = false; continue; }
        if (k >= 1) { g.scale.set(1, 1, 1); delete g.userData.grow; spawnSprite(g.position.x, g.position.y, g.position.z + 0.5, 0xfff2b0, 0.5, 0.8, 0.25, { add: true, alpha: 0.7 }); continue; }
        const e = 1 + 1.7 * Math.pow(k - 1, 3) + 0.7 * Math.pow(k - 1, 2);   // sale con un pequeño rebote
        g.scale.set(e, e, e); all = false;
      }
      if (all) { TD.phase = 'idle'; TD.t = 0; }
    }
  }
  // efectos de la demolición de la portada: solo lo visual (no cuenta estadísticas ni da premios)
  function titleEvents() {
    const sim = G.sim;
    for (const e of sim.events) {
      if (e.type === 'shoot') { const m = sim.muzzle(); spawnSprite(m.x, m.y, m.z - 0.5, 0xffd27a, 0.7, 1.2, 0.14, { add: true, alpha: 0.9 }); }
      else if (e.x !== undefined && ['pop', 'golden', 'glass', 'explode', 'stripe', 'crumble', 'poof', 'special'].includes(e.type)) {
        const col = COL[e.c] || 0xffd23f;
        spawnDebris(e.x, e.y, e.z, col, 10, 6.5, 0.22, 1.1); spawnDebris(e.x, e.y, e.z, 0xffffff, 3, 4, 0.12, 0.6);
        spawnSprite(e.x, e.y, e.z, col, 1.4, 1.2, 0.3, { add: true, alpha: 0.9 }); spawnRing(e.x, e.y, e.z, col, 1.2, 0.35);
        G.shake = Math.min(0.5, G.shake + 0.08);
      } else if (e.type === 'impact' || e.type === 'thud') spawnSprite(e.x || 0, (e.y || 0) + 0.1, e.z || 0, 0xf2eefc, 0.5, 1.6, 0.5, { alpha: 0.5 });
    }
    sim.events.length = 0;
  }
  function goTitle() {
    if (window.Bosses) window.Bosses.stop();
    TD.phase = 'idle'; TD.t = 0;
    G.mode = 'title'; G.paused = false; loadDemo(Math.min(save.unlocked, LEVELS.length));   // de fondo, el paisaje del mundo en el que vas
    $('hud').classList.remove('on'); show('title'); G.titleReady = true; updateTitle();
  }
  // pantalla inicial: nivel en curso, avisos y estela de la bola-cohete
  function updateTitle() {
    if (!$('titleLv')) return;
    const L = byId(Math.min(save.unlocked, LEVELS.length)), W = WORLDS[L.world - 1];
    $('titleLv').textContent = (L.boss ? 'Jefe ' : 'Nivel ') + L.id + (W ? ' · ' + W.name : '');
    const fl = $('streakFlame'); if (fl) { fl.hidden = !(save.streak >= 1); fl.querySelector('b').textContent = save.streak; }
    $('passDotT').hidden = !passClaimable();
    const n = misClaimable(); $('misDotT').hidden = !n; $('misDotT').textContent = n;
    layoutTrail();
  }
  function layoutTrail() {
    const w = $('tWrap'), t = $('tTrail'); if (!w || !t || !w.offsetWidth) return;
    const W = w.offsetWidth, H = w.offsetHeight, x0 = -60, y0 = H + 190, x1 = W - 34, y1 = -12;
    const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
    t.style.width = len + 'px'; t.style.transform = `translate(${x0}px,${y0 - 11}px) rotate(${ang}rad)`;
  }
  addEventListener('resize', layoutTrail);
  // en la portada la estructura baja un poco para que el cartel no la tape
  function titleView() {
    if (G.mode === 'title') camera.setViewOffset(W, H, 0, -H * 0.16, W, H);
    else if (camera.view && camera.view.enabled) camera.clearViewOffset();
  }
  function goMap() {
    if (window.Bosses) window.Bosses.stop();
    refundGolden();
    $('btnFinish').hidden = true;
    G.mode = 'map'; G.paused = false; $('hud').classList.remove('on');
    loadDemo(Math.min(save.unlocked, LEVELS.length));
    renderMap(); setCoins(); show('map'); measureWorlds();
    const cur = document.querySelector('.lv.cur'); if (cur) cur.scrollIntoView({ block: 'center' });
  }
  // nivel extra del mundo w: se abre con 3 estrellas en todos sus niveles
  function worldStars3(w) { return LEVELS.filter(l => l.world === w && (save.stars[l.id] || 0) >= 3).length; }
  const worldSize = w => (WORLDS[w - 1] ? WORLDS[w - 1].size : 10);
  function bonusOpen(w) { return (TEST_MODE && save.testAll) || worldStars3(w) >= worldSize(w); }
  const STAR_STEP = 30, STAR_TIERS = ['wood', 'silver', 'gold', 'crystal'];
  function totalStars() { let n = 0; for (const k in save.stars) if (+k < 10001) n += save.stars[k] || 0; return n; }
  function starChestInfo() { const got = save.starChests || 0, have = totalStars() - got * STAR_STEP; return { got, have: Math.max(0, have), ready: have >= STAR_STEP, tier: STAR_TIERS[got % STAR_TIERS.length] }; }
  function claimStarChest() {
    const I = starChestInfo(); if (!I.ready) { toast(`Te faltan ${STAR_STEP - I.have} ★ para abrir el cofre de estrellas`); return; }
    const r = { coins: 80 + I.got * 20, gems: 2 + (I.tier === 'gold' || I.tier === 'crystal' ? 2 : 0) };
    if (I.tier !== 'wood') r.bomb = 1; if (I.tier === 'gold' || I.tier === 'crystal') r.rainbow = 1;
    if (Math.random() < 0.2) { r.coins *= 2; r.gems *= 2; r.x2 = true; }
    save.starChests = I.got + 1; save.coins += r.coins; save.gems = (save.gems || 0) + r.gems;
    if (r.bomb) save.boosters.bomb += r.bomb; if (r.rainbow) save.boosters.rainbow += r.rainbow;
    persist(); setCoins();
    openChestFX(I.tier, r, () => { if (r.x2) toast('¡Premio doble!'); renderMap(); });
  }
  function renderMap() {
    let h = '';
    { const I = starChestInfo(); h += `<div class="starchest ${I.ready ? 'ready' : ''}" id="starChest"><i class="chest ${I.tier}"><i></i></i><div class="sct"><b>Cofre de estrellas</b><span>${I.ready ? '¡Listo para abrir!' : `${I.have}/${STAR_STEP} ★`}</span><div class="bbar"><i style="width:${Math.min(100, I.have / STAR_STEP * 100)}%"></i></div></div>${I.ready ? '<span class="scgo">ABRIR</span>' : ''}</div>`; }
    // se ven los 100 mundos, también los bloqueados (el navegador solo pinta los que están en pantalla: content-visibility)
    for (const W of WORLDS) {
      const first = W.first, wLocked = first > save.unlocked, rows = Math.ceil((W.size + (W.boss ? 1 : 0)) / 4);
      h += `<div class="world ${wLocked ? 'wlock' : ''}${rows !== 3 ? ' wfree' : ''}" data-biome="${W.biome || 'sea'}"><h3>${wLocked ? '<i class="wl">&#128274;</i>' : ''}Mundo ${W.n} · ${W.name}<small>${W.sub}</small></h3>`;
      if (wLocked) h += `<div class="wnote">Se abre al superar el nivel ${first - 1}</div>`;
      h += '<div class="grid">';
      for (let id = W.first; id <= W.last; id++) {
        const L = LEVELS[id - 1], st = save.stars[L.id] || 0, locked = L.id > save.unlocked, cur = L.id === save.unlocked;
        if (L.boss) { h += `<div class="lv boss ${locked ? 'locked' : ''} ${cur ? 'cur' : ''}" data-id="${L.id}"><i class="skull"></i><span class="bn"><small>JEFE · ${L.id}</small>${L.bossName}</span>${locked ? '' : `<span class="st">${[0, 1, 2].map(i => starMini(i < st)).join('')}</span>`}</div>`; continue; }
        h += locked ? `<div class="lv locked${L.debut ? ' new' : ''}" data-id="${L.id}"><span class="ln">${L.id}</span></div>`
          : `<div class="lv ${cur ? 'cur' : ''}${L.debut ? ' new' : ''}" data-id="${L.id}">${L.id}<span class="st">${[0, 1, 2].map(i => starMini(i < st)).join('')}</span></div>`;
      }
      const B = BONUS[W.n - 1], open = bonusOpen(W.n), n3 = worldStars3(W.n), bst = save.stars[B.id] || 0;
      h += `</div><div class="bonus ${open ? 'open' : ''}" data-id="${B.id}">
        <div class="bico">${open ? '&#9813;' : '&#128274;'}</div>
        <div class="btx"><b>Nivel extra · ${B.name}</b><span>${open ? (bst ? 'Superado con ' + bst + ' &#9733; · vuelve a jugarlo' : '¡Desbloqueado! Premio triple y potenciadores de regalo') : `Consigue 3 &#9733; en los ${W.size} niveles del mundo (${n3}/${W.size})`}</span>
        <div class="bbar"><i style="width:${n3 / W.size * 100}%"></i></div></div></div></div>`;
    }
    $('mapList').innerHTML = h;
    $('starChest').onclick = () => { Audio.init(); Audio.click(); claimStarChest(); };
    measureWorlds();
    // un solo escuchador para todo el mapa (1000 casillas)
    $('mapList').onclick = e => {
      const el = e.target.closest('.lv'); if (!el) return;
      Audio.init(); Audio.click();
      if (el.classList.contains('locked')) { toast('Nivel bloqueado: supera el nivel ' + (+el.dataset.id - 1) + ' para abrirlo'); return; }
      openPre(+el.dataset.id);
    };
    $('mapList').querySelectorAll('.bonus').forEach(el => el.addEventListener('click', () => {
      Audio.init(); Audio.click();
      const B = byId(+el.dataset.id);
      if (!bonusOpen(B.world)) { toast(`Te faltan ${worldSize(B.world) - worldStars3(B.world)} niveles con 3 estrellas en este mundo`); return; }
      openPre(B.id);
    }));
  }

  // estrellas doradas (oro clásico con brillo): símbolos SVG definidos en index.html
  const starBig = (on, cls = '') => `<span class="stw ${cls} ${on ? 'on' : ''}"><svg class="gst off" viewBox="0 0 100 96"><use href="#starE"/></svg><svg class="gst gold" viewBox="0 0 100 96"><use href="#starS"/></svg></span>`;
  const starMini = on => `<svg class="gst" viewBox="0 0 100 96"><use href="#${on ? 'starM' : 'starME'}"/></svg>`;

  // tamaño real de un mundo (abierto y bloqueado): el navegador reserva el hueco exacto y no da saltos al deslizar
  function measureWorlds() {
    const L = $('mapList'); if (!L.offsetParent) return;
    for (const [sel, v] of [['.world:not(.wlock)', '--wh'], ['.world.wlock', '--whl']]) {
      const ws = L.querySelectorAll(sel), w = ws[ws.length > 2 ? 1 : 0]; if (!w) continue;
      w.style.contentVisibility = 'visible'; const cs = getComputedStyle(w), hh = w.offsetHeight; w.style.contentVisibility = '';
      if (hh > 100) L.style.setProperty(v, (hh - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth)) + 'px');
    }
  }
  addEventListener('resize', measureWorlds);
  let preSel = {};
  function openPre(id) {
    const L = byId(id); if (!L) return;
    G.preId = id; preSel = {};
    if (G.mode !== 'play') loadDemo(id);
    $('preTitle').textContent = L.bonus ? 'Nivel extra ' + L.world : L.boss ? 'Jefe · nivel ' + id : 'Nivel ' + id;
    $('preTitle').classList.toggle('gold', !!L.bonus);
    $('preReward').hidden = !L.bonus;
    const replay = L.bonus && save.bonusDone && save.bonusDone[L.id];
    if (L.bonus) $('preReward').innerHTML = replay
      ? `Ya lo superaste. Repetirlo cuesta <b>${L.replayCost} monedas</b> y da como mucho ${L.maxReplay} (con el vídeo x2).<br>Con 3 &#9733; te llevas otra <b>bola dorada</b>.`
      : 'Premio: <b>monedas x3</b>, el oro que derribes, <b>+1 bomba</b> y <b>+1 arcoíris</b>.<br>Con 3 &#9733;: <b>bola dorada</b> de un solo uso.';
    if (L.bonus) $('preReward').innerHTML += '<br>Gemas escondidas: <b>1 asegurada, hasta 3</b>.';
    $('preGo').innerHTML = replay ? `JUGAR <i class="coin"></i>${L.replayCost}` : '¡A DEMOLER!';
    $('preGo').classList.toggle('gold', !!replay);
    { const best = save.stars[L.id] || 0; $('preStars').innerHTML = [0, 1, 2].map(i => starBig(i < best, i === 1 ? 'mid' : '')).join(''); }
    $('preName').textContent = L.boss ? L.bossName : L.name;
    $('preCrowns').textContent = L.boss ? 'JEFE FINAL' : 'Derriba el ' + Math.round(L.target * 100) + '%';
    $('preBalls').textContent = L.balls.length + ' bolas';
    $('preGoal').textContent = L.goal || '';
    const free = streakBoosters();
    const defs = [['bomb', 'Bomba'], ['rainbow', 'Arcoíris'], ['extra', '+2 bolas']];
    // bola del mundo de este nivel (y las demás que ya tengas)
    const wk = worldBallOf(L.world), wks = [wk].concat(WB_KEYS.filter(k => k !== wk && (save.boosters[k] || 0) > 0));
    const wdefs = wks.filter(k => wbOpen(k)).map(k => [k, WBALLS[k].name.replace('Bola ', '').replace(/^de /, '')]);
    $('preBoosters').innerHTML = defs.map(([k, n]) => {
      const isFree = free.includes(k);
      return `<div class="boost ${isFree ? 'sel' : ''}" data-k="${k}"><span class="n ${isFree ? 'free' : ''}">${isFree ? 'GRATIS' : (save.boosters[k] || 0)}</span><div class="ball big ${k === 'extra' ? 'bPlus2' : CSSB[k]}" style="margin:2px auto 0;width:44px;height:44px"></div><div>${n}</div></div>`;
    }).join('') + wdefs.map(([k, n]) => {
      const have = save.boosters[k] || 0;
      return `<div class="boost wboost" data-k="${k}"><span class="n ${have ? '' : 'buy'}">${have || ('<i class="gem"></i>' + wbGems(k))}</span><div class="ball big ${CSSB[k]}" style="margin:2px auto 0;width:44px;height:44px"></div><div>${n}<small>nv. ${wbLevel(k)}</small></div></div>`;
    }).join('');
    $('preWb').innerHTML = wdefs.length ? `<b>${WBALLS[wk].name}:</b> ${WB_DESC[wk]}` : '';
    $('preBoosters').querySelectorAll('.boost').forEach(el => el.addEventListener('click', () => {
      const k = el.dataset.k;
      if (free.includes(k)) return;
      Audio.click();
      if (WBALLS[k] && !preSel[k] && !(save.boosters[k] > 0)) {      // comprarla con gemas aquí mismo
        const g = wbGems(k);
        if ((save.gems || 0) < g) { toast(`Te faltan ${g - (save.gems || 0)} gemas`); openShop('gems'); return; }
        save.gems -= g; save.boosters[k] = (save.boosters[k] || 0) + 1; persist(); setCoins(); Audio.coin();
        el.querySelector('.n').className = 'n'; el.querySelector('.n').textContent = save.boosters[k];
        toast(WBALLS[k].name + ' comprada por ' + g + ' gemas');
      }
      if (!preSel[k] && !(save.boosters[k] > 0)) { toast('No te quedan. Consíguelos en la tienda.'); return; }
      preSel[k] = !preSel[k]; el.classList.toggle('sel', preSel[k]);
      if (WBALLS[k]) $('preWb').innerHTML = `<b>${WBALLS[k].name}:</b> ${WB_DESC[k]}`;
    }));
    const st = $('preStreak');
    if (save.streak >= 1) {
      st.hidden = false; st.style.display = 'block';
      st.innerHTML = '<i class="ico ico-fire"></i> ' + (save.streak >= 3 ? `Racha de ${save.streak} victorias: cohete de salida, bomba y arcoíris gratis` : save.streak >= 2 ? `Racha de 2 victorias: cohete de salida y bomba gratis · con 3, también arcoíris` : `Racha de 1 victoria: un cohete abre la partida · con 2, también bomba`);
    } else st.style.display = 'none';
    $('pre').classList.add('on'); $('preScroll').scrollTop = 0;
  }
  function streakBoosters() { return save.streak >= 3 ? ['rocket', 'bomb', 'rainbow'] : save.streak >= 2 ? ['rocket', 'bomb'] : save.streak >= 1 ? ['rocket'] : []; }

  function refundGolden() {
    const sim = G.sim;
    if (!sim || G.demo || sim.state !== 'play') return;
    const n = sim.queue.filter(k => k === 'golden').length;
    if (n) { save.boosters.golden = (save.boosters.golden || 0) + n; sim.queue = sim.queue.filter(k => k !== 'golden'); persist(); }
    const wl = sim.queue.filter(k => WBALLS[k]);
    if (wl.length) { for (const k of wl) save.boosters[k] = (save.boosters[k] || 0) + 1; sim.queue = sim.queue.filter(k => !WBALLS[k]); persist(); }
  }
  function startLevel(id, boosters) {
    refundGolden();
    const L = byId(id);
    G.level = L; G.demo = false;
    const bl = []; let extra = 0;
    G.rocketStart = false;
    for (const k of boosters || []) { if (k === 'extra') extra += 2; else if (k === 'rocket') G.rocketStart = true; else bl.push(k); }
    const roll = gemRollFor(L);
    G.gemRoll = roll;
    G.sim = new Sim(L, { boosters: bl, wlv: wlvAll(), viewTest, gems: Math.max(0, roll.n - roll.got), gemSeed: 1 + Math.floor(Math.random() * 1e9) });
    if (extra) { const cols = G.sim.queue.filter(k => COL[k]); for (let i = 0; i < extra; i++) G.sim.queue.push(cols[i % Math.max(1, cols.length)] || 'heavy'); }
    setTheme(L.world); buildLevelView(); frameCamera();
    if (window.Bosses) { if (L.boss) setTimeout(() => { if (G.level === L) window.Bosses.start(L); }, 0); else window.Bosses.stop(); }
    G.mode = 'play'; G.paused = false; G.ended = false; G.endT = 0; G.finalT = 0; G.slowT = 0; G.timeScale = 1;
    G.lastSlow = false; G.combo = 0; hintUntil = 0;
    setWeatherChip(L);
    G.casi = 0; G.firstShot = false; G.swapped = false; G.winShown = false; G.winAt = 0; G.extraUsed = false; shownScore = 0; lastTray = '';
    $('btnFinish').hidden = true; G.cannonKind = null;
    G.aimTarget.set(0, 1.5, 0);
    $('hudLevel').textContent = L.bonus ? 'EXTRA ' + L.world : 'NIVEL ' + id;
    $('meterTarget').style.left = (L.target * 100) + '%';
    $('meterFill').style.transition = 'none'; $('meterFill').style.width = '0%'; void $('meterFill').offsetWidth; $('meterFill').style.transition = '';
    hideAll(); $('hud').classList.add('on');
    centerText(L.name, '#fff', 32);
    G.introT = 1.2;
    G.debutT = L.debut && !save.seenDebut?.[L.debut] ? 1.4 : 0; G.debutRing = null;
    if (L.debut) { save.seenDebut = save.seenDebut || {}; }
  }

  function finishWin() {
    const sim = G.sim, L = G.level;
    G.winShown = true;
    G.saveBefore = JSON.parse(JSON.stringify(save));   // por si el jugador sigue jugando con +3 bolas
    const stars = L.boss ? (G.bossStars || 1) : sim.stars();
    $('winRibbon').textContent = L.boss ? '¡JEFE DERROTADO!' : '¡DEMOLIDO!';
    const prevStars = save.stars[L.id] || 0;
    G.mystery = !L.bonus && !L.boss && !prevStars && L.id % 5 === 0;
    save.stars[L.id] = Math.max(prevStars, stars);
    save.best[L.id] = Math.max(save.best[L.id] || 0, sim.score);
    if (!L.bonus && L.id >= save.unlocked) save.unlocked = Math.min(L.id + 1, LEVELS.length + 1);
    let coins = (20 + stars * 10) * (L.hard ? 2 : L.boss ? 3 : 1), gifts = L.boss ? ' · cofre de oro' : '';
    save.bonusDone = save.bonusDone || {}; save.bonusSeen = save.bonusSeen || {};
    if (L.bonus) {
      if (!save.bonusDone[L.id]) {
        coins = (60 + stars * 30) * 3;
        save.boosters.bomb++; save.boosters.rainbow++; gifts = ' · +1 bomba · +1 arcoíris';
        save.bonusDone[L.id] = true;
      }
      if (stars >= 3) { save.boosters.golden = (save.boosters.golden || 0) + 1; gifts += ' · +1 bola dorada'; G.gotGolden = true; }
    }
    if (sim.goldenLeft) save.boosters.golden = (save.boosters.golden || 0) + sim.goldenLeft;
    for (const k of sim.wLeft || []) save.boosters[k] = (save.boosters[k] || 0) + 1;
    coins += sim.coins || 0;
    G.pendingCoins = coins; save.coins += coins;
    save.streak = Math.min(save.streak + 1, 9); save.played++;
    // ¿se acaba de abrir el nivel extra de este mundo?
    G.newBonus = null;
    if (!L.bonus) {
      const B = BONUS[L.world - 1];
      if (B && bonusOpen(L.world) && !save.bonusSeen[B.id]) { save.bonusSeen[B.id] = true; G.newBonus = B.id; }
    }
    G.winGifts = gifts;
    consumeGemRoll(L);
    // pase: suma las estrellas ganadas (1 si el nivel ya tenía 3 estrellas)
    ensureSeason();
    // experiencia: más la primera vez, en los difíciles y en los extra
    const xpWin = (prevStars ? 5 : 10) + stars * (prevStars ? 2 : 5) + (L.hard && !prevStars ? 15 : 0) + (L.bonus && !prevStars ? 20 : 0);
    const ups = addXp(xpWin); announceUps(ups);
    const passGain = prevStars >= 3 ? 1 : stars, tierBefore = passTier(save.pass.pts);
    save.pass.pts += passGain;
    const tierAfter = passTier(save.pass.pts);
    persist();
    const toNext = tierAfter < 30 ? ` · ${save.pass.pts - (tierAfter ? PASS_NEED[tierAfter - 1] : 0)}/${tierCost(tierAfter + 1)} para el nivel ${tierAfter + 1}` : '';
    $('winPass').innerHTML = `+${passGain} &#9733; al pase` + (tierAfter > tierBefore ? ` · ¡nivel ${tierAfter} del pase!` : toNext) + (sim.gems ? ` · +${sim.gems} gema${sim.gems > 1 ? 's' : ''}` : '') + ` · +${xpWin} XP`;
    setCoins();
    $('winScore').textContent = sim.score.toLocaleString('es-ES');
    $('winRes').textContent = 'Demolición del ' + Math.round(sim.progress() * 100) + '%';
    $('winCoins').textContent = '+' + coins + (gifts || '') + (G.mystery ? ' · ¡caja misteriosa!' : '');
    $('winDouble').disabled = false;
    // sin 3 estrellas: en vez de monedas x2, +3 bolas para seguir; y botón de reintentar
    const can3 = !L.boss && stars < 3 && sim.progress() < 0.995;
    $('winDouble').hidden = can3;
    $('winBalls').hidden = !can3 || G.extraUsed;
    $('winRetry').hidden = stars >= 3;
    $('winNext').textContent = G.newBonus ? '¡NIVEL EXTRA!' : (L.bonus || L.id < LEVELS.length) ? 'SIGUIENTE' : 'NIVELES';
    if (G.newBonus) setTimeout(() => toast('¡Nivel extra desbloqueado! 3 estrellas en todo el mundo ' + L.world), 1300);
    if (L.bonus && stars >= 3) setTimeout(() => toast('¡Bola dorada! Úsala cuando quieras con el botón dorado durante una partida', 3200), 1300);
    const sw = $('winStars');
    sw.innerHTML = [0, 1, 2].map(i => starBig(false, 'star' + (i === 1 ? ' mid' : ''))).join('');
    show('win'); Audio.win(); vibe([20, 40, 20]);
    const els = sw.querySelectorAll('.star');
    for (let i = 0; i < stars; i++) setTimeout(() => { if (els[i]) els[i].classList.add('on'); Audio.star(i); }, 350 + i * 330);
  }

  // fases de monetización: 1-9 luna de miel (regalo), desde el 10 anuncio o monedas
  const HONEYMOON = Levels.HARD[0] - 1;   // antes del primer nivel difícil, perder regala bolas
  function showLose() {
    const sim = G.sim, L = G.level;
    const p = Math.round(sim.progress() * 100), tgt = Math.round(sim.target * 100);
    $('loseTxt').textContent = tgt - p <= 10 ? '¡Te ha faltado muy poco!' : '¡Casi lo tiras!';
    $('loseRes').textContent = `Has derribado el ${p}% de ${tgt}%`;
    if (L.boss && window.Bosses) { const hp = Math.max(1, Math.round(window.Bosses.hp() * 100)); $('loseTxt').textContent = hp <= 25 ? '¡Estaba a punto de caer!' : '¡El jefe resiste!'; $('loseRes').textContent = `A ${L.bossName} le queda un ${hp}% de vida`; }
    const need = Math.max(1, Math.ceil(sim.target * sim.total) - (sim.popped + sim.fallen));
    if (!L.boss) { $('loseTxt').textContent = need <= 3 ? `¡Te faltaban ${need} ${need === 1 ? 'bloque' : 'bloques'}!` : tgt - p <= 10 ? '¡Te ha faltado muy poco!' : '¡Casi lo tiras!'; }
    save.casiFree = save.casiFree || {};
    const gift = !L.bonus && G.casi === 0 && (L.id <= HONEYMOON || !save.casiFree[L.world]);
    G.giftWorld = gift ? L.world : 0;
    $('loseSub').textContent = gift ? (L.id <= HONEYMOON ? 'Estás aprendiendo: te regalamos 3 bolas para terminarlo.' : 'Regalo de este mundo: 3 bolas gratis para terminarlo.') : '¿Unas bolas más y lo tiras?';
    $('loseGift').hidden = !gift;
    $('loseAd').hidden = gift || G.casi > 0;
    $('loseCoins').hidden = gift;
    const cost = G.casi <= (L.id <= HONEYMOON ? 1 : 0) ? 300 : 600;
    $('loseCost').textContent = cost;
    $('loseCoins').disabled = save.coins < cost;
    $('loseStarter').hidden = gift || save.starter || !(L.hard || save.coins < cost);
    $('loseStreak').textContent = save.streak >= 2 ? `Si sales o reintentas, pierdes la racha de ${save.streak}.` : '';
    consumeGemRoll(L);
    show('lose'); Audio.lose(); vibe(30);
  }
  function continueWithBalls() {
    G.casi++; G.sim.addBalls(3); G.ended = false; G.endT = 0;
    hideAll(); centerText('+3 BOLAS', '#fff', 32); lastTray = '';
  }
  function showRewarded(cb0) {
    const cb = ok => { if (ok) { stats().ads++; persist(); } cb0(ok); };
    if (window.ChromaAndroid && window.ChromaAndroid.showRewarded) { window.__rewardCb = cb; window.ChromaAndroid.showRewarded(); return; }
    const el = $('ad'); el.classList.add('on'); Audio.stopMusic();
    let n = 3; $('adCnt').textContent = n;
    const iv = setInterval(() => {
      n--; $('adCnt').textContent = n > 0 ? n : '✓';
      if (n <= 0) { clearInterval(iv); setTimeout(() => { el.classList.remove('on'); if (save.music) Audio.startMusic(); cb(true); }, 300); }
    }, 1000);
  }
  window.onChromaReward = ok => { const cb = window.__rewardCb; window.__rewardCb = null; if (cb) cb(ok); };


  // ---------------- bolas de los mundos ----------------
  // Una bola especial por cada uno de los 10 primeros mundos. Se abre al desbloquear su mundo (tienda: monedas;
  // antes de la partida: gemas). Los mundos 11-100 no traen bola nueva: cada uno SUBE DE NIVEL la bola de su paisaje
  // (más poder; máximo nivel 10). En los mundos del mar va rotando entre las 5 bolas del mar.
  const WB_KEYS = Object.keys(WBALLS);
  const WB_DESC = {
    w1: 'Atraviesa la estructura rompiendo todo lo que toca, incluso la piedra.',
    w2: 'Estalla en fuegos artificiales que revientan bloques al azar.',
    w3: 'Onda helada: rompe todo el piso a la altura del golpe.',
    w4: 'Parte la estructura de arriba abajo.',
    w5: 'Pinta de un color todo lo que hay cerca y lo revienta de golpe.',
    w6: 'Remolino de arena que levanta la estructura y la lanza fuera.',
    w7: 'Enorme y pesada: rueda arrasando lo que pilla.',
    w8: 'Toma el color de cada bloque que toca y revienta su grupo.',
    w9: 'Cae como un meteoro y funde las columnas de alrededor.',
    w10: 'Abre un agujero negro que se traga lo que tiene cerca.',
  };
  const BIOME_BALL = { desert: 'w6', snow: 'w7', jungle: 'w8', volcano: 'w9', space: 'w10' };
  const FRESH_BALL = { candy: 'w2', crystal: 'w5', temple: 'w4', forest: 'w8', fair: 'w2', neon: 'w10' };
  function worldBallOf(w) {
    const W = WORLDS[w - 1]; if (!W) return 'w1';
    if (W.biome === 'sea') return 'w' + (1 + Math.min(4, Math.floor((w - 1) / 3) % 5));
    return BIOME_BALL[W.biome] || FRESH_BALL[W.biome] || 'w1';
  }
  const wbOpen = k => (TEST_MODE && save.testAll) || worldsOpen() >= WBALLS[k].world;
  function wbLevel(k) {
    let lv = 1;
    const open = (TEST_MODE && save.testAll) ? 100 : worldsOpen();
    for (let w = 11; w <= open; w++) if (worldBallOf(w) === k) lv++;
    return Math.min(10, lv);
  }
  const wbCoins = k => 300 + 60 * WBALLS[k].world;           // en la tienda
  const wbGems = k => (WBALLS[k].world <= 5 ? 5 : 8);        // antes de la partida
  const wlvAll = () => { const o = {}; for (const k of WB_KEYS) o[k] = wbLevel(k); return o; };

  // ---------------- tienda ----------------
  const SHOP = [
    { id: 'g1', sec: 'gems', name: 'Puñado de gemas', desc: '30 gemas', gems: 30, price: '0,99 €', grant: () => { save.gems = (save.gems || 0) + 30; } },
    { id: 'g2', sec: 'gems', name: 'Cofre de gemas', desc: '150 gemas: justo un Pase Pro', gems: 150, price: '4,99 €', grant: () => { save.gems = (save.gems || 0) + 150; } },
    { id: 'g3', sec: 'gems', name: 'Tesoro de gemas', desc: '330 gemas (10 % extra)', gems: 330, price: '9,99 €', grant: () => { save.gems = (save.gems || 0) + 330; } },
    { id: 'noads', name: 'Quitar anuncios', desc: 'Sin anuncios entre niveles para siempre', price: '3,99 €', grant: () => { save.adsRemoved = true; } },
    { id: 'starter', name: 'Pack de inicio', desc: '1.000 monedas + 3 bombas + 3 arcoíris', price: '1,99 €', once: true, grant: () => { save.coins += 1000; save.boosters.bomb += 3; save.boosters.rainbow += 3; save.starter = true; } },
    { id: 'c1', name: 'Bolsa de monedas', desc: '500 monedas', price: '0,99 €', grant: () => { save.coins += 500; } },
    { id: 'c2', name: 'Cofre de monedas', desc: '3.000 monedas', price: '4,99 €', grant: () => { save.coins += 3000; } },
    { id: 'b1', name: 'Bomba', desc: 'Potenciador para empezar un nivel', coins: 250, grant: () => { save.boosters.bomb++; } },
    { id: 'b2', name: 'Bola arcoíris', desc: 'Toma el color del primer bloque', coins: 300, grant: () => { save.boosters.rainbow++; } },
    { id: 'b3', name: '+2 bolas', desc: 'Empiezas con dos bolas más', coins: 200, grant: () => { save.boosters.extra++; } },
  ];
  function openShop(focus) {
    const items = SHOP.filter(s => !(s.once && save.starter) && !(s.id === 'noads' && save.adsRemoved));
    const SIC = { g1: '<i class="gem"></i>', g2: '<i class="gems2"></i>', g3: '<i class="chest crystal"></i>', starter: '<i class="chest gold"></i>', c1: '<i class="coin"></i>', c2: '<i class="chest wood"></i>', b1: '<i class="ball bBomb"></i>', b2: '<i class="ball bRainbow"></i>', b3: '<i class="ball bPlus2"></i>' };
    const row = s => `<div class="shopitem">${SIC[s.id] ? '<div class="sic">' + SIC[s.id] + '</div>' : ''}<div class="stx"><b>${s.name}</b><span>${s.desc}</span></div><button class="btn ${s.coins ? 'gold' : 'green'}" data-id="${s.id}">${s.coins ? '<i class="coin"></i>' + s.coins : s.price}</button></div>`;
    const wrow = k => {
      const open = wbOpen(k), have = save.boosters[k] || 0;
      return `<div class="shopitem wb ${open ? '' : 'locked'}"><div class="ball ${CSSB[k]}"></div><div><b>${WBALLS[k].name} <small>nv. ${wbLevel(k)}${have ? ' · tienes ' + have : ''}</small></b><span>${open ? WB_DESC[k] : 'Se desbloquea en el mundo ' + WBALLS[k].world}</span></div>` +
        (open ? `<button class="btn gold" data-wb="${k}"><i class="coin"></i>${wbCoins(k)}</button>` : '<span class="lockico">&#128274;</span>') + '</div>';
    };
    // pestañas: Ofertas, Gemas, Bolas y Monedas (cada una baja a su sección)
    const TAG = { g2: 'MÁS POPULAR', g3: 'MEJOR VALOR' };
    const st = items.find(s => s.id === 'starter');
    const feat = st ? `<div class="feat"><div class="frays"></div><div class="ftag">OFERTA ÚNICA</div><div class="fic"><i class="chest gold"></i></div>
      <div class="ftx"><b>${st.name}</b><div class="fit"><span><i class="coin"></i>1.000</span><span><i class="ball bBomb"></i>×3</span><span><i class="ball bRainbow"></i>×3</span></div></div>
      <div class="fbuy"><button class="btn green" data-id="starter">${st.price}</button><small>solo una vez</small></div></div>` : '';
    const rowT = s => TAG[s.id] ? row(s).replace('<div class="shopitem">', `<div class="shopitem hot"><i class="rtag">${TAG[s.id]}</i>`) : row(s);
    const by = ids => items.filter(s => ids.includes(s.id)).map(rowT).join('');
    $('shopTabs').innerHTML = [['sOff', 'ico ico-fire', 'Ofertas'], ['sGem', 'gem', 'Gemas'], ['sBall', 'ball bB', 'Bolas'], ['sCoin', 'coin', 'Monedas']]
      .map(([id, ic, t]) => `<button data-to="${id}"><i class="${ic}"></i>${t}</button>`).join('');
    $('shopList').innerHTML = `<div class="sechead" id="sOff"><span>Ofertas</span></div>${feat}${by(['noads'])}` +
      `<div class="sechead" id="sGem"><span>Gemas · para el Pase Pro</span></div>${by(['g1', 'g2', 'g3'])}` +
      `<div class="sechead" id="sBall"><span>Potenciadores</span></div>${by(['b1', 'b2', 'b3'])}` +
      `<div class="sechead"><span>Bolas de los mundos</span></div>${WB_KEYS.map(wrow).join('')}` +
      `<div class="sechead" id="sCoin"><span>Monedas</span></div>${by(['c1', 'c2'])}`;
    const goTab = id => {
      const el = $(id), L = $('shopList'); if (!el) return;
      L.scrollTop = el.offsetTop - L.offsetTop - 4;
      $('shopTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.to === id));
    };
    $('shopTabs').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { Audio.click(); goTab(b.dataset.to); }));
    $('shopTabs').querySelector('button').classList.add('on');
    $('shopList').querySelectorAll('button[data-wb]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.wb, cost = wbCoins(k);
      if (save.coins < cost) { toast('No tienes monedas suficientes'); return; }
      save.coins -= cost; save.boosters[k] = (save.boosters[k] || 0) + 1; persist(); setCoins(); Audio.coin(); toast('¡' + WBALLS[k].name + ' comprada!');
      const sc = $('shopList').scrollTop; openShop(); $('shopList').scrollTop = sc;
    }));
    $('shopList').querySelectorAll('button[data-id]').forEach(b => b.addEventListener('click', () => {
      const it = SHOP.find(s => s.id === b.dataset.id);
      if (it.coins) { if (save.coins < it.coins) { toast('No tienes monedas suficientes'); return; } save.coins -= it.coins; }
      it.grant(); persist(); setCoins(); Audio.coin(); toast(it.coins ? '¡Comprado!' : 'Compra de prueba hecha (no se ha cobrado nada)');
      openShop();
    }));
    setCoins(); $('shop').classList.add('on');
    if (focus) goTab({ gems: 'sGem', coins: 'sCoin', balls: 'sBall' }[focus] || 'sOff');
  }

  // ---------------- pase de temporada ----------------
  // 30 niveles por temporada de 28 días. Se avanza con estrellas. Gratis para todos; Pro con 150 gemas (≈ 4,99 €).
  const SEASON_DAYS = 28, SEASON_EPOCH = Date.UTC(2026, 9, 5);
  const SEASON_NAMES = ['de la Feria', 'del Hielo', 'Pirata', 'de Cristal'];
  const PASS_PRO_GEMS = 150;
  const tierCost = t => t <= 10 ? 4 : t <= 20 ? 6 : 8;            // estrellas para llegar al nivel t
  const PASS_NEED = []; { let acc = 0; for (let t = 1; t <= 30; t++) { acc += tierCost(t); PASS_NEED.push(acc); } }
  const SKINS = {
    classic: { name: 'Clásico', css: '#3a2f6e', color: 0x3a2f6e, metal: 0.3, rough: 0.35 },
    royal: { name: 'Cañón Real', css: '#ffc83d', color: 0xffc83d, metal: 0.9, rough: 0.2 },
    ice: { name: 'Cañón de Hielo', css: '#9fe6ff', color: 0x9fe6ff, metal: 0.1, rough: 0.05 },
    rainbow: { name: 'Cañón Arcoíris', css: 'conic-gradient(#ff4f6d,#ffd23f,#5fd45a,#3d9bff,#a66bff,#ff4f6d)', color: 0xffffff, metal: 0.2, rough: 0.25, map: true },
    fire: { name: 'Cañón de Fuego', css: 'linear-gradient(180deg,#ffe066,#ff6a1a 50%,#8a1010)', color: 0xffffff, metal: 0.25, rough: 0.3, map: 'fire', glow: 0x7a1c00 },
  };
  const R = (o) => o;
  const PASS = [
    [R({ coins: 50 }), R({ skin: 'royal', coins: 100 })],
    [R({ bomb: 1 }), R({ bomb: 2 })],
    [R({ coins: 75 }), R({ gems: 5 })],
    [R({ extra: 1 }), R({ coins: 200 })],
    [R({ gems: 2 }), R({ rainbow: 2 })],
    [R({ coins: 100 }), R({ golden: 1 })],
    [R({ rainbow: 1 }), R({ coins: 250 })],
    [R({ coins: 100 }), R({ gems: 5 })],
    [R({ bomb: 1 }), R({ extra: 3 })],
    [R({ gems: 3 }), R({ golden: 1, coins: 300 })],
    [R({ coins: 120 }), R({ bomb: 3 })],
    [R({ extra: 1 }), R({ gems: 5 })],
    [R({ coins: 120 }), R({ coins: 300 })],
    [R({ rainbow: 1 }), R({ rainbow: 3 })],
    [R({ gems: 2 }), R({ skin: 'ice' })],
    [R({ coins: 150 }), R({ gems: 5 })],
    [R({ bomb: 1 }), R({ coins: 350 })],
    [R({ coins: 150 }), R({ golden: 1 })],
    [R({ extra: 1 }), R({ bomb: 3 })],
    [R({ gems: 3 }), R({ gems: 10 })],
    [R({ coins: 180 }), R({ coins: 400 })],
    [R({ rainbow: 1 }), R({ rainbow: 3 })],
    [R({ coins: 180 }), R({ extra: 4 })],
    [R({ bomb: 2 }), R({ gems: 5 })],
    [R({ gems: 3 }), R({ golden: 1 })],
    [R({ coins: 200 }), R({ coins: 500 })],
    [R({ rainbow: 1 }), R({ bomb: 4 })],
    [R({ coins: 250 }), R({ gems: 10 })],
    [R({ extra: 2 }), R({ rainbow: 4 })],
    [R({ golden: 1, gems: 5 }), R({ skin: 'rainbow', golden: 2, coins: 1000 })],
  ];
  function seasonIndex() { return Math.max(0, Math.floor((Date.now() - SEASON_EPOCH) / (SEASON_DAYS * 864e5))); }
  function seasonDaysLeft(si) { return Math.max(0, Math.ceil((SEASON_EPOCH + (si + 1) * SEASON_DAYS * 864e5 - Date.now()) / 864e5)); }
  function passTier(pts) { let t = 0; while (t < 30 && pts >= PASS_NEED[t]) t++; return t; }
  function grant(r) {
    const out = [];
    if (r.coins) { save.coins += r.coins; out.push(r.coins + ' monedas'); }
    if (r.gems) { save.gems = (save.gems || 0) + r.gems; out.push(r.gems + ' gemas'); }
    for (const k of ['bomb', 'rainbow', 'extra', 'golden']) if (r[k]) { save.boosters[k] = (save.boosters[k] || 0) + r[k]; out.push(r[k] + ' ' + ({ bomb: r[k] > 1 ? 'bombas' : 'bomba', rainbow: 'arcoíris', extra: '× +2 bolas', golden: r[k] > 1 ? 'bolas doradas' : 'bola dorada' })[k]); }
    if (r.skin && !save.skins.owned.includes(r.skin)) { save.skins.owned.push(r.skin); save.skins.equip = r.skin; applySkin(); out.push(SKINS[r.skin].name); }
    return out;
  }
  function ensureSeason() {
    const si = seasonIndex();
    if (save.pass && save.pass.season === si) return;
    if (save.pass) {   // fin de temporada: lo ya ganado y sin reclamar se entrega solo
      const p = save.pass, t = passTier(p.pts), got = [];
      for (let i = 0; i < t; i++) {
        if (!p.free.includes(i)) got.push(...grant(PASS[i][0]));
        if (p.pro && !p.proClaimed.includes(i)) got.push(...grant(PASS[i][1]));
      }
      if (got.length) setTimeout(() => toast('Fin de temporada: te hemos dado lo que no habías reclamado', 3500), 600);
    }
    save.pass = { season: si, pts: 0, free: [], proClaimed: [], pro: false };
    persist();
  }
  function passClaimable() {
    if (!save.pass) return false;
    const p = save.pass, t = passTier(p.pts);
    for (let i = 0; i < t; i++) if (!p.free.includes(i) || (p.pro && !p.proClaimed.includes(i))) return true;
    return false;
  }
  function rewardHtml(r) {
    const parts = [], txt = [];
    if (r.skin) { parts.push(`<i class="skinsw" style="background:${SKINS[r.skin].css}"></i>`); txt.push(SKINS[r.skin].name); }
    if (r.golden) { parts.push('<i class="ball bGolden"></i>'); txt.push(r.golden > 1 ? r.golden + ' bolas doradas' : 'Bola dorada'); }
    if (r.gems) { parts.push('<i class="gem"></i>'); txt.push(r.gems + ' gemas'); }
    if (r.bomb) { parts.push('<i class="ball bBomb"></i>'); txt.push(r.bomb > 1 ? r.bomb + ' bombas' : 'Bomba'); }
    if (r.rainbow) { parts.push('<i class="ball bRainbow"></i>'); txt.push(r.rainbow > 1 ? r.rainbow + ' arcoíris' : 'Arcoíris'); }
    if (r.extra) { parts.push('<i class="ball bPlus2"></i>'); txt.push(r.extra + ' × +2 bolas'); }
    if (r.shield) { parts.push('<i class="shieldi"></i>'); txt.push('Escudo de racha'); }
    if (r.coins) { parts.push('<i class="coin"></i>'); txt.push(r.coins + ' monedas'); }
    return `<div class="ric">${parts.slice(0, 3).join('')}</div><div class="rtx">${txt.join(' + ')}</div>`;
  }
  function openPass() {
    ensureSeason();
    const p = save.pass, t = passTier(p.pts), si = p.season;
    $('passName').textContent = 'Pase ' + SEASON_NAMES[si % SEASON_NAMES.length] + ' · temporada ' + (si + 1);
    $('passDays').textContent = 'quedan ' + seasonDaysLeft(si) + ' días';
    const prev = t ? PASS_NEED[t - 1] : 0, next = t < 30 ? PASS_NEED[t] : PASS_NEED[29];
    $('passBar').style.width = (t >= 30 ? 100 : (100 * (p.pts - prev) / (next - prev))).toFixed(1) + '%';
    $('passProg').innerHTML = t >= 30 ? '¡Completado!' : `Nivel ${t} · ${p.pts - prev}/${next - prev} &#9733;`;
    const buy = $('passBuy');
    buy.classList.toggle('owned', !!p.pro);
    buy.innerHTML = p.pro ? 'PASE PRO ACTIVADO' : `<span>PASE PRO &middot; <i class="gem"></i> ${PASS_PRO_GEMS}</span><small>150 gemas ≈ 4,99 € · lo ya alcanzado se reclama al momento</small>`;
    $('passSkins').innerHTML = save.skins.owned.length > 1 ? save.skins.owned.map(k => `<span class="skin ${save.skins.equip === k ? 'on' : ''}" data-k="${k}"><i style="background:${SKINS[k].css}"></i>${SKINS[k].name}</span>`).join('') : '';
    $('passSkins').querySelectorAll('.skin').forEach(el => el.addEventListener('click', () => { save.skins.equip = el.dataset.k; applySkin(); persist(); Audio.click(); openPass(); }));
    let h = '';
    for (let i = 0; i < 30; i++) {
      const reached = i < t;
      const fs = p.free.includes(i) ? 'done' : reached ? 'ready' : '';
      const ps = p.proClaimed.includes(i) ? 'done' : !p.pro ? 'lock' : reached ? 'ready' : '';
      h += `<div class="prow" id="ptier${i + 1}"><div class="pcard ${fs}" data-i="${i}" data-t="free">${rewardHtml(PASS[i][0])}</div>
        <div class="ptier ${i === t ? 'cur' : ''}">${i + 1}<small>${PASS_NEED[i]} &#9733;</small></div>
        <div class="pcard pro ${ps}" data-i="${i}" data-t="pro">${rewardHtml(PASS[i][1])}</div></div>`;
    }
    $('passList').innerHTML = h;
    $('passList').querySelectorAll('.pcard.ready').forEach(el => el.addEventListener('click', () => claim(+el.dataset.i, el.dataset.t)));
    $('passClaimAll').hidden = !passClaimable();
    setCoins();
    show('pass');
    const cur = $('ptier' + Math.max(1, Math.min(30, t))); if (cur) cur.scrollIntoView({ block: 'center' });
  }
  function claim(i, track) {
    const p = save.pass;
    if (track === 'free') { if (p.free.includes(i)) return; p.free.push(i); }
    else { if (!p.pro || p.proClaimed.includes(i)) return; p.proClaimed.push(i); }
    const got = grant(PASS[i][track === 'free' ? 0 : 1]);
    persist(); Audio.coin(); vibe(20);
    toast('Has reclamado: ' + got.join(', '));
    const sc = $('passList').scrollTop; openPass(); $('passList').scrollTop = sc;
  }
  function claimAll() {
    const p = save.pass, t = passTier(p.pts), got = [];
    for (let i = 0; i < t; i++) {
      if (!p.free.includes(i)) { p.free.push(i); got.push(...grant(PASS[i][0])); }
      if (p.pro && !p.proClaimed.includes(i)) { p.proClaimed.push(i); got.push(...grant(PASS[i][1])); }
    }
    persist(); Audio.special(); toast('Has reclamado ' + got.length + ' recompensas'); openPass();
  }
  function buyPro() {
    const p = save.pass;
    if (p.pro) return;
    if ((save.gems || 0) < PASS_PRO_GEMS) {
      toast(`Te faltan ${PASS_PRO_GEMS - (save.gems || 0)} gemas. Las encuentras en las partidas o en la tienda.`, 3200);
      openShop('gems'); return;
    }
    save.gems -= PASS_PRO_GEMS; p.pro = true; persist();
    Audio.win(); vibe([30, 30, 60]);
    toast('¡Pase Pro activado! Ya puedes reclamar todo lo Pro que hayas alcanzado', 3200);
    openPass();
  }

  // ---------------- nivel de jugador, misiones y amigos ----------------
  // Experiencia: para pasar del nivel L al L+1 hacen falta 30 + 20·(L-1) XP (curva de "progresión lineal":
  // cada nivel pide 20 XP más que el anterior). Al principio se sube casi en cada partida; después, más despacio.
  //   nivel 5 ≈ 8-10 partidas · nivel 10 ≈ 30-35 · nivel 20 ≈ 120 · nivel 50 ≈ 700 (contando las misiones).
  const xpNeed = L => 30 + 20 * (L - 1);
  function stats() { if (!save.stats) save.stats = { blocks: 0, specials: 0, movers: 0, cascades: 0, shares: 0, ads: 0, golden: 0, skin: 0 }; return save.stats; }
  function plState() { if (!save.pl) save.pl = { lv: 1, xp: 0 }; return save.pl; }
  // da experiencia; devuelve los niveles subidos (con su premio)
  function addXp(n) {
    const p = plState(), ups = [];
    p.xp += n;
    while (p.xp >= xpNeed(p.lv)) {
      p.xp -= xpNeed(p.lv); p.lv++;
      const r = { coins: 40 + 10 * p.lv };
      if (p.lv % 5 === 0) r.bomb = 1;
      if (p.lv % 10 === 0) r.gems = 2;
      grant(r); ups.push({ lv: p.lv, r });
    }
    return ups;
  }
  function announceUps(ups) {
    if (!ups.length) return;
    const last = ups[ups.length - 1];
    setTimeout(() => { centerText('¡NIVEL ' + last.lv + ' DE JUGADOR!', '#ffe27a', 28); Audio.win(); vibe([30, 30, 60]); }, 700);
    const coins = ups.reduce((s, u) => s + u.r.coins, 0), gems = ups.reduce((s, u) => s + (u.r.gems || 0), 0), bombs = ups.reduce((s, u) => s + (u.r.bomb || 0), 0);
    setTimeout(() => toast(`Nivel ${last.lv}: +${coins} monedas` + (bombs ? ` · +${bombs} bomba` : '') + (gems ? ` · +${gems} gemas` : ''), 3200), 1500);
  }
  const worldsOpen = () => LEVELS[Math.min(save.unlocked, LEVELS.length) - 1].world;
  const starsTotal = () => Object.keys(save.stars).reduce((s, k) => s + (save.stars[k] || 0), 0);
  const countLv = f => LEVELS.reduce((s, L) => s + (f(L, save.stars[L.id] || 0) ? 1 : 0), 0);
  const fmtN = n => n.toLocaleString('es-ES');
  // misiones en cadena: al cobrar un escalón aparece el siguiente.
  // Gemas solo en las de amigos, las de interactuar y las difíciles (y pocas).
  const MISSIONS = [
    { id: 'friends', cat: 'Amigos', icon: '👥', tiers: [1, 5, 10, 25], title: n => n === 1 ? 'Añade a tu primer amigo' : `Añade ${n} amigos`, stat: () => (save.friends || []).length,
      reward: i => [{ xp: 300, coins: 1000, gems: 15, golden: 1 }, { xp: 250, coins: 600, gems: 6 }, { xp: 350, coins: 900, gems: 8 }, { xp: 500, coins: 1500, gems: 12 }][i] },
    { id: 'share', cat: 'Amigos', icon: '📣', tiers: [1, 5, 15], title: n => n === 1 ? 'Comparte el juego con alguien' : `Comparte el juego ${n} veces`, stat: () => stats().shares,
      reward: i => [{ xp: 60, coins: 150, gems: 2 }, { xp: 100, coins: 300, gems: 3 }, { xp: 150, coins: 500, gems: 4 }][i] },
    { id: 'skin', cat: 'Interactuar', icon: '🎨', tiers: [1], title: () => 'Equipa un cañón nuevo', stat: () => stats().skin, reward: () => ({ xp: 60, coins: 200, gems: 2 }) },
    { id: 'streak', cat: 'Interactuar', icon: '<i class="ico ico-fire"></i>', tiers: [3, 7, 14, 30], title: n => `Consigue una racha diaria de ${n} días`, stat: () => Math.max((save.daily && save.daily.best) || 0, (save.daily && save.daily.n) || 0),
      reward: i => [{ xp: 60, coins: 200, gems: 1 }, { xp: 120, coins: 400, gems: 2 }, { xp: 200, coins: 600, gems: 3 }, { xp: 400, coins: 1200, gems: 5 }][i] },
    { id: 'ads', cat: 'Interactuar', icon: '▶', tiers: [1, 10, 30, 100], title: n => n === 1 ? 'Mira un vídeo con premio' : `Mira ${n} vídeos con premio`, stat: () => stats().ads, reward: i => ({ xp: 40 + i * 40, coins: 150 + i * 150 }) },
    { id: 'level', cat: 'Avanza', icon: '🏁', tiers: [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000], title: n => `Supera el nivel ${n}`, stat: () => save.unlocked - 1, reward: i => ({ xp: 60 + i * 40, coins: 200 + i * 120 }) },
    { id: 'world', cat: 'Avanza', icon: '🗺', tiers: Array.from({ length: 99 }, (_, i) => i + 2), title: n => `Desbloquea el mundo ${n}`, stat: () => worldsOpen(), reward: i => ({ xp: 50 + Math.min(i, 30) * 10, coins: 150 + Math.min(i, 30) * 25 }) },
    { id: 'stars', cat: 'Avanza', icon: '<i class="ico ico-star"></i>', tiers: [25, 100, 250, 500, 1000, 1500, 2000, 2500, 3000], title: n => `Consigue ${fmtN(n)} estrellas`, stat: starsTotal, reward: i => ({ xp: 50 + i * 50, coins: 150 + i * 150 }) },
    { id: 'perfect', cat: 'Avanza', icon: '🌟', tiers: [5, 25, 100, 250, 500, 1000], title: n => `Consigue 3 estrellas en ${n} niveles`, stat: () => countLv((L, s) => s >= 3), reward: i => ({ xp: 60 + i * 60, coins: 200 + i * 200 }) },
    { id: 'extras', cat: 'Avanza', icon: '♕', tiers: [1, 5, 10, 25, 50, 100], title: n => n === 1 ? 'Supera un nivel extra' : `Supera ${n} niveles extra`, stat: () => Object.keys(save.bonusDone || {}).length, reward: i => ({ xp: 80 + i * 60, coins: 300 + i * 200 }) },
    { id: 'blocks', cat: 'Derriba', icon: '🧱', tiers: [100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000], title: n => `Derriba ${fmtN(n)} bloques`, stat: () => stats().blocks, reward: i => ({ xp: 40 + i * 40, coins: 100 + i * 120 }) },
    { id: 'specials', cat: 'Derriba', icon: '💥', tiers: [10, 50, 150, 400, 1000, 2500, 6000], title: n => `Derriba ${fmtN(n)} bloques especiales`, hint: 'rayados, bomba, TNT, cristal, oro, hielo, arena, congeladas, camaleón, magma o flotantes', stat: () => stats().specials, reward: i => ({ xp: 50 + i * 50, coins: 150 + i * 120 }) },
    { id: 'cascades', cat: 'Derriba', icon: '🌊', tiers: [10, 100, 500, 2000], title: n => `Haz ${fmtN(n)} cascadas`, stat: () => stats().cascades, reward: i => ({ xp: 50 + i * 60, coins: 150 + i * 150 }) },
    { id: 'wballs', cat: 'Interactuar', icon: '🔮', tiers: [1, 10, 50], title: n => n === 1 ? 'Usa una bola de los mundos' : `Usa ${n} bolas de los mundos`, stat: () => stats().wballs || 0,
      reward: i => [{ xp: 80, coins: 250, gems: 2 }, { xp: 150, coins: 500, gems: 3 }, { xp: 300, coins: 1000, gems: 5 }][i] },
    { id: 'golden', cat: 'Derriba', icon: '<i class="ico ico-golden"></i>', tiers: [1, 10, 30], title: n => n === 1 ? 'Usa una bola dorada' : `Usa ${n} bolas doradas`, stat: () => stats().golden, reward: i => ({ xp: 60 + i * 60, coins: 200 + i * 200 }) },
    // difíciles: con unas pocas gemas
    { id: 'movers', cat: 'Difíciles', icon: '🎯', tiers: [1, 10, 30, 75], title: n => n === 1 ? 'Derriba algo que cruce el cielo o el mar' : `Derriba ${n} objetos que crucen el cielo o el mar`, hint: 'pájaro, velero, globo, teleférico, mono, dragón, ovni o satélite', stat: () => stats().movers,
      reward: i => [{ xp: 80, coins: 250, gems: 1 }, { xp: 150, coins: 500, gems: 2 }, { xp: 250, coins: 800, gems: 3 }, { xp: 400, coins: 1200, gems: 5 }][i] },
    { id: 'hard', cat: 'Difíciles', icon: '💀', tiers: [1, 5, 10, 25, 50, 100], title: n => n === 1 ? 'Supera un nivel difícil' : `Supera ${n} niveles difíciles`, stat: () => countLv((L, s) => L.hard && s > 0),
      reward: i => ({ xp: 80 + i * 70, coins: 250 + i * 200, gems: [1, 2, 3, 4, 6, 8][i] }) },
    { id: 'hard3', cat: 'Difíciles', icon: '👑', tiers: [1, 5, 20, 50], title: n => n === 1 ? 'Consigue 3 estrellas en un nivel difícil' : `Consigue 3 estrellas en ${n} niveles difíciles`, stat: () => countLv((L, s) => L.hard && s >= 3),
      reward: i => ({ xp: 120 + i * 100, coins: 400 + i * 300, gems: [2, 4, 6, 10][i] }) },
  ];
  function misState(m) {
    save.mis = save.mis || {};
    const i = save.mis[m.id] || 0, done = i >= m.tiers.length;
    const goal = done ? m.tiers[m.tiers.length - 1] : m.tiers[i], have = m.stat();
    return { i, done, goal, have, ready: !done && have >= goal };
  }
  const misClaimable = () => MISSIONS.filter(m => misState(m).ready).length;
  function rewardLine(r) {
    const c = [];
    if (r.xp) c.push(`<span class="xpchip"><i class="ico ico-xp"></i>${r.xp} XP</span>`);
    if (r.coins) c.push(`<span><i class="coin"></i>${fmtN(r.coins)}</span>`);
    if (r.gems) c.push(`<span><i class="gem"></i>${r.gems}</span>`);
    if (r.golden) c.push(`<span><i class="ball bGolden"></i>${r.golden}</span>`);
    return c.join('');
  }
  // códigos de amigo: 6 letras + 2 de control (se comprueban sin conexión)
  const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const chk = s => { let h = 7; for (const ch of s) h = (h * 31 + ALPH.indexOf(ch) + 1) % 1021; return ALPH[h % 32] + ALPH[(h >> 5) % 32]; };
  function myCode() {
    if (!save.pid) { let s = ''; for (let i = 0; i < 6; i++) s += ALPH[Math.floor(Math.random() * 32)]; save.pid = s; persist(); }
    return 'RR-' + save.pid + chk(save.pid);
  }
  // los códigos antiguos (CC-) siguen valiendo
  function normCode(t) { const c = (t || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return c.length === 10 && /^(RR|CC)/.test(c) ? c.slice(2) : c; }
  function addFriend(text) {
    const c = normCode(text);
    if (c.length !== 8 || [...c].some(ch => ALPH.indexOf(ch) < 0) || chk(c.slice(0, 6)) !== c.slice(6)) return 'Ese código no es válido. Revisa que esté bien escrito.';
    if (c.slice(0, 6) === save.pid) return 'Ese es tu propio código.';
    save.friends = save.friends || [];
    if (save.friends.includes(c)) return 'Ya tienes a ese amigo.';
    save.friends.push(c); persist();
    return null;
  }
  function shareGame() {
    const text = `¡Juega conmigo a Rocket Rush! Añádeme como amigo con mi código ${myCode()} y los dos ganamos premios.`;
    stats().shares++; persist();
    try {
      if (window.ChromaAndroid && window.ChromaAndroid.share) window.ChromaAndroid.share(text);
      else if (navigator.share) navigator.share({ title: 'Rocket Rush', text }).catch(() => {});
      else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('Mensaje copiado: pégalo donde quieras'), () => toast(text, 5000));
    } catch (e) { /* sin compartir */ }
    renderMissions();
  }
  function renderPlayer() {
    const p = plState(), need = xpNeed(p.lv), pct = (100 * p.xp / need).toFixed(1) + '%';
    if ($('plLv')) { $('plLv').textContent = p.lv; $('plBar').style.width = pct; $('plXp').textContent = `${p.xp} / ${need} XP para el nivel ${p.lv + 1}`; }
    if ($('plStripLv')) { $('plStripLv').textContent = p.lv; $('plStripBar').style.width = pct; const n = misClaimable(); $('misDot').hidden = !n; $('misCount').textContent = n ? n + ' para cobrar' : 'Misiones'; }
  }
  function renderMissions() {
    renderPlayer();
    if (!$('missions').classList.contains('on')) return;
    $('myCode').textContent = myCode();
    $('friendCount').textContent = (save.friends || []).length;
    const rows = MISSIONS.map(m => ({ m, s: misState(m) })).sort((a, b) => (b.s.ready - a.s.ready) || (a.s.done - b.s.done));
    let h = '';
    for (const { m, s } of rows) {
      const r = s.done ? null : m.reward(s.i), pct = Math.min(100, 100 * s.have / s.goal);
      h += `<div class="mcard ${s.ready ? 'ready' : ''} ${s.done ? 'done' : ''}">
        <div class="mico">${m.icon}</div>
        <div class="mbody"><small>${m.cat}${m.tiers.length > 1 ? ` · ${Math.min(s.i + 1, m.tiers.length)}/${m.tiers.length}` : ''}</small><b>${s.done ? '¡Completada!' : m.title(s.goal)}</b>
          ${m.hint && !s.done ? `<em>${m.hint}</em>` : ''}
          ${s.done ? '' : `<div class="mbar"><i style="width:${pct}%"></i></div><span class="mprog">${fmtN(Math.min(s.have, s.goal))} / ${fmtN(s.goal)}</span>`}
          ${r ? `<div class="mrew">${rewardLine(r)}</div>` : ''}</div>
        ${s.ready ? `<button class="btn green small mclaim" data-id="${m.id}">COBRAR</button>` : ''}</div>`;
    }
    $('misList').innerHTML = h;
    $('misList').querySelectorAll('.mclaim').forEach(b => b.addEventListener('click', () => claimMission(b.dataset.id)));
    setCoins();
  }
  function claimMission(id) {
    const m = MISSIONS.find(x => x.id === id), s = misState(m);
    if (!s.ready) return;
    const r = m.reward(s.i);
    save.mis[id] = s.i + 1;
    const got = grant(Object.assign({}, r, { xp: undefined }));
    const ups = addXp(r.xp || 0);
    persist(); Audio.coin(); vibe(25);
    toast('Misión cumplida: +' + r.xp + ' XP' + (got.length ? ', ' + got.join(', ') : ''), 2600);
    announceUps(ups);
    const sc = $('misList').scrollTop; renderMissions(); $('misList').scrollTop = sc;
  }
  function openMissions() { show('missions'); $('friendMsg').textContent = ''; renderMissions(); $('misList').scrollTop = 0; }

  // ---------------- racha diaria ----------------
  // Un premio cada día que entras y lo recoges. Cada 5 días toca cofre, y cada cofre es mejor que el anterior:
  // madera, plata, oro, cristal, épico y, el día 30, legendario con el Cañón de Fuego (solo se consigue así).
  // Pasado el día 30 se repiten los días 26-30 con un cofre legendario cada 5 días.
  // Si un día no entras: un escudo de racha (máx. 2) lo cubre solo. Sin escudo, puedes salvarla con un vídeo
  // (una vez por semana) o con 15 gemas. Dos días o más sin escudos que los cubran: la racha empieza de cero.
  let dayShift = 0;                                           // solo para pruebas (simular días)
  const dayKey = () => { const d = new Date(Date.now() + dayShift * 864e5); return Math.floor((d.getTime() - d.getTimezoneOffset() * 6e4) / 864e5); };
  const SHIELD_MAX = 2, RESCUE_GEMS = 15, RESCUE_AD_DAYS = 7;
  const CHESTS = [
    { name: 'Cofre de madera', cls: 'wood' }, { name: 'Cofre de plata', cls: 'silver' }, { name: 'Cofre de oro', cls: 'gold' },
    { name: 'Cofre de cristal', cls: 'crystal' }, { name: 'Cofre épico', cls: 'epic' }, { name: 'Cofre legendario', cls: 'legend' },
  ];
  const DAILY = [
    { coins: 50 }, { bomb: 1 }, { coins: 75 }, { rainbow: 1 }, { coins: 150, extra: 1, gems: 1 },
    { coins: 75 }, { bomb: 1 }, { coins: 100 }, { extra: 1 }, { coins: 250, shield: 1, gems: 2 },
    { coins: 100 }, { rainbow: 1 }, { coins: 125 }, { bomb: 2 }, { golden: 1, coins: 300, gems: 3 },
    { coins: 125 }, { extra: 2 }, { coins: 150 }, { rainbow: 2 }, { golden: 1, shield: 1, gems: 4, coins: 400 },
    { coins: 150 }, { bomb: 2 }, { coins: 175 }, { rainbow: 2 }, { golden: 2, gems: 5, coins: 500 },
    { coins: 175 }, { extra: 2 }, { coins: 200 }, { bomb: 2, rainbow: 1 }, { skin: 'fire', golden: 2, gems: 10, coins: 1000 },
  ];
  const LEGEND_LOOP = { golden: 2, gems: 3, coins: 800, shield: 1 };
  const isChest = day => day % 5 === 0;
  const chestOf = day => CHESTS[Math.min(5, day / 5 - 1)];
  function dailyReward(day) {
    if (day <= 30) return DAILY[day - 1];
    const p = (day - 1) % 5;
    return p === 4 ? LEGEND_LOOP : DAILY[25 + p];
  }
  function dailySave() {
    if (!save.daily) save.daily = { n: 0, last: null, best: 0, shields: 0, adRescue: -99, auto: null, notif: true, asked: false };
    return save.daily;
  }
  // 'claim' = premio listo · 'done' = ya recogido hoy · 'risk' = te saltaste un día sin escudo: se puede salvar
  function dailyStatus() {
    const d = dailySave(), t = dayKey();
    if (d.last == null) return { st: 'claim', day: 1, first: !d.best };
    if (t <= d.last) return { st: 'done', day: d.n };
    const miss = t - d.last - 1;
    if (miss === 0) return { st: 'claim', day: d.n + 1 };
    if (miss <= d.shields) return { st: 'claim', day: d.n + 1, shieldUse: miss };
    if (miss - d.shields === 1 && d.n >= 2) return { st: 'risk', day: d.n + 1, shieldUse: d.shields, streak: d.n };
    return { st: 'claim', day: 1, lost: d.n >= 2 ? d.n : 0 };
  }
  const dailyEligible = () => save.unlocked >= 2;          // aparece tras ganar el nivel 1 (no estorba al aprender)
  const adRescueOk = () => dayKey() - dailySave().adRescue >= RESCUE_AD_DAYS;
  function claimDaily(mult) {
    const s = dailyStatus(); if (s.st !== 'claim') return null;
    const d = dailySave();
    if (s.lost) d.best = Math.max(d.best || 0, d.n);
    if (s.shieldUse) d.shields -= s.shieldUse;
    d.n = s.day; d.last = dayKey(); d.best = Math.max(d.best || 0, d.n);
    const r = Object.assign({}, dailyReward(s.day));
    if (mult === 2 && !isChest(s.day)) for (const k of ['coins', 'bomb', 'rainbow', 'extra']) if (r[k]) r[k] *= 2;
    if (r.skin && save.skins.owned.includes(r.skin)) { delete r.skin; r.gems = (r.gems || 0) + 5; }
    if (r.shield) { if (d.shields < SHIELD_MAX) d.shields++; else { r.coins = (r.coins || 0) + 100; delete r.shield; } }
    grant(r);
    persist(); setCoins(); scheduleReminder();
    return { day: s.day, r };
  }
  function rescueDaily(how) {
    const s = dailyStatus(); if (s.st !== 'risk') return false;
    const d = dailySave();
    if (how === 'gems') { if ((save.gems || 0) < RESCUE_GEMS) return false; save.gems -= RESCUE_GEMS; } else d.adRescue = dayKey();
    d.shields -= s.shieldUse; d.last = dayKey() - 1; persist(); setCoins(); return true;
  }
  function resetDaily() { const d = dailySave(); d.best = Math.max(d.best || 0, d.n); d.n = 0; d.last = null; persist(); }
  function untilMidnight() {
    const now = new Date(Date.now() + dayShift * 864e5), m = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const min = Math.max(1, Math.round((m - now) / 6e4));
    return min >= 60 ? Math.floor(min / 60) + ' h ' + (min % 60) + ' min' : min + ' min';
  }
  // recordatorio local del móvil (Android). Si hoy aún no has recogido: hoy a las 19:00 (o 21:30 si ya pasó);
  // si ya lo recogiste: mañana a las 19:00. Cada llamada sustituye al aviso anterior.
  function scheduleReminder() {
    const A = window.ChromaAndroid; if (!A || !A.scheduleReminder) return;
    const d = dailySave(), s = dailyStatus();
    try {
      if (d.notif === false || !d.n || (s.st === 'claim' && s.lost)) { if (A.cancelReminder) A.cancelReminder(); return; }
      const now = new Date(), at = (plus, h, m) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + plus, h, m || 0, 0);
      const when = s.st === 'done' ? at(1, 19) : now < at(0, 19) ? at(0, 19) : now < at(0, 21, 30) ? at(0, 21, 30) : at(1, 19);
      const next = s.st === 'done' ? d.n + 1 : s.day;
      const title = isChest(next) ? '¡Hoy toca ' + chestOf(next).name + '!' : 'Tu racha de ' + d.n + (d.n === 1 ? ' día' : ' días') + ' te espera';
      const text = isChest(next) ? 'Entra y ábrelo antes de medianoche para no perder la racha.' : 'Entra hoy y recoge el premio del día ' + next + '.';
      A.scheduleReminder(String(when.getTime()), title, text);
    } catch (e) { /* sin recordatorios */ }
  }
  function updateDailyBadges() {
    const s = dailyStatus(), d = dailySave(), ok = dailyEligible();
    const ready = ok && s.st !== 'done', n = s.st === 'claim' && s.lost ? 0 : d.n;
    if ($('dailyN')) { $('dailyN').textContent = n; $('dailyDot').hidden = !ready; $('btnDaily').hidden = !ok; }
    if ($('btnDailyT')) {
      $('btnDailyT').hidden = !ok; $('dailyNT').textContent = n;
      $('dailyTT').textContent = s.st === 'risk' ? ' · ¡racha en peligro!' : ready ? ' · premio listo' : n === 1 ? ' día' : ' días';
      $('dailyDotT').hidden = !ready; $('btnDailyT').classList.toggle('ready', ready);
      $('btnDailyT').setAttribute('aria-label', 'Racha diaria: ' + n + $('dailyTT').textContent);
    }
  }
  // pinta un premio como fichas (icono + texto)
  function rewardChips(r) {
    const c = [];
    if (r.skin) c.push(`<i class="skinsw" style="background:${SKINS[r.skin].css};width:20px;height:20px;border-radius:6px;border:2px solid #2a1d5c;display:inline-block"></i>${SKINS[r.skin].name}`);
    if (r.golden) c.push(`<i class="ball bGolden"></i>${r.golden > 1 ? r.golden + ' doradas' : 'Dorada'}`);
    if (r.gems) c.push(`<i class="gem"></i>${r.gems}`);
    if (r.shield) c.push('<i class="shieldi"></i>Escudo');
    if (r.bomb) c.push(`<i class="ball bBomb"></i>${r.bomb > 1 ? r.bomb + ' bombas' : 'Bomba'}`);
    if (r.rainbow) c.push(`<i class="ball bRainbow"></i>${r.rainbow > 1 ? r.rainbow + ' arcoíris' : 'Arcoíris'}`);
    if (r.extra) c.push(`<i class="ball bPlus2"></i>${r.extra > 1 ? r.extra + ' × +2 bolas' : '+2 bolas'}`);
    if (r.coins) c.push(`<i class="coin"></i>${r.coins}`);
    return c.map((x, i) => `<span style="animation-delay:${(i * 0.12).toFixed(2)}s">${x}</span>`).join('');
  }
  function dayCell(day, cls) {
    const r = dailyReward(day);
    if (isChest(day)) return `<div class="dday dchest ${cls}"><small>DÍA ${day}</small><div class="chest ${chestOf(day).cls}"><i></i></div><em>${chestOf(day).name.replace('Cofre ', '')}</em></div>`;
    const k = r.bomb ? ['<i class="ball bBomb"></i>', r.bomb > 1 ? '×' + r.bomb : ''] : r.rainbow ? ['<i class="ball bRainbow"></i>', r.rainbow > 1 ? '×' + r.rainbow : ''] : r.extra ? ['<i class="ball bPlus2"></i>', '+' + 2 * r.extra] : ['<i class="coin"></i>', r.coins];
    return `<div class="dday ${cls}"><small>DÍA ${day}</small><div class="ric">${k[0]}${r.rainbow && r.bomb ? '<i class="ball bRainbow"></i>' : ''}</div><em>${k[1]}</em></div>`;
  }
  // próximos cofres: la meta a largo plazo
  function nextInfo(s, d) {
    const done = s.st === 'done', from = done ? d.n + 1 : s.day;
    let nc = Math.ceil(from / 5) * 5; if (nc === from && !done) nc += 5;
    const left = nc - from + (done ? 1 : 0), nx = [];
    nx.push(!done && isChest(s.day) ? `Siguiente cofre: <b>${chestOf(nc).name}</b> el día ${nc}` : `Próximo cofre: <b>${chestOf(nc).name}</b> el día ${nc} (${left} ${left === 1 ? 'día' : 'días'})`);
    if (from <= 30 && !save.skins.owned.includes('fire')) nx.push('Día 30: <b>Cañón de Fuego</b>, exclusivo de la racha');
    else if (d.best) nx.push(`Mejor racha: <b>${Math.max(d.best, d.n)} días</b>`);
    return nx.join('<br>');
  }
  let dailyCb = null;
  function openDaily(cb, note) {
    if (cb !== undefined) dailyCb = cb;
    const s = dailyStatus(), d = dailySave();
    const shown = s.st === 'done' ? d.n : s.day;                  // día que se muestra en la fila
    const start = Math.floor((Math.max(1, shown) - 1) / 5) * 5 + 1;
    const cur = s.st === 'done' ? -1 : s.day;
    let w = '';
    for (let day = start; day < start + 5; day++) w += dayCell(day, day === cur ? 'today' : (s.st === 'done' ? day <= d.n : day < s.day) ? 'done' : '');
    $('dWeek').innerHTML = w;
    $('dReveal').classList.remove('on'); $('dReveal').innerHTML = '';
    const flameN = s.st === 'claim' ? s.day - 1 : d.n;
    $('dNum').textContent = flameN; $('dUnit').textContent = flameN === 1 ? 'día' : 'días';
    $('dFlame').classList.toggle('cold', s.st === 'risk' || (s.st === 'claim' && flameN === 0));
    let title, sub;
    if (s.st === 'risk') { title = `¡Tu racha de ${s.streak} días está en peligro!`; sub = s.shieldUse ? `Tus escudos cubrieron ${s.shieldUse === 1 ? 'un día' : s.shieldUse + ' días'}, pero no todos. Sálvala y sigue por el día ${s.day}.` : `Ayer no recogiste tu premio. Sálvala ahora y sigue por el día ${s.day}.`; }
    else if (s.st === 'done') { title = '¡Premio de hoy recogido!'; sub = `Vuelve mañana para el día ${d.n + 1}: quedan ${untilMidnight()}.`; }
    else if (s.first) { title = '¡Nueva racha diaria!'; sub = 'Entra cada día y recoge un premio. Cada 5 días, un cofre, y cada uno mejor que el anterior.'; }
    else if (s.lost) { title = `Se perdió tu racha de ${s.lost} días`; sub = `Tu mejor racha: ${Math.max(d.best || 0, s.lost)} días. ¡Empieza otra hoy!`; }
    else { title = isChest(s.day) ? `¡Día ${s.day}: ${chestOf(s.day).name}!` : `¡Día ${s.day}!`; sub = s.shieldUse ? `Un escudo ha salvado tu racha. Recoge el premio de hoy.` : 'Recoge el premio de hoy y mantén viva la racha.'; }
    if (note) sub = note;
    $('dTitle').textContent = title; $('dSub').textContent = sub;
    $('dNext').innerHTML = nextInfo(s, d);
    { const from = s.st === 'done' ? d.n + 1 : s.day; let c = Math.ceil(from / 5) * 5; if (c === from && s.st !== 'done') c += 5;
      $('dNexts').innerHTML = [0, 1, 2, 3, 4].map(i => `<div class="nc"><i class="chest ${chestOf(c + 5 * i).cls}"><i></i></i><small>Día ${c + 5 * i}</small></div>`).join(''); }
    $('dShield').innerHTML = d.shields || d.n >= 5 ? `<i class="shieldi" style="vertical-align:-4px"></i> Escudos de racha: ${d.shields}/${SHIELD_MAX} · cada uno cubre un día que no entres` : '';
    // botones
    const B = [];
    if (s.st === 'claim') {
      if (isChest(s.day)) B.push('<button class="btn green" id="dClaim">ABRIR COFRE</button>');
      else B.push('<div class="row"><button class="btn green" id="dClaim">RECOGER</button><button class="btn purple" id="dDouble">&#9654; x2</button></div>');
    } else if (s.st === 'risk') {
      if (adRescueOk()) B.push('<button class="btn purple" id="dSaveAd">&#9654; Salvar la racha (vídeo)</button>');
      B.push(`<button class="btn gold" id="dSaveGem">Salvar por <i class="gem"></i> ${RESCUE_GEMS}</button>`);
      B.push('<button class="btn gray small" id="dReset">Empezar de cero</button>');
    } else {
      const A = window.ChromaAndroid;
      if (A && A.askNotifications && !d.asked) B.push('<button class="btn blue small" id="dNotify">&#128276; Avisarme para no perder la racha</button>');
      B.push('<button class="btn green" id="dClose">¡A JUGAR!</button>');
    }
    $('dBtns').innerHTML = B.join('');
    const b = id => { const el = $(id); if (el) el.addEventListener('click', ev => { ev.stopPropagation(); Audio.init(); Audio.click(); ({ dClaim: () => doClaim(1), dDouble: () => showRewarded(ok => { if (ok) doClaim(2); }), dSaveAd: () => showRewarded(ok => { if (ok && rescueDaily('ad')) { Audio.win(); openDaily(undefined, '¡Racha salvada! Recoge el premio de hoy.'); } }), dSaveGem: () => { if ((save.gems || 0) < RESCUE_GEMS) { toast(`Te faltan ${RESCUE_GEMS - (save.gems || 0)} gemas`); openShop('gems'); return; } if (rescueDaily('gems')) { Audio.win(); openDaily(undefined, '¡Racha salvada! Recoge el premio de hoy.'); } }, dReset: () => { resetDaily(); openDaily(); }, dNotify: () => { d.asked = true; persist(); try { window.ChromaAndroid.askNotifications(); } catch (e) { /* nada */ } scheduleReminder(); openDaily(); }, dClose: closeDaily })[id](); }); };
    ['dClaim', 'dDouble', 'dSaveAd', 'dSaveGem', 'dReset', 'dNotify', 'dClose'].forEach(b);
    $('dX').hidden = false;
    setCoins();
    $('daily').classList.add('on');
  }
  function doClaim(mult) {
    const res = claimDaily(mult); if (!res) return;
    const chest = isChest(res.day);
    $('dBtns').innerHTML = ''; $('dX').hidden = true;     // sin cerrar mientras se abre el cofre
    const rv = $('dReveal'); rv.classList.add('on');
    const finish = () => {
      const d = dailySave();
      $('dTitle').textContent = chest ? '¡' + chestOf(res.day).name + ' abierto!' : mult === 2 ? '¡Premio doble!' : '¡Recogido!';
      $('dSub').textContent = `Vuelve mañana para el día ${d.n + 1}: quedan ${untilMidnight()}.`;
      $('dNum').textContent = d.n; $('dUnit').textContent = d.n === 1 ? 'día' : 'días'; $('dFlame').classList.remove('cold');
      const cell = $('dWeek').querySelector('.today'); if (cell) { cell.classList.remove('today'); cell.classList.add('done'); }
      rv.insertAdjacentHTML('beforeend', `<div class="drew">${rewardChips(res.r)}</div>`);
      $('dNext').innerHTML = nextInfo(dailyStatus(), d);
      const A = window.ChromaAndroid, B = [];
      if (A && A.askNotifications && !d.asked) B.push('<button class="btn blue small" id="dNotify2">&#128276; Avisarme para no perder la racha</button>');
      B.push('<button class="btn green" id="dClose2">¡A JUGAR!</button>');
      $('dBtns').innerHTML = B.join('');
      $('dClose2').addEventListener('click', () => { Audio.click(); closeDaily(); });
      if ($('dNotify2')) $('dNotify2').addEventListener('click', () => { d.asked = true; persist(); try { A.askNotifications(); } catch (e) { /* nada */ } scheduleReminder(); $('dNotify2').remove(); });
      $('dX').hidden = false;
      Audio.coin(); vibe(25); updateDailyBadges();
    };
    if (chest) openChestFX(chestOf(res.day).cls, res.r, finish);   // apertura a pantalla completa; al terminar, el resumen en la racha
    else finish();
  }
  // ---------------- apertura de cofre (estilo Brawl Stars) ----------------
  // 1) cae el cofre · 2) tres toques: tiembla, se agrieta y brilla · 3) estalla (único fogonazo) y los premios caen al suelo
  // 4) un toque por premio: carta con el número subiendo y las piezas del suelo vuelan al contador (sin destellos) · 5) resumen
  const CHEST_SFX = 'magia';             // juego de sonido elegido: magia (también hay 'arcade' y 'feria')
  const TIER_COL = { wood: '#ffb84a', silver: '#cfe6ff', gold: '#ffd23f', crystal: '#7fe0ff', epic: '#c06bff', legend: '#ff7a3d' };
  const sfx = (ev, a) => { if (save.sound) { SFX.pack = CHEST_SFX; SFX.play(ev, a); } };
  const imgCache = {};
  function cssImg(cls, pseudo) {                // la imagen de un icono del juego (sale del CSS) para dibujarla en el lienzo
    const key = cls + (pseudo || ''); if (imgCache[key]) return imgCache[key];
    const el = document.createElement('i'); el.className = cls; el.style.cssText = 'position:absolute;left:-999px;top:0'; document.body.appendChild(el);
    const m = /url\("?(.*?)"?\)$/.exec(getComputedStyle(el, pseudo || null).backgroundImage || ''); el.remove();
    const im = new Image(); if (m) im.src = m[1]; return (imgCache[key] = im);
  }
  function chestItems(r) {
    const L = [], pl = (n, a, b) => n === 1 ? a : b;
    if (r.coins) L.push({ cls: 'coin', n: r.coins, t: 'monedas', pile: 16, to: 'c' });
    if (r.gems) L.push({ cls: 'gem', n: r.gems, t: pl(r.gems, 'gema', 'gemas'), pile: Math.min(10, r.gems + 2), to: 'g' });
    if (r.bomb) L.push({ cls: 'ball bBomb', n: r.bomb, t: pl(r.bomb, 'bomba', 'bombas'), pile: Math.min(4, r.bomb) });
    if (r.rainbow) L.push({ cls: 'ball bRainbow', n: r.rainbow, t: 'arcoíris', pile: Math.min(4, r.rainbow) });
    if (r.extra) L.push({ cls: 'ball bPlus2', n: r.extra, t: '+2 bolas', pile: Math.min(4, r.extra) });
    if (r.golden) L.push({ cls: 'ball bGolden', n: r.golden, t: pl(r.golden, 'bola dorada', 'bolas doradas'), pile: Math.min(4, r.golden), special: true });
    if (r.shield) L.push({ cls: 'shieldi', n: r.shield, t: 'escudo de racha', pile: 1, special: true });
    if (r.skin) L.push({ cls: 'ico ico-fire', n: 1, t: SKINS[r.skin] ? SKINS[r.skin].name : 'Cañón', pile: 1, special: true, skin: true });
    return L;
  }
  function openChestFX(tier, r, done) {
    const st = $('cStage'), list = chestItems(r), run = ++openChestFX.run;
    const fmt = n => n.toLocaleString('es-ES');
    let coins = save.coins - (r.coins || 0), gems = (save.gems || 0) - (r.gems || 0), state = 'busy', hits = 0, onNext = null, skip = null, parts = [];
    st.style.setProperty('--tc', TIER_COL[tier] || '#ffd23f');
    st.innerHTML = `<div class="chud"><span><i class="coin"></i><b id="cfC">${fmt(coins)}</b></span><span><i class="gem"></i><b id="cfG">${gems}</b></span></div>
      <div class="crays"></div><div class="cfloor"></div>
      <div class="cbox"><div class="cglow"></div><i class="chest ${tier}"><i></i></i><div class="ccrack"></div></div>
      <canvas></canvas><div class="cflash"></div><div class="chint"></div>`;
    $('chestOpen').classList.add('on');
    const q = s => st.querySelector(s), E = { box: q('.cbox'), chest: q('.chest'), glow: q('.cglow'), crack: q('.ccrack'), rays: q('.crays'), flash: q('.cflash'), hint: q('.chint'), cv: q('canvas'), c: $('cfC'), g: $('cfG') };
    const R = st.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), W = R.width, H = R.height;
    E.cv.width = W * dpr; E.cv.height = H * dpr; const ctx = E.cv.getContext('2d'); ctx.scale(dpr, dpr);
    const wait = ms => new Promise(res => setTimeout(res, ms));
    const hint = t => { E.hint.textContent = t; E.hint.hidden = !t; };
    const anim = c => { E.box.classList.remove('drop', 'hit', 'idle'); void E.box.offsetWidth; E.box.classList.add(c); };
    const center = () => { const c = E.box.getBoundingClientRect(); return { x: c.left - R.left + c.width / 2, y: c.top - R.top + c.height * .5, w: c.width }; };
    const bump = el => { const p = el.parentElement; p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); };
    const sparks = (x, y, n, cols, sp, life, conf) => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = sp * (.4 + Math.random()); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (conf ? 3 : 1), g: conf ? .12 : .08, c: cols[i % cols.length], s: conf ? 4 + Math.random() * 5 : 2 + Math.random() * 3, life: life * (60 + Math.random() * 30), rot: Math.random() * 6, conf }); } };
    const loop = () => {
      if (run !== openChestFX.run) return;
      ctx.clearRect(0, 0, W, H); parts = parts.filter(p => p.life > 0);
      for (const p of parts) {
        if (p.fly) { if (p.delay > 0) p.delay--; else { p.x += (p.fly.x - p.x) * .2; p.y += (p.fly.y - p.y) * .2; p.s *= .985; if (Math.abs(p.fly.x - p.x) + Math.abs(p.fly.y - p.y) < 8) p.life = 0; } }
        else { p.vy += p.g; p.x += p.vx; p.y += p.vy; if (p.floor && p.y > p.floor) { p.y = p.floor; if (Math.abs(p.vy) > 2) sfx('clink'); p.vy *= -.42; p.vx *= .7; if (Math.abs(p.vy) < .8) p.vy = 0; } if (p.img) { if (p.x < 14 || p.x > W - 14) p.vx *= -1; } else p.life--; }
        if (p.img) { if (p.img.complete && p.img.naturalWidth) ctx.drawImage(p.img, p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
        else { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot += .2); ctx.globalAlpha = Math.min(1, p.life / 30); ctx.fillStyle = p.c; if (p.conf) ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); else { ctx.beginPath(); ctx.arc(0, 0, p.s, 0, 7); ctx.fill(); } ctx.restore(); }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    const close = () => { if (run !== openChestFX.run) return; openChestFX.run++; $('chestOpen').classList.remove('on'); st.innerHTML = ''; openChestFX.tap = null; done(); };
    openChestFX.skip = close;
    const countUp = (el, it) => new Promise(res => {
      state = 'count'; const t0 = performance.now(), dur = it.n > 5 ? 900 : 350; let lt = 0, fin = false;
      const end = () => { if (fin) return; fin = true; skip = null; el.textContent = '×' + fmt(it.n); state = 'busy'; res(); };
      skip = end;
      const step = now => { if (fin || run !== openChestFX.run) return; const k = Math.min(1, (now - t0) / dur); el.textContent = '×' + fmt(Math.round(it.n * (1 - (1 - k) * (1 - k)))); if (now - lt > 55 && k < 1) { lt = now; sfx('tick'); } if (k < 1) requestAnimationFrame(step); else end(); };
      requestAnimationFrame(step);
    });
    openChestFX.tap = async () => {
      if (state === 'done') return close();
      if (state === 'count' && skip) return skip();
      if (state === 'next' && onNext) { const f = onNext; onNext = null; return f(); }
      if (state !== 'tap') return;
      hits++; anim('hit'); sfx('hit', hits); vibe(10 + hits * 10);
      const c = center(); sparks(c.x, c.y, 8 + hits * 6, [TIER_COL[tier], '#fff'], 3 + hits, .7);
      E.glow.style.opacity = hits * .3; E.crack.style.opacity = hits >= 2 ? 1 : .5;
      if (hits < 3) { hint(hits === 1 ? '¡Otra vez!' : '¡Una más!'); return; }
      state = 'busy'; hint('');
      // estallido: el único fogonazo
      E.flash.classList.add('on'); E.box.classList.remove('idle'); E.chest.classList.add('open'); E.rays.classList.add('on'); E.glow.style.opacity = 1; E.crack.style.opacity = 0;
      sfx('explode'); vibe([30, 30, 60]);
      sparks(c.x, c.y, 60, [TIER_COL[tier], '#ff4f6d', '#ffd23f', '#5fd45a', '#3d9bff', '#a66bff', '#fff'], 8, 1.4, true);
      const floorY = H * .78;
      for (const it of list) {
        const im = cssImg(it.cls), big = !/coin|gem/.test(it.cls);
        for (let i = 0; i < it.pile; i++) parts.push({ img: im, kind: it.cls, x: c.x + (Math.random() - .5) * 20, y: c.y - 10, vx: (Math.random() - .5) * 10, vy: -9 - Math.random() * 7, g: .42, s: big ? 44 : it.cls === 'coin' ? 26 : 24, floor: floorY - Math.random() * 18, life: 1e9 });
        await wait(110); if (run !== openChestFX.run) return;
      }
      await wait(900); if (run !== openChestFX.run) return;
      E.glow.style.opacity = .4; E.box.classList.add('faded');
      for (let i = 0; i < list.length; i++) {
        state = 'next'; hint(i === 0 ? 'Toca para recoger' : 'Toca para el siguiente');
        await new Promise(res => { onNext = res; }); if (run !== openChestFX.run) return;
        hint('');
        const old = st.querySelector('.ccard'); if (old) { old.classList.remove('in'); old.classList.add('out'); setTimeout(() => old.remove(), 350); }
        const it = list[i], card = document.createElement('div');
        card.className = 'ccard in'; card.innerHTML = `<i class="${it.cls}"></i><b>${it.skin ? '¡Nuevo!' : '×0'}</b><small>${it.t}</small>`;
        st.appendChild(card); sfx(it.special ? 'special' : 'card', i); vibe(15);
        const tgtEl = it.to === 'c' ? E.c : it.to === 'g' ? E.g : card, tr = tgtEl.getBoundingClientRect();
        const tgt = { x: tr.left - R.left + (tgtEl === card ? tr.width / 2 : 0), y: tr.top - R.top + (tgtEl === card ? tr.height * .35 : 10) };
        let k = 0; for (const p of parts) if (p.kind === it.cls) { p.fly = tgt; p.delay = 8 + k++ * 2; }
        if (!it.skin) { await countUp(card.querySelector('b'), it); if (run !== openChestFX.run) return; } else await wait(300);
        if (it.to === 'c') { coins += it.n; E.c.textContent = fmt(coins); bump(E.c); sfx('collect', 'coin'); }
        if (it.to === 'g') { gems += it.n; E.g.textContent = gems; bump(E.g); sfx('collect', 'gem'); }
      }
      state = 'next'; hint('Toca para terminar');
      await new Promise(res => { onNext = res; }); if (run !== openChestFX.run) return;
      const old = st.querySelector('.ccard'); if (old) old.remove();
      const d = document.createElement('div'); d.className = 'csum';
      d.innerHTML = `<h3>${CHESTS.find(x => x.cls === tier).name}</h3><div class="g">${list.map(it => `<div><i class="${it.cls}"></i>${it.skin ? 'Cañón' : '×' + fmt(it.n)}</div>`).join('')}</div><span class="ok">¡Genial!</span>`;
      st.appendChild(d); sfx('done'); state = 'done';
    };
    (async () => {
      anim('drop'); await wait(420); if (run !== openChestFX.run) return;
      sfx('land'); vibe(20); const c = center(); sparks(c.x, c.y + c.w * .45, 14, ['#d8c8f5', '#fff', '#b9a6f0'], 2.2, .5);
      await wait(380); if (run !== openChestFX.run) return;
      E.box.classList.add('idle'); state = 'tap'; hint('¡Toca el cofre!');
    })();
  }
  openChestFX.run = 0;
  $('chestOpen').addEventListener('pointerdown', e => { e.preventDefault(); Audio.init(); if (openChestFX.tap) openChestFX.tap(); });

  function closeDaily(skipCb) {
    $('daily').classList.remove('on'); $('dWeek').style.display = '';
    updateDailyBadges();
    const cb = dailyCb; dailyCb = null; if (cb && !skipCb) cb();
  }
  // se abre sola una vez al día: al entrar al juego (portada, a los 1,5 s), o si no, al llegar al mapa. Nunca a mitad de partida.
  function dailyAutoDue() { return dailyEligible() && dailyStatus().st !== 'done' && dailySave().auto !== dayKey(); }
  function maybeAutoDaily(then) {
    if (dailyAutoDue()) { dailySave().auto = dayKey(); persist(); openDaily(then || null); return true; }
    if (then) then();
    return false;
  }
  // al entrar al juego (o al volver a él otro día) se abre sola a los 1,5 s, si no estás haciendo otra cosa
  let dailyTimer = 0;
  function autoDailySoon() {
    clearTimeout(dailyTimer);
    dailyTimer = setTimeout(() => {
      const busy = document.querySelector('.screen.dim.on') || $('pass').classList.contains('on') || $('ad').classList.contains('on');
      if ((G.mode === 'title' || G.mode === 'map') && !busy && dailyAutoDue()) {
        dailySave().auto = dayKey(); persist();
        Audio.special();
        openDaily(G.mode === 'title' ? () => { if (G.mode === 'title') goMap(); } : null);
      }
    }, 1500);
  }
  // aspecto del cañón
  function applySkin() {
    const k = (save.skins && save.skins.equip) || 'classic', sk = SKINS[k] || SKINS.classic;
    if (k !== 'classic' && !stats().skin) { stats().skin = 1; persist(); }
    cannonMat.color.set(sk.color); cannonMat.metalness = sk.metal; cannonMat.roughness = sk.rough;
    cannonMat.map = sk.map === 'fire' ? fireTex : sk.map ? rainbowTex : null;
    cannonMat.emissive.set(sk.glow || 0x000000); cannonMat.needsUpdate = true;
  }

  // ---------------- botones ----------------
  const on = (id, fn) => $(id).addEventListener('click', () => { Audio.init(); Audio.click(); fn(); });
  on('btnPlay', () => { goMap(); if (save.unlocked === 1 && !save.stars[1]) openPre(1); else maybeAutoDaily(); });
  on('btnDaily', () => openDaily(null));
  on('dX', () => { if (!$('dX').hidden) closeDaily(G.mode === 'title'); });   // la X cierra y te deja donde estabas
  on('btnDailyT', () => openDaily(() => { if (G.mode === 'title') goMap(); }));
  on('sNotif', () => { const d = dailySave(); d.notif = d.notif === false; persist(); refreshToggles(); scheduleReminder(); });
  on('btnHome', goTitle);
  on('btnShop', () => openShop()); on('btnShopT', () => openShop());
  document.querySelectorAll('.wallet .coins').forEach(el => el.addEventListener('click', () => { Audio.init(); Audio.click(); openShop(el.querySelector('.gem') ? 'gems' : 'coins'); }));
  on('btnPass', openPass); on('btnPassT', openPass);
  on('btnMis', openMissions); on('btnMisT', openMissions);
  on('misBack', () => (G.mode === 'title' ? goTitle() : goMap()));
  on('misShop', () => openShop('gems'));
  on('btnShare', shareGame);
  on('btnAddFriend', () => {
    const err = addFriend($('friendCode').value);
    $('friendMsg').style.color = err ? '#d6304a' : '#22914b';
    $('friendMsg').textContent = err || '¡Amigo añadido! Ya tienes ' + save.friends.length + (save.friends.length === 1 ? ' amigo.' : ' amigos.');
    if (!err) { $('friendCode').value = ''; Audio.win(); }
    renderMissions();
  });
  on('passBack', () => (G.mode === 'title' ? goTitle() : goMap()));
  on('passShop', () => openShop('gems'));
  on('passBuy', buyPro);
  on('passClaimAll', claimAll);
  on('shopClose', () => { $('shop').classList.remove('on'); if ($('pass').classList.contains('on')) openPass(); });
  on('btnSetT', () => { refreshToggles(); $('settings').classList.add('on'); });
  on('sClose', () => $('settings').classList.remove('on'));
  on('sTest', toggleTest);
  on('sReset', () => {
    const b = $('sReset');
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Toca otra vez para borrar todo'; setTimeout(() => { delete b.dataset.armed; b.textContent = 'Borrar progreso'; }, 3000); return; }
    delete b.dataset.armed; b.textContent = 'Borrar progreso';
    save = DEFAULT_SAVE(); persist(); setCoins(); toast('Progreso borrado');
  });
  on('preBack', () => { $('pre').classList.remove('on'); if (G.mode !== 'map') goMap(); });
  on('preGo', () => {
    const L = byId(G.preId);
    if (L.bonus && save.bonusDone && save.bonusDone[L.id]) {
      if (save.coins < L.replayCost) { toast(`Te faltan ${L.replayCost - save.coins} monedas para repetir este nivel extra`); openShop(); return; }
      save.coins -= L.replayCost; setCoins(); Audio.coin();
    }
    const bs = streakBoosters().slice();
    for (const k of Object.keys(preSel)) if (preSel[k] && save.boosters[k] > 0) { save.boosters[k]--; bs.push(k); }
    persist(); startLevel(G.preId, bs);
  });
  // caja misteriosa: premio al azar y, a veces, doble
  function openMystery(done) {
    G.mystery = false;
    const roll = Math.random(), r = {};
    if (roll < 0.4) r.coins = 60 + ((Math.random() * 10) | 0) * 10;
    else if (roll < 0.6) { r.coins = 40; r.bomb = 1; }
    else if (roll < 0.75) { r.coins = 40; r.rainbow = 1; }
    else if (roll < 0.9) { r.gems = 2 + ((Math.random() * 2) | 0); }
    else { r.coins = 50; r.golden = 1; }
    const x2 = Math.random() < 0.2;
    if (x2) for (const k in r) r[k] *= 2;
    save.coins += r.coins || 0; save.gems = (save.gems || 0) + (r.gems || 0);
    for (const k of ['bomb', 'rainbow', 'golden']) if (r[k]) save.boosters[k] = (save.boosters[k] || 0) + r[k];
    persist(); setCoins();
    toast(x2 ? '¡Caja misteriosa con premio DOBLE!' : '¡Caja misteriosa!', 1800);
    openChestFX(x2 ? 'epic' : 'crystal', r, done);
  }
  const afterMystery = f => () => (G.mystery ? openMystery(f) : f());
  on('winNext', afterMystery(() => (G.newBonus ? (f => f()) : maybeInterstitial)(() => {
    const L = G.level;
    goMap();
    maybeAutoDaily(() => {
      if (G.newBonus) { openPre(G.newBonus); return; }
      const n = L.bonus ? Math.min(save.unlocked, LEVELS.length) : L.id + 1;
      if (n <= LEVELS.length) openPre(n);
    });
  })));
  on('winMap', afterMystery(() => maybeInterstitial(() => { goMap(); maybeAutoDaily(); })));
  $('btnGold').addEventListener('pointerdown', e => {
    e.stopPropagation(); Audio.init();
    const sim = G.sim;
    if (G.mode !== 'play' || G.paused || !sim || sim.state !== 'play' || !(save.boosters.golden > 0) || sim.queue[0] === 'golden') return;
    save.boosters.golden--; stats().golden++; persist();
    sim.queue.unshift('golden'); lastTray = ''; updateTray();
    centerText('BOLA DORADA CARGADA', '#ffe27a', 24); Audio.special(); vibe(25);
  });
  on('winBalls', () => showRewarded(ok => {
    if (!ok || !G.sim || !G.sim.resume(3)) return;
    save = G.saveBefore; persist(); setCoins();   // las monedas y estrellas se darán al terminar de verdad
    G.extraUsed = true; G.winShown = false; G.winAt = 0; G.ended = false; lastTray = '';
    hideAll(); $('btnFinish').hidden = false;
    centerText('+3 BOLAS', '#fff', 32);
  }));
  const paidReplay = L => L.bonus && save.bonusDone && save.bonusDone[L.id];
  on('winRetry', () => { if (paidReplay(G.level)) { goMap(); openPre(G.level.id); } else { hideAll(); startLevel(G.level.id, []); } });
  on('winDouble', () => showRewarded(ok => { if (ok) { save.coins += G.pendingCoins; persist(); $('winCoins').textContent = '+' + (G.pendingCoins * 2); $('winDouble').disabled = true; Audio.coin(); } }));
  on('loseAd', () => showRewarded(ok => { if (ok) continueWithBalls(); }));
  on('loseCoins', () => { const cost = +$('loseCost').textContent; if (save.coins >= cost) { save.coins -= cost; persist(); continueWithBalls(); } });
  on('loseGift', () => { if (G.giftWorld) { save.casiFree = save.casiFree || {}; save.casiFree[G.giftWorld] = true; persist(); } continueWithBalls(); });
  on('loseStarter', () => { const it = SHOP.find(x => x.id === 'starter'); it.grant(); persist(); setCoins(); Audio.coin(); toast('Compra de prueba hecha (no se ha cobrado nada)'); showLose(); });
  on('loseRetry', () => { save.streak = 0; persist(); hideAll(); G.mode = 'pre'; openPre(G.level.id); });
  on('loseMap', () => { save.streak = 0; persist(); goMap(); });
  on('ncOk', () => { Audio.click(); closeNewCard(); });
  on('btnFinish', () => { if (G.mode === 'play' && G.sim && G.sim.finish()) handleEvents(); });
  on('btnPause', () => { if (G.mode !== 'play') return; G.paused = true; refreshToggles(); show('pause'); });
  on('pResume', () => { G.paused = false; hideAll(); });
  on('pRetry', () => { if (paidReplay(G.level)) { goMap(); openPre(G.level.id); } else { hideAll(); startLevel(G.level.id, []); } });
  on('pMap', goMap);
  const toggle = k => { save[k] = !save[k]; persist(); refreshToggles(); if (k === 'music') { if (save.music) Audio.startMusic(); else Audio.stopMusic(); } };
  on('pSound', () => toggle('sound')); on('sSound', () => toggle('sound'));
  on('pVibe', () => toggle('vibe')); on('sVibe', () => toggle('vibe'));
  on('pMusic', () => toggle('music')); on('sMusic', () => toggle('music'));
  function refreshTest() {
    if (!TEST_MODE) return;
    $('sTest').hidden = false; $('sTestNote').hidden = false;
    $('sTest').textContent = save.testAll ? 'Modo prueba: volver a mi progreso' : 'Modo prueba: desbloquear todo';
  }
  function toggleTest() {
    if (!TEST_MODE) return;
    if (!save.testAll) { save.testPrev = save.unlocked; save.testAll = true; save.unlocked = LEVELS.length; toast('Modo prueba: los ' + LEVELS.length + ' niveles y todos los niveles extra están abiertos', 3000); }
    else { save.testAll = false; save.unlocked = Math.max(1, Math.min(save.testPrev || 1, LEVELS.length)); delete save.testPrev; toast('Has vuelto a tu progreso normal'); }
    persist(); refreshTest(); if (G.mode === 'map') renderMap();
  }
  function refreshToggles() {
    refreshTest();
    for (const [k, ids] of [['sound', ['pSound', 'sSound']], ['vibe', ['pVibe', 'sVibe']], ['music', ['pMusic', 'sMusic']]])
      for (const id of ids) $(id).style.opacity = save[k] ? 1 : 0.35;
    $('sNotif').textContent = 'Aviso de racha: ' + (dailySave().notif === false ? 'no' : 'sí');
    $('sState').textContent = `Sonido ${save.sound ? 'sí' : 'no'} · Vibración ${save.vibe ? 'sí' : 'no'} · Música ${save.music ? 'sí' : 'no'}`;
  }
  function maybeInterstitial(next) {
    const now = Date.now();
    if (!save.adsRemoved && G.level && !G.level.bonus && G.level.id >= 10 && now - (save.lastInter || 0) > 180000) { save.lastInter = now; persist(); showRewarded(() => next()); }
    else next();
  }

  // integración con la app Android
  window.ChromaBack = () => {
    const open = id => $(id).classList.contains('on');
    if (open('chestOpen')) { if (openChestFX.skip) openChestFX.skip(); return true; }
    if (open('newCard')) { closeNewCard(); return true; }
    if (open('shop')) { $('shop').classList.remove('on'); return true; }
    if (open('daily')) { if (!$('dBtns').innerHTML) return true; closeDaily(true); return true; }
    if (open('settings')) { $('settings').classList.remove('on'); return true; }
    if (open('missions')) { G.mode === 'title' ? goTitle() : goMap(); return true; }
    if (open('pre')) { $('pre').classList.remove('on'); if (G.mode !== 'map') goMap(); return true; }
    if (G.mode === 'play') {
      if (open('pause')) { G.paused = false; hideAll(); return true; }
      if (G.sim && G.sim.state === 'play') { G.paused = true; refreshToggles(); show('pause'); return true; }
      goMap(); return true;
    }
    if (G.mode === 'map') { goTitle(); return true; }
    return false;
  };
  window.ChromaPause = () => { if (G.mode === 'play' && G.sim && G.sim.state === 'play') { G.paused = true; refreshToggles(); show('pause'); } Audio.stopMusic(); };
  window.ChromaResume = () => { if (save.music) Audio.startMusic(); autoDailySoon(); };

  // ---------------- bucle ----------------
  let last = performance.now();
  let manual = false;
  // calidad adaptable: si el móvil no llega a ~45 fps, baja la resolución interna
  let perfAcc = 0, perfN = 0;
  function adaptQuality(dt) {
    perfAcc += dt; perfN++;
    if (perfN < 90) return;
    const avg = perfAcc / perfN; perfAcc = 0; perfN = 0;
    if (avg > 0.022 && pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); renderer.setSize(W, H, false); }
  }
  // menús a pantalla completa (mapa, pase, misiones): el 3D de fondo se pinta a 20 fps y se para mientras deslizas,
  // para que el desplazamiento vaya fluido en móviles modestos
  let scrollBusy = 0, liteN = 0;
  const busy = () => { scrollBusy = performance.now() + 350; };
  for (const id of ['mapList', 'passList', 'misList']) for (const ev of ['scroll', 'touchstart', 'touchmove', 'wheel']) $(id).addEventListener(ev, busy, { passive: true });
  const liteMenu = () => $('map').classList.contains('on') || $('pass').classList.contains('on') || $('missions').classList.contains('on');
  function frame(now) {
    if (manual) { last = now; requestAnimationFrame(frame); return; }
    const lite = liteMenu();
    if (lite && (now < scrollBusy || (liteN = (liteN + 1) % 3) !== 0)) { requestAnimationFrame(frame); return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!lite) adaptQuality(dt);
    tick(dt);
    requestAnimationFrame(frame);
  }
  function tick(dt, noRender) {
    G.t += dt;
    if (G.slowT > 0) { G.slowT -= dt; G.timeScale = 0.35; } else G.timeScale = lerp(G.timeScale, 1, Math.min(1, dt * 3));
    G.shake = Math.max(0, G.shake - dt * 1.6);
    G.recoil = Math.max(0, G.recoil - dt * 4);
    flashLight.intensity = Math.max(0, flashLight.intensity - dt * 220);
    const sim = G.sim;
    if (sim && !G.paused) {
      if (G.mode === 'play') {
        sim.update(dt * G.timeScale);
        handleEvents();
        if (G.level.boss && window.Bosses) window.Bosses.tick(dt * G.timeScale);
        updateWeatherChip();
        // cámara lenta cuando cae la última pieza
        if (!G.lastSlow && !G.level.boss && sim.state === 'play' && sim.progress() >= 0.97) { G.lastSlow = true; G.slowT = Math.max(G.slowT, 1.1); }
        // racha: el cohete de salida cruza la estructura al empezar
        if (G.rocketStart && G.introT <= 0 && !$('newCard').classList.contains('on')) { G.rocketStart = false; rocketStrike(); }
        if (G.debutT > 0 && (G.debutT -= dt) <= 0 && G.level.debut) { save.seenDebut[G.level.debut] = true; persist(); openNewCard(G.level); }
        if (G.debutRing) { const k = 1 + Math.sin(G.t * 6) * 0.12; G.debutRing.scale.set(k, k, 1); if (G.firstShot) { G.debutRing.parent && G.debutRing.parent.remove(G.debutRing); G.debutRing = null; } }
        if (sim.state === 'won' && !G.winShown && G.t - G.winAt > 1.6) finishWin();
        if (sim.state === 'lost' && !G.ended) { G.endT -= dt; if (G.endT <= 0) { G.ended = true; showLose(); } }
        updateHud(dt);
      } else if (G.mode === 'title' && TD.phase === 'shot') { sim.update(dt); titleEvents(); }
      else { sim.update(dt * 0.0); sim.events.length = 0; }
      syncView(dt);
    }
    updateDebris(dt * (G.paused ? 0 : 1)); updateSprites(dt); updateRings(dt); updateBeams(dt); updateFlyers(dt);
    for (const c of clouds) { c.position.x += c.userData.v * dt; if (c.position.x > 70) c.position.x = -70; }
    for (const b of balloons) b.position.y = b.userData.y0 + Math.sin(G.t * 0.6 + b.userData.ph) * 0.6;
    seaNormal.offset.set(G.t * 0.004, G.t * 0.006);
    if (BIOMES[biome].update) BIOMES[biome].update(dt);
    Weather.update(dt);
    // cámara: en menús gira despacio alrededor; jugando, fija tras el cañón con temblor
    if (G.mode === 'play') {
      const intro = G.introT > 0 ? (G.introT -= dt, Math.max(0, G.introT) / 1.2) : 0;
      camera.position.copy(G.camBase);
      camera.position.y += intro * 3; camera.position.z += intro * 4;
      if (G.shake > 0) { camera.position.x += rnd(-1, 1) * G.shake * 0.4; camera.position.y += rnd(-1, 1) * G.shake * 0.4; }
      camera.lookAt(G.camLook);
      cannonG.visible = true;
      updateCannon(dt);
    } else if (G.mode === 'title') {
      // portada: la cámara se balancea un poco delante de la estructura (la bola llega desde delante)
      titleDemo(dt);
      G.orbit = Math.sin(G.t * 0.22) * 0.42;
      const r = G.camBase.z * 0.95;
      camera.position.set(Math.sin(G.orbit) * r, G.camBase.y + 1.5, Math.cos(G.orbit) * r);
      if (G.shake > 0) { camera.position.x += rnd(-1, 1) * G.shake * 0.3; camera.position.y += rnd(-1, 1) * G.shake * 0.3; }
      camera.lookAt(G.camLook);
      cannonG.visible = false;
    } else {
      G.orbit += dt * 0.12;
      const r = G.camBase.z * 0.95;
      camera.position.set(Math.sin(G.orbit) * r, G.camBase.y + 1.5, Math.cos(G.orbit) * r);
      camera.lookAt(G.camLook);
      cannonG.visible = false;
    }
    drawAim();
    if (!noRender) { titleView(); renderer.render(scene, camera); }
  }

  // los jefes (bosses.js) usan estas piezas del juego
  window.RRGame = { G, scene, world, camera, openChestFX, floatText, spawnSprite, spawnDebris, spawnRing, Audio, vibe, persist, setCoins,
    refreshTray: () => { lastTray = ''; }, get save() { return save; },
    // el jefe ha caído: el nivel se gana con las bolas que quedaban
    bossWin(left) { const sim = G.sim; if (!sim || G.mode !== 'play') return; sim.queue = Array.from({ length: left }, () => 'heavy'); sim.goalReached = true; sim.finish(); G.winAt = G.t - 1; } };
  // inicio
  resize();
  ensureSeason(); applySkin();
  goTitle(); setCoins(); scheduleReminder();
  requestAnimationFrame(() => requestAnimationFrame(autoDailySoon));   // cuenta desde que la portada ya se ve
  requestAnimationFrame(frame);
  window.ChromaGame = { G, startLevel, tick, manual: v => { manual = v; }, shiftDays: n => { dayShift += n; updateDailyBadges(); return dayKey(); }, dailyStatus, render: () => { titleView(); renderer.render(scene, camera); }, save: () => save, camera, renderer, LEVELS };
})();
