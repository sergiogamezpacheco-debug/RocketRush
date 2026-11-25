// Rocket Rush — compartir la mejor jugada (25-11).
// Durante la partida se guarda una foto del mejor combo del nivel y, si el móvil puede, un vídeo corto de ese tiro
// (unos segundos, con el logo y el nivel encima). Al ganar, si ha habido un buen combo o 3 estrellas, sale el botón
// «Compartir jugada»: se ve la jugada y se comparte por WhatsApp, Instagram… (Android/iOS: ChromaAndroid.shareFile).
// game3d.js llama a: Jugada.reset() al empezar un nivel, Jugada.shoot(L) en cada disparo, Jugada.combo(n) en cada paso
// del combo, Jugada.frame(canvas) después de pintar (solo si Jugada.busy) y Jugada.winUi(L, estrellas) al ganar.
(function () {
  'use strict';
  const X = () => window.RRGame;
  const T = s => (window.I18N ? I18N.t(s) : s);
  const $ = id => document.getElementById(id);
  const PLAY = 'https://play.google.com/store/apps/details?id=com.lostanarchygames.rocketrush';
  const MIN_COMBO = 5;                 // a partir de aquí la jugada se guarda
  const VW = 540, VH = 960;            // vídeo vertical
  const IW = 1080, IH = 1350;          // imagen 4:5 (la que mejor se ve en redes)

  const recOn = () => { const s = X() && X().save; return !(s && s.rec === false); };
  const canRec = () => typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream && (!navigator.webdriver || !!window.RR_REC_TEST);
  const pickMime = () => {
    for (const m of ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'])
      try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) { /* nada */ }
    return '';
  };

  let best = null;        // { combo, img: canvas, vid: { blob, mime } | null, level }
  let shot = null;        // tiro en curso: { combo, rec, chunks, mime, stopAt, level }
  let snapWant = 0;       // combo para el que hay que hacer la foto en el siguiente fotograma
  let comp = null, cctx = null;

  function reset() { stopRec(true); best = null; shot = null; snapWant = 0; }

  function label(L) { return L ? (L.club ? T('Club') : L.xm ? T('Navidad') + ' ' + (L.pos || '') : L.hw ? 'Halloween ' + (L.pos || '') : T('Nivel') + ' ' + L.id) : ''; }

  // ---- vídeo ----
  function startRec(L) {
    if (!recOn() || !canRec()) return;
    const mime = pickMime(); if (!mime) return;
    if (!comp) { comp = document.createElement('canvas'); comp.width = VW; comp.height = VH; cctx = comp.getContext('2d'); }
    try {
      const stream = comp.captureStream(30);
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1800000 });
      const s = { combo: 0, rec, chunks: [], mime, stopAt: performance.now() + 3500, hardStop: performance.now() + 7000, level: L };
      rec.ondataavailable = e => { if (e.data && e.data.size) s.chunks.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        if (s.dropped || s.combo < MIN_COMBO || !s.chunks.length) return;
        if (best && s.combo >= best.combo) best.vid = { blob: new Blob(s.chunks, { type: s.mime.split(';')[0] }), mime: s.mime.split(';')[0] };
      };
      rec.start(250);
      shot = s; drawFrame(null);
    } catch (e) { shot = null; }
  }
  function stopRec(drop) {
    if (!shot) return;
    const s = shot; shot = null; s.dropped = !!drop;
    try { if (s.rec.state !== 'inactive') s.rec.stop(); } catch (e) { /* nada */ }
  }
  function cover(ctx, src, w, h) {
    const sw = src.width, sh = src.height; if (!sw || !sh) return;
    const k = Math.max(w / sw, h / sh), dw = sw * k, dh = sh * k;
    ctx.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }
  function brand(ctx, w, h, L, combo, big) {
    const u = w / 540;
    // arriba: logo
    ctx.save();
    ctx.font = `900 ${Math.round(34 * u)}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.lineWidth = 8 * u; ctx.strokeStyle = '#2a1660'; ctx.fillStyle = '#ffd23f';
    ctx.strokeText('ROCKET RUSH', w / 2, 52 * u); ctx.fillText('ROCKET RUSH', w / 2, 52 * u);
    // abajo: nivel y combo
    const g = ctx.createLinearGradient(0, h - 170 * u, 0, h); g.addColorStop(0, 'rgba(26,10,60,0)'); g.addColorStop(1, 'rgba(26,10,60,.85)');
    ctx.fillStyle = g; ctx.fillRect(0, h - 170 * u, w, 170 * u);
    ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(24 * u)}px Arial, sans-serif`; ctx.fillText(label(L), w / 2, h - (big ? 92 : 62) * u);
    if (combo >= MIN_COMBO) { ctx.font = `900 ${Math.round(40 * u)}px Arial, sans-serif`; ctx.lineWidth = 7 * u; ctx.strokeStyle = '#2a1660'; ctx.fillStyle = '#7dffb0';
      const t = T('¡COMBO ×{x}!').replace('{x}', combo); ctx.strokeText(t, w / 2, h - (big ? 40 : 18) * u - 6 * u); ctx.fillText(t, w / 2, h - (big ? 40 : 18) * u - 6 * u); }
    ctx.restore();
  }
  function drawFrame(gl) {
    if (!shot || !cctx) return;
    cctx.fillStyle = '#2a1660'; cctx.fillRect(0, 0, VW, VH);
    if (gl) cover(cctx, gl, VW, VH);
    brand(cctx, VW, VH, shot.level, shot.combo, false);
  }

  // ---- foto ----
  function snap(gl) {
    const c = document.createElement('canvas'); c.width = IW; c.height = IH; const ctx = c.getContext('2d');
    ctx.fillStyle = '#2a1660'; ctx.fillRect(0, 0, IW, IH);
    cover(ctx, gl, IW, IH);
    return c;
  }
  function finalImage() {
    if (!best || !best.img) return null;
    const c = document.createElement('canvas'); c.width = IW; c.height = IH; const ctx = c.getContext('2d');
    ctx.drawImage(best.img, 0, 0); brand(ctx, IW, IH, best.level, best.combo, true);
    ctx.save(); ctx.font = '700 30px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillText(T('¿Lo superas? Gratis en Google Play'), IW / 2, IH - 22); ctx.restore();
    return c;
  }

  // ---- llamadas desde el juego ----
  let cur = null;   // tiro en curso aunque no se grabe (para la foto)
  function shoot(L) {
    if (shot) stopRec(shot.combo < MIN_COMBO);   // el tiro anterior se guarda solo si fue bueno
    cur = { combo: 0, level: L };
    startRec(L);
  }
  function combo(n) {
    if (cur) cur.combo = n;
    if (shot) { shot.combo = n; shot.stopAt = Math.max(shot.stopAt, performance.now() + 2200); }
    if (n >= MIN_COMBO && (!best || n > best.combo) && (n === MIN_COMBO || n % 3 === 0 || n === 10 || n === 15 || n === 25)) snapWant = n;
  }
  function frame(gl) {
    if (snapWant && gl) {
      try { const img = snap(gl), n = snapWant; if (!best || n > best.combo) best = { combo: n, img, level: cur && cur.level, vid: null }; else if (!best.img) best.img = img; } catch (e) { /* lienzo no legible */ }
      snapWant = 0;
    }
    if (shot) {
      drawFrame(gl);
      const t = performance.now(); if (t >= shot.stopAt || t >= shot.hardStop) stopRec(false);
    }
  }

  // ---- al ganar: botón y ventana para compartir ----
  function winUi(L, stars) {
    const old = $('winShare'); if (old) old.remove();
    stopRec(false);
    const ok = best && best.img && (best.combo >= MIN_COMBO || stars >= 3);
    if (!ok) return;
    const b = document.createElement('button'); b.className = 'btn green'; b.id = 'winShare';
    b.innerHTML = '📤 ' + T('Compartir jugada') + (best.combo >= MIN_COMBO ? ' · ' + T('combo ×{x}').replace('{x}', best.combo) : '');
    const row = document.querySelector('#win .panel .row'); if (!row) return;
    row.parentNode.insertBefore(b, row);
    b.addEventListener('click', ev => { ev.stopPropagation(); try { X().Audio.click(); } catch (e) { /* nada */ } open(); });
  }
  let pop = null;
  function open() {
    const img = finalImage(); if (!img) return;
    // el vídeo puede tardar un instante en cerrarse
    setTimeout(() => show(img), shot ? 400 : 0);
  }
  function show(img) {
    if (!pop) {
      pop = document.createElement('div'); pop.className = 'screen dim'; pop.id = 'jugPop';
      pop.innerHTML = '<div class="panel"><div class="ribbon green">' + T('¡QUÉ JUGADA!') + '</div><div id="jugView"></div><div id="jugBtns"></div><div class="row"><button class="btn gray" id="jugClose">' + T('CERRAR') + '</button></div></div>';
      document.body.appendChild(pop);
      $('jugClose').addEventListener('click', close);
    }
    const v = best.vid, view = $('jugView');
    view.innerHTML = '';
    const url = v ? URL.createObjectURL(v.blob) : null;
    if (v) { const el = document.createElement('video'); el.src = url; el.muted = true; el.loop = true; el.autoplay = true; el.playsInline = true; el.className = 'jugMedia'; view.appendChild(el); el.play().catch(() => {}); }
    else { const im = new Image(); im.src = img.toDataURL('image/jpeg', 0.9); im.className = 'jugMedia'; view.appendChild(im); }
    const bt = $('jugBtns'); bt.innerHTML = '';
    if (v) { const a = document.createElement('button'); a.className = 'btn green'; a.textContent = '🎬 ' + T('Compartir vídeo'); a.addEventListener('click', () => shareBlob(v.blob, v.mime, 'jugada.' + (v.mime.includes('mp4') ? 'mp4' : 'webm'))); bt.appendChild(a); }
    const c = document.createElement('button'); c.className = 'btn ' + (v ? 'purple' : 'green'); c.textContent = '🖼️ ' + T('Compartir imagen');
    c.addEventListener('click', () => img.toBlob(bl => bl && shareBlob(bl, 'image/jpeg', 'jugada.jpg'), 'image/jpeg', 0.9)); bt.appendChild(c);
    pop.classList.add('on');
    pop._url = url;
  }
  function close() { if (!pop) return; pop.classList.remove('on'); const v = pop.querySelector('video'); if (v) v.pause(); if (pop._url) URL.revokeObjectURL(pop._url); pop._url = null; }
  function shareText() { return T('¡Mira mi jugada en Rocket Rush! ¿Lo superas?') + ' ' + PLAY; }
  function shareBlob(blob, mime, name) {
    try { const s = X().stats && X().stats(); if (s) { s.playShares = (s.playShares || 0) + 1; X().persist(); } } catch (e) { /* nada */ }
    const A = window.ChromaAndroid;
    if (A && A.shareFile) {
      const r = new FileReader();
      r.onload = () => { const b64 = String(r.result).split(',')[1] || ''; try { A.shareFile(b64, mime, name, shareText()); } catch (e) { /* nada */ } };
      r.readAsDataURL(blob); return;
    }
    try {
      const f = new File([blob], name, { type: mime });
      if (navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f], text: shareText() }).catch(() => {}); return; }
    } catch (e) { /* sin compartir nativo */ }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  const prevBack = window.ChromaBack;
  window.ChromaBack = () => { if (pop && pop.classList.contains('on')) { close(); return true; } return prevBack ? prevBack() : false; };

  window.Jugada = {
    reset, shoot, combo, frame, winUi,
    get busy() { return !!shot || !!snapWant; },
    get best() { return best; },
    canRec: () => canRec() && !!pickMime(),
    close, isOpen: () => !!(pop && pop.classList.contains('on')),
  };
})();
