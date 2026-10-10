"""Rebuilds the product documents kept in docs/package into their folders. The table DOCUMENTS below is the one place that
says which text source becomes which file in which folder.

    cd docs/package/tools
    python3 build_all.py                    every Word document and its PDF (about 15 minutes, LibreOffice)
    python3 build_all.py user-manual        only the sources named (file name without .md, or contracts/<name>)
    python3 build_all.py --list             print the table and stop
    python3 build_all.py --workbooks        also the Excel workbooks that have a builder (see WORKBOOKS)
    python3 build_all.py --workbooks --no-docs  only the workbooks, no Word documents

Steps for each document: build_doc.py (source to .docx in the iorta TechNXT template), the post-processing step
when one is listed, then refresh.py (contents page and PDF).

The workbooks need more than this script provides: the touchpoints workbook needs a database built with the
migrations and seeds (DATABASE_URL), and the data dictionary its own pipeline in data-dictionary/. The reports book
workbook has no builder. Generic product documents retired from this repository are listed in
docs/archive/2026-10-10/README.md and in the TISPH Document Register (docs/TISPH/README.md).
"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PKG = os.path.dirname(HERE)
SRC = os.path.join(PKG, 'source')

CONTRACTS = '03_Contracts'
ONBOARDING, DELIVERY, SUPPORT = '04_Onboarding_and_Go_Live', '05_Delivery', '06_Support'

# (source under source/, folder, output file name without extension, post-processing script or None)
DOCUMENTS = [
    # 03 Contracts
    ('contracts/amc-sla.md', CONTRACTS, 'iNXT_BrokerVerse_Annual_Maintenance_Support_and_SLA', None),
    ('contracts/customer-responsibilities-raci.md', CONTRACTS, 'iNXT_BrokerVerse_Customer_Responsibilities_and_RACI_Annex', None),
    ('contracts/change-request-procedure.md', CONTRACTS, 'iNXT_BrokerVerse_Change_Request_Procedure_and_Form', None),
    ('contracts/source-code-escrow.md', CONTRACTS, 'iNXT_BrokerVerse_Source_Code_Escrow_Agreement', None),
    ('contracts/exit-transition-plan.md', CONTRACTS, 'iNXT_BrokerVerse_Exit_and_Transition_Plan', None),
    ('contracts/hypercare-exit-handover.md', CONTRACTS, 'iNXT_BrokerVerse_Hypercare_Exit_and_Handover_Certificate', None),
    # 04 Onboarding and go-live
    ('privacy-impact-assessment-templates.md', ONBOARDING, 'BrokerVerse_Privacy_Impact_Assessment_and_Records_of_Processing_Templates', None),
    ('security-due-diligence-questionnaire.md', ONBOARDING, 'BrokerVerse_Security_Due_Diligence_Questionnaire', None),
    # 05 Delivery
    ('project-status-report-template.md', DELIVERY, 'BrokerVerse_Project_Status_Report_Template', None),
    ('training-and-change-management.md', DELIVERY, 'BrokerVerse_Training_Plan', None),
    ('user-manual.md', DELIVERY, 'BrokerVerse_User_Manual', None),
    ('reports-book.md', DELIVERY, 'BrokerVerse_Reports_Book', None),
    ('communication-templates.md', DELIVERY, 'BrokerVerse_Communication_Templates_and_Touchpoints', None),
    ('schedules-and-batch-jobs.md', DELIVERY, 'BrokerVerse_Schedules_and_Batch_Jobs', None),
    ('ph-regulatory-compliance-matrix.md', DELIVERY, 'BrokerVerse_Philippine_Regulatory_Compliance_Matrix', None),
    ('process-flows.md', DELIVERY, 'BrokerVerse_Process_Flow_Document', 'brd_pfd_widths.py'),
    # 06 Support
    ('production-support.md', SUPPORT, 'BrokerVerse_Production_Support_Approach_and_Standards', None),
    ('business-continuity-and-disaster-recovery.md', SUPPORT, 'BrokerVerse_Business_Continuity_and_Disaster_Recovery_Plan', None),
    ('release-notes-template.md', SUPPORT, 'BrokerVerse_Release_Notes_Template', None),
]

# Workbooks with a builder, in dependency order, run with --workbooks.
WORKBOOKS = [
    ['python3', 'build_questionnaire_xlsx.py', os.path.join(SRC, 'security-due-diligence-questionnaire.md'),
     os.path.join(PKG, ONBOARDING, 'BrokerVerse_Security_Due_Diligence_Questionnaire.xlsx')],
    ['python3', 'build_project_templates_xlsx.py', os.path.join(PKG, DELIVERY)],   # RAID Log (and the Fit-Gap Register, archived: delete it after a run)
    ['python3', 'build_touchpoints_xlsx.py', os.path.join(PKG, DELIVERY, 'BrokerVerse_Communication_Touchpoints.xlsx')],
]


def run(cmd):
    print('+', ' '.join(os.path.relpath(c, HERE) if os.path.isabs(c) else c for c in cmd), flush=True)
    subprocess.run(cmd, cwd=HERE, check=True)


# Sources kept without a Word document: the data dictionary text is maintained by data-dictionary/fill.py and its
# workbook (07_Technical/BrokerVerse_Data_Dictionary.xlsx) is the reference; its .docx and .pdf were retired.
NOT_BUILT = {'data-dictionary.md'}


def check_table():
    sources = {os.path.relpath(os.path.join(d, f), SRC) for d, _, fs in os.walk(SRC) for f in fs if f.endswith('.md')}
    sources -= NOT_BUILT
    listed = {d[0] for d in DOCUMENTS}
    if sources - listed:
        sys.exit('Source not in DOCUMENTS: ' + ', '.join(sorted(sources - listed)))
    if listed - sources:
        sys.exit('DOCUMENTS names a missing source: ' + ', '.join(sorted(listed - sources)))


def main(args):
    check_table()
    flags = {a for a in args if a.startswith('--')}
    names = [a[:-3] if a.endswith('.md') else a for a in args if not a.startswith('--')]
    if '--list' in flags:
        for src, folder, name, post in DOCUMENTS:
            print(f'{src:50} {folder}/{name}.docx, .pdf' + (f'   (then {post})' if post else ''))
        return
    docs = [] if '--no-docs' in flags else [d for d in DOCUMENTS if not names or d[0][:-3] in names]
    if names and len(docs) != len(names):
        sys.exit('Unknown source in: ' + ', '.join(names))
    if '--workbooks' in flags:
        for cmd in WORKBOOKS:
            run(cmd)
    built = []
    for src, folder, name, post in docs:
        out = os.path.join(PKG, folder, name + '.docx')
        os.makedirs(os.path.dirname(out), exist_ok=True)
        run(['python3', 'build_doc.py', os.path.join(SRC, src), out])
        if post:
            run(['python3', post, out])
        built.append(out)
    if built:
        run(['python3', 'refresh.py'] + built)


if __name__ == '__main__':
    main(sys.argv[1:])
