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
  // probador: el juego publicado (sin TEST_MODE) muestra el modo prueba si el panel ha marcado a este jugador (testers/{uid})
  const testOn = () => TEST_MODE || !!save.tester;

  // ---------------- guardado ----------------
  const SAVE_KEY = 'chromacrash3d.v1';
  const DEFAULT_SAVE = () => ({ unlocked: 1, stars: {}, best: {}, coins: 300, boosters: { bomb: 2, rainbow: 1, extra: 1, golden: 0 }, gems: 0, gemDry: 0, gemRoll: null, bonusGemRoll: {}, pass: null, skins: { owned: ['classic'], equip: 'classic' }, bskin: { own: ['clasica'], eq: 'clasica' }, trail: { own: ['ninguna'], eq: 'ninguna' }, can: { lv: 1, own: ['base'], eq: 'base' }, streak: 0, sound: true, vibe: true, music: true, adsRemoved: false, starter: false, played: 0, lastInter: 0 });
  let save;
  // si la partida guardada se ha estropeado (el móvil se apagó mientras se escribía), se usa la copia de reserva
  try { save = Object.assign(DEFAULT_SAVE(), JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); }
  catch (e) { try { save = Object.assign(DEFAULT_SAVE(), JSON.parse(localStorage.getItem(SAVE_KEY + '.bak') || '{}')); } catch (e2) { save = DEFAULT_SAVE(); } }
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
  // enganches para retencion.js (cofre gratis, logros, desafío semanal, regalos, bienvenida y mini-eventos)
  const RH = (n, d) => { try { const R = window.Retencion; return R && R[n] ? R[n](d) : undefined; } catch (e) { console.warn('[RR ret]', n, e); } };
  let bakAt = 0;
  function persist() {
    try {
      const j = JSON.stringify(save); localStorage.setItem(SAVE_KEY, j);
      if (Date.now() - bakAt > 60e3) { bakAt = Date.now(); localStorage.setItem(SAVE_KEY + '.bak', j); }   // copia de reserva, como mucho 1 por minuto
    } catch (e) { /* sin almacenamiento */ }
    if (window.Social) window.Social.dirty();
  }

  // ---------------- audio ----------------
  const Audio = (() => {
    let ac = null, master = null, sfx = null, mus = null, noiseBuf = null, musicOn = false, musicTimer = null, musicStyle = 'normal';
    let popRun = 0, popT = 0, thudT = 0, glassT = 0;
    function init() {
      if (ac) { if (ac.state !== 'running' && ac.state !== 'closed' && ac.resume) ac.resume().catch(() => {}); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain(); master.gain.value = 0.8; master.connect(ac.destination);
      sfx = ac.createGain(); sfx.gain.value = 0.9; sfx.connect(master);
      mus = ac.createGain(); mus.gain.value = 0.22; mus.connect(master);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 1.2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // la música arranca cuando el audio está de verdad en marcha (en la app, al abrir; en el navegador, al primer toque)
      ac.onstatechange = () => { if (ac.state === 'running' && save.music) startMusic(); };
      if (ac.state === 'running' && save.music) startMusic();
      else if (ac.state === 'suspended' && ac.resume) ac.resume().catch(() => {});
    }
    const ok = () => ac && save.sound && ac.state === 'running';
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
        if (now - popT < 0.03) { popRun = Math.min(popRun + 1, 14); return; }   // varios en el mismo instante: un solo sonido (menos carga al reventar un grupo)
        popT = now; popRun = Math.min(popRun + 1, 14);
        const semis = popRun + (chain - 1) * 3;
        const f = 520 * Math.pow(2, semis / 12);
        tone(f, 0.12, 'sine', 0.32, 1.6); tone(f * 2, 0.06, 'triangle', 0.08, 1.2);
      },
      // golpes y cristales: como mucho uno cada ~45 ms (en un gran derrumbe llegaban decenas por segundo, cada uno con
      // varios nodos de audio nuevos; con menos suena igual y el móvil va más desahogado)
      thud(v, stone) { if (!ok()) return; const now = ac.currentTime; if (now - thudT < 0.045) return; thudT = now; const vol = Math.min(0.5, 0.08 + v * 0.05); noise(0.12, vol, stone ? 900 : 500, 120); tone(stone ? 90 : 120, 0.12, 'sine', vol * 0.8, 0.6); },
      glass() { if (!ok()) return; const now = ac.currentTime; if (now - glassT < 0.06) return; glassT = now; for (let i = 0; i < 5; i++) tone(1800 + Math.random() * 2400, 0.18, 'triangle', 0.08, 0.9, i * 0.018); noise(0.25, 0.25, 4000, 9000, 'highpass'); },
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
      blub() { if (!ok()) return; tone(380, 0.08, 'sine', 0.13, 1.9); tone(470, 0.08, 'sine', 0.11, 1.9, 0.11); tone(590, 0.09, 'sine', 0.09, 2, 0.22); },   // burbujas (el pez del arrecife)
      horn() { if (!ok()) return; tone(165, 0.9, 'sawtooth', 0.08, 0.98); tone(220, 0.9, 'triangle', 0.08, 0.98); },
      // risa de bruja: «ji-ji-ji-ji» con voz nasal (diente de sierra por dos filtros de formante) que va bajando
      cackle() {
        if (!ok()) return;
        const t0 = ac.currentTime + 0.02, n = 9;
        for (let i = 0; i < n; i++) {
          const t = t0 + i * 0.105 + (i > 5 ? (i - 5) * 0.02 : 0), f = 620 - i * 26 + (i % 2 ? 40 : 0);
          const o = ac.createOscillator(), g = ac.createGain(), f1 = ac.createBiquadFilter(), f2 = ac.createBiquadFilter(), v = ac.createOscillator(), vg = ac.createGain();
          o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 1.12, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
          v.frequency.value = 28; vg.gain.value = f * 0.04; v.connect(vg); vg.connect(o.frequency);
          f1.type = 'bandpass'; f1.frequency.value = 900 + (i % 2) * 300; f1.Q.value = 5; f2.type = 'bandpass'; f2.frequency.value = 2600; f2.Q.value = 6;
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.095);
          o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(sfx);
          o.start(t); v.start(t); o.stop(t + 0.12); v.stop(t + 0.12);
        }
        tone(1800, 0.5, 'sine', 0.03, 0.6, 0.05);
      },
      // relámpago: chasquido y, a veces, trueno que retumba
      thunder(big) {
        if (!ok()) return;
        noise(0.12, 0.25, 6000, 2500, 'highpass');
        if (big) { noise(1.6, 0.55, 500, 60, 'lowpass', 0.12 + Math.random() * 0.25); tone(48, 1.4, 'sine', 0.35, 0.7, 0.15); }
      },
      // cascabeles del trineo: tintineo agudo con un poco de ruido metálico
      bells() {
        if (!ok()) return;
        for (let i = 0; i < 14; i++) { const t = i * 0.09 + (i % 2) * 0.02; tone(2600 + (i % 3) * 420, 0.16, 'triangle', 0.07, 1.003, t); tone(5200 + (i % 3) * 840, 0.08, 'sine', 0.025, 1, t); noise(0.05, 0.05, 7000, 9000, 'highpass', t); }
      },
      setStyle(st) { if (st === musicStyle) return; musicStyle = st; if (musicOn) { stopMusic(); startMusic(); } },
      startMusic, stopMusic,
    };
    // música generativa suave (4 acordes en bucle)
    function startMusic() {
      if (!ac || musicOn || ac.state !== 'running') return;
      musicOn = true;
      if (musicStyle === 'spooky') { spookyMusic(); return; }
      if (musicStyle === 'xmas') { xmasMusic(); return; }
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
    // Halloween: la menor armónica, órgano grave, arpegio de clavecín y campanita (estilo «casa encantada» simpática)
    function spookyMusic() {
      const chords = [[0, 3, 7], [-4, 0, 3], [-7, -4, 0], [-1, 2, 5, 8]];     // Lam · Fa · Rem · Mi7 (con la sensible)
      const root = 220, beat = 60 / 88;
      const mel = [[12, 15, 19, 18, 19, 15, 12, 11], [8, 12, 15, 12, 8, 7, 8, 12], [5, 8, 12, 8, 5, 3, 5, 8], [11, 14, 17, 20, 23, 20, 17, 14]];
      let bar = 0;
      const playBar = () => {
        if (!musicOn) return;
        const ch = chords[bar % 4], fr = n => root * Math.pow(2, n / 12);
        tone(fr(ch[0] - 24), beat * 4, 'triangle', 0.4, 1, 0, mus);
        for (const n of ch.slice(0, 3)) tone(fr(n - 12), beat * 3.6, 'sine', 0.09, 1, 0.02, mus);
        const m = mel[bar % 4];
        for (let i = 0; i < 8; i++) tone(fr(m[i]), beat * 0.42, 'square', 0.035, 0.995, i * beat * 0.5, mus);
        if (bar % 2 === 1) tone(fr(ch[0] + 24), beat * 2, 'sine', 0.06, 1, beat * 3, mus);
        bar++;
        musicTimer = setTimeout(playBar, beat * 4 * 1000);
      };
      playBar();
    }
    // Navidad: Sol mayor alegre (Sol · Do · Re · Sol), campanitas, celesta y cascabeles en cada pulso
    function xmasMusic() {
      const chords = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]];
      const root = 196, beat = 60 / 112;
      const mel = [[12, 14, 16, 19, 16, 14, 12, 7], [17, 16, 14, 12, 14, 16, 17, 21], [19, 18, 19, 21, 19, 14, 11, 14], [16, 14, 12, 11, 12, 16, 19, 24]];
      let bar = 0;
      const playBar = () => {
        if (!musicOn) return;
        const ch = chords[bar % 4], fr = n => root * Math.pow(2, n / 12);
        tone(fr(ch[0] - 12), beat * 2, 'triangle', 0.32, 1, 0, mus); tone(fr(ch[2] - 12), beat * 2, 'triangle', 0.26, 1, beat * 2, mus);
        for (const n of ch) tone(fr(n), beat * 3.6, 'sine', 0.05, 1, 0.02, mus);
        const m = mel[bar % 4];
        for (let i = 0; i < 8; i++) { tone(fr(m[i] + 12), beat * 0.4, 'triangle', 0.09, 1, i * beat * 0.5, mus); tone(fr(m[i] + 24), beat * 0.2, 'sine', 0.025, 1, i * beat * 0.5, mus); }
        for (let i = 0; i < 4; i++) noise(0.06, 0.03, 7000, 9000, 'highpass', i * beat + 0.01);
        if (bar % 4 === 3) tone(fr(ch[0] + 24), beat * 1.5, 'sine', 0.06, 1, beat * 3, mus);
        bar++;
        musicTimer = setTimeout(playBar, beat * 4 * 1000);
      };
      playBar();
    }
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
  const CSSB = { r: 'bR', b: 'bB', g: 'bG', y: 'bY', p: 'bP', bomb: 'bBomb', rainbow: 'bRainbow', heavy: 'bHeavy', golden: 'bGolden', sand: 'bSand' };
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
      if (mood === 'cry') {                                   // llorando (Cubi en la oferta de ayuda): ojos cerrados, cejas tristes y lagrimones
        g.strokeStyle = ink; g.lineWidth = 7; g.lineCap = 'round';
        g.beginPath(); g.arc(38, 60, 13, Math.PI * 1.1, Math.PI * 1.9); g.moveTo(103, 60 - 13 * Math.sin(Math.PI * 0.1)); g.arc(90, 60, 13, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
        g.lineWidth = 4; g.beginPath(); g.moveTo(22, 36); g.lineTo(48, 28); g.moveTo(106, 36); g.lineTo(80, 28); g.stroke();
        for (const x of [36, 92]) {
          const gr = g.createLinearGradient(0, 60, 0, 124); gr.addColorStop(0, 'rgba(120,205,255,0.95)'); gr.addColorStop(1, 'rgba(70,160,255,0.85)');
          g.fillStyle = gr; g.beginPath(); g.moveTo(x - 6, 64); g.quadraticCurveTo(x - 9, 100, x - 4, 126); g.lineTo(x + 6, 126); g.quadraticCurveTo(x + 10, 100, x + 6, 64); g.closePath(); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(x - 2, 80, 2, 6, 0, 0, TAU); g.fill();
        }
        g.fillStyle = ink; g.beginPath(); g.moveTo(46, 102); g.quadraticCurveTo(64, 76, 82, 102); g.quadraticCurveTo(64, 94, 46, 102); g.fill();
        g.fillStyle = '#ff6b8a'; g.beginPath(); g.ellipse(64, 98, 7, 3, 0, 0, TAU); g.fill();
        return;
      }
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
  // luz de apoyo siempre presente (apagada casi siempre): la usan la cueva de cristal y el gólem. Si estas luces se
  // añadieran y quitaran, cambiaría el número de luces de la escena y el móvil tendría que recompilar todos los shaders
  // de golpe (un parón de 1-3 s al entrar en esos niveles)
  const auxLight = new THREE.PointLight(0xffffff, 0, 1, 2); auxLight.position.set(0, -50, 0); scene.add(auxLight);

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
  // Partículas de ambiente (nieve, lluvia, ascuas, luciérnagas…) movidas por la tarjeta gráfica: antes el procesador
  // recorría miles de puntos en cada fotograma y volvía a subirlos enteros; ahora cada punto calcula su posición a partir
  // del tiempo (uT) y unas velocidades. o = { vy, vyStep, vyMod, ymin, yr, vx, vxStep, vxMod, xmin, xr, swx, swxF, swy, swyF }
  // (vyStep·(i % vyMod) varía la velocidad por partícula; yr/xr > 0 = vuelve a entrar por el otro lado; sw = vaivén)
  const GPU_T = { value: 0 };
  function gpuMotion(obj, o) {
    const geo = obj.geometry, pos = geo.attributes.position, per = obj.isLineSegments ? 2 : 1, seg = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { const k = i - (i % per); seg[i * 3] = pos.getX(k); seg[i * 3 + 1] = pos.getY(k); seg[i * 3 + 2] = pos.getZ(k); }
    geo.setAttribute('aSeg', new THREE.BufferAttribute(seg, 3));
    const U = {
      uT: GPU_T, uPer: { value: per },
      uY: { value: new THREE.Vector4(o.vy || 0, o.vyStep || 0, o.vyMod || 1, 0) }, uYr: { value: new THREE.Vector2(o.ymin || 0, o.yr || 0) },
      uX: { value: new THREE.Vector4(o.vx || 0, o.vxStep || 0, o.vxMod || 1, 0) }, uXr: { value: new THREE.Vector2(o.xmin || 0, o.xr || 0) },
      uSw: { value: new THREE.Vector4(o.swx || 0, o.swy || 0, o.swxF || 1, o.swyF || 1) },
    };
    const m = obj.material; m.userData.gm = U;
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'attribute vec3 aSeg; uniform float uT, uPer; uniform vec4 uY, uX, uSw; uniform vec2 uYr, uXr;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
        vec3 transformed = vec3(position);
        float gid = floor(float(gl_VertexID) / uPer);
        float vy = uY.x + uY.y * mod(gid, uY.z), vx = uX.x + uX.y * mod(gid, uX.z);
        float ny = aSeg.y + vy * uT, nx = aSeg.x + vx * uT;
        if (uYr.y > 0.0) ny = uYr.x + mod(ny - uYr.x, uYr.y);
        if (uXr.y > 0.0) nx = uXr.x + mod(nx - uXr.x, uXr.y);
        transformed.x += nx - aSeg.x + uSw.x * sin(uT * uSw.z + gid);
        transformed.y += ny - aSeg.y + uSw.y * sin(uT * uSw.w + gid);`);
    };
    m.customProgramCacheKey = () => 'gpuMotion';
    m.needsUpdate = true;
    obj.frustumCulled = false;
    return U;
  }
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
    flakes.material.sizeAttenuation = true; env.add(flakes); gpuMotion(flakes, { vy: -1.4, ymin: -6, yr: 32, swx: 0.3 });
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
      update: () => {},
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
    const embers = points(260, 0, 0xffa040, 0.14, () => [rnd(-25, 25), rnd(-7, 18), rnd(-40, 12)]); gpuMotion(embers, { vy: 0.8, vyStep: 0.2, vyMod: 5, ymin: -7, yr: 25 });
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
    const glow = { intensity: 30 };   // la luz morada de la cueva es la luz de apoyo (auxLight), que no se quita nunca
    scene.add(env); env.visible = false;
    const ame = tiles('#4a2f7a', 'rgba(190,150,255,0.55)', 6, (g, x, y, s) => { if (Math.random() < 0.3) { g.fillStyle = 'rgba(127,230,255,0.4)'; g.fillRect(x + s * 0.3, y + s * 0.3, s * 0.4, s * 0.4); } });
    const under = new THREE.Group();
    const geo = new THREE.Mesh(new THREE.IcosahedronGeometry(C.ISLAND_R * 0.95, 1), M('geode', { color: 0x4a3a6a, roughness: 0.9, flatShading: true })); geo.scale.y = 0.9; geo.position.y = -4.6; under.add(geo);
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; const c = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3, 6), M('cry' + (i % 4), {})); c.position.set(Math.cos(a) * 4.6, -2.2, Math.sin(a) * 4.6); c.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); under.add(c); }
    const platform = makePlatform({ top: new THREE.MeshStandardMaterial({ map: ame, roughness: 0.6 }), side: M('crside', { color: 0x3a2a5a, roughness: 0.9 }), trim: new THREE.MeshStandardMaterial({ color: 0x7fe6ff, emissive: 0x3fc8ff, emissiveIntensity: 1.2 }), under,
      post: (i) => { const p = new THREE.Group(); const c = new THREE.Mesh(new THREE.ConeGeometry(0.22, 3.2, 6), M('cry' + (i % 4), {})); c.position.y = 1.6; p.add(c); return p; } });
    return { env: [env], platform, noSun: true, light: { color: 0xb88aff, intensity: 30, distance: 40, pos: [0, 8, -6] },
      update: (dt) => { sparks.rotation.y += dt * 0.02; glow.intensity = 26 + Math.sin(G.t * 1.3) * 6; if (auxLight.userData.owner === 'biome') auxLight.intensity = glow.intensity; },
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
    const flies = points(260, 0, 0xfff27a, 0.35, () => [rnd(-30, 30), rnd(-5, 14), rnd(-40, 12)]); flies.material.sizeAttenuation = true; flies.material.blending = THREE.AdditiveBlending; env.add(flies); gpuMotion(flies, { swx: 0.5, swxF: 1, swy: 0.4, swyF: 1.5 });
    const mist = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshBasicMaterial({ map: TEX.soft, color: 0xd8f0e8, transparent: true, opacity: 0.35, depthWrite: false })); mist.rotation.x = -Math.PI / 2; mist.position.y = C.SEA_Y + 1.5; env.add(mist);
    scene.add(env); env.visible = false;
    const moss = tiles('#4f7a4a', 'rgba(30,50,30,0.5)', 5, (g, x, y, s) => { if (Math.random() < 0.4) { g.fillStyle = 'rgba(150,230,140,0.35)'; g.beginPath(); g.arc(x + rnd(0, s), y + rnd(0, s), rnd(5, 14), 0, TAU); g.fill(); } });
    const under = new THREE.Group();
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(C.ISLAND_R * 0.92, C.ISLAND_R * 0.6, 6, 16), barkM); stump.position.y = -3.3; under.add(stump);
    const platform = makePlatform({ top: new THREE.MeshStandardMaterial({ map: moss, roughness: 0.95 }), side: barkM, trim: M('ftrim', { color: 0xfff27a, emissive: 0xffd23f, emissiveIntensity: 0.6 }), under,
      post: (i) => { const p = new THREE.Group(); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.6, 8), M('mstem', {})); st.position.y = 1.3; p.add(st); const cap = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8, 0, TAU, 0, Math.PI / 2), M('mcap' + (i % 4) + 'g', {})); cap.position.y = 2.6; p.add(cap); return p; } });
    return { env: [env], platform,
      update: (dt) => { flies.material.opacity = 0.6 + Math.sin(G.t * 3) * 0.3; },
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
    let kind = null, flashT = 6, meteorT = 2;
    const make = (n, color, size, opacity, place) => { const p = points(n, 0, color, size, place); p.material.sizeAttenuation = true; p.material.opacity = opacity; return p; };
    const lines = (n, color, len, place) => { const geo = new THREE.BufferGeometry(), a = new Float32Array(n * 6); for (let i = 0; i < n; i++) { const [x, y, z, dx, dy] = place(len); a.set([x, y, z, x + dx, y + dy, z], i * 6); } geo.setAttribute('position', new THREE.BufferAttribute(a, 3)); return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false })); };
    // cada clima se monta una sola vez y se guarda (al volver a él no se rehace); todo el movimiento lo hace la tarjeta gráfica
    const built = {}; let sand = [];
    function build(k) {
      if (built[k]) return built[k];
      const out = [];
      if (k === 'storm' || k === 'rain') {
        const v = k === 'storm' ? 38 : 26, o = lines(k === 'storm' ? 1400 : 1000, 0xcfd8ff, 0.9, len => [rnd(-30, 30), rnd(-6, 26), rnd(-40, 14), -len * 0.15, -len]);
        gpuMotion(o, { vy: -v, ymin: -7, yr: 33, vx: -v * (k === 'storm' ? 0.25 : 0.1), xmin: -32, xr: 62 }); out.push(o);
      } else if (k === 'sandstorm') {
        // tormenta de arena: rachas horizontales y granos más gordos delante; van hacia donde sopla el viento
        const o = lines(700, 0xf6d090, 0, () => { const len = rnd(0.8, 2.4); return [rnd(-30, 30), rnd(-2, 16), rnd(-30, 11), -len, len * 0.05]; });
        o.material.opacity = 0.7; o.userData.sand = { v: 22, step: 2.5 }; gpuMotion(o, { vx: 22, vxStep: 2.5, vxMod: 9, xmin: -32, xr: 64 }); out.push(o);
        const g = make(500, 0xd89a50, 0.4, 0.9, () => [rnd(-25, 25), rnd(-2, 14), rnd(-14, 11)]); g.material.map = TEX.soft;
        g.userData.sand = { v: 12, step: 3 }; gpuMotion(g, { vx: 12, vxStep: 3, vxMod: 5, xmin: -26, xr: 52, swy: 0.2, swyF: 3 }); out.push(g);
      } else if (k === 'blizzard') {
        const o = make(2200, 0xffffff, 0.16, 0.95, () => [rnd(-30, 30), rnd(-6, 26), rnd(-40, 14)]);
        gpuMotion(o, { vy: -3, vyStep: -1, vyMod: 5, ymin: -6, yr: 32, vx: 6, xmin: -30, xr: 60 }); out.push(o);
      } else if (k === 'ash') {
        const o = make(900, 0x8a8088, 0.16, 0.85, () => [rnd(-30, 30), rnd(-6, 26), rnd(-40, 14)]); gpuMotion(o, { vy: -1.2, ymin: -6, yr: 32, swx: 0.5 }); out.push(o);
        const e = make(160, 0xff7a2a, 0.2, 1, () => [rnd(-20, 20), rnd(-6, 20), rnd(-30, 10)]); e.material.blending = THREE.AdditiveBlending; gpuMotion(e, { vy: 2, ymin: -6, yr: 26 }); out.push(e);
      }
      return (built[k] = out);
    }
    function set(k) {
      kind = k; while (grp.children.length) grp.remove(grp.children[0]);
      const objs = k ? build(k) : []; for (const o of objs) grp.add(o);
      sand = objs.filter(o => o.userData.sand);
      grp.visible = !!k;
    }
    function update(dt) {
      if (!kind) return;
      // la arena sigue al viento: solo cambia el signo de la velocidad
      if (sand.length) { const dir = G.sim && G.sim.wind < 0 ? -1 : 1; for (const o of sand) { const U = o.material.userData.gm; U.uX.value.x = dir * o.userData.sand.v; U.uX.value.y = dir * o.userData.sand.step; } }
      // tormenta: relámpagos
      if (kind === 'storm' && (flashT -= dt) <= 0) { flashT = rnd(4, 9); hemi.intensity += 2.2; setTimeout(() => { hemi.intensity = Math.max(0.3, hemi.intensity - 2.2); }, 120); if (G.mode === 'play' && save.sound) Audio.thud(9, true); }
      // meteoritos que cruzan el cielo
      if (kind === 'meteors' && (meteorT -= dt) <= 0) { meteorT = rnd(1.2, 3.5); const x = rnd(-40, 20), y = rnd(18, 30), z = rnd(-70, -30); for (let i = 0; i < 10; i++) setTimeout(() => spawnSprite(x + i * 1.6, y - i * 0.9, z, i ? 0xffb050 : 0xffffff, 1.6 - i * 0.1, 1, 0.5, { add: true, alpha: 1 }), i * 25); }
    }
    return { set, update, build };
  })();
  const BIOMES = { sea: { env: [sea, decor], platform: island } };
  const biomeBuilders = { desert: buildDesert, snow: buildSnow, jungle: buildJungle, volcano: buildVolcano, space: buildSpace, candy: buildCandy, crystal: buildCrystal, temple: buildTemple, forest: buildForest, fair: buildFair, neon: buildNeon, halloween: () => window.Halloween ? window.Halloween.build() : null,
    orchard: () => window.Mundos ? window.Mundos.build('orchard') : null, reef: () => window.Mundos ? window.Mundos.build('reef') : null,
    toys: () => window.Mundos ? window.Mundos.build('toys') : null, dino: () => window.Mundos ? window.Mundos.build('dino') : null, xmas: () => window.Christmas ? window.Christmas.build() : null };
  let biome = 'sea';
  function setBiome(name) {
    if (!BIOMES[name] && biomeBuilders[name]) BIOMES[name] = biomeBuilders[name]();
    biome = BIOMES[name] ? name : 'sea';
    for (const k in BIOMES) { const on = k === biome; for (const o of BIOMES[k].env) o.visible = on; BIOMES[k].platform.visible = on; }
    if (BIOMES[biome].water) sea.visible = true;            // paisajes con agua (Halloween: el galeón navega)
    sunDisc.visible = !BIOMES[biome].noSun;
    const L = BIOMES[biome].light;
    if (L) { auxLight.color.set(L.color); auxLight.intensity = L.intensity; auxLight.distance = L.distance; auxLight.position.set(L.pos[0], L.pos[1], L.pos[2]); auxLight.userData.owner = 'biome'; }
    else if (auxLight.userData.owner === 'biome') { auxLight.intensity = 0; auxLight.userData.owner = null; }
  }

  // ---------------- cañón en primer plano ----------------
  const cannonG = new THREE.Group(); scene.add(cannonG);
  const barrelPivot = new THREE.Group(); cannonG.add(barrelPivot);
  // el cañón lo monta cannons.js (aspecto + modelo + nivel de mejora); aquí solo quedan los grupos y la bola cargada
  let cannonOut = null;
  Cannons.hooks.tex = k => k === 'fire' ? fireTex : k === 'rainbow' ? rainbowTex : k === 'cane' ? (window.Christmas ? window.Christmas.caneTex : null) : null;
  cannonG.scale.setScalar(0.62);
  barrelPivot.position.y = 0.0;

  // ---------------- trayectoria y diana ----------------
  const aimDots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }), 36);
  aimDots.visible = false; aimDots.frustumCulled = false; scene.add(aimDots);
  const reticle = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.4, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide }));
  reticle.renderOrder = 10; reticle.visible = false; scene.add(reticle);

  // ---------------- partículas ----------------
  const DEBRIS_N = 700;
  const debris = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0 }), DEBRIS_N);
  debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage); debris.frustumCulled = false; debris.castShadow = false; debris.count = 0;
  const dState = [];
  for (let i = 0; i < DEBRIS_N; i++) { dState.push({ life: 0 }); debris.setColorAt(i, new THREE.Color(1, 1, 1)); }
  scene.add(debris);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _col = new THREE.Color();
  let dNext = 0, dActive = true;
  function spawnDebris(x, y, z, color, n, speed, size, life, opts) {
    opts = opts || {}; dActive = true;
    for (let k = 0; k < n; k++) {
      const p = dState[dNext]; dNext = (dNext + 1) % DEBRIS_N;
      const a = Math.random() * TAU, el = rnd(-0.3, 1.2), v = speed * rnd(0.4, 1.1);
      p.x = x + rnd(-0.3, 0.3); p.y = y + rnd(-0.3, 0.3); p.z = z + rnd(-0.3, 0.3);
      p.vx = Math.cos(a) * Math.cos(el) * v; p.vy = Math.sin(el) * v + speed * 0.3; p.vz = Math.sin(a) * Math.cos(el) * v;
      p.rx = rnd(0, TAU); p.ry = rnd(0, TAU); p.vr = rnd(-10, 10);
      p.s = size * rnd(0.5, 1.2); p.life = life * rnd(0.7, 1.2); p.max = p.life;
      p.flat = opts.flat; p.g = opts.g != null ? opts.g : 1;
      _col.set(color); p.cr = _col.r; p.cg = _col.g; p.cb = _col.b;
    }
  }
  // solo se dibujan las chispas vivas: se colocan seguidas al principio de la lista y debris.count dice cuántas hay
  // (antes se dibujaban siempre las 700, las muertas a tamaño 0, y se subían enteras a la tarjeta gráfica)
  function updateDebris(dt) {
    if (!dActive) return;
    const ca = debris.instanceColor.array;
    let w = 0;
    for (let i = 0; i < DEBRIS_N; i++) {
      const p = dState[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy += C.G * 0.8 * p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.05 && Math.hypot(p.x, p.z) < C.ISLAND_R && p.vy < 0) { p.y = 0.05; p.vy *= -0.35; p.vx *= 0.7; p.vz *= 0.7; }
      p.rx += p.vr * dt; p.ry += p.vr * 0.7 * dt;
      const k = Math.min(1, p.life / p.max * 2.5);
      _q.setFromEuler(_e.set(p.rx, p.ry, 0));
      const sz = p.s * k;
      _s.set(sz, p.flat ? sz * 0.15 : sz, sz);
      _m.compose(_v.set(p.x, p.y, p.z), _q, _s);
      debris.setMatrixAt(w, _m);
      ca[w * 3] = p.cr; ca[w * 3 + 1] = p.cg; ca[w * 3 + 2] = p.cb;
      w++;
    }
    debris.count = w;
    for (const a of [debris.instanceMatrix, debris.instanceColor]) { a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(1, w) * a.itemSize); a.needsUpdate = true; }
    if (!w) dActive = false;
  }
  // Humo, destellos y anillos: TODOS en dos dibujos (uno normal y otro con brillo «sumado»), en vez de un objeto por
  // partícula. Antes un derrumbe con 20 bloques podía añadir 60-100 dibujos sueltos en un fotograma (cada uno con su
  // material y su cambio de estado en la tarjeta gráfica): era lo que más pesaba al romper bloques.
  // Textura: mitad izquierda, círculo suave; mitad derecha, aro (los anillos de onda).
  const FX_ATLAS = canvasTex(512, 256, (g) => {
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    // aro con el mismo grosor que el toro de antes (tubo 0,06 de radio 1): de 0,887 a 1 del radio
    g.fillStyle = '#fff'; g.beginPath(); g.arc(384, 128, 127, 0, Math.PI * 2); g.arc(384, 128, 113, 0, Math.PI * 2, true); g.fill();
  });
  FX_ATLAS.anisotropy = 1; FX_ATLAS.wrapS = FX_ATLAS.wrapT = THREE.ClampToEdgeWrapping;
  const FX_VS = `
    attribute vec4 iOff; attribute vec4 iCol; attribute float iTex;
    varying vec2 vUv; varying vec4 vCol;
    #include <fog_pars_vertex>
    void main() {
      vUv = vec2((uv.x * 0.992 + 0.004 + iTex) * 0.5, uv.y);
      vCol = iCol;
      vec4 mvPosition = modelViewMatrix * vec4(iOff.xyz, 1.0);
      mvPosition.xy += position.xy * iOff.w;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`;
  const FX_FS = `
    uniform sampler2D map; varying vec2 vUv; varying vec4 vCol;
    #include <fog_pars_fragment>
    void main() {
      vec4 t = texture2D(map, vUv);
      gl_FragColor = vec4(vCol.rgb * t.rgb, vCol.a * t.a);
      if (gl_FragColor.a < 0.004) discard;
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`;
  function fxBatch(N, blending, order) {
    const geo = new THREE.InstancedBufferGeometry();
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    const off = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4), col = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4), tx = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
    off.setUsage(THREE.DynamicDrawUsage); col.setUsage(THREE.DynamicDrawUsage); tx.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iOff', off); geo.setAttribute('iCol', col); geo.setAttribute('iTex', tx);
    geo.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: FX_ATLAS } }]), vertexShader: FX_VS, fragmentShader: FX_FS, transparent: true, depthWrite: false, blending, fog: true });
    mat.uniforms.map.value = FX_ATLAS;
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = order; scene.add(mesh);
    // estado de cada partícula en arrays planos (sin objetos nuevos por partícula)
    const st = { N, n: 0, geo, off, col, tx, x: new Float32Array(N), y: new Float32Array(N), z: new Float32Array(N), size: new Float32Array(N), grow: new Float32Array(N), life: new Float32Array(N), max: new Float32Array(N), vy: new Float32Array(N), a: new Float32Array(N), r: new Float32Array(N), g: new Float32Array(N), b: new Float32Array(N), ring: new Uint8Array(N), mesh };
    return st;
  }
  const FXN = fxBatch(900, THREE.NormalBlending, 0), FXA = fxBatch(900, THREE.AdditiveBlending, 0), _fxc = new THREE.Color();
  function fxAdd(B, x, y, z, color, size, grow, life, vy, alpha, ring) {
    let i = B.n;
    if (i >= B.N) {   // lleno: se sustituye la que menos vida le queda
      let lo = 0; for (let k = 1; k < B.N; k++) if (B.life[k] < B.life[lo]) lo = k; i = lo;
    } else B.n++;
    _fxc.set(color);
    B.x[i] = x; B.y[i] = y; B.z[i] = z; B.size[i] = size; B.grow[i] = grow; B.life[i] = life; B.max[i] = life; B.vy[i] = vy; B.a[i] = alpha;
    B.r[i] = _fxc.r; B.g[i] = _fxc.g; B.b[i] = _fxc.b; B.ring[i] = ring ? 1 : 0;
  }
  function spawnSprite(x, y, z, color, size, grow, life, opts) {
    const add = opts && opts.add;
    fxAdd(add ? FXA : FXN, x, y, z, color, size, grow, life, (opts && opts.vy) || 0, (opts && opts.alpha) || 0.9, false);
  }
  // anillo de onda: un aro que crece de 0,2·r a 1,2·r y se desvanece (antes un toro de 40 segmentos por anillo)
  function spawnRing(x, y, z, color, r, life) { fxAdd(FXN, x, y, z, color, r * 2.12, 0, life, 0, 1, true); }
  function fxUpdate(B, dt) {
    const off = B.off.array, col = B.col.array, tx = B.tx.array;
    let w = 0;
    for (let i = 0; i < B.n; i++) {
      const life = B.life[i] - dt;
      if (life <= 0) continue;
      // se compacta: las vivas quedan al principio
      if (w !== i) { B.x[w] = B.x[i]; B.y[w] = B.y[i]; B.z[w] = B.z[i]; B.size[w] = B.size[i]; B.grow[w] = B.grow[i]; B.max[w] = B.max[i]; B.vy[w] = B.vy[i]; B.a[w] = B.a[i]; B.r[w] = B.r[i]; B.g[w] = B.g[i]; B.b[w] = B.b[i]; B.ring[w] = B.ring[i]; }
      B.life[w] = life;
      const k = 1 - life / B.max[w];
      B.y[w] += B.vy[w] * dt;
      const sz = B.ring[w] ? B.size[w] * (0.2 + k) : B.size[w] * (1 + B.grow[w] * k);
      const o = w * 4;
      off[o] = B.x[w]; off[o + 1] = B.y[w]; off[o + 2] = B.z[w]; off[o + 3] = sz;
      col[o] = B.r[w]; col[o + 1] = B.g[w]; col[o + 2] = B.b[w]; col[o + 3] = B.a[w] * (1 - k);
      tx[w] = B.ring[w];
      w++;
    }
    B.n = w;
    if (w || B.geo.instanceCount) {
      B.geo.instanceCount = w;
      for (const a of [B.off, B.col, B.tx]) { a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(1, w) * a.itemSize); a.needsUpdate = true; }
    }
  }
  function updateSprites(dt) { fxUpdate(FXN, dt); fxUpdate(FXA, dt); }
  function updateRings() { /* los anillos van con las demás partículas (updateSprites) */ }
  function prewarmFx() { spawnSprite(0, -200, 0, 0xffffff, 0.1, 0, 0.02, {}); spawnSprite(0, -200, 0, 0xffffff, 0.1, 0, 0.02, { add: true }); }

  const beams = [];
  const beamGeo = new THREE.BoxGeometry(14, 0.25, 0.25), beamPool = [];
  function spawnBeam(y, z, color) {
    const m = beamPool.pop() || new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.material.color.set(color); m.material.opacity = 1; m.scale.set(1, 1, 1);
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
    centerText('¡COHETE!', '#ffb23a', 30); Audio.special(); Audio.shoot(); vibe([20, 20, 40]);
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
    const v = Math.abs(w) < 0.3 ? '·' : (w < 0 ? '←' : '→').repeat(Math.max(1, Math.min(3, Math.round(Math.abs(w) / 1.6))));
    if (a.textContent !== v) a.textContent = v;
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
    for (const b of beams) { b.life -= dt; const k = 1 - b.life / b.max; b.m.scale.set(1, 1 + k * 3, 1 + k * 3); b.m.material.opacity = Math.max(0, 1 - k); if (b.life <= 0) { scene.remove(b.m); beamPool.push(b.m); } }
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
    if (ctQueue.some(q => q.txt === txt) || (ctCur && ctCur.__src === txt && performance.now() < ctFree)) return;
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
    el.className = 'ft'; el.textContent = q.txt; el.__src = q.txt; el.style.left = '50%'; el.style.top = '38%';
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
    if (L && L.viewTop) maxY = Math.max(maxY, L.viewTop);
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
    halloween: { top: 0x090316, mid: 0x2a0f4a, hor: 0x8a2a5a, fog: 0x2a1240, sea: 0x1c1036, sun: 0xc8b4ff, hemi: [0x9a7ae0, 0x1a0a24], biome: 'halloween', fogNear: 45, fogFar: 190, sunI: 1.6, hemiI: 0.8, stars: true },
    xmas: { top: 0x050a2a, mid: 0x14306e, hor: 0x5a6ab8, fog: 0x22305e, sea: 0x14306e, sun: 0xd0dcff, hemi: [0xb8c8ff, 0x3a3a5a], biome: 'xmas', fogNear: 60, fogFar: 240, sunI: 1.5, hemiI: 1.0, stars: true },
    neon: { top: 0x070a24, mid: 0x1a1a52, hor: 0x7a2a9a, fog: 0x1a1240, sea: 0x101a50, sun: 0xb8c8ff, hemi: [0xa0b0ff, 0x2a1a4a], biome: 'neon', fogNear: 40, fogFar: 160, sunI: 1.5, hemiI: 0.9 },
    // paisajes nuevos (src/mundos.js)
    orchard: { top: 0x4fb8ff, mid: 0xa8e4ff, hor: 0xf0fbd8, fog: 0xcdf0c8, sea: 0x3aa8d8, sun: 0xfff6d8, hemi: [0xfff6d8, 0x5aa040], biome: 'orchard', fogNear: 50, fogFar: 170 },
    reef: { top: 0x03203f, mid: 0x0a5a8a, hor: 0x1aa6b8, fog: 0x0d6e8e, sea: 0x0d6e8e, sun: 0xbff4ff, hemi: [0x7fe8ff, 0x0a3050], biome: 'reef', fogNear: 20, fogFar: 85, sunI: 1.9, hemiI: 1.15 },
    toys: { top: 0xffb8d8, mid: 0xffd8c0, hor: 0xfff0d0, fog: 0xffe2d0, sea: 0xffc8d8, sun: 0xfff4e0, hemi: [0xfff0e0, 0xc07850], biome: 'toys', fogNear: 60, fogFar: 260 },
    dino: { top: 0x6a3a2a, mid: 0xd88a4a, hor: 0xffc070, fog: 0xe0a060, sea: 0x8a5a2a, sun: 0xffd8a0, hemi: [0xffe0b0, 0x5a3a1a], biome: 'dino', fogNear: 40, fogFar: 170 } };
  const mixC = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
  function themeFor(world) {
    const W = G.hwWorld || (G.level && G.level.hw) ? { biome: 'halloween', variant: 'noche' } : G.xmWorld || (G.level && G.level.xm) ? { biome: 'xmas', variant: 'xm' } : (WORLDS[world - 1] || { biome: 'sea', variant: 'día' });
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
    if (BIOMES[biome] && BIOMES[biome].leave) BIOMES[biome].leave();   // relámpago a medias: se apaga
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
    for (const m of G.ballMeshes.values()) { scene.remove(m); Cannons.freeBall(m); }
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
  // piel de los bloques de colores en los paisajes nuevos (src/mundos.js); en la portada y el resto, la gominola de siempre
  const blockSkin = () => (window.Mundos && G.level && !G.level.hw && !G.level.xm ? window.Mundos.skin(biome) : null);
  function buildLevelView() {
    clearLevelView();
    G.candies = []; G.candyHosts = 0;
    for (const b of G.sim.blocks) blockView(b.userData);
    syncView(0);
    // bloques de caramelo: solo en los niveles del mundo de Halloween (no en los mundos normales)
    if (window.Halloween && hwActive() && G.level && G.level.hw && !G.demo && !G.level.boss) window.Halloween.decorate(G, 4);
    // bloques envueltos para regalo en el mundo de Navidad (en los jefes, todos los de colores; solo algunos llevan premio)
    G.xgifts = [];
    if (window.Christmas && xmActive() && G.level && G.level.xm && !G.demo) window.Christmas.decorate(G, G.level.boss ? 3 : 4, !!G.level.boss);
  }
  // la pieza que se ve de un bloque (también los que aparecen durante la partida)
  function blockView(d) {
    {
      if ((NEWK[d.kind] && d.kind !== 'lockDeco' && d.kind !== 'tikiDeco') || d.kind === 'portal') { const g = newKindMesh(d); world.add(g); G.meshes[d.id] = g; return g; }
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
      const SK = blockSkin();
      if (SK && mat === jelly[d.c] && SK.mat[d.c]) mat = SK.mat[d.c];
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
      } else if (d.kind === 'block' && Math.min(d.w, d.h) >= 0.38 && !(SK && SK.noFace && mat === SK.mat[d.c])) {
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
      return g;
    }
  }
  const fogMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc8, roughness: 0.9 });
  let cloudRects = [];
  const liveBalls = new Set(), liveMovers = new Set(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
  // posición que se dibuja: entre el paso de física anterior y el actual (sim.alpha), para que el movimiento sea continuo
  // aunque los fotogramas no caigan justo cada 2 pasos. Si el cuerpo ha saltado (portal, reaparece), se pone donde está.
  function smoothPose(b, o, sim) {
    const ip = b.userData && b.userData._ip, a = sim.alpha, p = b.position, q = b.quaternion;
    if (!ip || !(a > 0 && a < 1) || G.paused) { o.position.set(p.x, p.y, p.z); o.quaternion.set(q.x, q.y, q.z, q.w); return; }
    const dx = p.x - ip[0], dy = p.y - ip[1], dz = p.z - ip[2];
    if (dx * dx + dy * dy + dz * dz > 0.6) { o.position.set(p.x, p.y, p.z); o.quaternion.set(q.x, q.y, q.z, q.w); return; }
    o.position.set(ip[0] + dx * a, ip[1] + dy * a, ip[2] + dz * a);
    _qa.set(ip[3], ip[4], ip[5], ip[6]); _qb.set(q.x, q.y, q.z, q.w);
    o.quaternion.copy(_qa).slerp(_qb, a);
  }
  function syncView(dt) {
    const sim = G.sim, t = G.t;
    if (sim.clouds && sim.clouds.length) cloudRects = sim.clouds.filter(c => c.userData.alive).map(c => [c.position.x, c.position.y, c.userData.w / 2 + 0.2, c.userData.h / 2 + 0.2, c.position.z]);
    else if (cloudRects.length) cloudRects = [];
    const look = sim.balls.length ? sim.balls[sim.balls.length - 1].position : null;
    for (const b of sim.blocks) {
      const d = b.userData, g = G.meshes[d.id];
      if (!g) continue;
      if (!d.alive && !d.popping) { g.visible = false; continue; }
      if (d.destroyed && !d.alive) { g.visible = false; continue; }
      smoothPose(b, g, sim);
      if (d.popping && d.alive) {
        g.userData.pop = (g.userData.pop || 0) + dt * 8;
        const s = 1 + Math.min(0.3, g.userData.pop * 0.3); g.scale.set(s, s, s);
        g.userData.body.material = MAT.pop;
      }
      if (d.ice && d.hp <= 1 && !d.popping && g.userData.body.material === iceMat[d.c]) { const SK = blockSkin(); g.userData.body.material = (SK && SK.mat[d.c]) || jelly[d.c]; }
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
        let danger = false;
        if (look && look.distanceTo(b.position) < 3.5) for (let i = 0; i < sim.balls.length; i++) if (sim.balls[i].userData.c === d.c) { danger = true; break; }
        let mood = 'normal';
        if (moving || danger || d.popping) mood = 'scared';
        else if (t > g.userData.blinkAt) { mood = 'blink'; if (t > g.userData.blinkAt + 0.12) g.userData.blinkAt = t + rnd(2, 6); }
        const tex = FACES[d.c][mood];
        if (face.material.map !== tex) face.material.map = tex;   // misma clase de textura: no hace falta needsUpdate (evita revisar el shader en cada parpadeo)
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
    const live = liveBalls; live.clear();
    for (const b of sim.balls) {
      live.add(b);
      let m = G.ballMeshes.get(b);
      if (!m) { m = makeBallMesh(b.userData.ball, b.userData.r); scene.add(m); G.ballMeshes.set(b, m); }
      smoothPose(b, m, sim);
      const wt = W_TRAIL[b.userData.ball], tf = !wt && !G.demo && trailFx();
      if (tf) { if (Math.random() < 0.85) { const c = tf.rb ? RB_COLS[Math.floor(G.t * 12) % RB_COLS.length] : tf.cols[Math.floor(Math.random() * tf.cols.length)]; spawnSprite(b.position.x + rnd(-0.08, 0.08), b.position.y + rnd(-0.08, 0.08), b.position.z, c, b.userData.r * 1.5 * tf.sz, 0.3, 0.45, { alpha: tf.a, add: !!tf.add }); } }
      else if (Math.random() < 0.6) spawnSprite(b.position.x, b.position.y, b.position.z, wt || 0xffffff, b.userData.r * (wt ? 2 : 1.4), 0.4, wt ? 0.4 : 0.25, { alpha: wt ? 0.6 : 0.35, add: !!wt });
    }
    for (const [b, m] of G.ballMeshes) if (!live.has(b)) { scene.remove(m); Cannons.freeBall(m); G.ballMeshes.delete(b); }
  }
  const SPECIAL_MAT = {
    rainbow: new THREE.MeshPhysicalMaterial({ map: rainbowTex, roughness: 0.25, clearcoat: 1 }),
    bomb: new THREE.MeshPhysicalMaterial({ color: 0x2d2640, roughness: 0.35, metalness: 0.3, clearcoat: 1 }),
    heavy: new THREE.MeshPhysicalMaterial({ color: 0x9d9ab0, roughness: 0.3, metalness: 0.8 }),
    golden: new THREE.MeshPhysicalMaterial({ color: 0xffc83d, roughness: 0.12, metalness: 1, clearcoat: 1, emissive: new THREE.Color(0x7a4a00), envMapIntensity: 1.8 }),
    sand: new THREE.MeshStandardMaterial({ color: 0xd8b070, roughness: 1 }),       // bola de arena (maldición del faraón)
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
  const CARRIER_NAMES = { desert: 'globo', snow: 'teleférico', jungle: 'mono', volcano: 'dragón', space: 'ovni', orchard: 'abeja', reef: 'submarino', toys: 'avión de juguete', dino: 'pterodáctilo' };
  const CARRIER_TITLES = { desert: '¡GLOBO!', snow: '¡TELEFÉRICO!', jungle: '¡MONO!', volcano: '¡DRAGÓN!', space: '¡OVNI!', orchard: '¡ABEJA!', reef: '¡SUBMARINO!', toys: '¡AVIÓN!', dino: '¡PTERODÁCTILO!' };
  const CARRIER_HINT = {
    desert: '¡Un globo con 2 bolas en la cesta! Si le das, son tuyas. Apunta por delante',
    snow: '¡Un teleférico con 2 bolas dentro! Si le das, son tuyas. Apunta por delante',
    jungle: '¡Un mono en tirolina con 2 bolas! Si le das, son tuyas. Apunta por delante',
    volcano: '¡Un dragón lleva 2 bolas en una cesta! Si le das, son tuyas. Apunta por delante',
    space: '¡Un ovni con 2 bolas en la cúpula! Si le das, son tuyas. Apunta por delante',
    orchard: '¡Una abeja lleva 2 bolas en una cesta! Si le das, son tuyas. Apunta por delante',
    reef: '¡Un submarino con 2 bolas dentro! Si le das, son tuyas. Apunta por delante',
    toys: '¡Un avión de juguete lleva 2 bolas en una caja! Si le das, son tuyas. Apunta por delante',
    dino: '¡Un pterodáctilo lleva 2 bolas en una cesta! Si le das, son tuyas. Apunta por delante',
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
    else if (window.Mundos) window.Mundos.carrier(m.carrier, g, K);
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
    else if (window.Mundos) window.Mundos.syncCarrier(m, g, t);
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
    const live = liveMovers; live.clear();
    for (const m of (sim && sim.movers) || []) {
      live.add(m.id);
      let g = G.moverMeshes.get(m.id);
      if (m.carrier) {
        if (!g) { g = makeCarrier(m); scene.add(g); G.moverMeshes.set(m.id, g); }
        syncCarrier(m, g, sim); continue;
      }
      const HW = biome === 'halloween' && window.Halloween, XMB = biome === 'xmas' && window.Christmas;
      if (!g) { g = m.kind === 'bird' ? (XMB ? XMB.makeBird() : HW ? HW.makeWitch() : biome === 'space' ? makeSatellite() : biome === 'reef' && window.Mundos ? window.Mundos.makeFish() : makeBird()) : HW ? HW.makePirate(m) : makeShip(m); g.rotation.y = m.dir > 0 ? 0 : Math.PI; scene.add(g); G.moverMeshes.set(m.id, g); }
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
  const ballGeos = {};
  function makeBallMesh(kind, r) {
    const bs = save.bskin && save.bskin.eq;
    if (bs && bs !== 'clasica' && COL[kind]) { const g = Cannons.ballMesh(bs, kind, r); if (g) return g; }   // aspecto de bola (mismo color)
    const m = new THREE.Mesh(ballGeos[r] || (ballGeos[r] = new THREE.SphereGeometry(r, 32, 20)), ballMaterial(kind));
    m.castShadow = true;
    return m;
  }
  // la bola cargada en la boca del cañón (con su aspecto) y las piezas del cañón que toman su color
  function loadMuzzle(k, vis) {
    if (!cannonOut) return;
    if (k && G.cannonKind !== k) {
      G.cannonKind = k;
      const mat = ballMaterial(k); mat.userData.keep = 1;
      for (const h of cannonOut.holders) { for (const c of h.children.slice()) { h.remove(c); Cannons.freeBall(c); } h.add(makeBallMesh(k, h.userData.r)); }
      for (const m of cannonOut.tint) m.material = mat;
    }
    for (const h of cannonOut.holders) h.visible = vis;
  }

  // ---------------- eventos del simulador ----------------
  const hexCss = c => '#' + new THREE.Color(COL[c] || 0xffffff).getHexString();
  // ---- combo de cada tiro: notas que suben, textos por escalones y vibración ----
  const COMBO_EV = { pop: 1, glass: 1, crumble: 1, rocket: 1, pinata: 1, hourglass: 1, geyser: 1, erupt: 1, prize: 1, fall: 1 };
  const COMBO_TIERS = [[5, '¡GENIAL!', '#7dffb0'], [10, '¡INCREÍBLE!', '#ffd23f'], [15, '¡ROCKET RUSH!', '#ff7ad8'], [25, '¡IMPARABLE!', '#7fe6ff']];
  function comboStep(e) {
    G.combo = (G.combo || 0) + 1;
    if (window.Jugada && !G.demo) Jugada.combo(G.combo);
    if (save.sound && typeof SFX !== 'undefined' && SFX.note) SFX.note(G.combo - 1);
    const t = COMBO_TIERS.find(q => q[0] === G.combo);
    if (t) { centerText(t[1], t[2], 34 + COMBO_TIERS.indexOf(t) * 4); vibe([25, 25, 40 + COMBO_TIERS.indexOf(t) * 20]); flashLight.position.set(e.x || 0, (e.y || 2) + 1, (e.z || 0) + 1.5); flashLight.color.set(t[2]); flashLight.intensity = 40; G.shake = Math.max(G.shake, 0.15); }
  }
  function handleEvents() {
    const sim = G.sim;
    // mejor tiro: bloques derribados desde el último disparo (solo jugando de verdad)
    if (G.mode === 'play' && !G.demo && sim.state === 'play' && G.shotBase != null) {
      const n = sim.popped + sim.fallen - G.shotBase, st = stats();
      if (n > (st.bestShot || 0)) st.bestShot = n;
    }
    for (const e of sim.events) {
      if (COMBO_EV[e.type] && G.mode === 'play') comboStep(e);
      switch (e.type) {
        case 'shoot': G.combo = 0; if (WBALLS[e.kind]) stats().wballs = (stats().wballs || 0) + 1; G.shotBase = sim.popped + sim.fallen; if (G.mode === 'play' && !G.demo) { masteryShot(); if (window.Jugada) Jugada.shoot(G.level); } {
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
        case 'spring': { spawnRing(e.x, e.y + 0.5, e.z, 0x7dffb0, 1.8, 0.4); floatText(e.x, e.y + 1.2, e.z, '¡BOING!', '#7dffb0', 26, true); Audio.chirp(); G.shake = Math.max(G.shake, 0.2); vibe(30);
          const g = G.meshes[e.id]; if (g && !g.userData.dented) { g.userData.dented = true; g.scale.set(1.04, 0.82, 1.04); g.traverse(o => { if (o.isMesh && o.material && o.material.color && !o.material._dent) { o.material = o.material.clone(); o.material._dent = true; o.material.color.multiplyScalar(0.72); if (o.material.emissive) o.material.emissive.setHex(0x3a0a0a); } }); }
          break; }
        case 'armorHit': { spawnDebris(e.x, e.y, e.z, 0xffb050, 12, 5, 0.14, 0.9); spawnSprite(e.x, e.y, e.z + 0.5, 0xffe0a0, 1.6, 1.2, 0.3, { add: true });
          floatText(e.x, e.y + 1, e.z, e.left ? '¡CORAZA! quedan ' + (e.left + 1) : '¡CORAZA ROTA!', '#ffb050', 24, true); Audio.thud(8, true); G.shake = Math.max(G.shake, 0.25);
          const g = G.meshes[e.id]; if (g) g.scale.setScalar(0.85 + 0.05 * e.left); break; }
        case 'springPop': stats().blocks++; stats().specials++; spawnDebris(e.x, e.y, e.z, 0x7dffb0, 16, 6, 0.14, 1); spawnSprite(e.x, e.y, e.z + 0.4, 0xd8fff0, 2, 1.2, 0.35, { add: true });
          floatText(e.x, e.y + 1.2, e.z, '¡CRAC!', '#7dffb0', 28, true); Audio.pop && Audio.pop(1); G.shake = Math.max(G.shake, 0.25); vibe([20, 20, 30]); break;
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
        case 'prismOff': for (const c of Object.values(COL)) spawnDebris(e.x, e.y, e.z, c, 3, 4, 0.1, 0.9, { flat: true }); Audio.pop(3); break;   // roto sin efecto
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
          if (e.kind === 'bird') { if (biome === 'halloween') Audio.cackle(); else if (biome === 'reef') Audio.blub(); else Audio.chirp(); } else Audio.horn();
          save.seen = save.seen || {};
          if (e.carrier) {
            const key = 'c_' + e.carrier, nm = { r: 'roja', b: 'azul', g: 'verde', y: 'amarilla', p: 'morada', bomb: 'bomba', rainbow: 'arcoíris' };
            if (!save.seen[key]) { save.seen[key] = true; persist(); showHint(CARRIER_HINT[e.carrier], 4500); }
            else showHint((e.carrier === 'orchard' ? 'Pasa una ' : 'Pasa un ') + CARRIER_NAMES[e.carrier] + ' con bola ' + e.balls.map(k => nm[k] || k).join(' y bola '), 3000);
            break;
          }
          // en el arrecife el pájaro es un pez y en el espacio un satélite: aviso propio la primera vez
          if (e.kind === 'bird' && (biome === 'reef' || biome === 'space')) {
            const k = biome === 'reef' ? 'fish' : 'satellite';
            if (!save.seen[k]) { save.seen[k] = true; persist(); showHint(biome === 'reef' ? '¡Un pez! Si le das, ganas 2 bolas. Apunta por delante de él' : '¡Un satélite! Si le das, ganas 2 bolas. Apunta por delante de él', 4500); }
            break;
          }
          if (!save.seen[e.kind]) {
            save.seen[e.kind] = true; persist();
            showHint(biome === 'halloween' ? (e.kind === 'bird' ? '¡Una bruja! Si le das, ganas 2 bolas. Apunta por delante de ella' : '¡Un galeón pirata con 2 bolas! Si lo tumbas, son tuyas. Apunta muy por delante')
              : e.kind === 'bird' ? '¡Un pájaro! Si le das, ganas 2 bolas. Apunta por delante de él' : '¡Un velero con 2 bolas! Si lo tumbas, son tuyas. Apunta muy por delante', 4500);
          } else if (e.kind === 'ship' && e.balls) {
            // en cada pasada lleva otras: se dice cuáles para que se sepa qué hay en juego
            const nm = { r: 'roja', b: 'azul', g: 'verde', y: 'amarilla', p: 'morada', bomb: 'bomba', rainbow: 'arcoíris' };
            showHint((biome === 'halloween' ? 'Pasa un galeón con bola ' : 'Pasa un velero con bola ') + e.balls.map(k => nm[k] || k).join(' y bola '), 3000);
          }
          break;
        case 'moverHit': { stats().movers++; if (e.kind === 'bird') stats().birds = (stats().birds || 0) + 1; else stats().ships = (stats().ships || 0) + 1;
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
          centerText((e.kind === 'bird' ? (biome === 'space' ? '¡SATÉLITE!' : biome === 'reef' ? '¡PEZ!' : biome === 'halloween' ? '¡BRUJA!' : '¡PÁJARO!') : mv && mv.carrier ? CARRIER_TITLES[mv.carrier] : biome === 'halloween' ? '¡GALEÓN!' : '¡VELERO!') + ' +2 BOLAS', '#ffe27a', 28);
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
    for (const o of window.RRGame.aimObjs) if (o.visible) objs.push(o);
    const hits = ray.intersectObjects(objs, false);
    if (hits.length) return hits[0].point.clone();
    const p = new THREE.Vector3();
    // pájaro, velero y lo que cruza el cielo: van lejos y se ven pequeños (el teleférico, unos 20 px), así que el dedo vale en
    // una franja alrededor de su altura de al menos ±MOVER_PX px en pantalla (además de la franja en metros de cada uno).
    // La diana se lleva a la altura a la que estará el objeto cuando llegue la bola (la de las bolas que lleva): el jugador
    // solo tiene que adelantarse en horizontal.
    const MOVER_PX = Math.max(46, H * 0.06);
    for (const m of (G.sim && G.sim.movers) || []) {
      if (!m.active) continue;
      const AIM = { desert: [1.8, 2.6], snow: [0.4, 1.6], jungle: [-0.8, 1.6], volcano: [-0.25, 1.5], space: [0.3, 1.3], orchard: [-0.2, 1.5], reef: [0.1, 1.3], toys: [-0.3, 1.3], dino: [-0.25, 1.5] };
      const SNAP = { desert: [0.7, 0.3], snow: [-0.1, 0.25], jungle: [-1.0, 0.25], volcano: [-0.45, 0.25], space: [0.2, 0.25], orchard: [-0.45, 0.25], reef: [0.05, 0.25], toys: [-0.5, 0.25], dino: [-0.5, 0.25] };
      const cy = m.kind === 'bird' ? m.y : m.carrier ? m.y + AIM[m.carrier][0] : m.y + 1.9 * C.SHIP_S, band = m.kind === 'bird' ? 1.8 : m.carrier ? AIM[m.carrier][1] : 2.1 * C.SHIP_S;
      if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -m.z), p)) continue;
      const sy = _v.set(p.x, cy, m.z).project(camera).y, ty = (-sy * 0.5 + 0.5) * H;
      if (Math.abs(p.y - cy) < band || Math.abs(py - ty) < MOVER_PX) {
        // altura a la que estará cuando llegue la bola (el globo, el dragón y el ovni suben y bajan; el mono baja por la tirolina)
        const sn = m.kind === 'bird' ? [0, 0.2] : m.carrier ? SNAP[m.carrier] : [C.BOAT.ballY * C.SHIP_S, 0.3 * C.SHIP_S], sim = G.sim;
        const yAt = t => { if (m.carrier) { const K = C.CARRIERS[m.carrier]; return m.y0 + (K.bob ? Math.sin(t * K.bobF + m.ph) * K.bob : 0) - (K.slope ? K.slope * m.dir * p.x : 0); }
          return m.kind === 'bird' ? m.y0 + Math.sin(t * 2.2 + m.ph) * 0.45 : m.y0 + Math.sin(t * 1.3 + m.ph) * 0.12; };
        let yc = m.y + sn[0];
        for (let k = 0; k < 3; k++) yc = yAt(sim.t + sim.launch(p.x, yc, m.z).T) + sn[0];
        p.y = clamp(p.y, yc - sn[1], yc + sn[1]); return p.clone();
      }
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
    // con la mira telescópica (mejora 3+) la guía sigue un 40 % más allá de la diana, con puntos más pequeños
    const long = !!(sim.pw && sim.pw.aim), n = long ? 36 : 26;
    const pts = sim.trajectory(G.aim.x, G.aim.y, G.aim.z, long ? 35 : 26, long ? 1.4 : 1);
    const col = new THREE.Color(COL[sim.queue[0]] || 0xffffff);
    aimDots.count = n;
    for (let i = 0; i < n; i++) {
      const p = pts[i + 1] || pts[pts.length - 1];
      const s = i < 2 ? 0 : long && i >= 24 ? 0.45 : 0.6 + 0.4 * (1 - Math.min(i, 26) / 26);
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
    loadMuzzle(k, !!k && sim.canFire());
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
  // el HUD se toca solo cuando cambia: reescribir el mismo texto cada fotograma obliga al navegador a repintar la capa de encima del juego
  // y en móvil se nota como tirones (sobre todo con el aviso del viento, que también se reescribía siempre)
  const setText = (el, v) => { v = String(v); if (el.__esv !== v) { el.__esv = v; el.textContent = v; } };   // compara con el original (en otro idioma el texto que se ve está traducido)
  const setHidden = (el, h) => { if (el.hidden !== h) el.hidden = h; };
  function updateHud(dt) {
    const sim = G.sim; if (!sim) return;
    shownScore += (sim.score - shownScore) * Math.min(1, dt * 8);
    if (Math.abs(sim.score - shownScore) < 1) shownScore = sim.score;
    setText($('hudScore'), Math.round(shownScore));
    const p = sim.progress();
    const mw = (p * 100).toFixed(1) + '%', mf = $('meterFill');
    if (mf.__w !== mw) { mf.__w = mw; mf.style.width = mw; }
    if (mf.__d !== (p >= sim.target)) { mf.__d = p >= sim.target; mf.classList.toggle('done', mf.__d); }
    setText($('meterPct'), Math.round(p * 100) + '%');
    updateTray();
    const hint = $('hint');
    let txt = '';
    if (G.mode === 'play' && !G.firstShot && G.level.id === 1) txt = 'Toca un bloque azul para disparar';
    else if (G.mode === 'play' && !G.swapped && G.level.id === 2 && !G.firstShot) txt = 'Toca la bandeja de abajo para cambiar de bola (la primera vez es gratis; luego cuesta ' + SWAP_COST + ' monedas)';
    else if (G.mode === 'play' && G.sim.goalReached && G.sim.state === 'play' && !G.aim) txt = 'Sigue disparando para más estrellas, o pulsa Terminar';
    else if (G.mode === 'play' && G.aim) txt = '';
    if (performance.now() < hintUntil) txt = hintMsg;
    setText(hint, txt); if (hint.__o !== !!txt) { hint.__o = !!txt; hint.style.opacity = txt ? 1 : 0; }
    const ng = save.boosters.golden || 0, gb = $('btnGold');
    setHidden(gb, !(G.mode === 'play' && ng > 0 && sim.state === 'play'));
    if (gb.disabled !== (sim.queue[0] === 'golden')) gb.disabled = sim.queue[0] === 'golden';
    setText($('goldCount'), ng);
  }

  // ---------------- pantallas ----------------
  const screens = ['title', 'map', 'hwmap', 'xmmap', 'pass', 'missions', 'social', 'club', 'pre', 'win', 'lose', 'pause', 'shop', 'settings', 'newCard', 'privacy'];
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
      // a un bloque de verdad: el de delante más cercano al centro y a media altura (hay estructuras con el centro hueco)
      const live = sim.liveBlocks().filter(b => b.userData.kind !== 'portal' && b.userData.kind !== 'cloud');
      const front = live.length ? Math.max(...live.map(b => b.position.z)) : 0, midY = Math.max(1, sil.top * 0.45);
      const tgt = live.filter(b => b.position.z > front - 0.6).sort((a, b) => (Math.abs(a.position.x) + Math.abs(a.position.y - midY)) - (Math.abs(b.position.x) + Math.abs(b.position.y - midY)))[0];
      if (tgt ? sim.fire(tgt.position.x, tgt.position.y, tgt.position.z) : sim.fire(0, midY, 0)) { TD.phase = 'shot'; TD.t = 0; sim.events.length = 0; }
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
    G.inHw = false; G.inXm = false; G.hwWorld = hwActive() && !!window.Halloween;
    G.xmWorld = !G.hwWorld && xmActive() && !!window.Christmas;
    G.mode = 'title'; G.paused = false; loadDemo(Math.min(save.unlocked, LEVELS.length));   // de fondo, el paisaje del mundo en el que vas
    // evento de Halloween: en la portada solo se ve el castillo (sin bloques), con murciélagos, la bruja y relámpagos
    if (G.hwWorld || G.xmWorld) { for (const m of G.meshes) if (m) m.visible = false; }
    Audio.setStyle(G.hwWorld ? 'spooky' : G.xmWorld ? 'xmas' : 'normal');
    $('title').classList.toggle('hw', G.hwWorld); $('title').classList.toggle('xm', G.xmWorld); hwUi(); xmUi();
    $('hud').classList.remove('on'); show('title'); G.titleReady = true; updateTitle(); RH('title');
  }
  // pantalla inicial: nivel en curso, avisos y estela de la bola-cohete
  function updateTitle() {
    if (!$('titleLv')) return;
    const L = byId(Math.min(save.unlocked, LEVELS.length)), W = WORLDS[L.world - 1];
    $('titleLv').textContent = (L.boss ? 'Jefe ' : 'Nivel ') + L.id + (W ? ' · ' + W.name : '');
    const fl = $('streakFlame'); if (fl) { fl.hidden = !(save.streak >= 1); fl.querySelector('b').textContent = save.streak; }
    liveUi();
    $('passDotT').hidden = !passClaimable();
    const n = misClaimable() + (RH('achCount') || 0); $('misDotT').hidden = !n; $('misDotT').textContent = n;
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
    if (G.mode === 'title' && !G.hwWorld && !G.xmWorld) camera.setViewOffset(W, H, 0, -H * 0.16, W, H);
    else if (camera.view && camera.view.enabled) camera.clearViewOffset();
  }
  function goMap() {
    if (G.inHw && hwActive()) { goHw(); return; }
    if (G.inXm && xmActive()) { goXm(); return; }
    G.hwWorld = false; G.xmWorld = false; Audio.setStyle('normal');
    if (window.Bosses) window.Bosses.stop();
    refundGolden();
    $('btnFinish').hidden = true;
    G.mode = 'map'; G.paused = false; $('hud').classList.remove('on');
    loadDemo(Math.min(save.unlocked, LEVELS.length));
    renderMap(); setCoins(); hwUi(); xmUi(); show('map'); measureWorlds();
    const cur = document.querySelector('.lv.cur'); if (cur) cur.scrollIntoView({ block: 'center' });
  }
  // nivel extra del mundo w: se abre con 3 estrellas en todos sus niveles
  function worldStars3(w) { return LEVELS.filter(l => l.world === w && (save.stars[l.id] || 0) >= 3).length; }
  const worldSize = w => (WORLDS[w - 1] ? WORLDS[w - 1].size : 10);
  function bonusOpen(w) { return (testOn() && save.testAll) || worldStars3(w) >= worldSize(w); }
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
  function openPre(id, noOffer) {
    const L = byId(id); if (!L) return;
    G.preId = id; preSel = {}; closeCosSheet();
    if (G.mode !== 'play') loadDemo(id);
    $('preTitle').textContent = L.weekly ? 'Desafío de la semana' : L.club ? ({ ex: 'Club · Expedición ' + L.pos, lg: 'Club · Liga ' + L.pos, boss: 'Club · Jefe colosal' })[L.club] : L.xm ? (L.boss ? 'Jefe de Navidad' : 'Navidad · ' + L.pos) : L.hw ? (L.boss ? 'Jefe de Halloween' : 'Halloween · ' + L.pos) : L.bonus ? 'Nivel extra ' + L.world : L.boss ? 'Jefe · nivel ' + id : 'Nivel ' + id;
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
    // ninguna ventaja es gratis: si no te queda, se compra aquí mismo al precio de la tienda
    const defs = [['rocket', 'Cohete'], ['bomb', 'Bomba'], ['rainbow', 'Arcoíris'], ['extra', '+2 bolas']];
    // bola del mundo de este nivel (y las demás que ya tengas)
    const wk = worldBallOf(L.world), wks = [wk].concat(WB_KEYS.filter(k => k !== wk && (save.boosters[k] || 0) > 0));
    const wdefs = wks.filter(k => wbOpen(k)).map(k => [k, WBALLS[k].name.replace('Bola ', '').replace(/^de /, '')]);
    const badge = k => (save.boosters[k] || 0) > 0 ? `<span class="n">${save.boosters[k]}</span>` : `<span class="n buy"><i class="coin"></i>${boosterPrice(k)}</span>`;
    $('preBoosters').innerHTML = defs.map(([k, n]) => {
      const ico = k === 'rocket' ? `<div style="margin:2px auto 0;width:44px;height:44px">${ROCKET_SVG}</div>` : `<div class="ball big ${k === 'extra' ? 'bPlus2' : CSSB[k]}" style="margin:2px auto 0;width:44px;height:44px"></div>`;
      return `<div class="boost" data-k="${k}">${badge(k)}${ico}<div>${n}</div></div>`;
    }).join('') + wdefs.map(([k, n]) => `<div class="boost wboost" data-k="${k}">${badge(k)}<div class="ball big ${CSSB[k]}" style="margin:2px auto 0;width:44px;height:44px"></div><div>${n}<small>nv. ${wbLevel(k)}</small></div></div>`).join('');
    $('preWb').innerHTML = wdefs.length ? `<b>${WBALLS[wk].name}:</b> ${WB_DESC[wk]}` : '';
    const DESC = { rocket: '<b>Cohete:</b> al empezar cruza la estructura y revienta la fila con más bloques.', bomb: '<b>Bomba:</b> explota y revienta todo lo que tiene alrededor.', rainbow: '<b>Arcoíris:</b> toma el color del primer bloque que toca.', extra: '<b>+2 bolas:</b> empiezas con dos bolas más.' };
    $('preBoosters').querySelectorAll('.boost').forEach(el => el.addEventListener('click', () => {
      const k = el.dataset.k;
      Audio.click();
      if (!preSel[k] && !(save.boosters[k] > 0)) {             // comprarla aquí mismo, al precio de la tienda
        const c = boosterPrice(k);
        if (save.coins < c) { toast(`Te faltan ${c - save.coins} monedas`); openShop(); return; }
        save.coins -= c; save.boosters[k] = (save.boosters[k] || 0) + 1; persist(); setCoins(); Audio.coin();
        const nb = el.querySelector('.n'); nb.className = 'n'; nb.textContent = save.boosters[k];
        toast((WBALLS[k] ? WBALLS[k].name : DESC[k].replace(/<[^>]+>/g, '').split(':')[0]) + ' comprado por ' + c + ' monedas');
      }
      preSel[k] = !preSel[k]; el.classList.toggle('sel', preSel[k]);
      $('preWb').innerHTML = WBALLS[k] ? `<b>${WBALLS[k].name}:</b> ${WB_DESC[k]}` : DESC[k];
    }));
    $('preStreak').style.display = 'none';
    renderLoadout();
    $('pre').classList.add('on'); $('preScroll').scrollTop = 0;
    if (!noOffer) setTimeout(() => { if ($('pre').classList.contains('on') && G.preId === id) maybeOffer(L); }, 500);
  }
  // marca ventajas en la pantalla de antes del nivel (después de comprarlas en un aviso)
  function preSelect(ks) {
    for (const k of ks) { const el = $('preBoosters').querySelector(`.boost[data-k="${k}"]`); if (!el || !(save.boosters[k] > 0) || preSel[k]) continue; preSel[k] = true; el.classList.add('sel'); }
  }
  // premio de la racha de victorias: al ganar, uno al azar de su nivel (mejor cuanto más larga es la racha) y nunca el mismo dos veces seguidas
  const STREAK_PRIZES = [
    [{ coins: 30 }, { coins: 40 }, { coins: 50 }],                                            // racha 1
    [{ coins: 80 }, { rocket: 1 }, { extra: 1 }],                                             // racha 2
    [{ bomb: 1 }, { rainbow: 1 }, { coins: 120 }, { gems: 2 }],                               // racha 3
    [{ bomb: 1, coins: 100 }, { rainbow: 1, rocket: 1 }, { gems: 4 }, { wball: 1 }],          // racha 4 y 5
    [{ golden: 1 }, { gems: 8 }, { bomb: 1, rainbow: 1, coins: 150 }, { wball: 2, gems: 2 }], // racha 6 o más
  ];
  function streakPrize(L) {
    const s = save.streak; if (s < 1) return '';
    const pool = STREAK_PRIZES[s >= 6 ? 4 : s >= 4 ? 3 : s - 1];
    const opts = pool.filter(p => JSON.stringify(p) !== save.streakLast);
    const p = opts[Math.floor(Math.random() * opts.length)] || pool[0];
    save.streakLast = JSON.stringify(p);
    const out = [];
    for (const k in p) {
      const n = p[k];
      if (k === 'coins') { save.coins += n; out.push(`+${n} monedas`); }
      else if (k === 'gems') { save.gems = (save.gems || 0) + n; out.push(`+${n} gemas`); }
      else if (k === 'wball') { const w = worldBallOf(L.world); save.boosters[w] = (save.boosters[w] || 0) + n; out.push(`+${n} ${WBALLS[w].name.toLowerCase()}`); }
      else { save.boosters[k] = (save.boosters[k] || 0) + n; out.push(`+${n} ${{ bomb: 'bomba', rainbow: 'arcoíris', extra: '+2 bolas', rocket: 'cohete', golden: 'bola dorada' }[k]}`); }
    }
    return out.join(' · ');
  }
  // precio en la tienda de cada ventaja (en monedas)
  const BOOST_PRICE = { bomb: 250, rainbow: 300, extra: 200, rocket: 200 };
  function boosterPrice(k) { return WBALLS[k] ? wbCoins(k) : BOOST_PRICE[k]; }
  const ROCKET_SVG = '<svg viewBox="0 0 64 64" width="44" height="44"><g transform="rotate(45 32 32)"><path d="M26 44 L32 60 L38 44Z" fill="#ffb23a" stroke="#ff5a1a" stroke-width="2.5" stroke-linejoin="round"/><path d="M22 36 L14 48 L24 46Z M42 36 L50 48 L40 46Z" fill="#3d9bff" stroke="#2a1d5c" stroke-width="3" stroke-linejoin="round"/><path d="M32 4 C44 14 44 32 40 46 H24 C20 32 20 14 32 4Z" fill="#ff4f6d" stroke="#2a1d5c" stroke-width="3.5" stroke-linejoin="round"/><circle cx="32" cy="24" r="6" fill="#cfefff" stroke="#2a1d5c" stroke-width="3"/><path d="M26 12 Q32 6 38 12" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".7"/></g></svg>';

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
    G.level = L; G.demo = false; G.interCounted = false;
    const bl = []; let extra = 0;
    G.rocketStart = false;
    for (const k of boosters || []) { if (k === 'extra') extra += 2; else if (k === 'rocket') G.rocketStart = true; else bl.push(k); }
    const roll = gemRollFor(L);
    G.gemRoll = roll;
    G.sim = new Sim(L, { boosters: bl, wlv: wlvAll(), viewTest, gems: Math.max(0, roll.n - roll.got), gemSeed: 1 + Math.floor(Math.random() * 1e9), power: cannonPower(L) });
    if (extra) { const cols = G.sim.queue.filter(k => COL[k]); for (let i = 0; i < extra; i++) G.sim.queue.push(cols[i % Math.max(1, cols.length)] || 'heavy'); }
    setTheme(L.world); buildLevelView(); frameCamera();
    if (window.Bosses) { if (L.boss) setTimeout(() => { if (G.level === L) window.Bosses.start(L); }, 0); else window.Bosses.stop(); }
    G.mode = 'play'; G.paused = false; G.ended = false; G.endT = 0; G.finalT = 0; G.slowT = 0; G.timeScale = 1;
    G.lastSlow = false; G.combo = 0; hintUntil = 0; if (window.Jugada) Jugada.reset();
    setWeatherChip(L);
    G.shotBase = null; stats().plays = (stats().plays || 0) + 1; persist();
    G.clubLoseDone = false; if (L.club && window.Club) window.Club.onStart(L);
    if (L.weekly) RH('weeklyStart', L);
    G.casi = 0; G.firstShot = false; G.swapped = false; G.winShown = false; G.winAt = 0; G.extraUsed = false; shownScore = 0; lastTray = '';
    $('btnFinish').hidden = true; G.cannonKind = null;
    G.aimTarget.set(0, 1.5, 0);
    $('hudLevel').textContent = L.weekly ? 'DESAFÍO' : L.club ? ({ ex: 'EXPEDICIÓN ' + L.pos, lg: 'LIGA ' + L.pos, boss: 'JEFE COLOSAL' })[L.club] : L.xm ? 'NAVIDAD ' + L.pos : L.hw ? 'HALLOWEEN ' + L.pos : L.bonus ? 'EXTRA ' + L.world : 'NIVEL ' + id;
    Audio.setStyle(L.hw ? 'spooky' : L.xm ? 'xmas' : 'normal'); G.hwWorld = false; G.xmWorld = false;
    G.candyRun = 0; G.xcandyRun = 0; hwCandyChip(); xmCandyChip();
    $('meterTarget').style.left = (L.target * 100) + '%';
    $('meterFill').style.transition = 'none'; $('meterFill').style.width = '0%'; void $('meterFill').offsetWidth; $('meterFill').style.transition = '';
    hideAll(); $('hud').classList.add('on');
    centerText(L.name, '#fff', 32);
    G.introT = 1.2;
    G.debutT = L.debut && !save.seenDebut?.[L.debut] ? 1.4 : 0; G.debutRing = null;
    if (L.debut) { save.seenDebut = save.seenDebut || {}; }
  }

  function finishWin() {
    if (!G.interCounted) { G.interCounted = true; save.interN = (save.interN || 0) + 1; }   // partidas terminadas desde el último anuncio entre niveles
    const sim = G.sim, L = G.level;
    if (save.lvFails && save.lvFails[L.id]) delete save.lvFails[L.id];
    G.winShown = true;
    G.saveBefore = JSON.parse(JSON.stringify(save));   // por si el jugador sigue jugando con +3 bolas
    const stars = L.boss ? (G.bossStars || 1) : sim.stars();
    $('winRibbon').textContent = L.boss ? '¡JEFE DERROTADO!' : '¡DEMOLIDO!';
    const cp = L.club && window.Club ? window.Club._P() : null;
    const prevStars = cp ? ((L.club === 'ex' ? cp.ex : L.club === 'lg' ? cp.lgS : {})[L.pos] || 0) : (save.stars[L.id] || 0);
    G.mystery = !L.bonus && !L.boss && !L.hw && !L.xm && !L.club && !L.weekly && !prevStars && L.id % 5 === 0;
    if (!L.club && !L.weekly) { save.stars[L.id] = Math.max(prevStars, stars); save.best[L.id] = Math.max(save.best[L.id] || 0, sim.score); }
    if (!L.bonus && !L.hw && !L.xm && !L.club && !L.weekly && L.id >= save.unlocked) save.unlocked = Math.min(L.id + 1, LEVELS.length + 1);
    if (L.hw) { const h = hwState(); h.unlocked = Math.max(h.unlocked, L.pos + 1); }
    if (L.xm) { const h = xmState(); h.unlocked = Math.max(h.unlocked, L.pos + 1); }
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
    // caramelos por superar un nivel de Halloween (los del jefe, más)
    if (L.hw && hwActive()) { const c = Math.round((L.boss ? 25 : 3 + stars * 2) * liveMult('candy')); addCandy(c); gifts += ' · +' + c + ' caramelos'; }
    if (L.xm && xmActive()) { const c = Math.round((L.boss ? 25 : 3 + stars * 2) * liveMult('candy')); addXCandy(c); gifts += ' · +' + c + ' caramelos navideños'; }
    if (L.club && window.Club) { const t = window.Club.onEnd(L, { win: true, stars }); if (t) setTimeout(() => toast(t, 2600), 1500); }
    // bonificación temporal del panel (x2 monedas…)
    { const ex = RH('win', { L, stars, score: sim.score }); if (ex) gifts += ex; }   // fichas del mini-evento, desafío, logros
    const cm = liveMult('coins'); if (cm > 1) { coins = Math.round(coins * cm); gifts += ` · x${cm} evento`; }
    G.pendingCoins = coins; save.coins += coins;
    save.streak = Math.min(save.streak + 1, 9); save.played++;
    { const st = stats(); st.wins = (st.wins || 0) + 1; st.winRun = (st.winRun || 0) + 1; st.bestRun = Math.max(st.bestRun || 0, st.winRun); if (L.boss) st.bossWins = (st.bossWins || 0) + 1; }
    { const sp = streakPrize(L); const el = $('winStreak'); el.hidden = !sp; if (sp) el.innerHTML = `<i class="ico ico-fire"></i><small>RACHA ${save.streak}</small> ${sp}`; }
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
    const xpWin = Math.round(((prevStars ? 5 : 10) + stars * (prevStars ? 2 : 5) + (L.hard && !prevStars ? 15 : 0) + (L.bonus && !prevStars ? 20 : 0)) * liveMult('xp'));
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
    $('winNext').textContent = L.club ? (window.Club && window.Club.next(L) ? 'SIGUIENTE' : 'CLUB') : L.xm ? (L.pos < 50 ? 'SIGUIENTE' : 'NAVIDAD') : L.hw ? (L.pos < 50 ? 'SIGUIENTE' : 'HALLOWEEN') : G.newBonus ? '¡NIVEL EXTRA!' : (L.bonus || L.id < LEVELS.length) ? 'SIGUIENTE' : 'NIVELES';
    if (G.newBonus) setTimeout(() => toast('¡Nivel extra desbloqueado! 3 estrellas en todo el mundo ' + L.world), 1300);
    if (L.bonus && stars >= 3) setTimeout(() => toast('¡Bola dorada! Úsala cuando quieras con el botón dorado durante una partida', 3200), 1300);
    const sw = $('winStars');
    sw.innerHTML = [0, 1, 2].map(i => starBig(false, 'star' + (i === 1 ? ' mid' : ''))).join('');
    show('win'); Audio.win(); vibe([20, 40, 20]);
    if (window.Jugada && !G.demo) Jugada.winUi(L, stars);
    const els = sw.querySelectorAll('.star');
    for (let i = 0; i < stars; i++) setTimeout(() => { if (els[i]) els[i].classList.add('on'); Audio.star(i); }, 350 + i * 330);
  }

  // fases de monetización: 1-9 luna de miel (regalo), desde el 10 anuncio o monedas
  const HONEYMOON = Levels.HARD[0] - 1;   // antes del primer nivel difícil, perder regala bolas
  function showLose() {
    const sim = G.sim, L = G.level;
    if (!G.interCounted) { G.interCounted = true; save.interN = (save.interN || 0) + 1; if (L && L.world && !L.club && !L.weekly) { save.lvFails = save.lvFails || {}; save.lvFails[L.id] = (save.lvFails[L.id] || 0) + 1; } }
    if (L.weekly) RH('lose', { L, score: sim.score });
    if (L.club === 'boss' && window.Club && !G.clubLoseDone) { G.clubLoseDone = true; const t = window.Club.onEnd(L, { win: false }); if (t) setTimeout(() => toast(t, 2600), 600); }
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
    $('loseStarter').textContent = 'Pack de inicio · 1.000 monedas + 3 bombas · ' + iapPrice(SHOP.find(x => x.id === 'starter'));
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
    fakeAd(8, cb);
  }
  // anuncio simulado (navegador y app sin AdMob): cuenta atrás de «secs» segundos
  function fakeAd(secs, cb) {
    const el = $('ad'); el.classList.add('on'); Audio.stopMusic();
    let n = secs; $('adCnt').textContent = n;
    const iv = setInterval(() => {
      n--; $('adCnt').textContent = n > 0 ? n : '✓';
      if (n <= 0) { clearInterval(iv); setTimeout(() => { el.classList.remove('on'); if (save.music) Audio.startMusic(); cb(true); }, 300); }
    }, 1000);
  }
  window.onChromaReward = (ok, why) => {
    const cb = window.__rewardCb; window.__rewardCb = null;
    if (why === 'noad') toast('No hay anuncios disponibles ahora mismo. Prueba en un momento.', 2600);
    if (cb) cb(!!ok);
  };
  // anuncio entre niveles (intersticial): en la app es uno de verdad (corto); en el navegador, el simulado de 5 segundos
  function showInterstitial(next) {
    const A = window.ChromaAndroid;
    if (A && A.showInterstitial) { window.onChromaInterstitial = () => { window.onChromaInterstitial = null; next(); }; A.showInterstitial(); return; }
    fakeAd(5, () => next());
  }
  // muesca y barras del sistema (Android 15+ dibuja de borde a borde): margen en píxeles CSS
  window.ChromaInsets = (t0, r0, b0, l0) => {
    const st = document.documentElement.style;
    st.setProperty('--sat', (+t0 || 0) + 'px'); st.setProperty('--sar', (+r0 || 0) + 'px');
    st.setProperty('--sab', (+b0 || 0) + 'px'); st.setProperty('--sal', (+l0 || 0) + 'px');
  };


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
  const FRESH_BALL = { candy: 'w2', crystal: 'w5', temple: 'w4', forest: 'w8', fair: 'w2', neon: 'w10', orchard: 'w8', reef: 'w4', toys: 'w2', dino: 'w9' };
  function worldBallOf(w) {
    const W = WORLDS[w - 1]; if (!W) return 'w1';
    if (W.biome === 'sea') return 'w' + (1 + Math.min(4, Math.floor((w - 1) / 3) % 5));
    return BIOME_BALL[W.biome] || FRESH_BALL[W.biome] || 'w1';
  }
  const wbOpen = k => (testOn() && save.testAll) || worldsOpen() >= WBALLS[k].world;
  function wbLevel(k) {
    let lv = 1;
    const open = (testOn() && save.testAll) ? 100 : worldsOpen();
    for (let w = 11; w <= open; w++) if (worldBallOf(w) === k) lv++;
    return Math.min(10, lv);
  }
  const wbCoins = k => 300 + 60 * WBALLS[k].world;           // en la tienda
  const wbGems = k => (WBALLS[k].world <= 5 ? 5 : 8);        // antes de la partida
  const wlvAll = () => { const o = {}; for (const k of WB_KEYS) o[k] = wbLevel(k); return o; };

  // ---------------- tienda ----------------
  const SHOP = [
    { id: 'g1', sec: 'gems', name: 'Puñado de gemas', desc: '30 gemas', gems: 30, x2: true, price: '0,99 €', grant: () => { save.gems = (save.gems || 0) + 30; } },
    { id: 'g2', sec: 'gems', name: 'Cofre de gemas', desc: '165 gemas: el Pase Pro y de sobra', gems: 165, extra: 10, x2: true, price: '4,99 €', noAds: true, grant: () => { save.gems = (save.gems || 0) + 165; } },
    { id: 'g3', sec: 'gems', name: 'Tesoro de gemas', desc: '360 gemas', gems: 360, extra: 20, x2: true, price: '9,99 €', noAds: true, grant: () => { save.gems = (save.gems || 0) + 360; } },
    { id: 'noads', name: 'Quitar anuncios', desc: 'Sin anuncios entre niveles para siempre', price: '3,99 €', grant: () => { save.adsRemoved = true; } },
    { id: 'starter', name: 'Pack de inicio', desc: '1.000 monedas + 3 bombas + 3 arcoíris', price: '1,99 €', once: true, noAds: true, grant: () => { save.coins += 1000; save.boosters.bomb += 3; save.boosters.rainbow += 3; save.starter = true; } },
    { id: 'c1', name: 'Bolsa de monedas', desc: '500 monedas', x2: true, price: '0,99 €', grant: () => { save.coins += 500; } },
    { id: 'c2', name: 'Cofre de monedas', desc: '3.000 monedas', extra: 20, x2: true, price: '4,99 €', noAds: true, grant: () => { save.coins += 3000; } },
    { id: 'b1', name: 'Bomba', desc: 'Potenciador para empezar un nivel', coins: 250, grant: () => { save.boosters.bomb++; } },
    { id: 'b2', name: 'Bola arcoíris', desc: 'Toma el color del primer bloque', coins: 300, grant: () => { save.boosters.rainbow++; } },
    { id: 'b3', name: '+2 bolas', desc: 'Empiezas con dos bolas más', coins: 200, grant: () => { save.boosters.extra++; } },
    { id: 'b4', name: 'Cohete de salida', desc: 'Al empezar revienta la fila con más bloques', coins: 200, grant: () => { save.boosters.rocket = (save.boosters.rocket || 0) + 1; } },
    // packs de los avisos personalizados (antes de un nivel) y la oferta de la semana: no salen en la lista de la tienda
    { id: 'ayuda', offer: true, name: 'Pack de ayuda', price: '0,99 €', has: { bomb: 1, rainbow: 1, extra: 1 }, grant: () => grant({ bomb: 1, rainbow: 1, extra: 1 }) },
    { id: 'cazajefes', offer: true, name: 'Pack Cazajefes', price: '2,99 €', gemsAlt: 200, noAds: true, has: { bomb: 3, rocket: 2, rainbow: 2 }, grant: () => grant({ bomb: 3, rocket: 2, rainbow: 2 }) },
    { id: 'arsenal', offer: true, name: 'Pack Arsenal', price: '2,99 €', gemsAlt: 200, noAds: true, has: { bomb: 5, rainbow: 5, extra: 5 }, grant: () => grant({ bomb: 5, rainbow: 5, extra: 5 }) },
    { id: 'semanal', offer: true, name: 'Oferta de la semana', price: '2,99 €', noAds: true, grant: () => { const w = weekPack(); grant(w.has); save.weekBuy = w.wk; } },
  ];
  // compras con Google Play: el precio que se ve es el de Play (en la moneda del jugador); el premio se da cuando Play
  // confirma el pago y después se avisa a Play de que ya se ha entregado (si no, lo devuelve a los 3 días).
  const IAP_IDS = SHOP.filter(s => s.price).map(s => s.id);
  const iap = { prices: {}, asked: 0 };
  const IOS = window.ChromaPlatform === 'ios';                 // app de iPhone y iPad (ios/): de momento sin compras ni anuncios
  const payNative = () => !!(window.ChromaAndroid && window.ChromaAndroid.billingBuy);
  function iapQuery() { if (payNative() && Date.now() - iap.asked > 5000) { iap.asked = Date.now(); try { window.ChromaAndroid.billingQuery(JSON.stringify(IAP_IDS)); } catch (e) { /* nada */ } } }
  const iapPrice = s => iap.prices[s.id] || s.price;
  const iapOnce = id => id === 'noads' || id === 'starter';
  // Comprar cualquier COFRE o PACK (los de 1,99 € o más: noAds en SHOP) quita para siempre los anuncios entre niveles.
  // Los puñados y bolsas de 0,99 € no. Los anuncios con premio (los que eliges ver) siguen, porque son opcionales.
  function paidNoAds(it) { if (save.adsRemoved || !(it && it.noAds)) return false; save.adsRemoved = true; persist(); return true; }
  // la primera compra de gemas o monedas (con dinero) da el doble; el resto de compras no la gastan
  const x2Open = () => !save.x2Used;
  function firstX2(it) { if (!it || !it.x2 || save.x2Used) return false; it.grant(); save.x2Used = true; persist(); return true; }
  // oferta de la semana: cambia cada lunes (mismo contenido para todos), se compra una vez por semana
  const WEEK_PACKS = [{ gems: 100, bomb: 4 }, { coins: 2000, golden: 2, rainbow: 2 }, { gems: 60, bomb: 3, rainbow: 3, golden: 1 }, { coins: 1500, gems: 60, extra: 3 }];
  // lo que costaría por separado en la tienda (gemas y monedas al precio del puñado y la bolsa; ventajas a su precio en monedas)
  const EUR = { gems: 0.99 / 30, coins: 0.99 / 500, bomb: 250 * 0.99 / 500, rainbow: 300 * 0.99 / 500, extra: 200 * 0.99 / 500, rocket: 200 * 0.99 / 500, golden: 600 * 0.99 / 500 };
  function weekPack() {
    const wk = Math.floor((Date.now() - WEEK_EPOCH) / (7 * 864e5)), has = WEEK_PACKS[((wk % WEEK_PACKS.length) + WEEK_PACKS.length) % WEEK_PACKS.length];
    let v = 0; for (const k in has) v += has[k] * (EUR[k] || 0);
    return { wk, has, value: v, end: WEEK_EPOCH + (wk + 1) * 7 * 864e5, bought: save.weekBuy === wk };
  }
  // fichas de lo que trae un pack (iconos del juego)
  function packChips(h) {
    const IC = { coins: '<i class="coin"></i>', gems: '<i class="gem"></i>', bomb: '<i class="ball bBomb"></i>', rainbow: '<i class="ball bRainbow"></i>', extra: '<i class="ball bPlus2"></i>', golden: '<i class="ball bGolden"></i>',
      rocket: '<span class="rk">' + ROCKET_SVG.replace(/width="44" height="44"/, 'width="22" height="22"') + '</span>' };
    return Object.keys(h).map(k => `<span>${IC[k] || ''}${k === 'coins' || k === 'gems' ? h[k].toLocaleString('es-ES') : '×' + h[k]}</span>`).join('');
  }
  function iapGrant(id, token) {
    const it = SHOP.find(s => s.id === id); if (!it) return;
    save.iapDone = save.iapDone || [];
    if (token && save.iapDone.includes(token)) { try { window.ChromaAndroid.billingFinish(token, !iapOnce(id)); } catch (e) { /* nada */ } return; }
    it.grant(); if (token) { save.iapDone.push(token); save.iapDone = save.iapDone.slice(-60); }
    const dbl = firstX2(it), freed = paidNoAds(it);
    stats().iap = (stats().iap || 0) + 1; persist(); setCoins(); Audio.win(); toast(dbl ? '¡Primera compra: te damos el DOBLE!' : freed ? '¡Gracias por tu compra! Ya no verás anuncios entre niveles' : '¡Gracias por tu compra!', 3000);
    if (it.offer) offerBought(it);
    if (token) try { window.ChromaAndroid.billingFinish(token, !iapOnce(id)); } catch (e) { /* nada */ }
    if ($('shop').classList.contains('on')) { const sc = $('shopList').scrollTop; openShop(); $('shopList').scrollTop = sc; }
    if ($('lose').classList.contains('on') && id === 'starter') showLose();
  }
  window.onBilling = m => {
    if (!m) return;
    if (m.type === 'products') {
      let ch = false;
      for (const it of m.items || []) if (it && it.id && it.price && iap.prices[it.id] !== it.price) { iap.prices[it.id] = it.price; ch = true; }
      // solo se vuelve a pintar la tienda si cambia algún precio (antes se repintaba siempre y borraba el código que se estaba escribiendo)
      if (ch && $('shop').classList.contains('on')) { const sc = $('shopList').scrollTop; openShop(); $('shopList').scrollTop = sc; }
    } else if (m.type === 'purchase') iapGrant(m.id, m.token);
    else if (m.type === 'owned') {
      // restaurar: lo que se compra una sola vez sigue siendo suyo (al reinstalar o en otro móvil)
      let ch = false;
      for (const id of m.ids || []) { if (id === 'noads' && !save.adsRemoved) { save.adsRemoved = true; ch = true; } if (id === 'starter' && !save.starter) { save.starter = true; ch = true; } }
      if (ch) persist();
    } else if (m.type === 'error' && m.code !== 1) toast('No se ha podido completar la compra. No se te ha cobrado nada.', 2800);
  };
  // compras simuladas (modo prueba o probador, botón en Ajustes): no pasan por Google Play ni se cobra nada
  // solo en la app de pruebas (TEST_MODE); por defecto, activadas (esa app no está en Google Play)
  const fakePay = () => TEST_MODE && save.fakePay !== false && !window.RR_REAL_PAY;   // RR_REAL_PAY: pruebas de Google Play simulado
  function iapBuy(it) {
    if (fakePay()) { it.grant(); const d = firstX2(it); paidNoAds(it); persist(); setCoins(); Audio.coin(); toast(d ? 'Compra simulada: primera compra, ¡el DOBLE!' : 'Compra simulada hecha (no se ha cobrado nada)'); if (it.offer) offerBought(it); if ($('shop').classList.contains('on')) openShop(); return true; }
    if (payNative()) {
      if (!iap.prices[it.id]) { iapQuery(); toast('La tienda de Google Play no responde. Comprueba la conexión y vuelve a probar.', 2800); return; }
      window.ChromaAndroid.billingBuy(it.id); return;
    }
    if (TEST_MODE) { it.grant(); const d = firstX2(it); paidNoAds(it); persist(); setCoins(); Audio.coin(); toast(d ? 'Compra de prueba: primera compra, ¡el DOBLE!' : 'Compra de prueba hecha (no se ha cobrado nada)'); if (it.offer) offerBought(it); if ($('shop').classList.contains('on')) openShop(); return true; }
    toast(IOS ? 'Las compras llegarán pronto a la app de iPhone y iPad.' : 'Las compras solo están disponibles en la app de Android.', 2600);
  }
  function openShop(focus) {
    iapQuery();
    // si se repinta con la tienda abierta, el código regalo que se estaba escribiendo no se pierde
    const ci = $('shop').classList.contains('on') && $('shCode'), keep = ci ? { v: ci.value, f: document.activeElement === ci, m: $('shMsg') ? $('shMsg').textContent : '', d: ci.disabled } : null;
    $('shopNote').textContent = fakePay() ? 'Compras simuladas: no se cobra nada.' : payNative() ? 'Pagos seguros con Google Play.' : TEST_MODE ? 'Compras de prueba: no se cobra nada.' : IOS ? 'Las compras llegarán pronto a la app de iPhone y iPad.' : 'Las compras solo están disponibles en la app de Android.';
    const items = SHOP.filter(s => !(s.once && save.starter) && s.id !== 'noads' && !s.offer);   // «Quitar anuncios» lo hace ya cualquier cofre o pack
    const SIC = { g1: '<i class="gem"></i>', g2: '<i class="gems2"></i>', g3: '<i class="chest crystal"></i>', starter: '<i class="chest gold"></i>', c1: '<i class="coin"></i>', c2: '<i class="chest wood"></i>', b1: '<i class="ball bBomb"></i>', b2: '<i class="ball bRainbow"></i>', b3: '<i class="ball bPlus2"></i>', b4: '<span style="display:inline-block;width:34px;height:34px">' + ROCKET_SVG.replace(/width="44" height="44"/, 'width="34" height="34"') + '</span>' };
    const x2 = x2Open();
    const row = s => `<div class="shopitem">${SIC[s.id] ? '<div class="sic">' + SIC[s.id] + '</div>' : ''}<div class="stx"><b>${s.name}${s.extra ? `<i class="xtra">+${s.extra} % EXTRA</i>` : ''}</b><span>${s.desc}</span>${x2 && s.x2 ? '<em class="x2tag">🎁 ×2 en tu 1.ª compra</em>' : ''}${s.noAds && !save.adsRemoved ? '<em class="noadtag">🚫 + sin anuncios para siempre</em>' : ''}</div><button class="btn ${s.coins ? 'gold' : 'green'}" data-id="${s.id}">${s.coins ? '<i class="coin"></i>' + s.coins : iapPrice(s)}</button></div>`;
    const wrow = k => {
      const open = wbOpen(k), have = save.boosters[k] || 0;
      return `<div class="shopitem wb ${open ? '' : 'locked'}"><div class="ball ${CSSB[k]}"></div><div><b>${WBALLS[k].name} <small>nv. ${wbLevel(k)}${have ? ' · tienes ' + have : ''}</small></b><span>${open ? WB_DESC[k] : 'Se desbloquea en el mundo ' + WBALLS[k].world}</span></div>` +
        (open ? `<button class="btn gold" data-wb="${k}"><i class="coin"></i>${wbCoins(k)}</button>` : '<span class="lockico">&#128274;</span>') + '</div>';
    };
    // pestañas: Ofertas, Gemas, Bolas y Monedas (cada una baja a su sección)
    const TAG = { g2: 'MÁS POPULAR', g3: 'MEJOR VALOR', c2: 'MEJOR VALOR' };
    const st = items.find(s => s.id === 'starter');
    const feat = st ? `<div class="feat"><div class="frays"></div><div class="ftag">OFERTA ÚNICA</div><div class="fic"><i class="chest gold"></i></div>
      <div class="ftx"><b>${st.name}</b><div class="fit"><span><i class="coin"></i>1.000</span><span><i class="ball bBomb"></i>×3</span><span><i class="ball bRainbow"></i>×3</span></div></div>
      <div class="fbuy"><button class="btn green" data-id="starter">${iapPrice(st)}</button><small>solo una vez${save.adsRemoved ? '' : ' · sin anuncios'}</small></div></div>` : '';
    const noAdsBan = save.adsRemoved ? '<div class="noadsban ok">✓ Sin anuncios entre niveles</div>'
      : '<div class="noadsban"><i>🚫</i><span><b>Cualquier cofre o pack</b> quita para siempre los anuncios entre niveles.</span></div>';
    // canjear un código regalo también desde la tienda (los mismos códigos del panel que en Ajustes)
    const online = !save.kid && !save.noOnline;
    const codeCard = online ? `<div class="rdcard" id="sRedeem"><i class="rdic">🎟️</i><div class="rdtx"><b>¿Tienes un código regalo?</b><small>Escríbelo aquí y recoge tu premio</small>
      <div class="rdrow"><input id="shCode" class="lbinput" maxlength="20" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ROCKET2026"><button class="btn green" id="shRedeem">CANJEAR</button></div><p class="rdmsg" id="shMsg"></p></div></div>` : '';
    const x2Ban = x2 ? '<div class="x2ban"><i>🎁</i><span><b>¡El DOBLE en tu primera compra!</b> Cualquier paquete de gemas o monedas te da el doble.</span></div>' : '';
    const wp = weekPack(), wIt = SHOP.find(s => s.id === 'semanal'), wPr = iapPrice(wIt), wEur = / ?€$/.test(wPr) ? +wPr.replace(/[^\d,]/g, '').replace(',', '.') : 0;
    const wkCard = `<div class="wkoff${wp.bought ? ' done' : ''}"><i class="rtag">OFERTA DE LA SEMANA</i><div class="wkhead"><b>Oferta de la semana</b><small class="wkcd">⏳ ${leftTxt(wp.end - Date.now())}</small></div>
      <div class="wkit">${packChips(wp.has)}</div>
      <div class="wkbuy">${wp.bought ? '<span class="wkok">✓ Ya la tienes · el lunes cambia</span>' : `${wEur ? `<s><span>valor</span> ${wp.value.toFixed(2).replace('.', ',')} €</s>` : ''}<span class="wkx">×${(Math.floor(wp.value / (wEur || 2.99) * 2) / 2).toString().replace('.', ',')} <span>de valor</span></span><button class="btn green" data-id="semanal">${wPr}</button>`}</div>
      ${!wp.bought && !save.adsRemoved ? '<em class="noadtag">🚫 + sin anuncios para siempre</em>' : ''}</div>`;
    const rowT = s => TAG[s.id] ? row(s).replace('<div class="shopitem">', `<div class="shopitem hot"><i class="rtag">${TAG[s.id]}</i>`) : row(s);
    const by = ids => items.filter(s => ids.includes(s.id)).map(rowT).join('');
    const hw = hwActive(), xm = xmActive();
    $('shopTabs').innerHTML = (RH('shopTab') || '') + (xm ? `<button data-to="sXm" class="hwtab xmtab" aria-label="Navidad"><span class="xti">${treeSvg()}</span></button>` : '') + (hw ? '<button data-to="sHw" class="hwtab" aria-label="Halloween">🎃</button>' : '') + [['sTmp', 'emo:⏳', 'Temporales'], ['sOff', 'ico ico-fire', 'Ofertas'], ['sCan', 'emo:🎨', 'Cañones'], ['sGem', 'gem', 'Gemas'], ['sBall', 'ball bB', 'Bolas'], ['sCoin', 'coin', 'Monedas']].concat(online ? [['sRedeem', 'emo:🎟️', 'Código']] : [])
      .map(([id, ic, t]) => `<button data-to="${id}">${ic.startsWith('emo:') ? `<i class="emo">${ic.slice(4)}</i>` : `<i class="${ic}"></i>`}${t}</button>`).join('');
    $('shopTabs').classList.toggle('withhw', hw || xm || !!RH('shopTab'));
    // el Pack de inicio (la forma más barata de quitar los anuncios), arriba del todo mientras no se haya comprado
    $('shopList').innerHTML = feat + x2Ban + (xm ? xmShopHtml() : '') + (hw ? hwShopHtml() : '') + (RH('shopTop') || '') + tmpShopHtml() + `<div class="sechead" id="sOff"><span>Ofertas</span></div>${codeCard}${noAdsBan}${wkCard}` + canShopHtml() +
      `<div class="sechead" id="sGem"><span>Gemas · para el Pase Pro</span></div>${by(['g1', 'g2', 'g3'])}` +
      `<div class="sechead" id="sBall"><span>Potenciadores</span></div>${by(['b1', 'b2', 'b3'])}` +
      `<div class="sechead"><span>Bolas de los mundos</span></div>${WB_KEYS.map(wrow).join('')}` +
      `<div class="sechead" id="sCoin"><span>Monedas</span></div>${by(['c1', 'c2'])}`;
    const goTab = id => {
      const el = $(id), L = $('shopList'); if (!el) return;
      L.scrollTop = el.offsetTop - L.offsetTop - 14;   // deja libre la franja difuminada de arriba
      $('shopTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.to === id));
    };
    $('shopTabs').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { Audio.click(); goTab(b.dataset.to); }));
    $('shopTabs').querySelector('button').classList.add('on');
    RH('shopBind', $('shopList'));
    bindCos($('shopList'), to => { const sc = $('shopList').scrollTop; openShop(to); if (!to) $('shopList').scrollTop = sc; });
    if ($('shRedeem')) {
      if (keep && !keep.d) { const c = $('shCode'); c.value = keep.v; $('shMsg').textContent = keep.m; if (keep.f) try { c.focus({ preventScroll: true }); } catch (e) { /* nada */ } }
      $('shRedeem').addEventListener('click', () => { Audio.init(); Audio.click(); doRedeem($('shCode'), $('shMsg')); });
      $('shCode').addEventListener('keydown', e => { if (e.key === 'Enter') doRedeem($('shCode'), $('shMsg')); });
    }
    $('shopList').querySelectorAll('button[data-hw]').forEach(b => b.addEventListener('click', () => { Audio.init(); hwBuy(b.dataset.hw); }));
    $('shopList').querySelectorAll('button[data-xm]').forEach(b => b.addEventListener('click', () => { Audio.init(); xmBuy(b.dataset.xm); }));
    $('shopList').querySelectorAll('button[data-wb]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.wb, cost = wbCoins(k);
      if (save.coins < cost) { toast('No tienes monedas suficientes'); return; }
      save.coins -= cost; save.boosters[k] = (save.boosters[k] || 0) + 1; persist(); setCoins(); Audio.coin(); toast('¡' + WBALLS[k].name + ' comprada!');
      const sc = $('shopList').scrollTop; openShop(); $('shopList').scrollTop = sc;
    }));
    $('shopList').querySelectorAll('button[data-id]').forEach(b => b.addEventListener('click', () => {
      const it = SHOP.find(s => s.id === b.dataset.id);
      if (it.id === 'semanal' && weekPack().bought) { toast('Ya tienes la oferta de esta semana. El lunes llega otra'); return; }
      if (!it.coins) { iapBuy(it); return; }
      if (save.coins < it.coins) { toast('No tienes monedas suficientes'); return; } save.coins -= it.coins;
      it.grant(); persist(); setCoins(); Audio.coin(); toast('¡Comprado!');
      openShop();
    }));
    setCoins(); $('shop').classList.add('on');
    if (focus) goTab({ gems: 'sGem', coins: 'sCoin', balls: 'sBall', hw: 'sHw', xm: 'sXm', tmp: 'sTmp', code: 'sRedeem', can: 'sCan', bskin: 'sBskin', trail: 'sTrail', mini: 'sMini' }[focus] || 'sOff');
  }

  // ---------------- cañones y bolas: mejoras, cañones con más fuerza, aspectos y la pestaña «Temporales» ----------------
  // save.skins = { owned, equip } (aspectos del cañón) · save.can = { lv, own, eq } (nivel de mejora y cañones) · save.bskin = { own, eq } (bolas)
  function canSave() {
    const c = save.can && typeof save.can === 'object' ? save.can : (save.can = {});
    c.lv = Math.max(1, Math.min(5, c.lv | 0 || 1)); if (!Array.isArray(c.own)) c.own = ['base']; if (!c.own.includes('base')) c.own.unshift('base');
    if (!Cannons.MODEL[c.eq] || !c.own.includes(c.eq)) c.eq = 'base';
    return c;
  }
  function bSave() {
    const b = save.bskin && typeof save.bskin === 'object' ? save.bskin : (save.bskin = {});
    if (!Array.isArray(b.own)) b.own = ['clasica']; if (!b.own.includes('clasica')) b.own.unshift('clasica');
    if (!Cannons.BALL[b.eq] || !b.own.includes(b.eq)) b.eq = 'clasica';
    return b;
  }
  // fuerza del cañón en una partida: en la liga de clubes todos tiran igual (sin mejoras ni cañones fuertes)
  function cannonPower(L) { if (L && L.club === 'lg') return null; const c = canSave(); return Cannons.power(c.eq, c.lv); }
  const COS_RAR = { base: '', common: 'COMÚN', rare: 'RARO', epic: 'ÉPICO', legend: 'LEGENDARIO', pass: 'PASE PRO', event: 'EVENTO', streak: 'RACHA', up: 'MEJORA', model: 'CAÑÓN' };
  // save.trail = { own, eq }: estelas de las bolas
  function tSave() {
    const t = save.trail && typeof save.trail === 'object' ? save.trail : (save.trail = {});
    if (!Array.isArray(t.own)) t.own = ['ninguna']; if (!t.own.includes('ninguna')) t.own.unshift('ninguna');
    if (!Cannons.TRAIL[t.eq] || !t.own.includes(t.eq)) t.eq = 'ninguna';
    return t;
  }
  const cosDef = (k, id) => k === 'skin' ? SKINS[id] : k === 'ball' ? Cannons.BALL[id] : k === 'model' ? Cannons.MODEL[id] : k === 'trail' ? Cannons.TRAIL[id] : null;
  const cosOwned = (k, id) => k === 'skin' ? save.skins.owned.includes(id) : k === 'ball' ? bSave().own.includes(id) : k === 'model' ? canSave().own.includes(id) : k === 'trail' ? tSave().own.includes(id) : false;
  const cosOn = (k, id) => k === 'skin' ? save.skins.equip === id : k === 'ball' ? bSave().eq === id : k === 'model' ? canSave().eq === id : k === 'trail' ? tSave().eq === id : false;
  // «Temporales»: 2 cañones legendarios y 1 bola legendaria que cambian cada lunes, 2 ofertas del día (-30 %) y, la
  // primera semana de cada temporada, el cañón del Pase Pro de la anterior. El panel puede elegir los de la semana (live.tmp).
  const WEEK_EPOCH = Date.UTC(2026, 9, 5);                     // un lunes
  const TMP_PAIRS = [['diamante', 'volcan'], ['tesoro', 'holo'], ['diamante', 'holo'], ['volcan', 'tesoro']];
  const TMP_BALLS = ['gema', 'pixel'], TMP_TRAILS = ['rayo', 'cometa'];
  const PASS_LEFT_GEMS = 300;
  const hash = n => { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); return (n ^ (n >>> 15)) >>> 0; };
  function tmpNow() {
    const t = Date.now(), wk = Math.floor((t - WEEK_EPOCH) / (7 * 864e5)), m4 = ((wk % 4) + 4) % 4;
    let sk = TMP_PAIRS[m4], ball = TMP_BALLS[((wk % 2) + 2) % 2], wEnd = WEEK_EPOCH + (wk + 1) * 7 * 864e5;
    const lc = liveCfg().tmp;
    if (lc && lc.on !== false && liveWin(lc)) {
      const ls = (Array.isArray(lc.sk) ? lc.sk : []).filter(id => SKINS[id]).slice(0, 3); if (ls.length) sk = ls;
      if (lc.ball === '' || lc.ball === 'none') ball = null; else if (Cannons.BALL[lc.ball]) ball = lc.ball;
      if (lc.end) wEnd = +lc.end;
    }
    const items = sk.map(id => ({ k: 'skin', id, g: SKINS[id].g || 300, tag: 'week' }));
    if (ball) items.push({ k: 'ball', id: ball, g: Cannons.BALL[ball].g || 200, tag: 'week' });
    { const tr = TMP_TRAILS[((wk % 2) + 2) % 2]; items.push({ k: 'trail', id: tr, g: Cannons.TRAIL[tr].g || 200, tag: 'week' }); }
    // ofertas del día (lo de la tienda que aún no tienes), iguales para el mismo jugador todo el día
    const day = dayKey(), dEnd = (day + 1) * 864e5 + new Date().getTimezoneOffset() * 6e4;
    const pool = [].concat(Cannons.SKINS.filter(x => x.how === 'shop').map(x => ({ k: 'skin', id: x.id })), Cannons.BALLS.filter(x => x.how === 'shop').map(x => ({ k: 'ball', id: x.id })))
      .filter(q => !cosOwned(q.k, q.id));
    const seed = hash(day * 7919 + [...(save.pid || 'x')].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 0)), days = [];
    for (let i = 0; i < 2 && pool.length; i++) {
      const q = pool.splice(hash(seed + i * 101) % pool.length, 1)[0], d = cosDef(q.k, q.id);
      days.push(d.c ? Object.assign(q, { c: Math.round(d.c * 0.7 / 50) * 50, was: d.c, tag: 'day' }) : Object.assign(q, { g: Math.round(d.g * 0.7), was: d.g, tag: 'day' }));
    }
    // cañón del Pase Pro de la temporada anterior: solo la primera semana de la nueva
    const si = seasonIndex(), pEnd = SEASON_EPOCH + si * SEASON_DAYS * 864e5 + 7 * 864e5;
    const pass = si > 0 && t < pEnd ? { k: 'skin', id: PASS_SKIN(si - 1), g: PASS_LEFT_GEMS, tag: 'pass' } : null;
    return { items, days, pass, wEnd, dEnd, pEnd };
  }
  function leftTxt(ms) { ms = Math.max(0, ms); const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60; return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`; }
  // precio de algo en la tienda ahora mismo (las ofertas del día y los temporales mandan)
  function cosPrice(k, id) {
    const T = tmpNow(), hit = [].concat(T.items, T.days, T.pass ? [T.pass] : []).find(q => q.k === k && q.id === id);
    if (hit) return hit.c ? { c: hit.c } : { g: hit.g };
    const d = cosDef(k, id); if (!d || (k !== 'model' && d.how !== 'shop')) return null;
    return d.c ? { c: d.c } : d.g ? { g: d.g } : null;
  }
  function cosEquip(k, id) {
    if (!cosOwned(k, id)) return false;
    if (k === 'skin') save.skins.equip = id; else if (k === 'ball') bSave().eq = id; else if (k === 'model') canSave().eq = id; else if (k === 'trail') tSave().eq = id;
    persist(); applySkin(); Audio.click(); return true;
  }
  function cosBuy(k, id) {
    const d = cosDef(k, id), pr = cosPrice(k, id);
    if (!d || !pr || cosOwned(k, id)) return false;
    if (pr.c && save.coins < pr.c) { toast('No tienes monedas suficientes'); return false; }
    if (pr.g && (save.gems || 0) < pr.g) { toast(`Te faltan ${pr.g - (save.gems || 0)} gemas`, 2600); return false; }
    if (pr.c) save.coins -= pr.c; else save.gems -= pr.g;
    if (k === 'skin') save.skins.owned.push(id); else if (k === 'ball') bSave().own.push(id); else if (k === 'trail') tSave().own.push(id); else canSave().own.push(id);
    cosEquip(k, id); setCoins(); Audio.win(); vibe([20, 20, 40]);
    toast('¡' + d.name + ' es tuyo!', 2400);
    return true;
  }
  function cosUpgrade() {
    const c = canSave(), nx = Cannons.UPGRADES[c.lv]; if (!nx) return false;
    if (save.coins < nx.c) { toast('No tienes monedas suficientes'); return false; }
    save.coins -= nx.c; c.lv++; persist(); applySkin(); setCoins(); Audio.win(); vibe([20, 20, 40]);
    toast('¡Cañón mejorado: nivel ' + c.lv + '!', 2400);
    return true;
  }
  // tarjetas de la tienda
  const priceHtml = p => p.c ? `<i class="coin"></i>${p.c.toLocaleString('es-ES')}` : `<i class="gem"></i>${p.g}`;
  function cosCard(q, extra) {
    const d = cosDef(q.k, q.id); if (!d) return '';
    const own = cosOwned(q.k, q.id), on = own && cosOn(q.k, q.id), rar = q.k === 'model' ? (d.id === 'cohete' ? 'legend' : 'model') : d.rar;
    const pr = own ? null : q.c || q.g ? (q.c ? { c: q.c } : { g: q.g }) : cosPrice(q.k, q.id);
    const how = { pass: 'Pase Pro', event: 'Evento', streak: 'Racha diaria', temp: '⏳ En Temporales' }[d.how];
    const btn = on ? '<button class="btn gray" disabled>EN USO</button>' : own ? `<button class="btn green" data-eq="${q.k}:${q.id}">USAR</button>`
      : pr ? `<button class="btn ${pr.c ? 'gold' : 'green'}" data-buy="${q.k}:${q.id}">${q.was ? `<s>${q.was.toLocaleString('es-ES')}</s>` : ''}${priceHtml(pr)}</button>` : `<span class="chow">${how || ''}</span>`;
    const ph = q.k === 'ball' ? 'radial-gradient(circle at 35% 30%,#ffd0d8,#ff4f6d 45%,#8a1030 75%,transparent 77%)' : d.css || 'rgba(255,255,255,.15)';
    const th = `<div class="cth" data-th="${q.k}:${q.id}" style="--ph:${q.k === 'trail' ? TRAIL_PH : ph}"></div>`;   // estelas también en 3D (22-11)
    return `<div class="cosc r-${rar}${own ? ' own' : ''}${on ? ' on' : ''}">${COS_RAR[rar] ? `<i class="crar">${COS_RAR[rar]}</i>` : ''}${extra || ''}${th}<b>${d.name}</b>${q.k === 'model' ? `<small>${d.desc}</small>` : ''}${btn}</div>`;
  }
  function tmpShopHtml() {
    const T = tmpNow();
    return `<div class="tmphead" id="sTmp"><b>⏳ Temporales</b><small><span>Legendarios que cambian cada semana</span> · <span>quedan</span> <span class="tmpLeft">${leftTxt(T.wEnd - Date.now())}</span></small></div>` +
      `<div class="cgrid">${T.items.map(q => cosCard(q, '<i class="ctmp">⏳</i>')).join('')}</div>` +
      (T.pass ? `<div class="sechead"><span><span>Del Pase Pro anterior</span> · <span class="passLeft">${leftTxt(T.pEnd - Date.now())}</span></span></div><div class="cgrid">${cosCard(T.pass, '<i class="ctmp">⏳</i>')}</div>` : '') +
      (T.days.length ? `<div class="sechead"><span><span>Ofertas del día · -30 %</span> · <span class="dayLeft">${leftTxt(T.dEnd - Date.now())}</span></span></div><div class="cgrid">${T.days.map(q => cosCard(q, '<i class="ctmp off">-30%</i>')).join('')}</div>` : '');
  }
  function canShopHtml() {
    const c = canSave(), U = Cannons.UPGRADES, cur = U[c.lv - 1], nx = U[c.lv];
    const pips = U.map((u, i) => `<i class="${i < c.lv ? 'on' : ''}"></i>`).join('');
    const up = `<div class="upcard"><div class="cth big" data-th="up:base:${c.lv}"></div><div class="uptx"><small>MEJORAS DEL CAÑÓN</small><b>Nivel ${c.lv} · ${cur.name}</b><span class="pips">${pips}</span>` +
      `<span>${cur.desc}</span>${nx ? `<em>Siguiente: ${nx.name} · ${nx.desc}</em>` : ''}</div>` +
      (nx ? `<button class="btn gold" data-up="1">MEJORAR<br><span>${priceHtml({ c: nx.c })}</span></button>` : '<button class="btn gray" disabled>NIVEL MÁXIMO</button>') + '</div>';
    const bs = bSave(), ballsSorted = Cannons.BALLS.slice().sort((a, b) => (bs.own.includes(b.id) ? 1 : 0) - (bs.own.includes(a.id) ? 1 : 0));
    const skSorted = Cannons.SKINS.slice().sort((a, b) => (save.skins.owned.includes(b.id) ? 1 : 0) - (save.skins.owned.includes(a.id) ? 1 : 0));
    return `<div class="sechead" id="sCan"><span>Mejoras · sirven para cualquier cañón</span></div>${up}` +
      `<div class="sechead"><span>Cañones con más fuerza</span></div><div class="cgrid">${Cannons.MODELS.map(m => cosCard({ k: 'model', id: m.id })).join('')}</div>` +
      '<p class="cnote">En la liga de clubes todos los cañones tiran con la fuerza normal.</p>' +
      `<div class="sechead"><span>Aspectos del cañón</span></div><div class="cgrid">${skSorted.map(x => cosCard({ k: 'skin', id: x.id })).join('')}</div>` +
      `<div class="sechead" id="sBskin"><span>Aspectos de las bolas · conservan su color</span></div><div class="cgrid">${ballsSorted.map(x => cosCard({ k: 'ball', id: x.id })).join('')}</div>` +
      `<div class="sechead" id="sTrail"><span>Estelas de las bolas</span></div><div class="cgrid">${Cannons.TRAILS.map(x => cosCard({ k: 'trail', id: x.id })).join('')}</div>` +
      `<p class="cnote">${masteryLines().map(m => m.txt).join(' · ')}</p>`;
  }
  // miniaturas 3D (se pintan poco a poco) y botones de las tarjetas
  function fillThumbs(box) {
    const want = [], els = {};
    box.querySelectorAll('.cth[data-th]').forEach(el => {
      const [k, id, lv] = el.dataset.th.split(':'), q = k === 'up' ? { kind: 'model', id: 'base', lv: +lv } : { kind: k, id };
      const key = Cannons.thumbKey(q); (els[key] = els[key] || []).push(el); want.push(q);
    });
    Cannons.thumb(want, (key, url) => { if (url) for (const el of els[key] || []) { el.style.backgroundImage = `url(${url})`; el.classList.add('ok'); } });
  }
  function bindCos(box, again) {
    fillThumbs(box);
    box.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => { Audio.init(); const [k, id] = b.dataset.buy.split(':'); if (cosBuy(k, id)) again(); else if (cosPrice(k, id) && cosPrice(k, id).g && (save.gems || 0) < cosPrice(k, id).g) again('gems'); }));
    box.querySelectorAll('[data-eq]').forEach(b => b.addEventListener('click', () => { Audio.init(); const [k, id] = b.dataset.eq.split(':'); if (cosEquip(k, id)) again(); }));
    box.querySelectorAll('[data-up]').forEach(b => b.addEventListener('click', () => { Audio.init(); if (cosUpgrade()) again(); }));
  }
  // ---------------- maestría y estelas ----------------
  // Cada tiro suma a la maestría del aspecto de cañón que llevas. Las estelas de maestría se ganan con N tiros
  // entre todos los aspectos de una rareza (p. ej. 500 con cañones legendarios → estela de Fuego).
  const RB_COLS = [0xff4f6d, 0xffd23f, 0x5fd45a, 0x3d9bff, 0xa66bff];
  const RAR_TXT = { common: 'comunes', rare: 'raros', epic: 'épicos', legend: 'legendarios' };
  function masteryOf(rar) { const m = save.mastery || {}; let n = 0; for (const s of Cannons.SKINS) if (s.rar === rar && m[s.id]) n += m[s.id]; return n; }
  function masteryLines() {
    return Cannons.TRAILS.filter(t => t.how === 'mastery').map(t => {
      const n = Math.min(t.m.n, masteryOf(t.m.rar)), own = tSave().own.includes(t.id);
      return { id: t.id, p: own ? 1 : n / t.m.n, txt: own ? `Estela ${t.name}: conseguida` : `Estela ${t.name}: ${n}/${t.m.n} tiros con cañones ${RAR_TXT[t.m.rar]}` };
    });
  }
  function masteryShot() {
    const sk = (save.skins && save.skins.equip) || 'classic'; if (sk === 'classic') return;
    save.mastery = save.mastery || {}; save.mastery[sk] = (save.mastery[sk] || 0) + 1;
    for (const t of Cannons.TRAILS) if (t.how === 'mastery' && !tSave().own.includes(t.id) && masteryOf(t.m.rar) >= t.m.n) {
      tSave().own.push(t.id); persist(); setTimeout(() => { toast('¡Maestría! Nueva estela: ' + t.name, 3000); Audio.win(); }, 400);
    }
  }
  const trailFx = () => { const t = Cannons.TRAIL[tSave().eq]; return t && t.fx; };

  // ---------------- mi colección (en el perfil) y el cañón de antes de jugar ----------------
  // Todo lo que tienes (y con candado lo que te falta): aspectos del cañón, cañones y bolas. Tocar uno lo pone.
  const COL_KIND = { skin: 'Aspectos', model: 'Cañones', ball: 'Bolas', trail: 'Estelas' }, COL_ICO = { skin: '🎨', model: '🎯', ball: '⚽', trail: '✨' };
  function colList(k) {
    const src = k === 'skin' ? Cannons.SKINS : k === 'model' ? Cannons.MODELS : k === 'trail' ? Cannons.TRAILS : Cannons.BALLS;
    return src.map(d => ({ k, id: d.id, d, own: cosOwned(k, d.id), on: cosOwned(k, d.id) && cosOn(k, d.id) }))
      .sort((a, b) => (b.on - a.on) || (b.own - a.own));
  }
  function cosHow(k, id) {
    const d = cosDef(k, id), pr = cosPrice(k, id);
    if (pr) return pr.c ? `${pr.c.toLocaleString('es-ES')} monedas en la tienda` : `${pr.g} gemas en la tienda`;
    if (d.how === 'mastery') { const m = masteryLines().find(x => x.id === id); return m ? m.txt : 'Se consigue con maestría'; }
    return { pass: 'Se consigue en el Pase Pro', event: 'Se consigue en un evento', streak: 'Se consigue con la racha diaria', temp: 'Sale a veces en «Temporales»', logro: 'Se consigue con un logro', mini: 'Se consigue en un mini-evento' }[d.how] || 'En la tienda';
  }
  const shortName = n => n.replace(/^Cañón (de |del )?(?=\p{Lu})/u, '');
  const BALL_PH = 'radial-gradient(circle at 35% 30%,#ffd0d8,#ff4f6d 45%,#8a1030 75%,transparent 77%)';
  const TRAIL_PH = 'radial-gradient(ellipse at 50% 50%,rgba(255,255,255,.12),rgba(20,8,60,.35) 70%)';
  const thKey = q => q.k === 'model' && q.id === 'base' ? 'up:base:' + canSave().lv : q.k + ':' + q.id;
  function colItem(q) {
    const rar = q.k === 'model' ? (q.id === 'cohete' ? 'legend' : 'model') : q.d.rar;
    const ph = q.k === 'ball' ? BALL_PH : q.d.css || 'rgba(255,255,255,.15)';
    const th = `<div class="cth" data-th="${q.k === 'trail' ? 'trail:' + q.id : thKey(q)}" style="--ph:${q.k === 'trail' ? TRAIL_PH : ph}"></div>`;
    return `<button class="colit r-${rar}${q.own ? '' : ' lock'}${q.on ? ' on' : ''}" data-col="${q.k}:${q.id}">${th}<b>${shortName(q.d.name)}</b></button>`;
  }
  // tocar una pieza: si es tuya, la pones; si no, te dice cómo conseguirla
  function colTap(k, id) {
    if (cosOwned(k, id)) { if (!cosOn(k, id)) { cosEquip(k, id); toast('Puesto: ' + cosDef(k, id).name); } return true; }
    Audio.click(); toast(cosDef(k, id).name + ' · ' + cosHow(k, id), 2600); return false;
  }
  let colF = 'skin';
  function mountCol(el) {
    if (!el) return;
    const n = k => colList(k).filter(q => q.own).length, tot = k => colList(k).length;
    const own = n('skin') + n('model') + n('ball') + n('trail'), all = tot('skin') + tot('model') + tot('ball') + tot('trail');
    el.innerHTML = `<div class="colbox"><div class="colhead"><span>🎒 Mi colección</span><small>${own} de ${all}</small></div><div class="colbar"><i style="width:${(100 * own / all).toFixed(0)}%"></i></div>
      <div class="colchips">${['skin', 'model', 'ball', 'trail'].map(k => `<button data-colf="${k}" class="${k === colF ? 'on' : ''}"><span>${COL_ICO[k]} ${COL_KIND[k]}</span><small>${n(k)}/${tot(k)}</small></button>`).join('')}</div>
      ${colF === 'model' ? `<div class="colnote">Mejora del cañón: nivel ${canSave().lv} de 5 · sirve para cualquier cañón</div>` : ''}
      ${colF === 'trail' ? masteryLines().map(m => `<div class="mastery"><span>${m.txt}</span><i><b style="width:${Math.round(100 * m.p)}%"></b></i></div>`).join('') : ''}
      <div class="colgrid">${colList(colF).map(colItem).join('')}</div>
      <div class="colnote">Toca uno para usarlo · los del candado se consiguen en la tienda o en el pase</div>
      <button class="btn gold small colshop">🛒 CONSEGUIR MÁS</button></div>`;
    fillThumbs(el);
    el.querySelectorAll('[data-colf]').forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); Audio.init(); Audio.click(); colF = b.dataset.colf; mountCol(el); }));
    el.querySelectorAll('[data-col]').forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); Audio.init(); const [k, id] = b.dataset.col.split(':'); if (colTap(k, id)) { const g = el.querySelector('.colgrid'), sc = g.scrollTop; mountCol(el); el.querySelector('.colgrid').scrollTop = sc; } }));
    el.querySelector('.colshop').addEventListener('click', ev => { ev.stopPropagation(); Audio.init(); Audio.click(); openShop(colF === 'ball' ? 'bskin' : colF === 'trail' ? 'trail' : 'can'); });
  }
  // ventana del nivel: los 3 huecos (cañón, aspecto, bolas); al tocar uno sube un cajón con lo que tienes
  function renderLoadout() {
    const box = $('preLoad'); if (!box) return;
    const c = canSave(), L = G.preId ? byId(G.preId) : null;
    const md = Cannons.MODEL[c.eq], sk = SKINS[save.skins.equip] || SKINS.classic, bl = Cannons.BALL[bSave().eq];
    const slot = (k, th, ph, lab, name) => `<button class="lslot" data-ls="${k}"><span class="led">✎</span><div class="cth" data-th="${th}" style="--ph:${ph}"></div><small>${lab}</small><b>${name}</b></button>`;
    box.innerHTML = `<div class="lhead">Tu cañón para este nivel</div><div class="lrow">` +
      slot('model', c.eq === 'base' ? 'up:base:' + c.lv : 'model:' + c.eq, '#3a2f6e', 'CAÑÓN', shortName(md.name) + (c.lv > 1 ? ' · nv. ' + c.lv : '')) +
      slot('skin', 'skin:' + sk.id, sk.css, 'ASPECTO', shortName(sk.name)) +
      slot('ball', 'ball:' + bl.id, BALL_PH, 'BOLAS', bl.name) +
      `<button class="lslot" data-ls="trail"><span class="led">✎</span><div class="cth" data-th="trail:${tSave().eq}" style="--ph:${TRAIL_PH}"></div><small>ESTELA</small><b>${Cannons.TRAIL[tSave().eq].name}</b></button>` + '</div>' +
      (L && L.club === 'lg' ? '<div class="lnote">En la liga de clubes todos los cañones tiran con la fuerza normal.</div>' : '');
    fillThumbs(box);
    box.querySelectorAll('[data-ls]').forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); Audio.init(); Audio.click(); openCosSheet(b.dataset.ls); }));
  }
  function openCosSheet(k) {
    const sh = $('cosSheet'); if (!sh) return;
    const list = colList(k), own = list.filter(q => q.own).length;
    $('csTitle').textContent = { skin: 'Elige el aspecto', model: 'Elige el cañón', ball: 'Elige tus bolas', trail: 'Elige la estela' }[k];
    $('csCount').textContent = own + ' de ' + list.length;
    $('csGrid').innerHTML = list.map(colItem).join(''); $('csGrid').scrollTop = 0;
    fillThumbs($('csGrid'));
    $('csGrid').querySelectorAll('[data-col]').forEach(b => b.addEventListener('click', ev => {
      ev.stopPropagation(); Audio.init(); const [kk, id] = b.dataset.col.split(':');
      if (colTap(kk, id)) { closeCosSheet(); renderLoadout(); }
    }));
    $('csShop').onclick = ev => { ev.stopPropagation(); Audio.init(); Audio.click(); closeCosSheet(); openShop(k === 'ball' ? 'bskin' : k === 'trail' ? 'trail' : 'can'); };
    sh.classList.add('on');
  }
  function closeCosSheet() { const sh = $('cosSheet'); if (sh) sh.classList.remove('on'); }
  if ($('cosSheet')) $('cosSheet').addEventListener('click', ev => { if (ev.target.id === 'cosSheet') { Audio.click(); closeCosSheet(); } });
  if ($('csX')) $('csX').addEventListener('click', ev => { ev.stopPropagation(); Audio.click(); closeCosSheet(); });

  setInterval(() => {
    if (document.hidden || !$('shop').classList.contains('on')) return;
    const T = tmpNow(), now = Date.now();
    document.querySelectorAll('.tmpLeft').forEach(el => { el.textContent = leftTxt(T.wEnd - now); });
    document.querySelectorAll('.dayLeft').forEach(el => { el.textContent = leftTxt(T.dEnd - now); });
    document.querySelectorAll('.passLeft').forEach(el => { el.textContent = leftTxt(T.pEnd - now); });
  }, 30000);

  // ---------------- pase de temporada ----------------
  // 30 niveles por temporada de 28 días. Se avanza con estrellas. Gratis para todos; Pro con 150 gemas (≈ 4,99 €).
  const SEASON_DAYS = 28, SEASON_EPOCH = Date.UTC(2026, 9, 5);
  const SEASON_NAMES = ['de la Feria', 'del Hielo', 'Pirata', 'de Cristal'];
  const PASS_PRO_GEMS = 150;
  const tierCost = t => t <= 10 ? 4 : t <= 20 ? 6 : 8;            // estrellas para llegar al nivel t
  const PASS_NEED = []; { let acc = 0; for (let t = 1; t <= 30; t++) { acc += tierCost(t); PASS_NEED.push(acc); } }
  const SKINS = Cannons.SKIN;          // aspectos del cañón (cannons.js): nombre, muestra de color, rareza, precio…
  // cañón del Pase Pro (nivel 30) según la temporada; la siguiente semana sale una semana en «Temporales»
  const PASS_SKIN = si => ['rainbow', 'robot', 'bosque'][((si % 3) + 3) % 3];
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
    [R({ gems: 3 }), R({ gems: 10, bskin: 'dragonb' })],
    [R({ coins: 180 }), R({ coins: 400 })],
    [R({ rainbow: 1 }), R({ rainbow: 3 })],
    [R({ coins: 180 }), R({ extra: 4 })],
    [R({ bomb: 2 }), R({ gems: 5 })],
    [R({ gems: 3 }), R({ golden: 1 })],
    [R({ coins: 200 }), R({ coins: 500 })],
    [R({ rainbow: 1 }), R({ bomb: 4 })],
    [R({ coins: 250 }), R({ gems: 10 })],
    [R({ extra: 2 }), R({ rainbow: 4, trail: 'corazones' })],
    [R({ golden: 1, gems: 5 }), R({ skin: 'rainbow', golden: 2, coins: 1000 })],
  ];
  function seasonIndex() { return Math.max(0, Math.floor((Date.now() - SEASON_EPOCH) / (SEASON_DAYS * 864e5))); }
  function seasonDaysLeft(si) { return Math.max(0, Math.ceil((SEASON_EPOCH + (si + 1) * SEASON_DAYS * 864e5 - Date.now()) / 864e5)); }
  function passTier(pts) { let t = 0; while (t < 30 && pts >= PASS_NEED[t]) t++; return t; }
  function grant(r) {
    const out = [];
    if (r.bskin && !bSave().own.includes(r.bskin) && Cannons.BALL[r.bskin]) { bSave().own.push(r.bskin); out.push('Bolas ' + Cannons.BALL[r.bskin].name); }
    if (r.trail && !tSave().own.includes(r.trail) && Cannons.TRAIL[r.trail]) { tSave().own.push(r.trail); out.push('Estela ' + Cannons.TRAIL[r.trail].name); }
    if (r.coins) { save.coins += r.coins; out.push(r.coins + ' monedas'); }
    if (r.gems) { save.gems = (save.gems || 0) + r.gems; out.push(r.gems + ' gemas'); }
    for (const k of ['bomb', 'rainbow', 'extra', 'rocket', 'golden']) if (r[k]) { save.boosters[k] = (save.boosters[k] || 0) + r[k]; out.push(r[k] + ' ' + ({ bomb: r[k] > 1 ? 'bombas' : 'bomba', rainbow: 'arcoíris', extra: '× +2 bolas', rocket: r[k] > 1 ? 'cohetes' : 'cohete', golden: r[k] > 1 ? 'bolas doradas' : 'bola dorada' })[k]); }
    if (r.skin && !save.skins.owned.includes(r.skin)) { save.skins.owned.push(r.skin); save.skins.equip = r.skin; applySkin(); out.push(SKINS[r.skin].name); }
    return out;
  }
  function ensureSeason() {
    const si = seasonIndex();
    if (save.pass && save.pass.season === si) { PASS[29][1].skin = PASS_SKIN(si); return; }
    if (save.pass) {   // fin de temporada: lo ya ganado y sin reclamar se entrega solo
      PASS[29][1].skin = PASS_SKIN(save.pass.season);
      const p = save.pass, t = passTier(p.pts), got = [];
      for (let i = 0; i < t; i++) {
        if (!p.free.includes(i)) got.push(...grant(PASS[i][0]));
        if (p.pro && !p.proClaimed.includes(i)) got.push(...grant(PASS[i][1]));
      }
      if (got.length) setTimeout(() => toast('Fin de temporada: te hemos dado lo que no habías reclamado', 3500), 600);
    }
    save.pass = { season: si, pts: 0, free: [], proClaimed: [], pro: false };
    PASS[29][1].skin = PASS_SKIN(si);
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
    if (r.bskin) { parts.push('<i class="bskinsw"></i>'); txt.push('Bolas ' + Cannons.BALL[r.bskin].name); }
    if (r.trail) { parts.push(`<i class="trailsw" style="--tr:${Cannons.TRAIL[r.trail].css}"></i>`); txt.push('Estela ' + Cannons.TRAIL[r.trail].name); }
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

  // ---------------- Cubi, la mascota del tutorial ----------------
  // Es un bloque amarillo del juego de verdad: se dibuja una vez con el mismo 3D (forma, brillo y cara) y se guarda como imagen.
  let cubiCache = null;
  function cubiFrames() {
    if (cubiCache) return cubiCache;
    const out = {};
    try {
      const cv = document.createElement('canvas'); cv.width = cv.height = 256;
      const r = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true });
      r.setClearColor(0x000000, 0); r.outputColorSpace = renderer.outputColorSpace; r.toneMapping = renderer.toneMapping; r.toneMappingExposure = renderer.toneMappingExposure;
      const sc = new THREE.Scene(); sc.environment = scene.environment;
      sc.add(new THREE.HemisphereLight(0xffffff, 0xb08a5a, 2.1)); const dl = new THREE.DirectionalLight(0xfff4e0, 3.2); dl.position.set(3, 5, 6); sc.add(dl);
      const g = new THREE.Group(); g.add(new THREE.Mesh(roundedGeo(1, 1, 1), jelly.y));
      const fm = new THREE.MeshBasicMaterial({ map: FACES.y.normal, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      const face = new THREE.Mesh(faceGeo, fm); face.scale.set(0.92, 0.92, 1); face.position.z = 0.506; g.add(face);
      g.rotation.set(0.14, -0.32, 0); sc.add(g);
      const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50); cam.position.set(0, 0.12, 3.1); cam.lookAt(0, 0, 0);
      FACES.y.cry = FACES.y.cry || faceTex('y', 'cry');
      for (const mood of ['normal', 'blink', 'scared', 'cry']) { fm.map = FACES.y[mood]; fm.needsUpdate = true; r.render(sc, cam); out[mood] = cv.toDataURL('image/png'); }
      r.dispose(); if (r.forceContextLoss) r.forceContextLoss();
    } catch (e) { /* sin WebGL: el tutorial usa un cubo dibujado */ }
    return (cubiCache = out);
  }

  // ---------------- configuración en directo (panel de administración) ----------------
  // Lo que se cambia en el panel sin publicar versión: fechas de eventos, bonificaciones x2, avisos, regalos para todos,
  // códigos regalo, frecuencia de anuncios, mantenimiento y versión mínima. Ver live.js.
  const liveCfg = () => (window.Live && window.Live.cfg) || {};
  const liveMult = k => Math.min(5, (window.Live ? window.Live.mult(k) : 1) * (k === 'coins' && (save.boost2 || 0) > Date.now() ? 2 : 1));
  const liveWin = o => (window.Live ? window.Live.inWin(o) : false);
  const lt = s => (window.I18N ? I18N.t(s) : s);
  // número de compilación (1.0.N): lo pone tools/build.js en Ajustes; en las versiones de pruebas no hay
  const BUILD = (() => { const m = /\b1\.0\.(\d+)\b/.exec(($('settings') || document.body).textContent); return m ? +m[1] : 0; })();
  const STORE_URL = 'https://play.google.com/store/apps/details?id=com.lostanarchygames.rocketrush';
  function openUrl(u) { try { if (window.ChromaAndroid && window.ChromaAndroid.openUrl) { window.ChromaAndroid.openUrl(u); return; } } catch (e) { /* nada */ } window.open(u, '_blank'); }
  // texto escrito en el panel, en el idioma del jugador si se tradujo (si no, en español)
  function ltxt(o, f) { const L = window.I18N ? I18N.lang : 'es', t = o && o.tr && o.tr[L]; return String((t && t[f]) || (o && o[f]) || ''); }
  const escH = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function leftTxt(ms) { ms = Math.max(0, ms); const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60; return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`; }
  const BOOST_TXT = { coins: 'MONEDAS', xp: 'EXPERIENCIA', candy: 'CARAMELOS' }, BOOST_IC = { coins: '🪙', xp: '⭐', candy: '🍬' };
  // cartel de la portada con las bonificaciones activas
  function liveUi() {
    const el = $('liveBoost'); if (!el) return;
    const bs = window.Live ? window.Live.boosts().filter(b => BOOST_TXT[b.kind] && (b.kind !== 'candy' || hwActive() || xmActive())) : [];
    const mine = (save.boost2 || 0) > Date.now();
    el.hidden = !bs.length && !mine;
    el.innerHTML = (mine ? `<span>🪙 x2 ${escH(lt('monedas'))} · ⏳ ${leftTxt(save.boost2 - Date.now())}</span>` : '') + bs.map(b => `<span>${BOOST_IC[b.kind]} x${Math.min(5, +b.mult)} ${escH(lt(BOOST_TXT[b.kind]))}${b.end ? ' · ⏳ ' + leftTxt(+b.end - Date.now()) : ''}</span>`).join('');
  }
  // ventana de avisos (actualizar, mantenimiento, regalos, noticias y canjear código)
  function liveBox(o) {
    $('lbRib').textContent = lt(o.rib || 'AVISO');
    if (o.icoHtml) $('lbIco').innerHTML = o.icoHtml; else $('lbIco').textContent = o.ico || '';
    $('liveBox').classList.toggle('offer', !!o.offer);
    $('lbTitle').textContent = o.title || ''; $('lbTitle').hidden = !o.title;
    $('lbBody').textContent = o.body || ''; $('lbBody').hidden = !o.body;
    $('lbExtra').innerHTML = o.extra || '';
    $('lbX').hidden = !!o.noClose;
    const B = $('lbBtns'); B.innerHTML = '';
    for (const b of o.btns || []) {
      const el = document.createElement('button'); el.className = 'btn ' + (b.cls || 'green'); el.textContent = lt(b.t);
      el.addEventListener('click', ev => { ev.stopPropagation(); Audio.init(); Audio.click(); b.fn(); }); B.appendChild(el);
    }
    $('liveBox').classList.add('on');
  }
  function liveClose() { $('liveBox').classList.remove('on'); setTimeout(liveCheck, 600); }

  // ---------------- avisos personalizados antes de un nivel (ofertas) ----------------
  // ¿Necesitas una ayuda? (3 derrotas o más en el mismo nivel) · ¡A por el jefe! (nivel de jefe) · ¡Pocas ventajas! (te queda 1 o
  // ninguna). Como mucho uno de cada tipo al día, 2 al día en total y nunca dos en el mismo nivel; nunca a menores de 13 ni en el
  // tutorial, ni en clubes, eventos o el desafío semanal. Cada uno trae una salida sin pagar (vídeo, gemas o «No, gracias»).
  const OFFER_MAX_DAY = 2;
  const boostersLeft = () => ['bomb', 'rainbow', 'extra', 'rocket'].reduce((n, k) => n + (save.boosters[k] || 0), 0);
  function offerState() { const d = dayKey(); if (!save.offers || save.offers.day !== d) save.offers = { day: d, seen: {}, n: 0 }; return save.offers; }
  function offerFor(L) {
    if (!L || L.club || L.weekly || L.hw || L.xm || L.bonus || !L.world || save.kid || (navigator.webdriver && !window.RR_OFFERS)) return null;
    if ((save.unlocked || 1) < 8 || IOS) return null;
    const st = offerState(); if (st.n >= OFFER_MAX_DAY) return null;
    if (L.boss && !st.seen.boss) return 'boss';
    if (((save.lvFails || {})[L.id] || 0) >= 3 && !st.seen.help) return 'help';
    if (boostersLeft() <= 1 && (save.unlocked || 1) >= 15 && !st.seen.low) return 'low';
    return null;
  }
  const offerPack = it => `<div class="ofpack${it.id === 'cazajefes' ? ' hot' : ''}">${it.id === 'cazajefes' ? '<i class="rtag">SOLO HOY</i>' : ''}<div class="ofi">${{ ayuda: '🎒', cazajefes: '🏴‍☠️', arsenal: '🧨' }[it.id]}</div><div class="oft"><b>${it.name}</b><span>${packChips(it.has)}</span>${it.noAds && !save.adsRemoved ? (it.gemsAlt ? '<em>🚫 + sin anuncios para siempre pagando con dinero</em><small class="ofgem">💎 Con gemas no se quitan los anuncios</small>' : '<em>🚫 + sin anuncios para siempre</em>') : ''}</div></div>`;
  function offerClose() { $('liveBox').classList.remove('on', 'offer'); }
  function offerBought(it) {
    offerClose();
    if ($('pre').classList.contains('on') && G.preId) { const id = G.preId; openPre(id, true); preSelect(Object.keys(it.has || {})); }
  }
  // pagar un pack con gemas: da lo mismo que con dinero, pero NO quita los anuncios (no pasa por paidNoAds ni cuenta como compra)
  function offerGems(it) {
    const g = it.gemsAlt;
    if ((save.gems || 0) < g) { toast(`Te faltan ${g - (save.gems || 0)} gemas`, 2400); return; }
    save.gems -= g; it.grant(); persist(); setCoins(); Audio.win(); vibe([20, 20, 40]);
    toast(save.adsRemoved ? '¡' + it.name + ' es tuyo!' : '¡' + it.name + ' es tuyo! (con gemas no se quitan los anuncios)', 2600); offerBought(it);
  }
  function maybeOffer(L) {
    const kind = offerFor(L); if (!kind || $('liveBox').classList.contains('on')) return;
    const st = offerState(); st.seen[kind] = 1; st.n++; persist();
    const buy = id => { const it = SHOP.find(x => x.id === id); return { t: lt(it.name.toUpperCase()) + ' · ' + String(iapPrice(it)).replace(/ /g, '\u00a0'), fn: () => iapBuy(it) }; };
    const it = id => SHOP.find(x => x.id === id);
    if (kind === 'help') {
      const n = save.lvFails[L.id], cubi = cubiFrames().cry;
      liveBox({ offer: true, rib: '¿NECESITAS UNA AYUDA?', icoHtml: cubi ? `<img class="lbcubi" src="${cubi}" alt="">` : '😭', title: lt('¡Este nivel se resiste!'),
        body: lt('Llevas {n} intentos. Con un empujón lo pasas seguro.').replace('{n}', n), extra: offerPack(it('ayuda')),
        btns: [{ t: '🎬 ' + lt('+2 bolas gratis (anuncio)'), cls: 'blue', fn: () => showRewarded(ok => { if (!ok) return; save.boosters.extra = (save.boosters.extra || 0) + 1; persist(); offerClose(); openPre(L.id, true); preSelect(['extra']); toast(lt('¡+2 bolas para este intento!')); }) },
          buy('ayuda'), { t: 'No, gracias', cls: 'gray small', fn: offerClose }] });
    } else if (kind === 'boss') {
      liveBox({ offer: true, rib: '¡A POR EL JEFE!', ico: '☠️', title: lt('¡Derrota al jefe a lo grande!'),
        body: lt('{boss} no se rinde fácilmente. Llega con todo tu arsenal.').replace('{boss}', L.bossName ? lt(L.bossName) : lt('El jefe')), extra: offerPack(it('cazajefes')),
        btns: [buy('cazajefes'), { t: lt('Con gemas') + ' · 💎 ' + it('cazajefes').gemsAlt, cls: 'gold', fn: () => offerGems(it('cazajefes')) }, { t: 'Ir sin nada', cls: 'gray small', fn: offerClose }] });
    } else {
      const n = boostersLeft();
      liveBox({ offer: true, rib: '¡POCAS VENTAJAS!', ico: '🧰', title: lt('Tu arsenal está casi vacío'),
        body: (n ? lt('Solo te queda 1 potenciador.') : lt('No te quedan potenciadores.')) + ' ' + lt('Repón antes de los niveles difíciles.'), extra: offerPack(it('arsenal')),
        btns: [buy('arsenal'), { t: lt('Con gemas') + ' · 💎 ' + it('arsenal').gemsAlt, cls: 'gold', fn: () => offerGems(it('arsenal')) }, { t: 'Ahora no', cls: 'gray small', fn: offerClose }] });
    }
  }
  const liveSeen = {};          // en esta sesión (mantenimiento, actualizar sin obligar)
  function liveNext() {
    const c = liveCfg(), u = c.update || {};
    if (BUILD && +u.min > BUILD && (u.force || !liveSeen.update)) return () => {
      liveSeen.update = 1;
      liveBox({ rib: '¡NUEVA VERSIÓN!', ico: '🚀', title: lt('Hay una versión nueva de Rocket Rush'), body: u.msg || lt('Actualiza para seguir jugando con todas las novedades.'), noClose: !!u.force,
        btns: [{ t: 'ACTUALIZAR', fn: () => openUrl(STORE_URL) }].concat(u.force ? [] : [{ t: 'Más tarde', cls: 'gray', fn: liveClose }]) });
    };
    if (c.maint && c.maint.on && !liveSeen.maint) return () => {
      liveSeen.maint = 1;
      liveBox({ rib: 'MANTENIMIENTO', ico: '🛠️', title: lt('Estamos haciendo mejoras'), body: c.maint.msg || lt('Amigos y clasificaciones vuelven enseguida. Puedes seguir jugando.'), btns: [{ t: 'ENTENDIDO', fn: liveClose }] });
    };
    save.liveGot = save.liveGot || {};
    const g = (c.gifts || []).find(x => x && x.id && liveWin(x) && !save.liveGot['g' + x.id]);
    if (g) return () => {
      const r = { coins: +g.coins || 0, gems: +g.gems || 0, bomb: +g.bomb || 0, rainbow: +g.rainbow || 0, golden: +g.golden || 0 };
      const parts = [r.coins && `🪙 ${r.coins}`, r.gems && `💎 ${r.gems}`, r.bomb && `💣 ${r.bomb}`, r.rainbow && `🌈 ${r.rainbow}`, r.golden && `✨ ${r.golden}`].filter(Boolean);
      liveBox({ rib: '¡REGALO!', ico: '🎁', title: ltxt(g, 'title') || lt('Un regalo para ti'), body: ltxt(g, 'body'), extra: `<div class="lbgift">${parts.map(p => `<span>${p}</span>`).join('')}</div>`, noClose: true,
        btns: [{ t: 'RECOGER', fn: () => { save.liveGot['g' + g.id] = Date.now(); grant(r); persist(); setCoins(); Audio.coin(); vibe(20); toast(lt('¡Regalo recogido!')); liveClose(); } }] });
    };
    const n = (c.news || []).find(x => x && x.id && liveWin(x) && !save.liveGot['n' + x.id]);
    if (n) return () => {
      save.liveGot['n' + n.id] = Date.now(); persist();
      liveBox({ rib: 'NOVEDADES', ico: n.ico || '📣', title: ltxt(n, 'title'), body: ltxt(n, 'body'), btns: [{ t: 'ENTENDIDO', fn: liveClose }] });
    };
    return null;
  }
  // solo en la portada, sin otras ventanas ni el tutorial delante
  function liveCheck() {
    if (G.mode !== 'title' || !$('title').classList.contains('on') || document.querySelector('.screen.dim.on') || $('langPick') && !$('langPick').hidden) return;
    if (window.Tutorial && (Tutorial.visible || Tutorial.busy())) return;
    const f = liveNext(); if (f) f();
  }
  // canjear un código regalo (Ajustes): lo comprueba el servidor y se apunta en el móvil para no repetirlo
  function openRedeem() {
    $('settings').classList.remove('on');
    liveBox({ rib: 'CÓDIGO REGALO', ico: '🎟️', title: lt('Escribe tu código'), extra: '<input id="lbCode" class="lbinput" maxlength="20" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ROCKET2026"><p class="sub lbmsg" id="lbMsg"></p>',
      btns: [{ t: 'CANJEAR', fn: doRedeem }, { t: 'Cerrar', cls: 'gray', fn: () => { $('liveBox').classList.remove('on'); $('settings').classList.add('on'); } }] });
    setTimeout(() => { const i = $('lbCode'); if (i) i.focus(); }, 50);
  }
  // canjear un código regalo (Ajustes y tienda): `inp` es la caja donde se escribe y `msg` donde sale la respuesta
  async function doRedeem(inp, msg) {
    inp = inp && inp.nodeType ? inp : $('lbCode'); msg = msg && msg.nodeType ? msg : $('lbMsg'); if (!inp) return;
    const code = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const say = t => { msg.textContent = lt(t); };
    if (code.length < 4) { say('El código no es válido'); return; }
    save.codesUsed = save.codesUsed || {};
    if (save.codesUsed[code]) { say('Ya has canjeado este código'); return; }
    if (!window.Social || !window.Social.redeem) { say('Necesitas conexión a internet'); return; }
    say('Comprobando…');
    try {
      const r = await window.Social.redeem(code);
      save.codesUsed[code] = Date.now();
      const out = grant({ coins: +r.coins || 0, gems: +r.gems || 0, bomb: +r.bomb || 0, rainbow: +r.rainbow || 0, golden: +r.golden || 0 });
      persist(); setCoins(); Audio.win(); vibe([20, 30, 20]);
      say('¡Código canjeado!'); msg.textContent += ' ' + out.map(lt).join(' · ');
      inp.disabled = true;
    } catch (e) {
      say(({ NOT_FOUND: 'El código no existe', EXPIRED: 'Este código ha caducado', USED_UP: 'Este código ya se ha agotado', NOT_YET: 'Este código aún no está activo' })[e.code] || 'Necesitas conexión a internet');
    }
  }

  // ---------------- evento de Halloween ----------------
  // Hasta el 1 de noviembre a las 23:59 (hora de España): mundo de 50 niveles, caramelos en las partidas,
  // tienda de Halloween que se paga con caramelos, portada con el castillo encantado y música de miedo.
  const HW_END = Date.UTC(2026, 10, 1, 22, 59, 59);
  const HWL = Levels.HW || [];
  // las fechas se pueden cambiar desde el panel de administración (config en directo «hw»: on, start, end)
  const hwCfg = () => (window.Live && window.Live.cfg.hw) || null;
  function hwEnd() { const h = hwCfg(); return h && h.end ? +h.end : HW_END; }
  function hwActive() {
    if (!HWL.length) return false;
    if (testOn() && save.hwForce) return true;
    const h = hwCfg(), t = Date.now();
    if (h && h.on === false) return false;
    if (h && h.start && t < +h.start) return false;
    return t < hwEnd();
  }
  function hwState() { if (!save.hw) save.hw = { unlocked: 1 }; return save.hw; }
  function addCandy(n) { save.candy = (save.candy || 0) + n; persist(); hwCandyChip(); document.querySelectorAll('.candyTxt').forEach(el => { el.textContent = save.candy; }); }
  function hwLeft() {
    const ms = Math.max(0, hwEnd() - Date.now()), d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60;
    return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
  }
  let pumpN = 0;
  function pumpSvg() {
    const k = 'pk' + (++pumpN);
    return `<svg viewBox="0 0 100 92" class="pk"><defs><radialGradient id="${k}a" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#ffb347"/><stop offset=".6" stop-color="#ff7a12"/><stop offset="1" stop-color="#c84a00"/></radialGradient>
      <radialGradient id="${k}b" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#fff6a0"/><stop offset="1" stop-color="#ffb000"/></radialGradient></defs>
      <path d="M50 10 C52 2 60 0 64 3 C58 5 55 9 55 15Z" fill="#3f8a2a" stroke="#1f4a12" stroke-width="2.5"/>
      <ellipse cx="30" cy="54" rx="24" ry="32" fill="url(#${k}a)" stroke="#5a2400" stroke-width="3"/><ellipse cx="70" cy="54" rx="24" ry="32" fill="url(#${k}a)" stroke="#5a2400" stroke-width="3"/>
      <ellipse cx="50" cy="54" rx="22" ry="34" fill="url(#${k}a)" stroke="#5a2400" stroke-width="3"/>
      <path d="M32 44 L42 44 L37 34Z M58 44 L68 44 L63 34Z" fill="url(#${k}b)" stroke="#5a2400" stroke-width="2"/>
      <path d="M28 60 Q50 80 72 60 L66 63 L61 59 L55 65 L50 60 L45 65 L39 59 L34 63Z" fill="url(#${k}b)" stroke="#5a2400" stroke-width="2"/>
      <ellipse cx="40" cy="30" rx="7" ry="4" fill="#fff" opacity=".35" transform="rotate(-25 40 30)"/></svg>`;
  }
  // botones del evento: calabaza de la portada y fila «Mundos · Club · Halloween» del mapa
  function hwUi() {
    const on = hwActive();
    const tp = $('hwPump'); if (tp) { tp.hidden = !on; if (on && !tp.__svg) { tp.__svg = 1; tp.querySelector('.pkw').innerHTML = pumpSvg(); } }
    const nb = $('navHw'); if (nb) { nb.hidden = !on; if (on && !nb.__svg) { nb.__svg = 1; nb.querySelector('.pkw').innerHTML = pumpSvg(); } }
    document.querySelectorAll('.hwcdTxt').forEach(el => { el.textContent = hwLeft(); });
    document.querySelectorAll('.candyTxt').forEach(el => { el.textContent = save.candy || 0; });
  }
  setInterval(() => { if (document.hidden) return; const was = $('hwPump') && !$('hwPump').hidden; hwUi(); if (was && !hwActive() && G.mode === 'title' && $('title').classList.contains('on')) goTitle(); }, 30000);
  function hwCandyChip() {
    const el = $('candyChip'); if (!el) return;
    const show = G.mode === 'play' && hwActive() && G.level && (G.level.hw || (G.candyHosts || 0) > 0 || G.candyRun > 0);
    el.hidden = !show; if (show) el.querySelector('b').textContent = save.candy || 0;
  }
  // caramelo recogido en la partida (lo avisa halloween.js cuando cae o revienta el bloque que lo lleva)
  function hwCollect(n, x, y, z) {
    addCandy(n); G.candyRun = (G.candyRun || 0) + n;
    floatText(x, y + 0.6, z, '+' + n + ' 🍬', '#ffd27a', 24, true);
    // el caramelo vuela hasta el contador de arriba
    try {
      const v = new THREE.Vector3(x, y, z).project(camera), chip = $('candyChip');
      if (chip && !chip.hidden) {
        const cr = chip.getBoundingClientRect(), sx = (v.x * 0.5 + 0.5) * innerWidth, sy = (-v.y * 0.5 + 0.5) * innerHeight;
        const el = document.createElement('span'); el.className = 'candyfly'; el.textContent = '🍬'; el.style.left = (sx - 14) + 'px'; el.style.top = (sy - 14) + 'px';
        document.body.appendChild(el); void el.offsetWidth;
        el.style.transform = `translate(${cr.left + 10 - sx}px,${cr.top + 4 - sy}px) scale(.7)`;
        setTimeout(() => { el.remove(); chip.classList.remove('bump'); void chip.offsetWidth; chip.classList.add('bump'); }, 650);
      }
    } catch (e) { /* sin animación */ }
    spawnSprite(x, y, z, 0xffb347, 1.6, 1.2, 0.35, { add: true, alpha: 1 });
    Audio.coin(); vibe(15);
  }
  // mapa del mundo de Halloween
  function goHw() {
    if (!hwActive()) { toast('El evento de Halloween ha terminado'); G.inHw = false; goMap(); return; }
    if (window.Bosses) window.Bosses.stop();
    refundGolden(); $('btnFinish').hidden = true;
    G.inHw = true; G.hwWorld = false; G.mode = 'map'; G.paused = false; $('hud').classList.remove('on');
    const h = hwState();
    loadDemo(HWL[Math.min(h.unlocked, HWL.length) - 1].id);
    Audio.setStyle('spooky');
    renderHw(); setCoins(); hwUi(); show('hwmap');
    const cur = document.querySelector('#hwList .hwlv.cur'); if (cur) cur.scrollIntoView({ block: 'center' });
  }
  function hwBack() { if (G.hwFrom === 'title') goTitle(); else { G.inHw = false; goMap(); } }
  const HW_BOSS_ICO = ['🏴‍☠️', '🧟', '🧌', '👻', '🧛'];
  function renderHw() {
    const hp = document.querySelector('#hwmap .hwhead .pkw'); if (hp && !hp.__svg) { hp.__svg = 1; hp.innerHTML = pumpSvg(); }
    const h = hwState(), all = testOn() && save.testAll, got = HWL.filter(l => (save.stars[l.id] || 0) > 0).length;
    $('hwProg').textContent = got; $('hwBar').style.width = (100 * got / HWL.length) + '%';
    let html = '';
    for (let z = 0; z < 5; z++) {
      const zl = HWL.filter(l => l.zone === z), open = all || zl[0].pos <= h.unlocked;
      html += `<div class="hwsec ${open ? '' : 'lk'}"><h3>${open ? '' : '🔒 '}${zl[0].zoneName}<small>niveles ${z * 10 + 1}-${z * 10 + 10}</small></h3><div class="hwgrid">`;
      for (const l of zl) {
        const st = save.stars[l.id] || 0, un = all || l.pos <= h.unlocked, cur = l.pos === h.unlocked && !st;
        const stars = st ? '<span class="s">' + '★'.repeat(st) + '☆'.repeat(3 - st) + '</span>' : '';
        if (l.boss) html += `<button class="hwlv boss ${un ? '' : 'lk'} ${cur ? 'cur' : ''}" data-id="${l.id}"><span>${un ? HW_BOSS_ICO[z] : '🔒'}</span>JEFE${stars}</button>`;
        else html += `<button class="hwlv ${un ? '' : 'lk'} ${cur ? 'cur' : ''} ${l.hard ? 'hard' : ''}" data-id="${l.id}">${un ? l.pos : '🔒'}${stars}</button>`;
      }
      html += '</div></div>';
    }
    $('hwList').innerHTML = html;
    $('hwList').querySelectorAll('.hwlv').forEach(b => b.addEventListener('click', () => {
      Audio.click();
      const L = byId(+b.dataset.id);
      if (b.classList.contains('lk')) { toast(L.boss ? 'Supera los niveles de la zona para llegar al jefe' : 'Supera el nivel anterior para abrir este'); return; }
      openPre(L.id);
    }));
  }
  // tienda de Halloween: se paga con caramelos
  const HW_SHOP = [
    { id: 'hskin', ic: '🎃', name: 'Cañón Calabaza', desc: 'Cañón exclusivo de Halloween', price: 400, tag: 'EXCLUSIVO', owned: () => save.skins.owned.includes('pumpkin'), grant: () => grant({ skin: 'pumpkin' }) },
    { id: 'hchest', ic: '🧰', name: 'Cofre embrujado', desc: 'Siempre: 250-750 monedas, 1-2 bombas y 3-8 gemas · 50 %: bola arcoíris · 25 %: bola dorada', price: 250, chest: true },
    { id: 'hav', ic: '🧛', name: 'Avatares de Halloween', desc: 'Vampiro, bruja, fantasma, calabaza, calavera y araña para tu perfil', price: 80, owned: () => !!save.hwAvatars, grant: () => { save.hwAvatars = true; return ['avatares de Halloween']; } },
    { id: 'hgold', ic: '✨', name: 'Bola dorada', desc: 'Atraviesa la estructura de lado a lado', price: 220, grant: () => grant({ golden: 1 }) },
    { id: 'hbomb', ic: '💣', name: 'Pack de 3 bombas', desc: 'Para cualquier nivel', price: 120, grant: () => grant({ bomb: 3 }) },
    { id: 'hrain', ic: '🌈', name: '2 bolas arcoíris', desc: 'Toman el color del primer bloque que tocan', price: 140, grant: () => grant({ rainbow: 2 }) },
    { id: 'hgems', ic: '💎', name: '10 gemas', desc: 'Para el Pase Pro', price: 300, grant: () => grant({ gems: 10 }) },
    { id: 'hcoins', ic: '🪙', name: '500 monedas', desc: '', price: 90, grant: () => grant({ coins: 500 }) },
  ];
  function hwShopHtml() {
    const row = it => { const own = it.owned && it.owned();
      return `<div class="hwitem"><span class="ic">${it.ic}</span><div><b>${it.name}${it.tag ? `<span class="tag2">${it.tag}</span>` : ''}</b>${it.desc ? `<small>${it.desc}</small>` : ''}</div>` +
        (own ? '<span class="hwown">✔</span>' : `<button class="hwbuy" data-hw="${it.id}">🍬 ${it.price}</button>`) + '</div>'; };
    return `<div class="hwshoptop" id="sHw"><div><b>🎃 Tienda de Halloween</b><small><span>Hasta el 1 de noviembre</span> · <span class="hwcdTxt">${hwLeft()}</span> · <span>se paga con caramelos</span></small></div><span class="hwcandy">🍬 <span class="candyTxt">${save.candy || 0}</span></span></div>` + HW_SHOP.map(row).join('');
  }
  function hwBuy(id) {
    const it = HW_SHOP.find(x => x.id === id); if (!it) return;
    if ((save.candy || 0) < it.price) { toast(`Te faltan ${it.price - (save.candy || 0)} caramelos. Los consigues en las partidas`); return; }
    save.candy -= it.price;
    if (it.chest) {
      const r = { coins: 250 + Math.floor(Math.random() * 6) * 100, bomb: 1 + (Math.random() < 0.5 ? 1 : 0), gems: 3 + Math.floor(Math.random() * 6) };
      if (Math.random() < 0.5) r.rainbow = 1; if (Math.random() < 0.25) r.golden = 1;
      grant(r); persist(); setCoins(); $('shop').classList.remove('on');
      openChestFX('epic', r, () => openShop('hw'));
      return;
    }
    const got = it.grant(); persist(); setCoins(); Audio.coin(); vibe(20);
    toast('¡Conseguido!' + (got && got.length ? ' ' + got.join(', ') : ''));
    const sc = $('shopList').scrollTop; openShop(); $('shopList').scrollTop = sc;
  }

  // ---------------- evento de Navidad ----------------
  // Del 27 de noviembre (00:00) al 6 de enero a las 23:59 (hora de España) salvo que el panel diga otra cosa (config en directo «xm»):
  // mundo de 50 niveles en el pueblo nevado, regalos con caramelos y bastones, tienda de Navidad y el trineo de Papá Noel.
  // Las 3 semanas antes, el árbol de la portada ya sale con la cuenta atrás hasta que empieza.
  const XM_START = Date.UTC(2026, 10, 26, 23, 0, 0), XM_END = Date.UTC(2027, 0, 6, 22, 59, 59);
  const XM_OLD_START = Date.UTC(2026, 10, 30, 23, 0, 0);   // el antiguo inicio por defecto (1 dic): si el panel lo guardó, vale el nuevo
  const XM_SOON = 21 * 864e5;
  const XML = Levels.XM || [];
  const xmCfg = () => (window.Live && window.Live.cfg.xm) || null;
  // App de pruebas de Android («RR Pruebas»): la compila apk.yml con `build.js --xm-pruebas`, que pone aquí la fecha de hoy y adelanta
  // el evento solo en esa app. La de Google Play, iOS, el artefacto y las pruebas siguen con las fechas normales (o las del panel).
  const XM_PRUEBAS = 0;
  function xmStart() { const c = xmCfg(), s = c && c.start != null && +c.start !== XM_OLD_START ? +c.start : XM_START; return XM_PRUEBAS ? Math.min(s, XM_PRUEBAS) : s; }
  function xmEnd() { const c = xmCfg(); return c && c.end ? +c.end : XM_END; }
  function xmActive() {
    if (!XML.length) return false;
    if (testOn() && save.xmForce) return true;
    const c = xmCfg(), t = Date.now();
    if (c && c.on === false) return false;
    return t >= xmStart() && t < xmEnd();
  }
  // todavía no ha empezado, pero falta poco: el árbol sale en la portada con la cuenta atrás hasta el inicio
  function xmSoon() {
    if (!XML.length || xmActive()) return false;
    const c = xmCfg(), t = Date.now(), s = xmStart();
    if (c && c.on === false) return false;
    return t < s && s - t <= XM_SOON;
  }
  function xmState() { if (!save.xm) save.xm = { unlocked: 1 }; return save.xm; }
  function addXCandy(n) { save.xcandy = (save.xcandy || 0) + n; persist(); xmCandyChip(); document.querySelectorAll('.xcandyTxt').forEach(el => { el.textContent = save.xcandy; }); }
  function xmLeft() {
    const ms = Math.max(0, (xmActive() ? xmEnd() : xmStart()) - Date.now()), d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60;
    return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
  }
  // icono del evento: árbol de Navidad con estrella, bolas y nieve en las ramas
  let treeN = 0;
  function treeSvg() {
    const a = 'xt' + (++treeN), s = 'xs' + treeN;
    return `<svg viewBox="0 0 100 100" class="xi"><defs><linearGradient id="${a}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8af08a"/><stop offset=".55" stop-color="#2fb04e"/><stop offset="1" stop-color="#16743a"/></linearGradient>
      <radialGradient id="${s}" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fff8c0"/><stop offset=".5" stop-color="#ffd23f"/><stop offset="1" stop-color="#e89a00"/></radialGradient></defs>
      <rect x="43" y="78" width="14" height="14" rx="3" fill="#8a4a22" stroke="#2a1006" stroke-width="3"/>
      <path d="M50 58 L84 84 Q86 87 82 87 L18 87 Q14 87 16 84Z" fill="url(#${a})" stroke="#0b3a1c" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M50 38 L76 64 Q78 67 74 67 L26 67 Q22 67 24 64Z" fill="url(#${a})" stroke="#0b3a1c" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M50 18 L68 42 Q70 45 66 45 L34 45 Q30 45 32 42Z" fill="url(#${a})" stroke="#0b3a1c" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M22 84 Q36 78 50 82 Q64 78 80 84 M28 64 Q40 59 50 62 Q60 59 72 64 M35 42 Q44 38 50 40 Q57 38 65 42" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".9"/>
      <circle cx="38" cy="76" r="4.5" fill="#ff3a4a" stroke="#4a0010" stroke-width="2"/><circle cx="62" cy="74" r="4.5" fill="#3ab4ff" stroke="#062a5a" stroke-width="2"/>
      <circle cx="44" cy="56" r="4" fill="#ffd23f" stroke="#5a3a00" stroke-width="2"/><circle cx="58" cy="52" r="4" fill="#ff3a4a" stroke="#4a0010" stroke-width="2"/><circle cx="50" cy="33" r="3.5" fill="#3ab4ff" stroke="#062a5a" stroke-width="2"/>
      <path d="M50 2 L54.5 11 L64 12 L57 18.5 L59 28 L50 23 L41 28 L43 18.5 L36 12 L45.5 11Z" fill="url(#${s})" stroke="#5a3a00" stroke-width="2.8" stroke-linejoin="round"/></svg>`;
  }
  // moneda del evento: bastón de caramelo
  const CANE_SVG = `<svg viewBox="0 0 40 40" class="xc"><path d="M14 36 L14 14 Q14 4 22 4 Q30 4 30 12 L30 15 L25 15 L25 12 Q25 9 22 9 Q19 9 19 14 L19 36Z" fill="#fff"/>
    <path d="M14 30 L19 27 L19 31 L14 34Z M14 22 L19 19 L19 23 L14 26Z M14 14.5 L19 12 L19 15.5 L14 18Z M18 7 L23 4.4 L25 8.6 L20.5 10Z M26 5.6 L30 10 L25.5 11.5 L24.8 9.5Z" fill="#e8203a"/>
    <path d="M14 36 L14 14 Q14 4 22 4 Q30 4 30 12 L30 15 L25 15 L25 12 Q25 9 22 9 Q19 9 19 14 L19 36Z" fill="none" stroke="#4a0010" stroke-width="2.4" stroke-linejoin="round"/></svg>`;
  // árbol de la portada y botón «Navidad» de la fila del mapa
  function xmUi() {
    const on = xmActive(), soon = !on && xmSoon();
    const tp = $('xmTree'); if (tp) { tp.hidden = !on && !soon; tp.classList.toggle('soon', soon); tp.classList.toggle('below', (on || soon) && hwActive()); if ((on || soon) && !tp.__svg) { tp.__svg = 1; tp.querySelector('.xtw').innerHTML = treeSvg(); } }
    const nb = $('navXm'); if (nb) { nb.hidden = !on; if (on && !nb.__svg) { nb.__svg = 1; nb.querySelector('.xtw').innerHTML = treeSvg(); } }
    document.querySelectorAll('.xmcdTxt').forEach(el => { el.textContent = xmLeft(); });
    document.querySelectorAll('.xcandyTxt').forEach(el => { el.textContent = save.xcandy || 0; });
    document.querySelectorAll('.xcane:not([data-ok])').forEach(el => { el.dataset.ok = 1; el.innerHTML = CANE_SVG; });
  }
  // cada 30 s: si la Navidad acaba de empezar o de terminar, se rehace la portada (solo si se está viendo la portada: antes,
  // durante la cuenta atrás, devolvía a la portada cada 30 s aunque estuvieras en Amigos, Misiones o la tienda)
  let xmWasOn = null;
  setInterval(() => { if (document.hidden) return; xmUi(); const on = xmActive(); if (xmWasOn !== null && on !== xmWasOn && G.mode === 'title' && $('title').classList.contains('on')) goTitle(); xmWasOn = on; }, 30000);
  function xmCandyChip() {
    const el = $('xcandyChip'); if (!el) return;
    const show = G.mode === 'play' && xmActive() && G.level && G.level.xm;
    el.hidden = !show; if (show) el.querySelector('b').textContent = save.xcandy || 0;
  }
  // regalo roto: el caramelo o el bastón vuela hasta el contador de arriba (lo avisa christmas.js)
  function xmCollect(n, x, y, z) {
    addXCandy(n); G.xcandyRun = (G.xcandyRun || 0) + n;
    floatText(x, y + 0.6, z, '+' + n + ' 🎁', '#ffffff', 24, true);
    try {
      const v = new THREE.Vector3(x, y, z).project(camera), chip = $('xcandyChip');
      if (chip && !chip.hidden) {
        const cr = chip.getBoundingClientRect(), sx = (v.x * 0.5 + 0.5) * innerWidth, sy = (-v.y * 0.5 + 0.5) * innerHeight;
        const el = document.createElement('span'); el.className = 'candyfly xfly'; el.innerHTML = CANE_SVG; el.style.left = (sx - 14) + 'px'; el.style.top = (sy - 14) + 'px';
        document.body.appendChild(el); void el.offsetWidth;
        el.style.transform = `translate(${cr.left + 6 - sx}px,${cr.top + 2 - sy}px) scale(.7)`;
        setTimeout(() => { el.remove(); chip.classList.remove('bump'); void chip.offsetWidth; chip.classList.add('bump'); }, 650);
      }
    } catch (e) { /* sin animación */ }
    spawnSprite(x, y, z, 0xffffff, 1.6, 1.2, 0.35, { add: true, alpha: 1 });
    Audio.coin(); if (Audio.bells) Audio.bells(); vibe(15);
  }
  // mapa del mundo de Navidad: calendario de Adviento (cada zona es una casa y los niveles, sus ventanas)
  function goXm() {
    if (!xmActive()) { toast('El evento de Navidad no está activo'); G.inXm = false; goMap(); return; }
    if (window.Bosses) window.Bosses.stop();
    refundGolden(); $('btnFinish').hidden = true;
    G.inXm = true; G.inHw = false; G.xmWorld = false; G.hwWorld = false; G.mode = 'map'; G.paused = false; $('hud').classList.remove('on');
    const h = xmState();
    loadDemo(XML[Math.min(h.unlocked, XML.length) - 1].id);
    Audio.setStyle('xmas');
    renderXm(); setCoins(); xmUi(); show('xmmap');
    const cur = document.querySelector('#xmList .xwin.cur'); if (cur) cur.scrollIntoView({ block: 'center' });
  }
  function xmBack() { if (G.xmFrom === 'title') goTitle(); else { G.inXm = false; goMap(); } }
  const XM_BOSS_ICO = ['💂', '🎁', '🧊', '💂', '🎁'];
  const XM_HOUSE = ['red', 'cream', 'blue', 'green', 'purple'];
  // calle nevada entre dos casas del calendario (solo decoración)
  function xmStreet(z) {
    const pine = (x, s) => `<g transform="translate(${x} ${54 - 30 * s}) scale(${s})"><path d="M0 30 L12 8 L24 30Z M2 20 L12 0 L22 20Z" fill="#1f6a44"/><path d="M5 20 L12 6 L19 20 M3 30 L12 14 L21 30" fill="none" stroke="#fff" stroke-width="2" opacity=".85"/><rect x="10" y="30" width="4" height="5" fill="#5a3a1a"/></g>`;
    const lamp = x => `<g transform="translate(${x} 10)"><rect x="3" y="10" width="3" height="34" fill="#1a1820"/><rect x="0" y="2" width="9" height="10" rx="2" fill="#ffd890"/><path d="M-1 3 L4.5 -3 L10 3Z" fill="#1a1820"/><circle cx="4.5" cy="7" r="10" fill="#ffd890" opacity=".18"/><circle cx="4.5" cy="24" r="4" fill="none" stroke="#1f8a4a" stroke-width="2.5"/></g>`;
    const man = x => `<g transform="translate(${x} 22)"><circle cx="9" cy="24" r="9" fill="#fff"/><circle cx="9" cy="10" r="6.5" fill="#fff"/><rect x="4" y="0" width="10" height="5" fill="#1a1820"/><rect x="2" y="4" width="14" height="2" fill="#1a1820"/><circle cx="7" cy="9" r="1" fill="#1a1820"/><circle cx="11" cy="9" r="1" fill="#1a1820"/><path d="M9 11 L14 12 L9 12.5Z" fill="#ff8a1a"/><rect x="3" y="15" width="12" height="3" rx="1.5" fill="#d8203a"/></g>`;
    const gift = (x, c) => `<g transform="translate(${x} 40)"><rect width="14" height="12" rx="2" fill="${c}"/><rect x="6" width="2.5" height="12" fill="#fff"/><rect y="5" width="14" height="2.5" fill="#fff"/><circle cx="5" cy="-1" r="2.5" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="9.5" cy="-1" r="2.5" fill="none" stroke="#fff" stroke-width="1.5"/></g>`;
    const sets = [
      pine(4, 1.1) + lamp(52) + man(150) + gift(178, '#3a9aff') + gift(193, '#ffc83d') + lamp(250) + pine(300, 0.9) + pine(326, 1.2),
      pine(8, 1.2) + pine(36, 0.8) + gift(90, '#d8203a') + lamp(140) + pine(200, 1) + man(262) + lamp(320),
      lamp(20) + pine(70, 1.2) + pine(96, 0.9) + gift(170, '#2fb04e') + gift(186, '#a66bff') + man(230) + lamp(300) + pine(332, 1),
      pine(10, 0.9) + man(50) + lamp(110) + gift(160, '#ffc83d') + pine(210, 1.25) + pine(238, 0.85) + lamp(300),
    ];
    return `<div class="xstreet"><svg viewBox="0 0 360 60" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><path d="M0 52 Q90 44 180 50 T360 50 L360 60 L0 60Z" fill="#fff" opacity=".92"/>${sets[z % 4]}</svg></div>`;
  }
  function renderXm() {
    const hp = document.querySelector('#xmmap .xmhead .xtw'); if (hp && !hp.__svg) { hp.__svg = 1; hp.innerHTML = treeSvg(); }
    const h = xmState(), all = testOn() && save.testAll, got = XML.filter(l => (save.stars[l.id] || 0) > 0).length;
    $('xmProg').textContent = got; $('xmBar').style.width = (100 * got / XML.length) + '%';
    let html = '';
    for (let z = 0; z < 5; z++) {
      const zl = XML.filter(l => l.zone === z), open = all || zl[0].pos <= h.unlocked;
      html += `<div class="xhouse ${XM_HOUSE[z]} ${open ? '' : 'lk'}"><div class="xroof"></div><div class="xsnowr"></div><div class="xchim"></div><div class="xlights"></div>` +
        `<div class="xsign">${open ? '' : '🔒 '}${zl[0].zoneName}<small>${z * 10 + 1}-${z * 10 + 10}</small></div><div class="xgrid">`;
      for (const l of zl) {
        const st = save.stars[l.id] || 0, un = all || l.pos <= h.unlocked, cur = l.pos === h.unlocked && !st;
        const stars = st ? '<span class="s">' + '★'.repeat(st) + '☆'.repeat(3 - st) + '</span>' : '';
        if (l.boss) html += `<button class="xwin door ${un ? '' : 'lk'} ${cur ? 'cur' : ''}" data-id="${l.id}"><span class="wr"></span><b>${un ? XM_BOSS_ICO[z] : '🔒'}</b><span>JEFE</span>${stars}</button>`;
        else html += `<button class="xwin ${un ? '' : 'lk'} ${cur ? 'cur' : ''} ${l.hard ? 'hard' : ''}" data-id="${l.id}"><span>${un ? l.pos : '🔒'}</span>${stars}</button>`;
      }
      html += '</div><div class="xground"></div></div>' + (z < 4 ? xmStreet(z) : '');
    }
    $('xmList').innerHTML = html;
    const lt = document.querySelector('#xmmap .xlights.top');
    if (lt && !lt.childNodes.length) { let h = '<path d="M0 6 Q50 18 100 6 T200 6 T300 6 T400 6" fill="none" stroke="#1a3a2a" stroke-width="2"/>'; for (let i = 0; i < 20; i++) { const x = 10 + i * 20, y = 6 + 6 * Math.abs(Math.sin((x / 100) * Math.PI)); h += `<circle class="xb" cx="${x}" cy="${y.toFixed(1)}" r="4.5" fill="${['#ff3a4a', '#3aff7a', '#ffd23a', '#3ab4ff', '#ff7af0'][i % 5]}"/>`; } lt.innerHTML = h; }
    $('xmList').querySelectorAll('.xwin').forEach(b => b.addEventListener('click', () => {
      Audio.click();
      const L = byId(+b.dataset.id);
      if (b.classList.contains('lk')) { toast(L.boss ? 'Supera los niveles de la zona para llegar al jefe' : 'Supera el nivel anterior para abrir este'); return; }
      openPre(L.id);
    }));
  }
  // tienda de Navidad: se paga con caramelos navideños
  const XM_SHOP = [
    { id: 'xskin', ic: '🍭', name: 'Cañón Bastón', desc: 'Cañón exclusivo de Navidad, con rayas de bastón de caramelo', price: 400, tag: 'EXCLUSIVO', owned: () => save.skins.owned.includes('candycane'), grant: () => grant({ skin: 'candycane' }) },
    { id: 'xchest', ic: '🎁', name: 'Regalo sorpresa', desc: 'Siempre: 250-750 monedas, 1-2 bombas y 3-8 gemas · 50 %: bola arcoíris · 25 %: bola dorada', price: 250, chest: true },
    { id: 'xav', ic: '🎅', name: 'Avatares de Navidad', desc: 'Papá Noel, reno, muñeco de nieve, árbol, regalo y cascanueces para tu perfil', price: 80, owned: () => !!save.xmAvatars, grant: () => { save.xmAvatars = true; return ['avatares de Navidad']; } },
    { id: 'xgold', ic: '✨', name: 'Bola dorada', desc: 'Atraviesa la estructura de lado a lado', price: 220, grant: () => grant({ golden: 1 }) },
    { id: 'xbomb', ic: '💣', name: 'Pack de 3 bombas', desc: 'Para cualquier nivel', price: 120, grant: () => grant({ bomb: 3 }) },
    { id: 'xrain', ic: '🌈', name: '2 bolas arcoíris', desc: 'Toman el color del primer bloque que tocan', price: 140, grant: () => grant({ rainbow: 2 }) },
    { id: 'xgems', ic: '💎', name: '10 gemas', desc: 'Para el Pase Pro', price: 300, grant: () => grant({ gems: 10 }) },
    { id: 'xcoins', ic: '🪙', name: '500 monedas', desc: '', price: 90, grant: () => grant({ coins: 500 }) },
  ];
  function xmShopHtml() {
    const row = it => { const own = it.owned && it.owned();
      return `<div class="hwitem xmitem"><span class="ic">${it.ic}</span><div><b>${it.name}${it.tag ? `<span class="tag2">${it.tag}</span>` : ''}</b>${it.desc ? `<small>${it.desc}</small>` : ''}</div>` +
        (own ? '<span class="hwown">✔</span>' : `<button class="hwbuy xmbuy" data-xm="${it.id}"><span class="xcane"></span>${it.price}</button>`) + '</div>'; };
    setTimeout(xmUi, 0);
    return `<div class="hwshoptop xmshoptop" id="sXm"><span class="xti">${treeSvg()}</span><div><b>Tienda de Navidad</b><small><span>Hasta el 6 de enero</span> · <span class="xmcdTxt">${xmLeft()}</span> · <span>se paga con caramelos navideños</span></small></div><span class="xmcandy"><span class="xcane"></span><span class="xcandyTxt">${save.xcandy || 0}</span></span></div>` + XM_SHOP.map(row).join('');
  }
  function xmBuy(id) {
    const it = XM_SHOP.find(x => x.id === id); if (!it) return;
    if ((save.xcandy || 0) < it.price) { toast(`Te faltan ${it.price - (save.xcandy || 0)} caramelos navideños. Los consigues rompiendo regalos`); return; }
    save.xcandy -= it.price;
    if (it.chest) {
      const r = { coins: 250 + Math.floor(Math.random() * 6) * 100, bomb: 1 + (Math.random() < 0.5 ? 1 : 0), gems: 3 + Math.floor(Math.random() * 6) };
      if (Math.random() < 0.5) r.rainbow = 1; if (Math.random() < 0.25) r.golden = 1;
      grant(r); persist(); setCoins(); $('shop').classList.remove('on');
      openChestFX('epic', r, () => openShop('xm'));
      return;
    }
    const got = it.grant(); persist(); setCoins(); Audio.coin(); vibe(20);
    toast('¡Conseguido!' + (got && got.length ? ' ' + got.join(', ') : ''));
    const sc = $('shopList').scrollTop; openShop(); $('shopList').scrollTop = sc;
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
    { id: 'birds', cat: 'Difíciles', icon: '🐦', tiers: [3, 15, 40], title: n => `Derriba al pájaro ${n} veces`, stat: () => stats().birds || 0,
      reward: i => [{ xp: 100, coins: 300, gems: 2 }, { xp: 200, coins: 600, gems: 3 }, { xp: 350, coins: 1000, gems: 5 }][i] },
    { id: 'ships', cat: 'Difíciles', icon: '⛵', tiers: [10, 30, 75], title: n => `Derriba el barco ${n} veces`, hint: 'el velero del mar o lo que cruza en su lugar en cada paisaje: globo, teleférico, mono, dragón u ovni', stat: () => stats().ships || 0,
      reward: i => [{ xp: 150, coins: 500, gems: 3 }, { xp: 300, coins: 900, gems: 4 }, { xp: 500, coins: 1500, gems: 6 }][i] },
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
  const codeCore = () => normCode(myCode());
  const validCode = c => c.length === 8 && ![...c].some(ch => ALPH.indexOf(ch) < 0) && chk(c.slice(0, 6)) === c.slice(6);
  function addFriend(text) {
    const c = normCode(text);
    if (!validCode(c)) return 'Ese código no es válido. Revisa que esté bien escrito.';
    if (c.slice(0, 6) === save.pid) return 'Ese es tu propio código.';
    save.friends = save.friends || [];
    if (save.friends.includes(c)) return 'Ya tienes a ese amigo.';
    save.friends.push(c); persist();
    return null;
  }
  function shareGame() {
    const text = (window.I18N ? I18N.t : s => s)(`¡Juega conmigo a Rocket Rush! Añádeme como amigo con mi código ${myCode()} y los dos ganamos premios.`);
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
      A.scheduleReminder(String(when.getTime()), window.I18N ? I18N.t(title) : title, window.I18N ? I18N.t(text) : text);
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
    if (window.Tutorial && window.Tutorial.busy()) { if (then) then(); return false; }
    if (dailyAutoDue()) { dailySave().auto = dayKey(); persist(); openDaily(then || null); return true; }
    if (then) then();
    return false;
  }
  // al entrar al juego (o al volver a él otro día) se abre sola a los 1,5 s, si no estás haciendo otra cosa
  let dailyTimer = 0;
  function autoDailySoon() {
    clearTimeout(dailyTimer);
    dailyTimer = setTimeout(() => {
      const busy = document.querySelector('.screen.dim.on') || $('pass').classList.contains('on') || $('ad').classList.contains('on') || (window.Tutorial && window.Tutorial.busy());
      if ((G.mode === 'title' || G.mode === 'map') && !busy && dailyAutoDue()) {
        dailySave().auto = dayKey(); persist();
        Audio.special();
        openDaily(G.mode === 'title' ? () => { if (G.mode === 'title') goMap(); } : null);
      }
    }, 1500);
  }
  // aspecto del cañón
  function applySkin() {
    const k = (save.skins && save.skins.equip) || 'classic';
    if (k !== 'classic' && !stats().skin) { stats().skin = 1; persist(); }
    const cs = canSave();
    cannonOut = Cannons.build(cannonG, barrelPivot, { skin: SKINS[k] ? k : 'classic', model: cs.eq, lv: cs.lv });
    G.cannonKind = null;
  }

  // ---------------- botones ----------------
  const on = (id, fn) => $(id).addEventListener('click', () => { Audio.init(); Audio.click(); fn(); });
  on('hwPump', () => { G.hwFrom = 'title'; goHw(); });
  on('navHw', () => { G.hwFrom = 'map'; goHw(); });
  on('navWorlds', () => { G.inHw = false; G.inXm = false; if (!$('map').classList.contains('on')) goMap(); const cur = document.querySelector('#mapList .lv.cur'); if (cur) cur.scrollIntoView({ block: 'center', behavior: 'smooth' }); });
  on('navClub', () => { if (window.Club) window.Club.open(null, 'map'); });
  on('btnClubT', () => { if (window.Club) window.Club.open(null, 'title'); });
  on('hwBack', hwBack);
  on('xmTree', () => { if (!xmActive()) { toast(`¡La Navidad llega en ${xmLeft()}!`, 2600); return; } G.xmFrom = 'title'; goXm(); });
  on('navXm', () => { G.xmFrom = 'map'; goXm(); });
  on('xmBack', xmBack);
  on('xmShop', () => openShop('xm'));
  on('hwShop', () => openShop('hw'));
  on('btnPlay', () => { G.inHw = false; G.inXm = false; goMap(); if (save.unlocked === 1 && !save.stars[1]) openPre(1); else maybeAutoDaily(); });
  on('btnDaily', () => openDaily(null));
  on('dX', () => { if (!$('dX').hidden) closeDaily(G.mode === 'title'); });   // la X cierra y te deja donde estabas
  on('btnDailyT', () => openDaily(() => { if (G.mode === 'title') goMap(); }));
  on('sNotif', () => { const d = dailySave(); d.notif = d.notif === false; persist(); refreshToggles(); scheduleReminder(); if (window.Retencion && Retencion.notices) Retencion.notices.sync(); });
  on('btnHome', goTitle);
  on('btnShop', () => openShop()); on('btnShopT', () => openShop());
  document.querySelectorAll('.wallet .coins').forEach(el => el.addEventListener('click', () => { Audio.init(); Audio.click(); openShop(el.querySelector('.gem') ? 'gems' : 'coins'); }));
  on('btnPass', openPass); on('btnPassT', openPass);
  on('btnMis', openMissions); on('btnMisT', openMissions);
  on('misBack', () => (G.mode === 'title' ? goTitle() : goMap()));
  on('misShop', () => openShop('gems'));
  on('btnShare', shareGame);
  on('btnAddFriend', async () => {
    // con Firebase: se envía una solicitud de amistad de verdad (y cuenta para la misión cuando la acepta)
    if (window.Social) {
      const el = $('friendMsg'); el.style.color = ''; el.textContent = 'Buscando…';
      const r = await window.Social.addByCode($('friendCode').value);
      el.style.color = r.err ? '#d6304a' : '#22914b'; el.textContent = r.err || r.ok;
      if (r.ok) { $('friendCode').value = ''; Audio.win(); }
      renderMissions(); return;
    }
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
  on('shopClose', () => { $('shop').classList.remove('on'); if ($('pass').classList.contains('on')) openPass(); if ($('pre').classList.contains('on')) renderLoadout(); if ($('social').classList.contains('on')) mountCol($('colMount')); });
  on('btnSetT', () => { refreshToggles(); $('settings').classList.add('on'); });
  on('sClose', () => $('settings').classList.remove('on'));
  on('sTest', toggleTest);
  // herramientas de prueba: gemas y monedas gratis, compras simuladas y quitar lo comprado del cañón para volver a probarlo
  on('sTGems', () => { if (!TEST_MODE) return; save.gems = (save.gems || 0) + 500; persist(); setCoins(); Audio.coin(); toast('+500 gemas de prueba'); });
  on('sTCoins', () => { if (!TEST_MODE) return; save.coins += 10000; persist(); setCoins(); Audio.coin(); toast('+10.000 monedas de prueba'); });
  on('sTPay', () => { if (!TEST_MODE) return; save.fakePay = !fakePay(); persist(); refreshTest(); toast(save.fakePay ? 'Compras simuladas: la tienda no pasa por Google Play' : 'Compras con Google Play'); });
  on('sTReset', () => {
    if (!TEST_MODE) return;
    save.skins = { owned: ['classic'], equip: 'classic' }; save.can = { lv: 1, own: ['base'], eq: 'base' }; save.bskin = { own: ['clasica'], eq: 'clasica' }; save.trail = { own: ['ninguna'], eq: 'ninguna' };
    persist(); applySkin(); toast('Cañones, mejoras y bolas quitados: puedes volver a comprarlos');
  });
  // configuración en directo: ventana de avisos y código regalo
  on('lbX', liveClose);
  on('sCode', openRedeem);
  if (window.Live) window.Live.on(() => { liveUi(); hwUi(); xmUi(); setTimeout(liveCheck, 300); if (G.mode === 'title' && G.titleReady && (G.hwWorld !== (hwActive() && !!window.Halloween) || G.xmWorld !== (!G.hwWorld && xmActive() && !!window.Christmas))) goTitle(); });
  setInterval(() => { if (document.hidden) return; liveUi(); liveCheck(); }, 5000);
  // ---------------- privacidad, ayuda y accesibilidad ----------------
  const SITE = 'https://rocket-rush-7297c.web.app', SUPPORT = 'rocketrush.lostanarchygames@hotmail.com';
  const siteLang = () => (window.I18N && I18N.lang === 'es') ? '' : '/en';
  const ageNow = () => save.birthYear ? new Date().getFullYear() - save.birthYear : 0;
  function adsStart() {
    const A = window.ChromaAndroid;
    if (A && A.adsInit && save.birthYear) try { A.adsInit(ageNow()); } catch (e) { /* nada */ }
  }
  function refreshPrivacy() {
    const A = window.ChromaAndroid;
    let req = false; try { req = !!(A && A.adsPrivacyRequired && A.adsPrivacyRequired()); } catch (e) { req = false; }
    $('pAds').hidden = !req;
    $('pOnline').textContent = 'Funciones en línea: ' + (save.kid ? 'no disponibles' : save.noOnline ? 'no' : 'sí');
    $('pOnline').disabled = !!save.kid;
    $('pId').textContent = 'Tu código de jugador: ' + myCode();
  }
  function openPrivacy() { $('settings').classList.remove('on'); refreshPrivacy(); $('pDelNote').textContent = ''; $('privacy').classList.add('on'); }
  on('sPriv', openPrivacy);
  on('pBack', () => { $('privacy').classList.remove('on'); refreshToggles(); $('settings').classList.add('on'); });
  on('pPolicy', () => openUrl(SITE + siteLang() + '/privacidad'));
  on('pTerms', () => openUrl(SITE + siteLang() + '/terminos'));
  on('pAds', () => { try { window.ChromaAndroid.adsPrivacyOptions(); } catch (e) { /* nada */ } });
  on('pOnline', () => {
    if (save.kid) return;
    save.noOnline = !save.noOnline; persist(); refreshPrivacy();
    if (!save.noOnline && window.Social) window.Social.dirty(1500);
    toast(save.noOnline ? 'Funciones en línea apagadas: amigos y clasificaciones no se actualizan' : 'Funciones en línea encendidas');
  });
  on('pDelete', async () => {
    const b = $('pDelete'), note = $('pDelNote');
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Toca otra vez para borrarla'; note.textContent = 'Se borran tu perfil público, tu código de amigo y tus amistades. Tu progreso en este móvil se queda.'; setTimeout(() => { delete b.dataset.armed; b.textContent = 'Borrar mi cuenta en línea'; }, 4000); return; }
    delete b.dataset.armed; b.textContent = 'Borrando…'; b.disabled = true;
    try {
      if (window.Social) await window.Social.deleteAccount();
      note.textContent = 'Cuenta en línea borrada. Las funciones en línea quedan apagadas.'; Audio.win();
    } catch (e) { note.textContent = 'No se ha podido borrar: comprueba la conexión y vuelve a probar.'; }
    b.disabled = false; b.textContent = 'Borrar mi cuenta en línea'; refreshPrivacy();
  });
  on('pSupport', () => {
    const v = BUILD ? '1.0.' + BUILD : '';
    const body = `\n\n---\nCódigo de jugador: ${myCode()}\nVersión: ${v}\nIdioma: ${window.I18N ? I18N.lang : 'es'}\n${navigator.userAgent}`;
    openUrl('mailto:' + SUPPORT + '?subject=' + encodeURIComponent('Rocket Rush · ayuda') + '&body=' + encodeURIComponent(body));
  });
  on('pBlocked', () => {
    $('privacy').classList.remove('on');
    const S = window.Social; if (!S) return;
    const draw = () => {
      const pl = S.blocked(), cl = S.blockedClubs(), rows = Object.entries(pl).map(([id, x]) => `<div class="blrow"><span>🚫</span><b translate="no">${String(x.name || '?').replace(/[<>&]/g, '')}</b><button class="btn blue small" data-ub="${id}">Desbloquear</button></div>`)
        .concat(Object.entries(cl).map(([id, x]) => `<div class="blrow"><span>🛡️</span><b translate="no">${String(x.name || '?').replace(/[<>&]/g, '')}</b><button class="btn blue small" data-ubc="${id}">Desbloquear</button></div>`));
      liveBox({ rib: 'BLOQUEADOS', ico: '🚫', title: 'Jugadores y clubes bloqueados', extra: `<div class="credits">${rows.join('') || '<p class="sub">No has bloqueado a nadie. Para bloquear, toca a un jugador o un club en las clasificaciones, en tus amigos o en los clubes.</p>'}</div>`,
        btns: [{ t: 'VOLVER', fn: () => { $('liveBox').classList.remove('on'); openPrivacy(); } }] });
      $('liveBox').querySelectorAll('[data-ub]').forEach(b => b.addEventListener('click', () => { Audio.click(); S.unblock(b.dataset.ub); draw(); }));
      $('liveBox').querySelectorAll('[data-ubc]').forEach(b => b.addEventListener('click', () => { Audio.click(); S.unblockClub(b.dataset.ubc); draw(); }));
    };
    draw();
  });
  on('pCredits', () => {
    $('privacy').classList.remove('on');
    liveBox({ rib: 'CRÉDITOS', ico: '🚀', title: 'Rocket Rush', extra: `<div class="credits"><b>Lost Anarchy Games</b>Diseño y desarrollo: Sergio Gámez Pacheco
      <b>Programas de código abierto</b>three.js — licencia MIT, © 2010-2024 three.js authors<br>cannon-es — licencia MIT, © 2020 pmndrs y © 2015 Stefan Hedman
      <b>Música y sonidos</b>Creados por el propio juego mientras suena (sin grabaciones de terceros)
      <b>Licencia MIT</b><small>Se concede permiso, de forma gratuita, a cualquier persona que obtenga una copia de este software y de los archivos de documentación asociados, para utilizarlo sin restricciones, siempre que el aviso de copyright y este aviso de permiso se incluyan en todas las copias. EL SOFTWARE SE PROPORCIONA «TAL CUAL», SIN GARANTÍA DE NINGÚN TIPO.</small></div>`,
      btns: [{ t: 'VOLVER', fn: () => { $('liveBox').classList.remove('on'); openPrivacy(); } }] });
  });
  // accesibilidad: menos destellos (relámpagos, fogonazos y temblor de cámara) y gráficos en modo ahorro
  function applyGfx() {
    const low = !!save.lowGfx;
    pixelRatio = low ? 1 : Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 1.5);
    renderer.setPixelRatio(pixelRatio); resize();
    if (renderer.shadowMap.enabled === low) {
      renderer.shadowMap.enabled = !low;
      scene.traverse(o => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
    }
  }
  on('sCalm', () => { save.calm = !save.calm; persist(); refreshToggles(); });
  on('sGfx', () => { save.lowGfx = !save.lowGfx; persist(); applyGfx(); refreshToggles(); });
  on('sRec', () => { save.rec = save.rec === false; persist(); refreshToggles(); });
  // edad (la primera vez): pregunta neutra, sin decir qué edad hace falta. Menores de 13: sin funciones en línea;
  // menores de 16: anuncios sin personalizar. Solo se guarda el año, en el móvil.
  function ageGate(then) {
    if (!save.birthYear && window.RR_AGE) { save.birthYear = new Date().getFullYear() - window.RR_AGE; save.kid = window.RR_AGE < 13; persist(); }   // pruebas automáticas
    if (save.birthYear) { then && then(); return; }
    const y0 = new Date().getFullYear(), sel = $('agYear');
    sel.innerHTML = '<option value="">—</option>' + Array.from({ length: 100 }, (_, i) => `<option value="${y0 - i}">${y0 - i}</option>`).join('');
    sel.value = ''; $('agOk').disabled = true;
    sel.onchange = () => { $('agOk').disabled = !sel.value; };
    $('agOk').onclick = () => {
      if (!sel.value) return;
      Audio.init(); Audio.click();
      save.birthYear = +sel.value; save.kid = ageNow() < 13;
      if (save.kid) { save.welcomed = true; const w = $('welcome'); if (w) w.hidden = true; }   // menores de 13: sin cuentas ni nombre en línea
      persist();
      $('ageGate').hidden = true;
      if (save.kid && window.Social && window.Social.hasAccount) window.Social.deleteAccount().catch(() => { /* se reintenta otro día */ });
      adsStart(); then && then();
    };
    $('ageGate').hidden = false;
  }
  on('sReset', () => {
    const b = $('sReset');
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Toca otra vez para borrar todo'; setTimeout(() => { delete b.dataset.armed; b.textContent = 'Borrar progreso'; }, 3000); return; }
    delete b.dataset.armed; b.textContent = 'Borrar progreso';
    const keep = { welcomed: save.welcomed, gacc: save.gacc, blocked: save.blocked, blockedClubs: save.blockedClubs, tester: save.tester, nameLc: save.nameLc, prof: save.prof, club: save.club, birthYear: save.birthYear, kid: save.kid, noOnline: save.noOnline, lang: save.lang, calm: save.calm, lowGfx: save.lowGfx, adsRemoved: save.adsRemoved, iapDone: save.iapDone, pid: save.pid, codeUid: save.codeUid, profUid: save.profUid };
    save = Object.assign(DEFAULT_SAVE(), keep); bakAt = 0; persist(); setCoins(); toast('Progreso borrado');
  });
  on('preBack', () => { $('pre').classList.remove('on'); if (G.mode !== 'map') goMap(); });
  on('preGo', () => {
    const L = byId(G.preId);
    if (L.bonus && save.bonusDone && save.bonusDone[L.id]) {
      if (save.coins < L.replayCost) { toast(`Te faltan ${L.replayCost - save.coins} monedas para repetir este nivel extra`); openShop(); return; }
      save.coins -= L.replayCost; setCoins(); Audio.coin();
    }
    const bs = [];
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
      if (L.weekly) { RH('weeklyBack'); return; }
      if (L.club) { const n = window.Club && window.Club.next(L); if (window.Club) window.Club.back(L); if (n) openPre(n); return; }
      if (L.hw) { if (L.pos < 50 && hwActive()) openPre(L.id + 1); return; }
      if (L.xm) { if (L.pos < 50 && xmActive()) openPre(L.id + 1); return; }
      if (G.newBonus) { openPre(G.newBonus); return; }
      const n = L.bonus ? Math.min(save.unlocked, LEVELS.length) : L.id + 1;
      if (n <= LEVELS.length) openPre(n);
    });
  })));
  on('winMap', afterMystery(() => maybeInterstitial(() => { if (G.level && G.level.club && window.Club) { window.Club.back(G.level); return; } const wk = G.level && G.level.weekly; goMap(); if (wk) { RH('weeklyBack'); return; } maybeAutoDaily(); })));
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
  on('winRetry', () => maybeInterstitial(() => { if (G.level.weekly) { hideAll(); goMap(); RH('weeklyBack'); return; } if (paidReplay(G.level)) { goMap(); openPre(G.level.id); } else { hideAll(); startLevel(G.level.id, []); } }));
  on('winDouble', () => showRewarded(ok => { if (ok) { save.coins += G.pendingCoins; persist(); $('winCoins').textContent = '+' + (G.pendingCoins * 2); $('winDouble').disabled = true; Audio.coin(); } }));
  on('loseAd', () => showRewarded(ok => { if (ok) continueWithBalls(); }));
  on('loseCoins', () => { const cost = +$('loseCost').textContent; if (save.coins >= cost) { save.coins -= cost; persist(); continueWithBalls(); } });
  on('loseGift', () => { if (G.giftWorld) { save.casiFree = save.casiFree || {}; save.casiFree[G.giftWorld] = true; persist(); } continueWithBalls(); });
  on('loseStarter', () => { const it = SHOP.find(x => x.id === 'starter'); if (iapBuy(it)) showLose(); });
  on('loseRetry', () => { save.streak = 0; stats().winRun = 0; persist(); hideAll(); maybeInterstitial(() => { if (G.level.weekly) { goMap(); RH('weeklyBack'); return; } G.mode = 'pre'; openPre(G.level.id); }); });
  on('loseMap', () => { save.streak = 0; stats().winRun = 0; persist(); maybeInterstitial(() => { if (G.level && G.level.club && window.Club) { window.Club.back(G.level); return; } const wk = G.level && G.level.weekly; goMap(); if (wk) RH('weeklyBack'); }); });
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
    $('sTest').hidden = !testOn(); $('sTestNote').hidden = !testOn(); $('sTestRow').hidden = !TEST_MODE; $('sTestRow2').hidden = !TEST_MODE;   // gemas, monedas y compras simuladas: solo en la app de pruebas
    if (!testOn()) return;
    $('sTPay').textContent = 'Compras simuladas: ' + (fakePay() ? 'sí' : 'no');
    $('sTestNote').textContent = TEST_MODE ? 'Solo para probar. Se quita al publicar el juego.' : 'Eres probador (activado desde el panel). Nadie más ve este botón.';
    $('sTest').textContent = save.testAll ? 'Modo prueba: volver a mi progreso' : 'Modo prueba: desbloquear todo';
  }
  function toggleTest() {
    if (!testOn()) return;
    if (!save.testAll) { save.testPrev = save.unlocked; save.testAll = true; save.unlocked = LEVELS.length; toast('Modo prueba: los ' + LEVELS.length + ' niveles y todos los niveles extra están abiertos', 3000); }
    else { save.testAll = false; save.unlocked = Math.max(1, Math.min(save.testPrev || 1, LEVELS.length)); delete save.testPrev; toast('Has vuelto a tu progreso normal'); }
    persist(); refreshTest(); if (G.mode === 'map') renderMap();
  }
  // lo llama social.js al comprobar en el servidor si este jugador es probador
  function setTester(v) {
    v = !!v; if (!!save.tester === v) return;
    save.tester = v;
    if (!v && !TEST_MODE && save.testAll) { save.testAll = false; save.unlocked = Math.max(1, Math.min(save.testPrev || 1, LEVELS.length)); delete save.testPrev; save.hwForce = false; save.xmForce = false; }
    persist(); refreshTest(); if (G.mode === 'map') renderMap();
    if (v) toast('Modo probador activado: lo tienes en Ajustes', 3000);
  }
  function refreshToggles() {
    refreshTest();
    for (const [k, ids] of [['sound', ['pSound', 'sSound']], ['vibe', ['pVibe', 'sVibe']], ['music', ['pMusic', 'sMusic']]])
      for (const id of ids) $(id).style.opacity = save[k] ? 1 : 0.35;
    $('sNotif').textContent = 'Avisos en el móvil: ' + (dailySave().notif === false ? 'no' : 'sí');
    $('sCalm').textContent = 'Menos destellos: ' + (save.calm ? 'sí' : 'no');
    $('sGfx').textContent = 'Gráficos: ' + (save.lowGfx ? 'ahorro' : 'altos');
    if ($('sRec')) $('sRec').textContent = 'Grabar jugadas: ' + (save.rec === false ? 'no' : 'sí');
    $('sState').textContent = `Sonido ${save.sound ? 'sí' : 'no'} · Vibración ${save.vibe ? 'sí' : 'no'} · Música ${save.music ? 'sí' : 'no'}`;
  }
  function maybeInterstitial(next) {
    // uno cada «every» partidas terminadas (5 por defecto), desde el nivel «from» y nunca dos seguidos en menos de «gapMin» minutos
    const AD = liveCfg().ads || {}, adFrom = +AD.from || 10, every = Math.max(1, +AD.every || 5), adGap = (AD.gapMin != null ? +AD.gapMin : 1) * 60000;
    const now = Date.now();
    if (!AD.off && !save.adsRemoved && save.unlocked >= adFrom && (save.interN || 0) >= every && now - (save.lastInter || 0) > adGap) { save.lastInter = now; save.interN = 0; persist(); showInterstitial(next); }
    else next();
  }

  // integración con la app Android
  window.ChromaBack = () => {
    const open = id => $(id).classList.contains('on');
    if (open('chestOpen')) { if (openChestFX.skip) openChestFX.skip(); return true; }
    if (open('newCard')) { closeNewCard(); return true; }
    if (open('cosSheet')) { closeCosSheet(); return true; }
    if (open('shop')) { $('shop').classList.remove('on'); return true; }
    if (open('daily')) { if (!$('dBtns').innerHTML) return true; closeDaily(true); return true; }
    if (open('settings')) { $('settings').classList.remove('on'); return true; }
    if (open('missions')) { G.mode === 'title' ? goTitle() : goMap(); return true; }
    if (open('social')) { goTitle(); return true; }
    if (open('club') && window.Club && window.Club.goBack) { window.Club.goBack(); return true; }
    if (open('hwmap')) { hwBack(); return true; }
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
  window.ChromaResume = () => { Audio.init(); if (save.music) Audio.startMusic(); autoDailySoon(); };

  // ---------------- bucle ----------------
  let last = performance.now();
  let manual = false;
  // calidad adaptable: si el móvil no llega a ~45 fps, baja la resolución interna
  let perfAcc = 0, perfN = 0, perfMin = 1, hzLow = false;
  function adaptQuality(dt) {
    perfAcc += dt; perfN++; if (dt > 0.003 && dt < perfMin) perfMin = dt;
    if (perfN < 90) return;
    const avg = perfAcc / perfN, fastest = perfMin; perfAcc = 0; perfN = 0; perfMin = 1;
    // pantalla de 90/120 Hz que el móvil no llega a llenar: mejor 60 Hz estables que 75 a trompicones
    if (!hzLow && fastest < 0.0118 && avg > 0.0135 && window.ChromaAndroid && ChromaAndroid.refreshRate) { hzLow = true; try { ChromaAndroid.refreshRate(60); } catch (e) { /* nada */ } return; }
    // por debajo de ~52 fps: menos resolución interna (de 0,25 en 0,25, hasta 1). Se nota poco y libera mucha tarjeta gráfica.
    if (avg > 0.0192 && pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); renderer.setSize(W, H, false); }
  }
  // menús a pantalla completa (mapa, pase, misiones): el 3D de fondo se pinta a 20 fps y se para mientras deslizas,
  // para que el desplazamiento vaya fluido en móviles modestos
  let scrollBusy = 0, liteLast = 0;
  const busy = () => { scrollBusy = performance.now() + 350; };
  for (const id of ['mapList', 'hwList', 'passList', 'misList']) for (const ev of ['scroll', 'touchstart', 'touchmove', 'wheel']) $(id).addEventListener(ev, busy, { passive: true });
  const liteMenu = () => $('map').classList.contains('on') || $('hwmap').classList.contains('on') || $('pass').classList.contains('on') || $('missions').classList.contains('on');
  // 22-11: antes eran 20 fps y el giro del fondo se veía a saltos. Ahora se pinta a la velocidad normal pero a media resolución
  // (detrás del mapa casi no se nota y cuesta 4 veces menos), y sigue parándose mientras deslizas.
  let liteRes = false;
  function setLiteRes(on) {
    liteRes = on;
    const want = on ? Math.max(0.5, pixelRatio * 0.5) : pixelRatio;
    if (renderer.getPixelRatio() !== want) { renderer.setPixelRatio(want); renderer.setSize(W, H, false); }
  }
  function frame(now) {
    if (manual) { last = now; requestAnimationFrame(frame); return; }
    const lite = liteMenu();
    setLiteRes(lite);
    if (lite && now < scrollBusy) { requestAnimationFrame(frame); return; }
    if (lite) liteLast = now;
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
    if (cannonG.visible) Cannons.tick(cannonOut, G.t);
    flashLight.intensity = Math.max(0, flashLight.intensity - dt * 220);
    if (save.calm) { if (flashLight.intensity > 8) flashLight.intensity = 8; if (G.shake > 0.04) G.shake = 0.04; }
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
    if (window.Halloween) window.Halloween.tick(G, dt);
    if (window.Christmas) window.Christmas.tick(G, dt);
    GPU_T.value = (GPU_T.value + dt) % 600;
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
    } else if (G.mode === 'title' && G.hwWorld && window.Halloween) {
      window.Halloween.titleCam(camera, G.t);
      cannonG.visible = false;
    } else if (G.mode === 'title' && G.xmWorld && window.Christmas) {
      window.Christmas.titleCam(camera, G.t);
      cannonG.visible = false;
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
    if (!noRender) { titleView(); shadowGate(); renderer.render(scene, camera); if (window.Jugada && Jugada.busy) Jugada.frame(renderer.domElement); }
  }
  // El mapa de sombras es un segundo dibujo de toda la escena desde el sol. Con todo quieto (lo normal mientras apuntas)
  // da el mismo resultado: se rehace solo si algo se mueve y, por si acaso, uno de cada 3 fotogramas.
  let shadowN = 0, aimX = 1e9, aimY = 1e9;
  renderer.shadowMap.autoUpdate = false;
  function shadowGate() {
    if (!renderer.shadowMap.enabled) return;
    const sim = G.sim;
    let moving = (G.mode !== 'play' && !liteRes) || !sim || !!(G.level && G.level.boss);   // detrás del mapa no se mueve nada que dé sombra: 1 de cada 3
    if (!moving) {
      const ax = G.aim ? G.aim.x : 1e9, ay = G.aim ? G.aim.y : 1e9;
      moving = sim.balls.length > 0 || (sim.maxV || 0) > 0.03 || G.recoil > 0 || G.shake > 0 || G.introT > 0 || ax !== aimX || ay !== aimY || sim.state !== 'play';
      if (!moving && sim.movers) for (let i = 0; i < sim.movers.length; i++) if (sim.movers[i].active) { moving = true; break; }
      aimX = ax; aimY = ay;
    }
    shadowN = (shadowN + 1) % 3;
    if (moving || shadowN === 0) renderer.shadowMap.needsUpdate = true;
  }

  // los jefes (bosses.js) usan estas piezas del juego
  // fechas para los avisos del móvil (retencion.js los programa)
  const noticeInfo = () => ({ xmStart: XML.length ? xmStart() : 0, xmEnd: XML.length ? xmEnd() : 0, hwStart: (hwCfg() && hwCfg().start) ? +hwCfg().start : 0, hwEnd: HWL.length ? hwEnd() : 0,
    passEnd: SEASON_EPOCH + (seasonIndex() + 1) * SEASON_DAYS * 864e5, passPending: passClaimable(), passPro: !!(save.pass && save.pass.pro) });
  window.RRGame = { noticeInfo, auxLight, testBuild: TEST_MODE, showRewarded, startLevel, openPre: id => openPre(id), hideAll, liveUi: () => liveUi(), updateTitle: () => updateTitle(), dayKey: () => dayKey(), leftTxt: ms => leftTxt(ms), liveCfg: () => liveCfg(), liveWin: o => liveWin(o), cosApi: { def: cosDef, owned: cosOwned, tSave: () => tSave(), bSave: () => bSave(), canSave: () => canSave() }, cubiFrames, openShop, goMap, mountCol, autoDailySoon: () => autoDailySoon(), hw: { THREE, C, G, rnd, canvasTex, tiles, makePlatform, points, gpuMotion, scene, TEX, ground, around, splashCol, stripes, ballMaterial, COL, hemi, sun, skyMat, flashLight, collect: hwCollect, active: hwActive, chip: hwCandyChip }, xm: { collect: xmCollect, active: () => xmActive(), chip: () => xmCandyChip(), go: () => goXm() }, hwState, addCandy, xmState, addXCandy, G, scene, world, camera, openChestFX, floatText, spawnSprite, spawnDebris, spawnRing, Audio, vibe, persist, setCoins,
    refreshTray: () => { lastTray = ''; }, get save() { return save; }, centerText, aimObjs: [],
    // para social.js (perfil, amigos y clasificaciones)
    stats, plState, starsTotal, countLv, LEVELS, myCode, openPre: id => openPre(id), setTester, codeCore, normCode, validCode, newPid() { save.pid = null; myCode(); }, shareGame, renderMissions, show, goTitle, toast, live: { check: () => liveCheck(), ui: () => liveUi(), mult: liveMult, build: BUILD }, grant,
    addBlockView: d => blockView(d), weatherChip: w => setWeatherChip({ weather: w }), weatherFx: w => { Weather.set(w); const el = $('wxChip'); if (!w) el.hidden = true; },
    // el jefe ha caído: el nivel se gana con las bolas que quedaban
    bossWin(left) { const sim = G.sim; if (!sim || G.mode !== 'play') return; sim.queue = Array.from({ length: left }, () => 'heavy'); sim.goalReached = true; sim.finish(); G.winAt = G.t - 1; } };
  // inicio
  resize(); prewarmFx();
  // idioma: se elige la primera vez y se puede cambiar en Ajustes
  function langButtons(box, onPick) {
    if (!window.I18N) return;
    const cur = I18N.chosen() ? I18N.lang : I18N.guess();
    box.innerHTML = I18N.LANGS.map(l => `<button data-l="${l.code}" class="${l.code === cur ? 'on' : ''}">${l.name}</button>`).join('');
    box.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { Audio.click && Audio.click(); I18N.set(b.dataset.l); save.lang = b.dataset.l; persist(); box.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); onPick && onPick(); }));
  }
  langButtons($('sLang'));
  if (window.I18N && !I18N.chosen()) {
    $('langPick').hidden = false;
    langButtons($('lpGrid'), () => { $('langPick').hidden = true; langButtons($('sLang')); });
  }
  Cannons.setEnv(scene.environment);
  ensureSeason(); applySkin(); if (save.lowGfx) applyGfx();
  setTimeout(() => { if (save.skins && save.skins.equip === 'candycane') applySkin(); }, 0);   // la textura del bastón llega con christmas.js
  goTitle(); setCoins(); scheduleReminder();
  // ---------------- precarga (mientras se ve el logo del estudio) ----------------
  // Una pieza de cada cosa que puede aparecer en mitad de una partida (pájaros, barcos, globos, bolas especiales, bloques
  // nuevos…): sus materiales se compilan ya, junto con todos los del juego, para que la primera vez no dé un tirón.
  function warmExtras() {
    const out = [], add = f => { try { const o = f(); if (o && o.isObject3D) out.push(o); } catch (e) { /* esa pieza no se puede montar aquí */ } };
    add(() => makeBird()); add(() => makeSatellite()); add(() => makeShip({ balls: ['r', 'b'], dir: 1, x: 0, y: 0, z: 0 }));
    for (const k of Object.keys(C.CARRIERS || {})) add(() => makeCarrier({ carrier: k, kind: 'carrier', balls: ['r', 'b'], dir: 1, x: 0, y: 0, z: 0 }));
    if (window.Halloween) { add(() => window.Halloween.makeWitch()); add(() => window.Halloween.makePirate({ balls: ['r', 'b'], dir: 1 })); }
    if (window.Christmas && window.Christmas.makeBird) add(() => window.Christmas.makeBird());
    if (window.Mundos) { add(() => window.Mundos.makeFish()); add(() => window.Mundos.warm()); }
    for (const k of new Set(Object.keys(jelly).concat(Object.keys(SPECIAL_MAT)))) add(() => makeBallMesh(k, 0.34));
    for (const k of Object.keys(NEWK)) if (k !== 'lockDeco' && k !== 'tikiDeco') add(() => newKindMesh({ kind: k, id: 1, w: 1, h: 1, d: 1, c: 'r', a: 1 }));
    add(() => newKindMesh({ kind: 'portal', id: 1, w: 1, h: 1, d: 1 }));
    // climas: se montan ya (quedan guardados) para que sus shaders estén listos
    for (const k of ['rain', 'storm', 'sandstorm', 'blizzard', 'ash']) { try { for (const o of Weather.build(k)) out.push(o); } catch (e) { /* nada */ } }
    return out;
  }
  let warmP = Promise.resolve(null);
  // Paisaje del mundo en el que estás y del siguiente: se montan en un rato libre tras la portada y se dejan listos y
  // ocultos (antes se montaban al entrar, con un parón). Solo esos dos y solo cuando el navegador está desocupado: montar
  // todos de golpe cargaba demasiado los móviles más modestos mientras se movían por los menús.
  function preloadBiomes() {
    if (window.RR_NO_PRELOAD) return;
    const L = byId(Math.min(save.unlocked, LEVELS.length)); if (!L) return;
    const names = [];
    for (const w of [L.world, L.world + 1]) { const W = WORLDS[w - 1]; if (W && W.biome && biomeBuilders[W.biome] && !names.includes(W.biome)) names.push(W.biome); }
    const idle = window.requestIdleCallback ? f => window.requestIdleCallback(f, { timeout: 8000 }) : f => setTimeout(f, 1200);
    const step = () => {
      const n = names.shift(); if (!n) return;
      if (G.mode === 'play' && G.sim && G.sim.state === 'play') { names.unshift(n); setTimeout(() => idle(step), 3000); return; }
      if (!BIOMES[n]) {
        try {
          const B = BIOMES[n] = biomeBuilders[n]();
          if (B) { for (const o of B.env) o.visible = n === biome; B.platform.visible = n === biome; if (window.Perf) { for (const o of B.env) window.Perf.prime(renderer, o, scene, camera); window.Perf.prime(renderer, B.platform, scene, camera); } }
          else delete BIOMES[n];
        } catch (e) { delete BIOMES[n]; if (TEST_MODE) console.warn('[paisajes] ' + n + ': ' + (e && e.message)); }
      }
      if (TEST_MODE) window.RR_BIOMES = Object.keys(BIOMES);
      setTimeout(() => idle(step), 2000);
    };
    setTimeout(() => idle(step), 4000);
  }
  function bootWarm() {
    if (!window.Perf) return;
    warmP = window.Perf.warm(renderer, scene, camera, warmExtras(), 4500);
    warmP.then(st => { if (st && TEST_MODE) console.log('[precarga]', JSON.stringify(window.RR_WARM || st)); });
    // Cubi (la mascota del tutorial) se dibuja con un 3D aparte: mejor ahora, tras el logo, que al salir su primer consejo
    warmP.then(() => setTimeout(() => { try { cubiFrames(); } catch (e) { /* nada */ } }, 60));
    warmP.then(() => preloadBiomes());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootWarm, { once: true }); else setTimeout(bootWarm, 0);
  // pantalla del estudio: al menos 2,2 s desde que se abrió la app y, si la precarga aún no ha terminado, hasta que termine
  // (como mucho 4,5 s); después se funde
  (() => { const st = $('studio'); if (!st) return;
    const fade = () => { st.classList.add('out'); setTimeout(() => st.remove(), 600); };
    if (window.RR_NO_INTRO) { setTimeout(fade, 0); return; }
    const min = new Promise(r => setTimeout(r, Math.max(300, 2200 - performance.now())));
    const cap = new Promise(r => setTimeout(r, Math.max(300, 4500 - performance.now())));
    const auto = navigator.webdriver;   // pruebas automáticas: el logo dura lo de siempre
    Promise.race([cap, min.then(() => auto ? null : new Promise(r => setTimeout(() => warmP.then(r), 0)))]).then(fade); })();
  setTimeout(() => RH('boot'), 0);
  // sonido desde la portada: en la app (Android e iPhone) el audio puede empezar sin tocar nada; si el navegador lo
  // bloquea, se pone en marcha con el primer toque en cualquier parte de la pantalla (no hace falta pulsar JUGAR)
  Audio.init();
  const firstTouch = () => { Audio.init(); for (const ev of ['pointerdown', 'touchstart', 'keydown']) document.removeEventListener(ev, firstTouch, true); };
  for (const ev of ['pointerdown', 'touchstart', 'keydown']) document.addEventListener(ev, firstTouch, { capture: true, passive: true });
  ageGate(); if (save.birthYear) adsStart();
  requestAnimationFrame(() => requestAnimationFrame(autoDailySoon));   // cuenta desde que la portada ya se ve
  requestAnimationFrame(frame);
  window.ChromaGame = { G, startLevel, tick, pickTarget: (x, y) => pickTarget(x, y), manual: v => { manual = v; }, shiftDays: n => { dayShift += n; updateDailyBadges(); return dayKey(); }, dailyStatus, render: () => { titleView(); renderer.render(scene, camera); }, save: () => save, camera, renderer, LEVELS, goTitle, finishWin, cos: { buy: (k, id) => cosBuy(k, id), equip: (k, id) => cosEquip(k, id), up: () => cosUpgrade(), tmp: () => tmpNow(), apply: applySkin, out: () => cannonOut } };
})();
