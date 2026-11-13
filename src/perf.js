// Rocket Rush — precarga para que el juego vaya fluido desde el primer disparo.
// La primera vez que se dibuja un material, el móvil tiene que compilar su «shader» (el programa de la tarjeta gráfica):
// eso tarda de 20 a 150 ms por material y se notaba como un tirón justo al disparar, al explotar algo, al salir un
// pájaro o al usar una bola especial por primera vez. Aquí se apuntan todos los materiales que el juego crea al arrancar
// y, mientras se ve el logo del estudio, se compilan todos de golpe (y se suben sus texturas a la tarjeta gráfica).
(function () {
  'use strict';
  const T = window.THREE; if (!T) return;
  const REG = []; let rec = true;
  // cada clase de material se sustituye por una igual que, además, se apunta en la lista (solo durante el arranque)
  for (const k of Object.keys(T)) {
    const C = T[k];
    if (typeof C !== 'function' || !/Material$/.test(k) || !(C.prototype instanceof T.Material)) continue;
    const W = class extends C { constructor(...a) { super(...a); if (rec) REG.push(this); } };
    Object.defineProperty(W, 'name', { value: C.name });
    T[k] = W;
  }
  const MAPS = ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'aoMap', 'bumpMap', 'clearcoatNormalMap', 'sheenColorMap', 'specularMap', 'gradientMap', 'matcap', 'lightMap', 'displacementMap'];
  // una pieza de muestra por material (el tipo de objeto también cuenta para el shader: malla, sprite, puntos o líneas)
  function sampleGroup(extra) {
    const g = new T.Group(), box = new T.BoxGeometry(0.1, 0.1, 0.1), pts = new T.BufferGeometry(), line = new T.BufferGeometry();
    pts.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, 0.1, 0, 0], 3));
    line.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, 0.1, 0, 0], 3));
    const seen = new Set();
    for (const m of REG.concat(extra || [])) {
      if (!m || seen.has(m) || m.isMeshDepthMaterial || m.isMeshDistanceMaterial || m.isShadowMaterial) continue;
      seen.add(m);
      if (m.type === 'RawShaderMaterial' || (m.isShaderMaterial && m.name && /PMREM/i.test(m.name))) continue;
      const o = m.isSpriteMaterial ? new T.Sprite(m) : m.isPointsMaterial ? new T.Points(pts, m) : m.isLineBasicMaterial ? new T.LineSegments(line, m) : new T.Mesh(box, m);
      o.castShadow = false; o.receiveShadow = true; o.frustumCulled = false;
      g.add(o);
    }
    return g;
  }
  // texturas a la tarjeta gráfica ya (si no, la primera vez que se ven se suben en mitad de la partida)
  function uploadTextures(renderer, group) {
    const done = new Set();
    group.traverse(o => { const m = o.material; if (!m) return; for (const k of MAPS) { const t = m[k]; if (t && t.isTexture && !done.has(t) && t.image) { done.add(t); try { renderer.initTexture(t); } catch (e) { /* nada */ } } } });
    return done.size;
  }
  // compila todo; devuelve una promesa que se cumple cuando los shaders están listos (o como mucho a los «max» ms)
  function warm(renderer, scene, camera, extraObjects, max) {
    rec = false;
    const t0 = performance.now();
    const g = sampleGroup();
    for (const o of extraObjects || []) if (o) g.add(o);
    const tex = uploadTextures(renderer, g);
    const progs0 = renderer.info.programs ? renderer.info.programs.length : 0;
    let p;
    try { p = renderer.compileAsync ? renderer.compileAsync(g, camera, scene) : Promise.resolve(renderer.compile(g, camera, scene)); }
    catch (e) { p = Promise.resolve(); }
    REG.length = 0;
    const stats = { materials: g.children.length, textures: tex };
    const done = p.then(() => { stats.ms = Math.round(performance.now() - t0); stats.programs = (renderer.info.programs ? renderer.info.programs.length : 0) - progs0; window.RR_WARM = stats; return stats; }).catch(() => stats);
    // la muestra se guarda (sin dibujar): si se borrara, three.js liberaría los shaders que acabamos de compilar
    window.RR_WARM_KEEP = g;
    return Promise.race([done, new Promise(r => setTimeout(() => r(stats), max || 5000))]);
  }
  // un trozo de escena ya montado (por ejemplo un paisaje oculto): texturas a la tarjeta gráfica y shaders compilados
  function prime(renderer, obj, scene, camera) {
    try { uploadTextures(renderer, obj); } catch (e) { /* nada */ }
    try { return renderer.compileAsync ? renderer.compileAsync(obj, camera, scene) : Promise.resolve(renderer.compile(obj, camera, scene)); } catch (e) { return Promise.resolve(); }
  }
  window.Perf = { warm, prime, sampleGroup, stop() { rec = false; REG.length = 0; }, get count() { return REG.length; } };
})();
