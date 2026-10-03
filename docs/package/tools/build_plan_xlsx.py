"""Builds BrokerVerse_Implementation_Plan.xlsx: three Gantt sheets (small, medium, large) and the RACI matrix.

    python3 build_plan_xlsx.py ../out/BrokerVerse_Implementation_Plan.xlsx
"""
import sys
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

OUT = sys.argv[1] if len(sys.argv) > 1 else "../out/BrokerVerse_Implementation_Plan.xlsx"
NAVY = '0F4761'
HEAD = PatternFill('solid', fgColor='DCE9F7')
THIN = Side(style='thin', color='BFC7D1')
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
COLORS = {
    'Mobilisation': '8EA9C1', 'Discovery and fit-gap': '5B9BD5', 'Environment set-up': '7F7F7F',
    'Configuration': '2E75B6', 'Data migration': 'C55A11', 'Integrations': '7030A0', 'Training': '548235',
    'System integration test': 'BF8F00', 'User acceptance test': 'FFC000', 'Cutover': 'C00000',
    'Go-live': '00B050', 'Hypercare': '70AD47',
}

PLANS = {
    'Small (8 weeks)': {
        'weeks': 8,
        'rows': [
            ('Mobilisation', 'Kick-off, governance, data requests', 1, 1),
            ('Discovery and fit-gap', 'Workshops, configuration workbook, fit-gap register', 1, 2),
            ('Environment set-up', 'Test and production environments, backups, monitoring', 1, 2),
            ('Configuration', 'Masters, products, rates, CoA, posting rules, numbering, approvals', 2, 4),
            ('Data migration', 'Mock load 1 (wk 3), mock load 2 / rehearsal (wk 5), final load (wk 6)', 3, 6),
            ('Integrations', 'E-mail, bank statement formats, payment gateway sandbox', 3, 4),
            ('Training', 'Train-the-trainer (wk 4), end-user training (wk 5)', 4, 5),
            ('System integration test', 'End-to-end flows across roles', 4, 4),
            ('User acceptance test', 'UAT scripts with the broker data; sign-off', 5, 6),
            ('Cutover', 'Freeze, final extract and loads, reconciliation, go/no-go', 6, 6),
            ('Go-live', 'First day of transactions in BrokerVerse', 7, 7),
            ('Hypercare', 'Daily then weekly support; handover', 7, 8),
        ],
        'milestones': [(1, 'Kick-off'), (2, 'Config workbook signed'), (3, 'Mock 1 reconciled'), (4, 'SIT exit'),
                       (5, 'Mock 2 reconciled'), (6, 'UAT sign-off; go/no-go'), (7, 'Go-live'), (8, 'Hypercare exit')],
    },
    'Medium (12 weeks)': {
        'weeks': 12,
        'rows': [
            ('Mobilisation', 'Kick-off, governance, data requests', 1, 1),
            ('Discovery and fit-gap', 'Workshops, configuration workbook, fit-gap register', 2, 3),
            ('Environment set-up', 'Test and production environments, backups, monitoring', 1, 2),
            ('Configuration', 'Masters, products, rates, CoA, posting rules, numbering, approvals', 3, 6),
            ('Data migration', 'Mapping (wk 4), mock 1 (wk 5), mock 2 (wk 7), mock 3 / rehearsal and final load (wk 9)', 4, 9),
            ('Integrations', 'E-mail (wk 5), bank statement formats and payment gateway (wk 6)', 5, 6),
            ('Training', 'Train-the-trainer (wk 7), end-user training (wk 8 to 9)', 7, 9),
            ('System integration test', 'Two cycles', 6, 7),
            ('User acceptance test', 'Two cycles; sign-off', 8, 9),
            ('Cutover', 'Freeze, final extract and loads, reconciliation, go/no-go', 9, 9),
            ('Go-live', 'First day of transactions in BrokerVerse', 10, 10),
            ('Hypercare', 'Daily then weekly support; first close; handover', 10, 12),
        ],
        'milestones': [(1, 'Kick-off'), (2, 'Environments ready'), (3, 'Config workbook signed'), (5, 'Mock 1 reconciled'),
                       (6, 'Configuration complete'), (7, 'SIT exit; mock 2'), (9, 'UAT sign-off; go/no-go'),
                       (10, 'Go-live'), (12, 'Hypercare exit')],
    },
    'Large (16 to 20 weeks)': {
        'weeks': 20,
        'rows': [
            ('Mobilisation', 'Kick-off, governance, data requests, plan baselined', 1, 2),
            ('Discovery and fit-gap', 'Workshops, configuration workbook, fit-gap register', 2, 5),
            ('Environment set-up', 'Test and production environments, backups, monitoring', 2, 3),
            ('Configuration', 'Masters, products, rates, CoA, posting rules, numbering, approvals', 4, 9),
            ('Data migration', 'Mapping (wk 6), mocks 1 to 4 (wk 7, 10, 13, 14), final load (wk 14)', 6, 14),
            ('Integrations', 'E-mail (wk 6), bank statement formats and payment gateway (wk 8)', 6, 8),
            ('Training', 'Train-the-trainer (wk 10 to 11), end-user training (wk 12 to 13)', 10, 13),
            ('System integration test', 'Two cycles; exit report', 9, 11),
            ('User acceptance test', 'Two cycles; sign-off', 12, 13),
            ('Cutover', 'Rehearsal, freeze, final extract and loads, reconciliation, go/no-go', 14, 14),
            ('Go-live', 'All branches on one go-live date', 15, 15),
            ('Hypercare', 'First remittance, close and BIR cycle; handover', 15, 20),
        ],
        'milestones': [(1, 'Kick-off'), (2, 'Plan baselined'), (3, 'Environments ready'), (5, 'Config workbook signed'),
                       (7, 'Mock 1 reconciled'), (9, 'Configuration complete'), (11, 'SIT exit'), (13, 'UAT sign-off'),
                       (14, 'Go/no-go'), (15, 'Go-live'), (18, 'First close (typical)'), (20, 'Hypercare exit')],
        'note': '16-week variant: discovery ends wk 4, configuration wk 8, three mock loads, go-live start of wk 13, hypercare wk 13 to 16.',
    },
}

