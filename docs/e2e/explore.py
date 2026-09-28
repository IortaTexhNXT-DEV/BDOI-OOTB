import sys, json
from harness import *
url = sys.argv[1]; user = sys.argv[2] if len(sys.argv) > 2 else 'BrokerVerse'; pw = sys.argv[3] if len(sys.argv) > 3 else 'Technxt@1'
serve()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium'); pg = b.new_context(viewport={'width': 1600, 'height': 1000}).new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    print('login', login(pg, user, pw))
    pg.goto(BASE + url); settle(pg, 2500)
    for c in sys.argv[4:]:
        kind, _, val = c.partition(':')
        if kind == 'btn': pg.get_by_role('button', name=re.compile(re.escape(val), re.I)).first.click()
        elif kind == 'text': pg.get_by_text(val, exact=True).first.click()
        elif kind == 'dd':
            lab, _, v = val.partition('=')
            pg.locator('.p-dropdown').filter(has_text=lab).first.click(); pg.wait_for_timeout(500)
            pg.locator('.p-dropdown-panel:visible li').filter(has_text=re.compile(re.escape(v), re.I)).first.click()
        elif kind == 'choose': lab, _, v = val.partition('='); choose(pg, lab, v)
        elif kind == 'menuitem': pg.locator('.p-dropdown-panel:visible li, .p-menu:visible li, .p-tieredmenu:visible li, [role=menu]:visible [role=menuitem]').filter(has_text=re.compile(rf'^\s*{re.escape(val)}\s*$')).first.click()
        elif kind == 'fill': lab, _, v = val.partition('='); fill(pg, lab, v)
        settle(pg, 1500)
    pg.screenshot(path='/tmp/explore.png', full_page=True)
    info = pg.evaluate("""()=>{const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0};
      const labels=[...document.querySelectorAll('.main__content label, .p-dialog label')].filter(vis).map(l=>l.innerText.trim()).filter(Boolean);
      const inputs=[...document.querySelectorAll('.main__content input, .main__content textarea, .main__content .p-dropdown, .main__content .p-multiselect, .main__content .p-calendar, .p-dialog input, .p-dialog .p-dropdown')].filter(vis).map(e=>(e.className||'').toString().split(' ')[0]+'|'+(e.name||e.id||'')+'|'+(e.placeholder||''));
      const buttons=[...new Set([...document.querySelectorAll('.main__content button, .p-dialog button')].filter(vis).map(b=>b.innerText.trim()||b.getAttribute('aria-label')||''))];
      return {labels, inputs, buttons}}""")
    print('URL', pg.url); print(json.dumps(info)[:3000]); print('errors', errs)
    b.close()
