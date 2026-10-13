// Convierte las librerías (módulos ES / CommonJS) en scripts clásicos con variables globales
const fs = require('fs'), path = require('path');
const V = path.join(__dirname, '..', 'vendor');
function esmToGlobal(code, globalName) {
  const m = code.match(/export\s*\{([^}]*)\}\s*;?\s*$/);
  if (!m) throw new Error('sin export final');
  const body = code.slice(0, m.index);
  const map = m[1].split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const p = s.split(/\s+as\s+/); return `${p[1] || p[0]}:${p[0]}`;
  });
  return `(function(){\n${body}\nwindow.${globalName}={${map.join(',')}};\n})();\n`;
}
function jsmToGlobal(code) {
  code = code.replace(/import\s*\{([^}]*)\}\s*from\s*'three';/g, (_, names) => `const {${names}} = THREE;`);
  const exported = [];
  code = code.replace(/export\s*\{([^}]*)\};?/g, (_, names) => { exported.push(...names.split(',').map(s => s.trim()).filter(Boolean)); return ''; });
  code = code.replace(/export\s+(class|function)\s+(\w+)/g, (_, kw, name) => { exported.push(name); return `${kw} ${name}`; });
  return `(function(){\n${code}\n${exported.map(n => `THREE.${n} = ${n};`).join('\n')}\n})();\n`;
}
const three = esmToGlobal(fs.readFileSync(path.join(V, 'three.module.min.js'), 'utf8'), 'THREE');
const cannon = `(function(){var exports={};var module={exports:exports};var require=function(){return null;};\n${fs.readFileSync(path.join(V, 'cannon-es.cjs.js'), 'utf8')}\nwindow.CANNON=module.exports;})();\n`;
const extras = ['RoundedBoxGeometry.js', 'RoomEnvironment.js'].map(f => jsmToGlobal(fs.readFileSync(path.join(V, f), 'utf8'))).join('\n');
fs.writeFileSync(path.join(V, 'three.global.js'), three);
fs.writeFileSync(path.join(V, 'cannon.global.js'), cannon);
fs.writeFileSync(path.join(V, 'three.extras.js'), extras);
console.log('three', (three.length / 1024).toFixed(0), 'KB · cannon', (cannon.length / 1024).toFixed(0), 'KB · extras', (extras.length / 1024).toFixed(0), 'KB');
