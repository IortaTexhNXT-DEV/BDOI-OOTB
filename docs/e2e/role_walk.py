"""Role walk: sign in as one user per role, open every screen that role's menu offers and record what went wrong.

For each screen it checks the page for the error-boundary message ("Something went wrong on this screen") and for
"Not authorised" on a screen the menu itself offered. API answers of 400 and above made while the role walked are
read from the backend log (pino JSON lines) by time window, so a screen that calls an endpoint the role may not use
shows up as a 403 against that role.

Needs the persistent browser (repl.py, driven through r.sh), the API on API_URL and the backend log at BACKEND_LOG.
The menu paths per role come from ROLE_MENUS (exported from the front end's own menu and permission code).

    PERSONA_PASSWORD=... ROLE_MENUS=role_menus.json BACKEND_LOG=/tmp/be/main.log python3 role_walk.py
"""
import json
import os
import subprocess
import time

HERE = os.path.dirname(os.path.abspath(__file__))
PASSWORD = os.environ['PERSONA_PASSWORD']
MENUS = json.load(open(os.environ['ROLE_MENUS']))
LOG = os.environ.get('BACKEND_LOG', '/tmp/be/main.log')
OUT = os.environ.get('WALK_OUT', os.path.join(HERE, 'ROLE_WALK.md'))

USERS = [
    ('system-admin', 'bea.admin', 'System Administrator (Super Admin Access)'),
    ('sales', 'maria.sales', 'Sales & Marketing (Account Executive)'),
    ('processing', 'jose.uw', 'Processing Team (Placement & Policy Processing)'),
    ('operations', 'ana.cs', 'Operations (Client Servicing)'),
    ('claims', 'carlo.claims', 'Claims'),
    ('accounting', 'liza.finance', 'Accounting'),
    ('accounting-manager', 'acct.manager', 'Accounting Manager'),
]

CHECK_JS = """() => { const t = document.body ? document.body.innerText : '';
  return { path: location.pathname, crashed: t.includes('Something went wrong on this screen'),
           denied: /not authori[sz]ed/i.test(t), empty: t.trim().length < 40 }; }"""


def repl(cmds):
    out = subprocess.run([os.path.join(HERE, 'r.sh'), json.dumps(cmds)], capture_output=True, text=True, timeout=900).stdout
    return [json.loads(line) for line in out.splitlines() if line.strip().startswith('[')]


def api_errors(since_ms, until_ms):
    """Requests answered with 400 or more between the two times, as (status, method, url)."""
    found = []
    with open(LOG, encoding='utf-8', errors='ignore') as f:
        for line in f:
            if '"res":' not in line:
                continue
            try:
                e = json.loads(line)
            except ValueError:
                continue
            code = (e.get('res') or {}).get('statusCode', 0)
            if since_ms <= e.get('time', 0) <= until_ms and code >= 400 and code != 401:
                found.append((code, e['req']['method'], e['req']['url'].split('?')[0]))
    return found


def walk(role, user, label):
    started = int(time.time() * 1000)
    repl([['login', user, PASSWORD]])
    screens, problems = MENUS[role], []
    for i in range(0, len(screens), 25):
        cmds = []
        for s in screens[i:i + 25]:
            cmds += [['goto', s['path']], ['wait', 600], ['eval', CHECK_JS]]
        results = [r for r in repl(cmds) if r and r[0] == 'eval']
        for s, r in zip(screens[i:i + 25], results):
            v = r[1] or {}
            if v.get('crashed') or v.get('denied'):
                problems.append((s['name'], s['path'], 'screen crashed' if v.get('crashed') else 'not authorised'))
    finished = int(time.time() * 1000)
    errors = sorted(set(api_errors(started, finished)))
    return {'role': role, 'label': label, 'user': user, 'screens': len(screens), 'problems': problems, 'apiErrors': errors}


def main():
    results = [walk(*u) for u in USERS]
    lines = ['# Role walk', '', f'Run {time.strftime("%d %b %Y %H:%M")} against the local system with sample data. One user per role',
             'signs in and opens every screen its menu offers.', '',
             '| Role | User | Screens opened | Screen problems | API answers of 400 or more |', '|---|---|---|---|---|']
    for r in results:
        lines.append(f"| {r['label']} | {r['user']} | {r['screens']} | {len(r['problems'])} | {len(r['apiErrors'])} |")
    for r in results:
        if r['problems'] or r['apiErrors']:
            lines += ['', f"## {r['label']}", '']
            lines += [f'- {name} (`{path}`): {what}' for name, path, what in r['problems']]
            lines += [f'- API {code} on {method} `{url}`' for code, method, url in r['apiErrors']]
    open(OUT, 'w').write('\n'.join(lines) + '\n')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
