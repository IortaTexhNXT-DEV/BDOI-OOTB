"""Step 22: every report in the catalogue is generated as a file for the test period, downloaded, and
searched for this run's transactions. Writes reports_check.json/.md. Admin password comes from ADMIN_PASSWORD."""
import json, os, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
API = os.environ.get('API', 'http://localhost:8000/api')
PERIOD = {'ReportCriteria': 'Overall', 'FromDate': os.environ.get('FROM', '2026-09-01'), 'ToDate': os.environ.get('TO', '2026-09-30')}
MARKERS = ['POL-2026-00001', 'INV-2026-00002', 'OR-2026-00020', 'OR-2026-00021', 'PV-2026-00022', 'PV-2026-00023',
           'REM-2026-00018', 'CLM-2026-00002', 'JV-2026-00106', 'Andrea Villanueva', 'Ramon Dela Cruz', 'MAPFRE']


def call(method, path, body=None, token=None, raw=False):
    req = urllib.request.Request(path if path.startswith('http') else API + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Content-Type': 'application/json', **({'Authorization': f'Bearer {token}'} if token else {})})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read()
            return r.status, (data if raw else json.loads(data or b'{}'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b'{}')


_, login = call('POST', '/auth/login', {'username': 'BrokerVerse', 'password': os.environ['ADMIN_PASSWORD']})
tok = login['accessToken']
_, cat = call('GET', '/reports', token=tok)
rows = []
for rpt in cat['data']:
    code = rpt['code']
    st, gen = call('POST', f'/reports/{code}/generate', {**PERIOD, 'format': 'csv'}, tok)
    rec = {'code': code, 'name': rpt.get('name'), 'status': st}
    if st in (200, 201):
        d = gen['data']
        rec.update(rowCount=d.get('rowCount'), fileName=d.get('fileName'))
        st2, body = call('GET', d['downloadUrl'], token=tok, raw=True)
        text = body.decode('utf-8', 'replace') if isinstance(body, (bytes, bytearray)) else ''
        rec['download'] = st2
        rec['found'] = [m for m in MARKERS if m in text]
        # also produce the xlsx and pdf versions once to prove the formats work
        for fmt in ('xlsx', 'pdf'):
            s3, g3 = call('POST', f'/reports/{code}/generate', {**PERIOD, 'format': fmt}, tok)
            rec[fmt] = s3 in (200, 201) and call('GET', g3['data']['downloadUrl'], token=tok, raw=True)[0] == 200
    else:
        rec['error'] = gen.get('message')
    rows.append(rec)
    print(json.dumps(rec), flush=True)

json.dump(rows, open(os.path.join(HERE, 'reports_check.json'), 'w'), indent=1)
L = ['# Reports (step 22)\n', f"Period {PERIOD['FromDate']} to {PERIOD['ToDate']}. Each report generated as CSV, XLSX and PDF and downloaded.\n",
     '| Report | Rows | CSV | XLSX | PDF | Test transactions found in the file |', '|---|---|---|---|---|---|']
for r in rows:
    L.append(f"| {r['name']} | {r.get('rowCount', '-')} | {'yes' if r.get('download') == 200 else 'NO'} | {'yes' if r.get('xlsx') else 'NO'} | "
             f"{'yes' if r.get('pdf') else 'NO'} | {', '.join(r.get('found', [])) or r.get('error', '-')} |")
open(os.path.join(HERE, 'reports_check.md'), 'w').write('\n'.join(L) + '\n')
