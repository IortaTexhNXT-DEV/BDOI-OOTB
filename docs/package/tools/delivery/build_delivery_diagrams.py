"""Renders the delivery diagrams of the Implementation Approach and Plan and of the Dependency Map and Critical Path
into docs/package/source/delivery-images (PNG). Graphviz `dot` draws the networks; Pillow draws the phase Gantt charts.
The critical path charts and the Gantt charts are computed from plan_model.py, so they always match the workbook.

    python3 build_delivery_diagrams.py            (needs graphviz and Pillow)

The .dot sources are written next to the pictures' generator in delivery/dot/ so they can be reviewed or edited.
"""
import os
import subprocess
import textwrap

from PIL import Image, ImageDraw, ImageFont

import plan_model as pm

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'source', 'delivery-images')
DOT = os.path.join(HERE, 'dot')
FONT = 'DejaVu Sans'
BLUE, GREEN, GOLD, PURPLE, RED, GREY, NAVY = '#2E75B6', '#548235', '#BF8F00', '#7030A0', '#C00000', '#7F7F7F', '#0F4761'
FILL = {BLUE: '#DCE9F7', GREEN: '#E2EFDA', GOLD: '#FFF2CC', PURPLE: '#EDE1F5', RED: '#FBE3E3', GREY: '#F2F2F2', NAVY: '#DCE9F7'}
NL = '\\n'
PARTY_COLOUR = {pm.IORTA: BLUE, pm.BROKER: GREEN, pm.PARTNER: GOLD}


def wrap(text, width=26):
    return '\\n'.join(textwrap.wrap(text, width))


def node(name, label, colour, shape='box', bold=False, width=26):
    style = 'rounded,filled' + (',bold' if bold else '')
    return (f'"{name}" [label="{wrap(label, width)}", shape={shape}, style="{style}", color="{colour}", '
            f'fillcolor="{FILL.get(colour, "#FFFFFF")}", fontcolor="#101820", penwidth={2.2 if bold else 1.2}];')


def edge(a, b, colour='#555F6D', label='', dashed=False, bold=False):
    attrs = [f'color="{colour}"', f'penwidth={2.4 if bold else 1.1}']
    if label:
        attrs.append(f'label="{wrap(label, 18)}", fontsize=9, fontcolor="{colour}"')
    if dashed:
        attrs.append('style=dashed')
    return f'"{a}" -> "{b}" [{", ".join(attrs)}];'


