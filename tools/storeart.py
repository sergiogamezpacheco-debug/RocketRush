# Imágenes de la ficha de Google Play a partir de las capturas (tools/storeshots.py), el logo y Cubi:
#   python3 tools/storeart.py propuestas          → 3 estilos de capturas y 3 de imagen destacada (store/propuestas/)
#   python3 tools/storeart.py final <estilo> <fg> → todas las capturas 1080x1920 y la imagen destacada 1024x500 por idioma
import sys, os, json
from playwright.sync_api import sync_playwright
R = '/home/claude/chroma3d/store/'
CAP = {
 'es': {'chest': 'Cofres llenos de PREMIOS', 'chest2': 'Monedas, gemas y POTENCIADORES', 'play2': '¡Apunta, dispara y DERRIBA!', 'play1': 'Cada bola revienta SU COLOR', 'play3': '¡Combos EXPLOSIVOS!', 'boss': 'Jefes GIGANTES', 'map': '1000 niveles en 100 MUNDOS', 'club': 'Juega con tu CLUB', 'clubboss': 'Todo el club contra el JEFE COLOSAL', 'title': 'Demoliciones 3D SIN CONEXIÓN', 'fg': '¡Apunta, dispara y derriba!'},
 'en': {'chest': 'Chests full of REWARDS', 'chest2': 'Coins, gems and BOOSTERS', 'play2': 'Aim, shoot and KNOCK IT DOWN!', 'play1': 'Each ball pops ITS COLOR', 'play3': 'EXPLOSIVE combos!', 'boss': 'GIANT bosses', 'map': '1000 levels in 100 WORLDS', 'club': 'Play with your CLUB', 'clubboss': 'The whole club vs the COLOSSAL BOSS', 'title': '3D demolition OFFLINE', 'fg': 'Aim, shoot and knock it down!'},
 'pt': {'chest': 'Baús cheios de PRÉMIOS', 'chest2': 'Moedas, gemas e POTENCIADORES', 'play2': 'Aponta, dispara e DERRUBA!', 'play1': 'Cada bola rebenta A SUA COR', 'play3': 'Combos EXPLOSIVOS!', 'boss': 'Chefes GIGANTES', 'map': '1000 níveis em 100 MUNDOS', 'club': 'Joga com o teu CLUBE', 'clubboss': 'Todo o clube contra o CHEFE COLOSSAL', 'title': 'Demolições 3D SEM INTERNET', 'fg': 'Aponta, dispara e derruba!'},
 'fr': {'chest': 'Des coffres pleins de RÉCOMPENSES', 'chest2': 'Pièces, gemmes et BONUS', 'play2': 'Vise, tire et DÉMOLIS !', 'play1': 'Chaque balle éclate SA COULEUR', 'play3': 'Des combos EXPLOSIFS !', 'boss': 'Des boss GÉANTS', 'map': '1000 niveaux dans 100 MONDES', 'club': 'Joue avec ton CLUB', 'clubboss': 'Tout le club contre le BOSS COLOSSAL', 'title': 'Démolition 3D HORS LIGNE', 'fg': 'Vise, tire et démolis !'},
 'de': {'chest': 'Truhen voller BELOHNUNGEN', 'chest2': 'Münzen, Edelsteine und BOOSTER', 'play2': 'Zielen, schießen, UMWERFEN!', 'play1': 'Jede Kugel lässt IHRE FARBE platzen', 'play3': 'EXPLOSIVE Kombos!', 'boss': 'RIESIGE Bosse', 'map': '1000 Level in 100 WELTEN', 'club': 'Spiel mit deinem CLUB', 'clubboss': 'Der ganze Club gegen den RIESENBOSS', 'title': '3D-Abriss auch OFFLINE', 'fg': 'Zielen, schießen, umwerfen!'},
 'it': {'chest': 'Forzieri pieni di PREMI', 'chest2': 'Monete, gemme e POTENZIAMENTI', 'play2': 'Mira, spara e ABBATTI!', 'play1': 'Ogni palla fa scoppiare IL SUO COLORE', 'play3': 'Combo ESPLOSIVE!', 'boss': 'Boss GIGANTI', 'map': '1000 livelli in 100 MONDI', 'club': 'Gioca con il tuo CLUB', 'clubboss': 'Tutto il club contro il BOSS COLOSSALE', 'title': 'Demolizioni 3D OFFLINE', 'fg': 'Mira, spara e abbatti!'},
}
ORDER = ['play2', 'boss', 'chest', 'club', 'play3', 'clubboss', 'chest2', 'map']
BG = {'play2': ['#7a4cf0', '#3a1f9a'], 'play1': ['#ff7a3d', '#b8331a'], 'boss': ['#e8203a', '#6a0a2a'], 'club': ['#3d8bff', '#1f3fa8'], 'play3': ['#37c46b', '#146a3a'], 'map': ['#ffb41a', '#c25a00'], 'clubboss': ['#8a5cff', '#2a1d6c'], 'title': ['#ff5fa8', '#7a1a5a'], 'chest': ['#20c4c4', '#0e6a7a'], 'chest2': ['#ff5fa8', '#7a1a5a']}
FONT = 'body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}'
def cap_html(t, size):
    # palabra en MAYÚSCULAS = dorada, el resto blanco; sin contorno, solo sombra. Se encoge sola hasta caber en su recuadro.
    out = []
    for w in t.split(' '):
        g = w.upper() == w and any(c.isalpha() for c in w) and len(w) > 1
        out.append(f'<span class="{"g" if g else "w"}">{w}</span>')
    return f'<div class="cap" data-max="{size}" style="font-size:{size}px">' + ' '.join(out) + '</div>'
