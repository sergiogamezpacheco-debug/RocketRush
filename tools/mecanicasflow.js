// 25-11: mecánicas de los mundos nuevos en el simulador.  node tools/mecanicasflow.js
// · bote de pintura: al darle, pinta de su color los bloques de alrededor
// · lienzo: se pinta del color de la bola y revienta con los de ese color que toca
// · pila + metal: la corriente rompe los metales que se tocan; el suelto se queda
// · cinta + palanca: tras cada tiro avanza; con la palanca va a la trituradora y lo rompe
global.window = global; global.CANNON = require('../vendor/cannon-es.cjs.js');
const { Sim } = require('../src/sim3d.js');
let ok = true; const chk = (n, c, x) => { console.log((c ? 'OK ' : 'MAL'), n, x !== undefined ? JSON.stringify(x) : ''); if (!c) ok = false; };
const B = (x, y, c, t, o) => Object.assign({ x, y: y + 0.5, z: 0, w: 1, h: 1, d: 1 }, c ? { c } : {}, t ? { t } : {}, o || {});
const mk = (blocks, balls) => { const s = new Sim({ id: 9999, name: 'prueba', balls, nb: balls.length, target: 0.9, blocks, cannon: { x: 0, y: 1.2, z: 14.5 } }); s.nextBird = 1e9; s.nextShip = 1e9; for (let i = 0; i < 60; i++) s.step(); return s; };
const run = (s, n, f) => { for (let i = 0; i < n; i++) { s.step(); for (const e of s.events) f && f(e); s.events.length = 0; } };
const at = (s, k) => s.liveBlocks().find(b => b.userData.kind === k);
const shoot = (s, b) => { s.sinceFire = 9; s.fire(b.position.x, b.position.y, b.position.z + 0.4); };

{ // bote de pintura rojo en medio de bloques azules
  const bl = []; for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) bl.push(i === 2 && j === 1 ? B(-2 + i, j, 'r', 'paint') : B(-2 + i, j, 'b'));
  const s = mk(bl, 'gb'); const p = at(s, 'paint'); let rec = 0, spl = 0;
  shoot(s, p); run(s, 400, e => { if (e.type === 'recolor') rec++; if (e.type === 'paintsplash') spl++; });
  const red = s.liveBlocks().filter(b => b.userData.kind === 'block' && b.userData.c === 'r').length;
  chk('bote de pintura: salpica y pinta de rojo los de alrededor', spl === 1 && rec >= 5 && red >= 5, { spl, rec, red });
}
{ // lienzo con azules alrededor: bola azul al lienzo → revientan el lienzo y los azules pegados
  const bl = [B(-1, 0, 'b'), B(0, 0, null, 'canvas'), B(1, 0, 'b'), B(0, 1, 'b'), B(-2, 0, 'y'), B(2, 0, 'y'), B(0, 2, 'y')];
  const s = mk(bl, 'by'); const cv = at(s, 'canvas'); let pops = 0, rec = 0;
  shoot(s, cv); run(s, 400, e => { if (e.type === 'pop') pops++; if (e.type === 'recolor') rec++; });
  chk('lienzo: se pinta de azul y revienta con los azules (4)', rec === 1 && pops >= 4 && !s.liveBlocks().some(b => b.userData.c === 'b'), { rec, pops });
}
{ // pila + 4 metales unidos + 1 metal suelto
  const bl = [B(-3, 0, null, 'battery'), B(-2, 0, null, 'metal'), B(-1, 0, null, 'metal'), B(-1, 1, null, 'metal'), B(0, 1, null, 'metal'), B(3, 0, null, 'metal'), B(1, 0, 'r'), B(2, 0, 'r')];
  const s = mk(bl, 'rr'); const bt = at(s, 'battery'); let zap = 0, off = 0, clank = 0;
  shoot(s, bt); run(s, 500, e => { if (e.type === 'zap') zap = e.n; if (e.type === 'metalOff') off++; });
  const left = s.liveBlocks().filter(b => b.userData.kind === 'metal').length;
  chk('pila: rompe los 4 metales unidos y deja el suelto', zap === 4 && off === 4 && left === 1, { zap, off, left });
  const m = at(s, 'metal'); shoot(s, m); run(s, 300, e => { if (e.type === 'clank') clank++; });
  chk('la bola rebota en el metal sin romperlo', clank >= 1 && s.liveBlocks().filter(b => b.userData.kind === 'metal').length === 1, { clank });
  const s2 = mk(bl, 'rr'); const before = s2.liveBlocks().filter(b => b.userData.kind === 'metal').length;
  s2.explode(-1, 1, 0, 1.6, true); run(s2, 200);
  chk('una explosión rompe metal', s2.liveBlocks().filter(b => b.userData.kind === 'metal').length < before);
}
{ // cinta con 3 bloques encima, palanca a un lado
  const bl = [B(-4, 0, null, 'lever'), { x: 0, y: 2.15, z: 0, w: 6, h: 0.3, d: 1.3, t: 'belt', dir: -1 }, B(-1, 2.3, 'y'), B(0, 2.3, 'p'), B(1, 2.3, 'y'), B(2.5, 0, 'g'), B(-2.5, 0, 'g')];
  const s = mk(bl, 'gggg'); const lev = at(s, 'lever');
  chk('la cinta no cuenta como bloque', s.total === 5, s.total);
  // un tiro cualquiera: la cinta avanza hacia la izquierda (sin trituradora)
  const x0 = s.liveBlocks().filter(b => b.userData.c === 'p')[0].position.x;
  shoot(s, s.liveBlocks().find(b => b.userData.c === 'g')); run(s, 900);
  const x1 = s.liveBlocks().filter(b => b.userData.c === 'p')[0]; chk('tras un tiro la cinta mueve los bloques (hacia la izquierda)', x1 && x1.position.x < x0 - 0.5, { x0, x1: x1 && x1.position.x });
  let lv = 0, cr = 0; shoot(s, lev); run(s, 900, e => { if (e.type === 'lever') lv++; if (e.type === 'crush') cr++; });
  for (let k = 0; k < 8; k++) { s.beltT = 0.45; run(s, 200, e => { if (e.type === 'crush') cr++; }); }   // 8 tiros más (cada tiro, un paso)
  chk('palanca: la cinta cambia de sentido y la trituradora rompe lo que llega', lv === 1 && cr >= 2, { lv, cr, left: s.liveBlocks().filter(b => ['y', 'p'].includes(b.userData.c)).map(b => [b.position.x.toFixed(1), b.position.y.toFixed(1)]) });
}
console.log(ok ? 'TODO BIEN' : 'FALLOS');
