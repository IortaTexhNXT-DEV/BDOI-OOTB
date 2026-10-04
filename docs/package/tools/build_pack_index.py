"""Writes the documentation pack index in two forms from one list, so they never differ:

    python3 build_pack_index.py

  ../README.md                                  (markdown for the repository)
  ../source/documentation-pack-index.md         (source of 08_Management/BrokerVerse_OOTB_Documentation_Pack_Index)

Then build the document (build_all.py runs this script first):
    python3 build_all.py documentation-pack-index

Every file in the folders 01_Sales to 08_Management must appear in DOCS and every DOCS entry must exist; the script
stops with the names of the files concerned. Sub-folders in SUBFOLDERS are listed as one entry when they exist.
Entries named in PENDING belong to a package that is being merged: while their files are missing the script warns
instead of stopping. Once every package is merged the warning disappears; run this script again after each merge.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PKG = os.path.dirname(HERE)

# audiences (departments), in the order of the index by audience
U, V, B, Q, D, S, P, M = ('Users', 'Developers', 'Business analysts', 'QA', 'Delivery and PM', 'Sales', 'Support',
                          'Management')
AUDIENCES = [
    (U, 'The broker\'s users and key users, and the System Administrator, using the application day to day.'),
    (V, 'Product engineering and the developers who review, extend or deploy the code.'),
    (B, 'Business analysts and solution consultants who run discovery, fit-gap and configuration.'),
    (Q, 'Quality analysts and test leads who plan, run and report the tests.'),
    (D, 'The delivery head, project managers and implementation consultants.'),
    (S, 'Account managers and presales.'),
    (P, 'L2 application support, L3 engineering on call and DevOps.'),
    (M, 'iorta TechNXT management, and the broker\'s management for client-facing files.'),
]
# lifecycle codes
PRE, CON, IMP, GO, SUP = 'Pre-sales', 'Contracting', 'Implementation', 'Go-live', 'Support'

# (folder, base name, formats, purpose, audiences, client-facing (True) or INTERNAL (False), lifecycle stages)
DOCS = [
    # ---------------------------------------------------------------- 01_Sales
    ('01_Sales', 'iNXT_BrokerVerse_Brochure', 'docx, pdf', 'Product brochure (8 pages): platform, compliance, connections, roles, deployment, delivery and support', [S], True, [PRE]),
    ('01_Sales', 'iNXT_BrokerVerse_One_Page_Brochure', 'docx, pdf, png', 'One-page summary for a first e-mail, a trade event or a social post', [S], True, [PRE]),
    ('01_Sales', 'iNXT_BrokerVerse_Client_Presentation', 'pptx, pdf', 'Client presentation deck for the first meeting, with speaker notes', [S], True, [PRE]),
    ('01_Sales', 'iNXT_BrokerVerse_Product_Functionality', 'docx, pdf', 'What the product does, module by module, with the vendor comparison checklist', [S, B, M], True, [PRE]),
    ('01_Sales', 'iNXT_BrokerVerse_Demo_Script', 'docx, pdf', 'Scripted 60 and 30-minute demonstrations with optional segments (AML/CFT, IC registers, BIR and EOPT, integrations, dealer programmes, branding, My Work, Report Builder)', [S], True, [PRE]),
    ('01_Sales', 'iNXT_BrokerVerse_FAQ_and_Objection_Handling', 'docx, pdf', 'Answers to common questions and objections; known limits to disclose', [S], True, [PRE]),
    ('01_Sales', 'iNXT_BrokerVerse_Prospect_Email_Templates', 'docx, pdf', 'E-mails from first contact to the welcome after signing, including the compliance-led introduction', [S], True, [PRE, CON]),
    ('01_Sales', 'Prospect_Email_Templates', 'txt', 'Plain-text copy of the prospect e-mails for pasting into a mail client (generated from the same source)', [S], True, [PRE, CON]),
    ('01_Sales', 'iNXT_BrokerVerse_ROI_Calculator', 'xlsx', 'Return on investment calculator filled in with the broker', [S], True, [PRE]),
    ('01_Sales', 'iNXT_BrokerVerse_Competitive_Battlecard_INTERNAL', 'docx, pdf', 'Competitor positioning, proof points and limits to disclose', [S], False, [PRE]),
    # ---------------------------------------------------------------- 02_Commercials
    ('02_Commercials', 'iNXT_BrokerVerse_Commercial_Proposal_Rate_Card', 'docx, pdf', 'Rate card and commercial proposal given to the broker', [S, M], True, [PRE, CON]),
    ('02_Commercials', 'BrokerVerse_Commercials_and_Pricing', 'xlsx', 'Formula-driven pricing model behind the rate card', [M, S], False, [PRE, CON]),
    ('02_Commercials', 'iNXT_BrokerVerse_Price_Book', 'xlsx', 'Price book with quick quote, packages and negotiation limits', [S, M], False, [PRE, CON]),
    ('02_Commercials', 'BrokerVerse_Commercial_Proposal_Note', 'docx, pdf', 'Pricing rationale, market positioning, review of the new modules against the price list', [M, S], False, [PRE, CON]),
    ('02_Commercials', 'iNXT_BrokerVerse_Negotiation_Playbook_INTERNAL', 'docx, pdf', 'Discount limits, trade-offs and approval rules in negotiation', [S, M], False, [CON]),
    # ---------------------------------------------------------------- 03_Contracts
    ('03_Contracts', 'iNXT_BrokerVerse_Contract_Pack_Index_and_Cover_Letter', 'docx, pdf', 'Index of the contract pack and cover letter to the broker', [S, M], True, [CON]),
    ('03_Contracts', 'iNXT_BrokerVerse_Mutual_Non_Disclosure_Agreement', 'docx, pdf', 'Mutual NDA before detailed discussions', [S, M], True, [PRE]),
    ('03_Contracts', 'iNXT_BrokerVerse_Letter_of_Award_and_Proposal_Acceptance', 'docx, pdf', 'Broker letter of award and acceptance of the proposal', [S, M], True, [CON]),
    ('03_Contracts', 'iNXT_BrokerVerse_Master_Services_Agreement', 'docx, pdf', 'Master Services Agreement', [M], True, [CON]),
    ('03_Contracts', 'iNXT_BrokerVerse_Order_Form', 'docx, pdf', 'Order Form: size, model, prices, hosting and dates', [S, M], True, [CON]),
    ('03_Contracts', 'iNXT_BrokerVerse_Perpetual_Software_Licence_Agreement', 'docx, pdf', 'Licence schedule for the perpetual model', [M], True, [CON]),
    ('03_Contracts', 'iNXT_BrokerVerse_Software_Subscription_Agreement', 'docx, pdf', 'Subscription schedule for the SaaS model', [M], True, [CON]),
    ('03_Contracts', 'iNXT_BrokerVerse_Implementation_Statement_of_Work', 'docx, pdf', 'Implementation scope, milestones, acceptance and governance (SOW)', [D, B, M], True, [CON, IMP]),
    ('03_Contracts', 'iNXT_BrokerVerse_Annual_Maintenance_Support_and_SLA', 'docx, pdf', 'Annual maintenance, support and service levels', [P, M], True, [CON, SUP]),
    ('03_Contracts', 'iNXT_BrokerVerse_Hosting_and_Infrastructure_Services_Agreement', 'docx, pdf', 'Hosting services, data location, backups and recovery objectives', [P, M], True, [CON, SUP]),
    ('03_Contracts', 'iNXT_BrokerVerse_Data_Processing_Agreement', 'docx, pdf', 'Data processing agreement under the Data Privacy Act', [M, P], True, [CON]),
    ('03_Contracts', 'iNXT_BrokerVerse_Service_Catalogue_and_Rate_Annex', 'docx, pdf', 'Optional services and day rates', [S, M], True, [CON, SUP]),
    ('03_Contracts', 'iNXT_BrokerVerse_Customer_Responsibilities_and_RACI_Annex', 'docx, pdf', 'What the broker provides and who does what', [D, M], True, [CON, IMP]),
    ('03_Contracts', 'iNXT_BrokerVerse_Change_Request_Procedure_and_Form', 'docx, pdf', 'Change request procedure and form', [D, B, M], True, [CON, IMP, SUP]),
    ('03_Contracts', 'iNXT_BrokerVerse_Source_Code_Escrow_Agreement', 'docx, pdf', 'Optional source code escrow with the perpetual licence', [M], True, [CON]),
    ('03_Contracts', 'iNXT_BrokerVerse_Exit_and_Transition_Plan', 'docx, pdf', 'Data return and transition at the end of the contract', [M, P], True, [CON, SUP]),
    ('03_Contracts', 'iNXT_BrokerVerse_UAT_and_Go_Live_Acceptance_Certificates', 'docx, pdf', 'UAT and go-live acceptance certificates', [D, Q, M], True, [GO]),
    ('03_Contracts', 'iNXT_BrokerVerse_Hypercare_Exit_and_Handover_Certificate', 'docx, pdf', 'Hypercare exit and handover to support', [D, P, M], True, [GO, SUP]),
    # ---------------------------------------------------------------- 04_Onboarding_and_Go_Live
    ('04_Onboarding_and_Go_Live', 'BrokerVerse_Security_Due_Diligence_Questionnaire', 'docx, pdf, xlsx', 'Pre-answered security and outsourcing due diligence questionnaire', [S, D, M], True, [PRE, CON]),
    ('04_Onboarding_and_Go_Live', 'BrokerVerse_Discovery_Workbook_Guide', 'docx, pdf', 'How to run the discovery and configuration workshops', [B, D], True, [IMP]),
    ('04_Onboarding_and_Go_Live', 'BrokerVerse_Discovery_and_Configuration_Workbook', 'xlsx', 'Configuration decisions captured in discovery', [B, D], True, [IMP]),
    ('04_Onboarding_and_Go_Live', 'BrokerVerse_Data_Migration_and_Cutover_Plan', 'docx, pdf', 'Go-live data, workbench, mock loads, reconciliation and cutover', [D, B, Q], True, [IMP, GO]),
    ('04_Onboarding_and_Go_Live', 'BrokerVerse_Environment_Strategy_and_Production_Rollout', 'docx, pdf', 'Environments, promotion of code, scripts and configuration, release pipeline, cutover runbook and RACI', [D, V, P, M], True, [IMP, GO]),
    ('04_Onboarding_and_Go_Live', 'BrokerVerse_Privacy_Impact_Assessment_and_Records_of_Processing_Templates', 'docx, pdf', 'PIA and records of processing pre-filled for the broker DPO', [B, D, M], True, [IMP, GO]),
    # ---------------------------------------------------------------- 05_Delivery
    ('05_Delivery', 'BrokerVerse_Business_Requirements_Document', 'docx, pdf', 'Business requirements of the OOTB product by module, with business rules and regulatory references (BRD)', [B, Q, D, V], True, [PRE, IMP]),
    ('05_Delivery', 'BrokerVerse_Process_Flow_Document', 'docx, pdf', 'End-to-end process flows of the broker with the screens, roles and postings of each step (PFD)', [B, U, Q, D], True, [IMP]),
    ('05_Delivery', 'BrokerVerse_Implementation_Approach_and_Plan', 'docx, pdf', 'Method, phases, plans by size, roles, governance and risks', [D, M], True, [PRE, IMP]),
    ('05_Delivery', 'BrokerVerse_Implementation_Plan', 'xlsx', 'Gantt plans for the three sizes and the RACI matrix', [D], True, [IMP]),
    ('05_Delivery', 'BrokerVerse_Dependency_Map_and_Critical_Path', 'docx, pdf', 'Dependencies between work streams, partners and decisions, and the critical path to go-live', [D, M], True, [IMP, GO]),
    ('05_Delivery', 'BrokerVerse_Fit_Gap_Register', 'xlsx', 'Register of requirements classed Fit, Configure, Procedure or Gap, with the product gaps closed in this release', [B, D, M], True, [IMP]),
    ('05_Delivery', 'BrokerVerse_RAID_Log_Template', 'xlsx', 'Risks, assumptions, issues and dependencies with scoring and summary', [D, M], True, [IMP, GO]),
    ('05_Delivery', 'BrokerVerse_Project_Status_Report_Template', 'docx, pdf', 'Weekly or fortnightly status and steering committee report', [D, M], True, [IMP, GO]),
    ('05_Delivery', 'BrokerVerse_Training_Plan', 'docx, pdf', 'Training and change management by role', [D, U], True, [IMP]),
    ('05_Delivery', 'BrokerVerse_User_Manual', 'docx, pdf', 'User manual by role, also opened per screen from the Help panel (F1)', [U, B, Q, P], True, [IMP, GO, SUP]),
    ('05_Delivery', 'BrokerVerse_Reports_Book', 'docx, pdf, xlsx', 'Every report, dashboard and export with its columns and rules', [U, B, P], True, [IMP, SUP]),
    ('05_Delivery', 'BrokerVerse_Communication_Templates_and_Touchpoints', 'docx, pdf', 'Every e-mail, SMS, notification and printed document the system sends', [B, U, P], True, [IMP, SUP]),
    ('05_Delivery', 'BrokerVerse_Communication_Touchpoints', 'xlsx', 'Companion workbook of the communication templates', [B, P], True, [IMP, SUP]),
    ('05_Delivery', 'BrokerVerse_Schedules_and_Batch_Jobs', 'docx, pdf', 'Every scheduled job and batch process, the operational run book and the support runbook per job', [P, U, D], True, [IMP, GO, SUP]),
    ('05_Delivery', 'BrokerVerse_Test_Strategy', 'docx, pdf', 'How the product and each implementation are tested: levels, types, environments, test data and masking, entry and exit criteria, defects, CI gates', [Q, D, V, M], True, [IMP, GO]),
    ('05_Delivery', 'BrokerVerse_Test_Plan', 'docx, pdf', 'Test plan of a broker implementation: scope per module, schedule by size, cycles from SIT to hypercare, resourcing, sign-off', [Q, D, M], True, [IMP, GO]),
    ('05_Delivery', 'BrokerVerse_Test_Cases', 'xlsx', 'Release test cases with regulatory references, the requirements traceability matrix (sheet Requirements Traceability: the 150 processes to test cases and automated tests), defects', [Q, V], True, [IMP, GO]),
    ('05_Delivery', 'BrokerVerse_Test_Summary_Report', 'docx, pdf', 'Results of the release test', [Q, D, V, M], True, [PRE, GO]),
    ('05_Delivery', 'BrokerVerse_Philippine_Regulatory_Compliance_Matrix', 'docx, pdf', 'How the product supports IC, BIR, premium tax, CTPL, DPA and AMLA obligations', [S, B, Q, M], True, [PRE, IMP]),
    ('05_Delivery', 'BrokerVerse_Business_Requirements_Document', 'docx, pdf', 'Business requirements by process area with acceptance criteria and the screen that meets each, non-functional requirements and the functional specification by module', [D, S, M], True, [PRE, IMP]),
    ('05_Delivery', 'BrokerVerse_Process_Flow_Document', 'docx, pdf', 'End-to-end process flows with swimlane diagrams, numbered steps, postings, documents and controls', [D, P], True, [IMP, GO, SUP]),
    # ---------------------------------------------------------------- 06_Support
    ('06_Support', 'BrokerVerse_Production_Support_Approach_and_Standards', 'docx, pdf', 'Support model, severities, change and release management, monitoring, and the procedures for integrations, compliance deadlines, keys, brand packs and e-signatures', [P, M], True, [CON, GO, SUP]),
    ('06_Support', 'BrokerVerse_Business_Continuity_and_Disaster_Recovery_Plan', 'docx, pdf', 'Backups, keys, recovery objectives, scenarios, partner outages and DR tests', [P, M], True, [CON, SUP]),
    ('06_Support', 'BrokerVerse_Release_Notes_and_Roadmap', 'docx, pdf', 'What the release delivers, known limitations, versioning policy and indicative roadmap', [S, D, P, M], True, [PRE, GO, SUP]),
    ('06_Support', 'BrokerVerse_Release_Notes_Template', 'docx, pdf', 'Release notes for each patch, minor or major release, with jobs, connectors and keys', [V, P], True, [SUP]),
    # ---------------------------------------------------------------- 07_Technical
    ('07_Technical', 'BrokerVerse_Architecture_Infrastructure_Security_and_Privacy', 'docx, pdf', 'Architecture, hosting options, security controls and data privacy', [V, D, P, M], True, [PRE, CON, IMP]),
    ('07_Technical', 'BrokerVerse_Technical_Reference', 'docx, pdf', 'Code base, modules, security implementation and how to extend', [V, P], True, [IMP, SUP]),
    ('07_Technical', 'BrokerVerse_API_and_Dependency_Catalogue', 'xlsx', 'Every API route with its permission and the screens that call it', [V, P, Q], True, [IMP, SUP]),
    ('07_Technical', 'BrokerVerse_Data_Dictionary', 'docx, pdf, xlsx', 'Tables, columns, relationships, personal data and retention', [V, B, P], True, [IMP, SUP]),
    # ---------------------------------------------------------------- 08_Management
    ('08_Management', 'BrokerVerse_Go_No_Go_and_Management_Register', 'docx, pdf', 'Release recommendation, go-live conditions, risks, plans and decisions needed', [M, D, V, P, S], False, [GO]),
    ('08_Management', 'iNXT_BrokerVerse_OOTB_Strategy_and_Playbook_INTERNAL', 'docx, pdf', 'How iorta TechNXT sells, delivers, supports and evolves the OOTB product', [M, S, D, V, P], False, [PRE, CON, IMP, GO, SUP]),
    ('08_Management', 'BrokerVerse_PH_Fit_and_ASEAN_Rollout_Assessment', 'docx, pdf, xlsx', 'Philippine process fit by area with evidence, gaps ranked, and the change needed for each ASEAN country', [M, S, V], False, [PRE, SUP]),
    ('08_Management', 'BrokerVerse_OOTB_Documentation_Pack_Index', 'docx, pdf', 'This index', [U, V, B, Q, D, S, P, M], True, [PRE, CON, IMP, GO, SUP]),
]

# Documents of packages being merged in parallel: listed now, checked once their files arrive.
PENDING = {
    ('05_Delivery', 'BrokerVerse_Business_Requirements_Document'),
    ('05_Delivery', 'BrokerVerse_Process_Flow_Document'),
    ('05_Delivery', 'BrokerVerse_Dependency_Map_and_Critical_Path'),
}

# Folders of docs/package in lifecycle order: (folder, title, what it holds)
FOLDERS = [
    ('01_Sales', 'Sales', 'Material for prospects and the sales team: brochures, presentation, functionality, demo, FAQ, e-mails, ROI calculator and the competitive battlecard.'),
    ('02_Commercials', 'Commercials', 'Prices and the commercial proposal: the rate card given to the broker, and the internal pricing model, price book, proposal note and negotiation playbook.'),
    ('03_Contracts', 'Contracts', 'The contract pack, from the NDA to the hypercare exit certificate, including the SOW and the UAT and go-live acceptance certificates.'),
    ('04_Onboarding_and_Go_Live', 'Onboarding and go-live', 'What the broker completes or reviews to onboard and go live: security due diligence, discovery and configuration, privacy impact assessment, data migration and cutover, environments and rollout. Brand packs are kept in the sub-folder `Brand_Packs/`.'),
    ('05_Delivery', 'Delivery', 'The implementation project: BRD, process flows, approach and plan, dependency map, project control templates, training, user manual, reports, communications, schedules, test strategy, plan, cases, traceability and results, and the regulatory compliance matrix. The standard upload templates are kept in the sub-folder `Upload_Templates/`.'),
    ('06_Support', 'Support', 'Production support and its operational procedures, business continuity and disaster recovery, and releases.'),
    ('07_Technical', 'Technical', 'Architecture, infrastructure, security and privacy, technical reference, API catalogue and data dictionary.'),
    ('08_Management', 'Management', 'Release recommendation and management register, OOTB strategy, Philippine fit and ASEAN rollout assessment, and this index.'),
]

# Sub-folders listed as one entry when they exist: (folder, sub-folder, purpose, audiences, client-facing, stages)
SUBFOLDERS = [
    ('04_Onboarding_and_Go_Live', 'Brand_Packs', 'Brand packs to import in Theme and Branding; a client pack carrying a third party\'s marks is used only in that client\'s environments, with its written permission', [D, P], False, [IMP, GO]),
    ('05_Delivery', 'Upload_Templates', 'Standard upload templates for the go-live data, one per master or opening balance, and the go-live configuration and migration workbooks', [D, B, U], True, [IMP, GO]),
]

# Guides kept with the code (docs/ outside the pack), listed for their audiences: (path, purpose, audiences)
GUIDES = [
    ('docs/onboarding/GETTING_STARTED.md', 'First sign-in, menus per role, My Work, the Help panel', [U]),
    ('docs/onboarding/SUPPORT_AND_ESCALATION.md', 'How to report an issue, severities, support procedures by area', [U, P]),
    ('docs/onboarding/UAT_SCRIPTS.md', 'UAT scenarios per role for the first week', [U, Q]),
    ('docs/onboarding/GO_LIVE_DATA_SETUP.md', 'Order of set-up from company to opening balances', [U, B, D]),
    ('docs/onboarding/GO_LIVE_DATA_WORKBENCH.md', 'Configuration and migration workbooks, validation, load, reconciliation, environment comparison', [B, D, P]),
    ('docs/onboarding/BRANDING_AND_SIGNATURES.md', 'Theme, brand packs, e-signatures and their support procedures', [U, P]),
    ('docs/onboarding/SMOKE_TEST_AND_RESET.md', 'Smoke test, transaction reset and the go-live lock', [D, P, Q]),
    ('docs/onboarding/DATA_MASKING.md', 'Masking of production copies for test and training', [P, Q]),
    ('docs/developer-guide/README.md', 'Developer and production support guide: back end, front end, tracing a defect', [V, P]),
    ('deploy/README.md, deploy/REFERENCE.md', 'Installation, environment variables and keys, release pipeline, rollback', [V, P]),
    ('backend/docs/api', 'OpenAPI file, Postman collection and API touchpoint workbook', [V, Q]),
]


def files_on_disk():
    seen = set()
    for folder, _, _ in FOLDERS:
        path = os.path.join(PKG, folder)
        if not os.path.isdir(path):
            continue
        for f in os.listdir(path):
            if os.path.isfile(os.path.join(path, f)) and not f.startswith(('.', '~')):
                seen.add((folder, os.path.splitext(f)[0]))
    return seen


def check():
    listed = {(d[0], d[1]) for d in DOCS}
    disk = files_on_disk()
    missing = [f'{a}/{b}' for a, b in sorted(disk - listed)]
    if missing:
        sys.exit('Not in the index (add them to DOCS in build_pack_index.py): ' + ', '.join(missing))
    gone = sorted(listed - disk)
    waiting = [f'{a}/{b}' for a, b in gone if (a, b) in PENDING]
    if waiting:
        print('Warning: listed but not yet on disk (package being merged; run again after the merge): ' + ', '.join(waiting))
    gone = [f'{a}/{b}' for a, b in gone if (a, b) not in PENDING]
    if gone:
        sys.exit('In the index but not on disk: ' + ', '.join(gone))


def entries():
    """DOCS plus the sub-folders that exist."""
    out = list(DOCS)
    for folder, sub, purpose, aud, client, stages in SUBFOLDERS:
        if os.path.isdir(os.path.join(PKG, folder, sub)):
            out.append((folder, sub + '/', 'folder', purpose, aud, client, stages))
    return out


def name(d):
    return d[1].replace('iNXT_BrokerVerse_', '').replace('BrokerVerse_', '').replace('_', ' ').rstrip('/')


def short(d):
    return name(d) + ('' if d[5] else ' (INTERNAL)')


def rows_for(folder):
    return [f"| `{d[1]}`<br>{d[2]} | {d[3]} | {', '.join(d[4])}<br>{'Client-facing' if d[5] else '**INTERNAL**'} | {', '.join(d[6])} |"
            for d in entries() if d[0] == folder]


def by_audience(h2):
    L = []
    for a, who in AUDIENCES:
        docs = [d for d in entries() if a in d[4]]
        L += [f'{h2} {a}', '', who, '', '| Document | Folder | What it is for |', '|---|---|---|']
        L += [f"| {short(d)} | `{d[0]}` | {d[3]} |" for d in docs]
        L += [f"| `{g[0]}` | Code repository | {g[1]} |" for g in GUIDES if a in g[2]]
        L.append('')
    return L


def by_stage():
    lines = ['| Stage | Documents used |', '|---|---|']
    for st in (PRE, CON, IMP, GO, SUP):
        lines.append(f'| {st} | {"; ".join(short(d) for d in entries() if st in d[6])} |')
    return lines


def body(for_readme):
    L = []
    h1, h2 = ('##', '###') if for_readme else ('#', '##')
    L += [f'{h1} How to use this index', '',
          'The BrokerVerse OOTB documentation pack holds every document iorta TechNXT uses to sell, contract, implement, run and support iNXT BrokerVerse OOTB for a Philippine non-life broker. This index lists each document for each department that uses it, with what it is for, then each file by folder and by stage of the customer lifecycle.', '',
          '- **Client-facing** files may be given to the broker, normally from the stage shown.',
          '- **INTERNAL** files are for iorta TechNXT staff only. They hold pricing logic, discount limits, competitor positioning, internal strategy or a third party\'s marks and are never sent to a broker or attached to a proposal. Their file names end in `_INTERNAL` where the document is a sales tool.',
          '- Departments: ' + '; '.join(f'{a} ({who[0].lower() + who[1:-1]})' for a, who in AUDIENCES) + '.',
          '- Lifecycle stages: Pre-sales, Contracting, Implementation, Go-live, Support.', '',
          'The files are kept in `docs/package`, one folder per purpose in the order of the customer lifecycle, and each file is kept once, in its latest version: a superseded document is removed with its source. `source/` holds the text sources and `tools/` the builders.', '',
          '| Folder | What it holds | Count |', '|---|---|---|']
    for folder, title, what in FOLDERS:
        n = sum(1 for d in DOCS if d[0] == folder)
        L.append(f'| `{folder}/` | {what} | {n} |')
    L += ['']
    L += [f'{h1} Index by department', '',
          'Each department starts with the documents below. A document used by several departments is listed under each of them. The guides kept with the code are listed where a department uses them.', '']
    L += by_audience(h2)
    L += [f'{h1} Index by lifecycle stage', ''] + by_stage() + ['']
    L += [f'{h1} File list by folder', '']
    for folder, title, what in FOLDERS:
        L += [f'{h2} {title} ({folder})', '', '| File and formats | Purpose | Departments and distribution | Used in |', '|---|---|---|---|'] + rows_for(folder) + ['']
    L += [f'{h1} INTERNAL documents', '', 'These files never leave iorta TechNXT:', '']
    L += [f'- `{d[0]}/{d[1]}` ({d[2]}): {d[3]}.' for d in entries() if not d[5]] + ['']
    L += [f'{h1} Building the documents', '',
          'Each Word and PDF document is built from its text source in `source/` into the iorta TechNXT template. The table of sources, folders and file names is kept in one place, `tools/build_all.py`:', '',
          '```', 'cd docs/package/tools',
          'python3 build_all.py --list                (which source becomes which file)',
          'python3 build_all.py                       (every document: .docx, contents page and .pdf)',
          'python3 build_all.py user-manual           (one document)',
          'python3 build_all.py --sales --workbooks   (also brochures, presentation, plain-text e-mails and workbooks)', '```', '',
          '`build_all.py` runs `build_doc.py` (text to .docx), the post-processing step where one is needed (`brochure/widths.py` for the Product Functionality document) and `refresh.py` (contents page and PDF with LibreOffice, on a private profile and port). The workbooks have their own builders: `build_pricing.py`, `build_price_book.py`, `build_roi.py`, `build_questionnaire_xlsx.py`, `build_discovery_workbook.py`, `build_plan_xlsx.py`, `build_project_templates_xlsx.py` (Fit-Gap Register and RAID Log), `build_touchpoints_xlsx.py`, `build_api_catalogue.py`, `build_fit_assessment_xlsx.py` (Philippine fit and ASEAN rollout assessment) and `data-dictionary/`. The plain-text prospect e-mails come from `build_prospect_emails_txt.py`. The Test Cases and Reports Book workbooks are maintained directly. Writing rules: `tools/WRITING_RULES.md`. This index is generated by `build_pack_index.py`.', '']
    return L


def main():
    check()
    front = ['---', 'title: Documentation Pack Index', 'subtitle: iNXT BrokerVerse OOTB documents by department, folder and lifecycle stage',
             'version: 1.2', 'date: 04 October 2026', 'prepared: iorta TechNXT', 'reviewed:', 'approved:',
             'change: Index by department (users, developers, business analysts, QA, delivery and PM, sales, support, management) with what each document is for; BRD, process flows, test strategy and plan, traceability matrix and dependency map added; brand packs and the guides kept with the code listed',
             'acronyms: OOTB=Out of the box; BRD=Business requirements document; PFD=Process flow document; PM=Project manager; QA=Quality assurance; DPO=Data protection officer; NDA=Non-disclosure agreement; PIA=Privacy impact assessment; RAID=Risks, assumptions, issues and dependencies; RACI=Responsible, Accountable, Consulted, Informed; ROI=Return on investment; SLA=Service level agreement; SOW=Statement of work; UAT=User acceptance test; DR=Disaster recovery; SaaS=Software as a service; AMLA=Anti-Money Laundering Act; CTPL=Compulsory third party liability; DPA=Data Privacy Act',
             '---', '']
    open(os.path.join(PKG, 'source', 'documentation-pack-index.md'), 'w').write('\n'.join(front + body(False)))
    readme = ['# iNXT BrokerVerse OOTB documentation pack', ''] + body(True)
    open(os.path.join(PKG, 'README.md'), 'w').write('\n'.join(readme))
    print(len(entries()), 'entries written')


if __name__ == '__main__':
    main()
