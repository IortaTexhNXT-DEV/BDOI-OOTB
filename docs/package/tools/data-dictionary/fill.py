import json, collections, re, os
DD_DB = os.environ.get('DD_DB', 'golive')
from openpyxl import load_workbook
import tables_meta as tm
import pii
wb = load_workbook('/home/user/BDOI-OOTB/docs/package/out/BrokerVerse_Data_Dictionary.xlsx')
T = list(wb['Tables'].iter_rows(min_row=2, values_only=True))
C = list(wb['Columns'].iter_rows(min_row=2, values_only=True))
R = list(wb['Relationships'].iter_rows(min_row=2, values_only=True))
I = list(wb['Indexes'].iter_rows(min_row=2, values_only=True))
st = json.load(open('stats.json'))
D = json.load(open('db.json'))
views = {'bank_account_links', 'bank_book_lines'}
Cb = [c for c in C if c[0] not in views]
migs = sorted(set(json.load(open('mig.json'))['created'].values()))
import subprocess
def q(sql):
    return subprocess.run(['su','postgres','-c',f'psql -d {DD_DB} -Atc "{sql}"'],capture_output=True,text=True).stdout.split('\n')
nmig = int(q('select count(*) from schema_migrations')[0]); lastmig = q('select max(name) from schema_migrations')[0]
ph = {
 'N_MIG': nmig, 'LAST_MIG': lastmig, 'FIRST_MIG': '0001_core.sql',
 'N_COLS_ALL': f"{len(C):,}", 'N_COLS': f"{len(Cb):,}", 'N_FK': len(R), 'N_IDX': len(I), 'N_SETTINGS': len(D['settings']),
 'N_SETTING_GROUPS': len({s[1] for s in D['settings']}), 'N_TABLES': len(T) - 2,
 'FK_NOACTION': sum(r[5] == 'No action' for r in R), 'FK_CASCADE': sum(r[5] == 'Cascade' for r in R), 'FK_SETNULL': sum(r[5] == 'Set null' for r in R),
 'FK_NOIDX': sum(r[9] == 'No' for r in R), 'FK_USERS': sum(r[3] == 'users' for r in R),
 'IDX_PK': sum(i[2] == 'Primary key' for i in I), 'IDX_UQ': sum(i[2] == 'Unique' for i in I), 'IDX_PARTIAL': sum(bool(i[5]) for i in I),
 'N_CHK': st['checks'], 'N_ROWS': f"{sum((t[6] or 0) for t in T):,}", 'N_PII': sum(st['pii'].values()), 'N_PII_TABLES': len(st['pii_tables']),
 'ID_TEXT': sum(1 for c in Cb if c[1] == 'id' and c[7] == 'Yes' and c[3] == 'text'),
 'ID_SERIAL': sum(1 for c in Cb if c[1] == 'id' and c[7] == 'Yes' and c[3] in ('integer', 'bigint')),
 'N_SERIES': q('select count(*) from document_numbering')[0],
 'NUM_14_2': sum(1 for c in Cb if c[3] == 'numeric' and c[4] == '14,2'), 'NUM_16_2': sum(1 for c in Cb if c[3] == 'numeric' and c[4] == '16,2'),
 'N_DATE': sum(1 for c in Cb if c[3] == 'date'), 'N_TS': sum(1 for c in Cb if c[3] == 'timestamptz'), 'N_JSONB': sum(1 for c in Cb if c[3] == 'jsonb'),
 'N_CREATED_AT': sum(1 for c in Cb if c[1] == 'created_at'), 'N_CREATED_BY': sum(1 for c in Cb if c[1] == 'created_by'),
 'N_UPDATED_AT': sum(1 for c in Cb if c[1] == 'updated_at'), 'N_UPDATED_BY': sum(1 for c in Cb if c[1] == 'updated_by'),
 'N_STATUS': sum(1 for c in Cb if c[1] == 'status'),
 'PII_P': st['pii'].get(pii.P, 0), 'PII_S': st['pii'].get(pii.S, 0), 'PII_C': st['pii'].get(pii.C, 0), 'PII_J': st['pii'].get(pii.J, 0),
}
ret = collections.Counter(t[9] for t in T)
ph.update({'RET_FIN': ret['Financial'], 'RET_TXN': ret['Transaction'], 'RET_REF': ret['Reference'], 'RET_LOG': ret['Log / audit'], 'RET_TMP': ret['Temporary']})