RACI_ROLES = ['iorta TechNXT PM', 'iorta TechNXT consultants', 'iorta TechNXT technical / DevOps', 'Broker sponsor',
              'Broker PM', 'Broker key users / process owners', 'Broker IT / System Administrator', 'Broker Accounting Manager']
RACI = [
    ('Mobilisation', 'Project charter and baselined plan', 'R', 'C', 'C', 'A', 'R', 'I', 'I', 'I'),
    ('Mobilisation', 'Governance set-up (steering committee, status, RAID log)', 'R', 'I', 'I', 'A', 'R', 'I', 'I', 'I'),
    ('Mobilisation', 'Data request list issued and tracked', 'R', 'C', 'C', 'I', 'A', 'C', 'C', 'C'),
    ('Discovery and fit-gap', 'Discovery workshops', 'A', 'R', 'I', 'I', 'R', 'R', 'C', 'R'),
    ('Discovery and fit-gap', 'Configuration workbook', 'A', 'R', 'I', 'I', 'C', 'C', 'C', 'C'),
    ('Discovery and fit-gap', 'Configuration decisions', 'C', 'R', 'I', 'I', 'A', 'R', 'C', 'R'),
    ('Discovery and fit-gap', 'Fit-gap register sign-off', 'R', 'R', 'I', 'A', 'R', 'C', 'I', 'C'),
    ('Environment set-up', 'Test and production environments', 'A', 'I', 'R', 'I', 'I', 'I', 'C', 'I'),
    ('Environment set-up', 'Backups, restore test, monitoring', 'A', 'I', 'R', 'I', 'I', 'I', 'C', 'I'),
    ('Configuration', 'Company, branches, users and security settings', 'A', 'R', 'C', 'I', 'I', 'C', 'R', 'I'),
    ('Configuration', 'Insurers, commission, products, motor tariff', 'A', 'R', 'I', 'I', 'C', 'R', 'C', 'C'),
    ('Configuration', 'Tax codes, premium taxes and LGU rates', 'A', 'R', 'I', 'I', 'C', 'C', 'I', 'R'),
    ('Configuration', 'Chart of accounts, account determination, posting rules', 'A', 'R', 'I', 'I', 'C', 'C', 'I', 'R'),
    ('Configuration', 'Document numbering (OR and invoice series per ATP)', 'A', 'R', 'I', 'I', 'C', 'C', 'C', 'R'),
    ('Configuration', 'Approvals, maker-checker, authority matrix', 'A', 'R', 'I', 'I', 'C', 'R', 'C', 'R'),
    ('Configuration', 'Schedules, e-mail texts, notifications', 'A', 'R', 'C', 'I', 'I', 'C', 'R', 'I'),
    ('Data migration', 'Extraction from the old system', 'I', 'C', 'I', 'I', 'A', 'R', 'R', 'C'),
    ('Data migration', 'Mapping to the upload templates', 'A', 'R', 'C', 'I', 'C', 'R', 'C', 'C'),
    ('Data migration', 'Data cleansing', 'I', 'C', 'I', 'I', 'A', 'R', 'R', 'R'),
    ('Data migration', 'Mock loads', 'A', 'R', 'R', 'I', 'C', 'C', 'C', 'C'),
    ('Data migration', 'Reconciliation of counts and totals', 'A', 'R', 'C', 'I', 'C', 'R', 'I', 'R'),
    ('Data migration', 'Sign-off of opening balances and open items', 'C', 'C', 'I', 'I', 'C', 'C', 'I', 'A'),
    ('Integrations', 'SMTP mailbox and credentials', 'I', 'I', 'R', 'I', 'C', 'I', 'A', 'I'),
    ('Integrations', 'Bank statement formats', 'A', 'R', 'C', 'I', 'I', 'R', 'C', 'C'),
    ('Integrations', 'Payment gateway merchant account and credentials', 'C', 'I', 'R', 'I', 'C', 'I', 'A', 'C'),
    ('Training', 'Train-the-trainer', 'A', 'R', 'I', 'I', 'C', 'R', 'C', 'C'),
    ('Training', 'End-user training', 'C', 'C', 'I', 'I', 'A', 'R', 'C', 'C'),
    ('Training', 'Assessment', 'C', 'R', 'I', 'I', 'A', 'R', 'I', 'I'),
    ('System integration test', 'SIT execution and defect fixing', 'A', 'R', 'R', 'I', 'I', 'C', 'I', 'I'),
    ('User acceptance test', 'UAT execution', 'C', 'C', 'I', 'I', 'A', 'R', 'R', 'R'),
    ('User acceptance test', 'UAT sign-off', 'C', 'C', 'I', 'A', 'R', 'R', 'C', 'R'),
    ('Cutover', 'Freeze of the old system and final extract', 'C', 'C', 'I', 'I', 'A', 'R', 'R', 'R'),
    ('Cutover', 'Final loads and reconciliation', 'A', 'R', 'R', 'I', 'C', 'R', 'C', 'R'),
    ('Cutover', 'Go/no-go decision', 'C', 'C', 'C', 'A', 'R', 'C', 'C', 'C'),
    ('Go-live and hypercare', 'Go-live communication', 'C', 'I', 'I', 'A', 'R', 'C', 'C', 'I'),
    ('Go-live and hypercare', 'Hypercare issue handling', 'A', 'R', 'R', 'I', 'R', 'C', 'R', 'C'),
    ('Go-live and hypercare', 'First month-end close', 'C', 'R', 'C', 'I', 'I', 'R', 'I', 'A'),
    ('Go-live and hypercare', 'Handover to production support', 'A', 'R', 'R', 'I', 'C', 'I', 'R', 'I'),
    ('Change control', 'Change request impact assessment', 'A', 'R', 'R', 'I', 'C', 'C', 'C', 'C'),
    ('Change control', 'Change request approval', 'C', 'I', 'I', 'A', 'R', 'C', 'C', 'C'),
]


