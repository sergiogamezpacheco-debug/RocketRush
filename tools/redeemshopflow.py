# Canjear código desde la tienda: tarjeta arriba de Ofertas y pestaña «Código» (con Social.redeem simulado)
from playwright.sync_api import sync_playwright
OUT='/home/claude/chroma3d/dist/shots/'; errs=[]; ok=[]
def chk(name, cond, extra=''): ok.append(bool(cond)); print('OK ' if cond else 'MAL', name, extra)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    pg=b.new_context(viewport={'width':390,'height':844},device_scale_factor=1).new_page(); pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.add_init_script("window.RR_AGE = 30; window.RR_LIVE_OFF = true; window.RR_NO_INTRO = true; localStorage.setItem('rocketrush.lang','es'); localStorage.setItem('chromacrash3d.v1', JSON.stringify({unlocked: 60, played: 30, birthYear: 1990, coins: 4200, gems: 35, tut: {main: true, tips: {daily: 1, club: 1, shop: 1}}}))")
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(3000)
    pg.evaluate("""() => { window.Social = window.Social || {}; window.Social.redeem = async c => { if (c === 'ROCKET2026') return { gems: 10, bomb: 1 }; const e = new Error('x'); e.code = 'NOT_FOUND'; throw e; };
      document.getElementById('daily').classList.remove('on'); RRGame.openShop('code'); }"""); pg.wait_for_timeout(800)
    chk('pestaña Código', pg.evaluate("() => !!document.querySelector('#shopTabs button[data-to=sRedeem]')"))
    chk('tarjeta en Ofertas', pg.evaluate("() => { const c = document.getElementById('sRedeem'), o = document.getElementById('sOff'); return !!c && c.previousElementSibling === o; }"))
    pg.screenshot(path=OUT+'redeem_shop1.png', timeout=90000)
    pg.fill('#shCode', 'nope1'); pg.evaluate("() => document.getElementById('shRedeem').click()"); pg.wait_for_timeout(400)
    chk('código que no existe', 'no existe' in pg.inner_text('#shMsg'), pg.inner_text('#shMsg'))
    g0 = pg.evaluate("() => RRGame.save.gems")
    pg.fill('#shCode', 'rocket-2026'); pg.press('#shCode', 'Enter'); pg.wait_for_function("() => /canjeado/.test(document.getElementById('shMsg').textContent)", timeout=15000)
    msg = pg.inner_text('#shMsg'); pg.screenshot(path=OUT+'redeem_shop2.png', timeout=90000)
    chk('canjeado', 'canjeado' in msg and pg.evaluate("() => RRGame.save.gems") == g0 + 10, msg)
    pg.evaluate("() => { const L = document.getElementById('shopList').scrollTop; RRGame.openShop(); }"); pg.wait_for_timeout(400)
    pg.fill('#shCode', 'ROCKET2026'); pg.evaluate("() => document.getElementById('shRedeem').click()"); pg.wait_for_timeout(600)
    chk('no se canjea dos veces', 'Ya has canjeado' in pg.inner_text('#shMsg'), pg.inner_text('#shMsg'))
    chk('la tienda sigue abierta', pg.evaluate("() => document.getElementById('shop').classList.contains('on')"))
    # menor de 13: no sale
    pg.evaluate("() => { RRGame.save.kid = true; RRGame.openShop(); }"); pg.wait_for_timeout(300)
    chk('menores sin código', pg.evaluate("() => !document.getElementById('sRedeem')"))
    b.close()
print('errores', errs[:3]); print('TODO BIEN' if all(ok) and not errs else 'FALLOS')
