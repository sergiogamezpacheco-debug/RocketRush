// Sonidos sintetizados (sin archivos): tres juegos para la apertura de cofres.
// Uso: SFX.pack = 'arcade' | 'magia' | 'feria'; SFX.play('hit', n) …
const SFX = (() => {
  let ac = null, master = null;
  const ctx = () => {
    if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination); }
    if (ac.state === 'suspended' && ac.resume) ac.resume().catch(() => {});
    return ac;
  };
  // tono con caída exponencial y deslizamiento opcional
  function tone(f, dur, type = 'sine', vol = 0.2, opt = {}) {
    const a = ctx(), t = a.currentTime + (opt.delay || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (opt.to) o.frequency.exponentialRampToValueAtTime(opt.to, t + (opt.slide || dur));
    if (opt.vib) { const l = a.createOscillator(), lg = a.createGain(); l.frequency.value = opt.vib; lg.gain.value = f * 0.03; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
    const att = opt.att || 0.004;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out = g;
    if (opt.lp) { const f2 = a.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = opt.lp; g.connect(f2); out = f2; }
    o.connect(g); out.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  let noiseBuf = null;
  function noise(dur, vol = 0.2, opt = {}) {
    const a = ctx(), t = a.currentTime + (opt.delay || 0);
    if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = noiseBuf; f.type = opt.type || 'lowpass'; f.frequency.setValueAtTime(opt.f || 2000, t); f.Q.value = opt.q || 0.8;
    if (opt.to) f.frequency.exponentialRampToValueAtTime(opt.to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (opt.att || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.05);
  }
  // campana: fundamental + parciales inarmónicos
  const bell = (f, dur = 0.9, vol = 0.12, delay = 0) => { tone(f, dur, 'sine', vol, { delay }); tone(f * 2.76, dur * 0.6, 'sine', vol * 0.35, { delay }); tone(f * 5.4, dur * 0.35, 'sine', vol * 0.15, { delay }); };
  const N = { C5: 523, D5: 587, E5: 659, G5: 784, A5: 880, C6: 1047, D6: 1175, E6: 1319, G6: 1568, C7: 2093 };
  const PACKS = {
    // 1 · ARCADE: chiptune de 8 bits
    arcade: {
      land() { tone(160, 0.18, 'square', 0.12, { to: 50 }); noise(0.08, 0.1, { f: 900 }); },
      hit(n) { tone(260 + n * 140, 0.09, 'square', 0.1, { to: 520 + n * 200 }); tone(1040 + n * 200, 0.05, 'square', 0.05, { delay: 0.05 }); },
      explode() { noise(0.55, 0.3, { f: 3000, to: 200 }); [N.C5, N.E5, N.G5, N.C6, N.E6, N.G6].forEach((f, i) => tone(f, 0.12, 'square', 0.08, { delay: 0.05 + i * 0.05 })); },
      clink() { tone(1760 + Math.random() * 400, 0.07, 'triangle', 0.09); },
      card(i) { tone(660 + i * 60, 0.08, 'square', 0.11); tone(990 + i * 90, 0.12, 'square', 0.1, { delay: 0.07 }); },
      tick() { tone(1400, 0.025, 'square', 0.03); },
      collect(k) { if (k === 'coin') { tone(988, 0.07, 'square', 0.08); tone(1319, 0.3, 'square', 0.08, { delay: 0.07 }); } else { tone(N.G6, 0.08, 'triangle', 0.1); tone(N.C7, 0.25, 'triangle', 0.1, { delay: 0.07 }); } },
      special() { [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => tone(f, 0.16, 'square', 0.09, { delay: i * 0.1 })); tone(N.C6, 0.6, 'square', 0.08, { delay: 0.45, vib: 7 }); tone(N.E6, 0.6, 'square', 0.05, { delay: 0.45 }); },
      done() { [N.G5, N.C6, N.E6, N.G6].forEach((f, i) => tone(f, 0.16, 'square', 0.13, { delay: i * 0.08 })); tone(N.C7, 0.4, 'square', 0.1, { delay: 0.34, vib: 8 }); },
    },
    // 2 · MAGIA: campanas, destellos y soplo de aire
    magia: {
      land() { tone(90, 0.35, 'sine', 0.25, { to: 55 }); bell(N.E6, 0.5, 0.05, 0.05); },
      hit(n) { bell([N.C6, N.E6, N.G6][n - 1] || N.G6, 0.8, 0.13); noise(0.15, 0.05, { type: 'highpass', f: 6000 }); },
      explode() { noise(0.9, 0.22, { type: 'bandpass', f: 300, to: 5000, q: 1.2 }); [N.C6, N.E6, N.G6, N.C7].forEach((f, i) => bell(f, 1.2, 0.1, 0.15 + i * 0.07)); tone(130, 1.2, 'sine', 0.2, { att: 0.05 }); },
      clink() { bell(2200 + Math.random() * 900, 0.25, 0.06); },
      card(i) { [N.C6, N.D6, N.E6, N.G6].forEach((f, j) => tone(f * (1 + i * 0.06), 0.3, 'sine', 0.07, { delay: j * 0.035 })); },
      tick() { tone(2400 + Math.random() * 200, 0.04, 'sine', 0.035); },
      collect(k) { (k === 'coin' ? [N.E6, N.G6, N.C7] : [N.G6, N.C7, 2637]).forEach((f, i) => bell(f, 0.5, 0.07, i * 0.06)); },
      special() { [N.C5, N.E5, N.G5, N.C6].forEach(f => { tone(f, 1.6, 'sine', 0.06, { att: 0.25 }); tone(f * 1.006, 1.6, 'sine', 0.04, { att: 0.25 }); }); [N.C6, N.E6, N.G6, N.C7].forEach((f, i) => bell(f, 1, 0.08, 0.3 + i * 0.09)); },
      done() { [N.G5, N.C6, N.E6, N.G6, N.C7].forEach((f, i) => bell(f, 0.9, 0.08, i * 0.08)); },
    },
    // 3 · FERIA: dibujos animados (madera, muelles, matasuegras y caja registradora)
    feria: {
      land() { tone(85, 0.12, 'triangle', 0.3, { to: 50 }); noise(0.04, 0.15, { f: 1500 }); tone(180, 0.45, 'sine', 0.12, { to: 520, slide: 0.12, vib: 12, delay: 0.06 }); },
      hit(n) { tone(780 + n * 90, 0.06, 'square', 0.18, { lp: 2400 }); tone(520 + n * 60, 0.06, 'square', 0.08, { lp: 1200, delay: 0.04 }); noise(0.12 + n * 0.08, 0.05 + n * 0.02, { type: 'bandpass', f: 250, q: 2 }); },
      explode() { noise(0.06, 0.4, { type: 'highpass', f: 1500 }); tone(300, 0.7, 'sawtooth', 0.09, { to: 520, slide: 0.25, vib: 9, lp: 2200, delay: 0.05 }); for (let i = 0; i < 10; i++) noise(0.03, 0.07, { type: 'highpass', f: 4000, delay: 0.15 + Math.random() * 0.5 }); },
      clink() { const f = 2400 + Math.random() * 600; tone(f, 0.08, 'triangle', 0.05); tone(f * 1.34, 0.06, 'triangle', 0.03); },
      card(i) { tone(420, 0.3, 'sine', 0.16, { to: 1300 + i * 100, slide: 0.24 }); tone(840, 0.3, 'triangle', 0.05, { to: 2600 + i * 200, slide: 0.24 }); },
      tick() { noise(0.02, 0.06, { type: 'highpass', f: 3000 }); },
      collect(k) { if (k === 'coin') { noise(0.12, 0.18, { type: 'bandpass', f: 3500, q: 1 }); bell(2093, 0.6, 0.12, 0.1); bell(2637, 0.6, 0.1, 0.16); } else { bell(2637, 0.5, 0.14); bell(3520, 0.4, 0.09, 0.05); } },
      special() { [[392, 0], [392, 0.12], [523, 0.24], [659, 0.42]].forEach(([f, d]) => { tone(f, d === 0.42 ? 0.7 : 0.11, 'sawtooth', 0.17, { lp: 3400, delay: d }); tone(f * 1.5, d === 0.42 ? 0.7 : 0.11, 'sawtooth', 0.09, { lp: 3400, delay: d }); }); noise(0.25, 0.12, { type: 'bandpass', f: 180, q: 3, delay: 0.42 }); },
      done() { [523, 587, 659, 784, 1047].forEach((f, i) => tone(f, i === 4 ? 0.45 : 0.13, 'sawtooth', 0.16, { lp: 3200, vib: 6, delay: i * 0.09 })); },
    },
  };
  let lastClink = 0, unlocked = false;
  // en móviles el audio solo arranca dentro de un toque: se desbloquea con un sonido mudo en el primero
  const unlock = () => {
    if (unlocked) return;
    try { const a = ctx(), b = a.createBuffer(1, 1, 22050), s = a.createBufferSource(); s.buffer = b; s.connect(a.destination); s.start(0); if (a.state !== 'suspended') unlocked = true; } catch (e) { /* nada */ }
  };
  for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) addEventListener(ev, unlock, { capture: true, passive: true });
  return {
    pack: 'arcade', packs: Object.keys(PACKS), unlock,
    play(ev, arg) {
      try {
        if (ev === 'clink') { const n = performance.now(); if (n - lastClink < 45) return; lastClink = n; }
        const p = PACKS[this.pack]; if (p && p[ev]) p[ev](arg);
      } catch (e) { /* sin sonido */ }
    },
  };
})();
