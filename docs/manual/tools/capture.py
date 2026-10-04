"""Capture the screenshots of the BrokerVerse user manual from a running system.

Read-only by design: the scenes in scenes.py only open screens, tabs, menus and dialogs, and type example values
into forms. A guard refuses to click any control whose text looks like a saving action (save, submit, approve,
post, send, delete, issue, confirm, record, generate ...).

Usage (see ../README.md):
    ADMIN_PASSWORD=... PERSONA_PASSWORD=... python3 docs/manual/tools/capture.py [scene-name ...]

Environment:
    WEB_BASE          front end (default http://127.0.0.1:5211)
    API               API base (default http://localhost:8211/api)
    CHROMIUM          Chromium executable (default /opt/pw-browsers/chromium)
    ADMIN_PASSWORD    password of the BrokerVerse administrator (only needed for scenes signed in as BrokerVerse)
    PERSONA_PASSWORD  password of the role users (beatriz.lacson, maria.rivera, jose.bernardo, ana.buenaventura, carlo.estrada,
                      liza.quiambao, teresa.villaroman)
    DATABASE_URL      optional; read-only lookup of the customer approval link for the public approval screen
    STATE_DIR         where sign-in sessions are cached (default /tmp/bv-manual-state); sign-in is rate limited
    TEXT_DIR          optional; the visible text of each captured screen is written here (for writing the manual)

Output: docs/manual/images/<name>.jpg (JPEG quality 70, 1400 px wide).
"""
import io
import json
import os
import re
import subprocess
import sys
import time
import urllib.request

from PIL import Image
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from scenes import LATE_SCENES, SCENES  # noqa: E402

BASE = os.environ.get('WEB_BASE', 'http://127.0.0.1:5211')
API = os.environ.get('API', 'http://localhost:8211/api')
CHROMIUM = os.environ.get('CHROMIUM', '/opt/pw-browsers/chromium')
OUT = os.path.join(os.path.dirname(HERE), 'images')
STATE_DIR = os.environ.get('STATE_DIR', '/tmp/bv-manual-state')
TEXT_DIR = os.environ.get('TEXT_DIR')
VIEWPORT = {'width': 1600, 'height': 1000}
IMG_WIDTH = 1400
IMG_QUALITY = 70

# Never click anything that could change data.
FORBIDDEN = re.compile(r'\b(save|submit|approve|approval|post|posting|send|delete|issue|confirm|record|generate|'
                       r'complete|completed|process|finali[sz]e|run|upload|reject|pay|remove|update|execute|'
                       r'match|unmatch|disburse|print|export|download|apply|create batch|new calculation|'
                       r'bulk|reminder|trigger|clear)\b', re.I)


def password_for(user):
    key = 'ADMIN_PASSWORD' if user == 'BrokerVerse' else 'PERSONA_PASSWORD'
    if key not in os.environ:
        sys.exit(f'Set {key} in the environment')
    return os.environ[key]


def settle(page, t=1500):
    try:
        page.wait_for_load_state('networkidle', timeout=15000)
    except Exception:
        pass
    page.wait_for_timeout(t)


# ------------------------------------------------------------------ sign-in with a cached session
def login(page, user):
    page.goto(BASE + '/login'); settle(page, 500)
    page.evaluate('() => localStorage.clear()')
    page.goto(BASE + '/login'); settle(page, 800)
    page.fill('#bv-login-user', user)
    page.fill('#bv-login-password', password_for(user))
    page.locator('button[type=submit]').click()
    page.wait_for_url(lambda u: '/login' not in u, timeout=30000)
    settle(page, 2000)


def context_for(browser, user):
    if user is None:
        return browser.new_context(viewport=VIEWPORT)
    os.makedirs(STATE_DIR, exist_ok=True)
    state = os.path.join(STATE_DIR, f'{user}.json')
    if os.path.exists(state) and time.time() - os.path.getmtime(state) < 20 * 3600:
        return browser.new_context(viewport=VIEWPORT, storage_state=state)
    ctx = browser.new_context(viewport=VIEWPORT)
    page = ctx.new_page()
    for attempt in range(4):
        try:
            login(page, user); break
        except Exception:
            print(f'  sign-in retry for {user} (rate limit?)', flush=True)
            time.sleep(75)
    else:
        raise RuntimeError(f'cannot sign in as {user}')
    ctx.storage_state(path=state)
    page.close()
    return ctx


# ------------------------------------------------------------------ {placeholders} -> record ids
_cache = {}


def admin_token():
    state = os.path.join(STATE_DIR, 'beatriz.lacson.json')
    if not os.path.exists(state):
        return None
    for origin in json.load(open(state)).get('origins', []):
        for item in origin.get('localStorage', []):
            if item['name'] == 'accessToken':
                return item['value']
    return None


