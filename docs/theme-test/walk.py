import sys, re
from capture import *
CREATE=re.compile(r'^\+?\s*(create|add|new|initiate|request|disbursement|receipts|replenish|upload template|map product)\b', re.I)
SUBMIT=re.compile(r'^(save|submit|next|continue|proceed|create|add|save & next|save and next|save as draft|generate|calculate|search|apply)\b', re.I)
def slug(parts): return re.sub(r'[^a-z0-9]+','-','-'.join(parts).lower()).strip('-')[:70]
def main_area(pg): return pg.locator('.protected__layout__content') if pg.locator('.protected__layout__content').count() else pg.locator('body')
def click_text(pg, text, scope=None):
    scope=scope or main_area(pg)
    loc=scope.get_by_text(text, exact=True)
    for i in range(loc.count()):
        e=loc.nth(i)
        if e.is_visible():
            e.click(timeout=5000); return True
    return False
def capture(pg, key, rec, label):
    settle(pg); data=inv(pg); rec[label]={'url':pg.url[len(BASE):], 'shot':shot(pg,key, keep_toasts=label.endswith(':validation')), **data}
    return rec[label]
def do_tabs(pg, key, rec, base):
    for i,t in enumerate(base.get('tabs',[])[1:12],1):
        try:
            def _h(x):
                return re.sub(r'\b(?:remittance|reinsurance|common)(?:\.[a-zA-Z]\w*)+', lambda m: (lambda s: s[:1].upper()+s[1:])(re.sub(r'([a-z0-9])([A-Z])', r'\1 \2', m.group(0).split('.')[-1])), x)
            loc=pg.locator('[role=tab], .p-tabview-nav li, .p-tabmenuitem').filter(has_text=t).first
            if not loc.count(): loc=pg.locator('[role=tab], .p-tabview-nav li, .p-tabmenuitem').filter(has_text=_h(t)).first
            loc.click(timeout=5000); capture(pg, f'{key}--tab-{slug([t])}', rec, f'tab:{t}')
        except Exception as e: rec[f'tab:{t}']={'error':str(e)[:200]}
def try_submit(pg, key, rec, label):
    dlg=pg.locator('.p-dialog:visible')
    scope=dlg.last if dlg.count() else main_area(pg)
    btns=scope.locator('button:visible')
    names=[(btns.nth(i).inner_text() or '').strip() for i in range(btns.count())]
    for i,n in enumerate(names):
        if n and SUBMIT.match(n) and not re.match(r'search', n, re.I):
            try:
                btns.nth(i).click(timeout=5000); pg.wait_for_timeout(1500)
                r=capture(pg, f'{key}--validation', rec, f'{label}:validation'); r['pressed']=n
            except Exception as e: rec[f'{label}:validation']={'error':str(e)[:200]}
            return
