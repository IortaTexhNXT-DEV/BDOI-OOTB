"""Builds the Philippine process fit and ASEAN rollout assessment workbook (INTERNAL, management positioning):

    python3 build_fit_assessment_xlsx.py [../08_Management/BrokerVerse_PH_Fit_and_ASEAN_Rollout_Assessment.xlsx] [summary.json]

Sheets: Summary, PH Process Fit, Gaps Ranked, ASEAN Countries, ASEAN Heat Map, Method and Sources.

The process catalogue (CATALOGUE) and the country estimates (COUNTRIES, HEAT) below are the single source of the
numbers. The document source/ph-fit-and-asean-rollout-assessment.md quotes the figures this script prints; when a
score changes here, run the script and update the document from its output.

Scores (assessed on branch brokerverse-platform as of 04 October 2026, not on work in development):
  2 = supported out of the box end to end, 1 = partly supported, workaround or configuration not yet present,
  0 = not supported. Weight 1 to 3 = importance to a Philippine non-life broker.
"""
import json
import os
import sys
from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    HERE, '..', '08_Management', 'BrokerVerse_PH_Fit_and_ASEAN_Rollout_Assessment.xlsx')
SUMMARY_JSON = sys.argv[2] if len(sys.argv) > 2 else None

NAVY = '0B2A4A'
HEAD_FILL = PatternFill('solid', fgColor=NAVY)
HEAD_FONT = Font(name='Segoe UI', bold=True, color='FFFFFF', size=10)
BODY_FONT = Font(name='Segoe UI', size=10)
TITLE_FONT = Font(name='Segoe UI', bold=True, color=NAVY, size=14)
BOLD = Font(name='Segoe UI', bold=True, size=10, color=NAVY)
NOTE_FONT = Font(name='Segoe UI', italic=True, size=9, color='555555')
THIN = Side(style='thin', color='BFC7D1')
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical='top')
CENTER = Alignment(horizontal='center', vertical='top', wrap_text=True)
SCORE_FILL = {2: PatternFill('solid', fgColor='DCEFE3'), 1: PatternFill('solid', fgColor='FFF2CC'),
              0: PatternFill('solid', fgColor='F8D7DA')}
L1_FILL = PatternFill('solid', fgColor='E8EEF5')

AS_OF = '04 October 2026'

# --------------------------------------------------------------------------------------------------------------------
# L1 process areas
L1 = {
    1: 'Client onboarding, KYC and AML',
    2: 'Prospecting and sales pipeline',
    3: 'Quotation and insurer comparison',
    4: 'RFQ, placement, co-insurance and reinsurance',
    5: 'Policy issuance, documents and motor (CTPL, LTO)',
    6: 'Endorsements and cancellations',
    7: 'Renewals and retention',
    8: 'Billing, collection, credit control and receipts',
    9: 'Remittance, direct bill and insurer reconciliation',
    10: 'Commission, referrers and incentives',
    11: 'Claims assistance',
    12: 'Accounting, general ledger, period end and audit',
    13: 'Taxes and BIR compliance',
    14: 'Insurance Commission and Data Privacy compliance',
    15: 'Reporting, administration, security and go-live',
}

