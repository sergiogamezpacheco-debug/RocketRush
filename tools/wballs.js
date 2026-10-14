// Prueba de las 10 bolas de los mundos: cuántos bloques rompe cada una de un solo tiro (nivel 1 y nivel 10)
global.CANNON = require('../vendor/cannon-es.cjs.js');
const { Sim, WBALLS } = require('../src/sim3d.js');
const { byId } = require('../src/levels3d.js');
const L = byId(+process.argv[2] || 18);
for (const k of Object.keys(WBALLS)) {
  const row = [];
  for (const lv of [1, 10]) {
    const s = new Sim(L, { boosters: [k], wlv: { [k]: lv } });
    const n0 = s.liveBlocks().length, front = s.liveBlocks().reduce((a, b) => b.position.z > a.position.z ? b : a);
    const ev = {}; const orig = s.emit.bind(s); s.emit = e => { ev[e.type] = (ev[e.type] || 0) + 1; orig(e); };
    s.fire(0, 1.6, front.position.z + 0.3);
    for (let i = 0; i < 120 * 5; i++) s.step();
    row.push(`nv${lv}: ${n0 - s.liveBlocks().length}/${n0}`);
  }
  console.log(k.padEnd(4), WBALLS[k].name.padEnd(30), row.join('  '));
}
