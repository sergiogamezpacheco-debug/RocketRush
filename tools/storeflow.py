# Preparación para Google Play: pregunta de edad (la primera vez), panel de privacidad y ayuda, borrar la cuenta en línea
# (con Firebase simulado), funciones en línea apagadas, menos destellos, gráficos en ahorro, tienda con precios de Play
# (puente de Android simulado: consulta, compra, entrega y confirmación), restaurar compras, intersticial real y márgenes
# de la muesca que manda Android.
import json
from playwright.sync_api import sync_playwright
OUT = '/home/claude/chroma3d/dist/shots/'
BRIDGE = r"""
window.__calls = [];
window.ChromaAndroid = {
  vibrate(){}, scheduleReminder(){}, cancelReminder(){}, share(){}, askNotifications(){}, version(){ return '1.0.99'; },
  openUrl(u){ __calls.push(['url', u]); },
  billingQuery(ids){ __calls.push(['query', ids]); setTimeout(() => onBilling({type:'products', items: JSON.parse(ids).map(id => ({id, price: id === 'g1' ? '1,09 €' : 'US$9.99'}))}), 50); },
  billingBuy(id){ __calls.push(['buy', id]); setTimeout(() => onBilling({type:'purchase', id, token:'tok-' + id}), 50); },
  billingFinish(t, c){ __calls.push(['finish', t, c]); },
  billingRestore(){},
  adsInit(age){ __calls.push(['adsInit', age]); },
  showRewarded(){ __calls.push(['rewarded']); setTimeout(() => onChromaReward(true), 50); },
  showInterstitial(){ __calls.push(['inter']); setTimeout(() => onChromaInterstitial(), 50); },
  adsPrivacyRequired(){ return true; }, adsPrivacyOptions(){ __calls.push(['privacy']); },
};
"""
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script("window.RR_LIVE_OFF = true; window.RR_REAL_PAY = true; localStorage.setItem('rocketrush.lang','es');" + BRIDGE)
    # Firebase simulado: cuenta anónima y borrados
    hits = []
    def fb(route):
        u = route.request.url; m = route.request.method; hits.append((m, u.split('?')[0].split('/v1/')[-1]))
        if 'accounts:signUp' in u: return route.fulfill(json={'localId': 'U1', 'idToken': 'T', 'refreshToken': 'R', 'expiresIn': '3600'})
        if 'accounts:delete' in u: return route.fulfill(json={})
        if ':runQuery' in u: return route.fulfill(json=[{'document': {'name': 'projects/x/databases/(default)/documents/friendships/A_U1', 'fields': {'a': {'stringValue': 'A'}, 'b': {'stringValue': 'U1'}, 'status': {'stringValue': 'accepted'}}}}])
        if '/codes/' in u and m == 'GET': return route.fulfill(json={'name': 'projects/x/databases/(default)/documents/codes/C', 'fields': {'uid': {'stringValue': 'U1'}}})
        return route.fulfill(json={})
    pg.route('**/*googleapis.com/**', fb)
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2500)
    pg.evaluate("() => ChromaGame.manual(true)")   # sin bucle de dibujo: los temporizadores van a su hora
    print('pregunta de edad:', pg.evaluate("() => [!document.getElementById('ageGate').hidden, document.getElementById('agOk').disabled, document.querySelectorAll('#agYear option').length]"))
    pg.screenshot(path=OUT + 'store_age.png')
    pg.select_option('#agYear', str(2026 - 11)); pg.click('#agOk'); pg.wait_for_timeout(300)
    print('menor de 13:', pg.evaluate("() => [ChromaGame.save().kid, document.getElementById('ageGate').hidden]"), 'adsInit', [c for c in pg.evaluate("() => __calls") if c[0] == 'adsInit'])
    # en línea bloqueado para menores
    pg.evaluate("() => { RRGame.save.kid = true; }")
    print('social (menor):', pg.evaluate("async () => { try { await Social.redeem('ABCD'); return 'pasó'; } catch (e) { return e.status + ' ' + e.code; } }"))
    pg.evaluate("() => { const s = ChromaGame.save(); s.kid = false; s.birthYear = 1990; }")
    # privacidad
    pg.evaluate("() => { document.getElementById('daily').classList.remove('on'); document.getElementById('btnSetT').click(); }"); pg.wait_for_timeout(300)
    pg.screenshot(path=OUT + 'store_settings.png')
    pg.click('#sPriv'); pg.wait_for_timeout(300)
    print('privacidad:', pg.evaluate("() => [document.getElementById('privacy').classList.contains('on'), !document.getElementById('pAds').hidden, document.getElementById('pOnline').textContent, document.getElementById('pId').textContent]"))
    pg.screenshot(path=OUT + 'store_privacy.png')
    for bid in ('pPolicy', 'pTerms', 'pAds', 'pSupport'): pg.click('#' + bid); pg.wait_for_timeout(100)
    calls = pg.evaluate("() => __calls")
    print('enlaces:', [c[1][:60] if c[0] == 'url' else c[0] for c in calls if c[0] in ('url', 'privacy')])
    # borrar cuenta: primero se crea (sync) y luego se borra
    pg.evaluate("async () => { await Social.sync(); }"); pg.wait_for_timeout(300)
    print('cuenta creada:', pg.evaluate("() => Social.hasAccount"))
    hits.clear()
    pg.click('#pDelete'); pg.wait_for_timeout(100); print('aviso:', pg.evaluate("() => document.getElementById('pDelNote').textContent"))
    pg.click('#pDelete'); pg.wait_for_function("() => !document.getElementById('pDelete').disabled", timeout=15000)
    print('borrado:', [h for h in hits if h[0] in ('DELETE', 'POST')])
    print('después:', pg.evaluate("() => [Social.hasAccount, ChromaGame.save().noOnline, document.getElementById('pOnline').textContent, document.getElementById('pDelNote').textContent]"))
    pg.screenshot(path=OUT + 'store_deleted.png')
    hits.clear(); pg.evaluate("async () => { await Social.sync(); }"); pg.wait_for_timeout(300)
    print('sin llamadas con en línea apagado:', len(hits))
    pg.click('#pOnline'); print('encendido:', pg.evaluate("() => [ChromaGame.save().noOnline, document.getElementById('pOnline').textContent]"))
    # créditos
    pg.click('#pCredits'); pg.wait_for_timeout(300)
    print('créditos:', pg.evaluate("() => [document.getElementById('liveBox').classList.contains('on'), document.querySelector('.credits').textContent.includes('three.js')]"))
    pg.screenshot(path=OUT + 'store_credits.png')
    pg.evaluate("() => document.getElementById('liveBox').classList.remove('on')")
    # accesibilidad
    pg.evaluate("() => { document.getElementById('privacy').classList.remove('on'); document.getElementById('btnSetT').click(); }")
    pg.click('#sCalm'); pg.click('#sGfx')
    print('destellos/gráficos:', pg.evaluate("() => [ChromaGame.save().calm, ChromaGame.save().lowGfx, ChromaGame.renderer.getPixelRatio(), ChromaGame.renderer.shadowMap.enabled, document.getElementById('sCalm').textContent, document.getElementById('sGfx').textContent]"))
    pg.click('#sGfx'); print('gráficos altos otra vez:', pg.evaluate("() => [ChromaGame.renderer.shadowMap.enabled]"))
    pg.click('#sClose')
    # tienda con precios de Play
    pg.evaluate("() => RRGame.openShop()"); pg.wait_for_timeout(400)
    print('precios:', pg.evaluate("() => [document.querySelector('[data-id=g1]').textContent, document.querySelector('[data-id=starter]').textContent, document.getElementById('shopNote').textContent]"))
    pg.screenshot(path=OUT + 'store_shop.png')
    g0 = pg.evaluate("() => ChromaGame.save().gems || 0")
    pg.click('[data-id=g1]'); pg.wait_for_timeout(400)
    print('compra g1:', g0, '->', pg.evaluate("() => ChromaGame.save().gems"), [c for c in pg.evaluate("() => __calls") if c[0] in ('buy', 'finish')])
    pg.evaluate("() => onBilling({type:'purchase', id:'g1', token:'tok-g1'})"); pg.wait_for_timeout(100)
    print('misma compra repetida no da dos veces:', pg.evaluate("() => ChromaGame.save().gems"))
    # los puñados de 0,99 € no quitan los anuncios; cualquier cofre o pack sí (ya no hay botón «Quitar anuncios»)
    print('0,99 € no quita anuncios:', pg.evaluate("() => ChromaGame.save().adsRemoved === false"))
    pg.evaluate("() => onBilling({type:'purchase', id:'c2', token:'tok-c2'})"); pg.wait_for_timeout(200)
    print('cofre de monedas sí:', pg.evaluate("() => [ChromaGame.save().adsRemoved, !document.querySelector('[data-id=noads]')]"))
    pg.evaluate("() => { const s = ChromaGame.save(); s.adsRemoved = false; s.starter = false; onBilling({type:'owned', ids:['noads','starter']}); }")
    print('restaurar:', pg.evaluate("() => [ChromaGame.save().adsRemoved, ChromaGame.save().starter]"))
    pg.evaluate("() => onBilling({type:'error', code:1})"); pg.evaluate("() => onBilling({type:'error', code:6})"); pg.wait_for_timeout(100)
    print('error:', pg.evaluate("() => document.getElementById('toast').textContent"))
    pg.evaluate("() => document.getElementById('shop').classList.remove('on')")
    # anuncio con premio sin anuncio cargado
    pg.evaluate("() => { window.__rewardCb = ok => { window.__ok = ok; }; onChromaReward(false, 'noad'); }"); pg.wait_for_timeout(100)
    print('sin anuncio:', pg.evaluate("() => [window.__ok, document.getElementById('toast').textContent]"))
    # márgenes de la muesca
    pg.evaluate("() => ChromaInsets(32, 0, 18, 0)")
    print('márgenes:', pg.evaluate("() => [getComputedStyle(document.documentElement).getPropertyValue('--sat'), getComputedStyle(document.getElementById('title')).paddingTop]"))
    print('errores', errs[:5]); b.close()