# Type: Ops = operational; IC, BIR, NPC, AMLC = regulatory item of that authority.
# Applies: Both = broker and agent; Broker = broker practice only; Agent = captive agency practice.
# Dev = True when the gap is covered by work in development today (counted as not delivered).
# (id, L1, process, applies, type, weight, score, evidence, gap note, fix type, effort, dev)
CATALOGUE = [
    # 1 Client onboarding, KYC and AML
    ('1.01', 1, 'Individual client record with Philippine address, mobile and TIN', 'Both', 'Ops', 3, 1,
     'Operations > Clients (/agent/clientlisting); clients.test.js; addresses API (country, province, city, barangay, postal code)',
     'Client is created at first policy issue. Location masters are labelled State and hold Metro Manila and selected areas, not the full PSGC list (in development).',
     'In development', 'M', True),
    ('1.02', 1, 'Corporate client with TIN, registered name and authorised signatories', 'Both', 'AMLC', 2, 1,
     'Prospects (corporate requires company name and TIN); leads.test.js',
     'No structured authorised persons or board resolution record for juridical clients.', 'Code', 'S', False),
    ('1.03', 1, 'Customer identification: government ID type, number and image', 'Both', 'AMLC', 3, 2,
     'Policy issue KYC (policy.kyc_required_fields, policy.kyc_id_types, modules/policies/kyc.js); policies.test.js',
     'Required for motor by default; other lines by setting. The PH ID master list is in development (setting works today).', '', '', False),
    ('1.04', 1, 'Risk-based customer due diligence rating and enhanced due diligence', 'Both', 'AMLC', 2, 0,
     'None found in backend/src/modules', 'No customer risk rating, EDD workflow or periodic KYC refresh.', 'Code', 'M', False),
    ('1.05', 1, 'Beneficial ownership of juridical clients', 'Both', 'AMLC', 2, 0,
     'None found', 'No beneficial owner capture.', 'Code', 'S', False),
    ('1.06', 1, 'Sanctions, PEP and negative list screening', 'Both', 'AMLC', 2, 0,
     'None found (grep sanction/PEP returns nothing)', 'No screening at onboarding or at payment.', 'Integration', 'M', False),
    ('1.07', 1, 'Covered and suspicious transaction monitoring and AMLC reporting', 'Both', 'AMLC', 2, 0,
     'Receipts Register, Collection Report give transaction data only (compliance matrix, AMLA chapter)',
     'No threshold rules, alert queue or AMLC reporting file.', 'Code', 'M', False),
    ('1.08', 1, 'KYC and transaction record retention (5 years or more)', 'Both', 'AMLC', 1, 2,
     'Business records never deleted by housekeeping; privacy.retention_years 10; privacy.test.js', '', '', '', False),
    ('1.09', 1, 'Single client view across policies, claims, renewals and endorsements', 'Both', 'Ops', 2, 2,
     'Clients > client view tabs; clients.test.js; UAT scenario retail and corporate phases', '', '', '', False),
    ('1.10', 1, 'Privacy notice and consent per purpose at onboarding', 'Both', 'NPC', 3, 2,
     'Data privacy tab on client and prospect; Master > Data Privacy > Consent Register; privacy.test.js', '', '', '', False),

    # 2 Prospecting and sales pipeline
    ('2.01', 2, 'Lead capture by line (motor, fire, IAR, employee benefits), retail or corporate', 'Both', 'Ops', 2, 2,
     'Sales & Marketing > Prospects (/agent/leadlisting); leads.test.js', '', '', '', False),
    ('2.02', 2, 'Bulk lead upload with row error report', 'Both', 'Ops', 1, 2,
     'POST /leads/bulk-upload; leads.test.js', '', '', '', False),
    ('2.03', 2, 'Lead status pipeline and conversion funnel', 'Both', 'Ops', 2, 2,
     'Lead statuses New to Converted or Lost; Lead Conversion Funnel report; reports.test.js', '', '', '', False),
    ('2.04', 2, 'Sales activities: calls, meetings, follow-up tasks and reminders', 'Both', 'Ops', 2, 0,
     'No activity log on leads (modules/leads); My Work inbox in development',
     'Account executives cannot log activities or schedule follow-ups on a prospect.', 'In development', 'M', True),
    ('2.05', 2, 'Lead assignment to account executives and team visibility', 'Both', 'Ops', 2, 1,
     'Record scope for scoped roles (security.scoped_roles); scope.test.js',
     'Owner scoping exists; no assignment rules, reassignment queue or team view.', 'Code', 'S', False),
    ('2.06', 2, 'Sales targets and sales dashboard', 'Both', 'Ops', 2, 2,
     'Dashboard > Sales Dashboard; dashboard.targets; dashboard.test.js', '', '', '', False),
    ('2.07', 2, 'Dealer, bank and affinity channel referrals (captive agency, motor dealer branches)', 'Agent', 'Ops', 2, 1,
     'Commission > Agents/Referrer Accounts (types Agent, Sub-agent, External); commission.test.js',
     'No dealer or dealer-branch master, channel hierarchy or dealer production report.', 'Code', 'M', False),
    ('2.08', 2, 'Marketing campaigns to consenting clients', 'Both', 'Ops', 1, 1,
     'Marketing consent per purpose; Renewals > Lapse Management win-back campaigns',
     'No general campaign or mass mailing module.', 'Code', 'M', False),

    # 3 Quotation and insurer comparison
    ('3.01', 3, 'Quick quote of packaged products from insurer rate tables', 'Both', 'Ops', 2, 2,
     'Sales & Marketing > Quick Quote; Master > Finance > Insurer Rate Tables; packages.test.js', '', '', '', False),
    ('3.02', 3, 'Side-by-side comparison of insurers on screen', 'Broker', 'Ops', 3, 2,
     'Sales & Marketing > Compare Insurers (/sales/compare-insurers); packages.test.js', '', '', '', False),
    ('3.03', 3, 'Client-facing comparison and recommendation report', 'Broker', 'Ops', 2, 1,
     'Market comparison table on slip PDFs (modules/documents/templates.js)',
     'Printable comparison report for the client is in development.', 'In development', 'S', True),
    ('3.04', 3, 'Motor quotation: own damage, acts of nature, VTPL BI/PD, APPA, accessories', 'Both', 'Ops', 3, 2,
     'Sales & Marketing > Quotations (/agent/Quotation); quotations.test.js; motor-tariff.test.js', '', '', '', False),
    ('3.05', 3, 'Server-side pricing with premium taxes (VAT, DST, LGT, FST)', 'Both', 'BIR', 3, 2,
     'modules/premium-charges (one calculator); premium-charges.test.js; money-single-source.test.js', '', '', '', False),
    ('3.06', 3, 'Quotation for non-motor lines from insurer terms', 'Both', 'Ops', 3, 2,
     'Quotation slip and RFQ offers (placement.journey); request-for-quotation.test.js; UAT corporate phase (fire, IAR, CAR, marine, CGL)', '', '', '', False),
    ('3.07', 3, 'Discount control taken from broker commission', 'Both', 'Ops', 2, 2,
     'Quotation order summary (discount up to 30%); quotations.test.js', '', '', '', False),
    ('3.08', 3, 'Online client approval of the quotation', 'Both', 'Ops', 2, 2,
     'Send for Customer Approval (signed link 168 hours); customer-response.test.js',
     'Approval through the live e-mail link blocked in the test environment (no SMTP); recorded responses tested.', '', '', False),
    ('3.09', 3, 'Quotation validity, expiry and maker-checker', 'Both', 'Ops', 1, 2,
     'limits.quote_validity_days; Quotation expiry job; workflow.quote_maker_checker; quotations.test.js', '', '', '', False),
    ('3.10', 3, 'Electronic signature of proposal and acceptance', 'Both', 'Ops', 1, 1,
     'Approval link records acceptance; Signatories master',
     'E-signature on documents is in development.', 'In development', 'S', True),
    ('3.11', 3, 'Product rules from the Product Configurator drive the quotation', 'Both', 'Ops', 2, 1,
     'Product Configurator > Product Templates (MOT-003-2025 CTPL and APPA tariff used); product-configurator.test.js',
     'Only the motor tariff feeds quotations; coverage, acceptance and document rules are not yet connected (in development).',
     'In development', 'M', True),

    # 4 RFQ, placement, co-insurance and reinsurance
    ('4.01', 4, 'Request for Quotation (broker slip) to several insurers by e-mail', 'Broker', 'Ops', 3, 2,
     'Sales & Marketing > Request for Quotation (/placement/broker-slips); request-for-quotation.test.js', '', '', '', False),
    ('4.02', 4, 'Record insurer offers and declines with terms', 'Broker', 'Ops', 3, 2,
     'Broker slip offers (Offered, Declined, Pending); request-for-quotation.test.js', '', '', '', False),
    ('4.03', 4, 'Compare offers, best offer and market capacity', 'Broker', 'Ops', 3, 2,
     'Request for Quotation > Compare offers; request-for-quotation.test.js', '', '', '', False),
    ('4.04', 4, 'Placement slip to lead and co-insurers with confirmation per insurer', 'Broker', 'Ops', 3, 2,
     'Sales & Marketing > Placement Slips (/placement/placement-slips); placement.test.js', '', '', '', False),
    ('4.05', 4, 'Co-insurance shares, payables and taxes split per participant', 'Broker', 'Ops', 3, 2,
     'Co-insurance Register; Due to Insurers by Co-insurer; placement.test.js; remittance.test.js', '', '', '', False),
    ('4.06', 4, 'Placement journey rules per line of business', 'Broker', 'Ops', 2, 2,
     'placement.journey (Master > Configuration); modules/placement/journey.js; placement.test.js', '', '', '', False),
    ('4.07', 4, 'Cover note or binder while the policy is pending', 'Both', 'Ops', 2, 0,
     'None found (grep cover note / binder returns nothing)',
     'No cover note document or temporary cover record.', 'Code', 'S', False),
    ('4.08', 4, 'Placement only with insurers authorised by the IC', 'Both', 'IC', 2, 1,
     'Master > Generals > Insurance Management > Insurance Company',
     'No certificate of authority number or expiry check; IC non-life insurer list is in development.', 'In development', 'S', True),
    ('4.09', 4, 'Market response analytics (hit ratio per insurer)', 'Broker', 'Ops', 1, 2,
     'Market Response and Placement Pipeline reports; reports.test.js', '', '', '', False),
    ('4.10', 4, 'Facultative reinsurance placement (where the broker acts as reinsurance broker)', 'Broker', 'Ops', 1, 1,
     'Reinsurance > Treaty Dashboard, Cession Tracking; reinsurance.test.js',
     'The module records treaties and cessions from the cedant side; there is no facultative reinsurance slip workflow.',
     'Code', 'M', False),
    ('4.11', 4, 'Reinsurance recoveries and reinsurer statement reconciliation', 'Broker', 'Ops', 1, 2,
     'Reinsurance > Claims Recovery, Reconciliation; reinsurance.test.js', '', '', '', False),

    # 5 Policy issuance, documents and motor
    ('5.01', 5, 'Issue policy from bound placement or accepted quotation, create client, bill premium', 'Both', 'Ops', 3, 2,
     'Operations > Policy; quote-to-policy.test.js; policies.test.js; UAT scenario 371 steps passed', '', '', '', False),
    ('5.02', 5, 'Record a policy already issued by the insurer', 'Both', 'Ops', 3, 2,
     'Placement Slips > Record Issued Policy; placement.test.js', '', '', '', False),
    ('5.03', 5, 'Policy schedule and documents generated and e-mailed to the client', 'Both', 'Ops', 3, 2,
     'Policy issued e-mail with schedule PDF; printing.test.js; email-documents.test.js', '', '', '', False),
    ('5.04', 5, 'Upload of the insurer policy document and attachments', 'Both', 'Ops', 2, 2,
     'Policy details > documents (PDF or image, 10 MB); policies.test.js', '', '', '', False),
    ('5.05', 5, 'Motor details: chassis, motor, plate or MV file number, mortgagee, photos', 'Both', 'Ops', 3, 2,
     'Motor policy issue (policy.kyc_required_fields); policies.test.js', '', '', '', False),
    ('5.06', 5, 'CTPL tariff per vehicle class, 1-year and 3-year, never discounted', 'Both', 'IC', 3, 2,
     'Product Configurator MOT-003-2025 CTPL & Auto PA tab; motor-tariff.test.js', '', '', '', False),
    ('5.07', 5, 'CTPL certificate of cover authentication with the IC-accredited system and LTO', 'Both', 'IC', 3, 1,
     'Policy fields Cert Number and Authen Code (recorded by hand)',
     'No integration with the authentication provider or LTO; done in the insurer or government portal.', 'Integration', 'L', False),
    ('5.08', 5, 'Brand-new vehicle programme: dealer sale, financing bank mortgagee clause, free first-year cover', 'Agent', 'Ops', 2, 1,
     'Mortgagee field on motor policy; 3-year CTPL for brand-new vehicles',
     'No dealer or financing-bank programme set-up, bulk dealer upload or bank endorsement letters.', 'Code', 'M', False),
    ('5.09', 5, 'Bulk issuance: fleet schedules and group policies', 'Both', 'Ops', 2, 1,
     'Policy bulk upload for new business and in-force book; upload-templates.test.js',
     'No fleet schedule with per-vehicle premium inside one policy.', 'Code', 'M', False),
    ('5.10', 5, 'Policy life cycle statuses and payment statuses', 'Both', 'Ops', 2, 2,
     'Policy statuses Active, Expired, Renewed, Lapsed, Cancelled; policies.test.js', '', '', '', False),
    ('5.11', 5, 'Lines placed: motor, fire, IAR, CAR, EAR, marine, CGL, money, PA, travel, EB, surety', 'Both', 'Ops', 2, 2,
     'UAT data set issued 62 new policies across these lines (test-summary.md, UAT data set)', '', '', '', False),
    ('5.12', 5, 'Marine open cover with certificates and declarations', 'Broker', 'Ops', 1, 0,
     'None found', 'No open cover or declaration processing.', 'Code', 'M', False),

    # 6 Endorsements and cancellations
    ('6.01', 6, 'Motor endorsements: personal details, motor details, coverage change, extension', 'Both', 'Ops', 3, 2,
     'Operations > Policy > Endorsement; endorsements.test.js', '', '', '', False),
    ('6.02', 6, 'Non-motor endorsements: premium change', 'Both', 'Ops', 2, 2,
     'Fire and allied perils Regular / Premium Change; endorsements.test.js', '', '', '', False),
    ('6.03', 6, 'Re-pricing of coverage change with taxes on the server', 'Both', 'Ops', 2, 2,
     'endorsements.test.js (premium delta priced on the server; refuses a mismatched delta)', '', '', '', False),
    ('6.04', 6, 'Cancellation full, partial or pro-rata with return premium computed', 'Both', 'Ops', 3, 1,
     'Cancellation endorsement (cancellationType); endorsements.test.js; package sections pro rata (packages.endorsement_prorata)',
     'For regular policies the return premium of a cancellation is entered by the user, not computed from days left.', 'Code', 'S', False),
    ('6.05', 6, 'Short-period rate scale when the insured cancels', 'Both', 'Ops', 2, 0,
     'None found (grep short period returns nothing)', 'No short-period table or computation.', 'Code', 'S', False),
    ('6.06', 6, 'Return premium: refund to client, netting on insurer remittance, commission clawback', 'Both', 'Ops', 3, 2,
     'endorsements.test.js; remittance.test.js; commission.test.js (clawback)', '', '', '', False),
    ('6.07', 6, 'Completion with insurer endorsement document and client notice', 'Both', 'Ops', 2, 2,
     'Endorsement completion upload; e-mail on completion; endorsements.test.js', '', '', '', False),
    ('6.08', 6, 'Cancellation for non-payment from the premium warranty monitor', 'Both', 'IC', 2, 2,
     'Accounts > Credit Control > Premium Warranty Monitor (draft cancellation endorsement); credit-control.test.js', '', '', '', False),

    # 7 Renewals
    ('7.01', 7, 'Renewal pipeline 90 days before expiry, notices at 60, 30 and 15 days', 'Both', 'Ops', 3, 2,
     'Renewals > Renewal Queue; renewals.pipeline_days; renewals.test.js', '', '', '', False),
    ('7.02', 7, 'Renewal re-rating, negotiation with the insurer and renewal quotation', 'Both', 'Ops', 3, 2,
     'Renewals > Negotiations; renewals.test.js; money-single-source.test.js', '', '', '', False),
    ('7.03', 7, 'Renewal batch (up to 500 policies)', 'Both', 'Ops', 2, 2,
     'Renewals > Renewal Batch; renewals.test.js', '', '', '', False),
    ('7.04', 7, 'At-risk scoring, retention analytics and performance', 'Both', 'Ops', 1, 2,
     'Renewals > At-Risk Policies, Retention Analytics, Performance; renewals.test.js', '', '', '', False),
    ('7.05', 7, 'Lapse management and win-back', 'Both', 'Ops', 1, 2,
     'Renewals > Lapse Management; renewals.grace_period_days; renewals.test.js', '', '', '', False),
    ('7.06', 7, 'Renewal of placed and co-insured risks through the placement journey', 'Broker', 'Ops', 2, 2,
     'placement.journey_applies_to_renewals; placement.test.js', '', '', '', False),
    ('7.07', 7, 'Renewal notices by SMS or messaging app', 'Both', 'Ops', 1, 0,
     'E-mail and in-app only (product functionality checklist item 59)', 'No SMS or Viber gateway.', 'Integration', 'S', False),

    # 8 Billing, collection, credit control and receipts
    ('8.01', 8, 'Premium bill on issue, endorsement and renewal; invoice e-mailed', 'Both', 'Ops', 3, 2,
     'INV series; E-mail invoice; receipts.test.js; email-documents.test.js', '', '', '', False),
    ('8.02', 8, 'Payment capture (cash, cheque, transfer, online) with proof for verification', 'Both', 'Ops', 3, 2,
     'Operations > Payments; payments.test.js; policy-payments.test.js; payment-segregation.test.js', '', '', '', False),
    ('8.03', 8, 'Official receipt posting by Accounting, partial payments', 'Both', 'Ops', 3, 2,
     'Accounts > Receipts; receipts.test.js', '', '', '', False),
    ('8.04', 8, 'Receipt numbering continuity and printing on letterhead with TIN', 'Both', 'BIR', 2, 2,
     'Master > Document Numbering (61 series); numbering.test.js; printing.test.js', '', '', '', False),
    ('8.05', 8, 'Returned cheques (DAIF, DAUD) cancel the receipt and reopen the bill', 'Both', 'Ops', 2, 2,
     'Bank transaction types; receipts.test.js; bank-reconciliation.test.js', '', '', '', False),
    ('8.06', 8, 'Online payment links with automatic receipt', 'Both', 'Ops', 2, 2,
     'Payment links (PayMongo, Dragonpay, sandbox provider); payments.test.js',
     'Tested with the sandbox provider only; live keys are a go-live task.', '', '', False),
    ('8.07', 8, 'Receivables ageing and automatic collection reminders', 'Both', 'Ops', 3, 2,
     'Accounts > Collections; Collection reminders job; collections.test.js', '', '', '', False),
    ('8.08', 8, 'Premium payment warranty and credit terms per insurer (Insurance Code, IC rules)', 'Both', 'IC', 3, 2,
     'Insurance Company > Premium Payment Warranty; Premium Warranty Monitor; claims.block_unpaid_premium; credit-control.test.js', '', '', '', False),
    ('8.09', 8, 'Instalment billing with separate instalment invoices', 'Both', 'Ops', 2, 1,
     'Accounts > Credit Control > Instalment Plans; credit-control.test.js',
     'Plans split the follow-up of a bill without changing the ledger; no invoice per instalment.', 'Code', 'S', False),
    ('8.10', 8, 'Client credit limits with exception notice', 'Both', 'Ops', 1, 2,
     'Accounts > Credit Control > Client Credit Limits; credit-control.test.js', '', '', '', False),
    ('8.11', 8, 'Collection follow-up log, commitments and escalation', 'Both', 'Ops', 2, 2,
     'Collection items; collections.test.js', '', '', '', False),
    ('8.12', 8, 'Post-dated cheque register and deposit on due date', 'Both', 'Ops', 2, 0,
     'Not found as a register (cheque date handling in disbursements only)',
     'Post-dated cheques received from clients are not tracked until deposit.', 'Code', 'S', False),
    ('8.13', 8, 'Bulk receipt upload and bulk print', 'Both', 'Ops', 1, 2,
     'Receipts bulk upload (1,000 rows) and Bulk Print; receipts.test.js', '', '', '', False),

    # 9 Remittance, direct bill and insurer reconciliation
    ('9.01', 9, 'Remittance per insurer net of commission, by co-insurer share', 'Both', 'IC', 3, 2,
     'Accounts > Remittance > Automated Processing; remittance.test.js', '', '', '', False),
    ('9.02', 9, 'Remittance terms per insurer, due dates and remittance ageing', 'Both', 'IC', 3, 2,
     'Insurance Company > Remittance Terms; Credit Control > Remittance Ageing; remittance.test.js', '', '', '', False),
    ('9.03', 9, 'Remittance approval within Authority Matrix limits', 'Both', 'Ops', 2, 2,
     'Remittance > Approval Workflow; Authority Matrix; consolidation.test.js; remittance.test.js', '', '', '', False),
    ('9.04', 9, 'Settlement by payment voucher and electronic transfer record', 'Both', 'Ops', 2, 2,
     'Remittance > Settlement, Electronic Transfer; disbursements.test.js', '', '', '', False),
    ('9.05', 9, 'Bank payment file (InstaPay, PESONet, bulk credit) for insurers and referrers', 'Both', 'Ops', 2, 0,
     'Transfers recorded only (checklist item 58)', 'No bank upload file; payments keyed in the bank portal.', 'Integration', 'M', False),
    ('9.06', 9, 'Direct bill commission debit notes with VAT and EWT', 'Both', 'BIR', 3, 2,
     'Remittance > Direct Bill Processing; direct-bill.test.js; direct-bill-client-payments.test.js', '', '', '', False),
    ('9.07', 9, 'Agency bill processing', 'Agent', 'Ops', 2, 2,
     'Remittance > Agency Bill Processing (/finance/remittance/agencybill); remittance.test.js', '', '', '', False),
    ('9.08', 9, 'Insurer statement of account import, matching and differences', 'Both', 'Ops', 2, 2,
     'Accounts > Insurer Reconciliation > Insurer Statements; insurer-reconciliation.test.js', '', '', '', False),
    ('9.09', 9, 'Insurer system integration (policy, premium, claims data by API)', 'Both', 'Ops', 1, 0,
     'Files and e-mail only (checklist item 57)', 'No insurer API connector.', 'Integration', 'L', False),

    # 10 Commission, referrers and incentives
    ('10.01', 10, 'Commission rate matrix by insurer, product, line and policy type with dates', 'Both', 'Ops', 3, 2,
     'Master > Finance > Commission Rate Matrix; commission.test.js', '', '', '', False),
    ('10.02', 10, 'Brokerage or agency commission income per insurer per policy', 'Both', 'Ops', 3, 2,
     'Posting rule policy issue; accounting.test.js; commission.test.js', '', '', '', False),
    ('10.03', 10, 'Referrer and sub-agent commission chain, payable on full collection', 'Both', 'Ops', 3, 2,
     'commission.require_full_payment; Agents/Referrer Accounts; commission.test.js', '', '', '', False),
    ('10.04', 10, 'Withholding tax on commission paid, by payee type and ATC', 'Both', 'BIR', 3, 2,
     'commission.wht_code_by_type; bir.atc_by_payee; commission-taxes.test.js', '', '', '', False),
    ('10.05', 10, 'Commission payout by voucher and bulk disbursement', 'Both', 'Ops', 2, 2,
     'Generate payout; Disbursement > Bulk Disburse; disbursements.test.js', '', '', '', False),
    ('10.06', 10, 'Commission clawback on return premium', 'Both', 'Ops', 2, 2,
     'Commission line status Reversed; commission.test.js', '', '', '', False),
    ('10.07', 10, 'Commission statements for referrers and the broker', 'Both', 'Ops', 2, 2,
     'Broker Commission Statement; Commission Dashboard; reports.test.js', '', '', '', False),
    ('10.08', 10, 'Incentive programmes for account executives', 'Both', 'Ops', 1, 2,
     'Incentive > My Programs, Calculations, Approvals, Statement; incentive.test.js', '', '', '', False),
    ('10.09', 10, 'Licence check of agents and sub-agents before paying commission', 'Both', 'IC', 2, 0,
     'No licence number or expiry on referrer accounts (grep licence: company master only)',
     'Commission can be paid to a referrer without a valid IC licence where one is required.', 'Code', 'S', False),
    ('10.10', 10, 'Overriding, profit and contingent commission from insurers', 'Both', 'Ops', 1, 1,
     'Journal Voucher (manual)', 'No computation; booked by journal voucher.', 'Procedure', 'S', False),

    # 11 Claims assistance
    ('11.01', 11, 'Claim registration with incident, driver, third party and documents', 'Both', 'Ops', 3, 2,
     'Operations > Claims (/agent/claim); claims.test.js', '', '', '', False),
    ('11.02', 11, 'Preliminary loss advice to the insurer by e-mail', 'Both', 'Ops', 3, 2,
     'Claim registration e-mail to insurer claims address; claims.test.js', '', '', '', False),
    ('11.03', 11, 'Claim document checklist per line and missing document follow-up', 'Both', 'Ops', 2, 1,
     'Claim documents upload; causes of loss per line (GET /claims/config)',
     'No required-document checklist or reminder to the claimant.', 'Code', 'S', False),
    ('11.04', 11, 'Adjuster, insurer claim number, status tracking and handling time', 'Both', 'Ops', 2, 2,
     'Claim statuses; claims.sla_days 20; Claims Dashboard; claims.test.js', '', '', '', False),
    ('11.05', 11, 'Settlement approval by a second user and claim letters (discharge voucher)', 'Both', 'Ops', 3, 2,
     'claims.settlement_maker_checker; Claims Discharge Voucher PDF; claims.test.js', '', '', '', False),
    ('11.06', 11, 'Claims paid through the broker: funds received and paid to claimant', 'Both', 'Ops', 2, 1,
     'Settlement cash panel (POST /claims/:id/settlement-cash/...); claims.test.js',
     'Panel is on the claim screens; Accounting menu not extended, so the System Administrator records it (known limitation).', 'Code', 'S', False),
    ('11.07', 11, 'Co-insurer shares of claims and settlements', 'Both', 'Ops', 2, 2,
     'Claim screens show each insurer share; claims.test.js', '', '', '', False),
    ('11.08', 11, 'Motor claims: repair shop, estimate and letter of authority', 'Both', 'Ops', 2, 1,
     'Repair shop on settlement (migration 0216)', 'No estimate approval or letter of authority workflow.', 'Code', 'M', False),
    ('11.09', 11, 'Claims position and ageing reports', 'Both', 'Ops', 2, 2,
     'Claims Position, Claims Ageing; reports.test.js', '', '', '', False),

    # 12 Accounting, GL, period end and audit
    ('12.01', 12, 'Double-entry general ledger fed by posting rules', 'Both', 'Ops', 3, 2,
     'Master > Finance > Posting Rules, Account Determination; posting-rules.test.js; accounting-flow.test.js', '', '', '', False),
    ('12.02', 12, 'Philippine broker chart of accounts with premium trust account', 'Both', 'Ops', 2, 2,
     'Main Account, Sub Account masters; chart-of-accounts.test.js', '', '', '', False),
    ('12.03', 12, 'Journal, correction and reversal vouchers with approval', 'Both', 'Ops', 3, 2,
     'Accounts > Journal Voucher, Correction JV, Reversal JV; journal.test.js', '', '', '', False),
    ('12.04', 12, 'Payment vouchers, cheques and petty cash', 'Both', 'Ops', 3, 2,
     'Accounts > Disbursement, Petty Cash; disbursements.test.js', '', '', '', False),
    ('12.05', 12, 'Bank statement import, auto-match and reconciliation statement', 'Both', 'Ops', 3, 2,
     'Accounts > Bank Reconciliation; bank-reconciliation.test.js', '', '', '', False),
    ('12.06', 12, 'Month-end close with checklist, accruals and recurring journals', 'Both', 'Ops', 3, 2,
     'Accounts > Period End > Month-End Close; period-end.test.js; period-end-calendar.test.js', '', '', '', False),
    ('12.07', 12, 'Year-end close and opening balances', 'Both', 'Ops', 2, 2,
     'Accounts > Period End > Year-End Close; period-end.test.js', '', '', '', False),
    ('12.08', 12, 'Financial statements: income statement, balance sheet, trial balance', 'Both', 'Ops', 3, 2,
     'Accounts > Period End > Financial Statements; reports.test.js', '', '', '', False),
    ('12.09', 12, 'Multi-currency transactions and FX revaluation', 'Both', 'Ops', 1, 2,
     'Master > Finance > Currency, Exchange Rate (migration 0235); period-end.test.js', '', '', '', False),
    ('12.10', 12, 'Supplier invoices, input VAT, fixed assets and depreciation', 'Both', 'Ops', 2, 1,
     'Supplier payment vouchers with withholding; input VAT tax code',
     'No supplier invoice register (accounts payable sub-ledger) or fixed asset register.', 'Code', 'M', False),
    ('12.11', 12, 'Audit support: GL detail, journal register, source document trace', 'Both', 'Ops', 2, 2,
     'General Ledger Detail, Journal Register; each journal points to its source; journal.test.js', '', '', '', False),

    # 13 Taxes and BIR
    ('13.01', 13, 'Premium taxes: DST (NIRC s.184), VAT 12%, LGT by LGU, FST 2%', 'Both', 'BIR', 3, 2,
     'Master > Finance > Premium Taxes & LGU Rates; premium-charges.test.js',
     'DST rule delivered as 12.5% of premium; the per-unit option (PHP 0.50 per PHP 4.00, fraction rounded up) is available.', '', '', False),
    ('13.02', 13, 'Premium tax regime per product (VAT or premium tax)', 'Both', 'BIR', 2, 2,
     'Product master premium_tax_regime; premium-charges.test.js', '', '', '', False),
    ('13.03', 13, 'Output VAT on commission and VAT Summary (2550Q working paper)', 'Both', 'BIR', 3, 2,
     'Accounts > Tax > VAT Summary; commission-taxes.test.js', '', '', '', False),
    ('13.04', 13, 'Percentage tax for a non-VAT broker or agent (2551Q)', 'Both', 'BIR', 1, 1,
     'direct_bill.broker_vat_registered switch', 'No percentage tax working paper.', 'Code', 'S', False),
    ('13.05', 13, 'EWT on payments and BIR Form 2307 issued', 'Both', 'BIR', 3, 2,
     'Accounts > Tax > BIR Form 2307 (Issued by us); commission-taxes.test.js', '', '', '', False),
    ('13.06', 13, 'CWT withheld by insurers, BIR Form 2307 received and SAWT', 'Both', 'BIR', 3, 2,
     'BIR Form 2307 (Received); SAWT; direct-bill.test.js', '', '', '', False),
    ('13.07', 13, 'Monthly and quarterly EWT returns (0619-E, 1601-EQ) with QAP', 'Both', 'BIR', 3, 1,
     'Accounts > Tax > QAP', 'QAP is delivered; the return figures per ATC are not laid out as the 0619-E / 1601-EQ forms.', 'Code', 'S', False),
    ('13.08', 13, 'Annual information return and alphalist (1604-E)', 'Both', 'BIR', 2, 1,
     'QAP run for a full year range (generic date criteria)', 'No 1604-E alphalist layout.', 'Code', 'S', False),
    ('13.09', 13, 'SLSP sales and purchases', 'Both', 'BIR', 2, 2,
     'Accounts > Tax > SLSP Sales, SLSP Purchases (BIR column order)', '', '', '', False),
    ('13.10', 13, 'Invoices under the EOPT Act and RR 7-2024 (invoice as primary document, required fields)', 'Both', 'BIR', 3, 1,
     'INV, OR and DN series on letterhead with TIN; compliance matrix (Invoices and receipts)',
     'Which document is the registered invoice and its printed fields are not fixed in the product; layout changes are outside OOTB.',
     'Code', 'M', False),
    ('13.11', 13, 'Computerized accounting system registration support (books, outputs, controls)', 'Both', 'BIR', 3, 1,
     'Journals, ledgers, audit trail, period locks, number series; documentation pack',
     'No loose-leaf books print set or CAS output pack; registration is with the broker.', 'Code', 'M', False),
    ('13.12', 13, 'Electronic invoicing and sales data transmission to BIR (EIS)', 'Both', 'BIR', 1, 0,
     'None found', 'No EIS connector (not yet mandatory for most brokers; to verify).', 'Integration', 'L', False),
    ('13.13', 13, 'BIR validation files (DAT) for alphalists and SLSP', 'Both', 'BIR', 2, 1,
     'SAWT, QAP, SLSP as CSV or Excel in BIR column order',
     'Files are re-keyed or imported into the BIR tools; no DAT file.', 'Code', 'S', False),
    ('13.14', 13, 'Tax codes with ATC, rates, GL account and effective dates', 'Both', 'BIR', 2, 2,
     'Master > Finance > Taxation; commission-taxes.test.js', '', '', '', False),

    # 14 Insurance Commission and Data Privacy
    ('14.01', 14, 'IC licence number on company master and documents', 'Both', 'IC', 1, 2,
     'Company master (IC licence number); printing.test.js', '', '', '', False),
    ('14.02', 14, 'Licence renewal tracking of the firm and licensed individuals', 'Both', 'IC', 2, 0,
     'None found', 'No licence expiry calendar for the firm, its officers or solicitors.', 'Code', 'S', False),
    ('14.03', 14, 'Fit and proper records of directors and officers', 'Both', 'IC', 1, 0,
     'None found', 'Kept outside the system.', 'Procedure', 'S', False),
    ('14.04', 14, 'IC annual statement and financial reports in the IC format', 'Both', 'IC', 3, 1,
     'Financial Statements; Trial Balance (figures only)', 'No IC-format report (checklist item 60).', 'Code', 'M', False),
    ('14.05', 14, 'IC production and business reports (premium placed by insurer and line)', 'Both', 'IC', 2, 1,
     'Production Register; Premium by Product / Month / Insurer', 'Figures available; IC layout not produced.', 'Code', 'S', False),
    ('14.06', 14, 'Records of business available for IC examination', 'Both', 'IC', 3, 2,
     'Numbered placement trail RFQ to policy to receipt; reports; audit log', '', '', '', False),
    ('14.07', 14, 'Premium held in trust for insurers, apart from own funds', 'Both', 'IC', 3, 2,
     'Premiums Payable to Insurers per insurer; Premium Trust Account; payment-segregation.test.js', '', '', '', False),
    ('14.08', 14, 'Complaints handling and financial consumer protection (RA 11765)', 'Both', 'IC', 2, 0,
     'None found (grep complaint returns nothing)', 'No complaints register or response time tracking.', 'Code', 'S', False),
    ('14.09', 14, 'Data subject requests, export and anonymisation', 'Both', 'NPC', 3, 2,
     'Master > Data Privacy > Data Subject Requests; privacy.test.js', '', '', '', False),
    ('14.10', 14, 'Retention and disposal of personal data', 'Both', 'NPC', 2, 2,
     'privacy.retention_years; housekeeping.* settings; privacy.test.js', '', '', '', False),
    ('14.11', 14, 'Breach detection support and breach register', 'Both', 'NPC', 2, 1,
     'Login history, audit log, failed sign-in alarms', 'No breach register or 72-hour notification tracker.', 'Code', 'S', False),
    ('14.12', 14, 'Masking of personal data on screens and exports by role', 'Both', 'NPC', 2, 0,
     'Not delivered (in development)', 'Personal identifiers shown in full to every role with read access.', 'In development', 'M', True),
    ('14.13', 14, 'Encryption of personal identifiers', 'Both', 'NPC', 1, 1,
     'Storage encryption (hosting); two-step secrets AES-256-GCM; BV-DEF-003 open',
     'No field-level encryption of IDs and TIN.', 'Code', 'M', False),
    ('14.14', 14, 'Data residency in the Philippines when required', 'Both', 'NPC', 1, 2,
     'Hosting options: local partner or on-premise (architecture document)', '', '', '', False),

    # 15 Reporting, administration, security and go-live
    ('15.01', 15, 'Report catalogue (39 reports) in Excel, CSV and PDF with scheduled e-mail', 'Both', 'Ops', 3, 2,
     'Reports > All Reports (/reports/catalogue); reports.test.js; Daily reports job', '', '', '', False),
    ('15.02', 15, 'Role dashboards (executive, sales, processing, claims, commission)', 'Both', 'Ops', 2, 2,
     'Dashboard menu; dashboard.test.js', '', '', '', False),
    ('15.03', 15, 'Ad hoc reporting and BI extract', 'Both', 'Ops', 1, 1,
     'Report criteria, filters and exports', 'No report designer or data warehouse extract.', 'Code', 'M', False),
    ('15.04', 15, 'Role-based access, deny by default, checked on every API call', 'Both', 'NPC', 3, 2,
     'User Management > Role Permissions, User Access Matrix; role-access.test.js; access-control.test.js', '', '', '', False),
    ('15.05', 15, 'Maker-checker, authority matrix, delegations, SoD and access reviews', 'Both', 'Ops', 3, 2,
     'User Management > Authority Matrix, Delegations, Segregation of Duties, Access Reviews; user-access.test.js', '', '', '', False),
    ('15.06', 15, 'Password policy, lockout and two-step verification', 'Both', 'NPC', 3, 2,
     'security.require_2fa_roles; security.test.js; hardening.test.js', '', '', '', False),
    ('15.07', 15, 'Audit trail with before and after values, searchable by users', 'Both', 'NPC', 3, 1,
     'Master > Configuration > Audit Trail; audit log written for create, update, approval, report run, sign-in',
     'Audit log delivered; the reworked Audit Trail screen is in development and counted as not delivered.', 'In development', 'S', True),
    ('15.08', 15, 'Menu organised by role and task', 'Both', 'Ops', 1, 1,
     'brokerverse/src/components/SideBar/list.js (173 menu screens)', 'Menu redesign in development.', 'In development', 'S', True),
    ('15.09', 15, 'My Work: one inbox of tasks and approvals per user', 'Both', 'Ops', 2, 1,
     'In-app notifications and approval notifications; approval-notifications.test.js', 'My Work inbox in development.', 'In development', 'M', True),
    ('15.10', 15, 'Document numbering and configuration with approval and audit', 'Both', 'Ops', 2, 2,
     'Master > Document Numbering, Configuration, Configuration Approvals; numbering.test.js; configuration-controls.test.js', '', '', '', False),
    ('15.11', 15, 'Branding, letterhead and e-signature on documents', 'Both', 'Ops', 1, 1,
     'Letterhead from Company master; System Settings logo and theme', 'Branding and e-signature in development.', 'In development', 'S', True),
    ('15.12', 15, 'Philippine reference masters (PSGC geography, banks, IDs, salutations, IC insurer list)', 'Both', 'Ops', 2, 1,
     'Seeds: Metro Manila and selected LGUs (seeds/10_masters.sql); KYC ID setting',
     'Full Philippine masters are in development.', 'In development', 'M', True),
    ('15.13', 15, 'Go-live data load: masters, in-force book, open items, GL opening balances', 'Both', 'Ops', 3, 2,
     'Master > Go-Live Data Load; go-live.test.js; go-live-workbench.test.js; go-live-roundtrip.test.js', '', '', '', False),
    ('15.14', 15, 'Migration rehearsal and reconciliation', 'Both', 'Ops', 2, 2,
     'scripts/golive-rehearsal.js; docs/e2e/GOLIVE_REHEARSAL_RUN.md (51 checks passed)', '', '', '', False),
    ('15.15', 15, 'E-mail outbox and in-app notifications', 'Both', 'Ops', 2, 2,
     'Master > Configuration > E-mail Outbox; email-outbox.test.js', '', '', '', False),
    ('15.16', 15, 'Hosting choice, backups and disaster recovery', 'Both', 'Ops', 2, 2,
     'Architecture and BCDR documents; /api/health', 'Recovery objectives are recommended values; no DR test yet.', '', '', False),
]

