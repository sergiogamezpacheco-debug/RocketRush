# Sonda de rendimiento: mide, por fases, el tiempo de física, de la escena (JS) y del pintado, los shaders que se compilan
# durante la partida (tirones la primera vez que aparece algo) y la basura que se genera (pausas del recolector).
# Uso: python3 tools/perfprobe.py [nivel ...]
import sys, json
from playwright.sync_api import sync_playwright
LV = [int(x) for x in sys.argv[1:]] or [1, 9, 25]
PROBE = r"""() => {
  const R = ChromaGame.renderer, G = ChromaGame.G; const P = window.__P = { phases: [] };
  const origRender = R.render.bind(R); P.r = 0; R.render = (s, c) => { const t = performance.now(); origRender(s, c); P.r += performance.now() - t; };
  P.mark = name => { P.cur = { name, n: 0, sim: [], all: [], rend: [], prog0: R.info.programs.length, geo0: R.info.memory.geometries, tex0: R.info.memory.textures, heap: [], alloc: 0, gcs: 0, last: performance.memory.usedJSHeapSize }; P.phases.push(P.cur); };
  P.run = (n, dt) => {
    for (let i = 0; i < n; i++) {
      const sim = G.sim, cur = P.cur;
      let ts = 0; if (sim && !sim.__w) { const u = sim.update.bind(sim); sim.update = d => { const t = performance.now(); u(d); P.s += performance.now() - t; }; sim.__w = 1; }
      P.s = 0; P.r = 0; const t = performance.now();
      ChromaGame.tick(dt);
      const all = performance.now() - t; cur.all.push(all); cur.sim.push(P.s); cur.rend.push(P.r); cur.n++;
      const h = performance.memory.usedJSHeapSize; if (h < cur.last) cur.gcs++; else cur.alloc += h - cur.last; cur.last = h;
    }
  };
  P.end = () => { const c = P.cur, st = a => { const s = [...a].sort((x, y) => x - y); return { avg: +(a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)).toFixed(2), p95: +(s[Math.floor(s.length * 0.95)] || 0).toFixed(1), max: +(s[s.length - 1] || 0).toFixed(1) }; };
    return { fase: c.name, frames: c.n, total: st(c.all), fisica: st(c.sim), pintado: st(c.rend), escena: st(c.all.map((a, i) => a - c.sim[i] - c.rend[i])),
      shadersNuevos: R.info.programs.length - c.prog0, geometriasNuevas: R.info.memory.geometries - c.geo0, texturasNuevas: R.info.memory.textures - c.tex0,
      basuraMB_s: +(c.alloc / 1048576 / (c.n / 60)).toFixed(2), gcs: c.gcs, llamadas: R.info.render.calls, triangulos: R.info.render.triangles }; };
}"""
def ev(pg, js): return pg.evaluate(js)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--js-flags=--expose-gc'])
    pg = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True).new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script("window.RR_AGE = 30; localStorage.setItem('rocketrush.lang','es'); if(!sessionStorage.g){sessionStorage.g=1;localStorage.setItem('chromacrash3d.v1', JSON.stringify({unlocked: 60, played: 30, birthYear: 1990, tut: {main: true, tips: {daily: 1}}}))}")
    t0 = __import__('time').time(); pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2500)
    ev(pg, "() => ChromaGame.manual(true)"); ev(pg, PROBE)
    out = []
    def pr(o): print(f"{o['fase']:<34} fr {o['frames']:>4} | total {o['total']['avg']:>6}/{o['total']['p95']:>6}/{o['total']['max']:>7} | física {o['fisica']['avg']:>5}/{o['fisica']['max']:>6} | escena {o['escena']['avg']:>5}/{o['escena']['max']:>6} | pintado {o['pintado']['avg']:>6}/{o['pintado']['max']:>7} | shaders+{o['shadersNuevos']} geo+{o['geometriasNuevas']} tex+{o['texturasNuevas']} | basura {o['basuraMB_s']} MB/s gc {o['gcs']} | dc {o['llamadas']} tri {o['triangulos']}", flush=True)
    def phase(name, n, dt=1/60, before=None):
        if before: ev(pg, before)
        ev(pg, f"() => __P.mark({json.dumps(name)})"); ev(pg, f"() => __P.run({n}, {dt})"); out.append(ev(pg, "() => __P.end()")); pr(out[-1])
    phase('portada', 60)
    def shoot():
        pos = ev(pg, """() => { const s=ChromaGame.G.sim, k=s.queue[0]; const live=s.liveBlocks(); if(!live.length) return null; const b=live.find(x=>x.userData.c===k)||live[0];
           const v=b.position.clone ? b.position.clone() : null; const w=new RRGame.hw.THREE.Vector3(b.position.x,b.position.y,b.position.z).project(ChromaGame.camera); return [(w.x*0.5+0.5)*innerWidth, (-w.y*0.5+0.5)*innerHeight]; }""")
        if pos: pg.mouse.click(pos[0], pos[1])
    for lv in LV:
        phase(f'nivel {lv}: carga', 1, 1/60, f"() => {{ document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel({lv}, []); }}")
        phase(f'nivel {lv}: intro', 60)
        ev(pg, "() => __P.mark('nivel %d: disparos y derrumbes')" % lv)
        for i in range(6):
            if ev(pg, "() => ChromaGame.G.sim.state !== 'play'"): break
            if ev(pg, "() => ChromaGame.G.sim.canFire()"): shoot()
            ev(pg, "() => __P.run(45, 1/60)")
        out.append(ev(pg, "() => __P.end()")); pr(out[-1])
        phase(f'nivel {lv}: final', 90)
    print('errores', errs[:5]); b.close()
