"""Empty-column check: opens every menu screen and lists table columns whose cells are all empty while the table has
rows. Such a column almost always reads a field name the API does not return (a typo or an old name).

    UI_BASE=http://127.0.0.1:3401 AUDIT_PASSWORD=... MENU_PATHS=/tmp/be/menu_paths.txt python3 empty_columns.py
"""
import json
import os
import re

from playwright.sync_api import sync_playwright

BASE = os.environ.get('UI_BASE', 'http://127.0.0.1:3401')
PATHS = [p.strip() for p in open(os.environ['MENU_PATHS']) if p.strip().startswith('/')]

# For each data table in the page: header texts and, per column, whether any body cell has text.
SCAN = """() => [...document.querySelectorAll('.main__content .p-datatable')].map((t) => {
  const heads = [...t.querySelectorAll('thead th')].map((th) => th.innerText.trim());
  const rows = [...t.querySelectorAll('tbody tr')].filter((tr) => !tr.classList.contains('p-datatable-emptymessage') && tr.querySelectorAll('td').length > 1);
  const filled = heads.map((_, i) => rows.some((tr) => { const td = tr.querySelectorAll('td')[i]; return td && (td.innerText.replace(/[-–\\s]/g, '') !== '' || td.querySelector('img, i, button, .p-tag, .p-checkbox, .p-inputswitch')); }));
  return { rows: rows.length, empty: heads.filter((h, i) => h && !filled[i]) };
}).filter((t) => t.rows > 0 && t.empty.length)"""


def main():
    findings = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM', '/opt/pw-browsers/chromium'))
        page = browser.new_context(viewport={'width': 1600, 'height': 1000}).new_page()
        page.goto(BASE + '/login')
        page.wait_for_timeout(800)
        inputs = page.locator('input.p-inputtext, input[type=password]')
        inputs.nth(0).fill(os.environ.get('AUDIT_USER', 'BrokerVerse'))
        inputs.nth(1).fill(os.environ['AUDIT_PASSWORD'])
        page.get_by_role('button', name=re.compile('login|sign in', re.I)).click()
        page.wait_for_url(lambda u: '/login' not in u, timeout=20000)
        page.wait_for_timeout(1500)
        for path in PATHS:
            page.evaluate("(p) => { history.pushState({}, '', p); dispatchEvent(new PopStateEvent('popstate')); }", path)
            page.wait_for_timeout(2500)
            for t in page.evaluate(SCAN):
                findings.append({'path': path, **t})
                print(path, t['rows'], 'rows; empty:', ', '.join(t['empty']), flush=True)
        browser.close()
    json.dump(findings, open(os.environ.get('OUT', '/tmp/be/empty_columns.json'), 'w'), indent=1)
    print(f'{len(PATHS)} screens, {len(findings)} tables with empty columns')


if __name__ == '__main__':
    main()
