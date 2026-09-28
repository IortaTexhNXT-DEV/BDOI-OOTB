import sys, os, json, re
from common import *
OUT=os.environ.get('SHOT_DIR','/home/user/FinVerse/tools/user-manual/screens')
os.makedirs(OUT, exist_ok=True)
INV_JS = r"""() => {
 const vis = e => { const r=e.getBoundingClientRect(); const s=getComputedStyle(e); return r.width>0 && r.height>0 && s.visibility!=='hidden' && s.display!=='none'; };
 const main = document.querySelector('.protected__layout__content, main, [class*=content]') || document.body;
 const txt = e => (e.innerText||e.textContent||'').replace(/\s+/g,' ').trim();
 const uniq = a => [...new Set(a.filter(Boolean))];
 const scope = document.body;
 const inSidebar = e => !!e.closest('.protected__layout__sidebar__container');
 const headings = uniq([...scope.querySelectorAll('h1,h2,h3,h4,h5,.p-card-title,.p-dialog-title')].filter(e=>vis(e)&&!inSidebar(e)).map(txt));
 const tabs = uniq([...scope.querySelectorAll('[role=tab], .p-tabview-nav li, .p-tabmenuitem, .p-steps-item')].filter(e=>vis(e)&&!inSidebar(e)).map(txt));
 const columns = uniq([...scope.querySelectorAll('th')].filter(e=>vis(e)).map(txt));
 const buttons = uniq([...scope.querySelectorAll('button, [role=button], a.p-button')].filter(e=>vis(e)&&!inSidebar(e)).map(e=>txt(e)||e.getAttribute('aria-label')||e.getAttribute('title')||''));
 const fields=[];
 const ctrls=[...scope.querySelectorAll('input, select, textarea, .p-dropdown, .p-multiselect, .p-calendar, .p-inputnumber, .p-checkbox, .p-radiobutton, .p-inputswitch')].filter(e=>vis(e)&&!inSidebar(e));
 const done=new Set();
 for (const c of ctrls){
   if (c.closest('.p-dropdown,.p-multiselect,.p-calendar,.p-inputnumber,.p-checkbox,.p-radiobutton,.p-inputswitch') && c.closest('.p-dropdown,.p-multiselect,.p-calendar,.p-inputnumber,.p-checkbox,.p-radiobutton,.p-inputswitch')!==c) continue;
   if (c.classList.contains('menu-search-input')) continue;
   if (c.getBoundingClientRect().top < 60 && !c.closest('.p-dialog')) continue;
   if (done.has(c)) continue; done.add(c);
   let label='';
   if (c.id){ const l=document.querySelector(`label[for="${CSS.escape(c.id)}"]`); if(l) label=txt(l); }
   if(!label){ let p=c.parentElement; for(let i=0;i<3&&p&&!label;i++){ const ls=[...p.querySelectorAll('label, .p-float-label label, span.label, .form-label')].filter(l=>!l.contains(c)); if(ls.length===1||(ls.length&&i===0)) label=txt(ls[0]); p=p.parentElement; } }
   if(!label){ const f=c.closest('.p-float-label'); if(f){const l=f.querySelector('label'); if(l) label=txt(l);} }
   const cls=c.className||'';
   let type = c.tagName.toLowerCase()==='input' ? (c.getAttribute('type')||'text') : c.tagName.toLowerCase();
   if (/p-dropdown/.test(cls)) type='dropdown'; else if (/p-multiselect/.test(cls)) type='multi-select'; else if (/p-calendar/.test(cls)) type='date'; else if(/p-inputnumber/.test(cls)) type='number'; else if(/p-checkbox/.test(cls)) type='checkbox'; else if(/p-radiobutton/.test(cls)) type='radio'; else if(/p-inputswitch/.test(cls)) type='switch';
   const inp = c.matches('input,textarea,select')?c:c.querySelector('input,textarea,select');
   fields.push({label, type, required: /\*/.test(label) || !!(inp&&inp.required), placeholder: (inp&&inp.placeholder) || txt(c.querySelector('.p-dropdown-label,.p-multiselect-label')||document.createElement('i')), value: inp&&inp.value||'', disabled: !!(inp&&inp.disabled) || /p-disabled/.test(cls), readonly: !!(inp&&inp.readOnly)&&type!=='dropdown'&&type!=='date'});
 }
 const isRed = e => { const m=getComputedStyle(e).color.match(/\d+/g); return m && +m[0]>170 && +m[1]<90 && +m[2]<90; };
 const redLeaves = [...scope.querySelectorAll('small,span,div,p,label')].filter(e=>vis(e)&&!inSidebar(e)&&e.children.length===0&&isRed(e)&&!e.closest('button,.p-tag,.p-badge,td,th')&&/[a-z]/.test(txt(e))&&/\s/.test(txt(e))&&txt(e).length<200);
 for (const f of fields) f.error='';
 { const ctrlList=ctrls.filter(c=>done.has(c));
   ctrlList.forEach((c,i)=>{ let p=c.parentElement; for(let k=0;k<4&&p;k++){ const r=redLeaves.find(e=>p.contains(e)&&!/\*$/.test(txt(e))); if(r){ fields[i].error=txt(r); break;} p=p.parentElement; } }); }
 const errors = uniq(redLeaves.map(txt).concat([...scope.querySelectorAll('.p-error, small.p-invalid, .p-toast-message, .p-message, [class*=error-message], [class*=errorMessage], .error, .text-danger, .text-red-500, .invalid-feedback, [role=alert]')].filter(vis).map(txt)));
 const dialog = [...document.querySelectorAll('.p-dialog')].filter(vis).map(txt).join(' | ').slice(0,1500);
 const text = txt(document.querySelector('.protected__layout__content') || document.body).slice(0,4000);
 const rows = [...scope.querySelectorAll('tbody tr')].filter(vis).length;
 return {headings, tabs, columns, buttons, fields, errors, dialog, rows, text};
}"""
def settle(pg, t=2000):
    try: pg.wait_for_load_state('networkidle', timeout=15000)
    except Exception: pass
    pg.wait_for_timeout(t)
