"""The BrokerVerse implementation plan as data: tasks, durations by broker size, owners, predecessors and milestones,
with a small critical path calculation. One model feeds the Implementation Plan workbook (build_plan_xlsx.py), the
dependency and critical path diagrams (build_delivery_diagrams.py) and the tables of the Implementation Approach and
Plan and of the Dependency Map and Critical Path.

    python3 plan_model.py            prints the schedule check and the markdown tables used in the documents

Units: working days (5 a week). Day 0 is the kick-off, the Monday of week 1. A task of duration d that starts on day s
occupies days s to s + d - 1 and finishes at s + d. A milestone has duration 0. Links: FS (finish to start), SS (start to
start), each with a lag in working days (one number, or one per size). Tasks start as early as their links allow, or on
their "not before" day. The go-live is pinned to the first day of the go-live week of the size.

Durations, lead times and the order of tasks are planning assumptions of iorta TechNXT for an out-of-the-box
implementation. The steering committee re-baselines them at mobilisation once the data volumes, the partners and the
broker's regulatory status are known.
"""

SIZES = ['Small', 'Medium', 'Large', 'Enterprise']
SIZE_INFO = {
    'Small': {'weeks': 8, 'golive_week': 7, 'hypercare': '2 weeks', 'users': '1 to 25',
              'envs': 'Dev, UAT, Production; Pre-Prod temporary', 'sit': 'Dev', 'mock_env': 'UAT',
              'mocks': 'Mock loads 1 and 2 in UAT; the cutover rehearsal in Pre-Prod is the third load'},
    'Medium': {'weeks': 12, 'golive_week': 10, 'hypercare': '3 weeks', 'users': '26 to 100',
               'envs': 'Dev, UAT, Production; Pre-Prod temporary', 'sit': 'Dev', 'mock_env': 'UAT',
               'mocks': 'Mock loads 1 and 2 in UAT; the cutover rehearsal in Pre-Prod is the third load'},
    'Large': {'weeks': 20, 'golive_week': 15, 'hypercare': '6 weeks', 'users': '101 to 300',
              'envs': 'Dev, SIT, UAT, Production (high availability); Pre-Prod temporary', 'sit': 'SIT', 'mock_env': 'SIT then UAT',
              'mocks': 'Mock loads 1 and 2 in SIT, mock load 3 in UAT; the cutover rehearsal in Pre-Prod is the fourth load'},
    'Enterprise': {'weeks': 26, 'golive_week': 21, 'hypercare': '6 weeks', 'users': 'above 300',
                   'envs': 'Dev, SIT, UAT, Production (high availability, cross-region backup copy); Pre-Prod temporary',
                   'sit': 'SIT', 'mock_env': 'SIT then UAT',
                   'mocks': 'Mock loads 1 and 2 in SIT, mock loads 3 and 4 in UAT; the cutover rehearsal in Pre-Prod is the fifth load'},
}

IORTA, BROKER, PARTNER = 'iorta TechNXT', 'Broker', 'Partner'

PHASES = [
    ('MOB', 'Mobilisation'), ('ENV', 'Environments and pipeline'), ('DIS', 'Discovery and fit-gap'),
    ('INP', 'Client inputs'), ('REG', 'Regulatory registrations'), ('CFG', 'Configuration (go-live configuration kit)'),
    ('CMP', 'Compliance set-up'), ('BRD', 'Branding and brand pack'), ('INT', 'Integrations with partners'),
    ('MIG', 'Data migration (go-live migration kit)'), ('TRN', 'Training'), ('TST', 'SIT and UAT'),
    ('CUT', 'Rehearsal and cutover'), ('HYP', 'Hypercare'),
]
PHASE_NAME = dict(PHASES)

# gate: what the task holds back when it is late
#   golive   the go/no-go and the go-live date
#   feature  only the feature it serves: go live with the documented fallback and switch the feature on later
#   exit     the hypercare exit
GOLIVE, FEATURE, EXIT = 'golive', 'feature', 'exit'

