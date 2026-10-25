// Estabilidad: cada nivel debe quedarse quieto sin disparar
global.CANNON = require('../vendor/cannon-es.cjs.js');
const { Sim, obbGap } = require('../src/sim3d.js');
const { ALL } = require('../src/levels3d.js');
let bad = 0;
for (const L of require("../src/levels3d.js").HW) {
  const probs = [];
  const s = new Sim(L);
  const bl = s.blocks;
  for (let i = 0; i < bl.length; i++) for (let j = i + 1; j < bl.length; j++) if (obbGap(bl[i], bl[j]) < -0.02) probs.push(`solape ${i}-${j}`);
  let maxR = 0; for (const b of L.blocks) maxR = Math.max(maxR, Math.hypot(Math.abs(b.x) + b.w / 2, Math.abs(b.z) + b.d / 2));
  if (maxR > 5.3) probs.push('se sale de la isla ' + maxR.toFixed(1));
  for (let i = 0; i < 360; i++) s.step();
  let drift = 0; bl.forEach((b, i) => { drift = Math.max(drift, Math.hypot(b.position.x - L.blocks[i].x, b.position.y - L.blocks[i].y, b.position.z - L.blocks[i].z)); });
  if (drift > 0.05) probs.push('deriva ' + drift.toFixed(2));
  if (s.fallen) probs.push('caen ' + s.fallen);
  const colors = new Set(L.blocks.filter(b => b.c).map(b => b.c));
  const missing = [...new Set(L.balls)].filter(c => 'rbgyp'.includes(c) && !colors.has(c));
  if (missing.length) probs.push('bolas de colores que no hay: ' + missing.join(''));
  if (probs.length) bad++;
  console.log(`${L.bonus ? 'E' + (L.id - 10000) : 'N' + L.id} ${L.name.padEnd(22)} bloques=${String(bl.length).padStart(2)} bolas=${L.balls} ${probs.length ? '⚠ ' + probs.join('; ') : 'OK'}`);
}
console.log(bad ? `${bad} niveles con problemas` : 'todos estables');
