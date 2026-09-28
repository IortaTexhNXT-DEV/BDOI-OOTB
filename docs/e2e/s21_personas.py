"""Step 21: persona access. For each persona: sign in through the UI, record the menu it sees, open an
address its role must not reach (expects "Not authorised"), and call one API action its role must not
perform (expects 403). Drives the persistent browser (repl.py) and the API; writes persona_access.json/.md."""
import json, os, subprocess, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
API = os.environ.get('API', 'http://localhost:8000/api')
PW = os.environ['PERSONA_PASSWORD']

# user, persona, forbidden screen, forbidden API call (method, path, body)
CASES = [
    ('bea.admin', 'Business Administrator', None, None),
    ('maria.sales', 'Sales / Relationship Manager', '/accounts/journalvoucher', ('POST', '/journal-vouchers', {'transactionCode': 'JV', 'entries': []})),
    ('ramon.agent', 'Agent / Referrer', '/accounts/receipts', ('GET', '/receipts', None)),
    ('jose.uw', 'Underwriter', '/accounts/paymentvoucher', ('POST', '/journal-vouchers', {'transactionCode': 'JV', 'entries': []})),
    ('ana.cs', 'Customer Services', '/master/configuration/settings', ('POST', '/journal-vouchers', {'transactionCode': 'JV', 'entries': []})),
    ('carlo.claims', 'Claims Officer', '/accounts/paymentvoucher', ('POST', '/disbursements', {})),
    ('liza.finance', 'Finance / Accounts', '/master/configuration/settings', ('POST', '/users', {'username': 'x.blocked', 'password': 'Blocked@2026', 'displayName': 'X', 'roles': ['sales']})),
    ('carmela.morfe', 'User Access Administrator', '/accounts/receipts', ('GET', '/policies', None)),
]
PASSWORDS = {'carmela.morfe': os.environ.get('UAA_PASSWORD', '')}

MENU_JS = """() => { const t = e => (e.innerText || '').trim();
  return [...document.querySelectorAll('.sidebar__container .p-menuitem > a, .sidebar__container [class*=menu] > a, nav a, .p-panelmenu-header-link, .sidebar-item-title, .menu-title')]
    .map(t).filter(x => x && x.length < 40).filter((x, i, a) => a.indexOf(x) === i).slice(0, 40); }"""
TOP_JS = """() => [...document.querySelectorAll('aside *, .sidebar *, [class*=sidebar] *')]
  .filter(e => e.children.length === 0 && /^(Dashboard|Product Configurator|Master|Operations|Accounts|Commission|Reinsurance|Reports)$/.test((e.innerText||'').trim()))
  .map(e => e.innerText.trim()).filter((x, i, a) => a.indexOf(x) === i)"""


def repl(cmds):
    out = subprocess.run([os.path.join(HERE, 'r.sh'), json.dumps(cmds)], capture_output=True, text=True, timeout=280).stdout
    return [json.loads(l) for l in out.splitlines() if l.strip().startswith('[')]


def api(method, path, body=None, token=None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Content-Type': 'application/json', **({'Authorization': f'Bearer {token}'} if token else {})})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b'{}')


rows = []
for user, persona, screen, call in CASES:
    pw = PASSWORDS.get(user) or PW
    status, body = api('POST', '/auth/login', {'username': user, 'password': pw})
    token = body.get('accessToken')
    rec = {'user': user, 'persona': persona, 'signIn': status == 200}
    res = repl([['login', user, pw], ['wait', 1500], ['eval', TOP_JS], ['shot', f'/tmp/repl/persona_{user}.png']])
    rec['menu'] = next((x[1] for x in res if x[0] == 'eval'), [])
    if screen:
        res = repl([['goto', screen], ['wait', 2500], ['eval', "() => /not authori[sz]ed/i.test(document.body.innerText)"],
                    ['shot', f'/tmp/repl/persona_{user}_forbidden.png']])
        rec['forbiddenScreen'] = screen
        rec['screenBlocked'] = next((x[1] for x in res if x[0] == 'eval'), None)
    if call and token:
        code, b = api(call[0], call[1], call[2], token)
        rec['forbiddenApi'] = f'{call[0]} {call[1]}'
        rec['apiStatus'] = code
        rec['apiMessage'] = (b.get('message') or '')[:80]
    rows.append(rec)
    print(json.dumps(rec), flush=True)

json.dump(rows, open(os.path.join(HERE, 'persona_access.json'), 'w'), indent=1)
L = ['# Persona access (step 21)\n', '| User | Persona | Menu shown | Forbidden screen | Blocked | Forbidden API call | Status |', '|---|---|---|---|---|---|---|']
for r in rows:
    L.append(f"| {r['user']} | {r['persona']} | {', '.join(r['menu']) or '-'} | {r.get('forbiddenScreen') or '-'} | "
             f"{'yes' if r.get('screenBlocked') else ('-' if 'screenBlocked' not in r else 'NO')} | {r.get('forbiddenApi') or '-'} | {r.get('apiStatus', '-')} |")
open(os.path.join(HERE, 'persona_access.md'), 'w').write('\n'.join(L) + '\n')
