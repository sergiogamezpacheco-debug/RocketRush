# Genera el fondo ilustrado de la portada de Halloween (src/hw-title.svg).
# Estilo «cartoon» con contorno grueso: cielo morado, luna enorme, castillo encantado, murciélagos, la bruja,
# colina con tumbas y, delante, los cubos del juego disfrazados (bruja, vampiro, fantasma y calabaza).
import math, random
random.seed(31)
W, H = 390, 844
OUT = []
INK = '#1a0a2e'
def add(s): OUT.append(s)
def f(x): return f'{x:.1f}'

# ---------- cielo ----------
add(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#12052a"/><stop offset=".35" stop-color="#3a1066"/><stop offset=".62" stop-color="#7a2a7a"/><stop offset=".78" stop-color="#ff7a3a"/><stop offset="1" stop-color="#ffb04a"/></linearGradient>
<radialGradient id="moonG" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#fffbe6"/><stop offset=".7" stop-color="#ffe9a0"/><stop offset="1" stop-color="#f6c75a"/></radialGradient>
<radialGradient id="halo" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe9a0" stop-opacity=".75"/><stop offset=".45" stop-color="#ffb05a" stop-opacity=".25"/><stop offset="1" stop-color="#ff7a3a" stop-opacity="0"/></radialGradient>
<radialGradient id="glowO" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd23f" stop-opacity=".9"/><stop offset="1" stop-color="#ff7a1a" stop-opacity="0"/></radialGradient>
<linearGradient id="castle" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a1a6a"/><stop offset="1" stop-color="#22104a"/></linearGradient>
<linearGradient id="roof" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a2a9a"/><stop offset="1" stop-color="#2e1260"/></linearGradient>
<linearGradient id="hill1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2a5a"/><stop offset="1" stop-color="#1e1236"/></linearGradient>
<linearGradient id="hill2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e5a3a"/><stop offset="1" stop-color="#163020"/></linearGradient>
<linearGradient id="grave" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b8b2cc"/><stop offset="1" stop-color="#7a7494"/></linearGradient>
<radialGradient id="pump" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#ffc06a"/><stop offset=".55" stop-color="#ff7a12"/><stop offset="1" stop-color="#c84a00"/></radialGradient>
<radialGradient id="carve" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#ffffff"/><stop offset=".4" stop-color="#fff27a"/><stop offset="1" stop-color="#ffb000"/></radialGradient>
<linearGradient id="fog" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8a0ff" stop-opacity="0"/><stop offset="1" stop-color="#c8a0ff" stop-opacity=".55"/></linearGradient>
<pattern id="cane" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><rect width="14" height="14" fill="#fff"/><rect width="7" height="14" fill="#e8203a"/></pattern>
</defs>
<rect width="{W}" height="{H}" fill="url(#sky)"/>''')
for i in range(70):
    x, y, r = random.uniform(0, W), random.uniform(0, 420), random.choice([0.8, 1, 1.2, 1.6, 2])
    add(f'<circle cx="{f(x)}" cy="{f(y)}" r="{r}" fill="#fff" opacity="{random.uniform(.4, 1):.2f}"/>')
# ---------- luna ----------
MX, MY, MR = 286, 404, 60
add(f'<circle cx="{MX}" cy="{MY}" r="{MR * 2.3}" fill="url(#halo)"/>')
add(f'<circle cx="{MX}" cy="{MY}" r="{MR}" fill="url(#moonG)" stroke="{INK}" stroke-width="4"/>')
for x, y, r in [(-28, -22, 14), (22, 18, 20), (-6, 40, 9), (34, -30, 8), (-38, 22, 10)]:
    add(f'<circle cx="{MX + x}" cy="{MY + y}" r="{r}" fill="#f2c870" opacity=".55"/>')
# ---------- castillo ----------
def tower(x, base, top, w, roofH, flag=True):
    s = f'<rect x="{f(x - w / 2)}" y="{f(top)}" width="{f(w)}" height="{f(base - top)}" fill="url(#castle)" stroke="{INK}" stroke-width="3.5"/>'
    for k in range(-1, 2):
        s += f'<rect x="{f(x + k * w / 3 - w / 8)}" y="{f(top - 8)}" width="{f(w / 4)}" height="9" fill="url(#castle)" stroke="{INK}" stroke-width="3"/>'
    s += f'<path d="M{f(x - w * 0.66)} {f(top - 6)} L{f(x)} {f(top - 6 - roofH)} L{f(x + w * 0.66)} {f(top - 6)} Z" fill="url(#roof)" stroke="{INK}" stroke-width="3.5" stroke-linejoin="round"/>'
    if flag:
        fx, fy = x, top - 6 - roofH
        s += f'<path d="M{f(fx)} {f(fy)} L{f(fx)} {f(fy - 16)} L{f(fx + 14)} {f(fy - 11)} L{f(fx)} {f(fy - 7)}" fill="#ff7a1a" stroke="{INK}" stroke-width="2.5" stroke-linejoin="round"/>'
    for j in range(int((base - top) / 34)):
        wy = top + 16 + j * 34
        if random.random() < 0.85:
            s += f'<path d="M{f(x - 5)} {f(wy + 14)} L{f(x - 5)} {f(wy + 5)} Q{f(x)} {f(wy - 2)} {f(x + 5)} {f(wy + 5)} L{f(x + 5)} {f(wy + 14)} Z" fill="#ffcf4a" stroke="{INK}" stroke-width="2.5"/>'
    return s
CB = 545
add(f'<g>')
add(f'<rect x="88" y="{CB - 70}" width="214" height="80" fill="url(#castle)" stroke="{INK}" stroke-width="3.5"/>')
for i in range(12):
    add(f'<rect x="{88 + i * 18 + 3}" y="{CB - 80}" width="11" height="11" fill="url(#castle)" stroke="{INK}" stroke-width="3"/>')
add(tower(118, CB, CB - 150, 40, 62))
add(tower(272, CB, CB - 135, 38, 56))
add(tower(195, CB - 40, CB - 230, 50, 78))
add(tower(152, CB - 60, CB - 185, 30, 50, False))
add(tower(238, CB - 60, CB - 175, 28, 46, False))
add(f'<path d="M180 {CB + 10} L180 {CB - 24} Q195 {CB - 46} 210 {CB - 24} L210 {CB + 10} Z" fill="#12062a" stroke="{INK}" stroke-width="3"/>')
for wx in (140, 250, 168, 222):
    add(f'<rect x="{wx - 5}" y="{CB - 52}" width="10" height="14" rx="5" fill="#ffcf4a" stroke="{INK}" stroke-width="2.5"/>')
add('</g>')
# ---------- murciélagos ----------
def bat(x, y, s, rot=0):
    return (f'<g transform="translate({f(x)} {f(y)}) rotate({rot}) scale({s})"><path d="M0 2 C-6 -8 -14 -10 -26 -6 C-22 -2 -22 2 -18 4 C-14 1 -10 3 -8 7 C-5 4 -2 5 0 8 C2 5 5 4 8 7 C10 3 14 1 18 4 C22 2 22 -2 26 -6 C14 -10 6 -8 0 2Z" fill="#16081f" stroke="{INK}" stroke-width="1.5" stroke-linejoin="round"/>'
            f'<circle cx="0" cy="0" r="5" fill="#16081f"/><path d="M-4 -3 L-3 -9 L-1 -4 M4 -3 L3 -9 L1 -4" fill="#16081f" stroke="#16081f" stroke-width="2"/><circle cx="-2" cy="0" r="1.2" fill="#ffd23f"/><circle cx="2" cy="0" r="1.2" fill="#ffd23f"/></g>')
for x, y, s, r in [(66, 352, 1.1, -10), (120, 330, 0.8, 8), (350, 345, 0.9, 12), (215, 345, 0.7, -6), (318, 480, 0.75, 4), (60, 440, 0.65, -14), (356, 440, 0.6, 10), (160, 372, 0.55, 6)]:
    add(bat(x, y, s, r))
# ---------- bruja cruzando la luna ----------
add(f'''<g transform="translate(262 392) rotate(-8) scale(0.95)">
<path d="M-62 16 L58 -2" stroke="#6a3a1a" stroke-width="5" stroke-linecap="round"/>
<path d="M-62 16 L-86 8 L-90 20 L-84 30 L-60 22 Z" fill="#e0a840" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>
<path d="M-6 -30 C-26 -26 -40 -14 -52 -6 C-38 -6 -26 -2 -14 6 Z" fill="#3a1460" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>
<path d="M-12 10 C-14 -10 -6 -26 6 -26 C16 -26 20 -12 18 6 Z" fill="#7a3ad8" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>
<path d="M0 8 L-6 26 L-16 30 L-2 32 L6 14" fill="#9a3ad8" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>
<circle cx="6" cy="-34" r="11" fill="#8ad05a" stroke="{INK}" stroke-width="3"/>
<path d="M14 -36 L28 -30 L14 -30" fill="#8ad05a" stroke="{INK}" stroke-width="2.5" stroke-linejoin="round"/>
<circle cx="10" cy="-37" r="2.2" fill="{INK}"/>
<path d="M-4 -34 C-14 -30 -22 -24 -30 -24 C-22 -32 -14 -40 -2 -40 Z" fill="#ff6a1a" stroke="{INK}" stroke-width="2.5"/>
<path d="M-16 -42 L28 -46 L22 -40 L-12 -38 Z" fill="#1c1028" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>
<path d="M-2 -44 L14 -45 L10 -62 L-6 -78 L0 -60 Z" fill="#1c1028" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>
<path d="M-1 -48 L13 -49" stroke="#ff7a1a" stroke-width="4"/>
<path d="M16 -8 L34 -2" stroke="#7a3ad8" stroke-width="6" stroke-linecap="round"/><circle cx="36" cy="-1" r="4" fill="#8ad05a" stroke="{INK}" stroke-width="2"/>
</g>''')
for i in range(9):
    add(f'<circle cx="{f(178 - i * 9 + random.uniform(-3, 3))}" cy="{f(410 + i * 1.6 + random.uniform(-4, 4))}" r="{f(2.4 - i * 0.2)}" fill="#ffe27a" opacity="{1 - i * 0.09:.2f}"/>')
# ---------- colinas, tumbas y árbol muerto ----------
add(f'<path d="M-10 {CB + 6} Q80 {CB - 40} 170 {CB + 4} T400 {CB - 10} L400 {H} L-10 {H} Z" fill="url(#hill1)" stroke="{INK}" stroke-width="3.5"/>')
def grave(x, y, s, cross=False, rot=0):
    if cross:
        return f'<g transform="translate({f(x)} {f(y)}) rotate({rot}) scale({s})"><path d="M-4 0 L-4 -26 L-13 -26 L-13 -34 L-4 -34 L-4 -42 L4 -42 L4 -34 L13 -34 L13 -26 L4 -26 L4 0 Z" fill="url(#grave)" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/></g>'
    return (f'<g transform="translate({f(x)} {f(y)}) rotate({rot}) scale({s})"><path d="M-14 0 L-14 -24 Q-14 -40 0 -40 Q14 -40 14 -24 L14 0 Z" fill="url(#grave)" stroke="{INK}" stroke-width="3"/>'
            f'<path d="M-6 -24 L6 -24 M0 -30 L0 -16" stroke="#5a5470" stroke-width="2.5" stroke-linecap="round"/></g>')
for x, y, s, c, r in [(40, 560, 1, False, -6), (78, 548, 0.8, True, 5), (322, 545, 0.95, False, 7), (360, 562, 0.8, True, -8), (290, 560, 0.7, False, -3)]:
    add(grave(x, y, s, c, r))
add(f'''<g transform="translate(352 548)"><path d="M-6 0 C-4 -30 -10 -50 -2 -78 M-3 -40 C-16 -52 -26 -54 -36 -66 M-4 -60 C6 -72 14 -74 22 -88 M-6 -30 C6 -36 14 -36 20 -46" fill="none" stroke="{INK}" stroke-width="9" stroke-linecap="round"/>
<path d="M-6 0 C-4 -30 -10 -50 -2 -78 M-3 -40 C-16 -52 -26 -54 -36 -66 M-4 -60 C6 -72 14 -74 22 -88 M-6 -30 C6 -36 14 -36 20 -46" fill="none" stroke="#3a2420" stroke-width="5" stroke-linecap="round"/></g>''')
add(f'<path d="M-10 {CB + 70} Q110 {CB + 20} 220 {CB + 62} T400 {CB + 46} L400 {H} L-10 {H} Z" fill="url(#hill2)" stroke="{INK}" stroke-width="3.5"/>')
# ---------- cubos del juego disfrazados ----------
def cube(x, y, s, col, dark, extra_back='', extra_front='', mouth='smile', eyes='normal'):
    g = f'<g transform="translate({f(x)} {f(y)}) scale({s})">' + extra_back
    g += f'<rect x="-30" y="-30" width="60" height="60" rx="15" fill="{dark}" stroke="{INK}" stroke-width="3.5" transform="translate(0 4)"/>'
    g += f'<rect x="-30" y="-30" width="60" height="58" rx="15" fill="{col}" stroke="{INK}" stroke-width="3.5"/>'
    g += f'<path d="M-22 -18 Q-20 -24 -12 -24" stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none" opacity=".7"/>'
    if eyes == 'normal':
        for sx in (-11, 11):
            g += f'<ellipse cx="{sx}" cy="-4" rx="7.5" ry="8.5" fill="#fff" stroke="{INK}" stroke-width="2"/><circle cx="{sx + 1.5}" cy="-3" r="4.2" fill="{INK}"/><circle cx="{sx + 3}" cy="-5" r="1.5" fill="#fff"/>'
    elif eyes == 'ghost':
        for sx in (-11, 11):
            g += f'<ellipse cx="{sx}" cy="-4" rx="5" ry="8" fill="{INK}"/>'
    g += f'<ellipse cx="-19" cy="8" rx="5" ry="3" fill="#ff6a8a" opacity=".55"/><ellipse cx="19" cy="8" rx="5" ry="3" fill="#ff6a8a" opacity=".55"/>'
    if mouth == 'smile': g += f'<path d="M-8 9 Q0 17 8 9" stroke="{INK}" stroke-width="3" fill="none" stroke-linecap="round"/>'
    if mouth == 'fangs': g += f'<path d="M-9 8 Q0 15 9 8" stroke="{INK}" stroke-width="3" fill="#7a1020" stroke-linecap="round"/><path d="M-6 9 L-4 15 L-2 10 M2 10 L4 15 L6 9" fill="#fff" stroke="{INK}" stroke-width="1.5" stroke-linejoin="round"/>'
    if mouth == 'boo': g += f'<ellipse cx="0" cy="12" rx="6" ry="8" fill="{INK}"/>'
    return g + extra_front + '</g>'
# vampiro (rojo) con capa y cuello
vamp_back = f'<path d="M-40 -12 L-48 34 L-30 26 L-18 38 L0 28 L18 38 L30 26 L48 34 L40 -12 Z" fill="#2a0a1a" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-30 -14 L-44 -40 L-14 -24 Z M30 -14 L44 -40 L14 -24 Z" fill="#c8203a" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>'
vamp_front = f'<path d="M-30 -30 Q-30 -40 -18 -38 L0 -28 L18 -38 Q30 -40 30 -30 L30 -24 Q0 -30 -30 -24 Z" fill="#1a1020" stroke="{INK}" stroke-width="3"/>'
# bruja (verde) con sombrero
witch_front = f'<path d="M-40 -26 Q0 -40 40 -26 Q0 -18 -40 -26Z" fill="#1c1028" stroke="{INK}" stroke-width="3"/><path d="M-20 -30 L-6 -76 L4 -88 L2 -72 L20 -30 Z" fill="#2a1840" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-17 -40 L17 -40" stroke="#ff7a1a" stroke-width="6"/><rect x="-5" y="-45" width="10" height="10" fill="#ffc83d" stroke="{INK}" stroke-width="2"/>'
# fantasma (morado) con sábana
ghost_front = f'<path d="M-34 30 L-34 -6 Q-34 -46 0 -46 Q34 -46 34 -6 L34 30 L24 22 L14 32 L4 22 L-6 32 L-16 22 L-26 32 Z" fill="#f4f0ff" stroke="{INK}" stroke-width="3.5" stroke-linejoin="round" opacity=".96"/><ellipse cx="-11" cy="-8" rx="6" ry="9" fill="{INK}"/><ellipse cx="11" cy="-8" rx="6" ry="9" fill="{INK}"/><ellipse cx="0" cy="12" rx="6" ry="8" fill="{INK}"/>'
# calabaza (amarillo) con tallo y hojas
pump_front = f'<path d="M0 -30 C-2 -40 4 -46 10 -46 C8 -40 6 -36 6 -30 Z" fill="#3f8a2a" stroke="{INK}" stroke-width="3"/><path d="M6 -40 C16 -50 28 -44 26 -36 C18 -40 12 -38 6 -36Z" fill="#5fb84a" stroke="{INK}" stroke-width="2.5"/>'
add(cube(118, 640, 1.05, '#ff4f6d', '#c8203a', vamp_back, vamp_front, 'fangs'))
add(cube(272, 636, 1.05, '#5fd45a', '#2f9a3a', '', witch_front))
add(cube(195, 662, 1.18, '#ffb23a', '#d87a10', '', pump_front))
add(cube(195, 586, 0.9, '#a66bff', '#6a3ac8', '', ghost_front, mouth='none', eyes='none'))
# ---------- calabazas talladas en primer plano ----------
def jack(x, y, s, rot=0):
    g = f'<g transform="translate({f(x)} {f(y)}) rotate({rot}) scale({s})"><circle cx="0" cy="0" r="58" fill="url(#glowO)" opacity=".7"/>'
    for dx, rx in [(-22, 24), (22, 24), (0, 26)]:
        g += f'<ellipse cx="{dx}" cy="0" rx="{rx}" ry="30" fill="url(#pump)" stroke="{INK}" stroke-width="3.5"/>'
    g += f'<path d="M-2 -28 C-4 -40 4 -44 10 -42 C6 -38 6 -34 6 -28 Z" fill="#3f8a2a" stroke="{INK}" stroke-width="3"/>'
    g += f'<path d="M-24 -6 L-10 -6 L-17 -18 Z M10 -6 L24 -6 L17 -18 Z" fill="url(#carve)" stroke="{INK}" stroke-width="2.5" stroke-linejoin="round"/>'
    g += f'<path d="M-26 6 Q0 30 26 6 L20 9 L15 4 L9 12 L3 6 L-3 12 L-9 6 L-15 12 L-20 7 Z" fill="url(#carve)" stroke="{INK}" stroke-width="2.5" stroke-linejoin="round"/>'
    return g + '</g>'
add(jack(34, 712, 0.95, -8))
add(jack(356, 706, 0.85, 9))
# ---------- caramelos ----------
def cane(x, y, s, rot):
    return (f'<g transform="translate({f(x)} {f(y)}) rotate({rot}) scale({s})"><path d="M0 40 L0 -6 A12 12 0 0 1 24 -6 L24 2" fill="none" stroke="{INK}" stroke-width="14" stroke-linecap="round"/>'
            f'<path d="M0 40 L0 -6 A12 12 0 0 1 24 -6 L24 2" fill="none" stroke="url(#cane)" stroke-width="8" stroke-linecap="round"/></g>')
def candy(x, y, s, col, rot):
    return (f'<g transform="translate({f(x)} {f(y)}) rotate({rot}) scale({s})"><path d="M-14 0 L-26 -10 L-24 10 Z M14 0 L26 -10 L24 10 Z" fill="{col}" stroke="{INK}" stroke-width="2.5" stroke-linejoin="round"/>'
            f'<ellipse cx="0" cy="0" rx="15" ry="11" fill="{col}" stroke="{INK}" stroke-width="2.5"/><path d="M-8 -4 Q-4 -8 2 -7" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".8"/></g>')
add(cane(70, 640, 0.9, -14)); add(cane(318, 642, 0.85, 12))
add(candy(150, 700, 0.9, '#ff7a1a', -12)); add(candy(250, 706, 0.85, '#a66bff', 14)); add(candy(96, 690, 0.7, '#5fd45a', 20)); add(candy(300, 690, 0.7, '#ff4f6d', -18))
# ---------- niebla ----------
add(f'<rect x="0" y="{H - 220}" width="{W}" height="220" fill="url(#fog)"/>')
for x, y, rx in [(60, 760, 110), (300, 770, 130), (180, 800, 160)]:
    add(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="26" fill="#d8c0ff" opacity=".22"/>')
add('</svg>')
svg = '\n'.join(OUT)
open('src/hw-title.svg', 'w').write(svg)
print(len(svg) // 1024, 'KB')
