"""Capture live BrokerVerse screens for the persona decks, one sign-in per persona.

Run against your OWN copy of the stack (never the shared ports), e.g. the API on 8307 and the production build
served as an SPA on 127.0.0.1:5090 (see docs/e2e/harness.py for a SpaHandler example):

    PERSONA_PASSWORD=... ADMIN_PASSWORD=... python3 docs/decks/tools/capture_screens.py <out_dir> \
        docs/decks/tools/screens.json [user ...]

Screens are written as <out_dir>/<user>__<name>.png (viewport 1600 x 1000) and fed to build_decks.py --shots.
Passwords are read from the environment only. Sign-in is rate limited per address, so a failed sign-in is
retried after a pause.
"""
import json, os, re, sys
from playwright.sync_api import sync_playwright

BASE = os.environ.get('WEB_BASE', 'http://127.0.0.1:5090')
CHROMIUM = os.environ.get('CHROMIUM', '/opt/pw-browsers/chromium')


def settle(page, t=2500):
    try:
        page.wait_for_load_state('networkidle', timeout=20000)
    except Exception:
        pass
    page.wait_for_timeout(t)


def password_for(user):
    return os.environ['ADMIN_PASSWORD'] if user == 'BrokerVerse' else os.environ['PERSONA_PASSWORD']


def login(page, user):
    page.goto(BASE + '/login'); settle(page, 500)
    page.evaluate('() => localStorage.clear()')
    page.goto(BASE + '/login'); settle(page, 800)
    ins = page.locator('input.p-inputtext, input[type=password]')
    ins.nth(0).fill(user); ins.nth(1).fill(password_for(user))
    page.get_by_role('button', name=re.compile('login|sign in', re.I)).click()
    page.wait_for_url(lambda u: '/login' not in u, timeout=30000)
    settle(page, 2500)
    return page.url


def main():
    out, spec_file, only = sys.argv[1], sys.argv[2], sys.argv[3:]
    spec = json.load(open(spec_file))
    os.makedirs(out, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROMIUM if os.path.exists(CHROMIUM) else None)
        for user, items in spec.items():
            if only and user not in only:
                continue
            ctx = browser.new_context(viewport={'width': 1600, 'height': 1000})
            page = ctx.new_page()
            landed = None
            for attempt in range(3):
                try:
                    landed = login(page, user); break
                except Exception:
                    print('sign-in retry', user, attempt, flush=True)
                    page.wait_for_timeout(60000)
            if not landed:
                print('SIGN-IN FAILED', user); ctx.close(); continue
            page.screenshot(path=f'{out}/{user}__landing.png')
            print(user, 'landing', landed, flush=True)
            for it in items:
                try:
                    page.goto(BASE + it['path']); settle(page, it.get('wait', 2500))
                    page.screenshot(path=f"{out}/{user}__{it['name']}.png")
                    print(user, it['name'], page.url.replace(BASE, ''), flush=True)
                except Exception as e:
                    print('ERROR', user, it['name'], str(e)[:150], flush=True)
            ctx.close()
        browser.close()


if __name__ == '__main__':
    main()
