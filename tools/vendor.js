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
// Parches de rendimiento (se aplican al generar; el original de vendor/ no se toca)
function patch(code, pairs, name) {
  for (const [from, to] of pairs) { if (!code.includes(from)) throw new Error(name + ': no encuentro «' + from.slice(0, 60) + '»'); code = code.split(from).join(to); }
  return code;
}
// three: los uniformes bool (receiveShadow, isOrthographic…) guardaban true/false en la caché de uniformes. Esas cachés
// nacen todas del mismo «[]», así que V8 las pasaba todas a «genéricas» y cada número que se guardaba en ellas (matrices de
// cada objeto, en cada fotograma) creaba un objeto nuevo: ~5 MB/s de basura y pausas del recolector. Guardando el número (1/0) no pasa.
const THREE_PATCHES = [
  ['function yo(t,e){const n=this.cache;n[0]!==e&&(t.uniform1i(this.addr,e),n[0]=e)}', 'function yo(t,e){const n=this.cache;e=+e;n[0]!==e&&(t.uniform1i(this.addr,e),n[0]=e)}'],
  ['function wo(t,e){const n=this.cache;n[0]!==e&&(t.uniform1ui(this.addr,e),n[0]=e)}', 'function wo(t,e){const n=this.cache;e=+e;n[0]!==e&&(t.uniform1ui(this.addr,e),n[0]=e)}'],
  ['function po(t,e){const n=this.cache;n[0]!==e&&(t.uniform1f(this.addr,e),n[0]=e)}', 'function po(t,e){const n=this.cache;"boolean"==typeof e&&(e=+e);n[0]!==e&&(t.uniform1f(this.addr,e),n[0]=e)}'],
];
const three = esmToGlobal(patch(fs.readFileSync(path.join(V, 'three.module.min.js'), 'utf8'), THREE_PATCHES, 'three'), 'THREE');
// cannon-es: la física creaba miles de vectores y arrays nuevos en cada paso (choques entre cajas y el solucionador):
// 10-20 MB/s de basura → pausas del recolector en mitad de un derrumbe. Los mismos cálculos, reutilizando memoria.
const CANNON_PATCHES = [
  // solucionador: arrays numéricos fijos en vez de arrays genéricos que se redimensionaban en cada paso
  ['    const invCs = GSSolver_solve_invCs;\n    const Bs = GSSolver_solve_Bs;\n    const lambda = GSSolver_solve_lambda;\n    invCs.length = Neq;\n    Bs.length = Neq;\n    lambda.length = Neq;',
   '    if (GS_BUF.n < Neq) { const c = Math.max(Neq, GS_BUF.n * 2, 256); GS_BUF.n = c; GS_BUF.invCs = new Float64Array(c); GS_BUF.Bs = new Float64Array(c); GS_BUF.lambda = new Float64Array(c); }\n    const invCs = GS_BUF.invCs, Bs = GS_BUF.Bs, lambda = GS_BUF.lambda;'],
  ['const GSSolver_solve_lambda = [];', 'const GS_BUF = { n: 0, invCs: null, Bs: null, lambda: null };\nconst GSSolver_solve_lambda = [];'],
  // vectores de trabajo compartidos (estas funciones no se llaman a sí mismas)
  ['class ConvexPolyhedron extends Shape {', 'const CP_T = []; for (let i = 0; i < 16; i++) CP_T.push(new Vec3());\nconst CLIP_POOL = []; let CLIP_N = 0;\nfunction clipVec() { if (CLIP_N === CLIP_POOL.length) CLIP_POOL.push(new Vec3()); return CLIP_POOL[CLIP_N++]; }\nconst CLIP_B1 = [], CLIP_B2 = [];\nclass ConvexPolyhedron extends Shape {'],
  ['    const WorldNormal = new Vec3();\n    let closestFaceB = -1;', '    const WorldNormal = CP_T[0];\n    CLIP_N = 0;\n    let closestFaceB = -1;'],
  ['    const worldVertsB1 = [];\n\n    for (let i = 0; i < hullB.faces[closestFaceB].length; i++) {\n      const b = hullB.vertices[hullB.faces[closestFaceB][i]];\n      const worldb = new Vec3();',
   '    const worldVertsB1 = CLIP_B1; worldVertsB1.length = 0;\n\n    for (let i = 0; i < hullB.faces[closestFaceB].length; i++) {\n      const b = hullB.vertices[hullB.faces[closestFaceB][i]];\n      const worldb = clipVec();'],
  ['    const faceANormalWS3 = new Vec3();\n    const Worldnormal1 = new Vec3();\n    const deltaC = new Vec3();\n    const worldEdge0 = new Vec3();\n    const worldEdge1 = new Vec3();\n    const Cross = new Vec3();',
   '    const faceANormalWS3 = CP_T[1];\n    const Worldnormal1 = CP_T[2];\n    const deltaC = CP_T[3];\n    const worldEdge0 = CP_T[4];\n    const worldEdge1 = CP_T[5];\n    const Cross = CP_T[6];'],
  ['    const faceANormalWS = new Vec3();\n    const edge0 = new Vec3();\n    const WorldEdge0 = new Vec3();\n    const worldPlaneAnormal1 = new Vec3();\n    const planeNormalWS1 = new Vec3();\n    const worldA1 = new Vec3();\n    const localPlaneNormal = new Vec3();\n    const planeNormalWS = new Vec3();\n    const hullA = this;\n    const worldVertsB2 = [];',
   '    const faceANormalWS = CP_T[7];\n    const edge0 = CP_T[8];\n    const WorldEdge0 = CP_T[9];\n    const worldPlaneAnormal1 = CP_T[10];\n    const planeNormalWS1 = CP_T[11];\n    const worldA1 = CP_T[12];\n    const localPlaneNormal = CP_T[13];\n    const planeNormalWS = CP_T[14];\n    const hullA = this;\n    const worldVertsB2 = CLIP_B2; worldVertsB2.length = 0;'],
  // las caras vecinas de una cara no cambian nunca: se calculan una vez
  ['    const polyA = hullA.faces[closestFaceA];\n    polyA.connectedFaces = [];\n\n    for (let i = 0; i < hullA.faces.length; i++) {',
   '    const polyA = hullA.faces[closestFaceA];\n    if (!polyA.connectedFaces) { polyA.connectedFaces = [];\n\n    for (let i = 0; i < hullA.faces.length; i++) {'],
  ['          polyA.connectedFaces.push(i);\n        }\n      }\n    } // Clip the polygon', '          polyA.connectedFaces.push(i);\n        }\n      }\n    } } // Clip the polygon'],
  ['          // Start < 0, end < 0, so output lastVertex\n          const newv = new Vec3();', '          // Start < 0, end < 0, so output lastVertex\n          const newv = clipVec();'],
  ['          // Start < 0, end >= 0, so output intersection\n          const newv = new Vec3();', '          // Start < 0, end >= 0, so output intersection\n          const newv = clipVec();'],
  ['          // Start >= 0, end < 0 so output intersection and end\n          const newv = new Vec3();', '          // Start >= 0, end < 0 so output intersection and end\n          const newv = clipVec();'],
  ['const maxminA = [];\nconst maxminB = [];', 'const maxminA = [0, 0.5];\nconst maxminB = [0, 0.5];'],
];
const cannon = `(function(){var exports={};var module={exports:exports};var require=function(){return null;};\n${patch(fs.readFileSync(path.join(V, 'cannon-es.cjs.js'), 'utf8'), CANNON_PATCHES, 'cannon')}\nwindow.CANNON=module.exports;})();\n`;
// la misma física parcheada para las herramientas de Node (validador de niveles, bancos de pruebas)
fs.writeFileSync(path.join(V, 'cannon-es.fast.cjs.js'), patch(fs.readFileSync(path.join(V, 'cannon-es.cjs.js'), 'utf8'), CANNON_PATCHES, 'cannon'));
const extras = ['RoundedBoxGeometry.js', 'RoomEnvironment.js'].map(f => jsmToGlobal(fs.readFileSync(path.join(V, f), 'utf8'))).join('\n');
fs.writeFileSync(path.join(V, 'three.global.js'), three);
fs.writeFileSync(path.join(V, 'cannon.global.js'), cannon);
fs.writeFileSync(path.join(V, 'three.extras.js'), extras);
console.log('three', (three.length / 1024).toFixed(0), 'KB · cannon', (cannon.length / 1024).toFixed(0), 'KB · extras', (extras.length / 1024).toFixed(0), 'KB');
