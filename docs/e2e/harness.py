"""Browser harness for the BrokerVerse end-to-end test: serves a production build, drives it like a user,
records every step (screenshot, result, checks) and verifies downstream effects through the API."""
import os, re, json, time, threading, http.server, socketserver, functools, urllib.request
from playwright.sync_api import sync_playwright, expect

BUILD = os.environ.get('BUILD_DIR', '/tmp/ourbuild')
API = os.environ.get('API', 'http://localhost:8000/api')
PORT = int(os.environ.get('WEB_PORT', '5080'))
BASE = f'http://127.0.0.1:{PORT}'
OUT = os.environ.get('E2E_OUT', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'run'))
os.makedirs(f'{OUT}/shots', exist_ok=True)

class _Spa(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def send_head(self):
        p = self.translate_path(self.path)
        if not os.path.exists(p) or (os.path.isdir(p) and not os.path.exists(os.path.join(p, 'index.html'))):
            self.path = '/index.html'
        return super().send_head()

def serve():
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.ThreadingTCPServer(('127.0.0.1', PORT), functools.partial(_Spa, directory=BUILD))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

# ---------------------------------------------------------------- API (downstream checks)
def api(method, path, body=None, token=None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Content-Type': 'application/json', **({'Authorization': f'Bearer {token}'} if token else {})})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read(); ct = r.headers.get('content-type', '')
            return r.status, (json.loads(raw) if 'json' in ct else raw)
    except urllib.error.HTTPError as e:
        raw = e.read()
        try: return e.code, json.loads(raw)
        except Exception: return e.code, raw

def token_for(username, password):
    s, b = api('POST', '/auth/login', {'username': username, 'password': password})
    return b.get('accessToken') if s == 200 else None

# ---------------------------------------------------------------- recording
class Recorder:
    def __init__(self):
        self.steps = []; self.n = 0
    def step(self, page, who, screen, action, checks, ok=None, note=''):
        self.n += 1
        shot = f'{self.n:03d}-{re.sub(r"[^a-z0-9]+", "-", screen.lower()).strip("-")[:50]}.png'
        try: page.screenshot(path=f'{OUT}/shots/{shot}', full_page=False)
        except Exception: shot = ''
        passed = all(c[1] for c in checks) if ok is None else ok
        self.steps.append({'n': self.n, 'who': who, 'screen': screen, 'action': action, 'checks': [{'check': c[0], 'ok': bool(c[1]), 'detail': str(c[2]) if len(c) > 2 else ''} for c in checks], 'ok': passed, 'note': note, 'shot': shot})
        json.dump(self.steps, open(f'{OUT}/steps.json', 'w'), indent=1)
        print(f"{'PASS' if passed else 'FAIL'} {self.n:03d} [{who}] {screen}: {action}", flush=True)
        for c in checks:
            if not c[1]: print(f'     x {c[0]} {c[2] if len(c) > 2 else ""}', flush=True)
        return passed

# ---------------------------------------------------------------- UI helpers (PrimeReact aware)
def settle(page, t=1200):
    try: page.wait_for_load_state('networkidle', timeout=15000)
    except Exception: pass
    page.wait_for_timeout(t)

def login(page, username, password):
    page.context.clear_cookies()
    page.goto(BASE + '/login'); settle(page, 500)
    page.evaluate('() => localStorage.clear()')
    page.goto(BASE + '/login'); settle(page, 500)
    ins = page.locator('input.p-inputtext, input[type=password]')
    ins.nth(0).fill(username); ins.nth(1).fill(password)
    page.get_by_role('button', name=re.compile('login|sign in', re.I)).click()
    try: page.wait_for_url(lambda u: '/login' not in u, timeout=20000)
    except Exception: return False
    settle(page, 1500); return True

def label_el(page, label, scope=None):
    """The visible label element whose own text is `label` (a trailing * is allowed)."""
    scope = scope or page.locator('.main__content, .p-dialog:visible').last
    pat = re.compile(rf'^\s*{re.escape(label)}\s*\*?\s*$', re.I)
    return scope.locator('label, span, div, p').filter(has_text=pat).filter(has_not=scope.locator('input')).last

def fill(page, label, value, scope=None):
    lab = label_el(page, label, scope)
    fid = lab.get_attribute('for')
    unique = fid and page.locator(f'[id="{fid}"]').count() == 1
    if unique:
        inp = page.locator(f'[id="{fid}"]')
    else:
        inp = None
        text_input = 'self::input[not(@type="hidden") and not(@type="checkbox") and not(@type="radio")] or self::textarea'
        for xp in (f'xpath=preceding-sibling::*[{text_input}][1]', f'xpath=following-sibling::*[{text_input}][1]',
                   f'xpath=../*[{text_input}][1]', f'xpath=../*//*[{text_input}][1]', f'xpath=following::*[{text_input}][1]'):
            cand = lab.locator(xp)
            if cand.count():
                inp = cand.first; break
    inp.click(); inp.fill(''); inp.type(str(value), delay=5)
    inp.press('Tab')

def choose(page, label, option, scope=None):
    lab = label_el(page, label, scope)
    ddx = 'contains(concat(" ",@class," ")," p-dropdown ") or contains(concat(" ",@class," ")," p-multiselect ") or contains(concat(" ",@class," ")," p-autocomplete ")'
    dd = None
    for xp in (f'xpath=preceding-sibling::*[{ddx}][1]', f'xpath=../*[{ddx}][1]', f'xpath=../*//*[{ddx}][1]', f'xpath=following::*[{ddx}][1]'):
        cand = lab.locator(xp)
        if cand.count():
            dd = cand.first; break
    dd.click(); page.wait_for_timeout(300)
    panel = page.locator('.p-dropdown-panel:visible, .p-multiselect-panel:visible, .p-autocomplete-panel:visible').last
    flt = panel.locator('input.p-dropdown-filter, input.p-multiselect-filter')
    if flt.count(): flt.first.fill(str(option)); page.wait_for_timeout(300)
    item = panel.locator('li').filter(has_text=re.compile(re.escape(str(option)), re.I)).first
    item.click(); page.keyboard.press('Escape') if 'multiselect' in (dd.get_attribute('class') or '') else None

def click(page, name, exact=False):
    btn = page.get_by_role('button', name=re.compile(rf'^\s*{re.escape(name)}\s*$' if exact else re.escape(name), re.I)).first
    btn.click(); settle(page, 800)

def menu(page, *path):
    """Open a screen through the sidebar, the way a user does."""
    side = page.locator('.sidebar__overall__container')
    for i, label in enumerate(path):
        nxt = path[i + 1] if i + 1 < len(path) else None
        if nxt and side.get_by_text(nxt, exact=True).first.is_visible():
            continue  # group already open
        side.get_by_text(label, exact=True).first.click(); page.wait_for_timeout(400 if nxt else 0)
    settle(page)

def toast_text(page):
    t = page.locator('.p-toast-message')
    try: t.first.wait_for(timeout=6000); return t.first.inner_text()
    except Exception: return ''

def error_texts(page):
    sel = '.p-error, small.p-invalid, .error-message, .text-danger, .p-invalid + small, [class*=error]:not(input):not(.p-toast *)'
    out = [x.strip() for x in page.locator(sel).all_inner_texts() if x.strip()]
    # red helper text rendered without a class
    out += page.evaluate("""()=>[...document.querySelectorAll('small,span,div,p')].filter(e=>e.children.length===0&&e.offsetParent&&/^rgb\\((2[0-5]\\d|1[7-9]\\d), ([0-8]?\\d), ([0-8]?\\d)\\)$/.test(getComputedStyle(e).color)&&e.innerText.trim().length>3).map(e=>e.innerText.trim())""")
    return out
