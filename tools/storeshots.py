# Capturas del juego a 1080x1920 para la ficha de Google Play (python3 tools/storeshots.py [idioma]).
# Se guardan en store/raw/<idioma>/ y después tools/storeart.py les pone el marco y el texto.
import sys, os
sys.path.insert(0, '/home/claude/chroma3d/tools')
from fakefs import FakeFS
from playwright.sync_api import sync_playwright
LANG = sys.argv[1] if len(sys.argv) > 1 else 'es'
OUT = f'/home/claude/chroma3d/store/raw/{LANG}/'; os.makedirs(OUT, exist_ok=True)
ONLY = sys.argv[2].split(',') if len(sys.argv) > 2 else None
fs = FakeFS()
def enc(v):
    if isinstance(v, bool): return {'booleanValue': v}
    if isinstance(v, int): return {'integerValue': str(v)}
    if isinstance(v, str): return {'stringValue': v}
    if isinstance(v, dict): return {'mapValue': {'fields': {k: enc(x) for k, x in v.items()}}}
SAVE = '{"unlocked":64,"played":80,"coins":4250,"gems":36,"birthYear":1990,"streak":3,"tut":{"main":true,"tips":{"daily":1,"shop":1,"pass":1,"missions":1,"social":1,"boss":1,"club":1,"clubIn":1,"clubEx":1,"clubBoss":1,"clubLg":1,"hw":1,"xm":1,"candy":1,"xgift":1}},"pl":{"lv":14,"xp":40}}'
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=3, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script("window.RR_AGE = 30; window.RR_LIVE_OFF = true; localStorage.setItem('rocketrush.lang','" + LANG + "'); if (!sessionStorage.s) { sessionStorage.s = 1; localStorage.setItem('chromacrash3d.v1', JSON.stringify(" + SAVE + ")); }")
    pg.route('**/*googleapis.com/**', fs.handle)
    pg.goto('file:///home/claude/chroma3d/dist/index.html'); pg.wait_for_timeout(2500)
    E = lambda js: pg.evaluate("() => { " + js + " }")
    E("Live.set({ hw: { on: false }, xm: { on: false } }); document.getElementById('daily').classList.remove('on'); for (let i = 0; i < 6; i++) ChromaGame.save().stars[i + 1] = 3;")
    pg.wait_for_timeout(1500)
    want = lambda n: not ONLY or n in ONLY
    def T(n): E(f"for (let i = 0; i < {n}; i++) ChromaGame.tick(1/30, true); ChromaGame.render();")
    def shoot():
        pos = pg.evaluate("""() => { const s=ChromaGame.G.sim, k=s.queue[0]; const live=s.liveBlocks(); const b=live.find(x=>x.userData.c===k)||live[0];
           const v=new THREE.Vector3().copy(b.position).project(ChromaGame.camera); return [(v.x*0.5+0.5)*innerWidth, (-v.y*0.5+0.5)*innerHeight]; }""")
        pg.mouse.click(pos[0], pos[1])
    if want('title'):
        E("RRGame.goTitle();"); pg.wait_for_timeout(3500); E("document.getElementById('daily').classList.remove('on')"); pg.wait_for_timeout(300)
        pg.screenshot(path=OUT + 'title.png')
    E("ChromaGame.manual(true);")
    def level(lid, shots, after, name):
        E(f"document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel({lid}, []);"); T(60)
        E("document.getElementById('hint').style.display='none'")
        for i in range(shots):
            if pg.evaluate("() => ChromaGame.G.sim.canFire()"): shoot()
            T(14 if i == shots - 1 else 40)
        T(after); pg.screenshot(path=OUT + name + '.png')
    if want('play1'): level(23, 2, 4, 'play1')
    if want('play2'): level(57, 2, 5, 'play2')
    if want('play3'): level(86, 1, 6, 'play3')
    if want('boss'):
        E("document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.startLevel(82, []);"); T(220)
        E("document.getElementById('bossIntro').classList.remove('on'); document.getElementById('hint').style.display='none'")
        shoot(); T(16); pg.screenshot(path=OUT + 'boss.png')
        E("Bosses.stop()")
    if want('map'):
        E("ChromaGame.manual(false); RRGame.goMap();"); pg.wait_for_timeout(2500); pg.screenshot(path=OUT + 'map.png'); E("ChromaGame.manual(true)")
    if want('club'):
        fs.put('clubs/abc', {k: enc(v) for k, v in dict(name='Los Demoledores', nameLc='los demoledores', desc='', open=True, minLv=0, lang='es', country='ES', badge={'ico': '🚀', 'c': 0}, leader='ME', count=18, last='ME', lg={'id': '', 's': 0}).items()})
        for i, (n, a, r, ex, d) in enumerate([('Sergio', '🦁', 'leader', 41, 12400), ('Lucía_22', '🐼', 'officer', 38, 18200), ('MegaBoom', '🤖', 'member', 30, 9100), ('Kiko', '🦊', 'officer', 26, 6400), ('Ranita', '🐸', 'member', 19, 4100), ('Tigre77', '🐯', 'member', 15, 2600), ('Pulpo', '🐙', 'member', 12, 1900)]):
            uid = 'ME' if i == 0 else 'U%d' % i
            fs.put(f'clubs/abc/members/{uid}', {k: enc(v) for k, v in dict(name=n, avatar=a, role=r, wk='2026-W44', ex=ex, exN=ex // 2, dmg=d, atk='', atkN=0, lg='', lgS=0).items()})
        E("const s = ChromaGame.save(); s.club = { cid: 'abc', name: 'Los Demoledores', role: 'leader' }; s.clubP = { wk: Club.time().wk, ex: {1:3,2:3,3:2,4:3,5:3,6:2,7:3,8:3,9:3,10:3,11:3,12:2,13:3,14:3}, dmg: 12400, atkDay: '', atkN: 1, lg: Club.time().lg || '', lgS: {} }; Club.open('ex');")
        pg.wait_for_timeout(2000); pg.screenshot(path=OUT + 'club.png')
        E("Club.open('boss')"); pg.wait_for_timeout(1500); pg.screenshot(path=OUT + 'clubboss.png')
    if want('chest'):
        E("document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); ChromaGame.manual(false); const r = { coins: 1500, gems: 15, bomb: 3, rainbow: 2, golden: 1 }; RRGame.grant(r); RRGame.openChestFX('crystal', r, () => {});")
        hint = lambda: pg.evaluate("() => { const h = document.querySelector('#cStage .chint'); return h ? h.textContent : '' }")
        def until(f, ms=15000):
            for _ in range(ms // 100):
                if f(): return True
                pg.wait_for_timeout(100)
            return False
        until(lambda: hint() != '')
        for want_h in ('Otra', 'Una', ''):
            pg.mouse.click(180, 330)
            until(lambda: (want_h in hint()) if want_h else hint() == '', 5000)
        pg.wait_for_timeout(1100); pg.screenshot(path=OUT + 'chest.png')
        for _ in range(20):
            if pg.evaluate("() => !!document.querySelector('#cStage .ok')"): break
            until(lambda: hint() != '', 6000); pg.mouse.click(180, 330); pg.wait_for_timeout(700)
        pg.wait_for_timeout(800); pg.screenshot(path=OUT + 'chest2.png')
    # cañones: la tienda en la pestaña Cañones (mejoras, cañones con más fuerza y aspectos)
    if want('cannons'):
        E("const s = ChromaGame.save(); s.gems = 420; s.coins = 8600; s.skins = { owned: ['classic','cobre','pirata','galaxia','dragon','volcan','royal'], equip: 'galaxia' }; s.can = { lv: 4, own: ['base','doble','riel'], eq: 'base' }; s.bskin = { own: ['clasica','playa','planeta','canica'], eq: 'planeta' }; ChromaGame.cos.apply();")
        E("document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); RRGame.openShop('can');"); pg.wait_for_timeout(9000)
        E("document.getElementById('shopNote').style.visibility = 'hidden'; const L = document.getElementById('shopList'), el = document.getElementById('sBskin').previousElementSibling.previousElementSibling; const c4 = el.nextElementSibling.children[3]; L.scrollTop = c4.offsetTop - L.offsetTop - 10;"); pg.wait_for_timeout(600)
        pg.screenshot(path=OUT + 'cannons.png')
        E("document.getElementById('shop').classList.remove('on')")
    # partida con un cañón personalizado (Volcán con mejora 5) y bolas Planeta
    if want('skinplay'):
        E("const s = ChromaGame.save(); s.skins.owned.push('galaxia'); s.skins.equip = 'galaxia'; s.can = { lv: 5, own: ['base'], eq: 'base' }; s.bskin = { own: ['clasica','planeta'], eq: 'planeta' }; ChromaGame.cos.apply();")
        level(57, 1, 10, 'skinplay')
    print('errores', errs[:5]); b.close()