N = None
# (id, phase, task, party, owner role, deliverable or evidence, durations [S, M, L, E], links, gate, not-before days [S, M, L, E])
TASKS = [
    # ------------------------------------------------------------------ mobilisation
    ('M1', 'MOB', 'Kick-off', IORTA, 'iorta TechNXT PM', 'Kick-off held; plan and go-live date confirmed', [0, 0, 0, 0], [], GOLIVE, N),
    ('M2', 'MOB', 'Project charter, baselined plan, governance calendar, RAID log', IORTA, 'iorta TechNXT PM',
     'Charter and plan signed', [2, 3, 5, 5], [('M1', 'FS', 0)], GOLIVE, N),
    ('M3', 'MOB', 'Data request list and the go-live kits issued (configuration and migration workbooks, upload templates)', IORTA,
     'iorta TechNXT PM', 'Data request list; blank workbooks handed over', [1, 1, 1, 1], [('M1', 'FS', 0)], GOLIVE, N),
    ('M4', 'MOB', 'Broker team named: PM, key users, Accounting Manager, System Administrator, compliance officer, DPO', BROKER,
     'Broker sponsor', 'Named team with committed time', [1, 2, 3, 3], [('M1', 'FS', 0)], GOLIVE, N),
    ('M5', 'MOB', 'Hosting option, environment set and data location confirmed; environments ordered', BROKER,
     'Broker sponsor and IT head', 'Order Form hosting fields; transfer decision recorded', [1, 2, 3, 3], [('M1', 'FS', 0)], GOLIVE, N),
    # ------------------------------------------------------------------ environments and pipeline
    ('E1', 'ENV', 'Dev provisioned', IORTA, 'iorta TechNXT DevOps lead', 'Environment sheet: Dev', [2, 3, 4, 4], [('M5', 'FS', 0)], GOLIVE, N),
    ('E2', 'ENV', 'SIT provisioned (large and enterprise brokers)', IORTA, 'iorta TechNXT DevOps lead', 'Environment sheet: SIT',
     [N, N, 4, 5], [('E1', 'FS', 0)], GOLIVE, N),
    ('E3', 'ENV', 'UAT provisioned', IORTA, 'iorta TechNXT DevOps lead', 'Environment sheet: UAT', [2, 3, 4, 5], [('M5', 'FS', 0)], GOLIVE, N),
    ('E4', 'ENV', 'GitHub Environments (dev, sit, uat, preprod, production): protection rules, reviewers, variables, environment secrets',
     IORTA, 'iorta TechNXT DevOps lead', 'Settings recorded in the environment sheet', [2, 2, 3, 3], [('E1', 'FS', 0)], GOLIVE, N),
    ('E5', 'ENV', 'Application secrets per environment in the secret store: JWT_SECRET, DATA_ENCRYPTION_KEY, PII_ENCRYPTION_KEY generated; key custody and escrow copy agreed',
     IORTA, 'iorta TechNXT DevOps lead with the broker IT head', 'Key custody record signed by both', [1, 1, 2, 2], [('E1', 'FS', 0)], GOLIVE, N),
    ('E6', 'ENV', 'First deployment through the pipeline (CI, deploy, smoke test) to Dev and UAT (and SIT)', IORTA,
     'iorta TechNXT DevOps lead', 'Deploy run summaries; smoke test passed', [1, 1, 2, 2], [('E4', 'FS', 0), ('E5', 'FS', 0), ('E3', 'FS', 0), ('E2', 'FS', 0)], GOLIVE, N),
    ('E7', 'ENV', 'Production provisioned at production topology; backups, monitoring, restore test', IORTA,
     'iorta TechNXT DevOps lead', 'Environment sheet; restore test record', [5, 8, 10, 12], [('E5', 'FS', 0)], GOLIVE, N),
    # ------------------------------------------------------------------ discovery
    ('D1', 'DIS', 'Process workshops on the delivered system: organisation, sales, placement, servicing, claims, billing, remittance, commission, ledger, tax, distribution',
     IORTA, 'iorta TechNXT consultants', 'Workshop notes; decisions in the configuration workbook', [7, 11, 20, 28], [('M1', 'FS', 0)], GOLIVE, N),
    ('D2', 'DIS', 'Compliance workshop: AML/CFT programme, IC registers, complaints, breach procedure, masking by role', IORTA,
     'iorta TechNXT consultant with the compliance officer and DPO', 'Compliance decisions recorded', [1, 2, 2, 3], [('M4', 'FS', 0)], GOLIVE, N),
    ('D3', 'DIS', 'Integration workshop: banks, SMS or Viber, CTPL authentication and LTO, insurers, payment gateway, BIR EIS, AMLC reporting',
     IORTA, 'iorta TechNXT technical lead', 'Integration list with partner contacts', [1, 2, 2, 3], [('M4', 'FS', 0)], GOLIVE, N),
    ('D4', 'DIS', 'Branding workshop: theme, logo, sign-in picture, documents, e-signatures, brand pack choice', IORTA,
     'iorta TechNXT consultant', 'Branding decisions; client brand pack needed or not, with its contract reference', [1, 1, 1, 2], [('M4', 'FS', 0)], GOLIVE, N),
    ('D5', 'DIS', 'Configuration decisions and fit-gap register signed', BROKER, 'Broker process owners', 'Signed fit-gap register',
     [0, 0, 0, 0], [('D1', 'FS', 0), ('D2', 'FS', 0), ('D3', 'FS', 0), ('D4', 'FS', 0), ('M2', 'FS', 0)], GOLIVE, N),
    # ------------------------------------------------------------------ client inputs
    ('I1', 'INP', 'Insurer list and agreements, commission and referrer rates, product list', BROKER, 'Broker key users',
     'Filled sheets of the configuration kit', [4, 7, 12, 15], [('M3', 'FS', 0)], GOLIVE, N),
    ('I2', 'INP', 'Chart of accounts and the accountant\'s mapping decisions', BROKER, 'Broker Accounting Manager',
     'Chart of Accounts sheet; mapping decisions', [4, 7, 12, 15], [('M3', 'FS', 0)], GOLIVE, N),
    ('I3', 'INP', 'User list with roles, branches and reporting lines (My Team follows the reporting line)', BROKER,
     'Broker System Administrator', 'Users sheet', [4, 6, 10, 12], [('M3', 'FS', 0)], GOLIVE, N),
    ('I4', 'INP', 'SMTP mailbox and credentials', BROKER, 'Broker IT head', 'Mailbox in the secret store', [3, 5, 5, 5], [('M3', 'FS', 0)], GOLIVE, N),
    ('I5', 'INP', 'Bank accounts, one statement export per account, bank contacts for payment files, payee bank accounts', BROKER,
     'Broker Accounting', 'Statement samples; Payee Bank Accounts sheet', [5, 8, 10, 12], [('M3', 'FS', 0)], FEATURE, N),
    ('I6', 'INP', 'Partner contracts and credentials: SMS provider, CTPL authentication provider, payment gateway, insurer API access',
     BROKER, 'Broker IT head and sponsor', 'Signed contracts; credentials in the secret store', [8, 10, 15, 20], [('D3', 'FS', 0)], FEATURE, N),
    ('I7', 'INP', 'COC number series from each insurer', BROKER, 'Broker Operations', 'COC Series sheet', [5, 8, 10, 10], [('M3', 'FS', 0)], FEATURE, N),
    ('I8', 'INP', 'Logo, sign-in picture, signatories with e-signature consent', BROKER, 'Broker marketing and signatories',
     'Images; consents on file', [3, 5, 5, 8], [('D4', 'FS', 0)], GOLIVE, N),
    ('I9', 'INP', 'Training rooms, devices and attendance list', BROKER, 'Broker PM', 'Training schedule', [5, 5, 5, 5], [('M4', 'FS', 0)], GOLIVE, N),
    ('I10', 'INP', 'UAT testers and sign-off authority named', BROKER, 'Broker PM', 'UAT roster', [2, 2, 3, 3], [('M4', 'FS', 0)], GOLIVE, N),
    # ------------------------------------------------------------------ regulatory registrations (lead times are assumptions)
    ('R1', 'REG', 'BIR: Authority to Print or CAS registration and the invoice serial range confirmed (new or existing); last numbers used',
     BROKER, 'Broker Accounting Manager with the tax adviser', 'ATP or CAS acknowledgement; invoice.* settings', [20, 25, 30, 30], [('M1', 'FS', 0)], GOLIVE, N),
    ('R2', 'REG', 'BIR: EIS enrolment and certification (when the broker is covered)', BROKER, 'Broker Accounting Manager',
     'EIS accreditation id and credentials', [30, 30, 30, 30], [('M1', 'FS', 0)], FEATURE, N),
    ('R3', 'REG', 'AMLC: registration of the broker as covered person, portal access, institution code', BROKER,
     'Broker compliance officer', 'Portal access; aml.amlc_institution_code', [15, 20, 20, 20], [('M1', 'FS', 0)], GOLIVE, N),
    ('R4', 'REG', 'IC: licence data of the firm, officers and agents; certificates of authority of the insurers', BROKER,
     'Broker compliance officer', 'Licence copies; certificate numbers and validity', [5, 8, 10, 12], [('M4', 'FS', 0)], GOLIVE, N),
    ('R5', 'REG', 'NPC: registration of the DPO and the data processing systems confirmed; privacy notice version', BROKER,
     'Broker DPO', 'NPC registration; privacy.notice_version', [20, 25, 30, 30], [('M1', 'FS', 0)], GOLIVE, N),
    ('R6', 'REG', 'Tax adviser confirmation: tax codes, ATC, rates, invoice and receipt wording, VAT treatment of commission', BROKER,
     'Broker tax adviser', 'Written confirmation', [5, 5, 8, 10], [('C3', 'SS', [3, 5, 8, 10])], GOLIVE, N),
    ('R7', 'REG', 'Screening lists: UN and AMLC lists obtained; PEP list licence from a provider (when used)', BROKER,
     'Broker compliance officer', 'List files and licence', [10, 12, 15, 15], [('D2', 'FS', 0)], GOLIVE, N),
    ('R8', 'REG', 'Contract reference covering the use of the client\'s marks on the engagement file (client brand pack only)', BROKER, 'Broker sponsor',
     'Contract reference on the engagement file', [3, 5, 5, 5], [('D4', 'FS', 0)], FEATURE, N),
    # ------------------------------------------------------------------ configuration
    ('C1', 'CFG', 'Configuration kit filled: company, settings, PSGC addresses, branches, users, chart of accounts, banks, insurers, products, commission, taxes, authority limits, numbering',
     BROKER, 'Broker key users with iorta TechNXT consultants', 'Filled configuration workbook', [5, 8, 12, 15],
     [('D1', 'SS', [3, 5, 6, 10]), ('I1', 'FS', 0), ('I2', 'FS', 0), ('I3', 'FS', 0)], GOLIVE, N),
    ('C2', 'CFG', 'Configuration kit uploaded, validated, errors workbook corrected and loaded in Dev (small, medium) or SIT (large, enterprise)',
     IORTA, 'iorta TechNXT consultant', 'Batch Loaded; load history', [2, 3, 4, 5], [('C1', 'FS', 0), ('E6', 'FS', 0)], GOLIVE, N),
    ('C3', 'CFG', 'On-screen configuration: Product Configurator (templates, rating factors, acceptance rules, document templates, market mapping), tax codes, posting rules, approvals, roles, schedules',
     IORTA, 'iorta TechNXT consultants', 'Configuration workbook updated with the values set', [7, 11, 18, 25], [('C2', 'FS', 0), ('D5', 'FS', 0)], GOLIVE, N),
    ('C4', 'CFG', 'Configuration promoted to UAT for the first mock load (Current data workbook)', IORTA, 'iorta TechNXT consultant',
     'Load history in UAT', [1, 1, N, N], [('C2', 'FS', 0)], GOLIVE, N),
    ('C5', 'CFG', 'Configuration complete', IORTA, 'iorta TechNXT delivery lead', 'Checklist of GO_LIVE_DATA_SETUP steps 1 to 12',
     [0, 0, 0, 0], [('C3', 'FS', 0), ('K1', 'FS', 0), ('B1', 'FS', 0)], GOLIVE, N),
    # ------------------------------------------------------------------ compliance set-up
    ('K1', 'CMP', 'Compliance set-up: AML settings, risk factors, monitoring rules; licence register, fit and proper, insurer authority; complaints and breach settings; view:pii grants and masking',
     IORTA, 'iorta TechNXT consultant with the compliance officer', 'AML Settings saved; registers filled', [4, 6, 8, 10],
     [('C2', 'FS', 0), ('D2', 'FS', 0), ('R4', 'FS', 0)], GOLIVE, N),
    ('K2', 'CMP', 'Screening lists loaded (UN, AMLC, PEP, internal); clients rescreened', BROKER, 'Broker compliance officer',
     'Versions on Screening Lists; rescreen result', [1, 1, 1, 1], [('K1', 'FS', 0), ('R7', 'FS', 0)], GOLIVE, N),
    ('K3', 'CMP', 'AMLC report file test: CTR file generated in UAT and checked against the AMLC portal requirements', BROKER,
     'Broker compliance officer', 'Test file; portal access confirmed', [1, 1, 2, 2], [('K1', 'FS', 0), ('R3', 'FS', 0)], GOLIVE, N),
    # ------------------------------------------------------------------ branding
    ('B1', 'BRD', 'Theme and Branding, letterhead, sign-in page, branded documents and e-mails; e-signatures captured and mapped; brand pack exported',
     IORTA, 'iorta TechNXT consultant with the broker System Administrator', 'Brand pack file; sample documents approved', [3, 4, 5, 6],
     [('C2', 'FS', 0), ('I8', 'FS', 0)], GOLIVE, N),
    ('B2', 'BRD', 'Client brand pack applied only in that client\'s environments under its contract with iorta TechNXT (for example the Toyota Insurance Services pack)', IORTA,
     'iorta TechNXT consultant', 'Pack enabled with the engagement confirmation; contract reference on file', [1, 1, 1, 1], [('B1', 'FS', 0), ('R8', 'FS', 0)], FEATURE, N),
    # ------------------------------------------------------------------ integrations with partners
    ('N1', 'INT', 'E-mail: SMTP set, password reset and approval link tested', IORTA, 'iorta TechNXT DevOps lead',
     'Test e-mails received', [1, 1, 2, 2], [('E6', 'FS', 0), ('I4', 'FS', 0)], GOLIVE, N),
    ('N2', 'INT', 'Bank statement formats: one statement per bank account imported with a balancing preview', IORTA,
     'iorta TechNXT consultant with Accounting', 'Import preview per account', [3, 4, 6, 8], [('C2', 'FS', 0), ('I5', 'FS', 0)], GOLIVE, N),
    ('N3', 'INT', 'Bank payment files: each layout validated with the bank and a test file accepted by the bank', PARTNER,
     'Bank, with Accounting and iorta TechNXT', 'Bank acceptance of the test file', [10, 15, 20, 25], [('C2', 'FS', 0), ('I5', 'FS', 0)], FEATURE, N),
    ('N4', 'INT', 'SMS or Viber connector: provider account, sender name, live test message', PARTNER, 'SMS provider, with the broker IT head',
     'Connector Live; test message in the outbox', [5, 8, 10, 10], [('C2', 'FS', 0), ('I6', 'FS', 0)], FEATURE, N),
    ('N5', 'INT', 'CTPL authentication provider and LTO feed: broker accredited, COC series loaded, live authentication of one COC', PARTNER,
     'IC-accredited authentication provider, with Operations', 'Authenticated COC; LTO column result', [8, 10, 15, 15],
     [('C2', 'FS', 0), ('I6', 'FS', 0), ('I7', 'FS', 0)], FEATURE, N),
    ('N6', 'INT', 'Insurer API connectors: mapping per insurer, preview, test issuance and claim status with the insurer', PARTNER,
     'Insurers, with the Processing Team', 'Accepted test request per insurer', [10, 15, 20, 25], [('C3', 'SS', 2), ('I6', 'FS', 0)], FEATURE, N),
    ('N7', 'INT', 'Payment gateway: sandbox payment receipted, then one live test payment', PARTNER, 'Payment gateway, with Accounting',
     'Receipt of the sandbox payment', [3, 5, 5, 5], [('C2', 'FS', 0), ('I6', 'FS', 0)], FEATURE, N),
    ('N8', 'INT', 'BIR EIS connector set in test mode; payloads checked', IORTA, 'iorta TechNXT consultant', 'Accepted test submissions',
     [1, 1, 2, 2], [('C3', 'FS', 0)], FEATURE, N),
    ('N9', 'INT', 'BIR EIS connector live (after enrolment); earlier invoices queued', IORTA, 'iorta TechNXT consultant with Accounting',
     'Accepted live submission', [2, 2, 2, 2], [('N8', 'FS', 0), ('R2', 'FS', 0), ('X6', 'FS', 0)], FEATURE, N),
    # ------------------------------------------------------------------ data migration
    ('G1', 'MIG', 'Extraction and cleansing of the old system data for the first mock load', BROKER, 'Broker data owners',
     'Extract files; data quality notes', [8, 12, 20, 25], [('M3', 'FS', 0)], GOLIVE, N),
    ('G2', 'MIG', 'Mapping to the migration kit (clients, policies, open items, open claims, opening balances)', IORTA,
     'iorta TechNXT migration lead', 'Mapping sheets', [3, 5, 8, 10], [('G1', 'SS', [3, 5, 8, 10])], GOLIVE, N),
    ('G3', 'MIG', 'Mock load 1: cutover date set, validate, errors workbook, load, reconciliation', IORTA, 'iorta TechNXT migration lead',
     'Reconciliation workbook signed', [3, 4, 5, 5], [('G1', 'FS', 0), ('G2', 'FS', 0), ('C4', 'FS', 0), ('C2', 'FS', 0)], GOLIVE, N),
    ('G4', 'MIG', 'Mock load 2 on a fresh extract, with transaction reset before it', IORTA, 'iorta TechNXT migration lead',
     'Reconciliation workbook signed', [3, 3, 4, 5], [('G3', 'FS', 0), ('C5', 'FS', 0)], GOLIVE, N),
    ('G5', 'MIG', 'Mock load 3 in UAT (large, enterprise)', IORTA, 'iorta TechNXT migration lead', 'Reconciliation workbook signed',
     [N, N, 4, 5], [('G4', 'FS', 0), ('T3', 'FS', 0)], GOLIVE, N),
    ('G6', 'MIG', 'Mock load 4 in UAT (enterprise)', IORTA, 'iorta TechNXT migration lead', 'Reconciliation workbook signed',
     [N, N, N, 5], [('G5', 'FS', 0)], GOLIVE, N),
    # ------------------------------------------------------------------ training
    ('L1', 'TRN', 'Train-the-trainer for key users, with trainer skills and teach-back', IORTA, 'iorta TechNXT consultants',
     'Key users passed at 90%', [3, 5, 8, 10], [('C5', 'FS', 0)], GOLIVE, N),
    ('L2', 'TRN', 'Compliance officer, DPO and System Administrator training on the compliance and privacy screens', IORTA,
     'iorta TechNXT consultant', 'Attendance and assessment', [1, 1, 2, 2], [('K1', 'FS', 0)], GOLIVE, N),
    ('L3', 'TRN', 'End-user training per role, run by key users', BROKER, 'Broker key users', 'Every user trained and assessed',
     [5, 8, 8, 15], [('L1', 'FS', 0), ('T3', 'FS', 0), ('I9', 'FS', 0)], GOLIVE, N),
    # ------------------------------------------------------------------ SIT and UAT
    ('T1', 'TST', 'System integration test in Dev (small, medium) or SIT (large, enterprise): end-to-end flows, uat-scenario.js, connectors in test mode',
     IORTA, 'iorta TechNXT test lead', 'SIT results; defect log', [4, 9, 10, 15], [('C3', 'SS', [4, 6, 18, 25]), ('C2', 'FS', 0)], GOLIVE, N),
    ('T2', 'TST', 'SIT exit', IORTA, 'iorta TechNXT test lead', 'SIT exit report', [0, 0, 0, 0], [('T1', 'FS', 0), ('C5', 'FS', 0)], GOLIVE, N),
    ('T3', 'TST', 'Release candidate and frozen configuration promoted to UAT (Current data workbook, brand pack); comparison report clean',
     IORTA, 'iorta TechNXT delivery lead', 'Deploy run; comparison workbook', [1, 1, 2, 2], [('T2', 'FS', 0), ('E3', 'FS', 0)], GOLIVE, N),
    ('T4', 'TST', 'UAT cycles with the UAT scripts and broker scenarios, including compliance, BIR and integration scripts', BROKER,
     'Broker key users', 'UAT results per script', [6, 8, 9, 20], [('T3', 'FS', 0), ('I10', 'FS', 0)], GOLIVE, N),
    ('T5', 'TST', 'UAT sign-off', BROKER, 'Broker sponsor and process owners', 'UAT Sign-off Certificate (Form 1)', [0, 0, 0, 0],
     [('T4', 'FS', 0), ('R6', 'FS', 0)], GOLIVE, N),
    # ------------------------------------------------------------------ rehearsal and cutover
    ('X1', 'CUT', 'Release tag and frozen configuration deployed to Production; production smoke test; transaction reset', IORTA,
     'iorta TechNXT DevOps lead', 'Deploy run; smoke test record; reset audit entry', [2, 2, 2, 3],
     [('T3', 'FS', 0), ('E7', 'FS', 0), ('R1', 'FS', 0)], GOLIVE, N),
    ('X2', 'CUT', 'Pre-Prod created from a production backup (masked when people without production access take part)', IORTA,
     'iorta TechNXT DevOps lead', 'Restore record (counts as a restore test)', [1, 1, 2, 2], [('X1', 'FS', 0)], GOLIVE, N),
    ('X3', 'CUT', 'Cutover rehearsal in Pre-Prod: reset, migration load of a fresh extract, reconciliation, go-live lock, comparison against Production, timings',
     IORTA, 'iorta TechNXT migration lead', 'Rehearsal log; reconciliation signed', [3, 3, 3, 5],
     [('X2', 'FS', 0), ('G4', 'FS', 0), ('G5', 'FS', 0), ('G6', 'FS', 0), ('T4', 'SS', [4, 5, 6, 15])], GOLIVE, N),
    ('X4', 'CUT', 'Go/no-go 1: UAT signed, rehearsal reconciled, users trained, registrations and partner states confirmed', BROKER,
     'Steering committee', 'Minutes', [0, 0, 0, 0],
     [('X3', 'FS', 0), ('T5', 'FS', 0), ('L3', 'FS', 0), ('L2', 'FS', 0), ('K2', 'FS', 0), ('K3', 'FS', 0), ('N1', 'FS', 0),
      ('N2', 'FS', 0), ('R5', 'FS', 0), ('B1', 'FS', 0)], GOLIVE, N),
    ('X5', 'CUT', 'Cutover: freeze, final extract, final load, reconciliation, go/no-go 2, golive.locked, mask:data --register-production',
     BROKER, 'Broker PM with the iorta TechNXT migration lead', 'Signed reconciliation; go decision; audit entries', [2, 2, 2, 2],
     [('X4', 'FS', 0)], GOLIVE, N),
    ('X6', 'CUT', 'Go-live', BROKER, 'Broker sponsor', 'First day of transactions in BrokerVerse', [0, 0, 0, 0], [('X5', 'FS', 0)], GOLIVE,
     [30, 45, 70, 100]),
    # ------------------------------------------------------------------ hypercare
    ('H1', 'HYP', 'Hypercare: daily check-ins in week 1, then weekly; first receipts, remittances, bank imports and payment files watched',
     IORTA, 'iorta TechNXT PM', 'Hypercare log', [10, 15, 30, 30], [('X6', 'FS', 0)], EXIT, N),
    ('H2', 'HYP', 'First month-end close and BIR working papers of the first month supported', BROKER, 'Broker Accounting Manager',
     'Approved Month-End Close run', [5, 5, 10, 10], [('X6', 'FS', [5, 10, 15, 15])], EXIT, N),
    ('H3', 'HYP', 'Knowledge transfer, configuration baseline (Current data workbook of Production), handover; Pre-Prod removed', IORTA,
     'iorta TechNXT PM and support manager', 'Hypercare Exit and Handover Certificate', [0, 0, 0, 0], [('H1', 'FS', 0), ('H2', 'FS', 0)], EXIT, N),
]

