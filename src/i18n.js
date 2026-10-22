// Rocket Rush — idiomas. El juego está escrito en español; al cambiar de idioma se traduce todo lo que sale en pantalla
// (textos de la página y los que el juego va poniendo) con la tabla de i18n-data.js:
//   1) frase exacta · 2) plantilla con trozos variables ({x}) · 3) frases conocidas dentro de un texto más largo.
// Lo que no está en pantalla (mensaje al compartir, avisos) se traduce con I18N.t(texto).
(function () {
  'use strict';
  const LANGS = [
    { code: 'es', name: 'Español' }, { code: 'en', name: 'English' }, { code: 'pt', name: 'Português' },
    { code: 'fr', name: 'Français' }, { code: 'de', name: 'Deutsch' }, { code: 'it', name: 'Italiano' },
  ];
  const IDX = { en: 0, pt: 1, fr: 2, de: 3, it: 4 };
  const DATA = window.I18N_DATA || {};
  const KEY = 'rocketrush.lang';
  let lang = 'es';
  try { lang = localStorage.getItem(KEY) || 'es'; } catch (e) { /* sin almacenamiento */ }
  if (!LANGS.some(l => l.code === lang)) lang = 'es';
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const L = '(?<![\\p{L}\\p{N}])', R = '(?![\\p{L}\\p{N}])';
  // plantillas con trozos variables y frases fijas (de la más larga a la más corta)
  const tpl = [], plain = [];
  for (const k in DATA) {
    if (k.includes('{x}')) {
      const lit = k.replace(/\{x\}/g, '').trim();
      if (lit.length < 2) continue;
      tpl.push({ k, re: new RegExp('^' + k.split('{x}').map(esc).join('([\\s\\S]+?)') + '$', 'u') });
    } else plain.push(k);
  }
  tpl.sort((a, b) => b.k.length - a.k.length);
  plain.sort((a, b) => b.length - a.length);
  const frag = plain.length ? new RegExp(L + '(' + plain.map(esc).join('|') + ')' + R, 'gu') : null;
  const cache = new Map();
  function tr(k) { const v = DATA[k]; return v && v[IDX[lang]] != null ? v[IDX[lang]] : null; }
  function translate(s, depth) {
    if (lang === 'es' || !s) return s;
    const m0 = /^(\s*)([\s\S]*?)(\s*)$/.exec(s), pre = m0[1], core = m0[2], post = m0[3];
    if (!core || !/\p{L}/u.test(core)) return s;
    if (!depth && cache.has(core)) return pre + cache.get(core) + post;
    let out = tr(core);
    if (out == null) {
      for (const t of tpl) {
        const m = t.re.exec(core);
        if (!m) continue;
        let i = 1; const parts = m.slice(1).map(p => translate(p, (depth || 0) + 1));
        const target = tr(t.k);
        if (target == null) continue;
        out = target.replace(/\{x\}/g, () => parts[i++ - 1]);
        break;
      }
    }
    // textos compuestos «a · b · c»: cada trozo por separado
    if (out == null && core.includes(' · ')) out = core.split(' · ').map(p => translate(p, (depth || 0) + 1)).join(' · ');
    if (out == null && frag) out = core.replace(frag, w => tr(w) ?? w);
    if (!depth) { if (cache.size > 4000) cache.clear(); cache.set(core, out); }
    return pre + out + post;
  }
  const ATTRS = ['aria-label', 'title', 'placeholder'];
  function doNode(n) {
    if (n.nodeType === 3) {
      const p = n.parentNode; if (!p || p.nodeName === 'SCRIPT' || p.nodeName === 'STYLE') return;
      if (n.nodeValue !== n.__tr) n.__es = n.nodeValue;          // texto nuevo puesto por el juego (en español)
      const v = translate(n.__es);
      n.__tr = v; if (n.nodeValue !== v) n.nodeValue = v;
    } else if (n.nodeType === 1) {
      if (n.nodeName === 'SCRIPT' || n.nodeName === 'STYLE') return;
      for (const a of ATTRS) {
        if (!n.hasAttribute(a)) continue;
        const cur = n.getAttribute(a), key = '__es_' + a;
        if (cur !== n['__tr_' + a]) n[key] = cur;
        const v = translate(n[key]); n['__tr_' + a] = v; if (cur !== v) n.setAttribute(a, v);
      }
      for (let c = n.firstChild; c; c = c.nextSibling) doNode(c);
    }
  }
  let busy = false;
  const obs = new MutationObserver(list => {
    if (busy || lang === 'es') return;
    busy = true;
    for (const m of list) {
      if (m.type === 'characterData') { if (m.target.nodeValue !== m.target.__tr) doNode(m.target); }
      else if (m.type === 'attributes') doNode(m.target);
      else for (const n of m.addedNodes) doNode(n);
    }
    obs.takeRecords(); busy = false;
  });
  function start() {
    if (lang !== 'es') doNode(document.body);
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    document.documentElement.lang = lang;
  }
  function set(code) {
    if (!LANGS.some(l => l.code === code)) return;
    const prev = lang; lang = code; cache.clear();
    try { localStorage.setItem(KEY, code); } catch (e) { /* nada */ }
    document.documentElement.lang = code;
    if (prev !== code) { busy = true; doNode(document.body); obs.takeRecords(); busy = false; }
  }
  // idioma del móvil, para proponerlo la primera vez
  function guess() { const n = ((navigator.languages && navigator.languages[0]) || navigator.language || 'es').slice(0, 2).toLowerCase(); return LANGS.some(l => l.code === n) ? n : 'en'; }
  function chosen() { try { return !!localStorage.getItem(KEY); } catch (e) { return true; } }
  window.I18N = { LANGS, get lang() { return lang; }, set, t: s => translate(s), start, guess, chosen };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