REG_TYPES = ('IC', 'BIR', 'NPC', 'AMLC')

# --------------------------------------------------------------------------------------------------------------------
# ASEAN countries. Change % per L1 area (share of that area that must change) and the main layer of the change:
# C = configuration only, L = localisation of masters, tax rules and forms, X = code (regulatory reports, e-invoicing
# and other integrations, screens). Language (UI and printed documents) is a separate cross-cutting layer.
COUNTRY_ORDER = ['SG', 'BN', 'MY', 'TH', 'KH', 'ID', 'VN', 'LA', 'MM']
HEAT = {
    'SG': {1: (20, 'L'), 2: (5, 'C'), 3: (30, 'L'), 4: (5, 'C'), 5: (35, 'X'), 6: (10, 'C'), 7: (5, 'C'), 8: (25, 'X'),
           9: (15, 'L'), 10: (15, 'L'), 11: (5, 'C'), 12: (15, 'L'), 13: (70, 'X'), 14: (50, 'X'), 15: (10, 'C')},
    'BN': {1: (25, 'L'), 2: (5, 'C'), 3: (35, 'L'), 4: (10, 'C'), 5: (35, 'X'), 6: (10, 'C'), 7: (5, 'C'), 8: (15, 'L'),
           9: (15, 'L'), 10: (15, 'L'), 11: (5, 'C'), 12: (15, 'L'), 13: (45, 'L'), 14: (50, 'X'), 15: (10, 'C')},
    'MY': {1: (30, 'L'), 2: (5, 'C'), 3: (40, 'L'), 4: (10, 'C'), 5: (40, 'X'), 6: (10, 'C'), 7: (10, 'C'), 8: (45, 'X'),
           9: (20, 'L'), 10: (25, 'L'), 11: (10, 'C'), 12: (20, 'L'), 13: (70, 'X'), 14: (55, 'X'), 15: (10, 'C')},
    'TH': {1: (30, 'L'), 2: (10, 'L'), 3: (45, 'X'), 4: (10, 'C'), 5: (40, 'X'), 6: (15, 'C'), 7: (10, 'C'), 8: (40, 'X'),
           9: (20, 'L'), 10: (30, 'L'), 11: (10, 'C'), 12: (25, 'L'), 13: (70, 'X'), 14: (55, 'X'), 15: (15, 'C')},
    'KH': {1: (30, 'L'), 2: (10, 'L'), 3: (45, 'X'), 4: (10, 'C'), 5: (45, 'X'), 6: (15, 'C'), 7: (10, 'C'), 8: (45, 'X'),
           9: (20, 'L'), 10: (30, 'L'), 11: (15, 'C'), 12: (35, 'L'), 13: (70, 'X'), 14: (45, 'X'), 15: (20, 'L')},
    'ID': {1: (35, 'L'), 2: (10, 'L'), 3: (50, 'X'), 4: (15, 'C'), 5: (45, 'X'), 6: (15, 'C'), 7: (10, 'C'), 8: (50, 'X'),
           9: (25, 'L'), 10: (35, 'X'), 11: (15, 'C'), 12: (30, 'L'), 13: (80, 'X'), 14: (65, 'X'), 15: (20, 'L')},
    'VN': {1: (35, 'L'), 2: (10, 'L'), 3: (50, 'X'), 4: (15, 'C'), 5: (50, 'X'), 6: (20, 'C'), 7: (10, 'C'), 8: (60, 'X'),
           9: (25, 'L'), 10: (35, 'L'), 11: (15, 'C'), 12: (50, 'X'), 13: (80, 'X'), 14: (65, 'X'), 15: (20, 'L')},
    'LA': {1: (30, 'L'), 2: (10, 'L'), 3: (45, 'X'), 4: (15, 'C'), 5: (45, 'X'), 6: (15, 'C'), 7: (10, 'C'), 8: (45, 'X'),
           9: (20, 'L'), 10: (30, 'L'), 11: (15, 'C'), 12: (40, 'L'), 13: (70, 'X'), 14: (50, 'X'), 15: (20, 'L')},
    'MM': {1: (40, 'X'), 2: (10, 'L'), 3: (50, 'X'), 4: (20, 'C'), 5: (50, 'X'), 6: (15, 'C'), 7: (10, 'C'), 8: (45, 'X'),
           9: (25, 'L'), 10: (30, 'L'), 11: (15, 'C'), 12: (40, 'L'), 13: (70, 'X'), 14: (60, 'X'), 15: (25, 'L')},
}
# Language layer: points of change added to the overall % (UI strings, printed documents, fonts and scripts).
LANGUAGE = {'SG': 0, 'BN': 2, 'MY': 3, 'TH': 7, 'KH': 10, 'ID': 9, 'VN': 10, 'LA': 10, 'MM': 12}
# Uncertainty band (+/- points) around the computed midpoint.
BAND = {'SG': 4, 'BN': 5, 'MY': 5, 'TH': 5, 'KH': 7, 'ID': 6, 'VN': 6, 'LA': 8, 'MM': 8}
PW_PER_POINT = 3          # indicative person-weeks per point of change
TEAM = 5                  # people in the localisation team