def head(c, text):
    c.value = text; c.font = Font(bold=True, color=NAVY, size=10); c.fill = HEAD; c.border = BOX
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)


def gantt(ws, name, plan):
    weeks = plan['weeks']
    ws['A1'] = f'BrokerVerse OOTB implementation plan: {name}'; ws['A1'].font = Font(bold=True, size=14, color=NAVY)
    ws['A2'] = 'Shaded cells are the weeks in which the phase runs. Week 1 starts on the kick-off date.'
    ws['A2'].font = Font(italic=True, size=9, color='555F6D')
    r = 4
    for j, t in enumerate(['Phase', 'Main activities', 'Start week', 'End week']):
        head(ws.cell(r, j + 1), t)
    for w in range(1, weeks + 1):
        head(ws.cell(r, 4 + w), f'W{w}')
    for phase, act, s, e in plan['rows']:
        r += 1
        ws.cell(r, 1, phase).font = Font(bold=True, size=10)
        ws.cell(r, 2, act).font = Font(size=9)
        ws.cell(r, 3, s); ws.cell(r, 4, e)
        for j in range(1, 5):
            ws.cell(r, j).border = BOX
            ws.cell(r, j).alignment = Alignment(vertical='center', wrap_text=True, horizontal='center' if j > 2 else 'left')
        for w in range(1, weeks + 1):
            c = ws.cell(r, 4 + w); c.border = BOX
            if s <= w <= e:
                c.fill = PatternFill('solid', fgColor=COLORS[phase])
                if phase == 'Go-live':
                    c.value = 'GO'; c.font = Font(bold=True, color='FFFFFF', size=9)
                    c.alignment = Alignment(horizontal='center', vertical='center')
        ws.row_dimensions[r].height = 30
    r += 1
    ws.cell(r, 1, 'Milestones').font = Font(bold=True, size=10)
    ws.cell(r, 2, 'Diamond = milestone in that week (text below)').font = Font(size=9, italic=True)
    for j in range(1, 5):
        ws.cell(r, j).border = BOX
    marks = dict(plan['milestones'])
    for w in range(1, weeks + 1):
        c = ws.cell(r, 4 + w); c.border = BOX
        if w in marks:
            c.value = '◆'; c.font = Font(color='C00000', size=11); c.alignment = Alignment(horizontal='center')
    r += 2
    head(ws.cell(r, 1), 'Week'); head(ws.cell(r, 2), 'Milestone')
    for w, m in plan['milestones']:
        r += 1
        ws.cell(r, 1, f'W{w}').border = BOX; ws.cell(r, 1).alignment = Alignment(horizontal='center')
        ws.cell(r, 2, m).border = BOX
    if plan.get('note'):
        r += 2
        ws.cell(r, 1, plan['note']).font = Font(italic=True, size=9)
    ws.column_dimensions['A'].width = 24
    ws.column_dimensions['B'].width = 58
    ws.column_dimensions['C'].width = 7
    ws.column_dimensions['D'].width = 7
    for w in range(1, weeks + 1):
        ws.column_dimensions[get_column_letter(4 + w)].width = 4.5
    ws.freeze_panes = 'E5'
    ws.page_setup.orientation = 'landscape'; ws.page_setup.fitToWidth = 1; ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True


