"""Persistent browser driven by commands in /tmp/repl/cmd (one JSON list per request); results in /tmp/repl/out."""
import os, time, traceback
from harness import *
D = '/tmp/repl'; os.makedirs(D, exist_ok=True)
serve()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium'); pg = b.new_context(viewport={'width': 1600, 'height': 1000}).new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    open(f'{D}/ready', 'w').write('1')
    while True:
        if not os.path.exists(f'{D}/cmd'): time.sleep(0.2); continue
        cmds = json.load(open(f'{D}/cmd')); os.remove(f'{D}/cmd'); out = []
        for c in cmds:
            try:
                k, *a = c
                if k == 'login': out.append(['login', login(pg, *a)])
                elif k == 'goto': pg.goto(BASE + a[0]); settle(pg, 2000)
                elif k == 'fill': fill(pg, a[0], a[1])
                elif k == 'choose': choose(pg, a[0], a[1]); pg.wait_for_timeout(700)
                elif k == 'btn': pg.get_by_role('button', name=re.compile(a[0], re.I)).nth(a[1] if len(a) > 1 else 0).click(); settle(pg, 2000)
                elif k == 'text': pg.get_by_text(a[0], exact=True).nth(a[1] if len(a) > 1 else 0).click(); settle(pg, 1500)
                elif k == 'click': pg.locator(a[0]).nth(a[1] if len(a) > 1 else 0).click(); settle(pg, 1500)
                elif k == 'options':
                    lab = label_el(pg, a[0]); lab.locator('xpath=preceding-sibling::*[contains(@class,"p-dropdown")][1] | ../*[contains(@class,"p-dropdown")][1] | following::*[contains(@class,"p-dropdown ")][1]').first.click(); pg.wait_for_timeout(600)
                    out.append([a[0], pg.locator('.p-dropdown-panel:visible li').all_inner_texts()[:20]]); pg.keyboard.press('Escape')
                elif k == 'upload': pg.locator('input[type=file]').nth(a[1] if len(a) > 1 else 0).set_input_files(a[0]); settle(pg, 2000)
                elif k == 'eval': out.append(['eval', pg.evaluate(a[0])])
                elif k == 'wait': pg.wait_for_timeout(a[0])
                elif k == 'shot': pg.screenshot(path=a[0], full_page=len(a) > 1 and a[1])
                elif k == 'page':
                    out.append(['page', pg.url, pg.evaluate("""()=>{const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0};
                    return {labels:[...document.querySelectorAll('.main__content label, .p-dialog label')].filter(vis).map(l=>l.innerText.trim()).filter(Boolean),
                    buttons:[...new Set([...document.querySelectorAll('.main__content button, .p-dialog button')].filter(vis).map(b=>b.innerText.trim()).filter(Boolean))]}}""")])
                out.append(['ok', c[0], pg.url, error_texts(pg)[:5], toast_text(pg)[:120] if k in ('btn', 'text', 'click') else ''])
            except Exception as e:
                out.append(['ERR', c, str(e).split('\n')[0][:300]])
                break
        out.append(['jserrors', errs[-5:]]); errs.clear()
        json.dump(out, open(f'{D}/out.tmp', 'w')); os.replace(f'{D}/out.tmp', f'{D}/out')
