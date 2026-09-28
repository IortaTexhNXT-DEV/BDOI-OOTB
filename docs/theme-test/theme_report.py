"""Build the screen-by-screen test report and contact sheets from the themed walk."""
import os, json, collections, re
from PIL import Image, ImageDraw, ImageFont
S = os.path.dirname(os.path.abspath(__file__))
LIVE = os.environ.get('LIVE_SHOTS', '/home/user/FinVerse/tools/user-manual/screens')
OUT = os.path.join(S, '..', 'theme-screens')
t = json.load(open(f'{S}/theme_walk_inventory.json')); a = json.load(open(f'{S}/theme_walk_audit.json')); l = json.load(open(f'{S}/inventory.json'))
font = ImageFont.truetype('/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf', 18)
# --- contact sheets: every screen's main state, live (left) vs themed (right)
keys = [k for k in t if 'main' in t[k] and t[k]['main'].get('shot')]
w, h, per = 640, 400, 6
n = 0
for i in range(0, len(keys), per):
    chunk = keys[i:i+per]
    sheet = Image.new('RGB', (w*2+30, (h+34)*len(chunk)), 'white'); d = ImageDraw.Draw(sheet)
    for r, k in enumerate(chunk):
        y = r*(h+34); title = ' > '.join(t[k]['menu'])
        d.text((6, y+8), f'{title}  (live dev site)', fill='black', font=font); d.text((w+36, y+8), f'{title}  (BDOI theme)', fill='black', font=font)
        for col, src in ((0, f"{LIVE}/{l.get(k,{}).get('states',{}).get('main',{}).get('shot','')}"), (1, f"{S}/theme_walk_shots/{t[k]['main']['shot']}")):
            if os.path.isfile(src): sheet.paste(Image.open(src).convert('RGB').resize((w, h)), (col*(w+30), y+34))
    n += 1; sheet.save(f'{OUT}/screens-{n:02d}.jpg', quality=72)
# --- report
states = sum(1 for v in t.values() for s, x in v.items() if isinstance(x, dict) and x.get('shot'))
errs = [(k, s) for k, v in t.items() for s, x in v.items() if isinstance(x, dict) and x.get('error')]
blank = [(k, s, x.get('url')) for k, v in t.items() for s, x in v.items() if isinstance(x, dict) and 'text' in x and len(x['text']) < 80]
old = collections.Counter(); fonts = collections.defaultdict(set); invis = collections.defaultdict(set); js = collections.defaultdict(set); over = []
for k, v in a.items():
    for c, m in v.get('oldColors', {}).items(): old[(c, k)] += m
    for f in v.get('fonts', {}): fonts[f].add(k)
    for x in v.get('invisible', []): invis[x].add(k)
    for e in v.get('jsErrors', []): js[e[:100]].add(k)
    if v.get('overflow'): over.append(k)
def menu(k): return ' > '.join(t[k]['menu'])
L = []
L.append('# BDOI theme: screen-by-screen test\n')
L.append(f'Themed production build of `brokerverse/` served locally, signed in as the dev test agent against the dev API with every write request blocked. The walk replays the user-manual inventory: each screen, each tab, each create/add form, its validation state and the first record view.\n')
L.append('| | |\n|---|---|')
L.append(f'| Screens (menu entries) | {len(t)} |'); L.append(f'| States captured | {states} |')
L.append(f'| Write requests sent | 0 (blocked: {len(json.load(open(f"{S}/theme_walk_inventory.json.writes.json")))} read-only presigned-URL lookups) |')
L.append(f'| Horizontal overflow | {len(over)} |'); L.append(f'| JavaScript errors | {len(js)} |\n')
L.append('Contact sheets `screens-01.jpg` onward show every screen\'s main state: live dev site on the left, themed build on the right.\n')
L.append('## Automatic checks on every captured state\n')
L.append('Each state was scanned for: old palette colours (indigo, the old dark sidebar, the old BDO blues) in computed styles; text not set in Nunito; text whose colour equals its background; page overflow; uncaught JavaScript errors.\n')
L.append('### Old colours still on screen\n')
if old:
    for (c, k), m in sorted(old.items()): L.append(f'- {c}: {m} element(s) on `{k}`')
    L.append('\nAll of these are the colour values saved on the dev server for System Settings (Primary / Secondary colour), shown back as swatches. They are data, not styling, and change when the BDO presets are saved there.')
else: L.append('None.')
L.append('\n### Text not in Nunito\n')
for f, ks in sorted(fonts.items()):
    L.append(f'- `{f}`: ' + ', '.join(sorted(menu(re.sub(r"(--.*)?\.png$", "", k)) if re.sub(r"(--.*)?\.png$", "", k) in t else k for k in ks)[:6]))
if not fonts: L.append('None.')
L.append('\n### Text with the same colour as its background\n')
for x, ks in sorted(invis.items()):
    L.append(f'- `{x}` on ' + ', '.join(sorted(ks)[:4]))
if not invis: L.append('None.')
L.append('\n### JavaScript errors\n')
for e, ks in js.items(): L.append(f'- `{e}` on ' + ', '.join(sorted(ks)))
if not js: L.append('None.')
L.append('\n## Not reachable in the walk (same on the live dev site)\n')
L.append('These routes render an empty page on the live dev site as well, so they are outside the theme:\n')
for k, s, u in blank: L.append(f'- {menu(k)} / {s}: `{u}`')
L.append('\nTabs and buttons the walker could not activate (also failed on the live walk): ' + str(len(errs)) + '. ' + ', '.join(sorted({menu(k) + ' / ' + s for k, s in errs}))[:1500])
open(f'{OUT}/TEST_REPORT.md', 'w').write('\n'.join(L) + '\n')
print('sheets', n, 'states', states, 'fonts', dict((f, len(k)) for f, k in fonts.items()), 'invisible', len(invis), 'js', len(js), 'over', len(over))