wb = Workbook()
ws = wb.active; ws.title = 'Read me'
lines = [
    ('BrokerVerse OOTB Implementation Plan', Font(bold=True, size=14, color=NAVY)),
    ('Companion workbook of the BrokerVerse Implementation Approach and Plan, version 1.0, 03 October 2026, iorta TechNXT.', None),
    ('', None),
    ('Sheets', Font(bold=True, color=NAVY)),
    ('Small (8 weeks): one office, up to 25 users, up to 5,000 in-force policies (planning assumption).', None),
    ('Medium (12 weeks): up to 3 offices, 26 to 75 users, up to 25,000 in-force policies (planning assumption).', None),
    ('Large (16 to 20 weeks): more than 3 offices, more than 75 users, more than 25,000 in-force policies (planning assumption).', None),
    ('RACI: R = Responsible, A = Accountable (one per activity), C = Consulted, I = Informed.', None),
    ('', None),
    ('Notes', Font(bold=True, color=NAVY)),
    ('The size is confirmed by the steering committee at mobilisation once data volumes are known.', None),
    ('Hypercare extends to cover the first month-end close when the close falls after the planned hypercare exit.', None),
    ('The plan assumes an out-of-the-box implementation: configuration only, no customisation.', None),
]
for i, (t, f) in enumerate(lines, 1):
    c = ws.cell(i, 1, t)
    if f:
        c.font = f
ws.column_dimensions['A'].width = 120
for name, plan in PLANS.items():
    gantt(wb.create_sheet(name.split(' ')[0]), name, plan)

ws = wb.create_sheet('RACI')
ws['A1'] = 'RACI: iorta TechNXT and the broker'; ws['A1'].font = Font(bold=True, size=14, color=NAVY)
ws['A2'] = 'R = Responsible, A = Accountable, C = Consulted, I = Informed.'; ws['A2'].font = Font(italic=True, size=9, color='555F6D')
r = 4
for j, t in enumerate(['Phase', 'Activity'] + RACI_ROLES):
    head(ws.cell(r, j + 1), t)
ws.row_dimensions[r].height = 45
fills = {'R': 'C6E0B4', 'A': 'F4B183', 'C': 'DDEBF7', 'I': 'F2F2F2'}
for row in RACI:
    r += 1
    for j, v in enumerate(row):
        c = ws.cell(r, j + 1, v); c.border = BOX
        if j >= 2:
            c.alignment = Alignment(horizontal='center', vertical='center')
            c.fill = PatternFill('solid', fgColor=fills[v]); c.font = Font(bold=v in 'RA', size=10)
        else:
            c.alignment = Alignment(vertical='center', wrap_text=True); c.font = Font(size=10, bold=j == 0)
    assert row[2:].count('A') == 1, row
ws.column_dimensions['A'].width = 24
ws.column_dimensions['B'].width = 52
for j in range(len(RACI_ROLES)):
    ws.column_dimensions[get_column_letter(3 + j)].width = 15
ws.freeze_panes = 'C5'
ws.auto_filter.ref = f'A4:{get_column_letter(2 + len(RACI_ROLES))}{r}'
ws.page_setup.orientation = 'landscape'; ws.sheet_properties.pageSetUpPr.fitToPage = True
ws.page_setup.fitToWidth = 1; ws.page_setup.fitToHeight = 0
wb.save(OUT)
print('wrote', OUT)
