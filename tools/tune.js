// Afinador: mide cada nivel con el jugador casual simulado y ajusta bolas y objetivo hasta su franja
global.CANNON = require('../vendor/cannon-es.cjs.js');
const fs = require('fs'), path = require('path');
const { Sim } = require('../src/sim3d.js');
const { ALL, retune } = require('../src/levels3d.js');
const ids = process.argv.slice(3).map(Number), out = process.argv[2];
const N = 16;
function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
function band(L) {
  if (L.bonus) return [70, 95];
  if (L.tier === 'hard') return L.world === 1 ? [35, 50] : [28, 42];
  if (L.tier === 'medium') return [55, 72];
  return L.world === 1 ? [85, 100] : [75, 95];
}
function measure(L) {
  let wins = 0, close = 0;
  for (let k = 0; k < N; k++) {
    const r = rng(1000 + k * 7919), s = new Sim(L);
    let guard = 0;
    while (s.state === 'play' && guard++ < 9000) {
      if (s.canFire() && s.balls.length === 0 && s.pending.length === 0 && (s.maxV || 0) < 0.8) {
        const live = s.liveBlocks();
        if (!live.length) break;
        let k0 = s.queue[0];
        if (r() < 0.2 && s.queue.length > 1) { s.swap(); k0 = s.queue[0]; }
        let pool = live.filter(b => b.userData.c === k0);
        if (!pool.length || r() > 0.7) pool = live;
        const b = pool[Math.floor(r() * pool.length)];
        s.fire(b.position.x + (r() - 0.5) * 0.6, b.position.y + (r() - 0.5) * 0.6, b.position.z + 0.3);
      }
      s.step();
    }
    if (s.state === 'won') wins++; else if (s.target - s.progress() < 0.12) close++;
  }
  return { win: Math.round(100 * wins / N), close: Math.round(100 * close / N) };
}
const res = {};
for (const L of ALL) {
  if (ids.length && !ids.includes(L.id)) continue;
  const [lo, hi] = band(L);
  let nb = L.balls.length, target = L.target, m, hist = [];
  for (let it = 0; it < 7; it++) {
    retune(L, nb, target); nb = L.balls.length;
    m = measure(L);
    hist.push(`${nb}b/${Math.round(target * 100)}%→${m.win}%`);
    if (m.win >= lo && m.win <= hi) break;
    if (m.win < lo) {
      if (nb < 10) nb += L.bonus ? new Set(L.balls).size : (lo - m.win > 25 ? 2 : 1);
      else target = Math.max(0.55, +(target - 0.05).toFixed(2));
    } else {
      if (target < 0.9) target = Math.min(0.95, +(target + (m.win - hi > 15 ? 0.08 : 0.04)).toFixed(2));
      else if (nb > 3) nb -= L.bonus ? new Set(L.balls).size : 1;
      else break;
    }
  }
  res[L.name] = { nb, target, win: m.win, close: m.close, band: [lo, hi], id: L.id };
  console.log(`${L.bonus ? 'E' + (L.id - 100) : 'N' + L.id} ${L.name.padEnd(22)} franja ${lo}-${hi}%  ${hist.join('  ')}`);
  fs.writeFileSync(out, JSON.stringify(res, null, 1));
}
