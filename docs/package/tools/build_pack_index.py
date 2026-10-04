"""Writes the documentation pack index in two forms from one list, so they never differ:

    python3 build_pack_index.py

  ../README.md                                  (markdown for the repository)
  ../source/documentation-pack-index.md         (source of 08_Management/BrokerVerse_OOTB_Documentation_Pack_Index)

Then build the document (build_all.py runs this script first):
    python3 build_all.py documentation-pack-index

Every file in the folders 01_Sales to 08_Management must appear in DOCS and every DOCS entry must exist; the script
stops with the names of the files concerned. Sub-folders in SUBFOLDERS are listed as one entry when they exist.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PKG = os.path.dirname(HERE)

# audience codes
S, D, V, P, M = 'Sales', 'Delivery', 'Development', 'Support', 'Management'
# lifecycle codes
PRE, CON, IMP, GO, SUP = 'Pre-sales', 'Contracting', 'Implementation', 'Go-live', 'Support'

# (folder, base name, formats, purpose, audiences, client-facing (True) or INTERNAL (False), lifecycle stages)
DOCS = [
    # ---------------------------------------------------------------- 01_Sales
    ('01_Sales', 'iNXT_BrokerVerse_Brochure', 'docx, pdf', 'Two-page product brochure', [S], True, [PRE]),
    ('01_Sales', 'iNXT_BrokerVerse_One_Page_Brochure', 'docx, pdf, png', 'One-page summary for a first e-mail or a trade event', [S], True, [PRE]),
    ('01_Sales', 'iNXT_BrokerVerse_Client_Presentation', 'pptx, pdf', 'Client presentation deck for the first meeting', [S], True, [PRE]),
    ('01_Sales', 'iNXT_BrokerVerse_Product_Functionality', 'docx, pdf', 'What the product does, module by module, with the vendor comparison checklist', [S, D], True, [PRE]),
    ('01_Sales', 'iNXT_BrokerVerse_Demo_Script', 'docx, pdf', 'Scripted product demonstration with personas, data and timings', [S], True, [PRE]),
    ('01_Sales', 'iNXT_BrokerVerse_FAQ_and_Objection_Handling', 'docx, pdf', 'Answers to common questions and objections; known limits to disclose', [S], True, [PRE]),
    ('01_Sales', 'iNXT_BrokerVerse_Prospect_Email_Templates', 'docx, pdf', 'E-mails from first contact to the welcome after signing', [S], True, [PRE, CON]),
    ('01_Sales', 'Prospect_Email_Templates', 'txt', 'Plain-text copy of the prospect e-mails for pasting into a mail client', [S], True, [PRE, CON]),
    ('01_Sales', 'iNXT_BrokerVerse_ROI_Calculator', 'xlsx', 'Return on investment calculator filled in with the broker', [S], True, [PRE]),
    ('01_Sales', 'iNXT_BrokerVerse_Competitive_Battlecard_INTERNAL', 'docx, pdf', 'Competitor positioning and proof points', [S], False, [PRE]),
    # ---------------------------------------------------------------- 02_Commercials
    ('02_Commercials', 'iNXT_BrokerVerse_Commercial_Proposal_Rate_Card', 'docx, pdf', 'Rate card and commercial proposal given to the broker', [S, M], True, [PRE, CON]),
    ('02_Commercials', 'BrokerVerse_Commercials_and_Pricing', 'xlsx', 'Formula-driven pricing model behind the rate card', [M, S], False, [PRE, CON]),
    ('02_Commercials', 'iNXT_BrokerVerse_Price_Book', 'xlsx', 'Price book with quick quote, packages and negotiation limits', [S, M], False, [PRE, CON]),
    ('02_Commercials', 'BrokerVerse_Commercial_Proposal_Note', 'docx, pdf', 'Pricing rationale, market positioning and commercial assumptions', [M, S], False, [PRE, CON]),
    ('02_Commercials', 'iNXT_BrokerVerse_Negotiation_Playbook_INTERNAL', 'docx, pdf', 'Discount limits, trade-offs and approval rules in negotiation', [S, M], False, [CON]),
    # ---------------------------------------------------------------- 03_Contracts
    ('03_Contracts', 'iNXT_BrokerVerse_Contract_Pack_Index_and_Cover_Letter', 'docx, pdf', 'Index of the contract pack and cover letter to the broker', [S, M], True, [CON]),
    ('03_Contracts', 'iNXT_BrokerVerse_Mutual_Non_Disclosure_Agreement', 'docx, pdf', 'Mutual NDA before detailed discussions', [S, M], True, [PRE]),
    ('03_Contracts', 'iNXT_BrokerVerse_Letter_of_Award_and_Proposal_Acceptance', 'docx, pdf', 'Broker letter of award and acceptance of the proposal', [S, M], True, [CON]),
    ('03_Contracts', 'iNXT_BrokerVerse_Master_Services_Agreement', 'docx, pdf', 'Master Services Agreement', [M], True, [CON]),
    ('03_Contracts', 'iNXT_BrokerVerse_Order_Form', 'docx, pdf', 'Order Form: size, model, prices, hosting and dates', [S, M], True, [CON]),
    ('03_Contracts', 'iNXT_BrokerVerse_Perpetual_Software_Licence_Agreement', 'docx, pdf', 'Licence schedule for the perpetual model', [M], True, [CON]),
    ('03_Contracts', 'iNXT_BrokerVerse_Software_Subscription_Agreement', 'docx, pdf', 'Subscription schedule for the SaaS model', [M], True, [CON]),
    ('03_Contracts', 'iNXT_BrokerVerse_Implementation_Statement_of_Work', 'docx, pdf', 'Implementation scope, milestones, acceptance and governance', [D, M], True, [CON, IMP]),
    ('03_Contracts', 'iNXT_BrokerVerse_Annual_Maintenance_Support_and_SLA', 'docx, pdf', 'Annual maintenance, support and service levels', [P, M], True, [CON, SUP]),
    ('03_Contracts', 'iNXT_BrokerVerse_Hosting_and_Infrastructure_Services_Agreement', 'docx, pdf', 'Hosting services, data location, backups and recovery objectives', [P, M], True, [CON, SUP]),
    ('03_Contracts', 'iNXT_BrokerVerse_Data_Processing_Agreement', 'docx, pdf', 'Data processing agreement under the Data Privacy Act', [M, P], True, [CON]),
    ('03_Contracts', 'iNXT_BrokerVerse_Service_Catalogue_and_Rate_Annex', 'docx, pdf', 'Optional services and day rates', [S, M], True, [CON, SUP]),
    ('03_Contracts', 'iNXT_BrokerVerse_Customer_Responsibilities_and_RACI_Annex', 'docx, pdf', 'What the broker provides and who does what', [D, M], True, [CON, IMP]),
    ('03_Contracts', 'iNXT_BrokerVerse_Change_Request_Procedure_and_Form', 'docx, pdf', 'Change request procedure and form', [D, M], True, [CON, IMP, SUP]),
    ('03_Contracts', 'iNXT_BrokerVerse_Source_Code_Escrow_Agreement', 'docx, pdf', 'Optional source code escrow with the perpetual licence', [M], True, [CON]),
    ('03_Contracts', 'iNXT_BrokerVerse_Exit_and_Transition_Plan', 'docx, pdf', 'Data return and transition at the end of the contract', [M, P], True, [CON, SUP]),
    ('03_Contracts', 'iNXT_BrokerVerse_UAT_and_Go_Live_Acceptance_Certificates', 'docx, pdf', 'UAT and go-live acceptance certificates', [D, M], True, [GO]),
    ('03_Contracts', 'iNXT_BrokerVerse_Hypercare_Exit_and_Handover_Certificate', 'docx, pdf', 'Hypercare exit and handover to support', [D, P, M], True, [GO, SUP]),
    # ---------------------------------------------------------------- 04_Onboarding_and_Go_Live
    ('04_Onboarding_and_Go_Live', 'BrokerVerse_Security_Due_Diligence_Questionnaire', 'docx, pdf, xlsx', 'Pre-answered security and outsourcing due diligence questionnaire', [S, D, M], True, [PRE, CON]),
    ('04_Onboarding_and_Go_Live', 'BrokerVerse_Discovery_Workbook_Guide', 'docx, pdf', 'How to run the discovery and configuration workshops', [D], True, [IMP]),
    ('04_Onboarding_and_Go_Live', 'BrokerVerse_Discovery_and_Configuration_Workbook', 'xlsx', 'Configuration decisions captured in discovery', [D], True, [IMP]),
    ('04_Onboarding_and_Go_Live', 'BrokerVerse_Data_Migration_and_Cutover_Plan', 'docx, pdf', 'Go-live data, templates, mock loads, reconciliation and cutover', [D], True, [IMP, GO]),
    ('04_Onboarding_and_Go_Live', 'BrokerVerse_Environment_Strategy_and_Production_Rollout', 'docx, pdf', 'Environments, promotion of code, scripts and configuration, cutover runbook and RACI', [D, V, P, M], True, [IMP, GO]),
    ('04_Onboarding_and_Go_Live', 'BrokerVerse_Privacy_Impact_Assessment_and_Records_of_Processing_Templates', 'docx, pdf', 'PIA and records of processing pre-filled for the broker DPO', [D, M], True, [IMP, GO]),
    # ---------------------------------------------------------------- 05_Delivery
    ('05_Delivery', 'BrokerVerse_Implementation_Approach_and_Plan', 'docx, pdf', 'Method, phases, plans by size, roles, governance and risks', [D, M], True, [PRE, IMP]),
    ('05_Delivery', 'BrokerVerse_Implementation_Plan', 'xlsx', 'Gantt plans for the three sizes and the RACI matrix', [D], True, [IMP]),
    ('05_Delivery', 'BrokerVerse_Fit_Gap_Register', 'xlsx', 'Register of requirements classed Fit, Configure, Procedure or Gap', [D, M], True, [IMP]),
    ('05_Delivery', 'BrokerVerse_RAID_Log_Template', 'xlsx', 'Risks, assumptions, issues and dependencies with scoring and summary', [D, M], True, [IMP, GO]),
    ('05_Delivery', 'BrokerVerse_Project_Status_Report_Template', 'docx, pdf', 'Weekly or fortnightly status and steering committee report', [D, M], True, [IMP, GO]),
    ('05_Delivery', 'BrokerVerse_Training_Plan', 'docx, pdf', 'Training and change management by role', [D], True, [IMP]),
    ('05_Delivery', 'BrokerVerse_User_Manual', 'docx, pdf', 'User manual for the seven roles', [D, P], True, [IMP, GO, SUP]),
    ('05_Delivery', 'BrokerVerse_Reports_Book', 'docx, pdf, xlsx', 'Every report, dashboard and export with its columns and rules', [D, P], True, [IMP, SUP]),
    ('05_Delivery', 'BrokerVerse_Communication_Templates_and_Touchpoints', 'docx, pdf', 'Every e-mail, notification and printed document the system sends', [D, P], True, [IMP, SUP]),
    ('05_Delivery', 'BrokerVerse_Communication_Touchpoints', 'xlsx', 'Companion workbook of the communication templates', [D, P], True, [IMP, SUP]),
    ('05_Delivery', 'BrokerVerse_Schedules_and_Batch_Jobs', 'docx, pdf', 'Scheduled jobs, batch processes and the operational run book', [D, P], True, [IMP, GO, SUP]),
    ('05_Delivery', 'BrokerVerse_Test_Cases', 'xlsx', 'Release test cases, traceability and defects', [D, V], True, [IMP, GO]),
    ('05_Delivery', 'BrokerVerse_Test_Summary_Report', 'docx, pdf', 'Results of the release test', [D, V, M], True, [PRE, GO]),
    ('05_Delivery', 'BrokerVerse_Philippine_Regulatory_Compliance_Matrix', 'docx, pdf', 'How the product supports IC, BIR, premium tax, CTPL, DPA and AMLA obligations', [S, D, M], True, [PRE, IMP]),
    # ---------------------------------------------------------------- 06_Support
    ('06_Support', 'BrokerVerse_Production_Support_Approach_and_Standards', 'docx, pdf', 'Support model, severities, change and release management, monitoring', [P, M], True, [CON, GO, SUP]),
    ('06_Support', 'BrokerVerse_Business_Continuity_and_Disaster_Recovery_Plan', 'docx, pdf', 'Backups, recovery objectives, scenarios and DR tests', [P, M], True, [CON, SUP]),
    ('06_Support', 'BrokerVerse_Release_Notes_and_Roadmap', 'docx, pdf', 'What release 1.0 delivers, known limitations, versioning policy and indicative roadmap', [S, D, P, M], True, [PRE, GO, SUP]),
    ('06_Support', 'BrokerVerse_Release_Notes_Template', 'docx, pdf', 'Release notes for each patch, minor or major release', [V, P], True, [SUP]),
    # ---------------------------------------------------------------- 07_Technical
    ('07_Technical', 'BrokerVerse_Architecture_Infrastructure_Security_and_Privacy', 'docx, pdf', 'Architecture, hosting options, security controls and data privacy', [D, V, P, M], True, [PRE, CON, IMP]),
    ('07_Technical', 'BrokerVerse_Technical_Reference', 'docx, pdf', 'Code base, modules, security implementation and how to extend', [V, P], True, [IMP, SUP]),
    ('07_Technical', 'BrokerVerse_API_and_Dependency_Catalogue', 'xlsx', 'Every API route with its permission and the screens that call it', [V, P], True, [IMP, SUP]),
    ('07_Technical', 'BrokerVerse_Data_Dictionary', 'docx, pdf, xlsx', 'Tables, columns, relationships, personal data and retention', [D, V, P], True, [IMP, SUP]),
    # ---------------------------------------------------------------- 08_Management
    ('08_Management', 'BrokerVerse_Go_No_Go_and_Management_Register', 'docx, pdf', 'Release recommendation, go-live conditions, risks, plans and decisions needed', [M, D, V, P, S], False, [GO]),
    ('08_Management', 'iNXT_BrokerVerse_OOTB_Strategy_and_Playbook_INTERNAL', 'docx, pdf', 'How iorta TechNXT sells, delivers, supports and evolves the OOTB product', [M, S, D, V, P], False, [PRE, CON, IMP, GO, SUP]),
    ('08_Management', 'BrokerVerse_OOTB_Documentation_Pack_Index', 'docx, pdf', 'This index', [S, D, V, P, M], True, [PRE, CON, IMP, GO, SUP]),
]

# Folders of docs/package in lifecycle order: (folder, title, what it holds)
FOLDERS = [
    ('01_Sales', 'Sales', 'Material for prospects and the sales team: brochures, presentation, functionality, demo, FAQ, e-mails, ROI calculator and the competitive battlecard.'),
    ('02_Commercials', 'Commercials', 'Prices and the commercial proposal: the rate card given to the broker, and the internal pricing model, price book, proposal note and negotiation playbook.'),
    ('03_Contracts', 'Contracts', 'The contract pack, from the NDA to the hypercare exit certificate, including the UAT and go-live acceptance certificates.'),
    ('04_Onboarding_and_Go_Live', 'Onboarding and go-live', 'What the broker completes or reviews to onboard and go live: security due diligence, discovery and configuration, privacy impact assessment, data migration and cutover, and the go-live data workbooks.'),
    ('05_Delivery', 'Delivery', 'The implementation project: approach and plan, project control templates, training, user manual, reports, communications, schedules, tests and the regulatory compliance matrix. The standard upload templates are kept in the sub-folder `Upload_Templates/`.'),
    ('06_Support', 'Support', 'Production support, business continuity and disaster recovery, and releases.'),
    ('07_Technical', 'Technical', 'Architecture, infrastructure, security and privacy, technical reference, API catalogue and data dictionary.'),
    ('08_Management', 'Management', 'Release recommendation and management register, OOTB strategy and this index.'),
]

# Sub-folders listed as one entry when they exist: (folder, sub-folder, purpose, audiences, client-facing, stages)
SUBFOLDERS = [
    ('05_Delivery', 'Upload_Templates', 'Standard upload templates for the go-live data, one per master or opening balance', [D], True, [IMP, GO]),
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
    gone = [f'{a}/{b}' for a, b in sorted(listed - disk)]
    if gone:
        sys.exit('In the index but not on disk: ' + ', '.join(gone))


def entries():
    """DOCS plus the sub-folders that exist."""
    out = list(DOCS)
    for folder, sub, purpose, aud, client, stages in SUBFOLDERS:
        if os.path.isdir(os.path.join(PKG, folder, sub)):
            out.append((folder, sub + '/', 'folder', purpose, aud, client, stages))
    return out


def rows_for(folder):
    return [f"| `{d[1]}`<br>{d[2]} | {d[3]} | {', '.join(d[4])}<br>{'Client-facing' if d[5] else '**INTERNAL**'} | {', '.join(d[6])} |"
            for d in entries() if d[0] == folder]


def short(d):
    return d[1].replace('iNXT_BrokerVerse_', '').replace('BrokerVerse_', '').replace('_', ' ').rstrip('/') + ('' if d[5] else ' (INTERNAL)')


def by_audience():
    lines = ['| Audience | Start with |', '|---|---|']
    for a, first in ((S, 'Product Functionality, Demo Script, FAQ and Objection Handling, Rate Card, Battlecard (INTERNAL), Negotiation Playbook (INTERNAL)'),
                     (D, 'Implementation Approach and Plan, Discovery Workbook Guide, Fit-Gap Register, RAID Log, Data Migration and Cutover Plan, User Manual'),
                     (V, 'Technical Reference, API and Dependency Catalogue, Data Dictionary, Release Notes Template'),
                     (P, 'Production Support Approach and Standards, Schedules and Batch Jobs, Business Continuity and Disaster Recovery Plan, Communication Templates'),
                     (M, 'Go/No-Go and Management Register (INTERNAL), OOTB Strategy and Playbook (INTERNAL), Commercial Proposal Note (INTERNAL), Release Notes and Roadmap')):
        n = sum(1 for d in entries() if a in d[4])
        lines.append(f'| {a} ({n} entries) | {first} |')
    return lines


def by_stage():
    lines = ['| Stage | Documents used |', '|---|---|']
    for st in (PRE, CON, IMP, GO, SUP):
        lines.append(f'| {st} | {"; ".join(short(d) for d in entries() if st in d[6])} |')
    return lines


def body(for_readme):
    L = []
    h1, h2 = ('##', '###') if for_readme else ('#', '##')
    L += [f'{h1} How to use this index', '',
          'The BrokerVerse OOTB documentation pack holds every document iorta TechNXT uses to sell, contract, implement, run and support iNXT BrokerVerse OOTB for a Philippine non-life broker. This index lists each file by folder, with its purpose, its audience and the stage of the customer lifecycle in which it is used.', '',
          '- **Client-facing** files may be given to the broker, normally from the stage shown.',
          '- **INTERNAL** files are for iorta TechNXT staff only. They hold pricing logic, discount limits, competitor positioning or internal strategy and are never sent to a broker or attached to a proposal. Their file names end in `_INTERNAL` where the document is a sales tool.',
          '- Audiences: Sales (account managers and presales), Delivery (implementation project managers and consultants), Development (product engineering), Support (L2 and L3 application support), Management (iorta TechNXT management, and the broker\'s management for client-facing files).',
          '- Lifecycle stages: Pre-sales, Contracting, Implementation, Go-live, Support.', '',
          'The files are kept in `docs/package`, one folder per purpose in the order of the customer lifecycle, and each file is kept once. `source/` holds the text sources and `tools/` the builders.', '',
          '| Folder | What it holds | Count |', '|---|---|---|']
    for folder, title, what in FOLDERS:
        n = sum(1 for d in DOCS if d[0] == folder)
        L.append(f'| `{folder}/` | {what} | {n} |')
    L += ['']
    L += [f'{h1} Index by audience', ''] + by_audience() + ['']
    L += [f'{h1} Index by lifecycle stage', ''] + by_stage() + ['']
    L += [f'{h1} File list by folder', '']
    for folder, title, what in FOLDERS:
        L += [f'{h2} {title} ({folder})', '', '| File and formats | Purpose | Audience and distribution | Used in |', '|---|---|---|---|'] + rows_for(folder) + ['']
    L += [f'{h1} INTERNAL documents', '', 'These files never leave iorta TechNXT:', '']
    L += [f'- `{d[0]}/{d[1]}` ({d[2]}): {d[3]}.' for d in entries() if not d[5]] + ['']
    L += [f'{h1} Building the documents', '',
          'Each Word and PDF document is built from its text source in `source/` into the iorta TechNXT template. The table of sources, folders and file names is kept in one place, `tools/build_all.py`:', '',
          '```', 'cd docs/package/tools',
          'python3 build_all.py --list                (which source becomes which file)',
          'python3 build_all.py                       (every document: .docx, contents page and .pdf)',
          'python3 build_all.py user-manual           (one document)',
          'python3 build_all.py --sales --workbooks   (also brochures, presentation and workbooks)', '```', '',
          '`build_all.py` runs `build_doc.py` (text to .docx), the post-processing step where one is needed (`brochure/widths.py` for the Product Functionality document) and `refresh.py` (contents page and PDF with LibreOffice). The workbooks have their own builders: `build_pricing.py`, `build_price_book.py`, `build_roi.py`, `build_questionnaire_xlsx.py`, `build_discovery_workbook.py`, `build_plan_xlsx.py`, `build_project_templates_xlsx.py` (Fit-Gap Register and RAID Log), `build_touchpoints_xlsx.py`, `build_api_catalogue.py` and `data-dictionary/`. The Test Cases and Reports Book workbooks are maintained directly. Writing rules: `tools/WRITING_RULES.md`. This index is generated by `build_pack_index.py`.', '']
    return L


def main():
    check()
    front = ['---', 'title: Documentation Pack Index', 'subtitle: iNXT BrokerVerse OOTB documents by folder, audience and lifecycle stage',
             'version: 1.1', 'date: 04 October 2026', 'prepared: iorta TechNXT', 'reviewed:', 'approved:',
             'acronyms: OOTB=Out of the box; DPO=Data protection officer; NDA=Non-disclosure agreement; PIA=Privacy impact assessment; RAID=Risks, assumptions, issues and dependencies; RACI=Responsible, Accountable, Consulted, Informed; ROI=Return on investment; SLA=Service level agreement; UAT=User acceptance test; DR=Disaster recovery; SaaS=Software as a service',
             '---', '']
    open(os.path.join(PKG, 'source', 'documentation-pack-index.md'), 'w').write('\n'.join(front + body(False)))
    readme = ['# iNXT BrokerVerse OOTB documentation pack', ''] + body(True)
    open(os.path.join(PKG, 'README.md'), 'w').write('\n'.join(readme))
    print(len(entries()), 'entries written')


if __name__ == '__main__':
    main()
