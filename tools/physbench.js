// Banco de pruebas de la física (sin dibujo): cuánto cuesta cada fotograma (2 pasos de 1/120 s) en varios niveles,
// con disparos reales. Uso: node --expose-gc tools/physbench.js [nivel ...]
global.CANNON = require(process.env.ORIG ? '../vendor/cannon-es.cjs.js' : '../vendor/cannon-es.fast.cjs.js');
const { Sim } = require('../src/sim3d.js');
const { byId } = require('../src/levels3d.js');
const ids = process.argv.slice(2).map(Number).filter(Boolean);
const LV = ids.length ? ids : [1, 9, 25, 60, 120, 250, 480, 750, 990];
function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
let tot = [], heapAlloc = 0;
for (const id of LV) {
  const L = byId(id); if (!L) continue;
  const r = rng(77 + id), s = new Sim(L), frames = [];
  let guard = 0, h0 = process.memoryUsage().heapUsed, alloc = 0;
  const tb = performance.now(); s.update(0); const build = performance.now() - tb;
  while (s.state === 'play' && guard++ < 2400) {
    if (s.canFire() && s.balls.length === 0 && s.pending.length === 0 && (s.maxV || 0) < 0.8) {
      const live = s.liveBlocks(); if (!live.length) break;
      let pool = live.filter(b => b.userData.c === s.queue[0]); if (!pool.length) pool = live;
      const b = pool[Math.floor(r() * pool.length)];
      s.fire(b.position.x + (r() - 0.5) * 0.4, b.position.y + (r() - 0.5) * 0.4, b.position.z + 0.3);
    }
    const t = performance.now(); s.update(1 / 60); frames.push(performance.now() - t);
    const h = process.memoryUsage().heapUsed; if (h > h0) alloc += h - h0; h0 = h;
  }
  const srt = [...frames].sort((a, b) => a - b), q = p => srt[Math.min(srt.length - 1, Math.floor(srt.length * p))];
  const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
  tot.push(...frames); heapAlloc += alloc;
  console.log(`${String(id).padStart(4)} ${L.name.padEnd(22).slice(0, 22)} bloques ${String(s.blocks.length).padStart(3)} · fotograma ${avg.toFixed(2)} ms · p95 ${q(0.95).toFixed(2)} · p99 ${q(0.99).toFixed(2)} · máx ${srt[srt.length - 1].toFixed(1)} · basura ${(alloc / 1048576 / (frames.length / 60)).toFixed(2)} MB/s · ${s.state}`);
}
const srt = tot.sort((a, b) => a - b);
console.log(`TOTAL fotogramas ${srt.length} · medio ${(srt.reduce((a, b) => a + b, 0) / srt.length).toFixed(2)} ms · p99 ${srt[Math.floor(srt.length * 0.99)].toFixed(2)} · máx ${srt[srt.length - 1].toFixed(1)} · basura ${(heapAlloc / 1048576 / (srt.length / 60)).toFixed(2)} MB/s`);