def api_get(path):
    req = urllib.request.Request(API + path, headers={'Authorization': f'Bearer {admin_token()}'})
    with urllib.request.urlopen(req, timeout=60) as r:
        body = json.loads(r.read())
    data = body.get('data', body)
    if isinstance(data, dict):
        for k in ('items', 'rows', 'data', 'records', 'results', 'leads', 'clients', 'quotations', 'policies', 'claims'):
            if isinstance(data.get(k), list):
                return data[k]
    return data


LOOKUPS = {
    'q': ('/quotations?search={v}&limit=50', 'quotationNumber'),
    'pol': ('/policies?search={v}&limit=50', 'policyNumber'),
    'clm': ('/claims?search={v}&limit=50', 'claimNumber'),
    'lead': ('/leads?search={v}&limit=50', 'leadNumber'),
    'client': ('/clients?search={v}&limit=50', 'clientCode'),
    'end': ('/endorsements/get-All-Endorsements?search={v}&pageNo=1&perPage=50', 'endorsementNumber'),
    'pv': ('/disbursements?voucherNumber={v}&limit=50', 'voucherNumber'),
    'jv': ('/journal-vouchers/history?all=true&limit=200', 'transactionNumber'),
    'bs': ('/broker-slips?search={v}&limit=50', 'slipNumber'),
    'ps': ('/placements?search={v}&limit=50', 'placementNumber'),
    'mec': ('/period-end/close-runs?limit=50', 'runNumber'),
    'brc': ('/bank-reconciliation/reconciliations?limit=50', 'recNumber'),
}


def resolve(kind, value):
    key = (kind, value)
    if key in _cache:
        return _cache[key]
    if kind == 'token':
        url = os.environ.get('DATABASE_URL', 'postgres://brokerverse:brokerverse@127.0.0.1:5432/brokerverse_doc')
        qid = resolve('q', value)
        sql = ("select substring(body_html from 'approve-quote\\?token=([^\"&<]*)') from email_outbox "
               f"where template = 'quote_approval' and entity_id = '{qid}' order by created_at desc limit 1")
        out = subprocess.run(['psql', url, '-Atc', sql], capture_output=True, text=True).stdout.strip()
        _cache[key] = out
        return out
    path, field = LOOKUPS[kind]
    rows = api_get(path.format(v=value)) or []
    rid = next((r.get('id') or r.get('leadId') or r.get('placementId') or r.get('brokerSlipId') for r in rows if r.get(field) == value), None)
    if not rid:
        raise KeyError(f'{kind}:{value} not found')
    _cache[key] = rid
    return rid


def expand(text):
    return re.sub(r'\{(\w+):([^}]+)\}', lambda m: resolve(m.group(1), m.group(2)), text)


# ------------------------------------------------------------------ steps
def guard(locator, what, force=False):
    text = ''
    try:
        text = (locator.inner_text(timeout=3000) or locator.get_attribute('aria-label') or '').strip()
    except Exception:
        pass
    if not force and FORBIDDEN.search(text):
        raise RuntimeError(f'refused to click "{text}" ({what}): it may change data')


def label_input(page, label, kind='input'):
    scope = page.locator('.main__content, .p-dialog:visible').last
    pat = re.compile(rf'^\s*{re.escape(label)}\s*\*?\s*$', re.I)
    lab = scope.locator('label, span, div, p').filter(has_text=pat).filter(has_not=scope.locator('input')).last
    if kind == 'input':
        fid = lab.get_attribute('for')
        if fid and page.locator(f'[id="{fid}"]').count() == 1:
            return page.locator(f'[id="{fid}"]')
        cond = 'self::input[not(@type="hidden") and not(@type="checkbox") and not(@type="radio")] or self::textarea'
        xps = [f'xpath=preceding-sibling::*[{cond}][1]', f'xpath=following-sibling::*[{cond}][1]',
               f'xpath=../*[{cond}][1]', f'xpath=../*//*[{cond}][1]', f'xpath=following::*[{cond}][1]']
    else:
        cond = ('contains(concat(" ",@class," ")," p-dropdown ") or contains(concat(" ",@class," ")," p-multiselect ")'
                ' or contains(concat(" ",@class," ")," p-autocomplete ")')
        xps = [f'xpath=preceding-sibling::*[{cond}][1]', f'xpath=../*[{cond}][1]', f'xpath=../*//*[{cond}][1]',
               f'xpath=following::*[{cond}][1]']
    for xp in xps:
        cand = lab.locator(xp)
        if cand.count():
            return cand.first
    raise RuntimeError(f'field "{label}" not found')


