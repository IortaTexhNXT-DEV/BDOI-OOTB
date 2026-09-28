"""Steps 1-2: sign-in rules and persona users created through Master > User Management by the administrator."""
from harness import *

PERSONAS = [
    ('bea.admin', 'Bea Villanueva', 'Business Administrator', 'ba'),
    ('maria.sales', 'Maria Santos', 'Sales / Relationship Manager', 'sales'),
    ('ramon.agent', 'Ramon Dela Cruz', 'Agent / Referrer', 'agent'),
    ('jose.uw', 'Jose Reyes', 'Underwriter', 'underwriting'),
    ('ana.cs', 'Ana Mercado', 'Customer Services', 'customer-services'),
    ('carlo.claims', 'Carlo Mendoza', 'Claims Officer', 'claims'),
    ('lisa.claims2', 'Lisa Tan', 'Claims Officer', 'claims'),
    ('liza.finance', 'Liza Garcia', 'Finance / Accounts', 'finance'),
    ('fe.approver', 'Felix Aquino', 'Finance / Accounts', 'finance'),
]
PASSWORD = os.environ['PERSONA_PASSWORD']

def run(pg, rec):
    # 1. sign-in
    ok = login(pg, 'BrokerVerse', 'wrong-password')
    msg = toast_text(pg) or ' '.join(error_texts(pg))
    rec.step(pg, 'BrokerVerse', 'Sign-in', 'wrong password', [('sign-in refused', not ok), ('error message shown', bool(msg.strip()), msg[:80])])
    ok = login(pg, 'BrokerVerse', os.environ['ADMIN_PASSWORD'])
    rec.step(pg, 'BrokerVerse', 'Sign-in', 'correct password', [('dashboard opens', ok and '/login' not in pg.url, pg.url)])
    admin = token_for('BrokerVerse', os.environ['ADMIN_PASSWORD'])

    # 2. users through the UI
    menu(pg, 'Master', 'Generals', 'User Management', 'User')
    rec.step(pg, 'BrokerVerse', 'Master > User Management > User', 'open the user list', [('list shows users', pg.locator('tbody tr').count() > 0)])
    pg.goto(BASE + '/master/generals/usermanagement/user/add'); settle(pg)
    save = pg.get_by_role('button', name='Save')
    rec.step(pg, 'BrokerVerse', 'Add User', 'empty form', [('Save disabled until required fields are filled', save.is_disabled())])
    fill(pg, 'Username', 'x.invalid'); fill(pg, 'E-mail', 'not-an-email'); fill(pg, 'Display Name', 'Invalid'); fill(pg, 'Password', PASSWORD)
    pg.get_by_text('Sales / Relationship Manager', exact=True).click(); pg.wait_for_timeout(300)
    invalid_blocked = save.is_disabled() or bool(error_texts(pg))
    if not invalid_blocked:
        save.click(); settle(pg); invalid_blocked = 'error' in (toast_text(pg) or '').lower() or bool(error_texts(pg))
    rec.step(pg, 'BrokerVerse', 'Add User', 'invalid e-mail', [('invalid e-mail refused', invalid_blocked, error_texts(pg)[:2])])

    created = []
    for username, name, role_label, role in PERSONAS:
        pg.goto(BASE + '/master/generals/usermanagement/user/add'); settle(pg)
        fill(pg, 'Username', username); fill(pg, 'E-mail', f'{username}@brokerverse.test'); fill(pg, 'Display Name', name); fill(pg, 'Password', PASSWORD)
        pg.get_by_text(role_label, exact=True).first.click(); pg.wait_for_timeout(300)
        pg.get_by_role('button', name='Save').click(); settle(pg)
        t = toast_text(pg)
        s, u = api('GET', f'/users/{username}', token=admin)
        ok = s == 200 and role in (u.get('data') or {}).get('roles', [])
        created.append(ok)
        rec.step(pg, 'BrokerVerse', 'Add User', f'create {username} ({role})', [('saved in the database with the role', ok, (u.get('data') or {}).get('roles') if s == 200 else s), ('confirmation shown', bool(t), t[:60])])
    # duplicate
    pg.goto(BASE + '/master/generals/usermanagement/user/add'); settle(pg)
    fill(pg, 'Username', 'maria.sales'); fill(pg, 'E-mail', 'dup@brokerverse.test'); fill(pg, 'Display Name', 'Dup'); fill(pg, 'Password', PASSWORD)
    pg.get_by_text('Sales / Relationship Manager', exact=True).first.click(); pg.get_by_role('button', name='Save').click(); settle(pg)
    t = toast_text(pg)
    rec.step(pg, 'BrokerVerse', 'Add User', 'duplicate username', [('duplicate refused with a message', 'exist' in t.lower() or 'duplicate' in t.lower(), t[:80])])
    # each persona can sign in
    for username, *_ in PERSONAS:
        rec_ok = token_for(username, PASSWORD) is not None
        if not rec_ok: print('   cannot sign in:', username)
    return all(created)

if __name__ == '__main__':
    serve(); rec = Recorder()
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium'); pg = b.new_context(viewport={'width': 1600, 'height': 1000}).new_page()
        run(pg, rec); b.close()
