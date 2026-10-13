// Junta los resultados de tools/gentune.js en src/gentune.js
const fs = require('fs'), path = require('path');
const T = {};
for (const f of process.argv.slice(2)) if (fs.existsSync(f)) for (const line of fs.readFileSync(f, 'utf8').trim().split('\n')) { if (!line) continue; const r = JSON.parse(line); T[r.id] = [r.nb, r.target, r.win]; }
const body = `// Generado por tools/gentune.js: [bolas, objetivo, % de victorias medido] de cada nivel generado
(function (root) {
  const T = ${JSON.stringify(T)};
  if (typeof module !== 'undefined' && module.exports) module.exports = T;
  else root.GenTuning = T;
})(typeof globalThis !== 'undefined' ? globalThis : this);
`;
fs.writeFileSync(path.join(__dirname, '..', 'src', 'gentune.js'), body);
console.log('niveles generados afinados:', Object.keys(T).length);
