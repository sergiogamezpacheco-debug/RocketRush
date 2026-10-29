// Afina los 50 niveles de un evento (bolas y objetivo) y los guarda en src/gentune.js con su gid (hw1…hw50, xm1…xm50).
// Evento: EV=hw (Halloween, por defecto) o EV=xm (Navidad).
// node tools/hwtune.js parte total salida.jsonl  ·  node tools/hwtune.js --merge a.jsonl b.jsonl …
global.CANNON = require('../vendor/cannon-es.cjs.js');
const fs = require('fs'), path = require('path');
if (process.argv[2] === '--merge') {
  const G = require('../src/gentune.js'), T = Object.assign({}, G);
  for (const f of process.argv.slice(3)) for (const line of fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean)) { const r = JSON.parse(line); T[r.gid] = [r.nb, r.target, r.win]; }
  fs.writeFileSync(path.join(__dirname, '..', 'src', 'gentune.js'), `// Generado por tools/gentune.js: [bolas, objetivo, % de victorias medido] de cada nivel generado
(function (root) {
  const T = ${JSON.stringify(T)};
  if (typeof module !== 'undefined' && module.exports) module.exports = T;
  else root.GenTuning = T;
})(typeof globalThis !== 'undefined' ? globalThis : this);
`);
  console.log('ok', Object.keys(T).filter(k => k.startsWith('hw')).length, 'niveles de Halloween ·', Object.keys(T).filter(k => k.startsWith('xm')).length, 'de Navidad');
  process.exit(0);
}
const { Sim } = require('../src/sim3d.js');
const LV = require('../src/levels3d.js'), HW = process.env.EV === 'xm' ? LV.XM : LV.HW, retune = LV.retune;
const part = +process.argv[2] || 0, parts = +process.argv[3] || 1, out = process.argv[4], N = 8;
function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
function measure(L) {
  let wins = 0;
  for (let k = 0; k < N; k++) {
    const r = rng(1000 + k * 7919), s = new Sim(L); let guard = 0;
    while (s.state === 'play' && guard++ < 9000) {
      if (s.canFire() && s.balls.length === 0 && s.pending.length === 0 && (s.maxV || 0) < 0.8) {
        const live = s.liveBlocks(); if (!live.length) break;
        let k0 = s.queue[0];
        if (r() < 0.2 && s.queue.length > 1) { s.swap(); k0 = s.queue[0]; }
        let pool = live.filter(b => b.userData.c === k0);
        if (!pool.length || r() > 0.7) pool = live;
        const b = pool[Math.floor(r() * pool.length)];
        s.fire(b.position.x + (r() - 0.5) * 0.6, b.position.y + (r() - 0.5) * 0.6, b.position.z + 0.3);
      }
      s.step();
    }
    if (s.state === 'won') wins++;
  }
  return Math.round(100 * wins / N);
}
const band = L => L.tier === 'hard' ? [30, 50] : L.tier === 'medium' ? [50, 75] : [75, 100];
const ONLY = (process.env.IDS || '').split(',').filter(Boolean).map(Number);
for (const L of HW.filter(l => !l.boss && (!ONLY.length || ONLY.includes(l.pos))).filter((l, i) => i % parts === part)) {
  const [lo, hi] = band(L), mid = (lo + hi) / 2;
  let nb = L.balls.length, target = L.target, best = null;
  for (let it = 0; it < 5; it++) {
    retune(L, nb, target); nb = L.balls.length;
    const win = measure(L);
    if (!best || Math.abs(win - mid) < Math.abs(best.win - mid)) best = { nb, target, win };
    if (win >= lo && win <= hi) break;
    if (win < lo) { if (nb < 14) nb = Math.min(14, nb + Math.max(1, Math.ceil((lo - win) / 18))); else target = Math.max(0.55, +(target - 0.08).toFixed(2)); }
    else { if (target < 0.92) target = Math.min(0.95, +(target + (win - hi > 25 ? 0.12 : 0.06)).toFixed(2)); else if (nb > 4) nb = Math.max(4, nb - Math.max(1, Math.ceil((win - hi) / 20))); else break; }
  }
  fs.appendFileSync(out, JSON.stringify({ gid: L.gid, id: L.id, tier: L.tier, nb: best.nb, target: best.target, win: best.win }) + '\n');
}
