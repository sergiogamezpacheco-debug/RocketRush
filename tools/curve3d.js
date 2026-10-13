// Dificultad: % de victorias de un "jugador casual" simulado (apunta a su color el 70% de las veces)
global.CANNON = require('../vendor/cannon-es.cjs.js');
const { Sim } = require('../src/sim3d.js');
const { LEVELS } = require('../src/levels3d.js');
const N = +(process.argv[2] || 30);
const ids = process.argv.slice(3).map(Number);
function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
for (const L of LEVELS) {
  if (ids.length && !ids.includes(L.id)) continue;
  const t0 = Date.now();
  let wins = 0, close = 0, sumP = 0;
  const base = new Sim(L);
  for (let k = 0; k < N; k++) {
    const r = rng(1000 + k * 7919);
    const s = new Sim(L);
    let guard = 0;
    while (s.state === 'play' && guard++ < 9000) {
      if (s.canFire() && s.balls.length === 0 && s.pending.length === 0 && (s.maxV || 0) < 0.8) {
        const live = s.liveBlocks();
        if (!live.length) break;
        let b = live[Math.floor(r() * live.length)];
        if (r() < 0.7) {
          // elige un bloque de color y carga una bola de ese color si la tiene en la bandeja
          const colored = live.filter(x => x.userData.c);
          if (colored.length) {
            b = colored[Math.floor(r() * colored.length)];
            const i = s.queue.indexOf(b.userData.c);
            if (i > 0) s.select(i);
          }
        }
        s.fire(b.position.x + (r() - 0.5) * 0.6, b.position.y + (r() - 0.5) * 0.6, b.position.z + 0.3);
      }
      s.step();
    }
    if (s.state === 'won') wins++;
    else if (s.target - s.progress() < 0.12) close++;
    sumP += s.progress();
  }
  console.log(`N${L.id} ${L.name.padEnd(22)} objetivo=${Math.round(L.target * 100)}% bolas=${L.balls.length} victorias=${Math.round(100 * wins / N)}% casi=${Math.round(100 * close / N)}% media=${Math.round(100 * sumP / N)}% (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
