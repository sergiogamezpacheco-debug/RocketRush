// Junta todo en un único index.html autocontenido (sin internet) y una versión para artefacto
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), src = path.join(root, 'src'), ven = path.join(root, 'vendor');
let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
const files = [[ven, 'three.global.js'], [ven, 'three.extras.js'], [ven, 'cannon.global.js'], [src, 'sim3d.js']].concat(fs.existsSync(path.join(src, 'tuning.js')) ? [[src, 'tuning.js']] : [], [[src, 'levels3d.js'], [src, 'game3d.js']]);
const js = files.map(([d, f]) => `<script>\n${fs.readFileSync(path.join(d, f), 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`).join('\n');
html = html.replace('<!--SCRIPTS-->', () => js);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'index.html'), html);
let art = html.replace(/<!doctype html>\s*/i, '').replace(/<html[^>]*>\s*/i, '').replace(/<\/html>\s*$/i, '')
  .replace(/<head>\s*/i, '').replace(/<\/head>\s*/i, '').replace(/<body>\s*/i, '').replace(/<\/body>\s*(?=$)/i, '')
  .replace(/<meta charset="utf-8">\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '').replace(/<meta name="theme-color"[^>]*>\s*/i, '');
fs.writeFileSync(path.join(root, 'dist', 'chroma-crash-3d.html'), art);
console.log('ok', (html.length / 1024).toFixed(0) + ' KB');
