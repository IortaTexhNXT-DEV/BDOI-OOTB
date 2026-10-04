"""Paths and database access shared by the data dictionary pipeline.

Run the pipeline from a scratch folder (the intermediate db.json, mig.json, vals.json and stats.json are written to the
current folder) with this folder on PYTHONPATH:

    export DD_URL=postgres://brokerverse:brokerverse@127.0.0.1:5432/<throwaway database>   (or DD_DB=<name> to read
                                                    a local database as the postgres user)
    export DD_REFERENCE_ONLY=1                      when the database holds the reference seed data only
    export DD_EXTRA_MIG=<folder>[:<folder>]         migration files applied to the database that are not yet in
                                                    backend/src/db/migrations (branches being merged), optional
    python3 <here>/parse_mig.py && python3 <here>/dump_db.py && python3 <here>/vals.py && python3 <here>/build_xlsx.py
    python3 <here>/fill.py                          refreshes the generated parts of source/data-dictionary.md

Order: build a database with backend/src/db/migrate.js and seed.js (SEED_SAMPLE_DATA=false), apply DD_EXTRA_MIG,
run the scripts above, then build the document with build_all.py data-dictionary.
"""
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
MIGRATIONS = os.path.join(ROOT, 'backend', 'src', 'db', 'migrations')
EXTRA_MIGRATIONS = [d for d in os.environ.get('DD_EXTRA_MIG', '').split(':') if d]
PACKAGE = os.path.join(ROOT, 'docs', 'package')
WORKBOOK = os.path.join(PACKAGE, '07_Technical', 'BrokerVerse_Data_Dictionary.xlsx')
SOURCE_MD = os.path.join(PACKAGE, 'source', 'data-dictionary.md')
ARCH_TOOLS = os.path.join(ROOT, 'docs', 'architecture', 'tools')
DD_DB = os.environ.get('DD_DB', 'golive')
DD_URL = os.environ.get('DD_URL', '')


def migration_files():
    """(file name, full path) of every migration, the repository's and DD_EXTRA_MIG's, in name order."""
    files = {f: os.path.join(MIGRATIONS, f) for f in os.listdir(MIGRATIONS) if f.endswith('.sql')}
    for d in EXTRA_MIGRATIONS:
        for f in os.listdir(d):
            if f.endswith('.sql'):
                files.setdefault(f, os.path.join(d, f))
    return sorted(files.items())


def psql(sql, sep='\x1f'):
    """Rows of a query as lists of strings (psql unaligned output)."""
    if DD_URL:
        cmd = ['psql', DD_URL, '-AtF', sep, '-c', sql]
    else:
        esc = sql.replace('\\', '\\\\').replace('"', '\\"')
        cmd = ['su', 'postgres', '-c', f'psql -d {DD_DB} -AtF "{sep}" -c "{esc}"']
    out = subprocess.run(cmd, capture_output=True, text=True)
    if out.returncode:
        raise Exception(out.stderr)
    return [line.split(sep) for line in out.stdout.split('\n') if line]


def db_label():
    return DD_URL.rsplit('/', 1)[-1] if DD_URL else DD_DB