COUNTRIES = {
    'SG': dict(name='Singapore', regulator='Monetary Authority of Singapore (MAS)',
               broker='Insurance brokers registered with MAS under the Insurance Act; brokers keep insurance broking premium accounts for client money; professional indemnity and capital requirements',
               tax='GST 9% on general insurance premium and on brokerage (verify zero-rated marine and international); no stamp duty on policies; no withholding on resident commission',
               einvoice='InvoiceNow (Peppol) being phased in for GST-registered businesses from 2025 (to verify timing for brokers)',
               language='English; no local language UI needed', currency='SGD',
               privacy='PDPA 2012 (PDPC); Do Not Call registry for marketing; no data localisation (current AWS ap-southeast-1 hosting is in Singapore)',
               motor='Compulsory third-party cover under the Motor Vehicles (Third-Party Risks and Compensation) Act, priced freely by insurers; insurer files cover to LTA; no CTPL tariff',
               accounting='SFRS; GST F5 return; Form C corporate tax; no BIR-type alphalists',
               practice='Large commercial and specialty brokers, regional hub, heavy use of co-insurance and Lloyd\'s; English documents',
               main='Replace BIR tax layer with GST and GST F5 working paper; remove DST, LGT, FST and CTPL; MAS broker returns; InvoiceNow connector; postal codes and NRIC/UEN IDs'),
    'BN': dict(name='Brunei Darussalam', regulator='Brunei Darussalam Central Bank (BDCB)',
               broker='Insurance Order 2006 and Takaful Order 2008; brokers registered with BDCB; few brokers',
               tax='No VAT or GST; no personal income tax; corporate tax 18.5%; stamp duty on some instruments (to verify for policies)',
               einvoice='None known (to verify)',
               language='Malay official, English widely used in business; Malay UI optional', currency='BND (pegged to SGD)',
               privacy='Personal Data Protection Order 2025, transition period running (to verify dates)',
               motor='Compulsory third-party motor insurance; takaful operators significant',
               accounting='IFRS; simple corporate tax filing', practice='Small market; takaful alongside conventional; English documents',
               main='Remove PH tax layer (little to replace); takaful product variant; BDCB returns; PDPO alignment; small market'),
    'MY': dict(name='Malaysia', regulator='Bank Negara Malaysia (BNM)',
               broker='Insurance and takaful brokers approved under the Financial Services Act 2013 and Islamic Financial Services Act 2013; MIBA members',
               tax='Service tax on general insurance premium and brokerage (8% from March 2024, to verify for insurance); stamp duty RM10 per policy; withholding under s.107D on agent commission; CP58 statements to agents',
               einvoice='LHDN MyInvois e-invoicing mandatory in phases from August 2024 (API or portal); applies to brokers above the threshold',
               language='Bahasa Malaysia official; English widely used; Malay UI optional', currency='MYR',
               privacy='PDPA 2010 as amended in 2024 (DPO, breach notification, portability); cross-border transfer rules relaxed',
               motor='Compulsory motor third-party under the Road Transport Act 1987; motor and fire phased liberalisation; e-cover notes to JPJ through insurers; NCD',
               accounting='MFRS; SST-02 return; Form C; CP58', practice='Conventional and takaful markets; panel and bancassurance; cash-before-cover practice for motor (to verify)',
               main='SST and stamp duty rules; MyInvois API connector; takaful variant; s.107D and CP58; BNM returns; motor NCD and JPJ fields'),
    'TH': dict(name='Thailand', regulator='Office of Insurance Commission (OIC)',
               broker='Non-life insurance broker licences (individual and juristic) under the Non-Life Insurance Act B.E. 2535; OIC reporting by brokers',
               tax='VAT 7% on non-life premium and brokerage; stamp duty 1 baht per 250 baht of premium (0.4%); withholding 3% on service fees (PND 3, PND 53) with 50 Tawi certificates',
               einvoice='e-Tax Invoice and e-Receipt optional; tax invoices in Thai with Thai baht amounts',
               language='Thai script required for staff UI and client documents; Buddhist Era dates common', currency='THB',
               privacy='PDPA B.E. 2562 (2019), in force since June 2022; PDPC',
               motor='Compulsory motor insurance (Por Ror Bor) at an OIC tariff per vehicle type, similar to CTPL; voluntary classes 1, 2, 3, 2+ and 3+',
               accounting='TFRS; PP 30 VAT return; PND 3, PND 53, PND 50', practice='Large motor book, dealer and bank channels, many broker-agents; Thai documents',
               main='Thai UI (th.json 4,675 of 7,917 keys translated, not enabled) and Thai PDFs; Por Ror Bor tariff from the CTPL model; VAT 7% and stamp duty; 50 Tawi and PND forms; OIC reports'),
    'KH': dict(name='Cambodia', regulator='Insurance Regulator of Cambodia (IRC)',
               broker='Insurance brokers licensed under the Law on Insurance 2014 and IRC rules',
               tax='Tax on gross premium for insurers and VAT treatment of non-life premium to verify; withholding tax on service payments; dual USD and KHR use',
               einvoice='CamInvoice e-invoicing introduced by the General Department of Taxation from 2025, phased (to verify)',
               language='Khmer script for documents and invoices; English used by international brokers', currency='USD and KHR',
               privacy='No comprehensive personal data law in force yet (draft law, to verify)',
               motor='Compulsory third-party motor insurance introduced (to verify enforcement)',
               accounting='CIFRS; tax returns in KHR', practice='Small, growing market; USD pricing; foreign-owned insurers and brokers',
               main='Dual currency billing USD and KHR; Khmer documents and UI; tax rules replaced; e-invoicing connector; IRC reports'),
    'ID': dict(name='Indonesia', regulator='Otoritas Jasa Keuangan (OJK)',
               broker='Insurance and reinsurance brokers licensed by OJK (broker POJK), sharia brokers; minimum equity and professional indemnity',
               tax='Insurance premium outside the VAT scope; VAT on brokerage (12% rate on a reduced base, effective 11%, to verify); stamp duty Rp10,000 on documents; withholding PPh 23 on services and PPh 21 on individual agents',
               einvoice='e-Faktur through Coretax (since January 2025) mandatory for VAT invoices; e-Bupot for withholding',
               language='Bahasa Indonesia required for policies, invoices and UI', currency='IDR (no decimals in practice)',
               privacy='Personal Data Protection Law 27/2022 in force October 2024; OJK and electronic system rules can require data centres in Indonesia (to verify)',
               motor='OJK reference rate bands for motor and property; Jasa Raharja accident fund collected with vehicle registration, outside brokers',
               accounting='PSAK (SAK); Coretax; monthly withholding returns', practice='OJK tariff bands; standard wordings (PSAKBI); conventional and sharia; reinsurance brokers active',
               main='Coretax e-Faktur and e-Bupot integration; OJK reports; Bahasa UI and documents; OJK rate bands in rating; sharia variant; hosting in Indonesia'),
    'VN': dict(name='Vietnam', regulator='Ministry of Finance (Insurance Supervisory Authority)',
               broker='Insurance brokers licensed under the Law on Insurance Business 2022 and Decree 46/2023',
               tax='VAT 10% on non-life premium and brokerage (some lines exempt); personal income tax withholding on agent commission',
               einvoice='E-invoices with tax authority codes mandatory since July 2022 (Decree 123/2020, Circular 78/2021)',
               language='Vietnamese required for documents, invoices and UI', currency='VND (no decimals)',
               privacy='Personal Data Protection Law effective 1 January 2026 and Decree 13/2023; cybersecurity data localisation for some data (to verify)',
               motor='Compulsory civil liability motor insurance at a Ministry of Finance tariff (Decree 67/2023), e-certificates',
               accounting='Vietnamese Accounting Standards with a prescribed chart of accounts and books in Vietnamese and VND', practice='Bancassurance-led market; brokers mainly serve corporate and FDI clients',
               main='E-invoice connector with tax authority code; VAS chart of accounts and statutory books; Vietnamese UI and documents; MoF motor tariff; MoF reports'),
    'LA': dict(name='Lao PDR', regulator='Ministry of Finance (insurance supervision)',
               broker='Brokers allowed under the Law on Insurance; very few active (to verify)',
               tax='VAT 10%; withholding on services; to verify for insurance', einvoice='Tax e-invoice system being introduced (to verify)',
               language='Lao script for documents and UI', currency='LAK (USD and THB also used)',
               privacy='Law on Electronic Data Protection 2017', motor='Compulsory third-party motor insurance under the insurance law (enforcement to verify)',
               accounting='Lao accounting standards', practice='Very small market; state-linked insurers',
               main='Lao UI and documents; multi-currency billing; tax rules replaced; regulator reports; small market'),
    'MM': dict(name='Myanmar', regulator='Financial Regulatory Department and Insurance Business Supervisory Board (Ministry of Planning and Finance)',
               broker='Insurance Law 2019 provides for intermediaries; broker licensing practice to verify',
               tax='Commercial tax rules and treatment of insurance to verify', einvoice='None known',
               language='Burmese (Myanmar Unicode) for documents and UI', currency='MMK',
               privacy='No comprehensive data protection law; Electronic Transactions Law provisions', motor='Compulsory third-party motor insurance through the state insurer',
               accounting='MFRS (Myanmar)', practice='Political and sanctions risk since 2021; foreign participation constrained',
               main='Not recommended at present; sanctions screening, Burmese UI, regulatory model to verify'),
}

