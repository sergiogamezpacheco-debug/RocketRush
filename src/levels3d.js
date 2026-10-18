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
  const VARIANTS = ['día', 'atardecer', 'noche', 'aurora'];
  const WORLD_NAMES = {
    sea: ['Bahía de caramelo', 'Arrecife de colores', 'Puerto viejo', 'Islas gominola', 'Faro del norte', 'Cala escondida', 'Mar de cristal', 'Muelle real', 'Archipiélago', 'Costa brava', 'Laguna azul', 'Atolón', 'Rompeolas', 'Isla del tesoro', 'Mar abierto', 'Acantilados'],
    desert: ['Oasis perdido', 'Cañón rojo', 'Valle de los reyes', 'Mar de dunas', 'Ruta de la seda', 'Templo del sol', 'Espejismo', 'Ciudad de arena', 'Meseta', 'Desierto blanco', 'Caravana real', 'Pirámides', 'Tormenta de arena', 'Sahara', 'Duna gigante', 'Arenas rojas'],
    snow: ['Glaciar', 'Valle nevado', 'Polo norte', 'Cumbres blancas', 'Lago helado', 'Aldea de nieve', 'Ventisca', 'Fiordo', 'Tundra', 'Pico del águila', 'Estación de esquí', 'Cueva de hielo', 'Aurora polar', 'Iceberg', 'Bosque nevado', 'Montaña azul'],
    jungle: ['Río esmeralda', 'Ciudad maya', 'Cascadas', 'Selva profunda', 'Isla de los loros', 'Pantano', 'Manglar', 'Templo de jade', 'Bosque de lianas', 'Valle perdido', 'Selva nublada', 'Pirámide verde', 'Jardín salvaje', 'Raíces antiguas', 'Gran ceiba', 'Amazonía'],
    volcano: ['Río de lava', 'Cráter rojo', 'Fragua antigua', 'Islas de ceniza', 'Montaña de fuego', 'Géiseres', 'Cueva de magma', 'Obsidiana', 'Monte ardiente', 'Llanura de basalto', 'Corazón de fuego', 'Fumarolas', 'Lago de fuego', 'Tierra quemada', 'Volcán dormido', 'Infierno dorado'],
    space: ['Cinturón de asteroides', 'Luna roja', 'Estación orbital', 'Nebulosa', 'Planeta anillado', 'Cometa', 'Galaxia espiral', 'Polvo de estrellas', 'Marte', 'Satélites', 'Vía Láctea', 'Supernova', 'Agujero de gusano', 'Constelación', 'Órbita lunar', 'Confín del universo'],
  };
  const BIOME_ADJ = {
    sea: ['del puerto', 'de la costa', 'del faro', 'de coral', 'del mar'], desert: ['de arena', 'del faraón', 'del oasis', 'del desierto', 'de las dunas'],
    snow: ['de hielo', 'de nieve', 'del polo', 'del glaciar', 'de escarcha'], jungle: ['de la selva', 'de los mayas', 'de jade', 'de lianas', 'del río'],
    volcano: ['de lava', 'de ceniza', 'de fuego', 'del volcán', 'de magma'], space: ['de la luna', 'de estrellas', 'del cosmos', 'de Marte', 'de la galaxia'],
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
  function genLevel(n) {
    const w = Math.floor((n - 1) / 10) + 1, pos = (n - 1) % 10 + 1, k = w - 11;
    const biome = GEN_BIOMES[k % 6], r = seeded(n * 7919 + 17), pick = a => a[Math.floor(r() * a.length)];
    const hardPos = 4 + seeded(w * 31)() * 6 | 0;
    const medPos = [2, 3, 4, 5, 6, 7, 8, 9, 10].filter(p => p !== hardPos).sort((a, b) => seeded(w * 97 + a)() - seeded(w * 97 + b)()).slice(0, 4);
    const tier = pos === hardPos ? 'hard' : medPos.includes(pos) ? 'medium' : 'easy';
    const ramp = Math.min(1, k / 60);                                  // 0 al principio, 1 hacia el nivel 700
    const ncol = Math.min(5, 3 + (r() < 0.4 + ramp * 0.5 ? 1 : 0) + (tier !== 'easy' && r() < 0.35 + ramp * 0.4 ? 1 : 0));
    const cols = ['r', 'b', 'g', 'y', 'p'].sort(() => r() - 0.5).slice(0, ncol);
    const colPat = (seed) => { const q = r(); return q < 0.55 ? P.rand(cols, seed) : q < 0.7 ? P.layer(cols) : q < 0.85 ? P.checker(cols) : P.diag(cols); };
    // elementos especiales: los de siempre y, sobre todo, el del paisaje
    const sig = { sea: ['RBGYP', 'bomb', 'ice', 't', 'x'], desert: ['a', 'a', 'a', 'RBGYP', 's'], snow: ['f', 'ice', 'ice', 'f', 'x'], jungle: ['c', 'c', 'c', 'RBGYP', 'bomb'], volcano: ['m', 'm', 's', 't', 'bomb'], space: ['f', 'c', 'x', 'RBGYP', 'bomb'] }[biome];
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
    return { name: pick(ARCH[arch]) + ' ' + pick(BIOME_ADJ[biome]), nb: Math.max(3, Math.min(14, nb)), target: Math.min(0.92, +target.toFixed(2)), gen: true, tier, biome, variant: VARIANTS[Math.floor(k / 6) % 4],
      goal: pick(TIPS[biome]), blocks };
  }
  function genBonus(w) {
    const k = w - 11, biome = GEN_BIOMES[k % 6], r = seeded(w * 4441), cols = ['r', 'b', 'g', 'y', 'p'].sort(() => r() - 0.5).slice(0, 3);
    const W = 4 + (r() * 2 | 0), D = 3, H = 3 + (r() * 2 | 0);
    let blocks = box3(0, 0, 0, W, D, H, P.rand(cols, w), { map: (ch, i, j) => ((i + j * 2) % 4 === 1 ? 'o' : ch) });
    if (biome === 'space') blocks = flat(box3(0, 0, 0, W, D, 2, P.rand(cols, w)), flo(box3(0, 0, 3, W, D, 2, P.checker(['o', cols[0], cols[1]]))));
    return { name: 'Tesoro ' + BIOME_ADJ[biome][w % 5], nb: 6, target: 0.75, gen: true, biome, variant: VARIANTS[Math.floor(k / 6) % 4], goal: 'Nivel extra: los bloques de oro sueltan monedas.', blocks };
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
    const r = seeded(l.name.length * 131 + n * 7);
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
      const r = seeded(l.name.length * 977 + 3);
      let q = Math.floor(r() * 5);
      for (const b of l.blocks) if ((b.t === 'prize' || b.t === 'cham') && !b.c) b.c = (cols.length ? cols : ['r', 'b'])[q++ % (cols.length || 2)];
    }
    if (l.balls0 === undefined) l.balls0 = l.balls || '';
    const t = l.gen ? (GTUNE[l.id] && { nb: GTUNE[l.id][0], target: GTUNE[l.id][1] }) : TUNE[l.name];
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
  const BIOME = ['sea', 'sea', 'sea', 'sea', 'sea', 'desert', 'snow', 'jungle', 'volcano', 'space'];
  const HAND = LEVELS.length, HAND_BONUS = BONUS.length;
  for (let n = HAND + 1; n <= 1000; n++) LEVELS.push(genLevel(n));
  for (let w = HAND_BONUS + 1; w <= 100; w++) BONUS.push(genBonus(w));
  LEVELS.forEach((l, i) => {
    l.id = i + 1; l.world = Math.floor(i / 10) + 1;
    if (!l.gen) l.tier = HARD.includes(l.id) ? 'hard' : MEDIUM.includes(l.id) ? 'medium' : 'easy';
    l.hard = l.tier === 'hard'; l.biome = l.biome || BIOME[l.world - 1];
    finalize(l);
  });
  // los niveles extra usan el número 10000 + mundo (así no chocan con los niveles normales)
  BONUS.forEach((l, i) => {
    l.id = 10001 + i; l.world = i + 1; l.bonus = true; l.biome = l.biome || BIOME[i]; finalize(l);
    l.balls = balancedBalls(l, l.nb); l.nb = l.balls.length;
    // repetirlo cuesta más de lo que puede dar (3 estrellas + todo el oro + vídeo de monedas x2)
    l.goldBlocks = l.blocks.filter(b => b.t === 'gold').length;
    l.maxReplay = 2 * (50 + l.goldBlocks * 10);
    l.replayCost = Math.ceil((l.maxReplay + 50) / 50) * 50;
  });
  const WORLDS = [
    { n: 1, name: 'Plaza mayor', sub: 'gominolas, piedra, rayados y TNT' },
    { n: 2, name: 'Feria del castillo', sub: 'bloques bomba y el color morado' },
    { n: 3, name: 'Almacén helado', sub: 'bloques de hielo' },
    { n: 4, name: 'Puerto', sub: 'contenedores gigantes y barriles' },
    { n: 5, name: 'Palacio de cristal', sub: 'todo lo aprendido' },
    { n: 6, name: 'Dunas doradas', sub: 'el desierto y los bloques de arena', biome: 'desert' },
    { n: 7, name: 'Pico helado', sub: 'la montaña y las bolas congeladas', biome: 'snow' },
    { n: 8, name: 'Templo perdido', sub: 'la selva y los camaleones', biome: 'jungle' },
    { n: 9, name: 'Isla de fuego', sub: 'el volcán y el magma', biome: 'volcano' },
    { n: 10, name: 'Base lunar', sub: 'el espacio y la antigravedad', biome: 'space' },
  ];
  const BIOME_SUB = { sea: 'el mar', desert: 'el desierto', snow: 'la montaña nevada', jungle: 'la selva', volcano: 'el volcán', space: 'el espacio' };
  for (let w = 11; w <= 100; w++) {
    const k = w - 11, biome = GEN_BIOMES[k % 6], variant = VARIANTS[Math.floor(k / 6) % 4];
    WORLDS.push({ n: w, name: WORLD_NAMES[biome][Math.floor(k / 6)], sub: BIOME_SUB[biome] + ' · ' + variant, biome, variant });
  }
  const ALL = LEVELS.concat(BONUS);
  const byId = id => ALL.find(l => l.id === id);

  // para el afinador: cambia bolas y objetivo de un nivel
  function retune(l, nb, target) {
    if (l.bonus) { l.target = target; l.balls = balancedBalls(l, nb); l.nb = l.balls.length; return; } l.nb = nb; l.target = target; l.balls = l.balls0 && l.balls0.length >= nb ? l.balls0.slice(0, nb) : (l.balls0 || '') + autoBalls(l, nb - (l.balls0 || '').length); }

  const Levels = { HARD, MEDIUM, GEN_BIOMES, VARIANTS, LEVELS, BONUS, WORLDS, ALL, byId, grid, box3, plank, pillar, retune };
  if (typeof module !== 'undefined' && module.exports) module.exports = Levels;
  else root.Levels = Levels;
})(typeof globalThis !== 'undefined' ? globalThis : this);
