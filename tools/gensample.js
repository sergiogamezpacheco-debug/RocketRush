// Mide una muestra de niveles generados con sus bolas y objetivo: node tools/gensample.js parte total
global.CANNON = require('../vendor/cannon-es.cjs.js');
const { Sim } = require('../src/sim3d.js');
const { LEVELS } = require('../src/levels3d.js');
const part = +process.argv[2] || 0, parts = +process.argv[3] || 1, N = 12;
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
const sample = LEVELS.filter(l => l.gen && (l.id * 37) % 11 === 0);
sample.forEach((L, i) => { if (i % parts !== part) return; console.log(JSON.stringify({ id: L.id, tier: L.tier, biome: L.biome, n: L.blocks.length, nb: L.nb, target: L.target, win: measure(L) })); });
