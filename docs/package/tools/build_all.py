"""Rebuilds the BrokerVerse OOTB documentation pack into its folders. The table DOCUMENTS below is the one place that
says which text source becomes which file in which folder.

    cd docs/package/tools
    python3 build_all.py                    every Word document and its PDF (about 15 minutes, LibreOffice)
    python3 build_all.py user-manual        only the sources named (file name without .md, or contracts/<name>)
    python3 build_all.py --list             print the table and stop
    python3 build_all.py --sales            also the brochure, the one-page brochure and the client presentation
    python3 build_all.py --workbooks        also the Excel workbooks that have a builder (see WORKBOOKS)
    python3 build_all.py --sales --no-docs  only the extra builds asked for, no Word documents

Steps for each document: build_doc.py (source to .docx in the iorta TechNXT template), the post-processing step
when one is listed, then refresh.py (contents page and PDF). The pack index source and README.md are regenerated
by build_pack_index.py first, which stops when a file in a folder is missing from its list.

The workbooks need more than this script provides: the API catalogue needs node and the installed backend and
front-end packages, the touchpoints workbook a database built with the migrations and seeds (DATABASE_URL), and the
data dictionary its own pipeline in data-dictionary/. The test cases and the reports book workbooks have no builder.
"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PKG = os.path.dirname(HERE)
SRC = os.path.join(PKG, 'source')

SALES, COMMERCIALS, CONTRACTS = '01_Sales', '02_Commercials', '03_Contracts'
ONBOARDING, DELIVERY, SUPPORT = '04_Onboarding_and_Go_Live', '05_Delivery', '06_Support'
TECHNICAL, MANAGEMENT = '07_Technical', '08_Management'

# (source under source/, folder, output file name without extension, post-processing script or None)
DOCUMENTS = [
    # 01 Sales
    ('product-functionality.md', SALES, 'iNXT_BrokerVerse_Product_Functionality', 'brochure/widths.py'),
    ('demo-script.md', SALES, 'iNXT_BrokerVerse_Demo_Script', None),
    ('sales-faq.md', SALES, 'iNXT_BrokerVerse_FAQ_and_Objection_Handling', None),
    ('prospect-emails.md', SALES, 'iNXT_BrokerVerse_Prospect_Email_Templates', None),
    ('competitive-battlecard.md', SALES, 'iNXT_BrokerVerse_Competitive_Battlecard_INTERNAL', None),
    # 02 Commercials
    ('price-book.md', COMMERCIALS, 'iNXT_BrokerVerse_Commercial_Proposal_Rate_Card', None),
    ('commercials-note.md', COMMERCIALS, 'BrokerVerse_Commercial_Proposal_Note', None),
    ('negotiation-playbook.md', COMMERCIALS, 'iNXT_BrokerVerse_Negotiation_Playbook_INTERNAL', None),
    # 03 Contracts
    ('contracts/contract-pack-index.md', CONTRACTS, 'iNXT_BrokerVerse_Contract_Pack_Index_and_Cover_Letter', None),
    ('contracts/mutual-nda.md', CONTRACTS, 'iNXT_BrokerVerse_Mutual_Non_Disclosure_Agreement', None),
    ('contracts/letter-of-award.md', CONTRACTS, 'iNXT_BrokerVerse_Letter_of_Award_and_Proposal_Acceptance', None),
    ('contracts/master-services-agreement.md', CONTRACTS, 'iNXT_BrokerVerse_Master_Services_Agreement', None),
    ('contracts/order-form.md', CONTRACTS, 'iNXT_BrokerVerse_Order_Form', None),
    ('contracts/perpetual-licence-agreement.md', CONTRACTS, 'iNXT_BrokerVerse_Perpetual_Software_Licence_Agreement', None),
    ('contracts/subscription-agreement.md', CONTRACTS, 'iNXT_BrokerVerse_Software_Subscription_Agreement', None),
    ('contracts/implementation-sow.md', CONTRACTS, 'iNXT_BrokerVerse_Implementation_Statement_of_Work', None),
    ('contracts/amc-sla.md', CONTRACTS, 'iNXT_BrokerVerse_Annual_Maintenance_Support_and_SLA', None),
    ('contracts/hosting-agreement.md', CONTRACTS, 'iNXT_BrokerVerse_Hosting_and_Infrastructure_Services_Agreement', None),
    ('contracts/data-processing-agreement.md', CONTRACTS, 'iNXT_BrokerVerse_Data_Processing_Agreement', None),
    ('contracts/service-catalogue-rates.md', CONTRACTS, 'iNXT_BrokerVerse_Service_Catalogue_and_Rate_Annex', None),
    ('contracts/customer-responsibilities-raci.md', CONTRACTS, 'iNXT_BrokerVerse_Customer_Responsibilities_and_RACI_Annex', None),
    ('contracts/change-request-procedure.md', CONTRACTS, 'iNXT_BrokerVerse_Change_Request_Procedure_and_Form', None),
    ('contracts/source-code-escrow.md', CONTRACTS, 'iNXT_BrokerVerse_Source_Code_Escrow_Agreement', None),
    ('contracts/exit-transition-plan.md', CONTRACTS, 'iNXT_BrokerVerse_Exit_and_Transition_Plan', None),
    ('contracts/uat-golive-acceptance.md', CONTRACTS, 'iNXT_BrokerVerse_UAT_and_Go_Live_Acceptance_Certificates', None),
    ('contracts/hypercare-exit-handover.md', CONTRACTS, 'iNXT_BrokerVerse_Hypercare_Exit_and_Handover_Certificate', None),
    # 04 Onboarding and go-live
    ('discovery-workbook-guide.md', ONBOARDING, 'BrokerVerse_Discovery_Workbook_Guide', None),
    ('data-migration-and-cutover.md', ONBOARDING, 'BrokerVerse_Data_Migration_and_Cutover_Plan', None),
    ('environment-strategy-and-production-rollout.md', ONBOARDING, 'BrokerVerse_Environment_Strategy_and_Production_Rollout', None),
    ('privacy-impact-assessment-templates.md', ONBOARDING, 'BrokerVerse_Privacy_Impact_Assessment_and_Records_of_Processing_Templates', None),
    ('security-due-diligence-questionnaire.md', ONBOARDING, 'BrokerVerse_Security_Due_Diligence_Questionnaire', None),
    # 05 Delivery
    ('implementation-approach.md', DELIVERY, 'BrokerVerse_Implementation_Approach_and_Plan', None),
    ('project-status-report-template.md', DELIVERY, 'BrokerVerse_Project_Status_Report_Template', None),
    ('training-and-change-management.md', DELIVERY, 'BrokerVerse_Training_Plan', None),
    ('user-manual.md', DELIVERY, 'BrokerVerse_User_Manual', None),
    ('reports-book.md', DELIVERY, 'BrokerVerse_Reports_Book', None),
    ('communication-templates.md', DELIVERY, 'BrokerVerse_Communication_Templates_and_Touchpoints', None),
    ('schedules-and-batch-jobs.md', DELIVERY, 'BrokerVerse_Schedules_and_Batch_Jobs', None),
    ('test-summary.md', DELIVERY, 'BrokerVerse_Test_Summary_Report', None),
    ('ph-regulatory-compliance-matrix.md', DELIVERY, 'BrokerVerse_Philippine_Regulatory_Compliance_Matrix', None),
    # 06 Support
    ('production-support.md', SUPPORT, 'BrokerVerse_Production_Support_Approach_and_Standards', None),
    ('business-continuity-and-disaster-recovery.md', SUPPORT, 'BrokerVerse_Business_Continuity_and_Disaster_Recovery_Plan', None),
    ('release-notes-and-roadmap.md', SUPPORT, 'BrokerVerse_Release_Notes_and_Roadmap', None),
    ('release-notes-template.md', SUPPORT, 'BrokerVerse_Release_Notes_Template', None),
    # 07 Technical
    ('architecture-infrastructure-security.md', TECHNICAL, 'BrokerVerse_Architecture_Infrastructure_Security_and_Privacy', None),
    ('technical-reference.md', TECHNICAL, 'BrokerVerse_Technical_Reference', None),
    ('data-dictionary.md', TECHNICAL, 'BrokerVerse_Data_Dictionary', None),
    # 08 Management
    ('go-live-readiness-and-management-register.md', MANAGEMENT, 'BrokerVerse_Go_No_Go_and_Management_Register', None),
    ('ootb-strategy.md', MANAGEMENT, 'iNXT_BrokerVerse_OOTB_Strategy_and_Playbook_INTERNAL', None),
    ('ph-fit-and-asean-rollout-assessment.md', MANAGEMENT, 'BrokerVerse_PH_Fit_and_ASEAN_Rollout_Assessment', None),
    ('documentation-pack-index.md', MANAGEMENT, 'BrokerVerse_OOTB_Documentation_Pack_Index', None),
]

# Sales material built without a text source (python-docx, python-pptx, a browser), run with --sales.
# The two-page brochure takes its cropped screen pictures from brochure/img.
SALES_BUILDS = [
    ['python3', 'brochure/build_brochure.py', os.path.join(PKG, SALES, 'iNXT_BrokerVerse_Brochure.docx')],
    ['soffice', '--headless', '--convert-to', 'pdf', '--outdir', os.path.join(PKG, SALES),
     os.path.join(PKG, SALES, 'iNXT_BrokerVerse_Brochure.docx')],
    ['python3', 'onepager/build_onepager.py'],
    ['python3', 'build_sales_deck.py'],
    ['soffice', '--headless', '--convert-to', 'pdf', '--outdir', os.path.join(PKG, SALES),
     os.path.join(PKG, SALES, 'iNXT_BrokerVerse_Client_Presentation.pptx')],
]

# Workbooks with a builder, in dependency order, run with --workbooks.
WORKBOOKS = [
    ['python3', 'build_pricing.py'],                                   # 02 Commercials and Pricing
    ['python3', 'build_price_book.py'],                                # 02 Price Book (reads the pricing workbook)
    ['python3', 'build_roi.py'],                                       # 01 ROI Calculator (reads the price book)
    ['python3', 'build_questionnaire_xlsx.py', os.path.join(SRC, 'security-due-diligence-questionnaire.md'),
     os.path.join(PKG, ONBOARDING, 'BrokerVerse_Security_Due_Diligence_Questionnaire.xlsx')],
    ['python3', 'build_discovery_workbook.py', os.path.join(PKG, ONBOARDING, 'BrokerVerse_Discovery_and_Configuration_Workbook.xlsx')],
    ['python3', 'build_plan_xlsx.py', os.path.join(PKG, DELIVERY, 'BrokerVerse_Implementation_Plan.xlsx')],
    ['python3', 'build_project_templates_xlsx.py', os.path.join(PKG, DELIVERY)],   # Fit-Gap Register, RAID Log
    ['python3', 'build_touchpoints_xlsx.py', os.path.join(PKG, DELIVERY, 'BrokerVerse_Communication_Touchpoints.xlsx')],
    ['python3', 'build_api_catalogue.py', os.path.join(PKG, TECHNICAL, 'BrokerVerse_API_and_Dependency_Catalogue.xlsx')],
    ['python3', 'build_fit_assessment_xlsx.py', os.path.join(PKG, MANAGEMENT, 'BrokerVerse_PH_Fit_and_ASEAN_Rollout_Assessment.xlsx')],
]


def run(cmd):
    print('+', ' '.join(os.path.relpath(c, HERE) if os.path.isabs(c) else c for c in cmd), flush=True)
    subprocess.run(cmd, cwd=HERE, check=True)


def check_table():
    sources = {os.path.relpath(os.path.join(d, f), SRC) for d, _, fs in os.walk(SRC) for f in fs if f.endswith('.md')}
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
    if docs and (not names or 'documentation-pack-index' in names):
        run(['python3', 'build_pack_index.py'])
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
    if '--sales' in flags:
        for cmd in SALES_BUILDS:
            run(cmd)


if __name__ == '__main__':
    main(sys.argv[1:])
