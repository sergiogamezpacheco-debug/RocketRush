// Cubo arcoíris: solo se activa con un tiro directo (lo primero que toca la bola). Si le llega una bola rebotada o tras
// reventar un grupo, o una explosión, se rompe sin efecto.  node tools/prismflow.js
global.window = global; global.CANNON = require('../vendor/cannon-es.cjs.js');
const { Sim } = require('../src/sim3d.js'); const Lv = require('../src/levels3d.js');
const levels = Lv.LEVELS.filter(l => !l.boss && JSON.stringify(l.blocks).includes('prism')).slice(0, 40);
let ok = true, direct = 0, directN = 0, indirectWave = 0, indirectN = 0;
const run = (L, aim) => {
  const s = new Sim(L); s.nextBird = 1e9; s.nextShip = 1e9; for (let i = 0; i < 60; i++) s.step();
  const t = aim(s); if (!t) return null; s.sinceFire = 9; s.fire(t.x, t.y, t.z);
  let wave = 0, off = 0, first = null;
  const bh = s.ballHit.bind(s); s.ballHit = (ball, other, ...r) => { if (first === null && other.userData.kind !== 'island') first = other.userData.kind; return bh(ball, other, ...r); };
  for (let i = 0; i < 600; i++) { s.step(); for (const e of s.events) { if (e.type === 'prism') wave++; if (e.type === 'prismOff') off++; } s.events.length = 0; }
  return { wave, off, first };
};
for (const L of levels) {
  // directo: a un cubo arcoíris que no tenga nada delante (el más adelantado)
  const r1 = run(L, s => { const p = s.liveBlocks().filter(b => b.userData.kind === 'prism').sort((a, b) => b.position.z - a.position.z)[0]; return p && { x: p.position.x, y: p.position.y, z: p.position.z + 0.3 }; });
  if (r1 && r1.first === 'prism') { directN++; if (r1.wave) direct++; }   // solo los tiros en que lo primero que toca la bola es el cubo
  // a un grupo normal de su color (como antes)
  const r2 = run(L, s => { const col = s.queue[0]; const b = s.liveBlocks().filter(o => o.userData.kind === 'block' && o.userData.c === col).sort((a, b) => (b.position.z - a.position.z) || (a.position.y - b.position.y))[0]; return b && { x: b.position.x, y: b.position.y, z: b.position.z + 0.3 }; });
  if (r2) { indirectN++; if (r2.wave) indirectWave++; }
}
console.log('tiro directo (lo primero que toca la bola es el cubo arcoíris): se activa en', direct, 'de', directN);
console.log('tiro a un grupo normal: el cubo arcoíris se activa en', indirectWave, 'de', indirectN, '(antes, 4 de 40)');
// explosión: una bomba junto al cubo arcoíris lo rompe sin efecto
{
  const L = levels[0]; const s = new Sim(L); s.nextBird = 1e9; s.nextShip = 1e9; for (let i = 0; i < 60; i++) s.step();
  const p = s.liveBlocks().find(b => b.userData.kind === 'prism'); let wave = 0, off = 0;
  s.explode(p.position.x + 0.6, p.position.y, p.position.z, 1.6, true);
  for (let i = 0; i < 120; i++) { s.step(); for (const e of s.events) { if (e.type === 'prism') wave++; if (e.type === 'prismOff') off++; } s.events.length = 0; }
  console.log('explosión al lado: activa', wave, '· se rompe sin efecto', off);
  if (wave || !off) ok = false;
}
if (indirectWave || direct !== directN || !directN) ok = false;
console.log(ok ? 'TODO BIEN' : 'FALLOS');