def render(name, body, rankdir='LR', extra=''):
    src = (f'digraph G {{\n rankdir={rankdir}; dpi=170; bgcolor="white"; nodesep=0.25; ranksep=0.45; {extra}\n'
           f' node [fontname="{FONT}", fontsize=10, margin="0.10,0.06"]; edge [fontname="{FONT}", arrowsize=0.7];\n'
           + '\n'.join(' ' + line for line in body) + '\n}\n')
    os.makedirs(DOT, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(DOT, name + '.dot')
    with open(path, 'w') as f:
        f.write(src)
    subprocess.run(['dot', '-Tpng', path, '-o', os.path.join(OUT, name + '.png')], check=True)
    print('wrote', name + '.png')


def legend(items, rank='sink'):
    """A small legend cluster: items = [(label, colour, style)]."""
    lines = [f'subgraph cluster_legend {{ label="Legend"; fontname="{FONT}"; fontsize=10; color="#BFC7D1"; style=rounded;']
    prev = None
    for k, (label, colour, style) in enumerate(items):
        n = f'lg{k}'
        lines.append(f' "{n}" [label="{wrap(label, 20)}", shape=box, style="rounded,filled{"," + style if style else ""}", '
                     f'color="{colour}", fillcolor="{FILL.get(colour, "#FFFFFF")}", fontsize=9];')
        if prev:
            lines.append(f' "{prev}" -> "{n}" [style=invis];')
        prev = n
    lines.append('}')
    return lines


# ---------------------------------------------------------------------------------------------- phase network
def phases():
    p = [('MOB', 'Mobilisation', BLUE), ('ENV', 'Environments and pipeline\\n(Dev, SIT, UAT, Production; GitHub Environments; secrets and keys)', BLUE),
         ('DIS', 'Discovery and fit-gap\\n(process, compliance, integration and branding workshops)', BLUE),
         ('INP', 'Client inputs\\n(masters, chart of accounts, users, banks, COC series, images)', GREEN),
         ('REG', 'Regulatory registrations\\n(BIR ATP or CAS, EIS; AMLC; IC licences; NPC)', PURPLE),
         ('CFG', 'Configuration\\n(go-live configuration kit, Product Configurator, posting rules)', BLUE),
         ('CMP', 'Compliance set-up\\n(AML/CFT, IC registers, complaints, breaches, masking)', BLUE),
         ('BRD', 'Branding and brand pack\\n(theme, documents, e-mails, e-signatures)', BLUE),
         ('INT', 'Integrations with partners\\n(banks, SMS, CTPL and LTO, insurers, gateway, EIS)', GOLD),
         ('MIG', 'Data migration\\n(migration kit, mock loads, reconciliation)', BLUE),
         ('TRN', 'Training\\n(train-the-trainer, compliance officer, end users)', BLUE),
         ('SIT', 'System integration test\\n(Dev, or SIT for large)', BLUE), ('UAT', 'User acceptance test\\nand sign-off', GREEN),
         ('PRD', 'Release and frozen configuration\\nto Production', BLUE), ('REH', 'Pre-Prod from a production backup;\\ncutover rehearsal', BLUE),
         ('GNG', 'Go/no-go', RED), ('CUT', 'Cutover and go-live lock', RED), ('HYP', 'Hypercare to the first\\nmonth-end close; handover', BLUE)]
    body = [f'"{k}" [label="{wrap(lab.replace(NL, " "), 24)}", fontsize=12, shape=box, style="rounded,filled", color="{c}", fillcolor="{FILL[c]}", penwidth={2 if c == RED else 1.2}];' for k, lab, c in p]
    links = [('MOB', 'ENV'), ('MOB', 'DIS'), ('MOB', 'INP'), ('MOB', 'REG'), ('DIS', 'CFG'), ('INP', 'CFG'), ('ENV', 'CFG'),
             ('CFG', 'CMP'), ('CFG', 'BRD'), ('CFG', 'INT'), ('CFG', 'MIG'), ('INP', 'MIG'), ('REG', 'CMP'), ('INP', 'INT'),
             ('CFG', 'SIT'), ('CMP', 'SIT'), ('BRD', 'SIT'), ('SIT', 'TRN'), ('SIT', 'UAT'), ('MIG', 'UAT'), ('TRN', 'UAT'),
             ('UAT', 'PRD'), ('REG', 'PRD'), ('ENV', 'PRD'), ('PRD', 'REH'), ('MIG', 'REH'), ('REH', 'GNG'), ('UAT', 'GNG'),
             ('TRN', 'GNG'), ('CMP', 'GNG'), ('GNG', 'CUT'), ('CUT', 'HYP')]
    crit = {('MOB', 'INP'), ('INP', 'CFG'), ('CFG', 'SIT'), ('SIT', 'UAT'), ('UAT', 'GNG'), ('REH', 'GNG'), ('UAT', 'PRD'),
            ('PRD', 'REH'), ('GNG', 'CUT'), ('CUT', 'HYP')}
    body += [edge(a, b, RED if (a, b) in crit else '#555F6D', bold=(a, b) in crit) for a, b in links]
    body.append(edge('INT', 'HYP', GOLD, 'features switched on when certified', dashed=True))
    body += legend([('iorta TechNXT', BLUE, ''), ('Broker', GREEN, ''), ('Partner', GOLD, ''), ('Regulator lead time', PURPLE, ''),
                    ('Gate; red arrows: usual critical path', RED, '')])
    render('dm-phases', body, rankdir='TB', extra='nodesep=0.15; ranksep=0.35;')


# ---------------------------------------------------------------------------------------------- client inputs
def inputs():
    body = ['subgraph cluster_in { label="Client inputs (broker)"; fontname="%s"; color="%s"; style=rounded;' % (FONT, GREEN)]
    ins = [('I1', 'Insurers, agreements, commission rates, products'), ('I2', 'Chart of accounts and mapping'),
           ('I3', 'User list, roles, reporting lines'), ('I4', 'SMTP mailbox'), ('I5', 'Bank accounts, statement samples, payee accounts'),
           ('I7', 'COC series from insurers'), ('I8', 'Logo, sign-in picture, signatories and consents'),
           ('G1', 'Data extracts: clients, policies, open items, open claims, trial balance'), ('I10', 'UAT testers, sign-off authority'),
           ('I9', 'Training rooms and attendees')]
    body += [node(k, v, GREEN, width=30) for k, v in ins] + ['}']
    targets = [('C1', 'Configuration kit filled and loaded', BLUE), ('N1', 'E-mail tested', BLUE), ('N2', 'Bank statement imports', BLUE),
               ('N3', 'Bank payment files', GOLD), ('N5', 'CTPL authentication', GOLD), ('B1', 'Branding, documents, e-signatures', BLUE),
               ('G3', 'Mock load 1 and later loads', BLUE), ('T4', 'UAT', GREEN), ('L3', 'End-user training', GREEN),
               ('X4', 'Go/no-go', RED)]
    body += [node(k, v, c, bold=c == RED) for k, v, c in targets]
    links = [('I1', 'C1', True), ('I2', 'C1', True), ('I3', 'C1', True), ('I4', 'N1', False), ('I5', 'N2', False), ('I5', 'N3', False),
             ('I7', 'N5', False), ('I8', 'B1', False), ('G1', 'G3', False), ('I10', 'T4', False), ('I9', 'L3', False),
             ('C1', 'T4', True), ('G3', 'X4', False), ('T4', 'X4', True), ('L3', 'X4', False), ('N1', 'X4', False), ('N2', 'X4', False),
             ('B1', 'X4', False)]
    body += [edge(a, b, RED if c else '#555F6D', bold=c) for a, b, c in links]
    body += [edge('N3', 'X4', GOLD, 'fallback: cheques', dashed=True), edge('N5', 'X4', GOLD, 'fallback: code from the provider portal', dashed=True)]
    render('dm-client-inputs', body)


# ---------------------------------------------------------------------------------------------- partner certifications
def partners():
    rows = [
        ('bank', 'Banks', 'Layout validated with the bank; test file accepted', 'Bank payment files (bulk credit, InstaPay, PESONet)', 'Cheques and manual transfers in the bank portal'),
        ('bankst', 'Banks', 'One statement per account imported with a balancing preview', 'Bank reconciliation imports', 'Manual bank items'),
        ('sms', 'SMS or Viber provider', 'Account, sender name, live test message', 'Renewal notices, payment reminders, claim updates', 'E-mail notices; jobs stay off'),
        ('ctpl', 'CTPL authentication provider (IC-accredited); LTO', 'Broker accredited; COC series loaded; one COC authenticated live', 'CTPL authentication at issue; LTO feed', 'Enter code from the provider portal'),
        ('ins', 'Insurers', 'Mapping, preview, test issuance and claim status accepted', 'Insurer API connectors', 'Record Issued Policy; claim status file (CSV)'),
        ('pg', 'Payment gateway', 'Sandbox payment receipted; live test payment', 'Payment links', 'Bank transfer, cheque, cash'),
        ('eis', 'BIR EIS', 'Enrolment; test submissions accepted', 'E-invoicing (EIS) live', 'Connector off; queue earlier invoices later; export payloads'),
        ('amlc', 'AMLC portal', 'Portal access; CTR test file generated', 'CTR and STR filing', 'No fallback: needed before go-live'),
    ]
    body = []
    for k, who, cert, feat, fb in rows:
        body.append(node(k + '_p', who, GOLD if k not in ('eis', 'amlc') else PURPLE, width=22))
        body.append(node(k + '_c', cert, BLUE, width=30))
        body.append(node(k + '_f', feat, GREEN, width=28))
        body.append(node(k + '_b', fb if fb.startswith('No ') else 'Fallback: ' + fb, GREY, width=28))
        body.append(edge(k + '_p', k + '_c'))
        body.append(edge(k + '_c', k + '_f', label='live'))
        body.append(edge(k + '_p', k + '_b', GREY, 'if late', dashed=True))
        body.append(f'{{ rank=same; "{k}_f"; "{k}_b"; }}')
    body += legend([('Partner', GOLD, ''), ('Regulator portal', PURPLE, ''), ('Certification step', BLUE, ''), ('Feature switched on', GREEN, ''),
                    ('Fallback at go-live', GREY, '')])
    render('dm-partners', body, extra='newrank=true;')


# ---------------------------------------------------------------------------------------------- regulatory registrations
def regulatory():
    body = [
        node('bir', 'BIR: Authority to Print or CAS registration; invoice serial range', PURPLE, width=28),
        node('bir2', 'invoice.* settings; Numbering sheet; CAS books readiness', BLUE, width=28),
        node('eis', 'BIR: EIS enrolment and certification', PURPLE, width=28),
        node('eis2', 'EIS connector live (eis.mode live)', GOLD, width=28),
        node('amlc', 'AMLC: registration as covered person; portal access; institution code', PURPLE, width=28),
        node('amlc2', 'CTR test file; aml.amlc_institution_code', BLUE, width=28),
        node('lists', 'Screening lists: UN, AMLC, PEP licence', PURPLE, width=28),
        node('lists2', 'Lists loaded; clients rescreened', BLUE, width=28),
        node('ic', 'IC: licences of the firm, officers, agents; insurer certificates of authority', PURPLE, width=28),
        node('ic2', 'Licence register; insurer authority (warn, then block)', BLUE, width=28),
        node('npc', 'NPC: DPO and data processing systems registered', PURPLE, width=28),
        node('npc2', 'privacy.notice_version; breach register owner', BLUE, width=28),
        node('tax', 'Tax adviser confirmation of codes, ATC, rates, wording', PURPLE, width=28),
        node('prod', 'Release to Production', BLUE, bold=True), node('uat', 'UAT sign-off', GREEN, bold=True),
        node('gng', 'Go/no-go', RED, bold=True), node('pay', 'Commission payouts to agents (licence check: block)', GREEN, width=24),
        node('after', 'After go-live, when enrolled', GREY, width=20),
    ]
    body += [edge('bir', 'bir2'), edge('bir2', 'prod', RED, bold=True), edge('prod', 'gng', RED, bold=True),
             edge('eis', 'eis2'), edge('eis2', 'after', GREY, dashed=True),
             edge('amlc', 'amlc2'), edge('amlc2', 'gng', RED, bold=True),
             edge('lists', 'lists2'), edge('lists2', 'gng', RED, bold=True),
             edge('ic', 'ic2'), edge('ic2', 'gng', RED, bold=True), edge('ic2', 'pay', GREEN, 'agents without a licence are blocked'),
             edge('npc', 'npc2'), edge('npc2', 'gng', RED, bold=True),
             edge('tax', 'uat', RED, bold=True), edge('uat', 'gng', RED, bold=True)]
    body += legend([('Registration with a regulator (broker; lead time)', PURPLE, ''), ('Set-up in BrokerVerse', BLUE, ''), ('Go/no-go gate', RED, '')])
    render('dm-regulatory', body)


# ---------------------------------------------------------------------------------------------- environments and pipeline
def environments():
    body = [
        node('host', 'Hosting option, environment set and data location decided', GREEN),
        node('dev', 'Dev provisioned', BLUE), node('sit', 'SIT provisioned (large, enterprise)', BLUE), node('uat', 'UAT provisioned', BLUE),
        node('gh', 'GitHub Environments dev, sit, uat, preprod, production: reviewers, tag rules, variables, environment secrets', BLUE, width=30),
        node('sec', 'Secret store per environment: JWT_SECRET, DATA_ENCRYPTION_KEY, PII_ENCRYPTION_KEY, SMTP_URL, partner credentials', BLUE, width=30),
        node('key', 'Key custody: escrow copy under dual control; key kept with the backups; rotation procedure', GREEN, width=28),
        node('ci', 'CI green; first deploy and smoke test', BLUE),
        node('kit', 'Configuration kit loaded (Dev or SIT); promoted to UAT', BLUE),
        node('prod', 'Production at production topology; backups; restore test', BLUE, width=28),
        node('rel', 'Release tag and frozen configuration to Production; comparison report', BLUE, width=28),
        node('pre', 'Pre-Prod from a production backup; own secrets; e-mail and scheduler off', BLUE, width=28),
        node('mask', 'mask:data --remark-copy (when people without production access take part)', GREY, width=28),
        node('reh', 'Cutover rehearsal', RED, bold=True),
        node('reg', 'Cutover: golive.locked; mask:data --register-production', RED, bold=True, width=26),
        node('rm', 'Pre-Prod removed after hypercare', GREY),
    ]
    body += [edge('host', 'dev'), edge('host', 'uat'), edge('dev', 'sit'), edge('dev', 'gh'), edge('dev', 'sec'), edge('sec', 'key'),
             edge('gh', 'ci'), edge('sec', 'ci'), edge('uat', 'ci'), edge('sit', 'ci'), edge('ci', 'kit'), edge('sec', 'prod'),
             edge('kit', 'rel'), edge('prod', 'rel'), edge('rel', 'pre'), edge('pre', 'mask', GREY, dashed=True), edge('pre', 'reh'),
             edge('mask', 'reh', GREY, dashed=True), edge('reh', 'reg', RED, bold=True), edge('reg', 'rm', GREY, dashed=True),
             edge('key', 'pre', GREEN, 'production keys needed to read a restored copy', dashed=True)]
    render('dm-environments', body, rankdir='TB')


# ---------------------------------------------------------------------------------------------- critical path per size
SHORT = {
    'M1': 'Kick-off', 'M3': 'Data request and kits issued', 'I1': 'Insurers, rates, products (broker)', 'I2': 'Chart of accounts (broker)',
    'I3': 'User list (broker)', 'C1': 'Configuration kit filled', 'C2': 'Kit validated and loaded', 'C3': 'On-screen configuration',
    'C5': 'Configuration complete', 'L1': 'Train-the-trainer', 'L3': 'End-user training', 'T1': 'System integration test', 'T2': 'SIT exit',
    'T3': 'Promotion to UAT', 'T4': 'UAT', 'T5': 'UAT sign-off', 'X3': 'Cutover rehearsal (Pre-Prod)', 'X4': 'Go/no-go 1',
    'X5': 'Cutover', 'X6': 'GO-LIVE', 'H1': 'Hypercare', 'H3': 'Hypercare exit',
}


def critical(size):
    s = pm.schedule(size)
    chain = pm.critical_chain(size)
    body = []
    for tid in chain:
        v = s[tid]
        a, b = pm.weeks(tid, v)
        when = f'W{a}' if a == b else f'W{a} to W{b}'
        dur = 'milestone' if v['dur'] == 0 else f'{v["dur"]} days'
        party = pm.task(tid)[3]
        colour = RED if tid in ('X6', 'X4') else PARTY_COLOUR[party]
        body.append(f'"{tid}" [label="{SHORT.get(tid, tid)}\\n{dur}, {when}", shape=box, style="rounded,filled", color="{colour}", '
                    f'fillcolor="{FILL[colour]}", penwidth={2.2 if colour == RED else 1.3}];')
    # draw the links of the plan between critical tasks
    cs = set(chain)
    for tid in chain:
        for p, kind, lag in pm.task(tid)[7]:
            if p in cs and (s[p]['float_golive'] == 0 or tid in ('H1', 'H3')):
                lag = pm.lag_of(lag, pm.SIZES.index(size))
                e = edge(p, tid, RED, f'{kind} +{lag}d' if (kind != 'FS' or lag) else '', bold=True)
                body.append(e[:-2] + ', constraint=false];')
    # rows of five, left to right
    for k in range(0, len(chain), 5):
        body.append('{ rank=same; ' + ' -> '.join(f'"{t}"' for t in chain[k:k + 5]) + ' [style=invis, weight=10]; }')
    for k in range(len(chain) - 5):
        body.append(f'"{chain[k]}" -> "{chain[k + 5]}" [style=invis, weight=20];')
    render(f'dm-critical-{size.lower()}', body, rankdir='TB', extra='ranksep=0.35; nodesep=0.35;')


# ---------------------------------------------------------------------------------------------- phase gantt per size
def gantt(size):
    s = pm.schedule(size)
    info = pm.SIZE_INFO[size]
    weeks = info['weeks']
    try:
        f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 26)
        fb = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 26)
        fs = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 22)
    except OSError:
        f = fb = fs = ImageFont.load_default()
    label_w, col_w, row_h, top = 620, max(46, int(1500 / weeks)), 46, 90
    width = label_w + col_w * weeks + 30
    rows = []
    for code, name in pm.PHASES:
        ids = [t[0] for t in pm.TASKS if t[1] == code and t[0] in s]
        if not ids:
            continue
        bars = []
        for tid in ids:
            a, b = pm.weeks(tid, s[tid])
            bars.append((a, b, tid in pm.MILESTONES, s[tid]['float_golive'] == 0, pm.task(tid)[8]))
        rows.append((name, bars))
    height = top + row_h * len(rows) + 120
    im = Image.new('RGB', (width, height), 'white')
    d = ImageDraw.Draw(im)
    d.text((10, 10), f'{size} broker: {weeks} weeks, go-live at the start of week {info["golive_week"]}', font=fb, fill=NAVY)
    for w in range(1, weeks + 1):
        x = label_w + (w - 1) * col_w
        d.rectangle([x, top - 36, x + col_w, top + row_h * len(rows)], outline='#BFC7D1',
                    fill='#E2EFDA' if w == info['golive_week'] else ('#F7F9FB' if w % 2 else 'white'))
        d.text((x + col_w / 2, top - 18), f'W{w}', font=fs, fill=NAVY, anchor='mm')
    for k, (name, bars) in enumerate(rows):
        y = top + k * row_h
        d.line([0, y + row_h, width, y + row_h], fill='#E6EAF0')
        d.text((10, y + row_h / 2), name, font=f, fill='#101820', anchor='lm')
        for a, b, ms, crit, gate in sorted(bars, key=lambda x: x[3]):
            if ms:
                continue
            x0 = label_w + (a - 1) * col_w + 3
            x1 = label_w + b * col_w - 3
            colour = RED if crit else (GOLD if gate == pm.FEATURE else BLUE)
            d.rounded_rectangle([x0, y + 10, x1, y + row_h - 10], radius=6, fill=FILL[colour], outline=colour, width=3 if crit else 2)
        for a, b, ms, crit, gate in bars:
            if ms:
                cx = label_w + (a - 1) * col_w + (3 if a == info['golive_week'] and crit else col_w - 6)
                cy = y + row_h / 2
                d.polygon([(cx, cy - 13), (cx + 13, cy), (cx, cy + 13), (cx - 13, cy)], fill=RED if crit else NAVY)
    ly = top + row_h * len(rows) + 30
    items = [(RED, 'Holds the critical path to go-live'), (BLUE, 'Other work that holds the go-live'),
             (GOLD, 'Feature only: goes live later with a fallback'), (NAVY, 'Milestone')]
    x = 10
    for colour, text in items:
        d.rounded_rectangle([x, ly, x + 40, ly + 26], radius=5, fill=FILL[colour], outline=colour, width=3)
        d.text((x + 50, ly + 13), text, font=fs, fill='#101820', anchor='lm')
        x += 70 + int(d.textlength(text, font=fs))
    d.text((10, ly + 50), 'Green column: go-live week. Bars span every task of the phase from the plan model.', font=fs, fill='#555F6D')
    im.save(os.path.join(OUT, f'ia-gantt-{size.lower()}.png'))
    print('wrote', f'ia-gantt-{size.lower()}.png')


if __name__ == '__main__':
    phases()
    inputs()
    partners()
    regulatory()
    environments()
    for size in pm.SIZES:
        critical(size)
        gantt(size)