MILESTONES = {'M1', 'D5', 'C5', 'T2', 'T5', 'X4', 'X6', 'H3'}
START_OF_WEEK = {'M1', 'X6'}   # shown at the start of their week, the others at the end of the week they fall in


def lag_of(lag, i):
    return lag[i] if isinstance(lag, list) else lag


def schedule(size):
    """Forward and backward pass for one size. Returns {id: dict(start, finish, dur, float_golive, float_end, critical)}."""
    i = SIZES.index(size)
    tasks = {t[0]: t for t in TASKS if t[6][i] is not None}
    links = {tid: [(p, k, lag_of(l, i)) for p, k, l in t[7] if p in tasks] for tid, t in tasks.items()}
    order, seen = [], set()

    def visit(tid):
        if tid in seen:
            return
        for p, _, _ in links[tid]:
            visit(p)
        seen.add(tid)
        order.append(tid)
    for tid in tasks:
        visit(tid)
    es, ef = {}, {}
    for tid in order:
        t = tasks[tid]
        start = 0
        for p, kind, lag in links[tid]:
            start = max(start, (ef[p] if kind == 'FS' else es[p]) + lag)
        if t[9]:
            start = max(start, t[9][i])
        es[tid], ef[tid] = start, start + t[6][i]

    def backward(target):
        """Latest finish so that `target` keeps its planned start; tasks that do not lead to it get None."""
        succ = {tid: [] for tid in tasks}
        for tid in tasks:
            for p, kind, lag in links[tid]:
                succ[p].append((tid, kind, lag))
        ls, lf = {target: es[target]}, {target: es[target] + tasks[target][6][i]}
        for tid in reversed(order):
            if tid == target:
                continue
            best = None
            for s, kind, lag in succ[tid]:
                if s not in ls:
                    continue
                cand = ls[s] - lag if kind == 'FS' else ls[s] - lag + tasks[tid][6][i]
                best = cand if best is None else min(best, cand)
            if best is not None:
                lf[tid] = best
                ls[tid] = best - tasks[tid][6][i]
        return ls
    ls_go = backward('X6')
    ls_end = backward('H3')
    out = {}
    for tid in order:
        fg = ls_go[tid] - es[tid] if tid in ls_go else None
        fe = ls_end[tid] - es[tid] if tid in ls_end else None
        out[tid] = {'start': es[tid], 'finish': ef[tid], 'dur': tasks[tid][6][i], 'float_golive': fg, 'float_end': fe,
                    'critical': fg == 0 or (fg is None and fe == 0)}
    return out


