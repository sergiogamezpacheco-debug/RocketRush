# Navidad adelantada solo en la app de pruebas: con `build.js --xm-pruebas` el evento está activo hoy; sin él (Play, iOS,
# artefacto) solo la cuenta atrás. Compila las dos versiones, comprueba y deja dist/ con la normal.
import subprocess
from playwright.sync_api import sync_playwright
ok=[]; errs=[]
def run(flag):
    subprocess.run(['node','tools/build.js']+([flag] if flag else []), check=True, capture_output=True)
    with sync_playwright() as p:
        b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=b.new_context(viewport={'width':390,'height':844}).new_page(); pg.on('pageerror',lambda e: errs.append(str(e)))
        pg.add_init_script("window.RR_AGE = 30; window.RR_LIVE_OFF = true; window.RR_NO_INTRO = true; localStorage.setItem('rocketrush.lang','es'); localStorage.setItem('chromacrash3d.v1', JSON.stringify({unlocked: 30, played: 30, birthYear: 1990, tut: {main: true, tips: {daily:1,club:1,shop:1}}}))")
        pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(3000)
        r=pg.evaluate("() => { const nb=document.getElementById('navXm'), tp=document.getElementById('xmTree'); return { mundo: !!nb && !nb.hidden, arbol: !!tp && !tp.hidden, cuenta: (document.querySelector('.xmcdTxt')||{}).textContent||'' }; }")
        b.close(); return r
a=run('--xm-pruebas'); print('app de pruebas:', a); ok.append(a['mundo'])
c=run('--release'); print('Google Play:', c); ok.append(not c['mundo'])
n=run(None); print('normal (iOS, artefacto):', n); ok.append(not n['mundo'])
print('errores', errs[:3]); print('TODO BIEN' if all(ok) and not errs else 'FALLOS')