# --------------------------------------------------------------------------------------------------------------------


def pct(num, den):
    return round(100.0 * num / den, 1) if den else 0.0


def compute():
    by_l1 = {}
    for row in CATALOGUE:
        i, l1, _, applies, typ, w, s = row[:7]
        d = by_l1.setdefault(l1, dict(n=0, w=0, got=0, two=0, one=0, zero=0))
        d['n'] += 1
        d['w'] += w
        d['got'] += w * s
        d[{2: 'two', 1: 'one', 0: 'zero'}[s]] += 1
    for d in by_l1.values():
        d['fit'] = pct(d['got'], 2 * d['w'])

    def fit(rows, upgrade_dev=False):
        w = sum(r[5] for r in rows)
        got = sum(r[5] * (2 if (upgrade_dev and r[11]) else r[6]) for r in rows)
        return pct(got, 2 * w)

    reg = [r for r in CATALOGUE if r[4] in REG_TYPES]
    ops = [r for r in CATALOGUE if r[4] == 'Ops']
    out = dict(
        overall=fit(CATALOGUE), regulatory=fit(reg), operational=fit(ops),
        broker=fit([r for r in CATALOGUE if r[3] in ('Both', 'Broker')]),
        agent=fit([r for r in CATALOGUE if r[3] in ('Both', 'Agent')]),
        overall_with_dev=fit(CATALOGUE, True),
        by_authority={a: fit([r for r in CATALOGUE if r[4] == a]) for a in REG_TYPES},
        counts=dict(l2=len(CATALOGUE), two=sum(r[6] == 2 for r in CATALOGUE), one=sum(r[6] == 1 for r in CATALOGUE),
                    zero=sum(r[6] == 0 for r in CATALOGUE), dev=sum(bool(r[11]) for r in CATALOGUE),
                    reg=len(reg), ops=len(ops)),
        by_l1={k: by_l1[k] for k in sorted(by_l1)},
    )
    # gaps
    gaps = []
    for r in CATALOGUE:
        if r[6] < 2:
            reg_mult = 1.5 if r[4] in REG_TYPES else 1.0
            impact = round(r[5] * (2 - r[6]) * reg_mult, 1)
            gaps.append(dict(id=r[0], l1=L1[r[1]], process=r[2], type=r[4], weight=r[5], score=r[6], gap=r[8],
                             fix=r[9], effort=r[10], dev=r[11], impact=impact))
    effort_rank = {'S': 0, 'M': 1, 'L': 2}
    gaps.sort(key=lambda g: (-g['impact'], effort_rank.get(g['effort'], 3), g['id']))
    for n, g in enumerate(gaps, 1):
        g['rank'] = n
    out['gaps'] = gaps
    # countries
    l1w = {k: v['w'] for k, v in by_l1.items()}
    tw = sum(l1w.values())
    cres = {}
    for c in COUNTRY_ORDER:
        layers = {'C': 0.0, 'L': 0.0, 'X': 0.0}
        for l1, (p, lay) in HEAT[c].items():
            layers[lay] += l1w[l1] * p / tw
        layers = {k: round(v, 1) for k, v in layers.items()}
        lang = LANGUAGE[c]
        mid = round(sum(layers.values()) + lang)
        lo, hi = max(0, mid - BAND[c]), mid + BAND[c]
        pw_lo, pw_hi = round(lo * PW_PER_POINT), round(hi * PW_PER_POINT)
        cres[c] = dict(layers=layers, language=lang, mid=mid, lo=lo, hi=hi, pw_lo=pw_lo, pw_hi=pw_hi,
                       wk_lo=max(4, round(pw_lo / TEAM)), wk_hi=round(pw_hi / TEAM))
    order = sorted(COUNTRY_ORDER, key=lambda c: (cres[c]['mid'], c != 'SG'))
    # Myanmar is ranked last whatever its score (market access)
    order = [c for c in order if c != 'MM'] + ['MM']
    for n, c in enumerate(order, 1):
        cres[c]['rank'] = n
    out['countries'] = cres
    out['country_order'] = order
    out['l1_weights'] = l1w
    return out


