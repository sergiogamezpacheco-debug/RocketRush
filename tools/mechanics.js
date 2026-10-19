// Pruebas de las mecánicas nuevas (arena, bola congelada, camaleón, magma, antigravedad y objetos que cruzan)
global.CANNON = require('../vendor/cannon-es.cjs.js');
const { Sim, C } = require('../src/sim3d.js');
const { box3, byId } = require('../src/levels3d.js');
const run = (s, sec) => { for (let i = 0; i < sec * 120; i++) s.step(); };
const lv = (blocks, balls) => ({ id: 999, name: 'prueba', balls: balls || 'rrrr', target: 0.9, blocks, biome: 'sea' });
const kinds = s => { const o = {}; for (const b of s.liveBlocks()) o[b.userData.kind] = (o[b.userData.kind] || 0) + 1; return JSON.stringify(o); };
let ok = 0, bad = 0; const check = (name, cond, extra) => { cond ? ok++ : bad++; console.log((cond ? 'OK  ' : 'MAL ') + name + (extra ? ' · ' + extra : '')); };
// 1) arena pegada a un bloque que revienta se desmorona
{ const s = new Sim(lv([{ x: 0, y: 0.5, z: 0, w: 1, h: 1, d: 1, t: 'sand' }, { x: 1, y: 0.5, z: 0, w: 1, h: 1, d: 1, c: 'r' }]));
  s.popGroup(s.blocks[1], false); run(s, 1);
  check('arena junto a un bloque que revienta', !s.blocks[0].userData.alive, kinds(s)); }
// 2) bola congelada: un tiro cualquiera la rompe y da su bola
{ const s = new Sim(lv([{ x: 0, y: 0.5, z: 0, w: 1, h: 1, d: 1, t: 'prize', c: 'g' }, { x: 3, y: 0.5, z: 0, w: 1, h: 1, d: 1, c: 'b' }], 'rr'));
  const q0 = s.queue.join(''); s.fire(0, 0.5, 0.4); run(s, 2);
  check('bola congelada da su bola', s.queue.includes('g'), q0 + ' → ' + s.queue.join('')); }
// 3) camaleón cambia de color al terminar cada tiro
{ const s = new Sim(lv([{ x: 0, y: 0.5, z: 0, w: 1, h: 1, d: 1, t: 'cham', c: 'r' }, { x: 2.5, y: 0.5, z: 0, w: 1, h: 1, d: 1, c: 'b' }, { x: -2.5, y: 0.5, z: 0, w: 1, h: 1, d: 1, c: 'y' }], 'bbb'));
  const c0 = s.blocks[0].userData.c; s.fire(0, 3, -3); run(s, 3);
  check('camaleón cambia tras el tiro', s.blocks[0].userData.c !== c0, c0 + ' → ' + s.blocks[0].userData.c); }
// 4) magma: revienta el vecino y la columna de encima se funde
{ const blocks = [{ x: 0, y: 0.5, z: 0, w: 1, h: 1, d: 1, t: 'magma' }, { x: 1, y: 0.5, z: 0, w: 1, h: 1, d: 1, c: 'r' }];
  for (let j = 1; j < 4; j++) blocks.push({ x: 0, y: j + 0.5, z: 0, w: 1, h: 1, d: 1, c: 'bgy'[j - 1] });
  const s = new Sim(lv(blocks)); s.popGroup(s.blocks[1], false); run(s, 2);
  check('magma funde su columna', s.liveBlocks().length === 0, kinds(s)); }
// 5) antigravedad: quitas el apoyo y el flotante se queda en el aire
{ const s = new Sim(lv([{ x: 0, y: 0.5, z: 0, w: 1, h: 1, d: 1, c: 'r' }, { x: 0, y: 1.5, z: 0, w: 1, h: 1, d: 1, c: 'b', fl: true }]));
  const y0 = s.blocks[1].position.y; s.popGroup(s.blocks[0], false); run(s, 3);
  check('flotante se queda en el aire', Math.abs(s.blocks[1].position.y - y0) < 0.3, y0.toFixed(2) + ' → ' + s.blocks[1].position.y.toFixed(2)); }
// 6) los objetos que cruzan en cada paisaje: aparecen a la vista, y un tiro adelantado los alcanza y da sus 2 bolas
for (const id of [35, 68, 88, 130, 161]) {   // un nivel de cada paisaje (desierto, nieve, selva, volcán y espacio)
  const L = byId(id), s = new Sim(L); s.nextBird = 1e9; s.nextShip = 0;
  run(s, 0.2); const m = s.movers.find(x => x.kind === 'ship'); if (!m) { check('aparece en ' + L.biome, false); continue; }
  const K = C.CARRIERS[m.carrier]; m.x = -m.dir * (m.xr - 4);
  const bx = K.balls[0], S = K.s, ty0 = () => m.y0;
  // apunta a la primera bola, con la caída o subida del recorrido
  let tx = m.x, ty = m.y; for (let k = 0; k < 8; k++) { const Ln = s.launch(tx, ty, m.z); tx = m.x + m.dir * (m.speed * Ln.T + bx[0] * S); ty = m.y0 - (K.slope ? K.slope * m.dir * tx : 0) + bx[1] * S; }
  s.queue.unshift('r'); s.fire(tx, ty, m.z);
  let won = null; for (let i = 0; i < 600 && !won; i++) { s.step(); for (const e of s.events) if (e.type === 'moverHit') won = e.balls; s.events.length = 0; }
  check(`${K.name} (${L.biome}) se alcanza y da sus bolas`, won && won.join() === m.balls.join(), `lleva ${m.balls} · da ${won} · altura ${m.y0.toFixed(1)} z ${m.z.toFixed(0)}`);
}
console.log(bad ? `${bad} fallos` : `todo bien (${ok})`);
