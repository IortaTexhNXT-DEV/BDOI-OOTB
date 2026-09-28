"""Step 5: the agent creates a Motor lead through Operations > Leads/Prospects > Create Lead."""
from harness import *
PASSWORD = os.environ['PERSONA_PASSWORD']
LEAD = dict(first='Andrea', last='Villanueva', preferred='Andi', email='andrea.villanueva@example.ph', phone='9171234567', zip='1226', barangay='San Lorenzo', street='12 Amorsolo St.')

def pick_date(pg, label, day, month, year):
    """Type the date in the configured DD/MM/YYYY form; fall back to MM/DD/YYYY if the picker rejects it."""
    for text in (f'{day:02d}/{month:02d}/{year}', f'{month:02d}/{day:02d}/{year}'):
        fill(pg, label, text); pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
        errs = [e for e in error_texts(pg) if 'required' in e.lower()]
        val = label_el(pg, label).locator('xpath=../*//input[1] | preceding-sibling::input[1]').first.input_value()
        if val and str(year) in val and not errs:
            return text
    return None

def run(pg, rec, ctx):
    tok = token_for('ramon.agent', PASSWORD); ctx['agent_token'] = tok
    s, before = api('GET', '/agent/get-dashboard-details', token=tok)
    leads_before = ((before.get('data') or before).get('funnel') or {}).get('leads') if isinstance(before, dict) else None
    login(pg, 'ramon.agent', PASSWORD)
    menu(pg, 'Operations', 'Leads/Prospects')
    pg.get_by_role('button', name=re.compile('Create Lead', re.I)).click(); pg.wait_for_timeout(500)
    pg.locator('.p-dropdown-panel:visible li').filter(has_text=re.compile(r'^\s*Motor\s*$')).first.click(); settle(pg)
    rec.step(pg, 'ramon.agent', 'Create Lead (Motor)', 'open the form', [('form opens', 'createlead' in pg.url, pg.url)])
    pg.get_by_role('button', name=re.compile('Save & Continue', re.I)).click(); settle(pg, 800)
    errs = error_texts(pg)
    rec.step(pg, 'ramon.agent', 'Create Lead (Motor)', 'save the empty form', [('required-field messages shown', len(errs) >= 5, f'{len(errs)} messages'), ('stays on the form', 'createlead' in pg.url)])
    fill(pg, 'Email ID', 'not-an-email'); fill(pg, 'Contact Number', '12')
    pg.get_by_role('button', name=re.compile('Save & Continue', re.I)).click(); settle(pg, 800)
    errs = ' | '.join(error_texts(pg))
    rec.step(pg, 'ramon.agent', 'Create Lead (Motor)', 'invalid e-mail and contact number', [('e-mail format refused', 'email' in errs.lower() or 'e-mail' in errs.lower(), errs[:160]), ('contact number refused', 'contact' in errs.lower() or 'number' in errs.lower() or 'phone' in errs.lower(), errs[:160])])
    fill(pg, 'First Name', LEAD['first']); fill(pg, 'Last Name', LEAD['last']); fill(pg, 'Preferred Name', LEAD['preferred'])
    ctx['dob_format'] = pick_date(pg, 'Date of Birth', 15, 3, 1988)
    fill(pg, 'Email ID', LEAD['email']); fill(pg, 'Contact Number', LEAD['phone'])
    choose(pg, 'Country', 'Philippines'); pg.wait_for_timeout(800)
    fill(pg, 'ZIP Code', LEAD['zip'])
    choose(pg, 'Province', 'Metro Manila'); pg.wait_for_timeout(800)
    choose(pg, 'City', 'Makati'); pg.wait_for_timeout(500)
    fill(pg, 'Barangay / Subd', LEAD['barangay']); fill(pg, 'House No / Unit No / Street', LEAD['street'])
    rec.step(pg, 'ramon.agent', 'Create Lead (Motor)', 'valid data entered', [('no field errors', not error_texts(pg), error_texts(pg)[:3])])
    pg.get_by_role('button', name=re.compile('Save & Continue', re.I)).click(); settle(pg, 2000)
    t = toast_text(pg)
    s, found = api('GET', f'/leads?search={LEAD["email"]}', token=tok)
    rows = found.get('data') if isinstance(found, dict) else []
    rows = rows if isinstance(rows, list) else (rows or {}).get('leads', [])
    lead = rows[0] if rows else {}
    ctx['lead'] = lead
    rec.step(pg, 'ramon.agent', 'Create Lead (Motor)', 'save', [('saved in the database', bool(lead), json.dumps(lead)[:160]), ('lead number issued', bool(lead.get('leadNumber') or lead.get('leadId') or lead.get('lead_number')), lead.get('leadNumber') or lead.get('leadId')), ('confirmation or next step shown', bool(t) or 'createlead' not in pg.url, t[:60] or pg.url)])
    s, after = api('GET', '/agent/get-dashboard-details', token=tok)
    leads_after = ((after.get('data') or after).get('funnel') or {}).get('leads') if isinstance(after, dict) else None
    menu(pg, 'Dashboard', 'Agent Dashboard') if pg.locator('.sidebar__overall__container').get_by_text('Agent Dashboard', exact=True).count() else None
    rec.step(pg, 'ramon.agent', 'Agent Dashboard', 'lead count after the new lead', [('dashboard lead count +1', leads_before is not None and leads_after == leads_before + 1, f'{leads_before} -> {leads_after}')])
    pg.goto(BASE + '/agent/leadlisting'); settle(pg)
    pg.locator('input.search-input').fill(LEAD['last']); settle(pg, 1500)
    rec.step(pg, 'ramon.agent', 'Leads/Prospects', 'search the new lead', [('listed under Motor', pg.get_by_text(f"{LEAD['first']} {LEAD['last']}").count() > 0)])

if __name__ == '__main__':
    serve(); rec = Recorder(); ctx = {}
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium'); pg = b.new_context(viewport={'width': 1600, 'height': 1000}).new_page()
        run(pg, rec, ctx); b.close()
    print(json.dumps(ctx.get('lead'))[:400])
