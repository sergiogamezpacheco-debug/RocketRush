// Rocket Rush — niveles. Isla de radio 5,6 con la superficie en y = 0. Bloque básico: cubo de 1 m.
// 1000 niveles en 100 mundos + 100 niveles extra (uno por mundo, se abren con 3 estrellas en sus 10 niveles).
// Los niveles 1-100 están hechos a mano; del 101 al 1000 los crea un generador determinista (ver genLevel).
// Los mundos 6-10 tienen paisaje propio (desierto, nieve, selva, volcán y espacio) y un bloque nuevo cada uno.
(function (root) {
  'use strict';
  // Código de celda:
  //   r b g y p = bloque de color · R B G Y P = rayado (revienta su fila)
  //   1 2 3 4 5 = bloque bomba (r b g y p) · 6 7 8 9 0 = hielo (r b g y p; necesita dos aciertos)
  //   s = piedra · t = TNT · x = cristal · o = oro (suelta monedas) · . = vacío
  //   a = arena (se deshace) · f = bola congelada (al romperla, la bola es tuya) · c = camaleón (cambia de color tras cada tiro)
  //   m = magma (estalla hacia arriba cuando revienta algo a su lado) · flotantes (antigravedad): función flo()
  //   k = cohete · n = piñata · h = reloj de arena · e = espejo · u = muelle · v = géiser · portales: función portalPair()
  //   j = caja sorpresa · w = cubo arcoíris · l = candado · i = llave · d = globo · z = imán · S = bola de nieve · C = chicle
  //   T = tótem · F = ventilador · burbujas (bub), nubes y lianas: objetos sueltos (ver inject)
  const BOMBC = { 1: 'r', 2: 'b', 3: 'g', 4: 'y', 5: 'p' };
  const ICEC = { 6: 'r', 7: 'b', 8: 'g', 9: 'y', 0: 'p' };
  const ICE = { r: '6', b: '7', g: '8', y: '9', p: '0' }, BOMB = { r: '1', b: '2', g: '3', y: '4', p: '5' };
  function cell(ch, x, y, z, s) {
    s = s || 1;
    const base = { x, y: y + s / 2, z, w: s, h: s, d: s };
    if ('rbgyp'.includes(ch)) return Object.assign(base, { c: ch });
    if ('RBGYP'.includes(ch)) return Object.assign(base, { c: ch.toLowerCase(), t: 'st' });
    if (BOMBC[ch]) return Object.assign(base, { c: BOMBC[ch], t: 'bm' });
    if (ICEC[ch]) return Object.assign(base, { c: ICEC[ch], t: 'i' });
    if (ch === 's') return Object.assign(base, { t: 's' });
    if (ch === 't') return Object.assign(base, { t: 'tnt' });
    if (ch === 'x') return Object.assign(base, { t: 'gl' });
    if (ch === 'o') return Object.assign(base, { t: 'gold' });
    if (ch === 'a') return Object.assign(base, { t: 'sand' });
    if (ch === 'f') return Object.assign(base, { t: 'prize' });
    if (ch === 'c') return Object.assign(base, { t: 'cham' });
    if (ch === 'm') return Object.assign(base, { t: 'magma' });
    if (ch === 'k') return Object.assign(base, { t: 'rocket' });     // cohete: sale disparado y barre su fila
    if (ch === 'n') return Object.assign(base, { t: 'pinata' });     // piñata: 2 golpes y suelta monedas
    if (ch === 'h') return Object.assign(base, { t: 'hourglass' });  // reloj de arena: +1 bola
    if (ch === 'e') return Object.assign(base, { t: 'mirror' });     // espejo: rebota la bola, no se rompe
    if (ch === 'u') return Object.assign(base, { t: 'spring' });     // muelle: lanza hacia arriba lo que tiene encima
    if (ch === 'v') return Object.assign(base, { t: 'geyser' });     // géiser: chorro que rompe su columna
    if (ch === 'j') return Object.assign(base, { t: 'gift' });       // caja sorpresa: potenciador al azar
    if (ch === 'w') return Object.assign(base, { t: 'prism' });      // cubo arcoíris: revienta un color entero
    if (ch === 'i') return Object.assign(base, { t: 'key' });        // llave: abre los candados
    if (ch === 'l') return Object.assign(base, { t: 'lock' });       // candado (su color lo pone el nivel)
    if (ch === 'd') return Object.assign(base, { t: 'balloon' });    // globo: sube si nada lo sujeta
    if (ch === 'z') return Object.assign(base, { t: 'magnet' });     // imán: atrae lo de alrededor
    if (ch === 'S') return Object.assign(base, { t: 'snowball' });   // bola de nieve: rueda y arrasa
    if (ch === 'C') return Object.assign(base, { t: 'gum' });        // chicle: la bola se queda pegada
    if (ch === 'T') return Object.assign(base, { t: 'totem' });      // tótem: cambia de color si fallas
    if (ch === 'F') return Object.assign(base, { t: 'fan', dir: x > 0 ? -1 : 1 });   // ventilador: sopla hacia el centro
    return null;
  }
  // capas de abajo arriba; cada capa = filas de delante (z mayor) hacia atrás; cada carácter = 1 columna en x
  function grid(cx, cz, base, layers, s) {
    s = s || 1;
    const out = [];
    layers.forEach((rows, li) => {
      const nz = rows.length;
      rows.forEach((row, ri) => {
        const nx = row.length;
        for (let ci = 0; ci < nx; ci++) {
          const b = cell(row[ci], cx + (ci - (nx - 1) / 2) * s, base + li * s, cz + ((nz - 1) / 2 - ri) * s, s);
          if (b) out.push(b);
        }
      });
    });
    return out;
  }
  // volumen W×D×H generado por una función (i = columna, j = altura, k = fila desde delante)
  function box3(cx, cz, base, W, D, H, pat, opts) {
    opts = opts || {};
    const s = opts.s || 1, out = [];
    for (let j = 0; j < H; j++) for (let k = 0; k < D; k++) for (let i = 0; i < W; i++) {
      if (opts.keep && !opts.keep(i, j, k, W, D, H)) continue;
      let ch = (opts.sp && opts.sp[`${i},${j},${k}`]) || pat(i, j, k, W, D, H);
      if (opts.map) ch = opts.map(ch, i, j, k, W, D, H);
      const b = cell(ch, cx + (i - (W - 1) / 2) * s, base + j * s, cz + ((D - 1) / 2 - k) * s, s);
      if (b) out.push(b);
    }
    return out;
  }
  function seeded(seed) { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ t >>> 15, 1 | t); r ^= r + Math.imul(r ^ r >>> 7, 61 | r); return ((r ^ r >>> 14) >>> 0) / 4294967296; }; }
  // patrones de color
  const P = {
    one: c => () => c,
    layer: cs => (i, j) => cs[j % cs.length],
    col: cs => (i) => cs[i % cs.length],
    row: cs => (i, j, k) => cs[k % cs.length],
    checker: cs => (i, j, k) => cs[(i + j + k) % cs.length],
    diag: cs => (i, j) => cs[(i + j) % cs.length],
    chunk: (cs, n) => (i, j, k) => cs[(Math.floor(i / n) + Math.floor(j / n) + Math.floor(k / n)) % cs.length],
    rand: (cs, seed) => { const memo = {}; const r = seeded(seed); return (i, j, k) => { const key = i + ',' + j + ',' + k; if (!memo[key]) memo[key] = cs[Math.floor(r() * cs.length)]; return memo[key]; }; },
  };
  // modificadores
  const toIce = (every) => (ch, i, j, k) => ('rbgyp'.includes(ch) && (i + j * 2 + k) % every === 0 ? ICE[ch] : ch);
  const shellIce = (ch, i, j, k, W, D, H) => ('rbgyp'.includes(ch) && (i === 0 || i === W - 1 || k === 0 || j === H - 1) ? ICE[ch] : ch);
  const plank = (x, y, z, w, d, c, h) => ({ x, y: y + (h || 0.4) / 2, z, w, h: h || 0.4, d, c });
  const pillar = (x, y, z, c, h, t) => ({ x, y: y + (h || 2) / 2, z, w: 0.5, h: h || 2, d: 0.5, c, t });
  const flat = (...a) => [].concat(...a);
  const zig = (i, j, k, W, D) => i >= j && i < W - j && k >= j && k < D - j;
  const stairsUp = (i, j) => j <= i;
  const flo = (arr) => { for (const b of arr) b.fl = true; return arr; };      // bloques con antigravedad
  const lift = (arr, dy) => { for (const b of arr) b.y += dy; return arr; };   // sube un grupo (para los flotantes)
  const ring = (n, r, f) => { const out = []; for (let q = 0; q < n; q++) { const a = q / n * Math.PI * 2 + Math.PI / 2; out.push(f(Math.cos(a) * r, Math.sin(a) * r, q)); } return flat(...out); };

  const LEVELS = [
    // ===== MUNDO 1 · Plaza mayor =====
    { name: 'Torre azul', balls: 'bbb', target: 0.8,
      goal: 'Dispara una bola azul a la torre azul: revienta todo el grupo de su color.',
      blocks: grid(0, 0, 0, [['bb', 'bb'], ['bb', 'bb'], ['bb', 'bb'], ['bb', 'bb']]) },
    { name: 'Bicolor', balls: 'rbrb', target: 0.8,
      goal: 'Toca la bandeja para cambiar de bola. Revienta un color y el otro se viene abajo.',
      blocks: grid(0, 0, 0, [['rr', 'rr'], ['bb', 'bb'], ['rr', 'rr'], ['bb', 'bb'], ['rr', 'rr']]) },
    { name: 'La muralla', balls: 'rgyrgy', target: 0.7,
      goal: 'Los bloques que caen sobre otros de su color también revientan: ¡cascada!',
      blocks: grid(0, 0, 0, [['rrggyy'], ['ggyyrr'], ['yyrrgg'], ['rrggyy']]) },
    { name: 'La pirámide', balls: 'bybyry', target: 0.75,
      goal: 'Busca el color que sostiene la pirámide.',
      blocks: grid(0, 0, 0, [['bbbbb', 'bbbbb'], ['yyyy', 'yyyy'], ['rrr', 'rrr'], ['bb', 'bb'], ['y', 'y']]) },
    { name: 'El puente', balls: 'gryrg', target: 0.75,
      goal: 'Dos torres y un puente. Si cae una torre, cae el puente.',
      blocks: flat(grid(-2, 0, 0, [['gg', 'gg'], ['rr', 'rr'], ['gg', 'gg']]), grid(2, 0, 0, [['gg', 'gg'], ['rr', 'rr'], ['gg', 'gg']]),
        [plank(0, 3, 0, 6, 2, 'y')], grid(0, 0, 3.4, [['rr', 'rr'], ['yy', 'yy']])) },
    { name: 'Piedra', balls: 'bgbgbgb', target: 0.65,
      goal: 'La piedra gris no revienta ni cuenta para el porcentaje, pero sostiene lo que tiene encima.',
      blocks: grid(0, 0, 0, [['bggb', 'bggb'], ['ssss', 'ssss'], ['gbbg', 'gbbg'], ['.ss.', '.ss.'], ['.bb.', '.gg.']]) },
    { name: 'El castillo', balls: 'bryggby', target: 0.7,
      goal: 'Cuatro torres, murallas y la torre del homenaje.',
      blocks: flat(grid(-2.5, -1.5, 0, [['r'], ['r'], ['r'], ['r'], ['y']]), grid(2.5, -1.5, 0, [['r'], ['r'], ['r'], ['r'], ['y']]),
        grid(-2.5, 1.5, 0, [['b'], ['b'], ['b'], ['b'], ['y']]), grid(2.5, 1.5, 0, [['b'], ['b'], ['b'], ['b'], ['y']]),
        grid(0, 1.5, 0, [['gggg'], ['gggg'], ['g..g']]), grid(0, -0.5, 0, [['yy', 'yy'], ['yy', 'yy'], ['bb', 'bb'], ['r.', '.r']])) },
    { name: 'Rayas', balls: 'rbgyrb', target: 0.8,
      goal: 'Los bloques rayados, al reventar, se llevan toda su fila.',
      blocks: grid(0, 0, 0, [['rrbbgg', 'rrbbgg'], ['ggRbbr', 'ggrBbr'], ['bbyygg', 'bbyygg'], ['yYrrby', 'yyrRby']]) },
    { name: 'Dinamita', balls: 'gybgyb', target: 0.75,
      goal: 'La TNT explota con un golpe fuerte o si revienta un bloque pegado a ella.',
      blocks: flat(grid(-1.5, 0, 0, [['gg', 'gg'], ['yy', 'yy'], ['bb', 'bb'], ['gg', 'gg']]), grid(1.5, 0, 0, [['yy', 'yy'], ['gg', 'gg'], ['bb', 'bb'], ['yy', 'yy']]), grid(0, 0, 0, [['t'], ['b']])) },
    { name: 'Fortaleza de cristal', balls: 'ybrr', target: 0.9,
      goal: 'El cristal se rompe con cualquier golpe fuerte, sea del color que sea.',
      blocks: flat(grid(0, 0, 0, [['x.x.x', 'x.x.x'], ['x.x.x', 'x.x.x']]), [plank(0, 2, 0, 5, 2, 'y')],
        grid(0, 0, 2.4, [['rbybr', 'rbybr'], ['ybrby', 'ybrby'], ['.rbr.', '.brb.']])) },

    // ===== MUNDO 2 · Feria del castillo =====
    { name: 'Puentes colgantes', balls: 'brgbygrb', target: 0.65,
      goal: 'Tres pisos de puentes. Los pilares de cada piso son de un color.',
      blocks: flat([pillar(-2, 0, 0.6, 'b'), pillar(2, 0, 0.6, 'b'), pillar(-2, 0, -0.6, 'b'), pillar(2, 0, -0.6, 'b')], [plank(0, 2, 0, 5, 2, 'r')],
        [pillar(-1.5, 2.4, 0.6, 'g'), pillar(1.5, 2.4, 0.6, 'g'), pillar(-1.5, 2.4, -0.6, 'g'), pillar(1.5, 2.4, -0.6, 'g')], [plank(0, 4.4, 0, 4, 2, 'y')],
        grid(0, 0, 4.8, [['bgb', 'gbg'], ['.r.', '.y.']])) },
    { name: 'Caramelo bomba', nb: 5, target: 0.75,
      goal: 'Los bloques con lunares son bombas: al reventar, explotan y se llevan lo que tienen cerca.',
      blocks: box3(0, 0, 0, 5, 2, 4, P.layer(['r', 'y', 'g', 'b']), { sp: { '2,1,0': '4', '0,3,1': '2', '4,2,0': '3' } }) },
    { name: 'Morado', nb: 6, target: 0.75,
      goal: 'Llega el quinto color: el morado.',
      blocks: box3(0, 0, 0, 4, 2, 5, P.rand(['p', 'b', 'g', 'y'], 13)) },
    { name: 'Tiovivo', nb: 6, target: 0.75,
      goal: 'Seis torres alrededor de una central, como un tiovivo.',
      blocks: flat(ring(6, 2.7, (x, z, q) => box3(x, z, 0, 1, 1, 4, P.one('rbgyrp'[q]))), box3(0, 0, 0, 2, 2, 3, P.layer(['y', 'p', 'y']))) },
    { name: 'Torre del reloj', nb: 4, target: 0.8,
      goal: 'Una torre alta y estrecha. Golpea abajo para que caiga entera.',
      blocks: box3(0, 0, 0, 3, 3, 7, P.rand(['r', 'b', 'g', 'y'], 15), { sp: { '1,3,0': 'R', '1,5,0': 'B' } }) },
    { name: 'Cubo mágico', nb: 6, target: 0.75,
      goal: 'Un cubo de colores por bloques de dos en dos.',
      blocks: box3(0, 0, 0, 4, 4, 3, P.rand(['r', 'b', 'g', 'y', 'p'], 16)) },
    { name: 'Escalinata', nb: 6, target: 0.75,
      goal: 'Cada escalón se apoya en el anterior.',
      blocks: box3(0, 0, 0, 6, 2, 6, P.layer(['g', 'p', 'y', 'b', 'r', 'g']), { keep: stairsUp }) },
    { name: 'Doble muralla', nb: 7, target: 0.7,
      goal: 'Dos murallas: la de delante tapa a la de atrás. Apunta por encima.',
      blocks: flat(box3(0, 1.4, 0, 6, 1, 3, P.diag(['r', 'y', 'b'])), box3(0, -1.4, 0, 6, 1, 5, P.layer(['g', 'g', 'p', 'p', 'y']))) },
    { name: 'Zigurat', nb: 7, target: 0.75,
      goal: 'Una pirámide escalonada en 3D, con rayados en cada piso.',
      blocks: box3(0, 0, 0, 6, 6, 3, P.rand(['b', 'y', 'r', 'g'], 19), { keep: zig, sp: { '2,0,0': 'B', '2,1,1': 'Y', '3,2,2': 'R' } }) },
    { name: 'Palacio real', balls: 'rbgy', target: 0.94,
      goal: 'El palacio tiene de todo. Usa la TNT y los rayados a tu favor.',
      blocks: flat(grid(-2.5, 0, 0, [['ss', 'ss'], ['rR', 'rr'], ['bb', 'bb'], ['g.', '.g']]), grid(2.5, 0, 0, [['ss', 'ss'], ['bb', 'Bb'], ['rr', 'rr'], ['.g', 'g.']]),
        grid(0, 0.5, 0, [['gtg', 'yyy'], ['yGy', 'xgx'], ['rrr', 'rbr'], ['b2b', 'bbb'], ['.y.', '.y.']])) },

    // ===== MUNDO 3 · Almacén helado =====
    { name: 'Cubitos', nb: 7, target: 0.75,
      goal: 'El hielo necesita dos golpes de su color: el primero rompe la capa y el segundo revienta el bloque.',
      blocks: flat(box3(-1.5, 0, 0, 2, 2, 3, P.layer(['7', 'b', 'b'])), box3(1.5, 0, 0, 2, 2, 3, P.layer(['8', 'g', 'g']))) },
    { name: 'Iglú', nb: 7, target: 0.75,
      goal: 'Capa de hielo por fuera, colores por dentro.',
      blocks: box3(0, 0, 0, 5, 5, 3, P.layer(['b', 'y', 'b']), { keep: zig, map: (ch, i, j, k, W, D) => (k === j ? ICE[ch] : ch) }) },
    { name: 'Témpanos', nb: 7, target: 0.7,
      goal: 'Cristal, hielo y tablones: rompe los apoyos.',
      blocks: flat(box3(-2, 0, 0, 1, 2, 2, P.one('x')), box3(0, 0, 0, 1, 2, 2, P.one('7')), box3(2, 0, 0, 1, 2, 2, P.one('x')),
        [plank(0, 2, 0, 5, 2, 'y')], box3(0, 0, 2.4, 4, 2, 2, P.checker(['r', 'g']))) },
    { name: 'Pista de hielo', nb: 7, target: 0.75,
      goal: 'Una pista ancha y baja. Busca las cascadas.',
      blocks: box3(0, 0, 0, 7, 3, 2, P.checker(['b', 'p', 'y']), { map: toIce(4) }) },
    { name: 'Fortín helado', nb: 5, target: 0.8,
      goal: 'El fortín está forrado de hielo.',
      blocks: box3(0, 0, 0, 5, 3, 4, P.layer(['r', 'g', 'b', 'y']), { map: shellIce }) },
    { name: 'Nevera', nb: 7, target: 0.7,
      goal: 'Esquinas de piedra y estantes de colores.',
      blocks: box3(0, 0, 0, 4, 3, 4, P.layer(['y', '9', 'p', 'g']), { map: (ch, i, j, k, W, D) => ((i === 0 || i === W - 1) && (k === 0 || k === D - 1) ? 's' : ch) }) },
    { name: 'Carámbanos', nb: 7, target: 0.7,
      goal: 'Pilares de colores sostienen bloques de hielo.',
      blocks: flat([pillar(-2, 0, 0.6, 'p', 2.5), pillar(2, 0, 0.6, 'p', 2.5), pillar(-2, 0, -0.6, 'g', 2.5), pillar(2, 0, -0.6, 'g', 2.5)],
        [plank(0, 2.5, 0, 5, 2, 'b')], box3(0, 0, 2.9, 4, 2, 2, P.checker(['6', 'y']))) },
    { name: 'Muñecos de nieve', nb: 8, target: 0.7,
      goal: 'Tres muñecos de nieve: cuerpo de hielo y cabeza de color.',
      blocks: flat(box3(-2.5, 0, 0, 2, 2, 3, P.layer(['7', '7', 'r'])), box3(0, 0, 0, 2, 2, 3, P.layer(['8', '8', 'y'])), box3(2.5, 0, 0, 2, 2, 3, P.layer(['0', '0', 'b']))) },
    { name: 'Glaciar', nb: 8, target: 0.7,
      goal: 'Una escalera helada. Arriba es más fácil hacer cascadas.',
      blocks: box3(0, 0, 0, 6, 2, 6, P.rand(['g', 'b', 'p', 'y'], 29), { keep: stairsUp, map: (ch, i, j) => (j === i ? ICE[ch] : ch) }) },
    { name: 'Castillo de hielo', nb: 6, target: 0.85,
      goal: 'Torres de hielo y una torre central rayada.',
      blocks: flat(ring(4, 3.0, (x, z, q) => box3(x, z, 0, 1, 1, 4, P.layer([ICE['rbgy'[q]], 'rbgy'[q]]))),
        box3(0, 0, 0, 2, 2, 5, P.layer(['p', 'y', 'P', 'y', 'p']))) },

    // ===== MUNDO 4 · Puerto =====
    { name: 'Faro', nb: 7, target: 0.75,
      goal: 'El faro es alto: si cae la base, cae todo.',
      blocks: box3(0, 0, 0, 2, 2, 8, P.rand(['r', 'y', 'b', 'g'], 31), { map: (ch, i, j) => (j === 0 ? 's' : j >= 6 ? 'x' : ch), sp: { '0,3,0': 'R' } }) },
    { name: 'Muelle', nb: 7, target: 0.7,
      goal: 'Un muelle de tablones sobre pilotes.',
      blocks: flat([pillar(-3, 0, 0.6, 'b', 1.6), pillar(-1, 0, 0.6, 'g', 1.6), pillar(1, 0, 0.6, 'b', 1.6), pillar(3, 0, 0.6, 'g', 1.6),
        pillar(-3, 0, -0.6, 'b', 1.6), pillar(-1, 0, -0.6, 'g', 1.6), pillar(1, 0, -0.6, 'b', 1.6), pillar(3, 0, -0.6, 'g', 1.6)],
        [plank(0, 1.6, 0, 7, 2, 'y')], box3(0, 0, 2.0, 6, 1, 2, P.col(['r', 'r', 'p', 'p', 'r', 'r']))) },
    { name: 'Contenedores', nb: 6, target: 0.75,
      goal: 'Contenedores gigantes: pesan mucho, pero revientan igual.',
      blocks: box3(0, 0, 0, 3, 1, 3, P.checker(['r', 'b', 'y', 'g']), { s: 2 }) },
    { name: 'Grúa', nb: 7, target: 0.7,
      goal: 'La grúa sostiene una carga de colores.',
      blocks: flat(box3(-2.5, 0, 0, 1, 1, 5, P.one('y')), box3(2.5, 0, 0, 1, 1, 5, P.one('y')), [plank(0, 5, 0, 6, 1, 'r')],
        box3(0, 0, 5.4, 3, 1, 2, P.checker(['b', 'g'])), box3(0, 0, 0, 3, 2, 2, P.layer(['p', 'b']))) },
    { name: 'Barco', nb: 5, target: 0.8,
      goal: 'Un barco cargado de barriles de TNT.',
      blocks: flat(box3(0, 0, 0, 7, 2, 2, P.col(['r', 'r', 'b', 'b', 'b', 'r', 'r']), { sp: { '2,1,0': 't', '4,1,0': 't' } }),
        box3(0, 0, 2, 3, 2, 2, P.layer(['y', 'g'])), box3(0, 0, 4, 1, 1, 3, P.one('p'))) },
    { name: 'Almacenes', nb: 8, target: 0.7,
      goal: 'Tres almacenes separados: elige bien a cuál disparar.',
      blocks: flat(box3(-2.7, 0, 0, 2, 2, 3, P.layer(['g', 'p', 'g'])), box3(0, -0.5, 0, 2, 2, 4, P.diag(['y', 'b'])), box3(2.7, 0, 0, 2, 2, 3, P.layer(['r', 'y', 'r']))) },
    { name: 'Barriles', nb: 6, target: 0.75,
      goal: 'Cada fila tiene un barril de TNT. Una explosión lleva a otra.',
      blocks: box3(0, 0, 0, 6, 2, 3, P.rand(['b', 'g', 'p', 'y'], 37), { sp: { '1,0,0': 't', '4,2,1': 't' } }) },
    { name: 'Rompeolas', nb: 8, target: 0.7,
      goal: 'Un muro de piedra protege los colores de atrás.',
      blocks: flat(box3(0, 1.5, 0, 6, 1, 2, P.one('s')), box3(0, -0.5, 0, 6, 2, 4, P.chunk(['r', 'y', 'b'], 2))) },
    { name: 'Lonja', nb: 8, target: 0.7,
      goal: 'Arcos en fila: cada arco sostiene el tejado.',
      blocks: flat([-3, -1, 1, 3].map(x => pillar(x, 0, 0, 'gbgb'[(x + 3) / 2], 2.2)), [plank(0, 2.2, 0, 7, 1.4, 'y')],
        box3(0, 0, 2.6, 6, 1, 2, P.col(['r', 'p', 'p', 'r', 'r', 'p']))) },
    { name: 'Fortaleza del puerto', nb: 6, target: 0.85,
      goal: 'Piedra, hielo, TNT y contenedores.',
      blocks: flat(box3(-2.5, 0, 0, 2, 2, 4, P.layer(['s', 'r', '6', 'r'])), box3(2.5, 0, 0, 2, 2, 4, P.layer(['s', 'b', '7', 'b'])),
        box3(0, 0, 0, 3, 2, 3, P.checker(['y', 'g']), { sp: { '1,0,0': 't' } }), box3(0, -0.5, 3, 1, 1, 2, P.one('p'), { s: 2 })) },

    // ===== MUNDO 5 · Palacio de cristal =====
    { name: 'Vidriera', nb: 7, target: 0.75,
      goal: 'Cristal y rayados: rompe una fila entera.',
      blocks: box3(0, 0, 0, 6, 2, 5, P.rand(['r', 'b', 'g', 'y'], 41), { map: (ch, i, j, k) => (k === 0 && (i + j) % 4 === 0 ? 'x' : ch), sp: { '1,1,0': 'R', '4,3,0': 'B' } }) },
    { name: 'Escalera real', nb: 8, target: 0.7,
      goal: 'Dos escaleras que suben hasta el mismo rellano.',
      blocks: box3(0, 0, 0, 7, 2, 4, P.rand(['p', 'y', 'r', 'b'], 42), { keep: (i, j) => j <= Math.min(i, 6 - i) }) },
    { name: 'Columnata', nb: 8, target: 0.7,
      goal: 'Columnas de cristal y bloques de colores encima.',
      blocks: flat(...[-3, -1.5, 0, 1.5, 3].map((x, q) => box3(x, 0, 0, 1, 1, 3, P.layer(['s', 'pgbyr'[q], 'pgbyr'[(q + 2) % 5]]))), [plank(0, 3, 0, 7.2, 1.4, 'g')],
        box3(0, 0, 3.4, 5, 1, 2, P.col(['r', 'y', 'b', 'y', 'r']))) },
    { name: 'Salón del trono', nb: 8, target: 0.7,
      goal: 'Muros en U alrededor del trono.',
      blocks: flat(box3(-2.5, 0, 0, 1, 4, 3, P.layer(['b', 'p', 'b'])), box3(2.5, 0, 0, 1, 4, 3, P.layer(['b', 'p', 'b'])),
        box3(0, -1.5, 0, 4, 1, 3, P.layer(['g', 'y', 'g'])), box3(0, 0.5, 0, 2, 2, 2, P.one('r'), { sp: { '0,1,0': '1' } })) },
    { name: 'Torres gemelas', nb: 5, target: 0.8,
      goal: 'Dos torres altas. Haz que una caiga sobre la otra.',
      blocks: flat(box3(-1.8, 0, 0, 2, 2, 7, P.rand(['r', 'b', 'y', 'p'], 45)), box3(1.8, 0, 0, 2, 2, 7, P.rand(['r', 'b', 'y', 'p'], 46))) },
    { name: 'Laberinto', nb: 8, target: 0.7,
      goal: 'Muros bajos en forma de laberinto.',
      blocks: box3(0, 0, 0, 7, 5, 2, P.diag(['g', 'b', 'p']), { keep: (i, j, k) => k % 2 === 0 ? (i !== 3 || k === 0) : (i === 0 || i === 6) }) },
    { name: 'Fuegos artificiales', nb: 6, target: 0.8,
      goal: 'TNT y bloques bomba por todas partes. ¡Que empiece la fiesta!',
      blocks: box3(0, 0, 0, 4, 3, 4, P.rand(['r', 'y', 'b', 'g'], 47), { sp: { '0,0,0': 't', '2,3,0': '4' } }) },
    { name: 'Jardín', nb: 9, target: 0.7,
      goal: 'Ocho setos alrededor de una fuente.',
      blocks: flat(ring(8, 3.2, (x, z, q) => box3(x, z, 0, 1, 1, 3, P.one('gp'[q % 2]))), box3(0, 0, 0, 2, 2, 2, P.layer(['b', 'x']))) },
    { name: 'Cúpula', nb: 8, target: 0.75,
      goal: 'Una gran cúpula escalonada: la cima es de cristal.',
      blocks: box3(0, 0, 0, 7, 5, 3, P.rand(['p', 'r', 'b', 'y'], 49), { keep: zig, map: (ch, i, j) => (j === 2 ? 'x' : ch), sp: { '3,0,0': 'P', '3,1,1': 'R' } }) },
    { name: 'Gran palacio', nb: 7, target: 0.88,
      goal: 'El gran palacio de cristal. Todo lo aprendido, a la vez.',
      blocks: flat(box3(-2.6, 0, 0, 2, 2, 5, P.layer(['s', '6', 'r', 'R', 'r'])), box3(2.6, 0, 0, 2, 2, 5, P.layer(['s', '7', 'b', 'B', 'b'])),
        box3(0, 0, 0, 3, 3, 4, P.checker(['y', 'p', 'g']), { sp: { '1,0,0': 't', '1,2,1': '4' } }), box3(0, 0, 4, 3, 1, 2, P.one('x'))) },

    // ===== MUNDO 6 · Dunas doradas (desierto) · novedad: ARENA =====
    { name: 'Castillo de arena', nb: 5, target: 0.75,
      goal: 'La arena se deshace con cualquier golpe y cuando revienta un bloque pegado a ella.',
      blocks: flat(box3(-1.5, 0, 0, 2, 2, 4, P.layer(['a', 'y', 'a', 'y'])), box3(1.5, 0, 0, 2, 2, 4, P.layer(['a', 'b', 'a', 'b']))) },
    { name: 'Oasis', nb: 5, target: 0.75,
      goal: 'Palmeras con el tronco de arena alrededor del estanque.',
      blocks: flat(ring(6, 2.7, (x, z, q) => box3(x, z, 0, 1, 1, 4, P.layer(['a', 'a', 'a', 'gy'[q % 2]]))), box3(0, 0, 0, 2, 2, 2, P.layer(['b', 'r']))) },
    { name: 'Pirámide de arena', nb: 6, target: 0.75,
      goal: 'Cada piso de arena sostiene uno de color.',
      blocks: box3(0, 0, 0, 7, 5, 4, P.rand(['y', 'b', 'r', 'g'], 53), { keep: zig, map: (ch, i, j, k) => (j === 1 && (i + k) % 3 === 0 ? 'a' : ch), sp: { '3,1,1': 'R' } }) },
    { name: 'Caravana', nb: 5, target: 0.75,
      goal: 'Cuatro camellos con patas de arena.',
      blocks: flat(...[-3, -1, 1, 3].map((x, q) => flat(box3(x, 0, 0, 1, 2, 1, P.one('a')), box3(x, 0, 1, 1, 2, 2, P.one('rbgy'[q]))))) },
    { name: 'Esfinge', nb: 6, target: 0.75,
      goal: 'La esfinge guarda el desierto. Empieza por las garras.',
      blocks: flat(box3(0, -0.5, 0, 3, 4, 2, P.rand(['y', 'r', 'b', 'g'], 55), { map: (ch, i, j, k) => (j === 0 && (i === 0 || i === 2) && k % 2 === 1 ? 'a' : ch) }), box3(0, 0.5, 2, 3, 2, 2, P.checker(['r', 'b', 'y'])),
        box3(-1, 2.5, 0, 1, 1, 1, P.one('a')), box3(1, 2.5, 0, 1, 1, 1, P.one('a'))) },
    { name: 'Dunas', nb: 5, target: 0.75,
      goal: 'Dunas de colores sobre la arena.',
      blocks: box3(0, 0, 0, 7, 2, 3, (i, j) => (j === 1 ? 'a' : 'gpby'[(i + j) % 4]), { keep: (i, j) => j <= 1 + Math.round(Math.sin(i * 0.9)) }) },
    { name: 'Templo del sol', nb: 7, target: 0.75,
      goal: 'Ocho columnas de arena sostienen el templo.',
      blocks: flat(...[-3, -1, 1, 3].map(x => flat(box3(x, 1, 0, 1, 1, 3, P.one('a')), box3(x, -1, 0, 1, 1, 3, P.one('a')))),
        [plank(0, 3, 0, 7.4, 3, 'y')], box3(0, 0, 3.4, 5, 2, 2, P.checker(['r', 'b', 'p']), { sp: { '2,1,0': 't' } })) },
    { name: 'Ruinas', nb: 6, target: 0.75,
      goal: 'Restos de una ciudad antigua entre la piedra y la arena.',
      blocks: box3(0, 0, 0, 6, 3, 3, P.rand(['a', 'r', 'y', 's', 'b'], 58), { keep: (i, j, k) => !(j === 2 && (i + k) % 2 === 1) }) },
    { name: 'Obelisco', nb: 6, target: 0.75,
      goal: 'Un obelisco muy alto. Si cae la arena de abajo, cae entero.',
      blocks: box3(0, 0, 0, 2, 2, 8, P.layer(['a', 'r', 'y', 'a', 'b', 'g', 'a', 'p']), { sp: { '0,4,0': 'Y' } }) },
    { name: 'Gran pirámide', nb: 7, target: 0.75,
      goal: 'La gran pirámide esconde TNT en su interior.',
      blocks: box3(0, 0, 0, 7, 5, 4, (i, j, k) => (j === 0 ? ((i + k) % 3 === 0 ? 'a' : 'rbyg'[(i * 3 + k) % 4]) : j === 1 ? 'ry'[(i + k) % 2] : 'b'), { keep: zig, sp: { '3,1,2': 't', '3,2,2': 'B' } }) },

    // ===== MUNDO 7 · Pico helado (nieve) · novedad: BOLA CONGELADA =====
    { name: 'Casa de hielo', nb: 5, target: 0.75,
      goal: 'Hay bolas congeladas en el hielo: rómpelas de un golpe y esa bola pasa a tu bandeja.',
      blocks: box3(0, 0, 0, 6, 4, 3, P.rand(['b', 'p', 'g'], 61), { keep: zig, sp: { '2,0,0': 'f' } }) },
    { name: 'Muñeco de nieve', nb: 6, target: 0.75,
      goal: 'Tres bolas de nieve, una encima de otra.',
      blocks: flat(box3(0, 0, 0, 3, 3, 2, P.rand(['b', 'p', 'y'], 62)), box3(0, 0, 2, 2, 2, 2, P.rand(['p', 'r', 'b'], 63), { sp: { '0,0,0': 'f' } }), box3(0, 0, 4, 1, 1, 1, P.one('r'))) },
    { name: 'Trineo', nb: 5, target: 0.75,
      goal: 'El trineo lleva regalos congelados.',
      blocks: flat(box3(0, 0, 0, 5, 2, 1, P.col(['r', 'y'])), [plank(0, 1, 0, 5.4, 2.2, 'b')], box3(-1, -0.5, 1.4, 2, 1, 1, P.one('f')), box3(1.5, -0.5, 1.4, 1, 1, 2, P.one('p'))) },
    { name: 'Cueva de hielo', nb: 6, target: 0.75,
      goal: 'Pilares de hielo y dos bolas congeladas dentro de la cueva.',
      blocks: flat(box3(-2, 0, 0, 1, 2, 3, P.one('7')), box3(2, 0, 0, 1, 2, 3, P.one('7')), [plank(0, 3, 0, 5.2, 2.2, 'p')], box3(0, 0, 3.4, 5, 2, 1, P.col(['p', 'b', 'p', 'b', 'p'])), box3(0, 0.5, 0, 1, 1, 2, P.one('f')), box3(0, -0.5, 0, 3, 1, 1, P.one('y'))) },
    { name: 'Avalancha', nb: 8, target: 0.75,
      goal: 'Una ladera helada. Las bolas congeladas te ayudarán.',
      blocks: box3(0, 0, 0, 6, 3, 6, P.layer(['b', 'p', 'r', 'y', 'b', 'p']), { keep: stairsUp, map: toIce(4), sp: { '5,5,0': 'f', '2,2,1': 'f' } }) },
    { name: 'Pingüinos', nb: 5, target: 0.75,
      goal: 'Cinco pingüinos alrededor de un regalo.',
      blocks: flat(ring(5, 2.6, (x, z) => box3(x, z, 0, 1, 1, 3, P.layer(['b', 'b', 'y']))), box3(0, 0, 0, 1, 1, 1, P.one('f'))) },
    { name: 'Telesilla', nb: 6, target: 0.75,
      goal: 'Las sillas del telesilla van muy altas.',
      blocks: flat(box3(-3, 0, 0, 1, 1, 4, P.one('r')), box3(3, 0, 0, 1, 1, 4, P.one('r')), [plank(0, 4, 0, 7.2, 1, 'b')],
        box3(-1.5, 0, 4.4, 1, 1, 1, P.one('f')), box3(1.5, 0, 4.4, 1, 1, 1, P.one('y')), box3(0, 0, 4.4, 1, 1, 1, P.one('p')), box3(0, 0, 0, 3, 1, 2, P.layer(['y', 'b']))) },
    { name: 'Estalactitas', nb: 6, target: 0.75,
      goal: 'Siete columnas de hielo de distinta altura.',
      blocks: flat(...[2, 3, 4, 5, 4, 3, 2].map((h, q) => box3(q - 3, 0, 0, 1, 1, h, P.layer(['p', 'b', 'g', 'b', 'p']), { sp: q === 3 ? { '0,4,0': 'f' } : {} }))) },
    { name: 'Fortaleza helada', nb: 7, target: 0.75,
      goal: 'Murallas de hielo con regalos escondidos dentro.',
      blocks: box3(0, 0, 0, 5, 4, 3, P.rand(['b', 'p', 'y'], 69), { map: shellIce, sp: { '2,0,1': 'f', '2,1,2': 'f' } }) },
    { name: 'Cumbre nevada', nb: 6, target: 0.75,
      goal: 'La cima del pico helado.',
      blocks: box3(0, 0, 0, 7, 4, 4, P.rand(['g', 'b', 'p', 'y'], 70), { keep: zig, sp: { '3,1,1': 'f' } }) },

    // ===== MUNDO 8 · Templo perdido (selva) · novedad: CAMALEÓN =====
    { name: 'Camaleón', nb: 5, target: 0.75,
      goal: 'El camaleón cambia de color después de cada tiro. Dale cuando tenga el color de tu bola.',
      blocks: box3(0, 0, 0, 4, 2, 3, P.layer(['g', 'y', 'g']), { sp: { '1,1,0': 'c', '2,2,0': 'c' } }) },
    { name: 'Raíces', nb: 6, target: 0.75,
      goal: 'Un árbol enorme: la copa descansa sobre el tronco.',
      blocks: flat(box3(0, 0, 0, 2, 2, 3, P.layer(['r', 'y', 'r'])), [plank(0, 3, 0, 4.2, 4.2, 'g')], box3(0, 0, 3.4, 4, 4, 2, P.rand(['g', 'g', 'c', 'p'], 72))) },
    { name: 'Ídolo', nb: 5, target: 0.75,
      goal: 'El ídolo tiene la cara de camaleón.',
      blocks: box3(0, 0, 0, 3, 2, 5, P.layer(['y', 'y', 'r', 'c', 'g'])) },
    { name: 'Puente de lianas', nb: 6, target: 0.75,
      goal: 'Los camaleones cruzan el puente.',
      blocks: flat(box3(-2.5, 0, 0, 2, 2, 4, P.layer(['g', 'p', 'g', 'p'])), box3(2.5, 0, 0, 2, 2, 4, P.layer(['b', 'y', 'b', 'y'])), [plank(0, 4, 0, 7, 2, 'r')], box3(0, 0, 4.4, 3, 1, 1, P.one('c'))) },
    { name: 'Escalera maya', nb: 6, target: 0.75,
      goal: 'Sube la escalera del templo.',
      blocks: box3(0, 0, 0, 6, 3, 6, P.layer(['g', 'y', 'r', 'g', 'y', 'r']), { keep: stairsUp, sp: { '3,3,1': 'c', '5,5,1': 'c' } }) },
    { name: 'Selva espesa', nb: 6, target: 0.75,
      goal: 'Entre tantas hojas se esconden varios camaleones.',
      blocks: box3(0, 0, 0, 6, 3, 3, P.rand(['g', 'b', 'y', 'c'], 76)) },
    { name: 'Cascada', nb: 5, target: 0.75,
      goal: 'Una cascada entre dos rocas.',
      blocks: flat(box3(0, -1, 0, 2, 2, 5, P.one('b')), box3(-2.2, 0, 0, 2, 1, 3, P.layer(['g', 'y', 'g'])), box3(2.2, 0, 0, 2, 1, 3, P.layer(['y', 'g', 'y'])), box3(0, -1, 5, 1, 1, 1, P.one('c'))) },
    { name: 'Templo perdido', nb: 8, target: 0.75,
      goal: 'El templo perdido: hielo, rayados y camaleones.',
      blocks: box3(0, 0, 0, 7, 5, 4, P.rand(['g', 'y', 'r', 'p'], 78), { keep: zig, map: toIce(5), sp: { '3,2,2': 'c', '1,0,0': 'c', '5,0,0': 'c', '3,1,1': 'G' } }) },
    { name: 'Nido', nb: 5, target: 0.75,
      goal: 'Un nido con un huevo muy raro.',
      blocks: flat(ring(8, 2.4, (x, z, q) => box3(x, z, 0, 1, 1, 2, P.one('yg'[q % 2]))), box3(0, 0, 0, 1, 1, 2, P.layer(['p', 'c']))) },
    { name: 'Corazón de la selva', nb: 7, target: 0.75,
      goal: 'El corazón de la selva late en colores.',
      blocks: flat(box3(0, 0, 0, 5, 3, 3, P.checker(['g', 'p', 'y']), { sp: { '2,0,0': 'c', '0,2,0': 'c', '4,2,0': 'c', '2,1,1': '1' } }), box3(0, 0, 3, 3, 1, 2, P.one('c'))) },

    // ===== MUNDO 9 · Isla de fuego (volcán) · novedad: MAGMA =====
    { name: 'Roca ardiente', nb: 5, target: 0.75,
      goal: 'El magma estalla hacia arriba cuando revienta un bloque pegado a él: funde toda su columna.',
      blocks: flat(box3(-1.5, 0, 0, 1, 1, 1, P.one('m')), box3(-1.5, 0, 1, 1, 1, 4, P.layer(['r', 'y', 'b', 'p'])),
        box3(1.5, 0, 0, 1, 1, 1, P.one('m')), box3(1.5, 0, 1, 1, 1, 4, P.layer(['y', 'r', 'p', 'b'])), box3(0, 0, 0, 2, 1, 2, P.layer(['r', 'y']))) },
    { name: 'Chimenea', nb: 6, target: 0.75,
      goal: 'Dos bolsas de magma al pie de la chimenea.',
      blocks: box3(0, 0, 0, 3, 3, 6, P.layer(['b', 'r', 'y', 'r', 'y', 'p']), { sp: { '1,0,0': 'm', '1,0,1': 'm' } }) },
    { name: 'Coladas', nb: 5, target: 0.75,
      goal: 'Ríos de magma bajo las columnas.',
      blocks: box3(0, 0, 0, 6, 2, 3, P.col(['r', 'y', 'p', 'r', 'y', 'p']), { map: (ch, i, j) => (j === 0 && i % 2 === 0 ? 'm' : ch) }) },
    { name: 'Forja', nb: 6, target: 0.75,
      goal: 'La forja: piedra, magma y metal de colores.',
      blocks: flat(box3(0, 0, 0, 5, 2, 1, P.one('s')), box3(0, 0, 1, 5, 2, 1, P.col(['m', 'r', 'm', 'y', 'm'])), box3(0, 0, 2, 5, 2, 3, P.rand(['r', 'y', 'p', 'b'], 84))) },
    { name: 'Obsidiana', nb: 5, target: 0.75,
      goal: 'Roca negra y magma por debajo.',
      blocks: box3(0, 0, 0, 5, 3, 3, P.checker(['s', 'r', 'y']), { map: (ch, i, j) => (ch === 's' && j === 0 ? 'm' : ch) }) },
    { name: 'Cráter', nb: 8, target: 0.75,
      goal: 'Un anillo de lava alrededor del cráter.',
      blocks: flat(ring(8, 3, (x, z, q) => box3(x, z, 0, 1, 1, 3, P.layer(['m', 'ry'[q % 2], 'pb'[q % 2]]))), box3(0, 0, 0, 2, 2, 4, P.rand(['r', 'y', 'p', 'b'], 86), { sp: { '0,0,0': 'm', '1,0,0': 'm' } })) },
    { name: 'Géiser', nb: 5, target: 0.75,
      goal: 'Haz que el géiser de magma lo funda todo.',
      blocks: flat(box3(0, 0, 0, 1, 1, 1, P.one('m')), box3(0, 0, 1, 1, 1, 6, P.layer(['r', 'y', 'r', 'y', 'p', 'p'])), box3(-1.5, 0, 0, 2, 2, 3, P.one('y')), box3(1.5, 0, 0, 2, 2, 3, P.one('r'))) },
    { name: 'Fragua', nb: 7, target: 0.75,
      goal: 'Magma escondido entre los colores y una TNT.',
      blocks: box3(0, 0, 0, 6, 3, 4, P.layer(['p', 'r', 'y', 'b']), { sp: { '1,0,0': 'm', '4,0,0': 'm', '2,0,2': 'm', '3,1,1': 't' } }) },
    { name: 'Ceniza', nb: 6, target: 0.75,
      goal: 'La ceniza se deshace como la arena.',
      blocks: box3(0, 0, 0, 5, 2, 4, P.diag(['s', 'r', 'y', 'p']), { map: (ch, i, j) => (ch === 's' && j > 0 ? 'a' : ch), sp: { '2,0,0': 'm' } }) },
    { name: 'Corazón del volcán', nb: 7, target: 0.75,
      goal: 'El corazón del volcán: magma en toda la base.',
      blocks: box3(0, 0, 0, 7, 5, 4, P.rand(['r', 'y', 'p', 'b'], 90), { keep: zig, map: (ch, i, j, k) => (j === 0 && (i + k) % 4 === 0 ? 'm' : ch), sp: { '3,2,2': 'R' } }) },

    // ===== MUNDO 10 · Base lunar (espacio) · novedad: ANTIGRAVEDAD =====
    { name: 'Gravedad cero', nb: 5, target: 0.75,
      goal: 'Aquí hay bloques que flotan: si quitas lo de abajo, se quedan en el aire. Revienta su color.',
      blocks: flat(box3(0, 0, 0, 3, 2, 2, P.one('b')), flo(box3(0, 0, 3, 3, 2, 2, P.one('p')))) },
    { name: 'Satélite', nb: 6, target: 0.75,
      goal: 'Un satélite con dos paneles flotando sobre su torre.',
      blocks: flat(box3(0, 0, 0, 1, 1, 3, P.layer(['p', 'r', 'p'])), flo(box3(0, 0, 3, 2, 2, 2, P.checker(['g', 'y']))), flo(box3(-2.5, 0, 3.5, 2, 1, 1, P.col(['b', 'p']))), flo(box3(2.5, 0, 3.5, 2, 1, 1, P.col(['p', 'b'])))) },
    { name: 'Cohete', nb: 5, target: 0.75,
      goal: 'Un cohete listo para despegar entre estrellas flotantes.',
      blocks: flat(box3(0, 0, 0, 2, 2, 6, P.layer(['r', 'y', 'b', 'b', 'b', 'r'])), box3(-1.5, 0, 0, 1, 1, 2, P.one('r')), box3(1.5, 0, 0, 1, 1, 2, P.one('r')),
        flo(box3(-3, 0, 4, 1, 1, 1, P.one('y'))), flo(box3(3, 0, 5, 1, 1, 1, P.one('y')))) },
    { name: 'Estación espacial', nb: 6, target: 0.75,
      goal: 'Módulos que giran sobre la estación.',
      blocks: flat(box3(0, 0, 0, 5, 2, 2, P.col(['g', 'p', 'b', 'p', 'g'])), flo(lift(ring(6, 2.6, (x, z, q) => box3(x, z, 0, 1, 1, 1, P.one('ybr'[q % 3]))), 4))) },
    { name: 'Anillos', nb: 5, target: 0.75,
      goal: 'Un planeta con anillos de bloques flotantes.',
      blocks: flat(box3(0, 0, 0, 2, 2, 3, P.one('p')), flo(lift(ring(8, 2.5, (x, z, q) => box3(x, z, 0, 1, 1, 1, P.one('bg'[q % 2]))), 1.5))) },
    { name: 'Asteroides', nb: 7, target: 0.75,
      goal: 'Un enjambre de asteroides flotando sobre la roca.',
      blocks: flat(box3(0, 0, 0, 5, 3, 1, P.one('s')), flo(box3(0, 0, 1.2, 5, 3, 3, P.rand(['b', 'p', 'y', 'g'], 96), { keep: (i, j, k) => (i * 7 + j * 5 + k * 3) % 3 !== 0 }))) },
    { name: 'Cráter lunar', nb: 5, target: 0.75,
      goal: 'Rocas lunares y un cubo flotando en el centro.',
      blocks: flat(ring(6, 2.4, (x, z, q) => box3(x, z, 0, 1, 1, 2, P.layer(['s', 'gby'[q % 3]]))), flo(box3(0, 0, 2, 2, 2, 2, P.one('p')))) },
    { name: 'Nebulosa', nb: 5, target: 0.75,
      goal: 'Dos nubes de colores, una flotando sobre la otra.',
      blocks: flat(box3(0, 0, 0, 4, 2, 2, P.checker(['b', 'p'])), flo(box3(0, 0, 3, 4, 2, 2, P.checker(['y', 'g'])))) },
    { name: 'Agujero negro', nb: 8, target: 0.75,
      goal: 'Todo gira alrededor del agujero negro.',
      blocks: flat(box3(0, 0, 0, 5, 3, 3, P.rand(['b', 'p', 'y', 'g', 'r'], 99), { map: toIce(4) }), flo(lift(ring(6, 3, (x, z, q) => box3(x, z, 0, 1, 1, 1, P.one('rbgyp'[q % 5]))), 4)), flo(box3(0, 0, 4.5, 1, 1, 1, P.one('c')))) },
    { name: 'Galaxia final', nb: 8, target: 0.75,
      goal: 'La última galaxia: todo lo aprendido, flotando.',
      blocks: flat(box3(0, 0, 0, 5, 3, 2, P.layer(['b', 'p']), { sp: { '2,0,0': 'm', '2,1,1': 'f' } }), flo(box3(0, 0, 3, 5, 3, 2, P.rand(['y', 'g', 'r', 'c'], 100)))) },
  ];

  // ===== NIVELES EXTRA (se abren con 3 estrellas en los 10 niveles del mundo) =====
  const BONUS = [
    { name: 'Cofre del tesoro', nb: 6, target: 0.7,
      goal: 'Nivel extra: los bloques de oro sueltan monedas. Derríbalos todos.',
      blocks: box3(0, 0, 0, 4, 3, 4, P.rand(['r', 'y', 'b'], 101), { map: (ch, i, j, k, W) => (i > 0 && i < W - 1 && j < 2 && k === 0 ? 'o' : ch), sp: { '0,3,0': '1', '3,3,0': '2' } }) },
    { name: 'Piñata', nb: 6, target: 0.7,
      goal: 'Nivel extra: una piñata rellena de oro.',
      blocks: box3(0, 0, 0, 3, 3, 6, P.layer(['p', 'y', 'g', 'r', 'b', 'p']), { map: (ch, i, j, k) => (i === 1 && k === 0 && j % 2 === 1 ? 'o' : ch), sp: { '0,2,0': 'G', '2,4,0': 'B' } }) },
    { name: 'Mina de oro', nb: 6, target: 0.7,
      goal: 'Nivel extra: vetas de oro entre la roca y la TNT.',
      blocks: box3(0, 0, 0, 6, 2, 4, P.checker(['b', 'y']), { map: (ch, i, j) => ((i + j) % 3 === 0 ? 'o' : ch), sp: { '0,0,0': 't', '5,0,0': 't', '2,3,1': 't' } }) },
    { name: 'Tesoro pirata', nb: 6, target: 0.7,
      goal: 'Nivel extra: el barco pirata está lleno de oro.',
      blocks: flat(box3(0, 0, 0, 7, 2, 2, P.col(['r', 'r', 'o', 'o', 'o', 'r', 'r']), { sp: { '3,0,0': '1' } }), box3(0, 0, 2, 3, 2, 2, P.layer(['o', 'g'])), box3(0, 0, 4, 1, 1, 3, P.one('p'))) },
    { name: 'Cámara real', nb: 7, target: 0.7,
      goal: 'Nivel extra final: la cámara del tesoro real.',
      blocks: box3(0, 0, 0, 7, 5, 3, P.rand(['b', 'r', 'y', 'p'], 105), { keep: zig, map: (ch, i, j) => (j === 1 ? 'o' : ch), sp: { '3,0,0': 'B' } }) },
    { name: 'Tumba del faraón', nb: 6, target: 0.7,
      goal: 'Nivel extra: el oro del faraón entre la arena.',
      blocks: box3(0, 0, 0, 5, 3, 4, P.layer(['a', 'y', 'o', 'r']), { map: (ch, i, j) => (j === 2 && i % 2 === 1 ? 'y' : ch) }) },
    { name: 'Cueva de cristal', nb: 6, target: 0.7,
      goal: 'Nivel extra: oro, cristal y bolas congeladas.',
      blocks: box3(0, 0, 0, 5, 3, 4, P.checker(['b', 'p', 'x']), { map: (ch, i, j) => (j === 1 && i % 2 === 1 ? 'o' : ch), sp: { '2,3,0': 'f', '0,0,0': 'f', '4,0,0': 'f' } }) },
    { name: 'Ídolo de oro', nb: 6, target: 0.7,
      goal: 'Nivel extra: el ídolo de oro de la selva.',
      blocks: box3(0, 0, 0, 5, 3, 4, P.layer(['g', 'o', 'y', 'c']), { map: (ch, i, j) => (j === 1 && (i === 0 || i === 4) ? 'g' : ch) }) },
    { name: 'Forja del dragón', nb: 6, target: 0.7,
      goal: 'Nivel extra: el tesoro del dragón, sobre magma.',
      blocks: box3(0, 0, 0, 5, 3, 4, P.layer(['m', 'r', 'o', 'y']), { map: (ch, i, j) => (j === 0 && i % 2 === 1 ? 'y' : ch) }) },
    { name: 'Tesoro galáctico', nb: 7, target: 0.7,
      goal: 'Nivel extra final: oro flotando en el espacio.',
      blocks: flat(box3(0, 0, 0, 5, 3, 2, P.col(['b', 'y', 'p', 'g', 'b'])), flo(box3(0, 0, 3, 5, 3, 2, P.checker(['o', 'y', 'g'])))) },
  ];


  // ===== NIVELES 101-1000: generados (mundos 11-100) =====
  // Cada mundo de 10 niveles usa un paisaje (rotan los 6: mar, desierto, nieve, selva, volcán, espacio) con una variante de luz
  // (día, atardecer, noche, aurora). Las estructuras salen de plantillas probadas (bloques, pirámides, escaleras, torres, puentes,
  // anillos, murallas, templos y, en el espacio, flotantes) con los elementos ya aprendidos y más del bloque propio del paisaje.
  // Todo es determinista: el nivel N es siempre igual. La dificultad sigue la curva: 1 difícil, 4 medios y 5 fáciles por mundo.
  const GEN_BIOMES = ['sea', 'desert', 'snow', 'jungle', 'volcano', 'space'];
  // paisajes nuevos (desde el mundo 52): su contenido se parece al de un paisaje clásico
  const BIOME_LIKE = { candy: 'sea', crystal: 'snow', temple: 'jungle', forest: 'jungle', fair: 'sea', neon: 'space', orchard: 'jungle', reef: 'sea', toys: 'sea', dino: 'volcano' };
  const BIOME_SUB = { sea: 'el mar', desert: 'el desierto', snow: 'la montaña nevada', jungle: 'la selva', volcano: 'el volcán', space: 'el espacio',
    candy: 'la ciudad de caramelo', crystal: 'la cueva de cristales', temple: 'el templo antiguo', forest: 'el bosque encantado', fair: 'la feria', neon: 'la ciudad neón',
    orchard: 'el huerto frutal', reef: 'el arrecife', toys: 'la juguetería', dino: 'la era de los dinosaurios' };
  const WEATHER_NAME = { storm: 'tormenta', sandstorm: 'tormenta de arena', blizzard: 'ventisca', rain: 'lluvia', ash: 'lluvia de ceniza', meteors: 'meteoritos' };
  const VARIANTS = ['día', 'atardecer', 'noche', 'aurora'];
  const WORLD_NAMES = {
    sea: ['Bahía de caramelo', 'Arrecife de colores', 'Puerto viejo', 'Islas gominola', 'Faro del norte', 'Cala escondida', 'Mar de cristal', 'Muelle real', 'Archipiélago', 'Costa brava', 'Laguna azul', 'Atolón', 'Rompeolas', 'Isla del tesoro', 'Mar abierto', 'Acantilados'],
    desert: ['Oasis perdido', 'Cañón rojo', 'Valle de los reyes', 'Mar de dunas', 'Ruta de la seda', 'Templo del sol', 'Espejismo', 'Ciudad de arena', 'Meseta', 'Desierto blanco', 'Caravana real', 'Pirámides', 'Tormenta de arena', 'Sahara', 'Duna gigante', 'Arenas rojas'],
    snow: ['Glaciar', 'Valle nevado', 'Polo norte', 'Cumbres blancas', 'Lago helado', 'Aldea de nieve', 'Ventisca', 'Fiordo', 'Tundra', 'Pico del águila', 'Estación de esquí', 'Cueva de hielo', 'Aurora polar', 'Iceberg', 'Bosque nevado', 'Montaña azul'],
    jungle: ['Río esmeralda', 'Ciudad maya', 'Cascadas', 'Selva profunda', 'Isla de los loros', 'Pantano', 'Manglar', 'Templo de jade', 'Bosque de lianas', 'Valle perdido', 'Selva nublada', 'Pirámide verde', 'Jardín salvaje', 'Raíces antiguas', 'Gran ceiba', 'Amazonía'],
    volcano: ['Río de lava', 'Cráter rojo', 'Fragua antigua', 'Islas de ceniza', 'Montaña de fuego', 'Géiseres', 'Cueva de magma', 'Obsidiana', 'Monte ardiente', 'Llanura de basalto', 'Corazón de fuego', 'Fumarolas', 'Lago de fuego', 'Tierra quemada', 'Volcán dormido', 'Infierno dorado'],
    candy: ['Calle del chicle', 'Plaza del bombón', 'Barrio de galleta', 'Río de chocolate', 'Torre de nata', 'Mercado de gominolas', 'Fuente de sirope', 'Parque del regaliz'],
    crystal: ['Geoda azul', 'Galería de cuarzo', 'Lago subterráneo', 'Cristales rosas', 'Mina de amatista', 'Gruta brillante', 'Estalactitas', 'Corazón de la cueva'],
    temple: ['Escalinata', 'Patio de las columnas', 'Sala del ídolo', 'Puerta del sol', 'Cámara secreta', 'Altar de jade', 'Jardín de piedra', 'Torre del eco'],
    forest: ['Setas gigantes', 'Claro de las hadas', 'Árbol hueco', 'Sendero de luciérnagas', 'Lago de la niebla', 'Bosque de cristal', 'Raíces mágicas', 'Corazón del bosque'],
    fair: ['Noria gigante', 'Tiovivo', 'Casa de los espejos', 'Montaña rusa', 'Tómbola', 'Carpa del circo', 'Coches de choque', 'Gran desfile'],
    neon: ['Avenida neón', 'Rascacielos', 'Barrio de los letreros', 'Puerto espacial', 'Autopista de luz', 'Torre de cristal', 'Metro elevado', 'Ciudad del futuro'],
    orchard: ['Granja feliz', 'Campo de sandías', 'Viña dorada', 'Invernadero', 'Pomar', 'Huerta del abuelo', 'Mercado de fruta', 'Colmenar'],
    reef: ['Jardín de coral', 'Cueva de las morenas', 'Bosque de algas', 'Barco hundido', 'Arrecife azul', 'Fosa profunda', 'Lecho de perlas', 'Ciudad de las medusas'],
    toys: ['Cuarto de juegos', 'Estantería', 'Caja de juguetes', 'Tren de madera', 'Casa de muñecas', 'Alfombra de colores', 'Torre de cubos', 'Desván'],
    dino: ['Valle jurásico', 'Nido de huevos', 'Ciénaga de helechos', 'Cráter humeante', 'Bosque de cícadas', 'Cementerio de fósiles', 'Llanura de ámbar', 'Volcán dormido'],
    space: ['Cinturón de asteroides', 'Luna roja', 'Estación orbital', 'Nebulosa', 'Planeta anillado', 'Cometa', 'Galaxia espiral', 'Polvo de estrellas', 'Marte', 'Satélites', 'Vía Láctea', 'Supernova', 'Agujero de gusano', 'Constelación', 'Órbita lunar', 'Confín del universo'],
  };
  const BIOME_ADJ = {
    sea: ['del puerto', 'de la costa', 'del faro', 'de coral', 'del mar'], desert: ['de arena', 'del faraón', 'del oasis', 'del desierto', 'de las dunas'],
    snow: ['de hielo', 'de nieve', 'del polo', 'del glaciar', 'de escarcha'], jungle: ['de la selva', 'de los mayas', 'de jade', 'de lianas', 'del río'],
    volcano: ['de lava', 'de ceniza', 'de fuego', 'del volcán', 'de magma'], space: ['de la luna', 'de estrellas', 'del cosmos', 'de Marte', 'de la galaxia'],
    candy: ['de caramelo', 'de chocolate', 'de gominola', 'de nata', 'de regaliz'], crystal: ['de cuarzo', 'de cristal', 'de amatista', 'de la geoda', 'de la gruta'],
    temple: ['del templo', 'de jade', 'del ídolo', 'de las ruinas', 'del sol'], forest: ['del bosque', 'de las hadas', 'de setas', 'de la niebla', 'de musgo'],
    fair: ['de la feria', 'del circo', 'de la noria', 'del tiovivo', 'de la tómbola'], neon: ['de neón', 'del futuro', 'de luz', 'del rascacielos', 'de la avenida'],
    orchard: ['del huerto', 'de sandía', 'de la granja', 'de manzanas', 'de la cosecha'], reef: ['de coral', 'del arrecife', 'de las algas', 'de perlas', 'del fondo marino'],
    toys: ['de juguete', 'de madera', 'de los cubos', 'del cuarto de juegos', 'de colores'], dino: ['de ámbar', 'jurásico', 'de los fósiles', 'del dinosaurio', 'prehistórico'],
  };
  const ARCH = {
    block: ['Muro', 'Bloque', 'Almacén', 'Fortín'], pyramid: ['Pirámide', 'Zigurat', 'Montaña', 'Colina'], stairs: ['Escalera', 'Rampa', 'Gradas', 'Ladera'],
    twins: ['Torres gemelas', 'Dos torres', 'Columnas', 'Atalayas'], ring: ['Corona', 'Círculo', 'Carrusel', 'Anillo'], bridge: ['Puente', 'Pasarela', 'Viaducto', 'Acueducto'],
    walls: ['Doble muralla', 'Murallas', 'Barricada', 'Trinchera'], temple: ['Templo', 'Pórtico', 'Santuario', 'Palacio'], floaty: ['Nube', 'Órbita', 'Estación', 'Constelación'],
  };
  const TIPS = {
    sea: ['Busca el color que sostiene la estructura.', 'Las cascadas multiplican los puntos.', 'Los rayados se llevan toda su fila.', 'La TNT explota con un golpe fuerte.'],
    desert: ['La arena se deshace cuando revienta un bloque pegado a ella.', 'Quita la arena de abajo y todo se viene abajo.', 'Cualquier bola deshace la arena.'],
    snow: ['Rompe las bolas congeladas: esa bola pasa a tu bandeja.', 'El hielo necesita dos aciertos.', 'Una bola congelada puede salvarte la partida.'],
    jungle: ['El camaleón cambia de color después de cada tiro.', 'Espera a que el camaleón tenga el color de tu bola.', 'Los camaleones también hacen cascada.'],
    volcano: ['El magma funde su columna cuando revienta algo a su lado.', 'Revienta un bloque junto al magma y mira cómo sube la lava.', 'El magma no se rompe con las bolas.'],
    space: ['Los bloques flotantes no caen aunque les quites el apoyo.', 'Si cae algo encima de un flotante, baja.', 'Aquí también hay bolas congeladas y camaleones.'],
  };
  function genLevel(n, biomeIn, extras, salt) {
    const w = Math.floor((n - 1) / 10) + 1, pos = (n - 1) % 10 + 1, k = w - 11;
    const look = biomeIn || GEN_BIOMES[k % 6], biome = BIOME_LIKE[look] || look, r = seeded(n * 7919 + 17 + (salt || 0)), pick = a => a[Math.floor(r() * a.length)];
    const hardPos = 4 + seeded(w * 31)() * 6 | 0;
    const medPos = [2, 3, 4, 5, 6, 7, 8, 9, 10].filter(p => p !== hardPos).sort((a, b) => seeded(w * 97 + a)() - seeded(w * 97 + b)()).slice(0, 4);
    const tier = pos === hardPos ? 'hard' : medPos.includes(pos) ? 'medium' : 'easy';
    const ramp = Math.min(1, k / 60);                                  // 0 al principio, 1 hacia el nivel 700
    const ncol = Math.min(5, 3 + (r() < 0.4 + ramp * 0.5 ? 1 : 0) + (tier !== 'easy' && r() < 0.35 + ramp * 0.4 ? 1 : 0));
    const cols = ['r', 'b', 'g', 'y', 'p'].sort(() => r() - 0.5).slice(0, ncol);
    const colPat = (seed) => { const q = r(); return q < 0.55 ? P.rand(cols, seed) : q < 0.7 ? P.layer(cols) : q < 0.85 ? P.checker(cols) : P.diag(cols); };
    // elementos especiales: los de siempre y, sobre todo, el del paisaje
    const sig = { sea: ['RBGYP', 'bomb', 'ice', 't', 'x'], desert: ['a', 'a', 'a', 'RBGYP', 's'], snow: ['f', 'ice', 'ice', 'f', 'x'], jungle: ['c', 'c', 'c', 'RBGYP', 'bomb'], volcano: ['m', 'm', 's', 't', 'bomb'], space: ['f', 'c', 'x', 'RBGYP', 'bomb'] }[biome].concat((extras || []).filter(c => CELL_NEW.includes(c)));
    const once = { k: 1, n: 1, h: 1, e: 2, u: 1, v: 1, j: 1, w: 1, d: 2, z: 1, S: 1, C: 1 };   // bloques nuevos: pocos por nivel
    const used = {};
    const pSpec = (tier === 'hard' ? 0.16 : tier === 'medium' ? 0.12 : 0.08) + ramp * 0.04;
    let tnt = 0, prize = 0;
    const spec = (ch, i, j, k2, W, D, H) => {
      if (!'rbgyp'.includes(ch) || r() > pSpec) return ch;
      const s = pick(sig);
      if (s === 'RBGYP') return ch.toUpperCase();
      if (s === 'bomb') return BOMB[ch];
      if (s === 'ice') return ICE[ch];
      if (s === 'm') return j === 0 ? 'm' : ch;
      if (s === 's') return j <= 1 ? 's' : ch;
      if (s === 't') return tnt++ < 1 ? 't' : ch;
      if (s === 'f') return prize++ < 2 ? 'f' : ch;
      if (once[s]) return (used[s] = (used[s] || 0) + 1) <= once[s] ? s : ch;
      return s;
    };
    const opts = (extra) => Object.assign({ map: spec }, extra || {});
    let arch = pick(biome === 'space' ? ['floaty', 'floaty', 'block', 'pyramid', 'twins', 'ring', 'temple'] : ['block', 'pyramid', 'stairs', 'twins', 'ring', 'bridge', 'walls', 'temple']);
    const big = tier === 'hard' ? 1 : tier === 'medium' ? 0.5 : 0;
    const I = (a, b) => a + Math.floor(r() * (b - a + 1));
    let blocks;
    if (arch === 'block') blocks = box3(0, 0, 0, I(3, 5 + big), I(2, 3), I(2, 4 + big), colPat(n), opts());
    else if (arch === 'pyramid') blocks = box3(0, 0, 0, I(5, 7), I(3, 5), 4, colPat(n), opts({ keep: zig }));
    else if (arch === 'stairs') { const W = I(4, 6); blocks = box3(0, 0, 0, W, I(2, 3), W, colPat(n), opts({ keep: stairsUp })); }
    else if (arch === 'twins') { const H = I(4, 6 + big), d = r() < 0.5 ? 1.8 : 2.2; blocks = flat(box3(-d, 0, 0, 2, 2, H, colPat(n), opts()), box3(d, 0, 0, 2, 2, H, colPat(n + 1), opts())); }
    else if (arch === 'ring') { const nr = I(5, 8), rad = nr > 6 ? 3.1 : 2.6, h = I(2, 4); blocks = flat(ring(nr, rad, (x, z, q) => box3(x, z, 0, 1, 1, h, P.layer([cols[q % ncol], cols[(q + 1) % ncol], cols[(q + 2) % ncol]]), opts())), box3(0, 0, 0, 2, 2, I(2, 3), colPat(n), opts())); }
    else if (arch === 'bridge') { const H = I(3, 4); blocks = flat(box3(-2.5, 0, 0, 2, 2, H, colPat(n), opts()), box3(2.5, 0, 0, 2, 2, H, colPat(n + 1), opts()), [plank(0, H, 0, 7, 2, pick(cols))], box3(0, 0, H + 0.4, I(3, 5), 2, I(1, 2), colPat(n + 2), opts())); }
    else if (arch === 'walls') blocks = flat(box3(0, 1.4, 0, I(4, 6), 1, I(2, 3), colPat(n), opts()), box3(0, -1.4, 0, I(4, 6), 1, I(3, 5), colPat(n + 1), opts()));
    else if (arch === 'temple') { const xs = r() < 0.5 ? [-3, -1, 1, 3] : [-2.5, 0, 2.5], ph = I(2, 3), ww = xs.length === 4 ? 7.4 : 6.4;
      blocks = flat(...xs.map((x, q) => flat(box3(x, 1, 0, 1, 1, ph, P.one(biome === 'desert' ? 'a' : cols[q % ncol]), opts()), box3(x, -1, 0, 1, 1, ph, P.one(biome === 'desert' ? 'a' : cols[(q + 1) % ncol]), opts()))),
        [plank(0, ph, 0, ww, 3, pick(cols))], box3(0, 0, ph + 0.4, I(3, 5), 2, I(1, 3), colPat(n), opts())); }
    else {      // flotantes (espacio)
      const W = I(3, 5), D = I(2, 3);
      blocks = flat(box3(0, 0, 0, W, D, I(1, 2), colPat(n), opts()), flo(box3(0, 0, 3, W, D, I(1, 2), colPat(n + 1), opts())));
      if (r() < 0.5) blocks = blocks.concat(flo(lift(ring(6, 3, (x, z, q) => box3(x, z, 0, 1, 1, 1, P.one(cols[q % ncol]))), 5.5)));
    }
    // en el espacio, a veces parte de la estructura flota
    if (biome === 'space' && arch !== 'floaty' && r() < 0.6) { const top = Math.max(...blocks.map(b => b.y)); blocks = blocks.concat(flo(box3(0, 0, top + 1.6, 3, 1, 1, P.rand(cols, n + 9)))); }
    // que nunca falten colores para las bolas
    if (!blocks.some(b => b.c && !b.t)) blocks.push({ x: 0, y: 0.5, z: 2.5, w: 1, h: 1, d: 1, c: cols[0] });
    const nb = Math.round(ncol * 0.9 + blocks.length / 12 + (tier === 'easy' ? 2 : tier === 'medium' ? 0.5 : -0.5) - ramp * 0.6);
    const target = +(tier === 'easy' ? 0.7 : tier === 'medium' ? 0.78 : 0.85) + ramp * 0.04;
    // los que no son una celda (portal, tótem, burbuja, candado, nube, liana, ventilador): como mucho uno por nivel
    const post = (extras || []).filter(c => !CELL_NEW.includes(c));
    const pre = { blocks };
    if (post.length && r() < 0.45) inject(pre, post[Math.floor(r() * post.length)], 2, r);
    blocks = pre.blocks;
    return { name: pick(ARCH[arch]) + ' ' + pick(BIOME_ADJ[look] || BIOME_ADJ[biome]), nb: Math.max(3, Math.min(14, nb)), target: Math.min(0.92, +target.toFixed(2)), gen: true, gid: n, tier, biome: look,
      goal: pick(TIPS[biome]), blocks };
  }
  function genBonus(w, look, cb) {
    const biome = BIOME_LIKE[cb || look] || cb || look, r = seeded(w * 4441), cols = ['r', 'b', 'g', 'y', 'p'].sort(() => r() - 0.5).slice(0, 3);
    const W = 4 + (r() * 2 | 0), D = 3, H = 3 + (r() * 2 | 0);
    let blocks = box3(0, 0, 0, W, D, H, P.rand(cols, w), { map: (ch, i, j) => ((i + j * 2) % 4 === 1 ? 'o' : ch) });
    if (biome === 'space') blocks = flat(box3(0, 0, 0, W, D, 2, P.rand(cols, w)), flo(box3(0, 0, 3, W, D, 2, P.checker(['o', cols[0], cols[1]]))));
    return { name: 'Tesoro ' + (BIOME_ADJ[look] || BIOME_ADJ[biome])[w % 5], sn: 'Tesoro ' + (BIOME_ADJ[cb || look] || BIOME_ADJ[biome])[w % 5], nb: 6, target: 0.75, gen: true, biome: look, goal: 'Nivel extra: los bloques de oro sueltan monedas.', blocks };
  }

  // bolas automáticas: reparto equilibrado según cuántos bloques hay de cada color
  // (cada color presente recibe al menos una bola si caben, y nunca salen tres seguidas del mismo)
  function autoBalls(l, n) {
    const cnt = {};
    for (const b of l.blocks) if (b.c) cnt[b.c] = (cnt[b.c] || 0) + 1;
    let cols = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a] || (a < b ? -1 : 1));
    if (!cols.length || n <= 0) return '';
    if (cols.length > n) cols = cols.slice(0, n);
    const total = cols.reduce((s, c) => s + cnt[c], 0);
    const want = {}; let given = 0;
    for (const c of cols) { want[c] = Math.max(1, Math.floor(n * cnt[c] / total)); given += want[c]; }
    const rem = cols.slice().sort((a, b) => (n * cnt[b] / total % 1) - (n * cnt[a] / total % 1));
    for (let i = 0; given < n; i++) { want[rem[i % rem.length]]++; given++; }
    for (let i = 0; given > n; i++) { const c = cols[i % cols.length]; if (want[c] > 1) { want[c]--; given--; } }
    const r = seeded((l.sn || l.name).length * 131 + n * 7);
    let s = '', last = '', last2 = '';
    for (let i = 0; i < n; i++) {
      const opts = cols.filter(c => want[c] > 0);
      let pool = opts.filter(c => c !== last);
      if (!pool.length) pool = opts;
      const top = Math.max(...pool.map(c => want[c]));
      const best = pool.filter(c => want[c] >= top - 1 && !(c === last && c === last2));
      const pick = (best.length ? best : pool)[Math.floor(r() * (best.length ? best : pool).length)];
      want[pick]--; s += pick; last2 = last; last = pick;
    }
    return s;
  }
  // posición del cañón según el tamaño de la estructura (independiente del móvil: referencia 9:19,5)
  function placeCannon(l) {
    let mx = 1, my = 3;
    for (const b of l.blocks) { mx = Math.max(mx, Math.abs(b.x) + b.w / 2); my = Math.max(my, b.y + b.h / 2); }
    if (l.viewTop) my = Math.max(my, l.viewTop);
    const tanV = Math.tan(28 * Math.PI / 180), tanH = tanV * 0.46;
    const dist = Math.max((mx + 1.0) / tanH, (my + (my > 6 ? 4 : 2.5)) / (2 * tanV));
    l.cannon = { x: 0, y: 1.2, z: Math.max(6.5, Math.min(14.5, dist - 3.6)) };
  }
  const TUNE = root.LevelTuning || (typeof require !== 'undefined' ? (() => { try { return require('./tuning.js'); } catch (e) { return {}; } })() : {});
  // afinado de los niveles generados: { id: [bolas, objetivo] } (tools/gentune.js)
  const GTUNE = root.GenTuning || (typeof require !== 'undefined' ? (() => { try { return require('./gentune.js'); } catch (e) { return {}; } })() : {});
  // reparto equilibrado: recorre todos los colores de la estructura sin repetir seguidos
  function balancedBalls(l, n) {
    const cnt = {};
    for (const b of l.blocks) if (b.c) cnt[b.c] = (cnt[b.c] || 0) + 1;
    const cols = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a] || a.localeCompare(b));
    n = Math.ceil(n / cols.length) * cols.length;   // el mismo número de bolas de cada color
    let s = '';
    for (let i = 0; i < n; i++) s += cols[i % cols.length];
    return s;
  }
  function finalize(l) {
    // bolas congeladas y camaleones: toman colores del propio nivel
    if (!l._colored) {
      l._colored = true;
      const cols = [...new Set(l.blocks.filter(b => b.c && !b.t || b.t === 'st' || b.t === 'bm' || b.t === 'i').map(b => b.c))];
      const r = seeded((l.sn || l.name).length * 977 + 3);   // sn: nombre de antes (paisajes cambiados desde el 52)
      let q = Math.floor(r() * 5);
      for (const b of l.blocks) if ((b.t === 'prize' || b.t === 'cham' || b.t === 'lock' || b.t === 'totem' || b.t === 'vine') && !b.c) b.c = (cols.length ? cols : ['r', 'b'])[q++ % (cols.length || 2)];
    }
    if (l.balls0 === undefined) l.balls0 = l.balls || '';
    const t = l.gen ? (GTUNE[l.gid] && { nb: GTUNE[l.gid][0], target: GTUNE[l.gid][1] }) : TUNE[l.sn || l.name];
    if (t) { if (t.nb) l.nb = t.nb; if (t.target) l.target = t.target; }
    if (l.nb && (!l.balls || l.balls.length !== l.nb)) {
      const base = l.balls0 || '';
      l.balls = l.nb <= base.length ? base.slice(0, l.nb) : base + autoBalls(l, l.nb - base.length);
    }
    l.nb = l.balls.length;
    placeCannon(l);
  }
  // Curva de dificultad (oculta para el jugador): ver tools/tune.js para las franjas de victorias de cada tipo
  const HARD = [7, 16, 24, 38, 45, 57, 65, 78, 86, 99];
  const MEDIUM = [4, 6, 9, 12, 14, 18, 20, 22, 26, 28, 30, 32, 34, 36, 40, 42, 44, 47, 50,
    53, 55, 59, 60, 62, 64, 67, 69, 72, 74, 76, 80, 82, 84, 88, 90, 92, 94, 96, 100];
  // paisaje de cada mundo: los 5 primeros en la isla del mar; después, uno distinto por mundo
  // =====================================================================================================
  // ORDEN DE LOS MUNDOS
  // · Mundos 1-3 cortos (5, 6 y 8 niveles) y el resto de 10, para que el primer cambio de paisaje llegue pronto.
  // · Cada paisaje dura 3 mundos y cada mundo tiene su luz: día, atardecer y anochecer.
  // · Mundos 1-51: los 6 paisajes clásicos (desde el 19 vuelven con clima). Desde el 52 se intercalan los 6 nuevos.
  // · El último nivel de cada 3.er mundo (y del 100) es un jefe.
  // · La dificultad de cada nivel (fácil, medio, difícil) no cambia: viaja con su nivel.
  // =====================================================================================================
  const HAND = LEVELS.splice(0);                    // los 100 niveles hechos a mano, en su orden original
  HAND.forEach((l, i) => { l.oid = i + 1; l.tier = HARD.includes(i + 1) ? 'hard' : MEDIUM.includes(i + 1) ? 'medium' : 'easy'; });
  const HAND_BONUS = BONUS.splice(0);
  const NWORLDS = 100;
  const CLASSIC = ['sea', 'desert', 'snow', 'jungle', 'volcano', 'space'];
  const FRESH = ['candy', 'crystal', 'temple', 'forest', 'fair', 'neon', 'orchard', 'reef', 'toys', 'dino'];
  // Desde el mundo 52 (grupos 17-33) el orden va escrito a mano. Los 4 paisajes nuevos (huerto, arrecife, juguetería y
  // dinosaurios) ocupan huecos de paisajes repetidos; cada mundo conserva el contenido de antes (estructura, dificultad y
  // ajuste: `cb`, el paisaje de antes) y su clima, y solo cambia lo que se ve. Los dinosaurios ocupan una vuelta del volcán
  // y se quedan su lluvia de ceniza.
  const OLD_LATE = ['candy', 'sea', 'crystal', 'desert', 'temple', 'snow', 'forest', 'jungle', 'fair', 'volcano', 'neon', 'space', 'candy', 'sea', 'crystal', 'desert', 'temple'];
  const LATE = ['candy', 'sea', 'orchard', 'desert', 'crystal', 'snow', 'reef', 'jungle', 'temple', 'dino', 'toys', 'space', 'forest', 'sea', 'fair', 'desert', 'neon'];
  const WEATHER = { sea: 'storm', desert: 'sandstorm', snow: 'blizzard', jungle: 'rain', volcano: 'ash', space: 'meteors' };
  const LIGHTS = ['día', 'atardecer', 'noche'];
  const WSIZE = w => (w === 1 ? 5 : w === 2 ? 6 : w === 3 ? 8 : 10);
  const isBossWorld = w => w % 3 === 0 || w === NWORLDS;
  function worldInfo(w) {
    const g = Math.floor((w - 1) / 3), light = LIGHTS[(w - 1) % 3];
    let biome, weather = null;
    if (g < 17) { biome = CLASSIC[g % 6]; if (g >= 6) weather = WEATHER[biome]; }
    else { const cb = OLD_LATE[g - 17]; biome = LATE[g - 17]; weather = WEATHER[cb] || null; return { g, biome, cb, light, weather, boss: ['ship', 'pyramid', 'golem'][g % 3] }; }
    return { g, biome, cb: biome, light, weather, boss: ['ship', 'pyramid', 'golem'][g % 3] };
  }

  // ---- niveles de estreno de los bloques nuevos (siempre fáciles) ----
  const DEBUT = {
    k: { name: 'Despegue', world: 1, pos: 4, title: 'Cohete', what: 'Sale disparado y se lleva toda su fila.', tip: 'Toca el cohete para lanzarlo.',
      balls: 'gbr', blocks: grid(0, 0, 0, [['rrbbgg', 'rrbbgg'], ['krrbbg', 'grrbbg'], ['ggrrbb', 'ggrrbb'], ['bbggrr', 'bbggrr']]) },
    n: { name: 'La fiesta', world: 3, pos: 4, title: 'Piñata', what: 'Con 2 golpes revienta y suelta monedas.', tip: 'Dale dos veces a la piñata.',
      balls: 'ybrgy', blocks: flat(grid(0, 0, 0, [['yybbyy', 'yybbyy'], ['rrggrr', 'rrggrr'], ['bbyybb', 'bbyybb']]), grid(0, 0.5, 3, [['n']])) },
    h: { name: 'Arena del tiempo', world: 4, pos: 2, title: 'Reloj de arena', what: 'Al romperlo te da una bola más.', tip: 'Rompe el reloj: ¡una bola extra!',
      balls: 'by', blocks: flat(grid(0, 0, 0, [['bbaayy', 'bbaayy'], ['yyaabb', 'yyaabb'], ['bbyybb', 'bbyybb']]), grid(0, 1.5, 0, [['h']])) },
    e: { name: 'Sala de espejos', world: 8, pos: 4, title: 'Espejo', what: 'No se rompe: hace rebotar la bola.', tip: 'Dispara a un espejo: la bola rebota hacia la torre escondida.',
      balls: 'bpbp', blocks: flat(grid(0, 1.6, 0, [['sss'], ['sss'], ['sss']]), grid(0, -0.5, 0, [['bpb', 'pbp'], ['pbp', 'bpb'], ['bpb', 'pbp']]),
        [{ x: -3.4, y: 1.1, z: -0.5, w: 1.4, h: 2.2, d: 0.25, t: 'mirror', ry: Math.PI / 4, fixed: true }, { x: 3.4, y: 1.1, z: -0.5, w: 1.4, h: 2.2, d: 0.25, t: 'mirror', ry: -Math.PI / 4, fixed: true }]) },
    u: { name: 'Trampolín', world: 10, pos: 2, title: 'Muelle', what: 'El primer golpe lanza por los aires lo que tiene encima; el segundo lo revienta.', tip: 'Para las 3 estrellas hay que reventar también el muelle.',
      balls: 'grg', blocks: flat(grid(0, 0, 0, [['guuug', 'guuug']]), grid(0, 0, 1, [['rrgrr', 'rrgrr'], ['ggrgg', 'ggrgg'], ['rrgrr', 'rrgrr']])) },
    v: { name: 'Fumarola', world: 14, pos: 4, title: 'Géiser', what: 'Lanza un chorro que rompe toda su columna.', tip: 'Dale al géiser y espera el chorro.',
      balls: 'ryry', blocks: grid(0, 0, 0, [['yrvry', 'yrsry'], ['ryrry', 'ryryr'], ['yrryr', 'yrryr'], ['ryyry', 'ryyry'], ['yrryr', 'yrryr']]) },
    q: { name: 'Agujero de gusano', world: 17, pos: 4, title: 'Portal', what: 'La bola entra por uno y sale por el otro.', tip: 'Dispara al portal de la izquierda.',
      balls: 'bgbgb', blocks: flat(grid(0, 0, 0, [['sssss'], ['sssss'], ['sssss']]), grid(0, -1.5, 0, [['bgbgb', 'gbgbg'], ['gbgbg', 'bgbgb'], ['bgbgb', 'gbgbg'], ['gbgbg', 'bgbgb']])).concat(portalPair(4, () => 0.2, -1.5)) },
  };
  Object.assign(DEBUT, {
    j: { name: 'La caja sorpresa', world: 52, pos: 4, title: 'Caja sorpresa', what: 'Al romperla te da un potenciador al azar.', tip: 'Rompe la caja: ¡a ver qué sale!',
      balls: 'ry', blocks: grid(0, 0, 0, [['rrbbyy', 'rrbbyy'], ['yyjbrr', 'yybbrr'], ['bbrryy', 'bbrryy']]) },
    B: { name: 'Pompas', world: 55, pos: 4, title: 'Burbuja', what: 'El bloque flota dentro hasta que revientas la pompa.', tip: 'Revienta una pompa y el bloque caerá.',
      balls: 'brbr', blocks: flat(grid(0, 0, 0, [['bbrrbb', 'bbrrbb'], ['rrbbrr', 'rrbbrr']]), [{ x: -2, y: 3.8, z: 0.5, w: 1, h: 1, d: 1, c: 'r', bub: true }, { x: 0, y: 4.2, z: 0.5, w: 1, h: 1, d: 1, c: 'b', bub: true }, { x: 2, y: 3.8, z: 0.5, w: 1, h: 1, d: 1, c: 'r', bub: true }]) },
    w: { name: 'Prisma', world: 58, pos: 4, title: 'Cubo arcoíris', what: 'Revienta todos los bloques del color de tu bola.', tip: 'Dispara al cubo arcoíris con un color.',
      balls: 'rgb', blocks: grid(0, 0, 0, [['rgbrgb', 'gbrgbr'], ['brgbrg', 'rgbrgb'], ['gbwgbr', 'brgbrg']]) },
    F: { name: 'Vendaval', world: 61, pos: 4, title: 'Ventilador', what: 'Sopla con fuerza hacia la estructura.', tip: 'Dale al ventilador y mira cómo vuela todo.',
      balls: 'yry', blocks: flat(grid(0.5, 0, 0, [['yyrr', 'yyrr'], ['rryy', 'rryy'], ['yyrr', 'yyrr'], ['rryy', 'rryy']]), [{ x: -3.6, y: 0.5, z: 0, w: 1, h: 1, d: 1, t: 'fan', dir: 1 }]) },
    l: { name: 'La llave', world: 64, pos: 4, title: 'Candado', what: 'No se rompe hasta que rompes su llave.', tip: 'Busca la llave y rómpela.',
      balls: 'yrby', blocks: flat(grid(0, 0, 0, [['yyrrbb', 'yyrrbb'], ['bbyyrr', 'bbyyrr']]).map(b => Object.assign(b, { t: 'lock' })), grid(0, 0.5, 2, [['i']])) },
    S: { name: 'Bola de nieve', world: 67, pos: 4, title: 'Bola de nieve', what: 'Rueda y arrasa lo que encuentra.', tip: 'Dale a la bola de nieve.',
      balls: 'bp', blocks: flat(grid(-3.6, 0, 0, [['s'], ['S']]), grid(0.6, 0, 0, [['bbppb', 'bbppb'], ['ppbbp', 'ppbbp'], ['bbppb', 'bbppb']])) },
    N: { name: 'Niebla', world: 70, pos: 4, title: 'Nube', what: 'Tapa el color de lo que hay detrás hasta que la atraviesas.', tip: 'Dispara a la nube para despejarla.',
      balls: 'rgrg', blocks: flat(grid(0, 0, 0, [['rgrg', 'grgr'], ['grgr', 'rgrg'], ['rgrg', 'grgr']]), [{ x: 0, y: 1.6, z: 2.0, w: 4.4, h: 3.4, d: 0.3, t: 'cloud' }]) },
    V: { name: 'Lianas', world: 73, pos: 4, title: 'Liana', what: 'Cuelga a un lado: si la golpeas, se balancea y arrasa la torre.', tip: 'Golpea la liana con otro color: sale disparada contra la torre.',
      balls: 'ygyg', blocks: flat(grid(0, 0, 0, [['yggy', 'yggy'], ['gyyg', 'gyyg'], ['yggy', 'yggy'], ['gyyg', 'gyyg']]),
        [{ x: -3.3, y: 2.8, z: 0, w: 1, h: 1, d: 1, t: 'vine', c: 'y', ax: -3.3, ay: 7.5 }, { x: 3.3, y: 2.8, z: 0, w: 1, h: 1, d: 1, t: 'vine', c: 'g', ax: 3.3, ay: 7.5 }]) },
    d: { name: 'Globos', world: 76, pos: 4, title: 'Globo', what: 'Sube si no tiene nada encima. Si lo revientas, lo de arriba se cae.', tip: 'Revienta los globos o libéralos.',
      balls: 'brb', blocks: grid(0, 0, 0, [['rrbbrr', 'rrbbrr'], ['dddddd', 'dddddd'], ['bbrrbb', 'bbrrbb']]) },
    z: { name: 'Imán', world: 82, pos: 4, title: 'Imán', what: 'Al golpearlo atrae todo lo que tiene cerca.', tip: 'Dale al imán del centro.',
      balls: 'rb', blocks: grid(0, 0, 0, [['rbzbr', 'brbrb'], ['brbrb', 'rbrbr'], ['rbrbr', 'brbrb']]) },
    T: { name: 'Monolito', world: 85, pos: 4, title: 'Tótem', what: 'Revienta con su color; si fallas, cambia de color.', tip: 'Acierta el color de cada tótem.',
      balls: 'bybyb', blocks: flat(grid(0, 1.5, 0, [['T.T.T']]), grid(0, -0.5, 0, [['bybyb', 'ybyby'], ['ybyby', 'bybyb'], ['bybyb', 'ybyby']])) },
    C: { name: 'Chicle', world: 88, pos: 4, title: 'Chicle', what: 'La bola se queda pegada: con otro toque eliges hacia dónde sale.', tip: 'Dispara al chicle y luego toca dónde quieres que vaya.',
      balls: 'pyp', blocks: flat(grid(0, 2.6, 0, [['s'], ['s'], ['C']]), grid(0, 1.6, 0, [['sss'], ['sss']]), grid(0, -0.5, 0, [['pypyp', 'ypypy'], ['ypypy', 'pypyp']])) },
  });
  const DEBUT_ORDER = ['k', 'n', 'h', 'e', 'u', 'v', 'q', 'j', 'B', 'w', 'F', 'l', 'S', 'N', 'V', 'd', 'z', 'T', 'C'];
  const POSITIVE = { k: 1, n: 1, h: 1, u: 1, v: 1, j: 1, w: 1, F: 1, S: 1, z: 1, d: 1 };     // los que ayudan: en todos los paisajes desde su estreno
  const OBSTACLE_HOME = { e: ['snow', 'crystal', 'neon', 'space'], q: ['space', 'neon', 'crystal', 'temple'], l: ['temple', 'desert', 'crystal'], N: ['forest', 'jungle', 'candy'], T: ['temple', 'space', 'fair'], B: ['sea', 'candy', 'fair'], V: ['jungle', 'forest', 'temple'], C: ['candy', 'fair', 'neon'] };
  const SPECIAL_T = { k: 'rocket', n: 'pinata', h: 'hourglass', e: 'mirror', u: 'spring', v: 'geyser', j: 'gift', w: 'prism', d: 'balloon', z: 'magnet', S: 'snowball', C: 'gum' };
  // portales: uno a la izquierda, a mano, y su pareja encima de la estructura (la bola sale hacia abajo)
  function portalPair(top, r, zc) {
    const side = r() < 0.5 ? -1 : 1;
    return [{ x: side * 3.6, y: 2.4, z: 1.6, w: 1.3, h: 1.3, d: 0.3, t: 'portal', pairA: true }, { x: 0, y: top + 1.6, z: zc || 0, w: 1.3, h: 1.3, d: 0.3, t: 'portal', pairB: true }];
  }
  const midZ = bl => { const c = bl.filter(b => b.c); return c.length ? c.reduce((s, b) => s + b.z, 0) / c.length : 0; };
  // pone bloques nuevos en un nivel ya hecho (práctica, combinación y remezcla): en la cara de delante y sin tocar la base
  function inject(l, ch, count, rr) {
    const r = rr || seeded(l.blocks.length * 31 + ch.charCodeAt(0));
    const top = Math.max(...l.blocks.map(b => b.y + b.h / 2)), zc = midZ(l.blocks);
    if (ch === 'q') { if (!l.blocks.some(b => b.t === 'portal')) l.blocks.push(...portalPair(top, r, zc)); return; }
    if (ch === 'N') { if (!l.blocks.some(b => b.t === 'cloud')) { const fz = Math.max(...l.blocks.map(b => b.z + b.d / 2)); l.blocks.push({ x: 0, y: Math.min(top, 4) / 2 + 0.3, z: fz + 0.6, w: 3.2, h: Math.min(top, 4) * 0.8, d: 0.3, t: 'cloud' }); } return; }
    if (ch === 'V') { const sd = r() < 0.5 ? -1 : 1, y = Math.max(1.5, top * 0.5); const vx = Math.min(4.2, Math.max(...l.blocks.map(b => Math.abs(b.x) + b.w / 2)) + 1.3); l.blocks.push({ x: sd * vx, y, z: zc, w: 1, h: 1, d: 1, t: 'vine', ax: sd * vx, ay: y + 4 }); return; }
    if (ch === 'F') { const sd = r() < 0.5 ? -1 : 1; if (!l.blocks.some(b => Math.abs(b.x - sd * 4.4) < 1 && b.y < 1)) l.blocks.push({ x: sd * 4.4, y: 0.5, z: zc, w: 1, h: 1, d: 1, t: 'fan', dir: -sd }); return; }
    const plain = l.blocks.filter(b => b.c && !b.t && b.w === 1 && b.y > 0.6);
    if (!plain.length) return;
    const maxZ = Math.max(...plain.map(b => b.z));
    let front = plain.filter(b => b.z >= maxZ - 0.01).sort((a, b) => a.y - b.y || a.x - b.x);
    if (ch === 'd') front = front.filter(b => l.blocks.some(o => o !== b && Math.abs(o.x - b.x) < 0.5 && Math.abs(o.z - b.z) < 0.5 && o.y > b.y + 0.5));   // el globo, siempre con algo encima
    if (ch === 'B') front = plain.filter(b => b.y > top - 1.2);
    if (!front.length) return;
    const step = Math.max(1, Math.floor(front.length / (count + 1)));
    const picked = [];
    for (let i = 0; i < count && (i + 1) * step - 1 < front.length; i++) picked.push(front[(i + 1) * step - 1]);
    for (const b of picked) {
      if (ch === 'T') b.t = 'totem';
      else if (ch === 'B') b.bub = true;
      else if (ch === 'l') b.t = 'lock';
      else { b.t = SPECIAL_T[ch]; delete b.c; }
    }
    // los candados siempre traen su llave, arriba y delante
    if (ch === 'l' && picked.length && !l.blocks.some(b => b.t === 'key')) l.blocks.push({ x: 0, y: top + 0.5, z: maxZ, w: 1, h: 1, d: 1, t: 'key' });
    l.blocks = l.blocks.slice();
  }
  const CELL_NEW = ['k', 'n', 'h', 'e', 'u', 'v', 'j', 'w', 'z', 'S', 'C', 'd'];

  // ---- jefes: tres tipos que rotan por paisaje; el nombre y el aspecto cambian con el paisaje ----
  const BOSS_NAMES = {
    ship: { sea: 'Capitán Bloquebarba', jungle: 'Barcaza del río', candy: 'Galeón de caramelo', forest: 'Barca encantada', fair: 'Barco de feria', neon: 'Crucero de neón', crystal: 'Galeón de cristal', toys: 'Barco de juguete', reef: 'Galeón hundido' },
    pyramid: { desert: 'Faraón Arenas', volcano: 'Fortaleza de obsidiana', crystal: 'Geoda gigante', temple: 'Zigurat perdido', sea: 'Pirámide hundida', snow: 'Pirámide de hielo', orchard: 'Pirámide del huerto', fair: 'Pirámide de la feria', dino: 'Faraón de ámbar', toys: 'Torre de cubos' },
    golem: { snow: 'Gólem de hielo', space: 'Robot lunar', volcano: 'Gólem de magma', temple: 'Guardián del templo', neon: 'Mecha de neón', candy: 'Gólem de gominola', reef: 'Gólem de coral', dino: 'Gólem de ámbar', forest: 'Gólem de musgo', orchard: 'Gólem de fruta' },
  };
  const BOSS_DEFAULT = { ship: 'Galeón pirata', pyramid: 'Pirámide del faraón', golem: 'Gólem de roca' };
  // recolorea los bloques de color para que ningún grupo (contando los que se tocan por una esquina) pase de maxG; determinista
  function limitGroups(blocks, maxG, seed) {
    const PAL = ['r', 'y', 'b', 'g', 'p'], cells = blocks.filter(b => b.c && !b.t && PAL.includes(b.c));
    for (const a of cells) a._nb = cells.filter(o => o !== a && Math.abs(o.x - a.x) < 1.05 && Math.abs(o.y - a.y) < 1.05 && Math.abs(o.z - a.z) < 1.05);
    const excess = () => {
      const seen = new Set(); let e = 0;
      for (const st0 of cells) {
        if (seen.has(st0)) continue;
        const st = [st0]; seen.add(st0); let n = 0;
        while (st.length) { const a = st.pop(); n++; for (const o of a._nb) if (!seen.has(o) && o.c === st0.c) { seen.add(o); st.push(o); } }
        e += Math.max(0, n - maxG);
      }
      return e;
    };
    const rr = seeded(seed);
    let cur = excess();
    for (let it = 0; it < 3000 && cur > 0; it++) {
      const cl = cells[Math.floor(rr() * cells.length)], old = cl.c;
      let best = old, be = cur;
      for (const c of PAL) { if (c === old) continue; cl.c = c; const e = excess(); if (e < be || (e === be && rr() < 0.3)) { be = e; best = c; } }
      cl.c = best; cur = be;
    }
    for (const a of cells) delete a._nb;
    return blocks;
  }
  function bossLevel(kind, biome, g) {
    const name = (BOSS_NAMES[kind] && BOSS_NAMES[kind][biome]) || BOSS_DEFAULT[kind];
    const extra = Math.max(0, 2 - Math.floor(g / 6));               // los primeros jefes dan un par de bolas más
    let l;
    if (kind === 'ship') l = {
      statics: [{ x: 0, y: 0, z: 0, w: 7.4, h: 1.4, d: 3 }],
      balls: 'rgypbrgBypbgrygp' + 'rg'.slice(0, extra),
      // casco de colores, castillos de proa y popa, cabina y mástil: casi 100 bloques que se pueden reventar
      blocks: grid(0, 0, 1.4, [['rrs.sgg', 'rr.o.gg', 'rrpppgg'], ['rr...gg', 'rr...gg', 'rrpppgg'], ['yy...yy', 'yy...yy', 'yypppyy'], ['gg...rr', 'gg...rr', 'ggbbbrr'],
        ['yy...pp', 'yy...pp', 'yybbbpp'], ['pp...yy', 'pp...yy', 'ppbbbyy'], ['...', '...', 'rrr'], ['.', '.', 'g'], ['.', '.', 'g']]) };
    else if (kind === 'pyramid') {
      // pirámide de colores mezclados (el escudo del faraón va cambiando de color) con un núcleo de piedra;
      // como mucho 3 bloques del mismo color juntos (contando los que se tocan por una esquina), para que un tiro no abra el escudo.
      // La máscara dorada del faraón flota encima (la dibuja bosses.js)
      const blocks = [], HW = [3, 3, 2, 2, 1, 1, 0], HD = [1, 1, 1, 1, 0, 0, 0], PAL = ['r', 'y', 'b', 'g', 'p'];   // 3 de fondo: menos piezas tocándose = física más ligera
      const back = 'a', cells = [];
      for (let j = 0; j < HW.length; j++) {
        const hw = HW[j], hd = HD[j];
        for (let x = -hw; x <= hw; x++) for (let z = -hd; z <= hd; z++) {
          let ch = null;
          if (x === 0 && z === 0 && (j === 1 || j === 2)) ch = 's';                       // núcleo de piedra
          else if (z === -hd && hd > 0) ch = back;                                          // espalda de arena
          cells.push({ x, j, z, ch });
        }
      }
      const near = (a, b) => a !== b && Math.abs(a.x - b.x) <= 1 && Math.abs(a.j - b.j) <= 1 && Math.abs(a.z - b.z) <= 1;
      for (const cl of cells) cl.nb = cells.filter(o => near(cl, o));
      const free = cells.filter(cl => !cl.ch);
      // exceso total: lo que pasan de 3 todos los grupos de un color
      const excess = () => {
        const seen = new Set(); let e = 0;
        for (const st0 of free) {
          if (seen.has(st0)) continue;
          const st = [st0]; seen.add(st0); let n = 0;
          while (st.length) { const a = st.pop(); n++; for (const o of a.nb) if (!seen.has(o) && o.ch === st0.ch) { seen.add(o); st.push(o); } }
          e += Math.max(0, n - 3);
        }
        return e;
      };
      const rr = seeded(7700 + g);
      free.forEach((cl, i) => { cl.ch = PAL[(i * 2 + g) % PAL.length]; });
      let cur = excess();
      for (let it = 0; it < 3000 && cur > 0; it++) {           // búsqueda local: cambia el color de una celda si mejora (o empata, para no atascarse)
        const cl = free[Math.floor(rr() * free.length)], old = cl.ch;
        let best = old, be = cur;
        for (const c of PAL) { if (c === old) continue; cl.ch = c; const e = excess(); if (e < be || (e === be && rr() < 0.3)) { be = e; best = c; } }
        cl.ch = best; cur = be;
      }
      for (const cl of cells) blocks.push(...grid(cl.x, cl.z, cl.j, [[cl.ch]]));
      l = { blocks, viewTop: 10.2, balls: 'rybgprybgprybgpr' + 'yb'.slice(0, extra) };
    } else l = {
      statics: [{ x: 0, y: 0, z: 0, w: 6, h: 0.4, d: 3 }, { x: 0, y: 0.4, z: 0, w: 0.96, h: 2, d: 1.9 }],
      balls: 'byrpHbyrBpby' + 'by'.slice(0, extra),
      // piernas de piedra (lo sostienen); rodillas, cadera, pecho, hombros y cabeza de colores, con los 3 núcleos de lava
      blocks: grid(0, 0, 0.4, [['ss.ss', 'ss.ss'], ['rr.gg', 'ss.ss'], ['gyyyr', 'sbbbs'], ['ybbby', 'psosp'], ['ybbby', 'prrrp'], ['rgggr', 'yyyyy'], ['.oso.', '.ppp.'], ['.ppp.', '.bbb.']]) };
    // en los mundos altos el barco se repite con los colores más mezclados (grupos más pequeños): cuesta más derribarlo
    // (en el primero, grupos de hasta 6, para que no caiga en 4 tiros con una cascada)
    // dificultad según el orden entre los jefes de su mismo tipo: 0 el primero, 1 el último
    const order = [];
    for (let w = 1; w <= NWORLDS; w++) if (isBossWorld(w) && worldInfo(w).boss === kind) order.push(worldInfo(w).g);
    const d = order.length > 1 ? Math.max(0, order.indexOf(g)) / (order.length - 1) : 0;
    if (kind === 'ship') limitGroups(l.blocks, Math.max(3, Math.round(6 - 3 * d)), 900 + g);
    if (kind === 'golem') {           // del primero al último: colores más mezclados y alguna placa de piedra más (por detrás)
      limitGroups(l.blocks, Math.max(3, Math.round(5 - 2 * d)), 700 + g);
      const back = l.blocks.filter(b => b.c && !b.t && b.z < 0 && b.y > 1.5).sort((a, b) => a.y - b.y || a.x - b.x);
      for (const b of back.slice(0, Math.round(6 * d))) { b.t = 's'; delete b.c; }
    }
    if (kind === 'ship' && d > 0) l.balls += 'rgybprgy'.slice(0, Math.round(2 + 6 * d));   // y unas bolas más para compensar (el cañón dispara más a menudo)
    return Object.assign(l, { name, boss: kind, bossName: name, bossD: d, target: 1.5, tier: 'boss', nb: l.balls.length, goal: 'Jefe final del paisaje: derríbalo para abrir el siguiente.' });
  }

  // ---- reparto ----
  const generic = HAND.slice(0, 50);                  // niveles 1-50 de antes: valen para cualquier paisaje
  const handBio = { desert: HAND.slice(50, 60), snow: HAND.slice(60, 70), jungle: HAND.slice(70, 80), volcano: HAND.slice(80, 90), space: HAND.slice(90, 100) };
  let gn = 101;                                       // siguiente nivel generado (el número fija su forma y su dificultad)
  const unlocked = [];                                // bloques nuevos ya estrenados (para remezclar)
  const extrasFor = (biome) => unlocked.filter(c => POSITIVE[c] || (OBSTACLE_HOME[c] || []).includes(biome));
  const pending = [];                                 // práctica y combinación de los estrenos: { at: índice, ch, n }
  const WORLDS = [];
  const FIRST_NAMES = { 1: 'Plaza mayor', 2: 'Feria del castillo', 3: 'Puerto pirata', 4: 'Dunas doradas', 5: 'Oasis perdido', 6: 'Valle de los reyes', 7: 'Pico helado', 8: 'Lago helado', 9: 'Glaciar', 10: 'Templo perdido', 11: 'Río esmeralda', 12: 'Cascadas', 13: 'Isla de fuego', 14: 'Géiseres', 15: 'Cráter rojo', 16: 'Base lunar', 17: 'Nebulosa', 18: 'Estación orbital' };
  const nameUse = {};
  for (let w = 1; w <= NWORLDS; w++) {
    const info = worldInfo(w), size = WSIZE(w), first = LEVELS.length + 1;
    const gi = (w - 1) % 3;                         // posición del mundo dentro de su paisaje (0, 1, 2)
    for (let p = 1; p <= size; p++) {
      const slot = gi * 10 + p - 1;                   // posición dentro del paisaje (para mezclar los niveles a mano)
      const deb = DEBUT_ORDER.find(c => DEBUT[c].world === w && DEBUT[c].pos === p);
      let l;
      if (deb) {
        const D = DEBUT[deb];
        l = { name: D.name, balls: D.balls, nb: D.balls.length, target: 0.7, tier: 'easy', debut: deb, debutTitle: D.title, debutWhat: D.what, debutTip: D.tip, goal: D.what + ' ' + D.tip, blocks: D.blocks.map(b => Object.assign({}, b)) };
        unlocked.push(deb);
        pending.push({ at: LEVELS.length + 1, ch: deb, n: deb === 'e' ? 2 : 1 }, { at: LEVELS.length + 3, ch: deb, n: 1 });
      } else if (info.g < 6 && info.biome !== 'sea' && handBio[info.biome].length && slot % 3 === 2) l = handBio[info.biome].shift();
      else if (info.g < 6 && generic.length) l = generic.shift();
      else if (info.g < 6 && handBio[info.biome] && handBio[info.biome].length) l = handBio[info.biome].shift();
      else {
        l = genLevel(gn++, info.cb, extrasFor(info.cb));
        if (info.cb !== info.biome) {                  // mismo nivel que antes; solo cambia el apellido del nombre
          const A0 = BIOME_ADJ[info.cb] || BIOME_ADJ[BIOME_LIKE[info.cb]], i = A0.findIndex(a => l.name.endsWith(' ' + a));
          if (i >= 0) { l.sn = l.name; l.name = l.name.slice(0, l.name.length - A0[i].length) + BIOME_ADJ[info.biome][i]; }
        }
      }
      const pend = pending.filter(q => q.at === LEVELS.length);
      for (const q of pend) if (!l.debut && l.tier !== 'hard') inject(l, q.ch, q.n); else q.at++;
      Object.assign(l, { world: w, pos: p, biome: info.biome, variant: info.light, weather: info.weather });
      LEVELS.push(l);
    }
    if (isBossWorld(w)) { for (const q of pending) if (q.at === LEVELS.length) q.at++; }
    if (isBossWorld(w)) LEVELS.push(Object.assign(bossLevel(info.boss, info.biome, info.g), { world: w, pos: size + 1, biome: info.biome, variant: info.light, weather: info.weather },
      info.cb !== info.biome ? { sn: (BOSS_NAMES[info.boss] && BOSS_NAMES[info.boss][info.cb]) || BOSS_DEFAULT[info.boss] } : {}));
    const list = WORLD_NAMES[info.biome] || WORLD_NAMES.sea;
    nameUse[info.biome] = (nameUse[info.biome] || 0) + 1;
    const name = FIRST_NAMES[w] || list[(nameUse[info.biome] + w) % list.length];
    WORLDS.push({ n: w, name, sub: BIOME_SUB[info.biome] + ' · ' + info.light + (info.weather ? ' · ' + WEATHER_NAME[info.weather] : ''), biome: info.biome, variant: info.light, weather: info.weather,
      first, last: LEVELS.length, size: LEVELS.length - first + 1, boss: isBossWorld(w) ? LEVELS.length : 0, bossKind: isBossWorld(w) ? info.boss : null, fresh: FRESH.includes(info.biome), cb: info.cb });
  }
  // números, dificultad y ajuste fino
  LEVELS.forEach((l, i) => {
    l.id = i + 1;
    l.hard = l.tier === 'hard';
    if (l.boss) { l._colored = true; l.balls0 = l.balls; }
    finalize(l);
    if (l.boss) { l.target = 1.5; if (l.boss === 'golem') l.cannon.z = Math.min(14.5, l.cannon.z + 0.8); }
  });
  // niveles extra: uno por mundo (los hechos a mano van al primer mundo de su paisaje)
  const handBonusBy = { sea: HAND_BONUS.slice(0, 5), desert: [HAND_BONUS[5]], snow: [HAND_BONUS[6]], jungle: [HAND_BONUS[7]], volcano: [HAND_BONUS[8]], space: [HAND_BONUS[9]] };
  for (let w = 1; w <= NWORLDS; w++) {
    const W = WORLDS[w - 1];
    const l = (handBonusBy[W.biome] && handBonusBy[W.biome].length) ? handBonusBy[W.biome].shift() : genBonus(w, W.biome, W.cb);
    l.biome = W.biome; l.variant = W.variant; l.weather = W.weather;
    BONUS.push(l);
  }
  // los niveles extra usan el número 10000 + mundo (así no chocan con los niveles normales)
  BONUS.forEach((l, i) => {
    l.id = 10001 + i; l.world = i + 1; l.bonus = true; finalize(l);
    l.balls = balancedBalls(l, l.nb); l.nb = l.balls.length;
    // repetirlo cuesta más de lo que puede dar (3 estrellas + todo el oro + vídeo de monedas x2)
    l.goldBlocks = l.blocks.filter(b => b.t === 'gold').length;
    l.maxReplay = 2 * (50 + l.goldBlocks * 10);
    l.replayCost = Math.ceil((l.maxReplay + 50) / 50) * 50;
  });
  const ALL = LEVELS.concat(BONUS);

  // ---- evento de Halloween: 50 niveles en 5 zonas; el 10.º de cada zona es un jefe ----
  // Dificultad de fácil a media-difícil (la forma sale de genLevel con otra semilla: no repite niveles del juego).
  const HW = [];
  const HW_ZONES = ['Calle de las calabazas', 'Cementerio maldito', 'Mansión encantada', 'Bosque de las brujas', 'Castillo del vampiro'];
  const HW_BOSS = [['ship', 'Capitán Calavera'], ['golem', 'Gólem del cementerio'], ['pyramid', 'Faraón maldito'], ['ship', 'Galeón fantasma'], ['golem', 'Rey Vampiro']];
  const HW_NAMES = ['Calabazar', 'Tumba vieja', 'Cripta', 'Torre hueca', 'Telaraña', 'Caldero', 'Escoba rota', 'Linterna', 'Ataúd', 'Murciélago', 'Luna llena', 'Niebla', 'Campanario', 'Verja oxidada', 'Mausoleo'];
  const hwExtras = extrasFor('sea');
  const HW_FIX = { 19: 1, 41: 1, 18: 2, 38: 2, 47: 2 };
  // dificultad por zona: de fácil a media-difícil
  const HW_TIERS = ['eeemeemee', 'emememeem', 'emmehmemm', 'memhmmehm', 'mhmmhmhmh'];                       // formas que no se quedaban quietas: otra semilla
  for (let i = 1; i <= 50; i++) {
    const z = Math.ceil(i / 10) - 1;
    let l;
    if (i % 10 === 0) {
      const [k, nm] = HW_BOSS[z];
      l = bossLevel(k, 'sea', 3 + z * 6);
      Object.assign(l, { name: nm, bossName: nm, bossD: Math.min(1, z * 0.22), goal: 'Jefe de Halloween: derríbalo para abrir la siguiente zona.' });
      l._colored = true; l.balls0 = l.balls;
    } else {
      for (let salt = (HW_FIX[i] || 0) * 31; ; salt += 97) {   // la primera zona, sin niveles difíciles
        l = genLevel(111 + Math.round((i - z - 1) * 13.5), 'sea', hwExtras, 4242 + i + salt);
        if (z > 0 || l.tier !== 'hard' || salt > 2000) break;
      }
      l.gid = 'hw' + i; l.name = HW_NAMES[(i * 7) % HW_NAMES.length] + ' ' + (i - z * 10);
      l.tier = { e: 'easy', m: 'medium', h: 'hard' }[HW_TIERS[z][i - z * 10 - 1]];
      l.goal = 'Rompe los bloques con caramelo encima para llevártelo.';
    }
    Object.assign(l, { id: 20000 + i, hw: true, world: 0, pos: i, zone: z, zoneName: HW_ZONES[z], biome: 'halloween', variant: 'noche', weather: null });
    l.hard = l.tier === 'hard';
    finalize(l);
    if (l.boss) { l.target = 1.5; if (l.boss === 'golem') l.cannon.z = Math.min(14.5, l.cannon.z + 0.8); }
    HW.push(l);
  }
  ALL.push(...HW);

  // ---- evento de Navidad: 50 niveles en 5 zonas del pueblo nevado; el 10.º de cada zona es un jefe ----
  // Mismo reparto que Halloween (de fácil a media-difícil), con otra semilla: formas distintas a las del juego y a las de Halloween.
  const XM = [];
  const XM_ZONES = ['Plaza del pueblo', 'Mercadillo navideño', 'Bosque de los abetos', 'Lago helado', 'Taller de Papá Noel'];
  const XM_BOSS = [['golem', 'Cascanueces Mayor'], ['pyramid', 'Caja Sorpresa'], ['ship', 'Capitán Escarcha'], ['golem', 'General Cascanueces'], ['pyramid', 'Gran Caja Sorpresa']];
  const XM_NAMES = ['Campanilla', 'Muérdago', 'Villancico', 'Chimenea', 'Calcetín', 'Trineo', 'Copo', 'Turrón', 'Estrella', 'Guirnalda', 'Bastón', 'Polvorón', 'Muñeco', 'Abeto', 'Regalo'];
  const XM_FIX = { 9: 1 };
  for (let i = 1; i <= 50; i++) {
    const z = Math.ceil(i / 10) - 1;
    let l;
    if (i % 10 === 0) {
      const [k, nm] = XM_BOSS[z];
      l = bossLevel(k, 'sea', 4 + z * 6);
      Object.assign(l, { name: nm, bossName: nm, bossD: Math.min(1, z * 0.22), goal: 'Jefe de Navidad: derríbalo para abrir la siguiente zona.' });
      l._colored = true; l.balls0 = l.balls;
    } else {
      for (let salt = (XM_FIX[i] || 0) * 31; ; salt += 97) {
        l = genLevel(121 + Math.round((i - z - 1) * 13.5), 'sea', hwExtras, 9191 + i + salt);
        if (z > 0 || l.tier !== 'hard' || salt > 2000) break;
      }
      l.gid = 'xm' + i; l.name = XM_NAMES[(i * 7) % XM_NAMES.length] + ' ' + (i - z * 10);
      l.tier = { e: 'easy', m: 'medium', h: 'hard' }[HW_TIERS[z][i - z * 10 - 1]];
      l.goal = 'Rompe los regalos para llevarte sus caramelos y bastones.';
    }
    Object.assign(l, { id: 30000 + i, xm: true, world: 0, pos: i, zone: z, zoneName: XM_ZONES[z], biome: 'xmas', variant: 'noche', weather: null });
    l.hard = l.tier === 'hard';
    finalize(l);
    if (l.boss) { l.target = 1.5; if (l.boss === 'golem') { l.cannon.z = Math.min(15.5, l.cannon.z + 2.6); l.viewTop = Math.max(...l.blocks.map(b => b.y + b.h / 2)) + 5.6; } }
    XM.push(l);
  }
  ALL.push(...XM);
  const byId = id => ALL.find(l => l.id === id);

  // ---- clubes: niveles de la semana sacados de los del juego (ya probados y afinados), con id propio ----
  // Expedición 40001-40050 (10 por día de lunes a viernes, cada día un poco más difícil), liga 41001-41010 (difíciles)
  // y jefe colosal 42001. Todos los miembros de todos los clubes juegan los mismos esa semana (semilla = id de la semana).
  const CLUB_BOSS = { golem: 'Coloso de Piedra', pyramid: 'Faraón Colosal', ship: 'Galeón Colosal' };
  function clubLevels(kind, key) {
    for (let i = ALL.length - 1; i >= 0; i--) if (ALL[i].club === kind) ALL.splice(i, 1);
    let h = 2166136261; for (const c of kind + ':' + key) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    let a = h >>> 0;
    const rnd = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const pick = (pool, n) => { const p = pool.slice(), out = []; while (out.length < n && p.length) out.push(p.splice(Math.floor(rnd() * p.length), 1)[0]); return out; };
    const plain = LEVELS.filter(l => !l.boss && !l.bonus);
    const clone = (b, o) => Object.assign({}, b, { world: b.world, weather: null }, o);
    let out = [];
    if (kind === 'ex') {
      const R = [[20, 120], [80, 240], [160, 360], [260, 520], [360, 720]];
      R.forEach(([lo, hi], d) => pick(plain.filter(l => l.id >= lo && l.id <= hi), 10).sort((x, y) => x.id - y.id)
        .forEach((b, i) => out.push(clone(b, { id: 40001 + d * 10 + i, club: 'ex', pos: d * 10 + i + 1, day: d, src: b.id }))));
    } else if (kind === 'lg') {
      pick(plain.filter(l => l.hard && l.id >= 100 && l.id <= 800), 10).sort((x, y) => x.id - y.id)
        .forEach((b, i) => out.push(clone(b, { id: 41001 + i, club: 'lg', pos: i + 1, src: b.id })));
    } else if (kind === 'boss') {
      const b = pick(LEVELS.filter(l => l.boss && l.id >= 30), 1)[0];
      const nm = CLUB_BOSS[b.boss] || 'Coloso';
      out.push(clone(b, { id: 42001, club: 'boss', pos: 1, name: nm, bossName: nm, bossD: 1, src: b.id, goal: 'Jefe colosal: todo el club contra él. Cada ataque le quita vida.' }));
    }
    ALL.push(...out);
    return out;
  }

  // ---- desafío de la semana: un nivel difícil igual para todos (semilla = la semana), id 43001 ----
  const WEEKLY_NAMES = ['La Torre Imposible', 'El Muro Gigante', 'La Fortaleza', 'El Rascacielos', 'La Pirámide Loca', 'El Castillo de Naipes', 'La Gran Muralla', 'El Laberinto'];
  function weeklyLevel(key) {
    for (let i = ALL.length - 1; i >= 0; i--) if (ALL[i].weekly) ALL.splice(i, 1);
    let h = 2166136261; for (const c of 'wk:' + key) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    let a = h >>> 0;
    const rnd = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const pool = LEVELS.filter(l => !l.boss && !l.bonus && l.hard && l.id >= 120 && l.id <= 900);
    const b = pool[Math.floor(rnd() * pool.length)], nm = WEEKLY_NAMES[Math.floor(rnd() * WEEKLY_NAMES.length)];
    const L = Object.assign({}, b, { id: 43001, weekly: key, pos: 1, weather: null, name: nm, src: b.id, goal: 'Desafío de la semana: cuenta la puntuación. Tienes 3 intentos.' });
    ALL.push(L);
    return L;
  }

  // para el afinador: cambia bolas y objetivo de un nivel
  function retune(l, nb, target) {
    if (l.bonus) { l.target = target; l.balls = balancedBalls(l, nb); l.nb = l.balls.length; return; } l.nb = nb; l.target = target; l.balls = l.balls0 && l.balls0.length >= nb ? l.balls0.slice(0, nb) : (l.balls0 || '') + autoBalls(l, nb - (l.balls0 || '').length); }

  const Levels = { club: clubLevels, weekly: weeklyLevel, HARD, MEDIUM, GEN_BIOMES, VARIANTS, LEVELS, BONUS, WORLDS, ALL, HW, HW_ZONES, XM, XM_ZONES, byId, grid, box3, plank, pillar, retune, worldInfo, CLASSIC, FRESH, DEBUT };
  if (typeof module !== 'undefined' && module.exports) module.exports = Levels;
  else root.Levels = Levels;
})(typeof globalThis !== 'undefined' ? globalThis : this);
