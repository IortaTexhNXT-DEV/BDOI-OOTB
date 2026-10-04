"""Prints the markdown tables of the delivery documents from the plan model, so the documents can be refreshed when
the model changes:

    python3 doc_tables.py weeks        weeks of each phase and milestone by size (Implementation Approach and Plan)
    python3 doc_tables.py critical     critical path and near-critical tasks by size (Dependency Map)
    python3 doc_tables.py slip         float to go-live of each dependency by size (Dependency Map)
    python3 doc_tables.py features     margin of the feature-only dependencies before go-live (Dependency Map)
    python3 doc_tables.py leads        lead times by size (Dependency Map)
"""
import sys

import plan_model as pm

SHORT = {
    'M1': 'Kick-off', 'M2': 'Charter and baselined plan', 'M3': 'Data request and go-live kits issued', 'M4': 'Broker team named',
    'M5': 'Hosting and environment set decided', 'E1': 'Dev provisioned', 'E2': 'SIT provisioned', 'E3': 'UAT provisioned',
    'E4': 'GitHub Environments set up', 'E5': 'Secrets and encryption keys', 'E6': 'First pipeline deployment', 'E7': 'Production provisioned',
    'D1': 'Process workshops', 'D2': 'Compliance workshop', 'D3': 'Integration workshop', 'D4': 'Branding workshop', 'D5': 'Fit-gap signed',
    'I1': 'Insurers, rates, products', 'I2': 'Chart of accounts', 'I3': 'User list and reporting lines', 'I4': 'SMTP mailbox',
    'I5': 'Bank accounts and statement samples', 'I6': 'Partner contracts and credentials', 'I7': 'COC series', 'I8': 'Logo, pictures, signatories',
    'I9': 'Training rooms and attendees', 'I10': 'UAT testers named', 'R1': 'BIR ATP or CAS, invoice serials', 'R2': 'BIR EIS enrolment',
    'R3': 'AMLC registration', 'R4': 'IC licence data', 'R5': 'NPC registration', 'R6': 'Tax adviser confirmation', 'R7': 'Screening lists and licence',
    'R8': 'Permission for client marks', 'C1': 'Configuration kit filled', 'C2': 'Configuration kit loaded', 'C3': 'On-screen configuration',
    'C4': 'Configuration to UAT for mock 1', 'C5': 'Configuration complete', 'K1': 'Compliance set-up', 'K2': 'Screening lists loaded',
    'K3': 'AMLC report file test', 'B1': 'Branding and brand pack', 'B2': 'Client brand pack applied', 'N1': 'E-mail tested',
    'N2': 'Bank statement imports', 'N3': 'Bank payment files certified', 'N4': 'SMS or Viber live', 'N5': 'CTPL authentication live',
    'N6': 'Insurer API connectors', 'N7': 'Payment gateway live', 'N8': 'EIS connector in test mode', 'N9': 'EIS connector live',
    'G1': 'Extraction and cleansing', 'G2': 'Mapping to the migration kit', 'G3': 'Mock load 1', 'G4': 'Mock load 2', 'G5': 'Mock load 3',
    'G6': 'Mock load 4', 'L1': 'Train-the-trainer', 'L2': 'Compliance officer and DPO training', 'L3': 'End-user training',
    'T1': 'System integration test', 'T2': 'SIT exit', 'T3': 'Promotion to UAT', 'T4': 'UAT', 'T5': 'UAT sign-off',
    'X1': 'Release to Production', 'X2': 'Pre-Prod created', 'X3': 'Cutover rehearsal', 'X4': 'Go/no-go 1', 'X5': 'Cutover',
    'X6': 'Go-live', 'H1': 'Hypercare', 'H2': 'First month-end close', 'H3': 'Hypercare exit',
}
S = {size: pm.schedule(size) for size in pm.SIZES}


