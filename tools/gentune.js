// Afinador rápido de los niveles generados (101-1000 y extras 11-100): node tools/gentune.js parte total salida.jsonl
global.CANNON = require('../vendor/cannon-es.cjs.js');
const fs = require('fs');
const { Sim } = require('../src/sim3d.js');
const { ALL, retune } = require('../src/levels3d.js');
const part = +process.argv[2] || 0, parts = +process.argv[3] || 1, out = process.argv[4], N = 6;
const done = new Set(process.argv.slice(4).filter(f => fs.existsSync(f)).flatMap(f => fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l).id)));
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
const band = L => L.bonus ? [65, 100] : L.tier === 'hard' ? [25, 45] : L.tier === 'medium' ? [50, 75] : [75, 100];
const list = ALL.filter(l => l.gen).filter((l, i) => i % parts === part && !done.has(l.id));
for (const L of list) {
  const [lo, hi] = band(L), mid = (lo + hi) / 2;
  let nb = L.balls.length, target = L.target, best = null;
  for (let it = 0; it < 4; it++) {
    retune(L, nb, target); nb = L.balls.length;
    const win = measure(L);
    if (!best || Math.abs(win - mid) < Math.abs(best.win - mid)) best = { nb, target, win };
    if (win >= lo && win <= hi) break;
    if (win < lo) { if (nb < 14) nb = Math.min(14, nb + (L.bonus ? new Set(L.balls).size : Math.max(1, Math.ceil((lo - win) / 18)))); else target = Math.max(0.55, +(target - 0.08).toFixed(2)); }
    else { if (target < 0.92) target = Math.min(0.95, +(target + (win - hi > 25 ? 0.12 : 0.06)).toFixed(2)); else if (nb > 3) nb -= L.bonus ? new Set(L.balls).size : Math.max(1, Math.ceil((win - hi) / 20)); else break; }
  }
  fs.appendFileSync(out, JSON.stringify({ id: L.id, nb: best.nb, target: best.target, win: best.win }) + '\n');
}
