import re, os, json, glob
MIG='/home/user/BDOI-OOTB/backend/src/db/migrations'
created={}   # table -> migration
colmig={}    # (table,col) -> migration that added
comments={}  # (table,col) -> comment
tablecomment={} # table -> preceding comment
KW=('primary','unique','constraint','foreign','check','exclude','like')
def strip_q(s): return s.strip().strip('"').lower()
for f in sorted(os.listdir(MIG)):
    txt=open(os.path.join(MIG,f)).read()
    lines=txt.split('\n')
    i=0; cur=None; prevcomment=[]
    while i<len(lines):
        L=lines[i]
        m=re.match(r'\s*create table (?:if not exists )?(?:public\.)?"?([a-z_0-9]+)"?\s*\(?(.*)$',L,re.I)
        if m:
            t=m.group(1).lower(); created.setdefault(t,f); cur=t
            if prevcomment: tablecomment.setdefault(t,' '.join(prevcomment))
            rest=m.group(2)
            if rest.strip():
                lines[i]=rest  # parse the remainder of the line as body
                continue
            i+=1
            continue
        if cur:
            s=L
            code,_,com=s.partition('--')
            com=com.strip()
            if re.match(r'\s*\)\s*;',code) or re.match(r'^\s*\);?\s*$',code) and code.strip().startswith(')'):
                cur=None; prevcomment=[]; i+=1; continue
            # split columns in code by top-level commas
            parts=[]; d=0; b=''
            for ch in code:
                if ch=='(' : d+=1
                if ch==')' : d-=1
                if ch==',' and d==0: parts.append(b); b=''
                else: b+=ch
            parts.append(b)
            cols=[]
            for p in parts:
                p=p.strip()
                if not p: continue
                w=p.split()[0]
                if w.lower() in KW: continue
                cols.append(strip_q(w))
            for c in cols:
                colmig.setdefault((cur,c),f)
            if com and cols:
                tgt=cols[-1]
                if len(cols)>1 and '|' in com:
                    st=[c for c in cols if re.search(r'status|type|kind|mode|stage|state|category|channel|method|basis|side',c)]
                    if st: tgt=st[-1]
                comments.setdefault((cur,tgt),com)
            if code.strip().endswith(');'): cur=None
            i+=1; continue
        # alter table add column
        m=re.match(r'\s*alter table (?:if exists )?(?:only )?"?([a-z_0-9]+)"?(.*)$',L,re.I)
        if m:
            t=m.group(1).lower()
            # gather statement until ;
            stmt=[L]; j=i
            while not lines[j].split('--')[0].rstrip().endswith(';') and j+1<len(lines):
                j+=1; stmt.append(lines[j])
            for SL in stmt:
                code,_,com=SL.partition('--'); com=com.strip()
                for mm in re.finditer(r'add column (?:if not exists )?"?([a-z_0-9]+)"?',code,re.I):
                    c=mm.group(1).lower(); colmig.setdefault((t,c),f)
                    if com: comments.setdefault((t,c),com)
            i=j+1; continue
        if L.strip().startswith('--'):
            prevcomment.append(L.strip()[2:].strip())
        elif L.strip(): prevcomment=[]
        i+=1
json.dump({'created':created,'colmig':{f'{a}.{b}':v for (a,b),v in colmig.items()},
 'comments':{f'{a}.{b}':v for (a,b),v in comments.items()},'tablecomment':tablecomment},open('mig.json','w'),indent=0)
print(len(created),len(colmig),len(comments))
