"""Screen-by-screen test of the themed dev build: replays the manual's walk (every screen, tab, form,
validation state and record view) against the local production build, bridged read-only to the dev
API, and audits every captured state for theme regressions."""
import os, sys, re, json, threading, http.server, socketserver, functools
S = os.path.dirname(os.path.abspath(__file__))
os.environ['SHOT_DIR'] = os.path.join(S, 'theme_walk_shots')
import common, capture, walk
from playwright.sync_api import sync_playwright

BUILD = os.environ.get('BUILD_DIR', '/tmp/devbuild'); PORT = 5051
LOCAL_API = 'http://localhost:8000/api'; DEV_API = 'https://brokerverse-api-dev.inxtuniverse.com/api'
common.BASE = capture.BASE = walk.BASE = f'http://127.0.0.1:{PORT}'

class SpaHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def send_head(self):
        p = self.translate_path(self.path)
        if not os.path.exists(p) or (os.path.isdir(p) and not os.path.exists(os.path.join(p, 'index.html'))):
            self.path = '/index.html'
        return super().send_head()
def serve():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('127.0.0.1', PORT), functools.partial(SpaHandler, directory=BUILD)) as h: h.serve_forever()
threading.Thread(target=serve, daemon=True).start()

WRITES = walk.WRITES
def guard(c):
    def handle(route, req):
        url = req.url
        if url.startswith(LOCAL_API):
            if req.method != 'GET' and '/auth/login' not in url:
                WRITES.append((req.method, url, (req.post_data or '')[:300])); return route.abort()
            try:
                return route.fulfill(response=route.fetch(url=DEV_API + url[len(LOCAL_API):]))
            except Exception:
                return route.abort()
        return route.continue_()
    c.route('**/*', handle)
walk.guard = guard
# real screenshots for the theme test: only hide toasts, no neutralising of text
def clean(pg, keep_toasts=False):
    if not keep_toasts:
        try: pg.wait_for_function("()=>!document.querySelector('.p-toast-message')", timeout=6000)
        except Exception: pg.add_style_tag(content='.p-toast{display:none!important}')
capture.clean = clean

AUDIT_JS = r"""() => {
 const vis = e => { const r=e.getBoundingClientRect(); const s=getComputedStyle(e); return r.width>0 && r.height>0 && s.visibility!=='hidden' && s.display!=='none' && s.opacity!=='0'; };
 const OLD = {'rgb(99, 102, 241)':'indigo #6366f1','rgb(79, 70, 229)':'indigo #4f46e5','rgb(67, 56, 202)':'indigo #4338ca','rgb(199, 210, 254)':'indigo #c7d2fe','rgb(224, 231, 255)':'indigo #e0e7ff','rgb(238, 242, 255)':'indigo #eef2ff','rgb(28, 37, 54)':'old dark #1c2536','rgb(0, 86, 179)':'old blue #0056b3','rgb(0, 61, 130)':'old navy #003d82'};
 const txt = e => (e.innerText||'').replace(/\s+/g,' ').trim();
 const findings = {oldColors:{}, fonts:{}, invisible:[], overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2};
 const bg = e => { let p=e; while(p && p!==document.documentElement){ const b=getComputedStyle(p).backgroundColor; if(b && b!=='rgba(0, 0, 0, 0)' && !/rgba\(.*, 0\)$/.test(b)) return b; p=p.parentElement; } return 'rgb(255, 255, 255)'; };
 const els=[...document.querySelectorAll('body *')].filter(vis);
 for (const e of els){
   const s=getComputedStyle(e);
   for (const prop of ['color','backgroundColor','borderTopColor','borderLeftColor']){
     const v=s[prop]; if (OLD[v]) { const k=OLD[v]+' as '+prop; findings.oldColors[k]=(findings.oldColors[k]||0)+1; }
   }
   const hasText=[...e.childNodes].some(n=>n.nodeType===3 && n.nodeValue.trim());
   if (hasText){
     const ff=s.fontFamily.toLowerCase();
     if (!/nunito/.test(ff) && !/primeicons|font ?awesome|material/.test(ff) && !e.closest('canvas, svg, code, pre')) { const k=s.fontFamily.slice(0,40); findings.fonts[k]=(findings.fonts[k]||0)+1; }
     const c=s.color, b=bg(e);
     if (c===b && txt(e).length>1) findings.invisible.push((e.className&&String(e.className).slice(0,40))+': '+txt(e).slice(0,50));
   }
 }
 findings.invisible=[...new Set(findings.invisible)].slice(0,10);
 return findings;
}"""
AUDITS = {}
JS_ERRORS = []
_capture = walk.capture
def capture_audit(pg, key, rec, label):
    r = _capture(pg, key, rec, label)
    try:
        a = pg.evaluate(AUDIT_JS)
    except Exception as e:
        a = {'error': str(e)[:200]}
    a['jsErrors'] = [x for x in JS_ERRORS]; JS_ERRORS.clear()
    AUDITS[r.get('shot') or f'{key}:{label}'] = a
    return r
walk.capture = capture_audit

def open_ctx(p):
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium', proxy={'server': os.environ['HTTPS_PROXY'], 'bypass': '127.0.0.1,localhost'})
    c = b.new_context(viewport={'width': 1600, 'height': 1000})
    return b, c
walk.open_ctx = open_ctx

if __name__ == '__main__':
    inv = json.load(open(os.path.join(S, 'inventory.json')))
    screens = [{'menu': v['menu'], 'url': v['url']} for v in inv.values() if v.get('url')]
    out_path = os.path.join(S, 'theme_walk_inventory.json')
    INV = json.load(open(out_path)) if os.path.exists(out_path) else {}
    with sync_playwright() as p:
        b, c = open_ctx(p); guard(c); pg = c.new_page()
        pg.on('pageerror', lambda e: JS_ERRORS.append(str(e)[:200]))
        # sign in on the local origin
        pg.goto(common.BASE + '/login', wait_until='networkidle'); pg.wait_for_timeout(1000)
        ins = pg.locator('input.p-inputtext'); ins.nth(0).fill('juan.santos'); ins.nth(1).fill(os.environ['BV_PW'])
        pg.get_by_role('button', name=re.compile('login', re.I)).click(); pg.wait_for_url(lambda u: '/login' not in u, timeout=90000)
        walk.settle(pg, 3000)
        # replay walk.py's main loop with the patched helpers
        src = open(os.path.join(S, 'walk.py')).read().split("if __name__=='__main__':")[1]
        body = src.split('with sync_playwright() as p:')[1]
        body = body.replace("b,c=open_ctx(p); guard(c); pg=c.new_page()", "pass")
        body = '\n'.join(l[8:] if l.startswith('        ') else l for l in body.splitlines())
        ns = dict(vars(walk)); ns.update({'screens': screens, 'out_path': out_path, 'INV': INV, 'pg': pg, 'b': b, 'c': c, 'p': p, 'BASE': common.BASE, 'capture': capture_audit, 'WRITES': WRITES})
        try:
            exec(body, ns)
        finally:
            json.dump(AUDITS, open(os.path.join(S, 'theme_walk_audit.json'), 'w'), indent=1)
            print('WRITES_BLOCKED', WRITES)
