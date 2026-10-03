import json,subprocess,re,os
DD_DB = os.environ.get('DD_DB', 'golive')
d=json.load(open('db.json'))
views={t for t,ty in d['tables'] if ty=='VIEW'}
out={}
for r in d['columns']:
    t,c,dt=r[0],r[1],r[3]
    if t in views or dt!='text': continue
    if re.search(r'(^|_)(status|kind|type|stage|mode|category|channel|basis|side|direction|severity|step|source|level|action|decision|outcome|frequency|reset_rule|priority|flag|method|measure|tier|lob|line|storage|audience|provider|regimes?|role_code|entry_type|business_type|line_status)$',c):
        o=subprocess.run(['su','postgres','-c',f'psql -d {DD_DB} -AtF "\x1f" -c "select coalesce({chr(92)}"{c}{chr(92)}",chr(39)||chr(39)), count(*) from {t} group by 1 order by 2 desc limit 40"'],capture_output=True,text=True)
        vals=[l.split('\x1f') for l in o.stdout.split('\n') if l]
        out[f'{t}.{c}']=vals
json.dump(out,open('vals.json','w'),indent=0)
print(len(out))