if __name__=='__main__':
    screens=json.load(open(sys.argv[1])); out_path=sys.argv[2]
    INV=json.load(open(out_path)) if os.path.exists(out_path) else {}
    with sync_playwright() as p:
        b,c=open_ctx(p); guard(c); pg=c.new_page()
        for s in screens:
            if not s.get('url'): continue
            key=slug(s['menu'])
            if key in INV and not INV[key].get('error'): continue
            rec={'menu':s['menu']}
            try:
                pg.goto(BASE+s['url']); base=capture(pg,key,rec,'main')
                do_tabs(pg,key,rec,base)
                # create-type buttons
                pg.goto(BASE+s['url']); settle(pg)
                made=0
                for bname in base['buttons']+[f['placeholder'] for f in base['fields'] if f['type']=='dropdown' and CREATE.match(f['placeholder'] or '')]:
                    if made>=2: break
                    if CREATE.match(bname or '') and bname not in [x.split('>')[0][5:] for x in rec if x.startswith('menu:')]:
                        try:
                            pg.goto(BASE+s['url']); settle(pg)
                            if not click_text(pg, bname):
                                pg.get_by_role('button', name=bname).first.click(timeout=5000)
                            pg.wait_for_timeout(800)
                            menu=pg.locator('.p-menu:visible, .p-tieredmenu:visible, .p-overlaypanel:visible, [role=menu]:visible, .p-dropdown-panel:visible')
                            if menu.count() and pg.url.endswith(s['url']):
                                items=[x.strip() for x in menu.first.locator('.p-menuitem-text, [role=menuitem], .p-dropdown-item').all_inner_texts() if x.strip()]
                                rec[f'menu:{bname}']={'items':items,'shot':shot(pg,f'{key}--{slug([bname])}-menu')}
                                for it in items[:5]:
                                    try:
                                        pg.goto(BASE+s['url']); settle(pg)
                                        if not click_text(pg,bname): pg.get_by_role('button', name=bname).first.click(timeout=5000)
                                        pg.wait_for_timeout(800)
                                        pg.locator('.p-menu:visible, .p-tieredmenu:visible, [role=menu]:visible, .p-dropdown-panel:visible').first.get_by_text(it, exact=True).first.click(timeout=5000)
                                        fk=f'{key}--{slug([bname,it])}'; r=capture(pg, fk, rec, f'form:{bname}>{it}')
                                        if r.get('tabs'): do_tabs(pg, fk, rec, r)
                                        try_submit(pg, fk, rec, f'form:{bname}>{it}')
                                    except Exception as e: rec[f'form:{bname}>{it}']={'error':str(e)[:200]}
                                made+=1; continue
                            lab=f'form:{bname}'; fk=f'{key}--{slug([bname])}'
                            r=capture(pg, fk, rec, lab)
                            do_tabs(pg, fk, rec, r) if r.get('tabs') and not r['url']==s['url'] else None
                            try_submit(pg, fk, rec, lab); made+=1
                            pg.keyboard.press('Escape')
                        except Exception as e: rec[f'form:{bname}']={'error':str(e)[:200]}
                if made==0 and not any(l.startswith('form:') for l in rec):
                    try:
                        pg.goto(BASE+s['url']); settle(pg)
                        if click_text(pg,'Add'):
                            r=capture(pg, f'{key}--add', rec, 'form:Add'); 
                            if r.get('tabs'): do_tabs(pg, f'{key}--add', rec, r)
                            try_submit(pg, f'{key}--add', rec, 'form:Add')
                    except Exception as e: pass
                if len([f for f in base.get('fields',[]) if f['label']])>=3:
                    try:
                        pg.goto(BASE+s['url']); settle(pg)
                        b2=main_area(pg).locator('button:visible'); 
                        for i in range(b2.count()):
                            nm=(b2.nth(i).inner_text() or '').strip()
                            if re.match(r'^(generate|save configuration|next|search)$', nm, re.I):
                                b2.nth(i).click(timeout=5000); pg.wait_for_timeout(1500)
                                r=capture(pg, f'{key}--validation', rec, 'main:validation'); r['pressed']=nm; break
                    except Exception as e: rec['main:validation']={'error':str(e)[:200]}
                # first record detail
                if base.get('rows'):
                    try:
                        pg.goto(BASE+s['url']); settle(pg)
                        row=main_area(pg).locator('tbody tr').first
                        icons=row.locator('button, .pi-arrow-right, .pi-eye, a, svg')
                        target=None
                        for sel in ['.pi-eye','.pi-arrow-right','button:has(.pi-eye)','[title*=View i]','[aria-label*=View i]','a']:
                            if row.locator(sel).count(): target=row.locator(sel).last; break
                        if target is None:
                            cands=row.locator('button, svg')
                            for ci in range(cands.count()):
                                h=cands.nth(ci).evaluate("e=>(e.outerHTML+' '+(e.getAttribute('title')||'')+' '+(e.getAttribute('aria-label')||'')).toLowerCase()")
                                if not re.search(r'trash|delete|remove|reject|times|ban|close|cancel|pencil|edit|toggle|switch', h): target=cands.nth(ci); break
                        before=pg.url
                        (target or row.locator('td').first).click(timeout=5000); settle(pg,2500)
                        if pg.url!=before or pg.locator('.p-dialog:visible').count():
                            r=capture(pg, f'{key}--record', rec, 'record'); do_tabs(pg, f'{key}--record', rec, r)
                    except Exception as e: rec['record']={'error':str(e)[:200]}
            except Exception as e:
                rec['error']=str(e)[:300]
            INV[key]=rec; json.dump(INV,open(out_path,'w'),indent=1)
            print(key, list(rec.keys()), flush=True)
        print('WRITES_BLOCKED', WRITES, flush=True)
        json.dump(WRITES, open(out_path+'.writes.json','w'), indent=1)
        b.close()
