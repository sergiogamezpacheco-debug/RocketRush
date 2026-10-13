# Misiones, nivel de jugador y amigos
from playwright.sync_api import sync_playwright
from PIL import Image
OUT='/home/claude/chroma3d/dist/shots/'
def ticks(pg,n,render=False): pg.evaluate(f"() => {{ for(let i=0;i<{n};i++) ChromaGame.tick(1/30, true); {'ChromaGame.render();' if render else ''} }}")
def ev(pg,js): return pg.evaluate(js)
def on(pg,id): return ev(pg,f"() => document.getElementById('{id}').classList.contains('on')")
CODE = """(pid) => { const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let h=7; for (const ch of pid) h=(h*31+A.indexOf(ch)+1)%1021; return 'CC-'+pid+A[h%32]+A[(h>>5)%32]; }"""
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    pg=b.new_context(viewport={'width':390,'height':844}).new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    stars={i:3 for i in range(1,13)}
    pg.add_init_script("localStorage.setItem('chromacrash3d.v1', JSON.stringify({unlocked:13, stars:%s, stats:{blocks:140,specials:12,movers:1,cascades:3,shares:0,ads:0,golden:0,skin:0}, daily:{n:0,last:null,best:0,shields:0,adRescue:-99,auto:Math.floor((Date.now()-new Date().getTimezoneOffset()*6e4)/864e5)}}))" % str(stars).replace("'",'"'))
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(1500); ev(pg,"() => ChromaGame.manual(true)")
    pg.click('#btnPlay'); ticks(pg,1,True); pg.screenshot(path=OUT+'mi_mapa.png')
    print('mapa:', ev(pg,"() => document.getElementById('btnMis').innerText.replace(/\\n/g,' ')"))
    pg.click('#btnMis'); pg.wait_for_timeout(200); pg.screenshot(path=OUT+'mi_lista.png')
    print('cobrables:', ev(pg,"() => document.querySelectorAll('.mclaim').length"), '· tu código:', ev(pg,"() => document.getElementById('myCode').textContent"))
    print('primeras:', ev(pg,"() => [...document.querySelectorAll('.mcard')].slice(0,6).map(c=>c.querySelector('b').textContent).join(' | ')"))
    while ev(pg,"() => document.querySelectorAll('.mclaim').length"):
        pg.click('.mclaim', force=True); pg.wait_for_timeout(120)
    print('tras cobrar: nivel', ev(pg,"() => JSON.stringify(ChromaGame.save().pl)"), '· monedas', ev(pg,"() => ChromaGame.save().coins"), '· gemas', ev(pg,"() => ChromaGame.save().gems"))
    # amigos: código mal, el propio, uno bueno y repetido
    for c in ['CC-ABCDEF22', ev(pg,"() => document.getElementById('myCode').textContent"), pg.evaluate(CODE,'QWERTZ'), pg.evaluate(CODE,'QWERTZ')]:
        pg.fill('#friendCode', c); pg.click('#btnAddFriend'); pg.wait_for_timeout(100)
        print('añadir', c, '→', ev(pg,"() => document.getElementById('friendMsg').textContent"))
    pg.screenshot(path=OUT+'mi_amigo.png')
    pg.click('.mclaim', force=True); pg.wait_for_timeout(200)
    print('premio 1 amigo → gemas', ev(pg,"() => ChromaGame.save().gems"), '· doradas', ev(pg,"() => ChromaGame.save().boosters.golden"), '· nivel', ev(pg,"() => JSON.stringify(ChromaGame.save().pl)"))
    pg.click('#btnShare'); pg.wait_for_timeout(200)
    print('compartir → veces', ev(pg,"() => ChromaGame.save().stats.shares"), '· misión lista:', ev(pg,"() => !!document.querySelector('.mclaim[data-id=\"share\"]')"))
    pg.wait_for_timeout(1500); pg.screenshot(path=OUT+'mi_final.png')
    # ganar un nivel: XP en la pantalla de victoria
    pg.click('#misBack'); ev(pg,"() => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(13, []); }"); ticks(pg,40)
    ev(pg,"() => { for (const b of ChromaGame.G.sim.blocks) b.position.y -= 20; }")
    for i in range(30):
        ticks(pg,15)
        if on(pg,'win'): break
    pg.wait_for_timeout(900); print('victoria:', ev(pg,"() => document.getElementById('winPass').textContent"), '· bloques contados', ev(pg,"() => ChromaGame.save().stats.blocks"))
    print('errores', errs[:5]); b.close()
ims=[Image.open(OUT+n+'.png').convert('RGB').resize((300,650)) for n in ['mi_mapa','mi_lista','mi_amigo','mi_final']]
s=Image.new('RGB',(1200,650))
for i,im in enumerate(ims): s.paste(im,(300*i,0))
s.save(OUT+'missions_sheet.png')
