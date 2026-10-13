// Junta los resultados del afinador en src/tuning.js
const fs = require('fs'), path = require('path');
const parts = process.argv.slice(2);
const old = (() => { try { return require('../src/tuning.js'); } catch (e) { return {}; } })();
const T = Object.assign({}, old);
for (const p of parts) { if (!fs.existsSync(p)) continue; const r = JSON.parse(fs.readFileSync(p, 'utf8')); for (const k in r) T[k] = { nb: r[k].nb, target: r[k].target, win: r[k].win, close: r[k].close }; }
const body = `// Generado por tools/tune.js: bolas y objetivo de cada nivel, con la tasa de victorias medida (jugador casual simulado)
(function (root) {
  const T = ${JSON.stringify(T, null, 1)};
  if (typeof module !== 'undefined' && module.exports) module.exports = T;
  else root.LevelTuning = T;
})(typeof globalThis !== 'undefined' ? globalThis : this);
`;
fs.writeFileSync(path.join(__dirname, '..', 'src', 'tuning.js'), body);
console.log('niveles afinados:', Object.keys(T).length);
