"""Collect the database facts used by documents 02 (Database Design) and 03 (Database Inventory).

    DATABASE_URL=postgres://brokerverse:brokerverse@127.0.0.1:5432/brokerverse \
        python3 docs/architecture/tools/collect_db_inventory.py

Read-only: it runs catalogue queries and one SELECT count(*) per table through psql and writes
docs/architecture/tools/data/db_snapshot.json. The build script (build_architecture.py) turns the snapshot into the
inventory tables and the ER diagrams, so the documents can be rebuilt without a database. Re-run it against the
target database (e.g. UAT) to refresh the figures; row counts and sizes of the local test database are test data.
"""
import datetime
import json
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'data', 'db_snapshot.json')
URL = os.environ.get('DATABASE_URL', 'postgres://brokerverse:brokerverse@127.0.0.1:5432/brokerverse')


def q(sql):
    """Rows of a query as lists of strings (psql unaligned, unit separator)."""
    out = subprocess.run(['psql', URL, '-X', '-A', '-t', '-F', '\x1f', '-c', sql], check=True, capture_output=True, text=True).stdout
    return [line.split('\x1f') for line in out.splitlines() if line.strip()]


def main():
    snap = {'collectedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'), 'database': URL.rsplit('/', 1)[-1]}
    snap['version'] = q('SHOW server_version')[0][0]
    snap['timezone'] = q('SHOW timezone')[0][0]
    snap['sizeBytes'] = int(q('SELECT pg_database_size(current_database())')[0][0])
    snap['extensions'] = [{'name': n, 'version': v} for n, v in q('SELECT extname, extversion FROM pg_extension ORDER BY 1')]
    snap['functions'] = [r[0] for r in q("""SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND NOT EXISTS (SELECT 1 FROM pg_depend d JOIN pg_extension e ON e.oid = d.refobjid
        WHERE d.objid = p.oid AND d.deptype = 'e') ORDER BY 1""")]
    snap['triggers'] = [{'name': a, 'table': b} for a, b in q("""SELECT t.tgname, c.relname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
        WHERE c.relnamespace = 'public'::regnamespace AND NOT t.tgisinternal ORDER BY 2, 1""")]
    snap['views'] = [r[0] for r in q("SELECT viewname FROM pg_views WHERE schemaname = 'public' UNION ALL SELECT matviewname FROM pg_matviews WHERE schemaname = 'public' ORDER BY 1")]
    snap['sequences'] = [r[0] for r in q("SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' ORDER BY 1")]
    snap['migrations'] = [{'name': a, 'appliedAt': b} for a, b in q('SELECT name, applied_at FROM schema_migrations ORDER BY name')]
    snap['settingsByGroup'] = {g: int(n) for g, n in q('SELECT "group", count(*) FROM app_settings GROUP BY 1 ORDER BY 1')}
    snap['numberSequences'] = [{'name': a, 'period': b, 'value': int(c)} for a, b, c in q('SELECT name, period, value FROM sequences ORDER BY 1, 2')]
    snap['numberSeries'] = [dict(zip(['code', 'prefix', 'module', 'reset'], r)) for r in q("SELECT code, prefix, coalesce(module, ''), reset_rule FROM document_numbering WHERE active ORDER BY code")]
    snap['scheduledJobs'] = [dict(zip(['code', 'cron', 'handler', 'enabled'], r)) for r in q('SELECT code, cron, handler, enabled FROM scheduled_jobs ORDER BY id')]
    snap['indexCount'] = int(q("SELECT count(*) FROM pg_indexes WHERE schemaname = 'public'")[0][0])
    snap['uniqueIndexCount'] = int(q("SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexdef LIKE 'CREATE UNIQUE%'")[0][0])
    snap['partialIndexes'] = [r[0] for r in q("SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexdef LIKE '% WHERE %' ORDER BY 1")]
    snap['ginIndexes'] = [r[0] for r in q("SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexdef ILIKE '%USING gin%' ORDER BY 1")]
    snap['columnTypes'] = {t: int(n) for t, n in q("SELECT data_type, count(*) FROM information_schema.columns WHERE table_schema = 'public' GROUP BY 1 ORDER BY 2 DESC")}

    tables = {}
    for name, ncols, total, heap, nidx in q("""SELECT c.relname,
            (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = c.relname),
            pg_total_relation_size(c.oid), pg_relation_size(c.oid), (SELECT count(*) FROM pg_index i WHERE i.indrelid = c.oid)
          FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p') ORDER BY 1"""):
        tables[name] = {'columns': int(ncols), 'totalBytes': int(total), 'heapBytes': int(heap), 'indexes': int(nidx),
                        'pk': [], 'unique': [], 'fks': [], 'jsonb': [], 'rows': 0, 'avgRowBytes': None, 'idDefault': None,
                        'hasCreatedAt': False, 'hasUpdatedAt': False, 'hasCreatedBy': False, 'softDelete': None}
    for t, cols in q("""SELECT c.relname, string_agg(a.attname, ',' ORDER BY array_position(i.indkey::int[], a.attnum::int))
          FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
          WHERE i.indisprimary AND c.relnamespace = 'public'::regnamespace GROUP BY c.relname, i.indexrelid"""):
        tables[t]['pk'] = cols.split(',')
    for t, cols in q("""SELECT c.relname, string_agg(a.attname, ',' ORDER BY a.attnum) FROM pg_constraint k
          JOIN pg_class c ON c.oid = k.conrelid JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(k.conkey)
          WHERE k.contype = 'u' AND k.connamespace = 'public'::regnamespace GROUP BY c.relname, k.oid ORDER BY 1"""):
        tables[t]['unique'].append(cols)
    for t, col, rt, rc, rule in q("""SELECT c.relname, a.attname, rc.relname, ra.attname, k.confdeltype FROM pg_constraint k
          JOIN pg_class c ON c.oid = k.conrelid JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.conkey[1]
          JOIN pg_class rc ON rc.oid = k.confrelid JOIN pg_attribute ra ON ra.attrelid = rc.oid AND ra.attnum = k.confkey[1]
          WHERE k.contype = 'f' AND k.connamespace = 'public'::regnamespace ORDER BY 1, 2"""):
        indexed = q(f"""SELECT count(*) FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
              WHERE i.indrelid = 'public.{t}'::regclass AND a.attname = '{col}'""")[0][0]
        tables[t]['fks'].append({'column': col, 'refTable': rt, 'refColumn': rc,
                                 'onDelete': {'a': 'NO ACTION', 'r': 'RESTRICT', 'c': 'CASCADE', 'n': 'SET NULL', 'd': 'SET DEFAULT'}.get(rule, rule),
                                 'indexed': int(indexed) > 0})
    for t, col in q("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND data_type = 'jsonb' ORDER BY table_name, ordinal_position"):
        tables[t]['jsonb'].append(col)
    for t, col in q("""SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'
          AND column_name IN ('created_at', 'updated_at', 'created_by', 'deleted_at')"""):
        key = {'created_at': 'hasCreatedAt', 'updated_at': 'hasUpdatedAt', 'created_by': 'hasCreatedBy'}.get(col)
        if key:
            tables[t][key] = True
        else:
            tables[t]['softDelete'] = 'deleted_at'
    for t, d in q("""SELECT table_name, column_default FROM information_schema.columns WHERE table_schema = 'public'
          AND column_default IS NOT NULL AND column_name IN ('id', 'jti')"""):
        tables[t]['idDefault'] = d
    for t in tables:
        n, avg = q(f'SELECT count(*), COALESCE(round(avg(pg_column_size(x.*))), 0) FROM public."{t}" x')[0]
        tables[t]['rows'] = int(n)
        tables[t]['avgRowBytes'] = int(avg) if int(n) else None
    snap['tables'] = tables
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(snap, f, indent=1, sort_keys=False)
    print(f'{OUT}: {len(tables)} tables, {sum(len(v["fks"]) for v in tables.values())} foreign keys')


if __name__ == '__main__':
    main()
