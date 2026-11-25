# 25-11: avisos del móvil. Se simula el puente de Android y se mira qué avisos se programan y a qué hora.
from playwright.sync_api import sync_playwright
errs=[]; ok=[]
def chk(n, c, x=''): ok.append(bool(c)); print('OK ' if c else 'MAL', n, x)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    pg=b.new_context(viewport={'width':390,'height':844}).new_page(); pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.add_init_script("""window.RR_AGE = 30; window.RR_LIVE_OFF = true; window.RR_NO_INTRO = true; window.__N = {}; window.__C = [];
      window.ChromaAndroid = { scheduleNotice: (k, at, t, x) => { window.__N[k] = { at: +at, t, x }; }, cancelNotice: k => { delete window.__N[k]; window.__C.push(k); }, scheduleReminder: () => {}, cancelReminder: () => {} };
      localStorage.setItem('rocketrush.lang','es'); localStorage.setItem('chromacrash3d.v1', JSON.stringify({unlocked: 60, played: 30, birthYear: 1990, club: {cid: 'abc'}, tut: {main: true, tips: {daily: 1, club: 1, shop: 1}}}))""")
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(3500)
    n=pg.evaluate("() => { Retencion.notices.sync(); const o = {}; for (const k in window.__N) o[k] = [new Date(window.__N[k].at).toString().slice(0, 21), window.__N[k].t]; return o; }")
    for k,v in n.items(): print('   ', k, v)
    for k in ['evento','eventofin','desafio','tienda','club','pase','vuelve','mini']: chk('programado: ' + k, k in n)
    chk('Navidad empieza el 27 a las 11:00', 'evento' in n and 'Nov 27 2026 11:00' in n['evento'][0], n.get('evento'))
    chk('desafío un lunes a las 10:00', 'desafio' in n and n['desafio'][0].startswith('Mon') and '10:00' in n['desafio'][0])
    chk('te echamos de menos dentro de 3 días a las 18:00', 'vuelve' in n and '18:00' in n['vuelve'][0])
    # avisos apagados en Ajustes: se cancelan todos
    pg.evaluate("() => { RRGame.save.daily.notif = false; Retencion.notices.sync(); }")
    chk('con los avisos apagados no queda ninguno', pg.evaluate("() => Object.keys(window.__N).filter(k => k !== 'cofre').length") == 0)
    b.close()
print('errores', errs[:3]); print('TODO BIEN' if all(ok) and not errs else 'FALLOS')