KEY = {
 'Party and client': 'clients, insurance_companies', 'Product and rating': 'products, product_templates, premium_charge_rules',
 'Sales and quotation': 'leads, quotes, payment_links', 'Placement': 'broker_slips, insurer_offers, placements, risk_participants',
 'Policy and endorsement': 'policies, endorsements', 'Billing, receipts and payments': 'receivables, receipts, receipt_applications, disbursements',
 'Remittance and insurer accounting': 'remittances, direct_bill_items, commission_debit_notes', 'Commission': 'commissions, commission_rates',
 'Claims': 'claims, claim_settlement_movements', 'Renewals': 'renewals, renewal_quotes', 'General ledger and period end': 'journal_vouchers, journal_lines, gl_accounts, posting_rules, accounting_periods',
 'Bank and insurer reconciliation': 'bank_statements, bank_rec_matches, bank_reconciliations, insurer_statements', 'Credit control': 'collection_items, premium_instalment_plans',
 'Reinsurance': 'reinsurance_treaties, cessions, reinsurance_recoveries', 'Incentives': 'incentive_programs, incentive_results',
 'Security and audit': 'users, roles, audit_log', 'Configuration and schedules': 'app_settings, master_records, document_numbering, scheduled_jobs',
}
ov = []
for a in tm.AREAS:
    n = sum(1 for t in T if t[2] == a and t[1] == 'Table'); v = sum(1 for t in T if t[2] == a and t[1] == 'View')
    ov.append(f"| {a} | {n}{f' + {v} views' if v else ''} | " + ', '.join(f'`{k.strip()}`' for k in KEY[a].split(',')) + ' |')
ph['AREA_OVERVIEW'] = '\n'.join(ov)

# PII table: per table, columns grouped by class
by = collections.defaultdict(lambda: collections.defaultdict(list))
for c in C:
    if c[10]:
        by[c[0]][c[10]].append(c[1])
short = {pii.P: 'Personal', pii.S: 'Sensitive', pii.C: 'Credential', pii.J: 'May contain'}
lines = ['| Table | Columns holding personal data |', '|---|---|']
area_order = {a: i for i, a in enumerate(tm.AREAS)}
for t in sorted(by, key=lambda t: (area_order[tm.AREA_OF[t]], t)):
    parts = [f"{short[k]}: " + ', '.join(by[t][k]) for k in (pii.P, pii.S, pii.C, pii.J) if by[t].get(k)]
    lines.append(f"| `{t}` | " + '<br>'.join(parts) + ' |')
ph['PII_TABLE'] = '\n'.join(lines)

app = []
for a in tm.AREAS:
    app.append(f'## {a}\n')
    app.append('| Table | Description | Rows |')
    app.append('|---|---|---|')
    for t in T:
        if t[2] != a:
            continue
        rows = 'view' if t[1] == 'View' else f'{t[6]:,}'
        app.append(f"| `{t[0]}` | {t[4]} | {rows} |")
    app.append('')
ph['APPENDIX'] = '\n'.join(app)

s = open('data-dictionary.tpl.md').read()
for k, v in ph.items():
    s = s.replace('{{' + k + '}}', str(v))
left = re.findall(r'\{\{[A-Z_]+\}\}', s)
assert not left, left
open('/home/user/BDOI-OOTB/docs/package/source/data-dictionary.md', 'w').write(s)
print({k: v for k, v in ph.items() if k not in ('AREA_OVERVIEW', 'PII_TABLE', 'APPENDIX')})