FIT = """<script>for (const c of document.querySelectorAll('.cap')) { const box = c.parentElement, cs = getComputedStyle(box); let s = +c.dataset.max;
  const W = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), H = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  while (s > 20 && (c.scrollWidth > W || c.offsetHeight > H)) { s -= 2; c.style.fontSize = s + 'px'; } }</script>"""
CSS = FONT + """*{margin:0;padding:0;box-sizing:border-box}body{width:1080px;height:1920px;overflow:hidden;position:relative}
.cap{font-weight:900;line-height:1.08;letter-spacing:-.5px;text-align:center;text-shadow:0 .05em 0 rgba(0,0,0,.35),0 .08em .18em rgba(0,0,0,.35)}
.cap .w{color:#fff}.cap .g{color:#ffd23f}
.conf{position:absolute;inset:0;background:radial-gradient(circle,rgba(255,255,255,.22) 0 5px,transparent 6px) 0 0/90px 90px,radial-gradient(circle,rgba(255,230,120,.25) 0 4px,transparent 5px) 45px 45px/90px 90px}
.rays{position:absolute;left:50%;top:22%;width:2600px;height:2600px;margin:-1300px;background:repeating-conic-gradient(rgba(255,255,255,.09) 0 8deg,transparent 8deg 18deg);border-radius:50%}
"""
def shotA(img, cap, bg):   # banner arriba + captura con borde
    return f"""<style>{CSS}body{{background:linear-gradient(180deg,{bg[0]},{bg[1]})}}
.shot{{position:absolute;left:90px;top:470px;width:900px;height:1600px;border-radius:56px;overflow:hidden;border:14px solid #ffd23f;box-shadow:0 0 0 8px #2a1046,0 40px 80px rgba(0,0,0,.45)}}
.shot img{{width:100%;height:100%;object-fit:cover;object-position:top}}
.capw{{position:absolute;left:50px;right:50px;top:90px;height:330px;display:flex;align-items:center;justify-content:center}}</style>
<div class="rays"></div><div class="conf"></div><div class="capw">{cap_html(cap, 104)}</div><div class="shot"><img src="file://{img}"></div>"""
def shotB(img, cap, bg):   # captura a pantalla completa + cinta abajo y Cubi
    return f"""<style>{CSS}body{{background:#000}}
.full{{position:absolute;inset:0}}.full img{{width:100%;height:100%;object-fit:cover}}
.fade{{position:absolute;left:0;right:0;bottom:0;height:760px;background:linear-gradient(180deg,transparent,rgba(20,6,50,.85) 55%)}}
.rib{{position:absolute;left:40px;right:40px;bottom:120px;padding:44px 40px 50px;border-radius:44px;background:linear-gradient(160deg,{bg[0]},{bg[1]});border:12px solid #ffd23f;box-shadow:0 0 0 8px #2a1046,0 30px 60px rgba(0,0,0,.5)}}
.cubi{{position:absolute;right:30px;bottom:400px;width:250px;transform:rotate(10deg);filter:drop-shadow(0 16px 10px rgba(0,0,0,.4))}}</style>
<div class="full"><img src="file://{img}"></div><div class="fade"></div><img class="cubi" src="file://{R}cubi.png"><div class="rib">{cap_html(cap, 92)}</div>"""
def shotC(img, cap, bg):   # móvil inclinado sobre color con bloques
    blocks = ''.join(f'<div class="blk" style="left:{x}px;top:{y}px;width:{s}px;height:{s}px;background:{c};transform:rotate({r}deg)"><i></i><i></i></div>' for x, y, s, c, r in [(40, 1500, 150, '#ff5a7a', -14), (880, 1380, 170, '#ffd23f', 12), (70, 560, 110, '#5fe08a', 18), (900, 620, 120, '#9fd8ff', -10), (820, 1740, 130, '#b08cff', 20)])
    return f"""<style>{CSS}body{{background:radial-gradient(circle at 50% 35%,{bg[0]},{bg[1]} 75%)}}
.capw{{position:absolute;left:60px;right:60px;top:70px;height:300px;display:flex;align-items:center;justify-content:center;padding:24px 34px;border-radius:48px;background:linear-gradient(180deg,rgba(255,255,255,.2),rgba(255,255,255,.06));border:8px solid #ffd23f;box-shadow:0 18px 40px rgba(0,0,0,.3),inset 0 0 0 4px rgba(255,255,255,.18)}}
.phone{{position:absolute;left:170px;top:420px;width:740px;height:1440px;border-radius:90px;background:#120a24;padding:26px;transform:rotate(-6deg);box-shadow:0 50px 100px rgba(0,0,0,.5),inset 0 0 0 6px #3a2a5a}}
.phone img{{width:100%;height:100%;object-fit:cover;object-position:top;border-radius:66px}}
.blk{{position:absolute;border-radius:26%;border:7px solid #2a1046;box-shadow:inset -10px -12px 0 rgba(0,0,0,.18),inset 8px 8px 0 rgba(255,255,255,.35)}}
.blk i{{position:absolute;top:34%;width:16%;height:22%;background:#fff;border-radius:50%;border:4px solid #2a1046}}.blk i:first-child{{left:24%}}.blk i:last-child{{right:24%}}</style>
<div class="rays"></div>{blocks}<div class="capw">{cap_html(cap, 100)}</div><div class="phone"><img src="file://{img}"></div>"""
def fg(kind, lang, imgs):
    logo = f'{R}logo-{lang}.png' if os.path.exists(f'{R}logo-{lang}.png') else f'{R}logo-es.png'
    tag = CAP[lang]['fg']
    base = FONT + "*{margin:0;padding:0;box-sizing:border-box}body{width:1024px;height:500px;overflow:hidden;position:relative}"
    capcss = ".cap{font-weight:900;line-height:1.08;text-align:center;text-shadow:0 .05em 0 rgba(0,0,0,.35),0 .08em .18em rgba(0,0,0,.35)}.cap .w{color:#fff}.cap .g{color:#ffd23f}"
    if kind == 'A':   # logo a la izquierda y dos capturas inclinadas a la derecha
        return f"""<style>{base}{capcss}body{{background:radial-gradient(circle at 30% 50%,#8a5cff,#2a1070 80%)}}
.rays{{position:absolute;left:28%;top:50%;width:1600px;height:1600px;margin:-800px;background:repeating-conic-gradient(rgba(255,255,255,.08) 0 8deg,transparent 8deg 18deg);border-radius:50%}}
.logo{{position:absolute;left:40px;top:70px;width:470px}}.t{{position:absolute;left:30px;width:490px;top:395px}}
.ph{{position:absolute;width:250px;height:445px;border-radius:30px;overflow:hidden;border:7px solid #ffd23f;box-shadow:0 0 0 5px #2a1046,0 20px 40px rgba(0,0,0,.5)}}.ph img{{width:100%;height:100%;object-fit:cover;object-position:top}}</style>
<div class="rays"></div><img class="logo" src="file://{logo}"><div class="t">{cap_html(tag, 34)}</div>
<div class="ph" style="left:560px;top:60px;transform:rotate(-7deg)"><img src="file://{imgs['play2']}"></div><div class="ph" style="left:760px;top:20px;transform:rotate(6deg)"><img src="file://{imgs['play3']}"></div>"""
    if kind == 'B':   # escena del juego a lo ancho con el logo encima y Cubi
        return f"""<style>{base}{capcss}body{{background:#000}}
.bg{{position:absolute;inset:0;background:url('file://{imgs['play3']}') center 62%/cover;filter:saturate(1.15)}}
.sh{{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,rgba(20,6,50,.15),rgba(20,6,50,.75) 80%)}}
.logo{{position:absolute;left:50%;top:40px;width:470px;margin-left:-235px}}.t{{position:absolute;left:0;right:0;top:360px}}
.cubi{{position:absolute;left:60px;top:250px;width:150px;transform:rotate(-12deg)}}.cubi2{{position:absolute;right:60px;top:90px;width:120px;transform:rotate(14deg) scaleX(-1)}}</style>
<div class="bg"></div><div class="sh"></div><img class="cubi" src="file://{R}cubi.png"><img class="cubi2" src="file://{R}cubi.png"><img class="logo" src="file://{logo}"><div class="t">{cap_html(tag, 46)}</div>"""
    if kind == 'C':   # tres capturas en abanico y franja con el logo abajo
        return f"""<style>{base}{capcss}body{{background:linear-gradient(180deg,#ffb41a,#ff6a1a)}}
.rays{{position:absolute;left:50%;top:40%;width:1800px;height:1800px;margin:-900px;background:repeating-conic-gradient(rgba(255,255,255,.14) 0 8deg,transparent 8deg 18deg);border-radius:50%}}
.ph{{position:absolute;width:190px;height:338px;border-radius:24px;overflow:hidden;border:6px solid #fff;box-shadow:0 0 0 5px #2a1046,0 20px 40px rgba(0,0,0,.45)}}.ph img{{width:100%;height:100%;object-fit:cover;object-position:top}}
.band{{position:absolute;left:0;right:0;bottom:0;height:150px;z-index:3;background:linear-gradient(180deg,#6a46e0,#2a1070);border-top:7px solid #ffd23f;box-shadow:0 -10px 30px rgba(0,0,0,.35)}}
.logo{{position:absolute;left:30px;bottom:12px;width:250px;z-index:4}}.t{{position:absolute;left:300px;right:24px;bottom:18px;height:116px;z-index:4;display:flex;align-items:center;justify-content:center}}</style>
<div class="rays"></div><div class="ph" style="left:200px;top:30px;transform:rotate(-9deg)"><img src="file://{imgs['boss']}"></div>
<div class="ph" style="left:634px;top:30px;transform:rotate(9deg)"><img src="file://{imgs['club']}"></div><div class="ph" style="left:417px;top:12px;z-index:2"><img src="file://{imgs['play2']}"></div>
<div class="band"></div><img class="logo" src="file://{logo}"><div class="t">{cap_html(tag, 44)}</div>"""
def render(pg, html, path, w, h):
    pg.set_viewport_size({'width': w, 'height': h})
    open(R + '_tmp.html', 'w').write('<!doctype html><html><head><meta charset="utf-8"></head><body>' + html + FIT + '</body></html>')
    pg.goto('file://' + R + '_tmp.html')
    pg.wait_for_timeout(250); pg.screenshot(path=path)
