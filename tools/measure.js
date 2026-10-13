// Mide la tasa de victorias de un nivel con unas bolas y un objetivo concretos: node tools/measure.js id:bolas:objetivo ...
global.CANNON = require('../vendor/cannon-es.cjs.js');
const { Sim } = require('../src/sim3d.js');
const { byId, retune } = require('../src/levels3d.js');
const N = 16;
function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
function measure(L) {
  let wins = 0, three = 0;
  for (let k = 0; k < N; k++) {
    const r = rng(1000 + k * 7919), s = new Sim(L);
    let guard = 0;
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
    if (s.state === 'won') { wins++; if (s.stars() >= 3) three++; }
  }
  return { win: Math.round(100 * wins / N), three: Math.round(100 * three / N) };
}
for (const arg of process.argv.slice(2)) {
  const [id, nb, t] = arg.split(':').map(Number), L = byId(id);
  retune(L, nb, t);
  const m = measure(L);
  console.log(`${id} ${L.name} ${L.balls.length}b ${Math.round(t * 100)}% → gana ${m.win}% · 3 estrellas ${m.three}%`);
}