def wk(tid, size):
    if tid not in S[size]:
        return 'n/a'
    a, b = pm.weeks(tid, S[size][tid])
    return f'W{a}' if a == b else f'W{a} to W{b}'


def flt(tid, size):
    if tid not in S[size]:
        return 'n/a'
    f = S[size][tid]['float_golive']
    return 'n/a' if f is None else ('0 (critical)' if f == 0 else str(f))


def table(head, rows):
    print('| ' + ' | '.join(head) + ' |')
    print('|' + '---|' * len(head))
    for r in rows:
        print('| ' + ' | '.join(r) + ' |')
    print()


def weeks():
    rows = []
    for code, name in pm.PHASES:
        r = [name]
        for size in pm.SIZES:
            ids = [t[0] for t in pm.TASKS if t[1] == code and t[0] in S[size]]
            a = min(pm.weeks(x, S[size][x])[0] for x in ids)
            b = max(pm.weeks(x, S[size][x])[1] for x in ids)
            r.append(f'W{a}' if a == b else f'W{a} to W{b}')
        rows.append(r)
    table(['Phase'] + pm.SIZES, rows)
    rows = [[SHORT[t]] + [('Start of ' if t in pm.START_OF_WEEK else 'End of ') + wk(t, s) for s in pm.SIZES]
            for t in ['M1', 'D5', 'C5', 'T2', 'T5', 'X4', 'X6', 'H3']]
    table(['Milestone'] + pm.SIZES, rows)


def critical():
    for size in pm.SIZES:
        chain = [t for t in pm.critical_chain(size) if t not in ('H1', 'H3')]
        print(f'{size}: ' + ' > '.join(f'{SHORT[t]} ({wk(t, size)})' for t in chain))
        near = sorted([t for t, v in S[size].items() if v['float_golive'] is not None and 0 < v['float_golive'] <= 5],
                      key=lambda t: S[size][t]['float_golive'])
        print('  near: ' + '; '.join(f'{SHORT[t]} {S[size][t]["float_golive"]} days' for t in near))
        print()


def slip(ids):
    table(['ID', 'Dependency'] + [f'{s}' for s in pm.SIZES], [[t, SHORT[t]] + [flt(t, s) for s in pm.SIZES] for t in ids])


def features(ids):
    rows = []
    for t in ids:
        r = [t, SHORT[t]]
        for s in pm.SIZES:
            v = S[s].get(t)
            if not v:
                r.append('n/a')
                continue
            m = S[s]['X6']['start'] - v['finish']
            r.append(f'{wk(t, s)}, {m} days before go-live' if m >= 0 else f'{wk(t, s)}, {-m} days after go-live')
        rows.append(r)
    table(['ID', 'Dependency'] + pm.SIZES, rows)


def leads(ids):
    table(['ID', 'Item', 'Owner'] + pm.SIZES,
          [[t, SHORT[t], pm.task(t)[4]] + [('n/a' if pm.task(t)[6][k] is None else f'{pm.task(t)[6][k]} days') for k in range(4)] for t in ids])


if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else 'weeks'
    if what == 'weeks':
        weeks()
    elif what == 'critical':
        critical()
    elif what == 'slip':
        slip(['M4', 'M5', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'D1', 'D2', 'I1', 'I2', 'I3', 'I4', 'I5', 'I8', 'I9', 'I10',
              'R1', 'R3', 'R4', 'R5', 'R6', 'R7', 'C1', 'C2', 'C3', 'K1', 'K2', 'K3', 'B1', 'N1', 'N2', 'G1', 'G2', 'G3', 'G4', 'G5',
              'G6', 'L1', 'L2', 'L3', 'T1', 'T4', 'X1', 'X3'])
    elif what == 'features':
        features(['I6', 'I7', 'R8', 'B2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'R2', 'N9'])
    elif what == 'leads':
        leads(['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'I6', 'N3', 'N4', 'N5', 'N6', 'N7', 'E7', 'G1'])
