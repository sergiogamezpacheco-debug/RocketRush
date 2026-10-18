# Iconos de Rocket Rush (bolas, monedas, gemas, cofres...). El juego usa el estilo 'A' (caramelo brillante);
# 'B' (pegatina) y 'C' (medalla dorada) eran las otras propuestas.
# Uso: python3 tools/iconset.py  → reescribe el bloque de iconos de src/index.html
import math
N=[0]
def uid(p='g'): N[0]+=1; return f'{p}{N[0]}'
OUT='#2a1458'
# ---------- pintura según estilo ----------
def body(shape, cols, st, hl=None, extra=''):
    """shape: elemento SVG con {F} y {S}; cols=(claro, medio, oscuro)"""
    l,m,d=cols
    if st=='B':
        cid=uid('c')
        base=shape.format(F=d,S=f'stroke="{OUT}" stroke-width="5" stroke-linejoin="round"')
        inner=shape.format(F=m,S='')
        hi=''.join(f'<ellipse cx="{x}" cy="{y}" rx="{rx*0.55}" ry="{ry*0.55}" fill="#fff" transform="rotate({r} {x} {y})"/>' for x,y,rx,ry,r in (hl or []))
        return f'<defs><clipPath id="{cid}">{shape.format(F="#000",S="")}</clipPath></defs>{base}<g clip-path="url(#{cid})"><g transform="translate(-5 -6)">{inner}</g></g>{extra}{hi}<g>{shape.format(F="none",S=f"stroke=\"{OUT}\" stroke-width=\"5\" stroke-linejoin=\"round\"")}</g>'
    gid=uid('r')
    grad=f'<defs><radialGradient id="{gid}" cx=".34" cy=".28" r=".85"><stop offset="0" stop-color="{l}"/><stop offset=".5" stop-color="{m}"/><stop offset="1" stop-color="{d}"/></radialGradient></defs>'
    s=shape.format(F=f'url(#{gid})',S=f'stroke="{d}" stroke-width="2.5" stroke-linejoin="round"')
    rim=shape.format(F='none',S='stroke="#fff" stroke-opacity=".35" stroke-width="1.5"')
    hi=''.join(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="#fff" opacity=".8" transform="rotate({r} {x} {y})" filter="url(#soft)"/>' for x,y,rx,ry,r in (hl or []))
    return grad+s+extra+hi+f'<g transform="translate(50 50) scale(.94) translate(-50 -50)" opacity=".7">{rim}</g>'
def shadow(st, y=93, rx=30):
    return '' if st=='B' else f'<ellipse cx="50" cy="{y}" rx="{rx}" ry="5" fill="#1a0838" opacity=".28" filter="url(#soft)"/>'
COLB={'r':('#ffd0d8','#ff4f6d','#b8143a'),'b':('#d0ecff','#3d9bff','#1f4fb8'),'g':('#d8ffd0','#5fd45a','#238a2e'),'y':('#fff8c8','#ffd23f','#c98a0a'),'p':('#ecdcff','#a66bff','#5a28c8')}
def ball(c,st): return shadow(st)+body('<circle cx="50" cy="50" r="38" fill="{F}" {S}/>',COLB[c],st,[(37,34,12,8,-30)])
def bomb(st):
    fuse=f'<path d="M58 16 Q66 4 78 8" fill="none" stroke="#c98a5a" stroke-width="5" stroke-linecap="round"/>'
    spark=f'<g transform="translate(80 8)"><path d="M0 -11 L3 -3 L11 0 L3 3 L0 11 L-3 3 L-11 0 L-3 -3Z" fill="#ffd23f" stroke="{OUT if st=="B" else "#ff7a1a"}" stroke-width="{2.5 if st=="B" else 1}"/><circle r="3" fill="#fff"/></g>'
    cap=body('<rect x="44" y="13" width="18" height="13" rx="3" fill="{F}" {S} transform="rotate(20 53 19)"/>',('#d8d0f0','#8a80a8','#3a3050'),st)
    return shadow(st)+fuse+cap+body('<circle cx="47" cy="55" r="34" fill="{F}" {S}/>',('#8a7cb0','#3a3050','#120e1c'),st,[(35,42,11,7,-30)])+spark
def rainbow(st):
    cid=uid('k'); cols=['#ff4f6d','#ffd23f','#5fd45a','#3d9bff','#a66bff']
    sl=''
    for i,c in enumerate(cols):
        a0=math.radians(i*72-90); a1=math.radians((i+1)*72-90)
        sl+=f'<path d="M50 50 L{50+60*math.cos(a0):.1f} {50+60*math.sin(a0):.1f} A60 60 0 0 1 {50+60*math.cos(a1):.1f} {50+60*math.sin(a1):.1f}Z" fill="{c}"/>'
    if st=='B':
        return f'<defs><clipPath id="{cid}"><circle cx="50" cy="50" r="38"/></clipPath></defs><g clip-path="url(#{cid})">{sl}<circle cx="56" cy="57" r="38" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="14"/></g><ellipse cx="38" cy="34" rx="7" ry="4.5" fill="#fff" transform="rotate(-30 38 34)"/><circle cx="50" cy="50" r="38" fill="none" stroke="{OUT}" stroke-width="5"/>'
    gid=uid('r')
    return shadow(st)+f'<defs><clipPath id="{cid}"><circle cx="50" cy="50" r="38"/></clipPath><radialGradient id="{gid}" cx=".34" cy=".28" r=".85"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient></defs><g clip-path="url(#{cid})" transform="rotate(20 50 50)">{sl}</g><circle cx="50" cy="50" r="38" fill="url(#{gid})" stroke="#5a28c8" stroke-width="2"/><ellipse cx="37" cy="34" rx="12" ry="8" fill="#fff" opacity=".85" transform="rotate(-30 37 34)" filter="url(#soft)"/>'
def plus2(st):
    a=body('<circle cx="36" cy="58" r="25" fill="{F}" {S}/>',COLB['r'],st,[(28,48,8,5,-30)])
    b=body('<circle cx="62" cy="40" r="25" fill="{F}" {S}/>',COLB['b'],st,[(54,30,8,5,-30)])
    badge=body('<circle cx="72" cy="74" r="19" fill="{F}" {S}/>',('#d8ffd0','#37c46b','#167a32'),st)
    return shadow(st)+b+a+badge+f'<text x="72" y="81" text-anchor="middle" style="font:900 19px Inter Display" fill="#fff" stroke="{OUT if st=="B" else "#167a32"}" stroke-width="{3 if st=="B" else 0}" paint-order="stroke">+2</text>'
def heavy(st):
    band=body('<rect x="12" y="44" width="76" height="14" rx="4" fill="{F}" {S}/>',('#fff3b0','#ffc83d','#a86a0a'),st)
    riv=''.join(f'<circle cx="{x}" cy="51" r="2.6" fill="#7a4a00"/>' for x in (24,38,62,76))
    cid=uid('k')
    return shadow(st)+body('<circle cx="50" cy="50" r="38" fill="{F}" {S}/>',('#ffffff','#a8aec0','#4a4e60'),st,[(37,33,12,7,-30)])+f'<defs><clipPath id="{cid}"><circle cx="50" cy="50" r="38"/></clipPath></defs><g clip-path="url(#{cid})">{band}{riv}</g>'
def golden(st):
    star=f'<path d="M50 30 L56 44 L71 45 L59 55 L63 70 L50 62 L37 70 L41 55 L29 45 L44 44Z" fill="#fff6c0" stroke="#b87a0a" stroke-width="2" opacity=".9"/>'
    glow='' if st=='B' else '<circle cx="50" cy="50" r="46" fill="url(#gglow)"/>'
    return glow+shadow(st)+body('<circle cx="50" cy="50" r="38" fill="{F}" {S}/>',('#fffbe0','#ffd23f','#b87a0a'),st,[(36,33,11,7,-30)],star)
def tornado(st):
    sw=''.join(f'<path d="M{24+i*3} {38+i*9} Q50 {30+i*9} {76-i*4} {38+i*9}" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="3.5" stroke-linecap="round"/>' for i in range(4))
    return shadow(st)+body('<circle cx="50" cy="50" r="38" fill="{F}" {S}/>',('#ffe8c0','#e2a85a','#8a5420'),st,[(36,33,11,7,-30)],sw)
def coin(st, x=0, y=0, s=1):
    edge=body('<circle cx="50" cy="56" r="38" fill="{F}" {S}/>',('#e0a020','#c07800','#7a4a00'),st)
    face=body('<circle cx="50" cy="48" r="38" fill="{F}" {S}/>',('#fffbd0','#ffd23f','#d08a00'),st,[(34,32,10,6,-30)])
    inner=f'<circle cx="50" cy="48" r="27" fill="none" stroke="#c07800" stroke-width="3" opacity=".7"/><path d="M50 30 L55 42 L68 43 L58 51 L61 64 L50 57 L39 64 L42 51 L32 43 L45 42Z" fill="#ffe680" stroke="#c07800" stroke-width="2.5" stroke-linejoin="round"/>'
    return f'<g transform="translate({x} {y}) scale({s})">{shadow(st,95)}{edge}{face}{inner}</g>'
def gem(st, x=0, y=0, s=1):
    o=OUT if st=='B' else '#0b5a3a'; w=5 if st=='B' else 2.5
    facets=f'''<polygon points="18,34 34,14 66,14 82,34 50,90" fill="#19b277"/>
<polygon points="34,14 66,14 74,34 26,34" fill="#9effd4"/><polygon points="18,34 34,14 26,34" fill="#5ff0b0"/><polygon points="82,34 66,14 74,34" fill="#22d98a"/>
<polygon points="18,34 26,34 50,90" fill="#2ee59d"/><polygon points="26,34 74,34 50,90" fill="#19c27f"/><polygon points="74,34 82,34 50,90" fill="#0b8656"/>'''
    sp='' if st=='B' else '<path d="M36 18 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#fff"/>'
    hi='<polygon points="36,17 48,17 44,30 30,30" fill="#fff" opacity=".7"/>'
    return f'<g transform="translate({x} {y}) scale({s})">{shadow(st,94,24)}{facets}{hi}{sp}<polygon points="18,34 34,14 66,14 82,34 50,90" fill="none" stroke="{o}" stroke-width="{w}" stroke-linejoin="round"/></g>'
def gems(st): return gem(st,34,30,.62)+gem(st,2,26,.62)+gem(st,18,-2,.66)
CH={'wood':(('#f0b878','#c07a3a','#6a3e18'),('#c8ccd8','#7d8496','#3a3e4a'),'Madera'),
    'silver':(('#ffffff','#c8d0dc','#6d7890'),('#9fd0ff','#3d6bff','#1f3fb8'),'Plata'),
    'gold':(('#fff6b0','#ffc83d','#b87000'),('#ff9aa8','#e2314f','#8a0a20'),'Oro'),
    'crystal':(('#ecfeff','#7fe0ff','#2a8ad6'),('#ffffff','#c8d0dc','#6d7890'),'Cristal'),
    'epic':(('#efe0ff','#a66bff','#4a1ab8'),('#fff6b0','#ffc83d','#b87000'),'Épico'),
    'legend':(('#fff0a0','#ff7a3d','#b8280a'),('#fff6b0','#ffc83d','#b87000'),'Leyenda')}
def chest(t,st,part='all'):
    body_c,band_c,_=CH[t]
    glow=''
    if t in ('crystal','epic','legend') and st!='B':
        gc={'crystal':'#7fe0ff','epic':'#c9a6ff','legend':'#ffb84a'}[t]
        glow=f'<circle cx="50" cy="52" r="46" fill="{gc}" opacity=".45" filter="url(#big)"/>'
    box=body('<rect x="12" y="46" width="76" height="42" rx="7" fill="{F}" {S}/>',body_c,st)
    lid=body('<path d="M10 50 Q10 18 50 18 Q90 18 90 50Z" fill="{F}" {S}/>',body_c,st,[(34,28,14,5,-12)])
    lband=body('<path d="M22 21.5 L32 19.5 L32 50 L22 50Z" fill="{F}" {S}/>',band_c,st)+body('<path d="M68 19.5 L78 21.5 L78 50 L68 50Z" fill="{F}" {S}/>',band_c,st)
    bband=body('<rect x="22" y="50" width="10" height="38" rx="2" fill="{F}" {S}/>',band_c,st)+body('<rect x="68" y="50" width="10" height="38" rx="2" fill="{F}" {S}/>',band_c,st)
    rim=body('<rect x="9" y="44" width="82" height="9" rx="3" fill="{F}" {S}/>',band_c,st)
    lock=body('<rect x="40" y="46" width="20" height="22" rx="5" fill="{F}" {S}/>',('#fff6b0','#ffc83d','#a86a0a'),st)+'<path d="M50 53 a3.5 3.5 0 1 1 -0.01 0 M48.5 56 h3 l1 6 h-5z" fill="#5a3a00"/>'
    planks_b='' if t!='wood' else '<path d="M14 62 H88 M14 76 H88" stroke="#6a3e18" stroke-width="2" opacity=".5"/>'
    planks_l='' if t!='wood' else '<path d="M14 36 Q50 30 86 36" stroke="#6a3e18" stroke-width="2" fill="none" opacity=".45"/>'
    jew=''
    if t in ('epic','legend','crystal'):
        jc={'epic':'#ff4f6d','legend':'#3dc8ff','crystal':'#a66bff'}[t]
        jew=f'<circle cx="50" cy="31" r="6" fill="{jc}" stroke="{OUT if st=="B" else "#fff"}" stroke-width="2"/><circle cx="48" cy="29" r="2" fill="#fff"/>'
    sp=''
    if t in ('crystal','legend','gold') and st!='B':
        sp='<path d="M84 16 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" fill="#fff"/><path d="M14 22 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5z" fill="#fff"/>'
    B=glow+shadow(st,94,36)+box+planks_b+bband+rim+lock
    L=lid+planks_l+lband+jew+sp
    return B if part=='body' else L if part=='lid' else B+L
def shield(st):
    return shadow(st)+body('<path d="M50 8 L86 20 Q86 64 50 92 Q14 64 14 20Z" fill="{F}" {S}/>',('#d0ecff','#3d8bff','#1f3fb8'),st,[(34,28,10,6,-20)],'<path d="M36 50 L46 60 L66 38" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>')
def xp(st):
    hexa='<polygon points="50,6 88,28 88,72 50,94 12,72 12,28" fill="{F}" {S}/>'
    return shadow(st)+body(hexa,('#e6d6ff','#8a5cff','#4a1ab8'),st,[(34,26,10,5,-30)])+f'<text x="50" y="62" text-anchor="middle" style="font:900 30px Inter Display" fill="#fff" stroke="{OUT if st=="B" else "#4a1ab8"}" stroke-width="{4 if st=="B" else 0}" paint-order="stroke">XP</text>'
def fire(st, cols=(('#ffe066','#ff8a2a','#d8300a'),('#ffffff','#fff3a0','#ffc21a'))):
    outer='<path d="M52 6 C58 26 84 34 82 62 A32 30 0 0 1 18 62 C18 46 30 38 32 24 C40 36 42 38 46 40 C44 26 46 16 52 6Z" fill="{F}" {S}/>'
    inner='<path d="M50 44 C56 56 66 60 64 72 A15 14 0 0 1 36 72 C36 62 46 58 50 44Z" fill="{F}" {S}/>'
    return shadow(st,93,26)+body(outer,cols[0],st,[(36,40,6,10,20)])+body(inner,cols[1],st)
def star(st):
    p='<path d="M50 6 L62 34 L93 37 L69 57 L77 89 L50 72 L23 89 L31 57 L7 37 L38 34Z" fill="{F}" {S}/>'
    return shadow(st,95,26)+body(p,('#fffbd0','#ffd23f','#d08a00'),st,[(38,32,8,5,-30)])
# ---------- envoltorio ----------
DEFS='<defs><filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2"/></filter><filter id="big" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter><radialGradient id="gglow"><stop offset=".6" stop-color="#ffe066" stop-opacity=".7"/><stop offset="1" stop-color="#ffe066" stop-opacity="0"/></radialGradient>'+\
 '<filter id="stk" x="-20%" y="-20%" width="140%" height="140%"><feMorphology in="SourceAlpha" operator="dilate" radius="4" result="d"/><feFlood flood-color="#fff"/><feComposite in2="d" operator="in" result="w"/><feOffset in="w" dy="3" result="ws"/><feFlood flood-color="#2a1458" flood-opacity=".35"/><feComposite in2="ws" operator="in" result="sh"/><feMerge><feMergeNode in="sh"/><feMergeNode in="w"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'
MED={'ball':('#9a72ff','#4a24b8'),'coin':('#ffb84a','#b84a0a'),'gem':('#5ff0b0','#0b7a50'),'chest':('#ff8fa1','#a8143a'),'misc':('#8fd0ff','#2560c8')}
def icon(content, st, cat='misc'):
    if st=='B':
        return f'<svg viewBox="-8 -8 116 116" class="ic">{DEFS}<g filter="url(#stk)">{content}</g></svg>'
    if st=='C':
        a,b=MED[cat]; g=uid('m'); r=uid('q')
        med=f'''<defs><radialGradient id="{g}" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/></radialGradient>
<linearGradient id="{r}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff4c0"/><stop offset=".3" stop-color="#e8b84a"/><stop offset=".55" stop-color="#a87018"/><stop offset=".75" stop-color="#ffe08a"/><stop offset="1" stop-color="#b07a20"/></linearGradient></defs>
<circle cx="50" cy="50" r="49" fill="#5a3a08"/><circle cx="50" cy="50" r="47" fill="url(#{r})"/><circle cx="50" cy="50" r="40" fill="url(#{g})"/>
<g opacity=".18" fill="#fff">{''.join(f'<path d="M50 50 L{50+44*math.cos(i*0.5236):.1f} {50+44*math.sin(i*0.5236):.1f} L{50+44*math.cos(i*0.5236+0.22):.1f} {50+44*math.sin(i*0.5236+0.22):.1f}Z"/>' for i in range(12))}</g>
<path d="M18 36 Q50 4 82 36 Q50 22 18 36Z" fill="#fff" opacity=".25"/>'''
        return f'<svg viewBox="0 0 100 100" class="ic">{DEFS}{med}<g transform="translate(50 52) scale(.66) translate(-50 -50)">{content}</g><path d="M78 20 l1.6 4.4 4.4 1.6 -4.4 1.6 -1.6 4.4 -1.6 -4.4 -4.4 -1.6 4.4 -1.6z" fill="#fff"/></svg>'
    return f'<svg viewBox="-4 -4 108 108" class="ic">{DEFS}{content}</svg>'

# ---------------- CSS para el juego ----------------
if __name__ == '__main__':
    import os, urllib.parse
    root=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
    ST='A'
    def uri(content, box='-4 -4 108 108'):
        svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{box}">{DEFS}{content}</svg>'
        return 'url("data:image/svg+xml,'+urllib.parse.quote(svg,safe=" =:/;,'()-.")+'")'
    css=['/*ICONOS:INI · generado por tools/iconset.py (estilo A, caramelo brillante) */']
    bg=lambda sel,content,extra='': css.append(f'{sel}{{background:{uri(content)} center/contain no-repeat;{extra}}}')
    ballx='box-shadow:none;border-radius:0'
    for c,k in [('r','bR'),('b','bB'),('g','bG'),('y','bY'),('p','bP')]: bg(f'.ball.{k}',ball(c,ST),ballx)
    bg('.ball.bBomb',bomb(ST),ballx); bg('.ball.bRainbow',rainbow(ST),ballx); bg('.ball.bHeavy',heavy(ST),ballx)
    bg('.ball.bGolden',golden(ST),ballx); bg('.ball.bPlus2',plus2(ST),ballx)
    bg('.coin',coin(ST),'border:0;border-radius:0')
    bg('.gem',gem(ST),'filter:none')
    bg('.gems2',gems(ST))
    bg('.shieldi',shield(ST),'clip-path:none;filter:none')
    bg('.ico-fire',fire(ST)); bg('.ico-star',star(ST)); bg('.ico-xp',xp(ST)); bg('.ico-golden',golden(ST))
    bg('.dflame',fire(ST),'clip-path:none;filter:none')
    bg('.dflame.cold',fire(ST,(('#f0ecff','#b7acd6','#6a6488'),('#ffffff','#ecebf5','#c9c5e0'))))
    css.append('.ico{display:inline-block;width:1.15em;height:1.15em;vertical-align:-.2em;flex:none}')
    css.append('.chest{width:52px;height:52px;margin-top:4px}.chest i{display:none}')
    css.append(".chest::before,.chest::after{content:'';position:absolute;left:0;top:0;right:0;bottom:0;height:auto;width:auto;border:0;border-radius:0;box-shadow:none}")
    css.append('.chest::after{transform-origin:14% 50%}.chest.open::after{transform:translate(-2px,-10px) rotate(-24deg)}')
    css.append('.chest.legend,.chest.epic{filter:none}')
    for t in CH:
        sel='.chest' if t=='wood' else f'.chest.{t}'
        css.append(f'{sel}::before{{background:{uri(chest(t,ST,"body"))} center/contain no-repeat}}')
        css.append(f'{sel}::after{{background:{uri(chest(t,ST,"lid"))} center/contain no-repeat}}')
    css.append('/*ICONOS:FIN*/')
    block='\n'.join(css)
    p=os.path.join(root,'src','index.html'); h=open(p).read()
    if '/*ICONOS:INI' in h:
        a=h.index('/*ICONOS:INI'); b=h.index('/*ICONOS:FIN*/')+len('/*ICONOS:FIN*/'); h=h[:a]+block+h[b:]
    else:
        h=h.replace('</style>',block+'\n</style>',1)
    open(p,'w').write(h)
    print('iconos:', len(css)-2, 'reglas ·', round(len(block)/1024), 'KB')
