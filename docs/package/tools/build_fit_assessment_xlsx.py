"""Builds the Philippine process fit and ASEAN rollout assessment workbook (INTERNAL, management positioning):

    python3 build_fit_assessment_xlsx.py [../08_Management/BrokerVerse_PH_Fit_and_ASEAN_Rollout_Assessment.xlsx] [summary.json]

Sheets: Summary, PH Process Fit, Gaps Ranked, ASEAN Countries, ASEAN Heat Map, Method and Sources.

The process catalogue (CATALOGUE) and the country estimates (COUNTRIES, HEAT) below are the single source of the
numbers. The document source/ph-fit-and-asean-rollout-assessment.md quotes the figures this script prints; when a
score changes here, run the script and update the document from its output.

Scores (version 1.1, re-scored on branch brokerverse-platform as of 04 October 2026 with every release package
merged; version 1.0 of the same date was the pre-release assessment):
  2 = supported out of the box end to end, evidenced by a screen, a module and a test; 1 = partly supported (no screen,
  or a report whose official layout the regulator must confirm); 0 = not supported. An integration scores 2 only with a
  connector with configurable provider, a test mode exercised by the tests, an outbox with retry and a manual or file
  fallback; the gap note says what certification remains with the partner. Weight 1 to 3 = importance to a Philippine
  non-life broker.
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
# Dev = True when the gap is covered by work in development (none in this release: every package is merged).
# (id, L1, process, applies, type, weight, score, evidence, gap note, fix type, effort, dev)
CATALOGUE = [
    # 1 Client onboarding, KYC and AML
    ('1.01', 1, 'Individual client record with Philippine address, mobile and TIN', 'Both', 'Ops', 3, 2,
     'Operations > Clients > Onboard client (/agent/clientlisting); modules/aml/kyc.js, modules/addresses; PSGC masters (migration 0250, seed 12_ph_geography.sql: 18 regions, 82 provinces, 1,642 cities and municipalities, barangays, ZIP codes); aml.test.js (client onboarding before the first policy), addresses.test.js, clients.test.js',
     '', '', '', False),
    ('1.02', 1, 'Corporate client with TIN, registered name and authorised signatories', 'Both', 'AMLC', 2, 2,
     'Onboard client > Juridical (SEC, DTI or CDA registration, signatories with board resolution or secretary\'s certificate); table aml_client_signatories (migration 0260); aml.test.js (onboards a juridical client with registration, signatories, beneficial owners and the board resolution)',
     '', '', '', False),
    ('1.03', 1, 'Customer identification: government ID type, number and image', 'Both', 'AMLC', 3, 2,
     'Onboard client > Government ID presented (Government ID Type master, seed 69_ph_practice_masters.sql) and KYC documents upload; policy issue KYC (policy.kyc_required_fields, policy.kyc_id_types); aml.test.js, policies.test.js',
     '', '', '', False),
    ('1.04', 1, 'Risk-based customer due diligence rating and enhanced due diligence', 'Both', 'AMLC', 2, 2,
     'Compliance > Client Due Diligence, EDD Reviews, KYC Refresh; modules/aml/risk.js (configurable factors and thresholds, aml.risk_low_max_score / risk_high_min_score, PEP always High), EDD review maker-checker, aml.block_issue_pending_edd, job aml-kyc-refresh-due; aml.test.js (risk-based CDD, EDD and KYC refresh)',
     '', '', '', False),
    ('1.05', 1, 'Beneficial ownership of juridical clients', 'Both', 'AMLC', 2, 2,
     'Onboard client > Add beneficial owner (aml.beneficial_owner_threshold 25%, senior managing official fallback); table aml_beneficial_owners (migration 0260); owners screened with the client; aml.test.js',
     '', '', '', False),
    ('1.06', 1, 'Sanctions, PEP and negative list screening', 'Both', 'AMLC', 2, 2,
     'Compliance > Screening Lists (UN consolidated XML, AMLC and ATC designations, PEP, internal negative list, versioned uploads with rescreen), Screening Hits (clear, escalate, confirm); modules/aml/screening.js, matching.js, providers.js (uploaded lists, test provider, provider API with retry job aml-provider-retry); screening at onboarding, policy issue, list update, refund approval and claim payment (aml.screening_block_events); aml.test.js (sanctions, PEP and negative list screening)',
     'No list content is delivered: the broker loads the UN, AMLC and PEP lists it is entitled to use. A commercial screening provider, when used, is connected through the provider adapter and certified with that provider.', '', '', False),
    ('1.07', 1, 'Covered and suspicious transaction monitoring and AMLC reporting', 'Both', 'AMLC', 2, 1,
     'Compliance > Transaction Alerts (six rules, job aml-transaction-monitoring), AML Cases (STR and CTR cases, due dates in working days), AMLC Reports (CTR and STR files, filing record); modules/aml/monitoring.js, cases.js, reports.js; aml.test.js (covered and suspicious transactions, cases and AMLC reports)',
     'Monitoring, alerts and cases are delivered end to end. The report file is the product\'s own layout BV-AMLC-TXN 1.0 built after the AMLC reporting guidelines; the institution code, transaction codes, ID type codes and field order must be confirmed against the AMLC\'s current guidelines and a test file validated in the AMLC portal before the first filing. Scored 1 until that confirmation.',
     'Regulator confirmation', 'S', False),
    ('1.08', 1, 'KYC and transaction record retention (5 years or more)', 'Both', 'AMLC', 1, 2,
     'aml.record_retention_years (5) blocks anonymisation; privacy.retention_years 10; business records never deleted by housekeeping; aml.test.js (keeps AML records for 5 years), privacy.test.js', '', '', '', False),
    ('1.09', 1, 'Single client view across policies, claims, renewals and endorsements', 'Both', 'Ops', 2, 2,
     'Clients > client view tabs Policy, Claim, Renewal, Endorsement, Data privacy, Activities, Identification and due diligence; clients.test.js; UAT scenario retail and corporate phases', '', '', '', False),
    ('1.10', 1, 'Privacy notice and consent per purpose at onboarding', 'Both', 'NPC', 3, 2,
     'Data privacy tab on client and prospect; Master > Data Privacy > Consent Register; consent checked by campaigns and SMS; privacy.test.js, campaigns.test.js, integrations.test.js', '', '', '', False),

    # 2 Prospecting and sales pipeline
    ('2.01', 2, 'Lead capture by line (motor, fire, IAR, employee benefits), retail or corporate, with bulk upload', 'Both', 'Ops', 2, 2,
     'Sales & Marketing > Prospects (/agent/leadlisting); POST /leads/bulk-upload; leads.test.js', '', '', '', False),
    ('2.03', 2, 'Lead status pipeline and conversion funnel', 'Both', 'Ops', 2, 2,
     'Lead statuses New to Converted or Lost (a first activity moves New to Contacted); Lead Conversion Funnel report; reports.test.js, sales-activities.test.js', '', '', '', False),
    ('2.04', 2, 'Sales activities: calls, meetings, follow-up tasks and reminders', 'Both', 'Ops', 2, 2,
     'Activities timeline on prospect, client and quotation (Log activity); Sales & Marketing > Sales Activities (/sales/activities) with the Activity Report; Master > Organization > Sales Activity Types and Outcomes; next step becomes a My Work task; modules/sales-activities (migration 0320); sales-activities.test.js',
     '', '', '', False),
    ('2.05', 2, 'Lead assignment to account executives and team visibility', 'Both', 'Ops', 2, 2,
     'Sales & Marketing > Lead Assignment (/sales/lead-assignment): Team View by reporting line, Queue with bulk reassignment, Assignment Rules (round robin, fewest open, fixed); modules/leads (migration 0300); lead-assignment.test.js; My Work > My Team',
     '', '', '', False),
    ('2.06', 2, 'Sales targets and sales dashboard', 'Both', 'Ops', 2, 2,
     'Dashboard > Sales Dashboard; dashboard.targets; dashboard.test.js', '', '', '', False),
    ('2.07', 2, 'Dealer, bank and affinity channel referrals (captive agency, motor dealer branches)', 'Agent', 'Ops', 2, 2,
     'Master > Insurance Management > Distribution Channels (dealers with branches, financing banks with mortgagee clause, affinity partners; migration 0301); Sales & Marketing > Dealer Programmes; Reports > Dealer Production; distribution-channels.test.js, motor-programmes.test.js',
     '', '', '', False),
    ('2.08', 2, 'Marketing campaigns to consenting clients', 'Both', 'Ops', 1, 2,
     'Sales & Marketing > Campaigns (/sales/campaigns): segments, templates, send through the e-mail outbox, opt-out link to the consent register, results; job campaign-dispatch; modules/campaigns (migration 0307); campaigns.test.js',
     '', '', '', False),

    # 3 Quotation and insurer comparison
    ('3.01', 3, 'Quick quote of packaged products from insurer rate tables', 'Both', 'Ops', 2, 2,
     'Sales & Marketing > Quick Quote; Master > Finance > Insurer Rate Tables; packages.test.js', '', '', '', False),
    ('3.02', 3, 'Side-by-side comparison of insurers on screen', 'Broker', 'Ops', 3, 2,
     'Sales & Marketing > Compare Insurers (/sales/compare-insurers); packages.test.js', '', '', '', False),
    ('3.03', 3, 'Client-facing comparison and recommendation report', 'Broker', 'Ops', 2, 2,
     'Sales & Marketing > Comparison Reports (/sales/comparison-reports): prepared from RFQ offers or quotations, recommendation and reasons, branded PDF without commission, e-mailed through the outbox, client\'s choice recorded; modules/comparison-reports (migration 0306, series CMP); comparison-reports.test.js',
     '', '', '', False),
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
     'Approval through the live e-mail link is exercised with the recorded responses in the test environment (no SMTP).', '', '', False),
    ('3.09', 3, 'Quotation validity, expiry and maker-checker', 'Both', 'Ops', 1, 2,
     'limits.quote_validity_days; Quotation expiry job; workflow.quote_maker_checker; quotations.test.js', '', '', '', False),
    ('3.10', 3, 'Electronic signature of proposal and acceptance', 'Both', 'Ops', 1, 2,
     'My Profile > My e-signature (captured with consent, versioned); Master > System Settings > Theme and Branding > document signature slots print the signatures on issued documents (drafts carry UNSIGNED DRAFT); client acceptance recorded through the signed approval link; modules/e-signatures (migration 0254); branding.test.js (e-signatures), customer-response.test.js',
     'The client\'s acceptance is recorded by the signed link and the comparison report\'s recorded choice, not by a drawn signature of the client.', '', '', False),
    ('3.11', 3, 'Product rules from the Product Configurator drive the quotation', 'Both', 'Ops', 2, 2,
     'Quotation wizard takes the covers of the Coverage Builder and the risk fields of the acceptance rules and rating factors of the governing template (motor.pricing_template_code); referrals to the rule\'s authority, loadings, market mapping on RFQ, document templates with merge fields; modules/product-configurator, modules/quotations (migrations 0252, 0322); quote-covers-risk-fields.test.js, product-rules-in-flow.test.js',
     '', '', '', False),

    # 4 RFQ, placement, co-insurance and reinsurance
    ('4.01', 4, 'Request for Quotation (broker slip) to several insurers by e-mail', 'Broker', 'Ops', 3, 2,
     'Sales & Marketing > Request for Quotation (/placement/broker-slips); request-for-quotation.test.js', '', '', '', False),
    ('4.02', 4, 'Record insurer offers and declines with terms', 'Broker', 'Ops', 3, 2,
     'Broker slip offers (Offered, Declined, Pending); request-for-quotation.test.js', '', '', '', False),
    ('4.03', 4, 'Compare offers, best offer, market capacity and hit ratio per insurer', 'Broker', 'Ops', 3, 2,
     'Request for Quotation > Compare offers; Market Response and Placement Pipeline reports; request-for-quotation.test.js; reports.test.js', '', '', '', False),
    ('4.04', 4, 'Placement slip to lead and co-insurers with confirmation per insurer', 'Broker', 'Ops', 3, 2,
     'Sales & Marketing > Placement Slips (/placement/placement-slips); placement.test.js', '', '', '', False),
    ('4.05', 4, 'Co-insurance shares, payables and taxes split per participant', 'Broker', 'Ops', 3, 2,
     'Co-insurance Register; Due to Insurers by Co-insurer; placement.test.js; remittance.test.js', '', '', '', False),
    ('4.06', 4, 'Placement journey rules per line of business', 'Broker', 'Ops', 2, 2,
     'placement.journey (Master > Configuration); modules/placement/journey.js; placement.test.js', '', '', '', False),
    ('4.07', 4, 'Cover note or binder while the policy is pending', 'Both', 'Ops', 2, 2,
     'Operations > Cover Notes (/operations/cover-notes): issued from an accepted quotation or a sent or bound placement slip, CVN series, letterhead print, e-mail, superseded by the policy, daily expiry job; modules/cover-notes (migration 0290); ops-accounting.test.js (cover notes)',
     '', '', '', False),
    ('4.08', 4, 'Placement only with insurers authorised by the IC', 'Both', 'IC', 2, 2,
     'Insurance Company master fields IC Certificate of Authority No. and Valid Until (IC non-life insurer list seeded, 69_ph_practice_masters.sql); Compliance > Insurance Commission > Insurer Authority; check at RFQ, firm order and policy issue (compliance.insurer_authority_check warn or block, migration 0271); ic-compliance.test.js (insurers authorised by the IC)',
     'Delivered as warn: the broker enters the certificate numbers of the insurers it works with, then switches the setting to block.', '', '', False),
    ('4.10', 4, 'Facultative reinsurance placement (where the broker acts as reinsurance broker)', 'Broker', 'Ops', 1, 2,
     'Reinsurance > Facultative Placements (/reinsurance/facultative): slip for the cedant, sent to reinsurers, lines accepted to 100%, binding books premium due, net due to reinsurers and brokerage, settlements, bordereau; modules/reinsurance (migration 0305); facultative-reinsurance.test.js',
     '', '', '', False),
    ('4.11', 4, 'Reinsurance recoveries and reinsurer statement reconciliation', 'Broker', 'Ops', 1, 2,
     'Reinsurance > Claims Recovery, Reconciliation; reinsurance.test.js', '', '', '', False),

    # 5 Policy issuance, documents and motor
    ('5.01', 5, 'Issue policy from bound placement or accepted quotation, create client, bill premium; policy statuses', 'Both', 'Ops', 3, 2,
     'Operations > Policy; quote-to-policy.test.js; policies.test.js; UAT scenario 433 steps passed', '', '', '', False),
    ('5.02', 5, 'Record a policy already issued by the insurer', 'Both', 'Ops', 3, 2,
     'Placement Slips > Record Issued Policy; placement.test.js', '', '', '', False),
    ('5.03', 5, 'Policy schedule and documents generated and e-mailed to the client', 'Both', 'Ops', 3, 2,
     'Policy issued e-mail with schedule PDF on the branded letterhead; product document templates with merge fields (Product Configurator > Document Manager); printing.test.js; email-documents.test.js; product-rules-in-flow.test.js; branding.test.js', '', '', '', False),
    ('5.04', 5, 'Upload of the insurer policy document and attachments', 'Both', 'Ops', 2, 2,
     'Policy details > documents (PDF or image, 10 MB); policies.test.js', '', '', '', False),
    ('5.05', 5, 'Motor details: chassis, motor, plate or MV file number, mortgagee, photos', 'Both', 'Ops', 3, 2,
     'Motor policy issue (policy.kyc_required_fields); policies.test.js', '', '', '', False),
    ('5.06', 5, 'CTPL tariff per vehicle class, 1-year and 3-year, never discounted', 'Both', 'IC', 3, 2,
     'Product Configurator MOT-003-2025 CTPL & Auto PA tab; motor-tariff.test.js', '', '', '', False),
    ('5.07', 5, 'CTPL certificate of cover authentication with the IC-accredited system and LTO', 'Both', 'IC', 3, 2,
     'Operations > CTPL Authentication (/operations/ctpl-authentication): COC series per insurer, COC number allocated at issue, authentication request through connector CTPL_AUTH (test mode delivered), code printed on the schedule, keyed-in code as fallback, LTO_FEED connector, unauthenticated report; outbox with retry (Master > Integrations); modules/integrations/ctpl.js (migration 0312); integrations.test.js (CTPL authentication)',
     'Certification that remains with the partner: the accredited provider\'s acceptance of the live requests and, where the provider does not transmit to the LTO, the LTO interface. Until then the keyed-in code from the provider portal is the fallback.', '', '', False),
    ('5.08', 5, 'Brand-new vehicle programme: dealer sale, financing bank mortgagee clause, free first-year cover', 'Agent', 'Ops', 2, 2,
     'Sales & Marketing > Dealer Programmes (/sales/dealer-programmes): programme terms, who pays, Dealer Sales upload creating prospect, quotation and policy per sale, bank endorsement letter printed and e-mailed; modules/motor-programmes (migration 0302); motor-programmes.test.js',
     '', '', '', False),
    ('5.09', 5, 'Bulk issuance: fleet schedules and group policies', 'Both', 'Ops', 2, 2,
     'Operations > Fleet Schedules (/operations/fleet-schedules): per-vehicle pricing, Fleet Vehicles upload, one policy for the total, vehicles added or deleted by endorsement pro-rata, schedule print; modules/fleet (migration 0303); fleet-schedules.test.js; policy bulk upload for the in-force book (upload-templates.test.js)',
     '', '', '', False),
    ('5.11', 5, 'Lines placed: motor, fire, IAR, CAR, EAR, marine, CGL, money, PA, travel, EB, surety', 'Both', 'Ops', 2, 2,
     'UAT data set issued 62 new policies across these lines (test-summary.md, UAT data set)', '', '', '', False),
    ('5.12', 5, 'Marine open cover with certificates and declarations', 'Broker', 'Ops', 1, 2,
     'Operations > Marine Open Covers (/operations/open-covers): contract with rates and limits per conveyance, open policy, certificates with mark-up and minimum premium, monthly declaration billed on the open policy; modules/marine (migration 0304); marine-open-cover.test.js',
     '', '', '', False),

    # 6 Endorsements and cancellations
    ('6.01', 6, 'Motor endorsements: personal details, motor details, coverage change, extension', 'Both', 'Ops', 3, 2,
     'Operations > Policy > Endorsement; endorsements.test.js', '', '', '', False),
    ('6.02', 6, 'Non-motor endorsements: premium change', 'Both', 'Ops', 2, 2,
     'Fire and allied perils Regular / Premium Change; endorsements.test.js', '', '', '', False),
    ('6.03', 6, 'Re-pricing of coverage change with taxes on the server', 'Both', 'Ops', 2, 2,
     'endorsements.test.js (premium delta priced on the server; refuses a mismatched delta)', '', '', '', False),
    ('6.04', 6, 'Cancellation full, partial or pro-rata with return premium computed', 'Both', 'Ops', 3, 2,
     'Operations > Policy Cancellation (/operations/policy-cancellation): return premium computed on the server from the days left (pro-rata, short-period or flat by cancellation reason), taxes returned per endorsements.cancellation_returned_taxes, commission clawback, partial cancellation; modules/cancellations (migration 0291); ops-accounting.test.js (cancellation return premium)',
     '', '', '', False),
    ('6.05', 6, 'Short-period rate scale when the insured cancels', 'Both', 'Ops', 2, 2,
     'Master > Insurance Management > Short-Period Rates (/master/insurance/short-period-rates) and Cancellation Reasons; endorsements.short_period_for_insured; ops-accounting.test.js (short-period scale)',
     '', '', '', False),
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
    ('7.04', 7, 'At-risk scoring, retention analytics, lapse management and win-back', 'Both', 'Ops', 1, 2,
     'Renewals > At-Risk Policies, Retention Analytics, Lapse Management, Performance; renewals.grace_period_days; renewals.test.js', '', '', '', False),
    ('7.06', 7, 'Renewal of placed and co-insured risks through the placement journey', 'Broker', 'Ops', 2, 2,
     'placement.journey_applies_to_renewals; placement.test.js', '', '', '', False),
    ('7.07', 7, 'Renewal notices by SMS or messaging app', 'Both', 'Ops', 1, 2,
     'Master > System Configuration > Message Templates (RENEWAL_NOTICE, PAYMENT_REMINDER, CLAIM_UPDATE, Viber variant) with consent check; connectors SMS_SEMAPHORE (test mode delivered), SMS_GLOBE_LABS, SMS_GENERIC, VIBER_BUSINESS; jobs sms-renewal-notices and sms-payment-reminders; outbox with retry; modules/integrations/messaging.js (migration 0311); integrations.test.js (messaging)',
     'Certification that remains with the partner: the SMS gateway contract, sender name or short code and the live credentials; the jobs are delivered switched off until the connector is live.', '', '', False),

    # 8 Billing, collection, credit control and receipts
    ('8.01', 8, 'Premium bill on issue, endorsement and renewal; invoice e-mailed', 'Both', 'Ops', 3, 2,
     'INV series; E-mail invoice; receipts.test.js; email-documents.test.js', '', '', '', False),
    ('8.02', 8, 'Payment capture (cash, cheque, transfer, online) with proof for verification', 'Both', 'Ops', 3, 2,
     'Operations > Payments; payments.test.js; policy-payments.test.js; payment-segregation.test.js', '', '', '', False),
    ('8.03', 8, 'Official receipt posting by Accounting, partial payments, bulk upload and bulk print', 'Both', 'Ops', 3, 2,
     'Accounts > Receipts; receipts bulk upload (1,000 rows) and Bulk Print; receipts.test.js', '', '', '', False),
    ('8.04', 8, 'Receipt numbering continuity and printing on letterhead with TIN', 'Both', 'BIR', 2, 2,
     'Master > Document Numbering; numbering.test.js; printing.test.js; receipts.document_title', '', '', '', False),
    ('8.05', 8, 'Returned cheques (DAIF, DAUD) cancel the receipt and reopen the bill', 'Both', 'Ops', 2, 2,
     'Bank transaction types; receipts.test.js; bank-reconciliation.test.js; post-dated cheque bounce (ops-accounting.test.js)', '', '', '', False),
    ('8.06', 8, 'Online payment links with automatic receipt', 'Both', 'Ops', 2, 2,
     'Payment links (PayMongo, Dragonpay, sandbox provider); payments.test.js',
     'Tested with the sandbox provider; live keys are a go-live task.', '', '', False),
    ('8.07', 8, 'Receivables ageing and automatic collection reminders', 'Both', 'Ops', 3, 2,
     'Accounts > Collections; Collection reminders job; collections.test.js', '', '', '', False),
    ('8.08', 8, 'Premium payment warranty and credit terms per insurer (Insurance Code, IC rules)', 'Both', 'IC', 3, 2,
     'Insurance Company > Premium Payment Warranty; Premium Warranty Monitor; claims.block_unpaid_premium; credit-control.test.js', '', '', '', False),
    ('8.09', 8, 'Instalment billing with separate instalment invoices', 'Both', 'Ops', 2, 2,
     'Accounts > Credit Control > Instalment Plans > Issue instalment invoices (credit.instalment_invoices_on_save): one bill per instalment with its own invoice number, due date, journal and collection item; migration 0293; ops-accounting.test.js (separate instalment invoices); credit-control.test.js',
     '', '', '', False),
    ('8.10', 8, 'Client credit limits with exception notice', 'Both', 'Ops', 1, 2,
     'Accounts > Credit Control > Client Credit Limits; credit-control.test.js', '', '', '', False),
    ('8.11', 8, 'Collection follow-up log, commitments and escalation', 'Both', 'Ops', 2, 2,
     'Collection items; promise to pay becomes a My Work task; collections.test.js; my-work.test.js', '', '', '', False),
    ('8.12', 8, 'Post-dated cheque register and deposit on due date', 'Both', 'Ops', 2, 2,
     'Accounts > Post-Dated Cheques (/accounts/post-dated-cheques): register against a bill, deposit due tab and daily job, deposit posts the receipt, cleared, bounced (receipt cancelled, client e-mailed), replace, return; modules/pdc (migration 0292); ops-accounting.test.js (post-dated cheque register)',
     '', '', '', False),

    # 9 Remittance, direct bill and insurer reconciliation
    ('9.01', 9, 'Remittance per insurer net of commission, by co-insurer share', 'Both', 'IC', 3, 2,
     'Accounts > Remittance > Automated Processing; remittance.test.js', '', '', '', False),
    ('9.02', 9, 'Remittance terms per insurer, due dates and remittance ageing', 'Both', 'IC', 3, 2,
     'Insurance Company > Remittance Terms; Credit Control > Remittance Ageing; remittance.test.js', '', '', '', False),
    ('9.03', 9, 'Remittance approval within Authority Matrix limits and settlement by payment voucher', 'Both', 'Ops', 2, 2,
     'Remittance > Approval Workflow, Settlement, Electronic Transfer; Authority Matrix; consolidation.test.js; remittance.test.js; disbursements.test.js', '', '', '', False),
    ('9.05', 9, 'Bank payment file (InstaPay, PESONet, bulk credit) for insurers and referrers', 'Both', 'Ops', 2, 2,
     'Accounts > Bank Payment Files (/accounts/bank-payment-files): batch of approved vouchers, maker-checker within the Authority Matrix, file written from Master > Finance > Bank File Layouts (delimited or fixed width; starter layouts BDO, BPI, Metrobank, Landbank, UnionBank, generic CSV), status file import or Record result, payment journals; payee bank accounts; connector BANK_FILES with outbox and inbox; modules/integrations/bankfiles (migration 0314); integrations.test.js (bank payment files)',
     'Certification that remains with the partner: each bank validates the layout against its current file specification and accepts a test file during onboarding; the starter layouts are marked Test mode until then. Record result is the manual fallback.', '', '', False),
    ('9.06', 9, 'Direct bill commission debit notes with VAT and EWT', 'Both', 'BIR', 3, 2,
     'Remittance > Direct Bill Processing; direct-bill.test.js; direct-bill-client-payments.test.js', '', '', '', False),
    ('9.07', 9, 'Agency bill processing', 'Agent', 'Ops', 2, 2,
     'Remittance > Agency Bill Processing (/finance/remittance/agencybill); remittance.test.js', '', '', '', False),
    ('9.08', 9, 'Insurer statement of account import, matching and differences', 'Both', 'Ops', 2, 2,
     'Accounts > Insurer Reconciliation > Insurer Statements; insurer-reconciliation.test.js', '', '', '', False),
    ('9.09', 9, 'Insurer system integration (policy, premium, claims data by API)', 'Both', 'Ops', 1, 2,
     'Master > System Configuration > Insurer Integration (/master/configuration/insurer-integration): mapping per insurer (broker code, product codes, issuance request and answer maps, claim statuses), requests for policy issuance, policy and premium data (tolerance flag) and claim status, signed inbox for pushed statuses, claim status CSV as fallback; connector INSURER_API (test mode delivered); modules/integrations/insurer.js (migration 0313); integrations.test.js (insurer system integration)',
     'Certification that remains with the partner: each insurer\'s API contract, endpoint, credentials and field mapping are agreed and tested with that insurer; files and e-mail remain the fallback.', '', '', False),

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
     'Generate payout; Disbursement > Bulk Disburse; bank payment file for referrer payouts; disbursements.test.js; integrations.test.js', '', '', '', False),
    ('10.07', 10, 'Commission statements for referrers and the broker', 'Both', 'Ops', 2, 2,
     'Broker Commission Statement; Commission Dashboard; reports.test.js', '', '', '', False),
    ('10.08', 10, 'Incentive programmes for account executives', 'Both', 'Ops', 1, 2,
     'Incentive > My Programs, Calculations, Approvals, Statement; incentive.test.js', '', '', '', False),
    ('10.09', 10, 'Licence check of agents and sub-agents before paying commission', 'Both', 'IC', 2, 2,
     'Compliance > Insurance Commission > Licence Register (holder type Agent / referrer); compliance.referrer_licence_check block (delivered), warn or off on Approve, Generate payout and payout voucher approval for compliance.licence_required_referrer_types; migration 0270; ic-compliance.test.js (commission payout needs a licence in force)',
     '', '', '', False),
    ('10.10', 10, 'Overriding, profit and contingent commission from insurers', 'Both', 'Ops', 1, 2,
     'Commission > Insurer Overrides > Agreements and Computations (/commission/insurer-overrides): tiers by production, loss ratio or growth, computation OVC series, approval posts the receivable, sales invoice, settlement with 2307; modules/insurer-overrides (migration 0284); insurer-overrides.test.js',
     '', '', '', False),

    # 11 Claims assistance
    ('11.01', 11, 'Claim registration with incident, driver, third party and documents', 'Both', 'Ops', 3, 2,
     'Operations > Claims (/agent/claim); claims.test.js', '', '', '', False),
    ('11.02', 11, 'Preliminary loss advice to the insurer by e-mail', 'Both', 'Ops', 3, 2,
     'Claim registration e-mail to insurer claims address; claims.test.js', '', '', '', False),
    ('11.03', 11, 'Claim document checklist per line and missing document follow-up', 'Both', 'Ops', 2, 2,
     'Operations > Claim Documents (/operations/claim-documents) from Master > Insurance Management > Claim Document Checklist by line and claim type; received, waived, remind the claimant (job Missing claim documents), submission to the insurer refused while a required document is missing; modules/claim-documents (migration 0294); ops-accounting.test.js (claim document checklist)',
     '', '', '', False),
    ('11.04', 11, 'Adjuster, insurer claim number, status tracking, handling time and claims reports', 'Both', 'Ops', 2, 2,
     'Claim statuses; claims.sla_days 20; Claims Dashboard; Claims Position, Claims Ageing; claim status by insurer API or file; claims.test.js; reports.test.js; integrations.test.js', '', '', '', False),
    ('11.05', 11, 'Settlement approval by a second user and claim letters (discharge voucher)', 'Both', 'Ops', 3, 2,
     'claims.settlement_maker_checker; Claims Discharge Voucher PDF; claims.test.js', '', '', '', False),
    ('11.06', 11, 'Claims paid through the broker: funds received and paid to claimant', 'Both', 'Ops', 2, 2,
     'Accounts > Claims Settlements (/accounts/claims-settlements): funds received (claim.funds_received), pay claimant with claim payment voucher CPV series (claim.paid_to_claimant), release form; claimant screened at payment; modules/claim-payments (migration 0294); ops-accounting.test.js (claims settlements from the Accounting menu); aml.test.js',
     '', '', '', False),
    ('11.07', 11, 'Co-insurer shares of claims and settlements', 'Both', 'Ops', 2, 2,
     'Claim screens show each insurer share; claims.test.js', '', '', '', False),
    ('11.08', 11, 'Motor claims: repair shop, estimate and letter of authority', 'Both', 'Ops', 2, 2,
     'Operations > Motor Claim Repairs (/operations/motor-claim-repairs): estimates of accredited shops (Master > Repair Shops), adjuster decision, letter of authority LOA series with participation and parts depreciation, supplementary letters, vehicle release; modules/motor-claims (migration 0295); ops-accounting.test.js (motor claim repairs)',
     '', '', '', False),

    # 12 Accounting, GL, period end and audit
    ('12.01', 12, 'Double-entry general ledger fed by posting rules, each journal traced to its source', 'Both', 'Ops', 3, 2,
     'Master > Finance > Posting Rules, Account Determination; General Ledger Detail, Journal Register; posting-rules.test.js; accounting-flow.test.js', '', '', '', False),
    ('12.02', 12, 'Philippine broker chart of accounts with premium trust account', 'Both', 'Ops', 2, 2,
     'Main Account, Sub Account masters; chart-of-accounts.test.js', '', '', '', False),
    ('12.03', 12, 'Journal, correction and reversal vouchers with approval', 'Both', 'Ops', 3, 2,
     'Accounts > Journal Voucher, Correction JV, Reversal JV; journal.test.js', '', '', '', False),
    ('12.04', 12, 'Payment vouchers, cheques and petty cash', 'Both', 'Ops', 3, 2,
     'Accounts > Disbursement, Petty Cash; disbursements.test.js', '', '', '', False),
    ('12.05', 12, 'Bank statement import, auto-match and reconciliation statement', 'Both', 'Ops', 3, 2,
     'Accounts > Bank Reconciliation; bank-reconciliation.test.js', '', '', '', False),
    ('12.06', 12, 'Month-end close with checklist, accruals and recurring journals', 'Both', 'Ops', 3, 2,
     'Accounts > Period End > Month-End Close (steps including depreciation); period-end.test.js; period-end-calendar.test.js; ops-accounting.test.js', '', '', '', False),
    ('12.07', 12, 'Year-end close and opening balances', 'Both', 'Ops', 2, 2,
     'Accounts > Period End > Year-End Close; period-end.test.js', '', '', '', False),
    ('12.08', 12, 'Financial statements: income statement, balance sheet, trial balance', 'Both', 'Ops', 3, 2,
     'Accounts > Period End > Financial Statements; reports.test.js', '', '', '', False),
    ('12.09', 12, 'Multi-currency transactions and FX revaluation', 'Both', 'Ops', 1, 2,
     'Master > Finance > Currency, Exchange Rate (migration 0235); period-end.test.js', '', '', '', False),
    ('12.10', 12, 'Supplier invoices, input VAT, fixed assets, depreciation and disposal', 'Both', 'Ops', 2, 2,
     'Accounts > Payables > Supplier Invoices, Supplier Payments, AP Ageing, Suppliers, Supplier 2307 (/accounts/payables); Accounts > Fixed Assets > Asset Register, Depreciation Run, Disposals (/accounts/fixed-assets); posting rules ap.invoice, ap.payment, fa.depreciation, fa.disposal; modules/payables, modules/fixed-assets (migrations 0296, 0297, 0321); ops-accounting.test.js (accounts payable, fixed asset register and depreciation), ap-2307-asset-disposal.test.js',
     '', '', '', False),

    # 13 Taxes and BIR
    ('13.01', 13, 'Premium taxes: DST (NIRC s.184), VAT 12% or premium tax per product regime, LGT by LGU, FST 2%', 'Both', 'BIR', 3, 2,
     'Master > Finance > Premium Taxes & LGU Rates; Product master premium_tax_regime; premium-charges.test.js',
     'DST rule delivered as 12.5% of premium; the per-unit option (PHP 0.50 per PHP 4.00, fraction rounded up) is available.', '', '', False),
    ('13.03', 13, 'Output VAT on commission and VAT Summary (2550Q working paper)', 'Both', 'BIR', 3, 2,
     'Accounts > Tax > VAT Summary; commission-taxes.test.js', '', '', '', False),
    ('13.04', 13, 'Percentage tax for a non-VAT broker or agent (2551Q)', 'Both', 'BIR', 1, 2,
     'Accounts > Tax > Percentage Tax 2551Q (/accounts/tax/percentage-tax): gross sales per month from the revenue accounts, bir.percentage_tax_rate and bir.percentage_tax_atc, print, Excel, filing record; modules/bir/returns.js (migration 0280); bir-forms.test.js (2551Q)',
     '', '', '', False),
    ('13.05', 13, 'EWT on payments and BIR Form 2307 issued', 'Both', 'BIR', 3, 2,
     'Accounts > Tax > BIR Form 2307 (Issued by us); Accounts > Payables > Supplier 2307; commission-taxes.test.js; ap-2307-asset-disposal.test.js', '', '', '', False),
    ('13.06', 13, 'CWT withheld by insurers, BIR Form 2307 received and SAWT', 'Both', 'BIR', 3, 2,
     'BIR Form 2307 (Received); SAWT; direct-bill.test.js', '', '', '', False),
    ('13.07', 13, 'Monthly and quarterly EWT returns (0619-E, 1601-EQ) with QAP', 'Both', 'BIR', 3, 2,
     'Accounts > Tax > Withholding Returns (/accounts/tax/withholding-returns): filing calendar, 0619-E and 1601-EQ laid out with the BIR item numbers per ATC, 0619-E remittances deducted, reconciliation with the QAP and the ledger, PDF and Excel, filing and amended return records; modules/bir/returns.js (migration 0280); bir-forms.test.js (0619-E and 1601-EQ)',
     'The figures are transferred to eBIRForms or eFPS by the broker; the system does not file.', '', '', False),
    ('13.08', 13, 'Annual information return and alphalist (1604-E)', 'Both', 'BIR', 2, 2,
     'Accounts > Tax > Annual Alphalist 1604-E (/accounts/tax/alphalist-1604e): remittances per month from the filing records, schedules 3 and 4, Excel, print, DAT file, filing record; bir-forms.test.js (1604-E)',
     '', '', '', False),
    ('13.09', 13, 'SLSP sales and purchases', 'Both', 'BIR', 2, 2,
     'Accounts > Tax > SLSP Sales, SLSP Purchases (BIR column order); DAT files', '', '', '', False),
    ('13.10', 13, 'Invoices under the EOPT Act and RR 7-2024 (invoice as primary document, required fields)', 'Both', 'BIR', 3, 2,
     'Accounts > Tax > Sales Invoices (/accounts/tax/sales-invoices): SI series without gaps within the registered serial range, seller and buyer fields, VATable, exempt and zero-rated sales, payment acknowledgement as supplementary document, cancellation; receipts.document_title and supplementary statement; invoice.* settings (ATP or CAS permit, serial range, printer, buyer threshold); modules/bir/invoices.js (migration 0281); bir-forms.test.js (sales invoices under the EOPT Act)',
     'The tax adviser confirms which documents are registered as the broker\'s invoices, the wording of the supplementary documents and the VAT treatment of each commission stream; these are settings, not code.', '', '', False),
    ('13.11', 13, 'Computerized accounting system registration support (books, outputs, controls)', 'Both', 'BIR', 3, 2,
     'Accounts > Tax > CAS Books and Documents (/accounts/tax/cas): readiness checklist, six loose-leaf books with page numbers running through the year, print register, reprint and void, system description, backup procedure, audit trail extract; modules/bir/cas.js (migration 0282); bir-forms.test.js (CAS registration pack)',
     'The registration or acknowledgement with the BIR is filed by the broker with the pack.', '', '', False),
    ('13.12', 13, 'Electronic invoicing and sales data transmission to BIR (EIS)', 'Both', 'BIR', 1, 2,
     'Accounts > Tax > E-Invoicing (EIS) (/accounts/tax/eis): connector with eis.mode test (built-in provider) or live, signed payloads with SHA-256 hash, eis-outbox job with retry and backoff, retry, queue earlier invoices, export payloads for manual upload and Uploaded manually record; modules/bir/eis.js (migration 0283); bir-forms.test.js (EIS connector)',
     'Certification that remains with the partner: the broker\'s EIS enrolment, the BIR\'s final field list and signing certificate, the production endpoint and credentials. Delivered switched off; the manual upload is the fallback.', '', '', False),
    ('13.13', 13, 'BIR validation files (DAT) for alphalists and SLSP', 'Both', 'BIR', 2, 2,
     'Accounts > Tax > BIR DAT Files (/accounts/tax/dat-files): QAP, SAWT, 1604-E alphalist (Alphalist Data Entry and Validation Module 7.x record layouts) and SLSP (RELIEF layout), header, detail and control records, warnings; modules/bir/dat.js; bir-forms.test.js (writes the files exactly as the documented layout)',
     'Validate each file with the current BIR validation module before the first submission.', '', '', False),
    ('13.14', 13, 'Tax codes with ATC, rates, GL account and effective dates', 'Both', 'BIR', 2, 2,
     'Master > Finance > Taxation; commission-taxes.test.js', '', '', '', False),

    # 14 Insurance Commission and Data Privacy
    ('14.02', 14, 'Licence renewal tracking of the firm and licensed individuals', 'Both', 'IC', 2, 2,
     'Compliance > Insurance Commission > Licence Register (/compliance/licences): firm, officers, licensed individuals and referrers, states Valid, Expiring, Expired, renewal filed and recorded, expiry calendar, job compliance-reminders at 90, 60, 30, 15 and 7 days; modules/ic-compliance/licences.js (migration 0270); ic-compliance.test.js (licence register)',
     '', '', '', False),
    ('14.03', 14, 'Fit and proper records of directors and officers', 'Both', 'IC', 1, 2,
     'Compliance > Insurance Commission > Fit and Proper (/compliance/fit-and-proper): declarations from compliance.fit_proper_declarations, attachments, review outcome, next review in compliance.fit_proper_review_months; modules/ic-compliance/fitProper.js; ic-compliance.test.js (fit and proper records)',
     'The wording of the declarations is a setting the compliance officer confirms against the IC rules in force.', '', '', False),
    ('14.04', 14, 'IC annual statement and financial reports in the IC format', 'Both', 'IC', 3, 1,
     'Compliance > Insurance Commission > IC Annual Statement (/compliance/ic-annual-statement): schedules 1 to 4 from the ledger and production on configurable IC lines (Account mapping, migration 0274), checks, accountant confirmation sheet, unmapped accounts, workbook; modules/ic-compliance/icReports.js; ic-compliance.test.js (annual statement)',
     'Delivered as a working paper: the schedules follow the structure of the IC annual statement of an insurance broker (form set named in compliance.ic_statement_form), and the accountant confirms the figures and transcribes them onto the IC form set in force. The official form layout is not reproduced by the system, so the item is scored 1.',
     'Regulator confirmation', 'M', False),
    ('14.05', 14, 'IC production and business reports (premium placed by insurer and line)', 'Both', 'IC', 2, 2,
     'Compliance > Insurance Commission > IC Production Report (/compliance/ic-production-report): premiums by insurer and IC line (compliance.ic_lines_of_business, ic_line_map) by month, quarter or year, co-insurance split by share, Excel with detail; ic-compliance.test.js (production report)',
     'The IC line set is a setting; confirm it against the IC form in force before the first submission.', '', '', False),
    ('14.06', 14, 'Records of business available for IC examination, licence number on documents', 'Both', 'IC', 3, 2,
     'Numbered placement trail RFQ to policy to receipt; reports; audit log; Company master IC licence number on letterhead and footer line (printing.test.js, branding.test.js)', '', '', '', False),
    ('14.07', 14, 'Premium held in trust for insurers, apart from own funds', 'Both', 'IC', 3, 2,
     'Premiums Payable to Insurers per insurer; Premium Trust Account; IC Annual Statement schedule 4; payment-segregation.test.js; ic-compliance.test.js', '', '', '', False),
    ('14.08', 14, 'Complaints handling and financial consumer protection (RA 11765)', 'Both', 'IC', 2, 2,
     'Compliance > Insurance Commission > Complaints (/compliance/complaints): register with CPT series, acknowledgement and resolution deadlines (complaints.ack_days, resolution_days_simple and _complex), letters on the letterhead, escalation, referral to the IC, job complaints-deadlines, regulator report; modules/ic-compliance/complaints.js (migration 0272); ic-compliance.test.js (complaints register)',
     'The deadline values are settings to confirm against the IC rules in force.', '', '', False),
    ('14.09', 14, 'Data subject requests, export and anonymisation', 'Both', 'NPC', 3, 2,
     'Master > Data Privacy > Data Subject Requests; privacy.test.js', '', '', '', False),
    ('14.10', 14, 'Retention and disposal of personal data', 'Both', 'NPC', 2, 2,
     'privacy.retention_years; housekeeping.* settings; privacy.test.js', '', '', '', False),
    ('14.11', 14, 'Breach detection support and breach register', 'Both', 'NPC', 2, 2,
     'Compliance > Data Privacy (NPC) > Breach Register (/compliance/breaches): incident log with PDB series, 72-hour clock from discovery (privacy.breach_notify_hours), NPC criteria assessment, NPC and data subject notification records, hourly job privacy-breach-deadlines, annual report; login history and failed sign-in alarms; modules/data-breaches (migration 0273); data-breaches.test.js',
     '', '', '', False),
    ('14.12', 14, 'Masking of personal data on screens and exports by role', 'Both', 'NPC', 2, 2,
     'Permission view:pii (Master > Users and Access > Roles): TIN, ID, mobile, e-mail, bank account and birth date masked on lists, views and Excel, CSV and PDF exports; on-request reveal recorded in the audit trail; privacy.masking_enabled, masking_exempt_paths, pii_reveal_mode; lib/piiPolicy.js and lib/pii.js applied in app.js (migration 0276); personal-data-protection.test.js (masking by role); mask-data.test.js (production copies)',
     '', '', '', False),
    ('14.13', 14, 'Encryption of personal identifiers', 'Both', 'NPC', 1, 2,
     'TIN, government ID and bank account numbers of clients, prospects and referrers, policy KYC IDs and 2307 payee TIN encrypted at rest with PII_ENCRYPTION_KEY and a blind index for exact search; key rotation (deploy/REFERENCE.md); migration 0277; personal-data-protection.test.js (field-level encryption)',
     '', '', '', False),
    ('14.14', 14, 'Data residency in the Philippines when required', 'Both', 'NPC', 1, 2,
     'Hosting options: local partner or on-premise (architecture document)', '', '', '', False),

    # 15 Reporting, administration, security and go-live
    ('15.01', 15, 'Report catalogue in Excel, CSV and PDF with scheduled e-mail', 'Both', 'Ops', 3, 2,
     'Reports > All Reports (/reports/catalogue); reports.test.js; Daily reports job', '', '', '', False),
    ('15.02', 15, 'Role dashboards (executive, sales, processing, claims, commission)', 'Both', 'Ops', 2, 2,
     'Dashboard menu; dashboard.test.js', '', '', '', False),
    ('15.03', 15, 'Ad hoc reporting and BI extract', 'Both', 'Ops', 1, 2,
     'Reports > Report Builder (/reports/builder): datasets by permission, columns, filters, grouping with totals, Excel, saved reports private or shared by role; BI extract tab and job bi-extract (one CSV per dataset to bi.extract_folder); modules/report-builder (migration 0308); report-builder.test.js',
     '', '', '', False),
    ('15.04', 15, 'Role-based access, deny by default, checked on every API call', 'Both', 'NPC', 3, 2,
     'User Management > Role Permissions, User Access Matrix; role-access.test.js; access-control.test.js', '', '', '', False),
    ('15.05', 15, 'Maker-checker, authority matrix, delegations, SoD and access reviews', 'Both', 'Ops', 3, 2,
     'User Management > Authority Matrix, Delegations, Segregation of Duties, Access Reviews; user-access.test.js', '', '', '', False),
    ('15.06', 15, 'Password policy, lockout and two-step verification', 'Both', 'NPC', 3, 2,
     'security.require_2fa_roles; security.test.js; hardening.test.js', '', '', '', False),
    ('15.07', 15, 'Audit trail with before and after values, searchable by users', 'Both', 'NPC', 3, 2,
     'Master > System Configuration > Audit Trail (/master/configuration/audit-trail): search by record type, record ID, user and dates, before and after values, source (migration 0247); audit extract for the CAS pack; modules/audit; audit-events.test.js (audit trail API)',
     '', '', '', False),
    ('15.08', 15, 'Menu organised by role and task', 'Both', 'Ops', 1, 2,
     'Enterprise side menu in sections (brokerverse/src/components/SideBar/list.js, menuPermissions.js), Master in sections, Help panel (F1) with the manual section per screen; role-access.test.js, screen-data.test.js',
     '', '', '', False),
    ('15.09', 15, 'My Work: one inbox of tasks and approvals per user', 'Both', 'Ops', 2, 2,
     'Operations > My Work (/operations/my-work): My Items by category and role, My Team by reporting line with reassignment, My Tasks with reminders, Calendar; automatic follow-ups from promises to pay, renewal next steps, claim follow-ups and sales activities; modules/my-work (migration 0253); my-work.test.js, sales-activities.test.js',
     '', '', '', False),
    ('15.10', 15, 'Document numbering, configuration with approval, e-mail outbox and notifications', 'Both', 'Ops', 2, 2,
     'Master > Document Numbering, Configuration, Configuration Approvals, E-mail Outbox; numbering.test.js; configuration-controls.test.js; email-outbox.test.js', '', '', '', False),
    ('15.11', 15, 'Branding, letterhead and e-signature on documents', 'Both', 'Ops', 1, 2,
     'Master > System Settings > Theme and Branding (/master/configuration/theme-branding): theme presets with contrast check, logo, sign-in picture, document, report and e-mail branding, brand packs exported and imported (optional Toyota Insurance Services pack, used only with that client\'s permission); every PDF through printContext; e-signature slots per document; modules/branding, modules/e-signatures (migration 0254); branding.test.js',
     '', '', '', False),
    ('15.12', 15, 'Philippine reference masters (PSGC geography, banks, IDs, salutations, holidays, IC insurer list)', 'Both', 'Ops', 2, 2,
     'Master > Location > Province (labelled Province), City / Municipality, barangays and ZIP codes from PSGC 2Q 2026 (migration 0250, seed 12_ph_geography.sql); salutations, civil status, government ID types, registration authorities, payment modes, holidays, Philippine banks and the IC non-life insurer list with certificate fields (seed 69_ph_practice_masters.sql); addresses.test.js, masters.test.js',
     'Barangays are loaded per region from the shipped PSGC file by the administrator (tool with dry run), a go-live step.', '', '', False),
    ('15.13', 15, 'Go-live data load (masters, in-force book, open items, GL opening balances) with rehearsal and reconciliation', 'Both', 'Ops', 3, 2,
     'Master > Go-Live Data Load (configuration and migration workbooks, validate, errors workbook, load, reconciliation); go-live.test.js; go-live-workbench.test.js; go-live-roundtrip.test.js; docs/e2e/GOLIVE_REHEARSAL_RUN.md (52 checks passed)', '', '', '', False),
    ('15.16', 15, 'Hosting choice, backups and disaster recovery', 'Both', 'Ops', 2, 2,
     'Architecture and BCDR documents; release pipeline (Dev, SIT, UAT, Pre-Prod, Production); /api/health', 'Recovery objectives are recommended values; no DR test yet.', '', '', False),
]

REG_TYPES = ('IC', 'BIR', 'NPC', 'AMLC')

# --------------------------------------------------------------------------------------------------------------------
# ASEAN countries. Change % per L1 area (share of that area that must change) and the main layer of the change:
# C = configuration only, L = localisation of masters, tax rules and forms, X = code (regulatory reports, e-invoicing
# and other integrations, screens). Language (UI and printed documents) is a separate cross-cutting layer.
COUNTRY_ORDER = ['SG', 'BN', 'MY', 'TH', 'KH', 'ID', 'VN', 'LA', 'MM']
HEAT = {
    'SG': {1: (20, 'L'), 2: (5, 'C'), 3: (30, 'L'), 4: (5, 'C'), 5: (30, 'X'), 6: (10, 'C'), 7: (5, 'C'), 8: (20, 'X'),
           9: (10, 'L'), 10: (15, 'L'), 11: (5, 'C'), 12: (15, 'L'), 13: (65, 'X'), 14: (35, 'X'), 15: (5, 'C')},
    'BN': {1: (25, 'L'), 2: (5, 'C'), 3: (35, 'L'), 4: (10, 'C'), 5: (30, 'X'), 6: (10, 'C'), 7: (5, 'C'), 8: (10, 'L'),
           9: (10, 'L'), 10: (15, 'L'), 11: (5, 'C'), 12: (15, 'L'), 13: (45, 'L'), 14: (35, 'X'), 15: (5, 'C')},
    'MY': {1: (30, 'L'), 2: (5, 'C'), 3: (40, 'L'), 4: (10, 'C'), 5: (35, 'X'), 6: (10, 'C'), 7: (10, 'C'), 8: (35, 'X'),
           9: (15, 'L'), 10: (25, 'L'), 11: (10, 'C'), 12: (20, 'L'), 13: (65, 'X'), 14: (40, 'X'), 15: (5, 'C')},
    'TH': {1: (30, 'L'), 2: (10, 'L'), 3: (45, 'X'), 4: (10, 'C'), 5: (35, 'X'), 6: (15, 'C'), 7: (10, 'C'), 8: (30, 'X'),
           9: (15, 'L'), 10: (30, 'L'), 11: (10, 'C'), 12: (25, 'L'), 13: (65, 'X'), 14: (40, 'X'), 15: (10, 'C')},
    'KH': {1: (30, 'L'), 2: (10, 'L'), 3: (45, 'X'), 4: (10, 'C'), 5: (40, 'X'), 6: (15, 'C'), 7: (10, 'C'), 8: (35, 'X'),
           9: (15, 'L'), 10: (30, 'L'), 11: (15, 'C'), 12: (35, 'L'), 13: (65, 'X'), 14: (35, 'X'), 15: (10, 'L')},
    'ID': {1: (35, 'L'), 2: (10, 'L'), 3: (50, 'X'), 4: (15, 'C'), 5: (40, 'X'), 6: (15, 'C'), 7: (10, 'C'), 8: (40, 'X'),
           9: (20, 'L'), 10: (35, 'X'), 11: (15, 'C'), 12: (30, 'L'), 13: (75, 'X'), 14: (50, 'X'), 15: (10, 'L')},
    'VN': {1: (35, 'L'), 2: (10, 'L'), 3: (50, 'X'), 4: (15, 'C'), 5: (45, 'X'), 6: (20, 'C'), 7: (10, 'C'), 8: (50, 'X'),
           9: (20, 'L'), 10: (35, 'L'), 11: (15, 'C'), 12: (50, 'X'), 13: (75, 'X'), 14: (50, 'X'), 15: (10, 'L')},
    'LA': {1: (30, 'L'), 2: (10, 'L'), 3: (45, 'X'), 4: (15, 'C'), 5: (40, 'X'), 6: (15, 'C'), 7: (10, 'C'), 8: (35, 'X'),
           9: (15, 'L'), 10: (30, 'L'), 11: (15, 'C'), 12: (40, 'L'), 13: (70, 'X'), 14: (35, 'X'), 15: (10, 'L')},
    'MM': {1: (40, 'X'), 2: (10, 'L'), 3: (50, 'X'), 4: (20, 'C'), 5: (45, 'X'), 6: (15, 'C'), 7: (10, 'C'), 8: (35, 'X'),
           9: (20, 'L'), 10: (30, 'L'), 11: (15, 'C'), 12: (40, 'L'), 13: (70, 'X'), 14: (45, 'X'), 15: (15, 'L')},
}
# Version 1.1 baseline (every release package merged). Against the 1.0 estimate: area 5 down 5 points (CTPL
# authentication is a connector adapter, not a screen rebuild); area 8 down 5 to 10 (bank payment files are layouts
# configured per bank, no longer code); area 9 down 5 (insurer API is a connector with a mapping per insurer);
# area 13 down 5 where e-invoicing exists (the EIS outbox pattern, signed payloads and manual fallback are reusable;
# the BIR forms, DAT files and CAS books themselves are replaced in full); area 14 down 15 (licence, fit and proper,
# complaints and breach registers with configurable deadlines and declarations, IC statement lines as configuration;
# the regulator reports themselves are still replaced); area 15 down 5 to 10 (report builder, branding and brand
# packs, integration framework, menu and Help panel are configuration). Areas 1 to 4, 6, 7 and 10 to 12 unchanged.
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
    ws['A2'] = (f'Version 1.1: re-scored on the code of branch brokerverse-platform as of {AS_OF} with every release '
                'package merged (version 1.0 of the same date was the pre-release assessment). Scores: 2 supported end '
                'to end, 1 partly supported, 0 not supported.')
    ws['A2'].font = NOTE_FONT
    ws.merge_cells('A2:F2')
    ws['A2'].alignment = WRAP
    ws.row_dimensions[2].height = 30
    header(ws, 4, ['Headline', 'Value', 'Basis'], [None] * 3)
    c = res['counts']
    rows = [
        ('Overall Philippine process fit', res['overall'] / 100, f"{c['l2']} L2 processes in 15 L1 areas, weighted 1 to 3"),
        ('Regulatory compliance fit (IC, BIR, NPC, AMLC)', res['regulatory'] / 100, f"{c['reg']} regulatory L2 processes"),
        ('Operational process fit', res['operational'] / 100, f"{c['ops']} operational L2 processes"),
        ('Broker practice fit', res['broker'] / 100, 'L2 processes that apply to a broker'),
        ('Captive agency practice fit', res['agent'] / 100, 'L2 processes that apply to an agency (no market placement)'),
        ('Processes not scored 2', f"{c['one'] + c['zero']}", 'Scored 1: regulator confirmation of a report layout outstanding (sheet Gaps Ranked)'),
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
    ch.dataLabels.showCatName = False
    ch.dataLabels.showSerName = False
    ch.dataLabels.showLegendKey = False
    ch.dataLabels.showPercent = False
    ch.height, ch.width = 13, 20
    ch.gapWidth = 40
    ch.x_axis.scaling.orientation = 'maxMin'
    ch.series[0].graphicalProperties.solidFill = NAVY
    ws.add_chart(ch, 'G4')

    r1 = last + 3
    ws.cell(row=r1 - 1, column=1, value='ASEAN rollout: change needed against the Philippine product').font = BOLD
    header(ws, r1, ['Country', 'Change % (range)', 'Midpoint %', 'Effort (calendar weeks, team of 5)', 'Rank'], [None] * 5)
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
    ch2.dataLabels.showCatName = False
    ch2.dataLabels.showSerName = False
    ch2.dataLabels.showLegendKey = False
    ch2.dataLabels.showPercent = False
    ch2.height, ch2.width = 9, 18
    ch2.series[0].graphicalProperties.solidFill = '2F6EBA'
    ws.add_chart(ch2, f'G{r1}')
    for col, w in zip('ABCDE', (50, 16, 58, 24, 8)):
        ws.column_dimensions[col].width = w
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
        ('Baseline', f'Version 1.1: code on branch brokerverse-platform as of {AS_OF} with every release package merged (Philippine masters, enterprise menu and Help panel, My Work, Product Configurator in the flow, audit trail screen, go-live workbench, AML/CFT, IC and NPC compliance, BIR forms and EIS, operations and accounting additions, distribution, integrations framework, branding and e-signatures, sales activities, quote covers and risk fields, supplier 2307, fixed asset disposal). Nothing is counted as in development. Version 1.0 of the same date scored the pre-release code (overall 80.4%).'),
        ('Integrations', 'An integration scores 2 only when the code has a connector with a configurable provider, a test mode exercised by the tests, an outbox with retry and a manual or file fallback. The certification that remains with the partner (bank file acceptance, SMS gateway contract, CTPL provider and LTO acceptance, insurer API contract, BIR EIS enrolment, screening provider) is stated in the gap note and is an onboarding task, not a product gap.'),
        ('Regulator confirmations', 'A report whose official layout the regulator or the broker\'s adviser must confirm before the first filing is scored 1 when the system does not reproduce the official form (AMLC report file, IC annual statement working paper). Forms the BIR publishes (0619-E, 1601-EQ, 1604-E, 2551Q, DAT record layouts) are scored 2 with the validation step named in the gap note; settings the broker confirms (ATCs, deadlines, declarations, invoice registration) are noted, not deducted.'),
        ('Catalogue', f"{res['counts']['l2']} L2 processes in 15 L1 areas, written from Philippine broking practice: Insurance Code (RA 10607) and IC rules, NIRC and EOPT Act (RA 11976) with RR 7-2024, Data Privacy Act (RA 10173) and NPC rules, AMLA (RA 9160 as amended), Financial Consumer Protection Act (RA 11765), LTO and CTPL practice."),
        ('Weight', '3 = core to daily operation or a legal obligation with penalties; 2 = important; 1 = useful or occasional.'),
        ('Score', '2 = supported out of the box end to end and evidenced by a screen and a test or the UAT run; 1 = partly supported, needs a workaround, a procedure or configuration not yet present; 0 = not supported. Screens that do not complete the process get no credit.'),
        ('Fit %', 'Sum of weight x score divided by the sum of weight x 2, per L1 and overall. Regulatory fit uses the L2 typed IC, BIR, NPC or AMLC; operational fit uses the L2 typed Ops.'),
        ('Gap ranking', 'Impact = weight x (2 - score), times 1.5 for a regulatory item; ties ranked by smaller effort. Effort S up to 2 weeks, M 2 to 6 weeks, L over 6 weeks for one team.'),
        ('ASEAN method', 'For each country and L1 area: share of the area that changes and its main layer (configuration, localisation, code). Weighted by the L1 weight of the Philippine catalogue. A language layer is added for UI and documents. Ranges reflect uncertainty; facts marked "to verify" are to be confirmed with local counsel or a partner.'),
        ('Accelerators found in the code', 'Integration framework (modules/integrations/framework: connectors with provider adapters, credentials by environment variable, test mode, outbox with retry, signed inbox) used by SMS, Viber, CTPL, LTO, insurer API and bank files; bank file layouts configured per bank (delimited or fixed width); compliance registers with configurable deadlines, declarations and line sets (licences, fit and proper, complaints, breaches, IC statement mapping); AML programme with configurable risk factors, thresholds, uploaded lists and a screening provider adapter; report builder and BI extract; Theme and Branding with brand packs; i18n framework and language picker (brokerverse/src/i18n.js, utility/languages.js) with th.json partly translated and withdrawn from the pickers; base currency and dated exchange rates (migration 0235); premium tax engine with rule kinds vat, premium_tax, dst, fst, lgt and other (percent, per unit, flat; lines, regimes, dates) in modules/premium-charges; posting rules and account determination; Master > Configuration settings; document numbering; address API country > region > province > city > barangay with postal code lookup; payment gateway providers; bank and insurer statement formats; Singapore hosting region.'),
        ('Inhibitors found in the code', 'The BIR layer is larger than in 1.0 and all of it is Philippine-specific: modules/bir (0619-E, 1601-EQ, 1604-E, 2551Q, DAT files, EOPT sales invoices, EIS payload, CAS books) and the BIR reports in modules/reports/periodEndQueries.js; the AMLC report file (modules/aml/reports.js) and the IC annual statement and production report (modules/ic-compliance/icReports.js); CTPL authentication and COC series (modules/integrations/ctpl.js); motor quotation built around CTPL and the IC vehicle classes; KYC ID defaults and PSGC address structure; Asia/Manila business time zone in 8 backend files; PHP defaults in document templates; premium tax kinds named after Philippine taxes; LGU tax master.'),
        ('Sources in the repository', 'backend/src/modules (73 modules); backend/src/db/migrations (to 0331); backend/test (104 test files); backend/scripts/uat-scenario.js and docs/e2e/UAT_SCENARIO_RUN.md (433 steps passed); docs/e2e/GOLIVE_REHEARSAL_RUN.md (52 checks passed); brokerverse/src/components/SideBar/list.js and utils/menuPermissions.js; brokerverse/src/locales; docs/package/source/user-manual.md, ph-regulatory-compliance-matrix.md, product-functionality.md, test-summary.md.'),
        ('Versions', '1.0, 04 October 2026: pre-release assessment (overall 80.4%, regulatory 70.7%, 12 processes in development). 1.1, 04 October 2026: re-scored on the merged release; every process re-verified against the code, the tests, the menu and the user manual; ASEAN estimates recomputed on the new baseline.'),
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
          f"broker {result['broker']}%, agent {result['agent']}%")
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