def shoot(page, name, opts):
    os.makedirs(OUT, exist_ok=True)
    png = page.screenshot(full_page=bool(opts.get('full')), clip=opts.get('clip'))
    img = Image.open(io.BytesIO(png)).convert('RGB')
    if img.width > IMG_WIDTH:
        img = img.resize((IMG_WIDTH, round(img.height * IMG_WIDTH / img.width)), Image.LANCZOS)
    img.save(os.path.join(OUT, f'{name}.jpg'), 'JPEG', quality=IMG_QUALITY, optimize=True, progressive=True)
    if TEXT_DIR:
        os.makedirs(TEXT_DIR, exist_ok=True)
        main = page.locator('.main__content')
        text = main.first.inner_text() if main.count() else page.inner_text('body')
        open(os.path.join(TEXT_DIR, f'{name}.txt'), 'w').write(page.url + '\n' + text)
    print(f'  shot {name}', flush=True)


def run_step(page, step):
    kind, *a = step
    opts = a[-1] if a and isinstance(a[-1], dict) else {}
    if opts:
        a = a[:-1]
    force = opts.get('force', False)
    if kind == 'goto':
        page.goto(BASE + expand(a[0])); settle(page, opts.get('wait', 2000))
    elif kind == 'wait':
        page.wait_for_timeout(a[0])
    elif kind == 'viewport':
        page.set_viewport_size({'width': VIEWPORT['width'], 'height': a[0]}); page.wait_for_timeout(500)
    elif kind == 'btn':
        loc = page.get_by_role('button', name=re.compile(a[0], re.I)).nth(opts.get('nth', 0))
        guard(loc, kind, force); loc.click(); settle(page, opts.get('wait', 1500))
    elif kind == 'text':
        loc = page.get_by_text(a[0], exact=opts.get('exact', True)).nth(opts.get('nth', 0))
        guard(loc, kind, force); loc.click(); settle(page, opts.get('wait', 1200))
    elif kind == 'click':
        loc = page.locator(a[0]).nth(opts.get('nth', 0))
        guard(loc, kind, force); loc.click(); settle(page, opts.get('wait', 1200))
    elif kind == 'fill':
        inp = label_input(page, a[0]); inp.click(); inp.fill(''); inp.type(str(a[1]), delay=5); inp.press('Tab')
    elif kind == 'type':
        page.locator(a[0]).nth(opts.get('nth', 0)).fill(str(a[1]))
    elif kind == 'choose':
        dd = label_input(page, a[0], 'dropdown'); dd.click(); page.wait_for_timeout(400)
        panel = page.locator('.p-dropdown-panel:visible, .p-multiselect-panel:visible, .p-autocomplete-panel:visible').last
        flt = panel.locator('input.p-dropdown-filter, input.p-multiselect-filter')
        if flt.count():
            flt.first.fill(str(a[1])); page.wait_for_timeout(300)
        panel.locator('li').filter(has_text=re.compile(re.escape(str(a[1])), re.I)).first.click()
        page.wait_for_timeout(opts.get('wait', 700))
    elif kind == 'open':  # open a dropdown by its label and leave it open for the screenshot
        dd = label_input(page, a[0], 'dropdown'); dd.click(); page.wait_for_timeout(700)
    elif kind == 'key':
        page.keyboard.press(a[0]); page.wait_for_timeout(300)
    elif kind == 'scroll':
        page.mouse.move(900, 500); page.mouse.wheel(0, a[0]); page.wait_for_timeout(opts.get('wait', 700))
    elif kind == 'scrollto':
        page.get_by_text(a[0], exact=opts.get('exact', False)).nth(opts.get('nth', 0)).scroll_into_view_if_needed()
        page.wait_for_timeout(600)
    elif kind == 'hover':
        page.locator(a[0]).nth(opts.get('nth', 0)).hover(); page.wait_for_timeout(600)
    elif kind == 'eval':
        page.evaluate(a[0])
    elif kind == 'mock':  # answer an API call in the browser with a canned body; the server is never called
        body = a[1]
        page.route(a[0], lambda route: route.fulfill(status=200, content_type='application/json', body=body))
    elif kind == 'shot':
        shoot(page, a[0], opts)
    else:
        raise ValueError(f'unknown step {kind}')


def main():
    only = set(sys.argv[1:])
    failures = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROMIUM if os.path.exists(CHROMIUM) else None)
        contexts = {}
        for scene in SCENES + LATE_SCENES:
            if (only and scene['name'] not in only) or (not only and scene in LATE_SCENES):
                continue
            user = scene.get('user')
            print(f"scene {scene['name']} ({user or 'signed out'})", flush=True)
            if user not in contexts:
                contexts[user] = context_for(browser, user)
            page = contexts[user].new_page()
            page.set_viewport_size(VIEWPORT)
            try:
                for step in scene['steps']:
                    run_step(page, step)
            except Exception as e:
                failures.append((scene['name'], str(e).split('\n')[0][:200]))
                print(f"  FAILED {scene['name']}: {failures[-1][1]}", flush=True)
            finally:
                page.close()
        browser.close()
    if failures:
        print('\nScenes that failed:')
        for n, e in failures:
            print(f'  {n}: {e}')


if __name__ == '__main__':
    main()