# --------------------------------------------------------------------------------------------------------------------
def header(ws, row, headers, widths):
    for j, (h, w) in enumerate(zip(headers, widths), 1):
        c = ws.cell(row=row, column=j, value=h)
        c.font, c.fill, c.border = HEAD_FONT, HEAD_FILL, BOX
        c.alignment = Alignment(wrap_text=True, vertical='center')
        if w:
            ws.column_dimensions[get_column_letter(j)].width = w
    ws.row_dimensions[row].height = 30


def put(ws, row, values, center_cols=()):
    for j, v in enumerate(values, 1):
        c = ws.cell(row=row, column=j, value=v)
        c.font, c.border = BODY_FONT, BOX
        c.alignment = CENTER if j in center_cols else WRAP


def build(res):
    wb = Workbook()

    # ---------------------------------------------------------------- Summary
    ws = wb.active
    ws.title = 'Summary'
    ws['A1'] = 'BrokerVerse: Philippine process fit and ASEAN rollout assessment (INTERNAL)'
    ws['A1'].font = TITLE_FONT
    ws['A2'] = (f'Assessed on the code of branch brokerverse-platform as of {AS_OF}. Work in development is counted as '
                'not delivered. Scores: 2 supported end to end, 1 partly supported, 0 not supported.')
    ws['A2'].font = NOTE_FONT
    ws.merge_cells('A2:F2')
    ws['A2'].alignment = WRAP
    ws.row_dimensions[2].height = 30
    header(ws, 4, ['Headline', 'Value', 'Basis'], [46, 14, 70])
    c = res['counts']
    rows = [
        ('Overall Philippine process fit', res['overall'] / 100, f"{c['l2']} L2 processes in 15 L1 areas, weighted 1 to 3"),
        ('Regulatory compliance fit (IC, BIR, NPC, AMLC)', res['regulatory'] / 100, f"{c['reg']} regulatory L2 processes"),
        ('Operational process fit', res['operational'] / 100, f"{c['ops']} operational L2 processes"),
        ('Broker practice fit', res['broker'] / 100, 'L2 processes that apply to a broker'),
        ('Captive agency practice fit', res['agent'] / 100, 'L2 processes that apply to an agency (no market placement)'),
        ('Fit once work in development lands', res['overall_with_dev'] / 100, f"{c['dev']} L2 processes covered by work in development, counted at 2"),
        ('Insurance Commission items', res['by_authority']['IC'] / 100, 'Regulatory items of the Insurance Commission'),
        ('BIR items', res['by_authority']['BIR'] / 100, 'Taxes, receipts, books and forms'),
        ('NPC items (Data Privacy Act)', res['by_authority']['NPC'] / 100, 'Consent, rights, security, retention'),
        ('AMLC items (AMLA)', res['by_authority']['AMLC'] / 100, 'Customer due diligence, screening, reporting'),
        ('L2 processes scored 2 / 1 / 0', f"{c['two']} / {c['one']} / {c['zero']}", ''),
    ]
    for i, r in enumerate(rows, 5):
        put(ws, i, r, center_cols=(2,))
        if isinstance(r[1], float):
            ws.cell(row=i, column=2).number_format = '0.0%'
        ws.cell(row=i, column=1).font = BOLD

    r0 = 5 + len(rows) + 2
    ws.cell(row=r0 - 1, column=1, value='Fit by L1 process area').font = BOLD
    header(ws, r0, ['L1 process area', 'Fit %', 'L2 count (2 / 1 / 0)'], [None, None, None])
    for k, d in res['by_l1'].items():
        rr = r0 + k
        put(ws, rr, [f'{k}. {L1[k]}', d['fit'] / 100, f"{d['n']} ({d['two']} / {d['one']} / {d['zero']})"], center_cols=(2,))
        ws.cell(row=rr, column=2).number_format = '0.0%'
    last = r0 + len(res['by_l1'])
    ch = BarChart()
    ch.type = 'bar'
    ch.style = 10
    ch.title = 'Philippine process fit by L1 area'
    ch.y_axis.title = 'Fit'
    ch.y_axis.number_format = '0%'
    ch.y_axis.scaling.min = 0
    ch.y_axis.scaling.max = 1
    ch.add_data(Reference(ws, min_col=2, min_row=r0, max_row=last), titles_from_data=True)
    ch.set_categories(Reference(ws, min_col=1, min_row=r0 + 1, max_row=last))
    ch.legend = None
    ch.dataLabels = DataLabelList()
    ch.dataLabels.showVal = True
    ch.height, ch.width = 11, 18
    ch.x_axis.scaling.orientation = 'maxMin'
    ch.series[0].graphicalProperties.solidFill = NAVY
    ws.add_chart(ch, 'E4')

    r1 = last + 3
    ws.cell(row=r1 - 1, column=1, value='ASEAN rollout: change needed against the Philippine product').font = BOLD
    header(ws, r1, ['Country', 'Change % (range)', 'Midpoint %', 'Effort (calendar weeks, team of 5)', 'Rank'], [None, None, 12, 22, 8])
    for n, cc in enumerate(res['country_order'], 1):
        d = res['countries'][cc]
        put(ws, r1 + n, [COUNTRIES[cc]['name'], f"{d['lo']} to {d['hi']}%", d['mid'], f"{d['wk_lo']} to {d['wk_hi']}", d['rank']],
            center_cols=(2, 3, 4, 5))
    lastc = r1 + len(res['country_order'])
    ch2 = BarChart()
    ch2.type = 'col'
    ch2.style = 10
    ch2.title = 'Change needed by country (midpoint %)'
    ch2.y_axis.number_format = '0'
    ch2.add_data(Reference(ws, min_col=3, min_row=r1, max_row=lastc), titles_from_data=True)
    ch2.set_categories(Reference(ws, min_col=1, min_row=r1 + 1, max_row=lastc))
    ch2.legend = None
    ch2.dataLabels = DataLabelList()
    ch2.dataLabels.showVal = True
    ch2.height, ch2.width = 9, 18
    ch2.series[0].graphicalProperties.solidFill = '2F6EBA'
    ws.add_chart(ch2, f'G{r1}')
    ws.freeze_panes = 'A5'

    # ---------------------------------------------------------------- PH Process Fit
    ws = wb.create_sheet('PH Process Fit')
    hdr = ['ID', 'L1 process area', 'L2 process', 'Applies to', 'Type', 'Weight (1-3)', 'Score (0-2)', 'Weighted score',
           'Max', 'Evidence (screen, setting, API, test)', 'Gap note', 'In development']
    header(ws, 1, hdr, [7, 26, 44, 10, 8, 9, 9, 10, 7, 60, 52, 12])
    r = 2
    cur = None
    for row in CATALOGUE:
        i, l1, name, applies, typ, w, s, ev, gap, fix, eff, dev = row
        if l1 != cur:
            cur = l1
            d = res['by_l1'][l1]
            vals = [str(l1), L1[l1], f'L1 subtotal: fit {d["fit"]}%', '', '', d['w'], '', d['got'], 2 * d['w'], '', '', '']
            put(ws, r, vals, center_cols=(6, 8, 9))
            for j in range(1, len(hdr) + 1):
                ws.cell(row=r, column=j).fill = L1_FILL
                ws.cell(row=r, column=j).font = BOLD
            r += 1
        put(ws, r, [i, L1[l1], name, applies, typ, w, s, f'=F{r}*G{r}', f'=2*F{r}', ev, gap, 'Yes' if dev else ''],
            center_cols=(1, 4, 5, 6, 7, 8, 9, 12))
        ws.cell(row=r, column=7).fill = SCORE_FILL[s]
        r += 1
    put(ws, r, ['', 'Total', f'Overall fit {res["overall"]}%', '', '', '', '', f'=SUMIF(A2:A{r-1},"*.*",H2:H{r-1})',
                f'=SUMIF(A2:A{r-1},"*.*",I2:I{r-1})', '', '', ''], center_cols=(8, 9))
    for j in range(1, len(hdr) + 1):
        ws.cell(row=r, column=j).font = BOLD
    ws.freeze_panes = 'D2'
    ws.auto_filter.ref = f'A1:{get_column_letter(len(hdr))}{r - 1}'

    # ---------------------------------------------------------------- Gaps Ranked
    ws = wb.create_sheet('Gaps Ranked')
    hdr = ['Rank', 'ID', 'L1 process area', 'L2 process', 'Type', 'Weight', 'Score', 'Impact', 'Gap', 'Fix type',
           'Effort', 'In development']
    header(ws, 1, hdr, [7, 7, 28, 44, 8, 8, 7, 8, 60, 14, 8, 12])
    for n, g in enumerate(res['gaps'], 2):
        put(ws, n, [g['rank'], g['id'], g['l1'], g['process'], g['type'], g['weight'], g['score'], g['impact'], g['gap'],
                    g['fix'], g['effort'], 'Yes' if g['dev'] else ''], center_cols=(1, 2, 5, 6, 7, 8, 10, 11, 12))
        ws.cell(row=n, column=7).fill = SCORE_FILL[g['score']]
    n = len(res['gaps']) + 3
    ws.cell(row=n, column=1, value=('Impact = weight x (2 - score), x 1.5 for a regulatory item. Effort: S up to 2 weeks, '
                                    'M 2 to 6 weeks, L over 6 weeks of one team, design to test. Ties ranked by smaller effort.')).font = NOTE_FONT
    ws.freeze_panes = 'C2'
    ws.auto_filter.ref = f'A1:{get_column_letter(len(hdr))}{len(res["gaps"]) + 1}'

    # ---------------------------------------------------------------- ASEAN Countries
    ws = wb.create_sheet('ASEAN Countries')
    hdr = ['Rank', 'Country', 'Insurance regulator', 'Broker regime', 'Tax on premium and commission', 'E-invoicing',
           'Language and script', 'Currency', 'Data privacy and residency', 'Motor compulsory scheme',
           'Accounting and tax reporting', 'Typical broker practice', 'Configuration %', 'Localisation %', 'Code %',
           'Language %', 'Overall change % (range)', 'Midpoint %', 'Person-weeks', 'Calendar weeks (team of 5)',
           'Main changes']
    header(ws, 1, hdr, [6, 14, 24, 34, 40, 30, 26, 10, 34, 34, 28, 30, 11, 11, 9, 9, 13, 10, 12, 13, 50])
    for n, cc in enumerate(res['country_order'], 2):
        k, d = COUNTRIES[cc], res['countries'][cc]
        put(ws, n, [d['rank'], k['name'], k['regulator'], k['broker'], k['tax'], k['einvoice'], k['language'],
                    k['currency'], k['privacy'], k['motor'], k['accounting'], k['practice'], d['layers']['C'],
                    d['layers']['L'], d['layers']['X'], d['language'], f"{d['lo']} to {d['hi']}%", d['mid'],
                    f"{d['pw_lo']} to {d['pw_hi']}", f"{d['wk_lo']} to {d['wk_hi']}", k['main']],
            center_cols=(1, 8, 13, 14, 15, 16, 17, 18, 19, 20))
    n = len(res['country_order']) + 3
    notes = [
        'Timor-Leste joined ASEAN in October 2025. Not scored: a very small insurance market supervised by the Banco Central de Timor-Leste, USD currency, Tetum and Portuguese. Treat as Lao PDR or higher if a prospect appears (to verify with a local partner).',
        'Country facts come from general knowledge of each regime and are marked "to verify" where uncertain. Confirm with local counsel or a partner before any commitment.',
        'Layer % = points of change on the whole product, from the ASEAN Heat Map sheet (L1 change x L1 weight). Language is added on top. Range = midpoint +/- uncertainty band.',
        f'Effort = {PW_PER_POINT} person-weeks per point of change (indicative), calendar weeks with a team of {TEAM}. Excludes the first client implementation.',
    ]
    for j, t in enumerate(notes):
        c = ws.cell(row=n + j, column=2, value=t)
        c.font = NOTE_FONT
    ws.freeze_panes = 'C2'

    # ---------------------------------------------------------------- ASEAN Heat Map
    ws = wb.create_sheet('ASEAN Heat Map')
    hdr = ['L1 process area', 'L1 weight'] + [COUNTRIES[c]['name'] for c in res['country_order']]
    header(ws, 1, hdr, [44, 9] + [13] * len(res['country_order']))
    heat_fill = lambda p: PatternFill('solid', fgColor='DCEFE3' if p <= 15 else 'FFF2CC' if p <= 35 else 'FBE0C2' if p <= 55 else 'F8D7DA')
    for k in sorted(L1):
        vals = [f'{k}. {L1[k]}', res['l1_weights'][k]] + [f"{HEAT[c][k][0]}% {HEAT[c][k][1]}" for c in res['country_order']]
        put(ws, k + 1, vals, center_cols=tuple(range(2, len(hdr) + 1)))
        for j, c in enumerate(res['country_order'], 3):
            ws.cell(row=k + 1, column=j).fill = heat_fill(HEAT[c][k][0])
    rr = len(L1) + 2
    put(ws, rr, ['Language layer (points added)', ''] + [res['countries'][c]['language'] for c in res['country_order']],
        center_cols=tuple(range(2, len(hdr) + 1)))
    put(ws, rr + 1, ['Overall change % (midpoint)', ''] + [res['countries'][c]['mid'] for c in res['country_order']],
        center_cols=tuple(range(2, len(hdr) + 1)))
    for j in range(1, len(hdr) + 1):
        ws.cell(row=rr + 1, column=j).font = BOLD
    ws.cell(row=rr + 3, column=1, value='Cell = share of the L1 area that changes, and the main layer: C configuration, '
            'L localisation of masters, tax rules and forms, X code (regulatory reports, e-invoicing and other integrations).').font = NOTE_FONT
    ws.freeze_panes = 'B2'

    # ---------------------------------------------------------------- Method and Sources
    ws = wb.create_sheet('Method and Sources')
    header(ws, 1, ['Topic', 'Method or source'], [30, 120])
    method = [
        ('Question', 'How far BrokerVerse fits the practice of a Philippine non-life broker (and a captive agency) today, where it is strongest, what to improve, and how much change other ASEAN countries need.'),
        ('Baseline', f'Code on branch brokerverse-platform as of {AS_OF}. Work in development (menu, audit trail screen, Philippine masters: Province instead of State, PSGC geography, PH banks, IDs and salutations, IC non-life insurer list; My Work; Product Configurator connections; branding and e-signature; masking; comparison report) is counted as not delivered.'),
        ('Catalogue', f"{res['counts']['l2']} L2 processes in 15 L1 areas, written from Philippine broking practice: Insurance Code (RA 10607) and IC rules, NIRC and EOPT Act (RA 11976) with RR 7-2024, Data Privacy Act (RA 10173) and NPC rules, AMLA (RA 9160 as amended), Financial Consumer Protection Act (RA 11765), LTO and CTPL practice."),
        ('Weight', '3 = core to daily operation or a legal obligation with penalties; 2 = important; 1 = useful or occasional.'),
        ('Score', '2 = supported out of the box end to end and evidenced by a screen and a test or the UAT run; 1 = partly supported, needs a workaround, a procedure or configuration not yet present; 0 = not supported. Screens that do not complete the process get no credit.'),
        ('Fit %', 'Sum of weight x score divided by the sum of weight x 2, per L1 and overall. Regulatory fit uses the L2 typed IC, BIR, NPC or AMLC; operational fit uses the L2 typed Ops.'),
        ('Gap ranking', 'Impact = weight x (2 - score), times 1.5 for a regulatory item; ties ranked by smaller effort. Effort S up to 2 weeks, M 2 to 6 weeks, L over 6 weeks for one team.'),
        ('ASEAN method', 'For each country and L1 area: share of the area that changes and its main layer (configuration, localisation, code). Weighted by the L1 weight of the Philippine catalogue. A language layer is added for UI and documents. Ranges reflect uncertainty; facts marked "to verify" are to be confirmed with local counsel or a partner.'),
        ('Accelerators found in the code', 'i18n framework and language picker (brokerverse/src/i18n.js, utility/languages.js); th.json with 4,675 of 7,917 keys in Thai, withdrawn from the pickers; base currency and dated exchange rates (migration 0235); premium tax engine with rule kinds vat, premium_tax, dst, fst, lgt and other (percent, per unit, flat; lines, regimes, dates) in modules/premium-charges; posting rules and account determination; Master > Configuration settings; document numbering; address API country > province > city > district with postal code lookup; payment gateway providers; bank and insurer statement formats; Singapore hosting region.'),
        ('Inhibitors found in the code', 'BIR reports and Form 2307 layout are Philippine-specific (modules/reports/periodEndQueries.js); motor quotation built around CTPL and the IC vehicle classes; KYC ID defaults; Asia/Manila business time zone in 9 backend files; PHP defaults in document templates; premium tax kinds named after Philippine taxes; LGU tax master.'),
        ('Sources in the repository', 'backend/src/modules (46 modules); backend/src/db/migrations; backend/test (79 test files); backend/scripts/uat-scenario.js and docs/e2e/UAT_SCENARIO_RUN.md (371 steps passed); docs/e2e/GOLIVE_REHEARSAL_RUN.md (51 checks passed); brokerverse/src/components/SideBar/list.js; brokerverse/src/locales; docs/package/source/ph-regulatory-compliance-matrix.md, product-functionality.md, test-summary.md, user-manual.md.'),
        ('Limits', 'This is a product assessment, not legal or tax advice. Country facts are general knowledge as of the assessment date and must be verified. Effort figures are indicative bands for planning, not quotations.'),
        ('Rebuild', 'cd docs/package/tools && python3 build_fit_assessment_xlsx.py (the catalogue and estimates are in that script).'),
    ]
    for i, (a, b) in enumerate(method, 2):
        put(ws, i, [a, b])
        ws.cell(row=i, column=1).font = BOLD
    ws.freeze_panes = 'A2'

    for s in wb.worksheets:
        s.sheet_view.zoomScale = 90
    os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
    wb.save(OUT)


if __name__ == '__main__':
    result = compute()
    build(result)
    if SUMMARY_JSON:
        with open(SUMMARY_JSON, 'w') as f:
            json.dump(result, f, indent=1, default=str)
    print(f"overall {result['overall']}%, regulatory {result['regulatory']}%, operational {result['operational']}%, "
          f"broker {result['broker']}%, agent {result['agent']}%, with development {result['overall_with_dev']}%")
    print('authorities', result['by_authority'])
    print('counts', result['counts'])
    for k, d in result['by_l1'].items():
        print(f"{k:2} {L1[k]:52} {d['fit']:5}%  n={d['n']} w={d['w']} ({d['two']}/{d['one']}/{d['zero']})")
    for g in result['gaps'][:15]:
        print(g['rank'], g['id'], g['impact'], g['effort'], g['fix'], g['process'])
    for c in result['country_order']:
        d = result['countries'][c]
        print(c, d['rank'], d['mid'], f"{d['lo']}-{d['hi']}", d['layers'], d['language'], f"wk {d['wk_lo']}-{d['wk_hi']}")
    print('saved', OUT)
