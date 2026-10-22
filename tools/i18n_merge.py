# Añade traducciones a src/i18n-data.js: python3 tools/i18n_merge.py tabla.py [tabla2.py ...]
# Cada tabla es un archivo Python con T = {"texto en español": ("en", "pt", "fr", "de", "it"), ...}
import sys, json, re, html, importlib.util
P = 'src/i18n-data.js'
src = open(P).read()
data = json.loads('{' + ','.join(l.strip().rstrip(',') for l in src.splitlines() if l.startswith('  "')) + '}')
for f in sys.argv[1:]:
    sp = importlib.util.spec_from_file_location('t', f); m = importlib.util.module_from_spec(sp); sp.loader.exec_module(m)
    for k, v in m.T.items():
        assert len(v) == 5, k
        data[html.unescape(k).strip()] = [html.unescape(x) for x in v]
head = [l for l in src.splitlines() if l.startswith('//')]
out = head + ['window.I18N_DATA = {'] + ['  ' + json.dumps(k, ensure_ascii=False) + ': ' + json.dumps(v, ensure_ascii=False) + ',' for k, v in sorted(data.items(), key=lambda kv: kv[0].lower())] + ['};']
open(P, 'w').write('\n'.join(out) + '\n')
print(len(data), 'textos')
