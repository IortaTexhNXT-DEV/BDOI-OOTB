import subprocess, json
def q(sql):
    out=subprocess.run(['su','postgres','-c',f'psql -d golive -AtF "\x1f" -c "{sql}"'],capture_output=True,text=True)
    if out.returncode: raise Exception(out.stderr)
    return [l.split('\x1f') for l in out.stdout.split('\n') if l]
D={}
D['tables']=q("select table_name, table_type from information_schema.tables where table_schema='public' order by 1")
D['columns']=q("select table_name,column_name,ordinal_position,data_type,udt_name,coalesce(character_maximum_length::text,''),coalesce(numeric_precision::text,''),coalesce(numeric_scale::text,''),is_nullable,coalesce(column_default,''),coalesce(datetime_precision::text,'') from information_schema.columns where table_schema='public' order by table_name, ordinal_position")
D['cons']=q("select c.conname, c.contype, cl.relname, coalesce((select string_agg(a.attname, ',' order by k.ord) from unnest(c.conkey) with ordinality k(n,ord) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.n),''), coalesce(fcl.relname,''), coalesce((select string_agg(a.attname, ',' order by k.ord) from unnest(c.confkey) with ordinality k(n,ord) join pg_attribute a on a.attrelid=c.confrelid and a.attnum=k.n),''), c.confdeltype, c.confupdtype, replace(pg_get_constraintdef(c.oid),chr(10),' ') from pg_constraint c join pg_class cl on cl.oid=c.conrelid join pg_namespace n on n.oid=cl.relnamespace left join pg_class fcl on fcl.oid=c.confrelid where n.nspname='public' order by cl.relname, c.conname")
D['indexes']=q("select tablename, indexname, replace(indexdef,chr(10),' ') from pg_indexes where schemaname='public' order by 1,2")
D['idxinfo']=q("select i.relname, ix.indisunique::text, ix.indisprimary::text, coalesce(pg_get_expr(ix.indpred, ix.indrelid),''), am.amname from pg_index ix join pg_class i on i.oid=ix.indexrelid join pg_class t on t.oid=ix.indrelid join pg_namespace n on n.oid=t.relnamespace join pg_am am on am.oid=i.relam where n.nspname='public'")
rows=[]
for t,ty in D['tables']:
    if ty=='BASE TABLE':
        rows.append([t,q(f'select count(*) from public.\\"{t}\\"')[0][0]])
D['rows']=rows
D['settings']=q("select key, \\\"group\\\", label, type, value::text, editable::text from app_settings order by 2,1")
D['views']=q("select viewname, replace(definition,chr(10),' ') from pg_views where schemaname='public'")
D['triggers']=q("select event_object_table, trigger_name, action_timing||' '||event_manipulation from information_schema.triggers where trigger_schema='public' order by 1,2")
json.dump(D,open('db.json','w'))
print({k:len(v) for k,v in D.items()})
