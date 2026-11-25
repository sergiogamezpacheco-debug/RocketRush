// Junta todo en un único index.html autocontenido (sin internet) y una versión para artefacto
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), src = path.join(root, 'src'), ven = path.join(root, 'vendor');
let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
// versión visible en Ajustes (en GitHub Actions: 1.0.<número de compilación>)
const version = process.env.APP_VERSION || ('pruebas ' + new Date().toISOString().slice(0, 16).replace('T', ' '));
html = html.replace('<!--VERSION-->', version);
const files = [[ven, 'three.global.js'], [ven, 'three.extras.js'], [src, 'perf.js'], [ven, 'cannon.global.js'], [src, 'sim3d.js']].concat(fs.existsSync(path.join(src, 'tuning.js')) ? [[src, 'tuning.js']] : [], fs.existsSync(path.join(src, 'gentune.js')) ? [[src, 'gentune.js']] : [], [[src, 'levels3d.js'], [src, 'sfx.js'], [src, 'i18n-data.js'], [src, 'i18n.js'], [src, 'live.js'], [src, 'cannons.js'], [src, 'game3d.js'], [src, 'bosses.js'], [src, 'halloween.js'], [src, 'christmas.js'], [src, 'mundos.js'], [src, 'social.js'], [src, 'club.js'], [src, 'retencion.js'], [src, 'jugada.js'], [src, 'torre.js'], [src, 'tutorial.js']]);
// --release: versión para publicar, sin el modo prueba
const release = process.argv.includes('--release');
// --xm-pruebas: adelanta el evento de Navidad a hoy (solo la APK de pruebas «RR Pruebas», en apk.yml); nunca con --release
const xmPruebas = process.argv.includes('--xm-pruebas') && !release;
const read = (d, f) => { let t = fs.readFileSync(path.join(d, f), 'utf8'); if (release && f === 'game3d.js') t = t.replace('const TEST_MODE = true;', 'const TEST_MODE = false;');
  if (xmPruebas && f === 'game3d.js') { const n = new Date(); t = t.replace('const XM_PRUEBAS = 0;', `const XM_PRUEBAS = ${Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) - 3600e3};`); }
  return t; };
const js = files.map(([d, f]) => `<script>\n${read(d, f).replace(/<\/script/gi, '<\\/script')}\n</script>`).join('\n');
html = html.replace('<!--SCRIPTS-->', () => js);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'index.html'), html);
let art = html.replace(/<!doctype html>\s*/i, '').replace(/<html[^>]*>\s*/i, '').replace(/<\/html>\s*$/i, '')
  .replace(/<head>\s*/i, '').replace(/<\/head>\s*/i, '').replace(/<body>\s*/i, '').replace(/<\/body>\s*(?=$)/i, '')
  .replace(/<meta charset="utf-8">\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '').replace(/<meta name="theme-color"[^>]*>\s*/i, '');
fs.writeFileSync(path.join(root, 'dist', 'rocket-rush.html'), art);
console.log('ok', (html.length / 1024).toFixed(0) + ' KB' + (release ? ' · versión para publicar (sin modo prueba)' : ' · con modo prueba') + (xmPruebas ? ' · Navidad adelantada (app de pruebas)' : ''));
