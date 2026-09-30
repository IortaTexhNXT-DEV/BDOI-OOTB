"""UI quality audit: opens every menu screen as one user and measures what a user would notice while it loads.

For each screen it records:
  - layout shift (the Cumulative Layout Shift score from the browser; above 0.1 the page visibly jumps),
  - flicker: how many times a loading mask, skeleton or spinner appears and disappears in the first 4 seconds,
  - console errors and failed API calls (HTTP 400 and above),
  - an empty main area or the error-boundary message,
and keeps one screenshot per screen for a visual review.

    UI_BASE=http://127.0.0.1:3401 AUDIT_USER=BrokerVerse AUDIT_PASSWORD=... MENU_PATHS=/tmp/be/menu_paths.txt python3 ui_audit.py
"""
import json
import os
import re
import sys

from playwright.sync_api import sync_playwright

BASE = os.environ.get('UI_BASE', 'http://127.0.0.1:3401')
USER = os.environ.get('AUDIT_USER', 'BrokerVerse')
PASSWORD = os.environ['AUDIT_PASSWORD']
PATHS = [p.strip() for p in open(os.environ['MENU_PATHS']) if p.strip().startswith('/')]
OUT = os.environ.get('AUDIT_OUT', '/tmp/be/ui_audit')
os.makedirs(f'{OUT}/shots', exist_ok=True)

# Runs in the page before any script: records layout shifts and every appearance of a loading indicator.
OBSERVER = """
window.__audit = { cls: 0, flicker: 0, visible: false };
new PerformanceObserver((list) => {
  // only shifts inside the page content: the sidebar opening the current menu group follows the user's click
  for (const e of list.getEntries()) {
    const inPage = (e.sources || []).some((src) => src.node && src.node.closest && src.node.closest('.main__content'));
    if (!e.hadRecentInput && inPage) window.__audit.cls += e.value;
  }
}).observe({ type: 'layout-shift', buffered: true });
const LOADING = '.p-datatable-loading-overlay, .p-skeleton, .p-progress-spinner, .p-blockui, .loading-overlay, .spinner';
setInterval(() => {
  const on = !!document.querySelector(LOADING);
  if (on && !window.__audit.visible) window.__audit.flicker += 1;
  window.__audit.visible = on;
}, 40);
"""

CHECK = """() => {
  const main = document.querySelector('.main__content') || document.body;
  const text = (main.innerText || '').trim();
  return { cls: +window.__audit.cls.toFixed(3), flicker: window.__audit.flicker,
           crashed: text.includes('Something went wrong on this screen'), empty: text.length < 30,
           title: (document.querySelector('.page-header h1, .page-title, h1, h2') || {}).innerText || '' };
}"""


def login(page):
    page.goto(BASE + '/login')
    page.wait_for_timeout(800)
    inputs = page.locator('input.p-inputtext, input[type=password]')
    inputs.nth(0).fill(USER)
    inputs.nth(1).fill(PASSWORD)
    page.get_by_role('button', name=re.compile('login|sign in', re.I)).click()
    page.wait_for_url(lambda u: '/login' not in u, timeout=20000)
    page.wait_for_timeout(1500)


def main():
    rows = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM', '/opt/pw-browsers/chromium'))
        context = browser.new_context(viewport={'width': 1440, 'height': 900})
        context.add_init_script(OBSERVER)
        page = context.new_page()
        errors, failed = [], []
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('response', lambda r: failed.append(f'{r.status} {r.request.method} {r.url.split("/api")[-1].split("?")[0]}')
                if '/api/' in r.url and r.status >= 400 and r.status != 401 else None)
        login(page)
        page.wait_for_timeout(1000)
        for i, path in enumerate(PATHS, 1):
            errors.clear()
            failed.clear()
            try:
                # in-app navigation, as a user clicking the menu (a full reload only happens on refresh)
                page.evaluate("(p) => { window.__audit.cls = 0; window.__audit.flicker = 0; history.pushState({}, '', p); dispatchEvent(new PopStateEvent('popstate')); }", path)
                page.wait_for_timeout(4000)
                info = page.evaluate(CHECK)
            except Exception as e:  # a screen that does not load is itself a finding
                info = {'cls': None, 'flicker': None, 'crashed': True, 'empty': True, 'title': '', 'error': str(e)[:200]}
            shot = f'{i:03d}{re.sub(r"[^a-z0-9]+", "-", path.lower())[:60]}.png'
            page.screenshot(path=f'{OUT}/shots/{shot}')
            rows.append({'path': path, **info, 'consoleErrors': sorted(set(errors))[:5], 'apiErrors': sorted(set(failed))[:5], 'shot': shot})
            print(f"{i:03d} {path} cls={info.get('cls')} flicker={info.get('flicker')} "
                  f"{'CRASH ' if info.get('crashed') else ''}{'EMPTY ' if info.get('empty') else ''}"
                  f"{len(errors)} console / {len(failed)} api errors", flush=True)
        browser.close()
    json.dump(rows, open(f'{OUT}/audit.json', 'w'), indent=1)
    bad = [r for r in rows if r['crashed'] or r['empty'] or (r['cls'] or 0) > 0.1 or (r['flicker'] or 0) > 1 or r['consoleErrors'] or r['apiErrors']]
    print(f'{len(rows)} screens, {len(bad)} with findings')
    return 0 if not bad else 1


if __name__ == '__main__':
    sys.exit(main())