def week_of(tid, day, finish=False):
    """Week number of a day; a finish day or a milestone at the end of a week belongs to that week."""
    if tid in START_OF_WEEK:
        return day // 5 + 1
    if finish or tid in MILESTONES:
        return max(1, (day + 4) // 5)
    return day // 5 + 1


def weeks(tid, s):
    a = week_of(tid, s['start'])
    b = week_of(tid, s['finish'], finish=True) if s['dur'] else a
    return a, max(a, b)


def task(tid):
    return next(t for t in TASKS if t[0] == tid)


def critical_chain(size):
    """The chain of zero-float tasks to the go-live, in order, then the hypercare."""
    s = schedule(size)
    crit = [tid for tid, v in s.items() if v['float_golive'] == 0]
    crit.sort(key=lambda t: (s[t]['start'], s[t]['finish']))
    return crit + [t for t in ('H1', 'H3') if t in s]


def successors(tid):
    return [t[0] for t in TASKS if any(p == tid for p, _, _ in t[7])]


def check():
    """Every size meets its go-live week and its total length; prints the result."""
    ok = True
    for size in SIZES:
        s = schedule(size)
        info = SIZE_INFO[size]
        go = weeks('X6', s['X6'])[0]
        end = weeks('H3', s['H3'])[0]
        driven = s['X6']['start'] == task('X6')[9][SIZES.index(size)]
        slack = min(v['float_golive'] for k, v in s.items() if v['float_golive'] is not None and k != 'X6')
        print(f'{size:10} go-live week {go} (plan {info["golive_week"]}), end week {end} (plan {info["weeks"]}), '
              f'go-live held by its date: {driven}, smallest float to go-live {slack} days')
        ok &= go == info['golive_week'] and end == info['weeks'] and slack == 0
    return ok


if __name__ == '__main__':
    import sys
    good = check()
    for size in SIZES:
        s = schedule(size)
        print('\n' + size, 'critical path:', ' > '.join(critical_chain(size)))
        for tid, v in sorted(s.items(), key=lambda kv: (kv[1]['start'], kv[0])):
            a, b = weeks(tid, v)
            print(f'  {tid:4} d{v["start"]:3}-{v["finish"]:3} W{a:2}-W{b:2} fg={v["float_golive"]} fe={v["float_end"]}  {task(tid)[2][:70]}')
    sys.exit(0 if good else 1)