NEUTRAL = r"""() => { const w=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while((n=w.nextNode())){ let t=n.nodeValue; const o=t; t=t.replace(/BANCO DE ORO/gi,'SAMPLE BANK').replace(/\bBDOI\b/g,'Default').replace(/BDOSOTTO/g,'SMPSOTTO').replace(/\bBDO-/g,'SMP-').replace(/\/bdo\.png/gi,'/logo.png').replace(/\bBDO\b/g,'Default'); if(t!==o) n.nodeValue=t; }
 document.querySelectorAll('input').forEach(i=>{ if(/bdo|banco de oro/i.test(i.value)) i.value=i.value.replace(/banco de oro/gi,'SAMPLE BANK').replace(/\/bdo\.png/gi,'/logo.png').replace(/bdo/gi,'Default'); }); }"""
HUMANIZE = r"""() => { const hum = k => { const last=k.split('.').pop(); let t=last.replace(/([a-z0-9])([A-Z])/g,'$1 $2'); t=t.charAt(0).toUpperCase()+t.slice(1); return t.replace(/\bGl\b/g,'GL').replace(/\bId\b/g,'ID').replace(/ Title$/,''); };
 const re=/\b(?:remittance|reinsurance|common)(?:\.[a-zA-Z]\w*)+/g;
 const w=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while((n=w.nextNode())){ if(re.test(n.nodeValue)){ re.lastIndex=0; n.nodeValue=n.nodeValue.replace(re, hum);} re.lastIndex=0; }
 document.querySelectorAll('input[placeholder]').forEach(i=>{ if(/(remittance|reinsurance)\./.test(i.placeholder)) i.placeholder=i.placeholder.replace(re, hum); }); }"""
def clean(pg, keep_toasts=False):
    try: pg.evaluate(NEUTRAL); pg.evaluate(HUMANIZE)
    except Exception: pass
    if not keep_toasts:
        try:
            pg.wait_for_function("()=>!document.querySelector('.p-toast-message')", timeout=6000)
        except Exception:
            pg.add_style_tag(content='.p-toast{display:none!important}')
def shot(pg, key, keep_toasts=False):
    clean(pg, keep_toasts)
    path=f'{OUT}/{key}.png'
    pg.screenshot(path=path)
    return os.path.basename(path)
def inv(pg): return pg.evaluate(INV_JS)