STY = {'A': shotA, 'B': shotB, 'C': shotC}
mode = sys.argv[1] if len(sys.argv) > 1 else 'propuestas'
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(device_scale_factor=1)
    if mode == 'propuestas':
        os.makedirs(R + 'propuestas', exist_ok=True)
        raw = {k: f'{R}raw/es/{k}.png' for k in ORDER}
        for s, f in STY.items():
            for k in ('play2', 'boss', 'club'):
                render(pg, f(raw[k], CAP['es'][k], BG[k]), f'{R}propuestas/cap_{s}_{k}.png', 1080, 1920)
        for k in 'ABC': render(pg, fg(k, 'es', raw), f'{R}propuestas/destacada_{k}.png', 1024, 500)
    else:
        sty, fk = sys.argv[2], sys.argv[3]
        langs = sys.argv[4].split(',') if len(sys.argv) > 4 else list(CAP)
        for lang in langs:
            d = f'{R}play/{lang}/'; os.makedirs(d, exist_ok=True)
            raw = {k: f'{R}raw/{lang}/{k}.png' for k in ORDER}
            for i, k in enumerate(ORDER):
                render(pg, STY[sty](raw[k], CAP[lang][k], BG[k]), f'{d}captura-{i + 1}-{k}.png', 1080, 1920)
            render(pg, fg(fk, lang, raw), f'{d}imagen-destacada-1024x500.png', 1024, 500)
    b.close()
print('ok')
