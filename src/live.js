// Rocket Rush — configuración en directo (la que se cambia desde el panel de administración).
// Un solo documento público de Firestore, config/live, con un campo «data» que es un JSON:
//   hw: { on, start, end }                         evento de Halloween (fechas en milisegundos)
//   boosts: [{ id, kind: coins|xp|candy, mult, start, end, title }]   bonificaciones temporales (x2 monedas…)
//   news: [{ id, title, body, start, end, tr: { en: {title, body}, … } }]   avisos que salen una vez en la portada
//   gifts: [{ id, title, coins, gems, bomb, rainbow, golden, start, end }]  regalo para todos (una vez por jugador)
//   ads: { from, gapMin, off }                     anuncios entre niveles: desde qué nivel y cada cuántos minutos
//   maint: { on, msg }                             aviso de mantenimiento (las funciones en línea se pausan)
//   update: { min, force, msg }                    versión mínima (número de compilación): pide actualizar
// Se lee sin cuenta y se guarda en el móvil: sin conexión se usa la última que llegó.
(function () {
  'use strict';
  const KEY = 'rocketrush.live';
  const URL = 'https://firestore.googleapis.com/v1/projects/rocket-rush-7297c/databases/' + (window.RR_FS_DB || '(default)') +
    '/documents/config/live?key=AIzaSyC9Rbs2qrzJaSugbHCjOTpuH_QQZKw8DNc';
  let cfg = {};
  try { cfg = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { cfg = {}; }
  const subs = [];
  let last = 0;
  function set(c) {
    cfg = c && typeof c === 'object' ? c : {};
    try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* sin almacenamiento */ }
    for (const f of subs) { try { f(cfg); } catch (e) { /* nada */ } }
  }
  async function refresh() {
    if (window.RR_LIVE_OFF) return;               // pruebas sin red
    last = Date.now();
    try {
      const r = await fetch(URL, { cache: 'no-store' });
      if (r.status === 404) { set({}); return; }
      if (!r.ok) return;
      const j = await r.json();
      const s = j && j.fields && j.fields.data && j.fields.data.stringValue;
      set(s ? JSON.parse(s) : {});
    } catch (e) { /* sin conexión: sigue la última */ }
  }
  // al volver al juego, si han pasado más de 5 minutos, se mira si hay cambios
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - last > 300000) refresh(); });
  setInterval(() => { if (!document.hidden) refresh(); }, 900000);
  const now = () => Date.now();
  const inWin = o => !!o && (!o.start || now() >= o.start) && (!o.end || now() < o.end);
  window.Live = {
    get cfg() { return cfg; },
    on(f) { subs.push(f); },
    refresh, set, inWin,
    // multiplicador activo de un tipo (si hay varios a la vez, se multiplican; como mucho x5)
    mult(kind) { let m = 1; for (const b of cfg.boosts || []) if (b && b.kind === kind && inWin(b)) m *= Math.max(1, +b.mult || 1); return Math.min(5, m); },
    boosts() { return (cfg.boosts || []).filter(b => b && inWin(b) && (+b.mult || 1) > 1); },
  };
  refresh();
})();
