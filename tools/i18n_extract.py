# Saca los textos en español del juego (para traducirlos): python3 tools/i18n_extract.py > lista.json
import re, json, sys
SP = re.compile(r'[áéíóúñÁÉÍÓÚÑ¡¿]|\b(de|la|el|los|las|una|un|para|con|tu|tus|nivel|niveles|bolas?|monedas|gemas?|racha|del|al|que|y|en|por|sin|se|es|más|ya|no|te|lo|le|su|sus|hay|mundo|jefe|bloques?|cofre|pase|misiones?|tienda|ajustes|amigos?|premio|gratis|toca|derriba|consigue|supera|usa|mira|equipa|añade|comparte|haz|cañón|pájaro|barco)\b', re.I)
out = {}
def add(s, where):
    s = s.strip()
    if len(s) < 2 or not re.search(r'[A-Za-zÁÉÍÓÚáéíóúñÑ]', s): return
    out.setdefault(s, where)
for f in ['src/game3d.js', 'src/bosses.js', 'src/levels3d.js', 'src/sim3d.js']:
    src = open(f).read()
    src = re.sub(r'^\s*//.*$', '', src, flags=re.M)
    for m in re.finditer(r"'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`|\"((?:[^\"\\\n]|\\.)*)\"", src):
        s = m.group(1) or m.group(2) or m.group(3)
        if not s: continue
        caps = re.fullmatch(r'[¡¿+]?[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ]+(?: [A-ZÁÉÍÓÚÑa-záéíóúñ]+)*[!?.:]?', s)
        if not SP.search(s) and not caps and not re.search(r'>[^<>${}]*[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}[^<>${}]*<', s): continue
        if m.group(2) is not None:            # plantilla: las expresiones pasan a {x}; el HTML se separa en trozos de texto
            depth = 0; t = ''; i = 0
            while i < len(s):
                if s.startswith('${', i):
                    j = i + 2; d = 1
                    while j < len(s) and d: d += (s[j] == '{') - (s[j] == '}'); j += 1
                    t += '{x}'; i = j; continue
                t += s[i]; i += 1
            s = t
        for part in re.split(r'<[^>]*>', s):
            part = part.replace('\\n', ' ').strip()
            if SP.search(part) or re.search(r'[A-ZÁÉÍÓÚ]{3,}', part) or re.fullmatch(r'[¡¿+]?[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ]+(?: [A-ZÁÉÍÓÚÑa-záéíóúñ]+)*[!?.:]?', part): add(part, f)
html = open('src/index.html').read()
body = html[html.index('<body'):]
body = re.sub(r'<style>.*?</style>|<script.*?</script>', '', body, flags=re.S)
for t in re.findall(r'>([^<>]+)<', body): add(t, 'index.html')
for a in re.findall(r'(?:aria-label|placeholder|title)="([^"]+)"', body): add(a, 'index.html')
json.dump(out, sys.stdout, ensure_ascii=False, indent=0)
