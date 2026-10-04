"""Generic column descriptions by column name. {e} is replaced with the entity noun of the table."""

NOUN = {
    'quotes': 'quotation', 'policies': 'policy', 'claims': 'claim', 'leads': 'lead', 'clients': 'client',
    'receivables': 'premium bill', 'receipts': 'official receipt', 'disbursements': 'payment voucher',
    'journal_vouchers': 'journal voucher', 'journal_lines': 'journal line', 'remittances': 'remittance',
    'commissions': 'commission line', 'renewals': 'renewal case', 'broker_slips': 'broker slip',
    'placements': 'placement slip', 'insurer_offers': 'insurer offer', 'endorsements': 'endorsement',
    'insurance_companies': 'insurer', 'cessions': 'cession', 'reinsurance_treaties': 'treaty',
    'reinsurance_recoveries': 'reinsurance recovery', 'reinsurance_bordereaux': 'bordereau',
    'reinsurance_reconciliations': 'reinsurance reconciliation', 'reinsurance_exceptions': 'reconciliation exception',
    'bank_reconciliations': 'bank reconciliation', 'bank_statements': 'bank statement', 'bank_statement_lines': 'statement line',
    'bank_rec_matches': 'bank match', 'bank_rec_match_items': 'match item', 'gl_accounts': 'GL account',
    'accounting_periods': 'accounting period', 'fiscal_years': 'fiscal year', 'period_close_runs': 'month-end close run',
    'year_end_runs': 'year-end close run', 'tax_codes': 'tax code', 'bir_2307_certificates': 'BIR Form 2307 certificate',
    'users': 'user', 'roles': 'role', 'permissions': 'permission', 'app_settings': 'setting', 'master_records': 'master record',
    'master_types': 'master type', 'document_numbering': 'number series', 'sequences': 'counter', 'scheduled_jobs': 'scheduled job',
    'job_runs': 'job run', 'job_queue': 'queued job', 'notifications': 'notification', 'email_outbox': 'queued e-mail',
    'documents': 'stored file', 'report_definitions': 'report', 'report_schedules': 'report schedule', 'generated_reports': 'generated report',
    'invoice_lists': 'invoice list', 'checkbooks': 'cheque', 'petty_cash_funds': 'petty cash fund', 'petty_cash_requests': 'petty cash request',
    'petty_cash_request_lines': 'request line', 'petty_cash_disbursements': 'petty cash payment', 'petty_cash_receipts': 'petty cash receipt',
    'petty_cash_replenishments': 'replenishment', 'commission_debit_notes': 'commission debit note', 'commission_debit_note_lines': 'debit note line',
    'commission_debit_note_collections': 'debit note collection', 'direct_bill_items': 'direct-bill commission item',
    'remittance_lines': 'remittance line', 'remittance_items': 'remittance work item', 'remittance_approvals': 'approval request',
    'remittance_delegations': 'delegation', 'remittance_allocations': 'allocation', 'insurer_refund_credits': 'insurer refund credit',
    'collection_items': 'collection item', 'collection_actions': 'collection action', 'receipt_lines': 'receipt line',
    'receipt_applications': 'receipt application', 'receivable_credits': 'bill credit', 'receivable_participants': 'insurer share of the bill',
    'risk_participants': 'co-insurance participant', 'renewal_quotes': 'renewal quotation', 'renewal_notices': 'renewal notice',
    'renewal_activities': 'renewal activity', 'renewal_batches': 'renewal batch', 'renewal_batch_policies': 'batch entry',
    'winback_campaigns': 'win-back campaign', 'incentive_programs': 'incentive programme', 'incentive_calculations': 'calculation batch',
    'incentive_results': 'incentive result', 'commission_rates': 'commission rate', 'commission_referrers': 'referrer',
    'commission_adjustments': 'commission adjustment', 'claim_history': 'claim history entry', 'claim_field_changes': 'claim change entry',
    'claim_settlement_movements': 'settlement movement', 'products': 'product', 'policy_types': 'policy type', 'coverages': 'cover option',
    'vehicle_brands': 'vehicle make', 'vehicle_models': 'vehicle model', 'vehicle_variants': 'vehicle variant', 'product_templates': 'product template',
    'product_components': 'template component', 'product_risk_mappings': 'risk mapping', 'product_risk_sections': 'risk section',
    'banks': 'bank', 'branches': 'branch', 'signatories': 'signatory', 'countries': 'country', 'regions': 'region', 'states': 'province', 'cities': 'city',
    'districts': 'district', 'postal_codes': 'postal code', 'currencies': 'currency', 'write_off_reasons': 'write-off reason',
    'posting_rules': 'posting rule version', 'posting_rule_lines': 'posting rule line', 'entry_matches': 'open-item match',
    'opening_balances': 'opening balance', 'period_close_checklist': 'checklist item', 'period_close_run_checks': 'checklist result',
    'period_close_entries': 'close-run journal', 'period_status_history': 'period status change', 'recurring_journals': 'recurring journal template',
    'recurring_journal_runs': 'recurring journal run', 'bank_statement_formats': 'statement format', 'bank_transaction_types': 'bank transaction type',
    'bank_match_rules': 'matching rule', 'bank_reconciliation_history': 'reconciliation status change', 'audit_log': 'audit entry',
    'login_history': 'sign-in attempt', 'refresh_tokens': 'refresh token', 'password_resets': 'reset code', 'password_history': 'previous password',
    'agent_events': 'calendar event', 'policy_payments': 'payment capture', 'access_reviews': 'access review', 'access_review_items': 'review item',
    'accounting_config_changes': 'configuration change', 'authority_limits': 'authority limit', 'authority_transaction_types': 'transaction type',
    'sod_rules': 'segregation-of-duties rule', 'user_delegations': 'delegation', 'client_credit_exceptions': 'credit limit exception',
    'premium_instalment_plans': 'instalment plan', 'premium_instalments': 'instalment', 'premium_warranty_extensions': 'warranty extension request',
    'premium_warranty_actions': 'warranty action', 'direct_bill_client_payments': 'client payment record', 'insurer_statement_formats': 'statement format',
    'insurer_statements': 'insurer statement', 'insurer_statement_lines': 'statement line', 'insurer_statement_resolutions': 'resolution',
    'insurer_rate_tables': 'insurer rate', 'lgu_tax_rates': 'LGT rate', 'premium_charge_rules': 'charge rule', 'package_bundles': 'bundle',
    'package_bundle_sections': 'bundle section', 'package_quotes': 'bundle quotation', 'package_sections': 'package section',
    'package_endorsements': 'package endorsement', 'payment_gateways': 'payment gateway', 'payment_links': 'payment link',
    'payment_events': 'gateway notification', 'quote_customer_responses': 'customer response', 'user_roles': 'role assignment',
    'role_permissions': 'permission grant', 'schema_migrations': 'migration', 'bank_account_links': 'bank account', 'bank_book_lines': 'book line',
}

G = r"""
id|Unique identifier of the {e}
created_at|Date and time the {e} was created
updated_at|Date and time of the last change to the {e}
created_by|User who created the {e}
updated_by|User who last changed the {e}
status|Current status of the {e}
name|Name of the {e} as shown on screens and documents
remarks|Free-text remarks entered by the user
code|Short code that identifies the {e}; used in settings, imports and reports
description|Free-text description of the {e}
amount|Amount of the {e} in the transaction currency (PHP unless stated)
currency|Currency code (ISO 4217, PHP by default)
approved_by|User who approved the {e}
approved_at|Date and time of approval
journal_id|Journal voucher posted for this {e}
active|Yes when the {e} is in use; inactive entries are kept for history but not offered for new transactions
attrs|Additional attributes of the master record that have no column of their own (JSON)
period|Accounting or reporting period (YYYY-MM)
policy_number|Policy number as printed on the policy (copied for display and search)
kind|Type of the {e}
source|Origin of the {e} (screen, import, job or upstream document)
user_id|User the {e} belongs to
sort_order|Display order in lists and drop-downs (lower first)
reference|External or business reference (document number, insurer reference)
vat|Value-added tax (VAT) amount
due_date|Date by which the {e} is due
net_premium|Premium net of taxes and charges
commission_rate|Commission rate as a fraction (0.15 = 15%)
sum_insured|Sum insured (amount of cover)
commission|Commission amount
submitted_by|User who submitted the {e} for approval
error|Error message of the last failed attempt
entity_id|Identifier of the business record this row refers to
rejected_by|User who rejected the {e}
rate|Rate applied (see the rate basis of the record)
branch_code|Branch code of the broker branch (branches.code)
commission_amount|Broker commission on the premium of the {e}
effective_from|First date on which the {e} applies
effective_to|Last date on which the {e} applies; empty means open-ended
period_from|Start date of the period covered
period_to|End date of the period covered
insured_name|Name of the insured as shown on the policy
gross_premium|Gross premium including taxes and charges
payment_mode|How the money was paid (cash, cheque, bank transfer, online ...)
reference_no|Payment or bank reference number
rejected_at|Date and time of rejection
rejection_reason|Reason given when the {e} was rejected
closed_at|Date and time the {e} was closed
entity|Type of business record this row refers to (policy, quote, claim ...)
type|Type or category of the {e}
line_no|Line number within the parent document
lob|Line of business code (MOTOR, FIRE, MARINE, CASUALTY, ENGINEERING, ACCIDENT, EB, IAR)
line_of_business|Line of business code
sent_at|Date and time the {e} was sent
transaction_number|Transaction number from the document numbering series
transaction_code|Transaction code used to classify the accounting entry
total_amount|Total amount of the {e}
dst|Documentary stamp tax (DST) amount
lgt|Local government tax (LGT) amount
fst|Fire service tax (FST) amount
fiscal_year|Fiscal year code (for example FY2026)
label|Label shown on screens
at|Date and time of the event
action|Action performed
cancelled_by|User who cancelled the {e}
cancelled_at|Date and time of cancellation
cancel_reason|Reason given for the cancellation
doc|Full document data of the {e} as built by the screens (premium breakdown, customer and risk data) used to print the document (JSON)
inception_date|Date the cover starts
expiry_date|Date the cover ends
notes|Free-text notes
priority|Priority of the {e}
submitted_at|Date and time of submission for approval
paid_at|Date and time of payment
reversal_jv_id|Journal voucher that reversed the original posting
department_code|Department code used to tag ledger lines
category|Category used to group the {e}
effective_date|Date from which the change takes effect
taxes|Breakdown of the taxes (VAT, DST, LGT, FST) (JSON)
premium_total|Total amount payable: premium plus taxes and charges
reason|Reason recorded for the {e}
method|Method used
decided_by|User who decided (approved or rejected) the request
decided_at|Date and time of the decision
closed_by|User who closed the {e}
requested_at|Date and time of the request
start_date|First date of the {e}
end_date|Last date of the {e}
username|Sign-in name of the user
params|Parameters of the {e} (JSON)
file_name|Original file name of the uploaded or generated file
is_system|Yes for entries delivered with the system; they cannot be deleted
address|Postal address of the {e}
product_type|Product name of the risk (for example Motor, Fire and Allied Perils)
customer_code|Client or payee code
email|E-mail address used for notices, documents and approval links
phone|Telephone or mobile number
balance|Outstanding balance
premium|Premium amount
insurer_reference|Reference given by the insurer (policy, offer or receipt number)
attempts|Number of attempts made
narration|Narrative printed on the journal line or document
data|Detail data of the {e} (JSON)
share_percent|Share of the risk or amount in percent (0 to 100)
target|Target value
payload|Request or message content (JSON)
requested_by|User who made the request
matched_by|User who made the match
matched_at|Date and time of the match
from_status|Status before the change
to_status|Status after the change
gl_account_code|GL account code (gl_accounts.code)
prepared_by|User who prepared the {e}
prepared_at|Date and time the {e} was prepared
deleted_at|Date and time the {e} was deleted (soft delete); deleted rows are hidden from screens
lines|Lines of the {e} (JSON)
submission_date|Date of submission
confirmed_by|User who confirmed the {e}
confirmed_at|Date and time of confirmation
main_account|Main account code of the chart of accounts
details|Details of the {e} (JSON)
first_name|First (given) name
last_name|Last (family) name
display_name|Full name as displayed
tin|Tax identification number (BIR TIN)
city|City or municipality
country|Country of the address
postal_code|Postal (ZIP) code
email_id|Queued e-mail (email_outbox.id) sent for this {e}
discount_amount|Discount given on the premium
reversed_at|Date and time of reversal
criteria|Selection criteria used (JSON)
module|Application module
billing_mode|Billing mode: broker (the broker bills and collects the premium) or direct (the insurer bills the client and the broker bills its commission)
sub_account|Sub account code
section_no|Section number within the package
total_charges|Total of taxes and charges
base_premium|Premium before discounts and taxes
other_charges|Other charges added to the premium
valid_until|Date until which the quotation is valid
expires_at|Date and time after which the {e} can no longer be used
enabled|Yes when the {e} is active
outcome|Outcome recorded
discount|Discount amount
commission_vat|VAT on the commission
commission_ewt|Expanded withholding tax (EWT) on the commission
roles|Role codes
last_login_at|Date and time of the last successful sign-in
change_note|Explanation entered with the change
decision_remarks|Remarks entered with the decision
reopened_by|User who reopened the {e}
reopened_at|Date and time the {e} was reopened
value|Value
editable|Yes when the value can be changed on screen
ip|IP address of the request
transaction_type|Transaction type
max_amount|Maximum amount allowed; empty means no limit
confidence|Confidence score of the match (1 to 100)
side|Side of the entry
difference|Difference between the two sides
unmatched_by|User who undid the match
unmatched_at|Date and time the match was undone
changed_by|User who made the change
changed_at|Date and time of the change
file_type|Accepted file type (csv, xlsx or any)
skip_rows|Number of rows to skip at the top of the file before the data
has_header|Yes when the file has a header row
columns|Mapping of the file columns to the fields read (JSON)
date_format|Date format of the file (for example DD/MM/YYYY)
skip_pattern|Regular expression of lines to ignore (totals, page headers)
txn_date|Transaction date on the statement
debit|Debit amount
credit|Credit amount
type_code|Type code
statement_number|Statement number from the document numbering series
statement_ref|Reference or period label printed on the statement
line_count|Number of lines on the statement
format_code|Statement format used for the import
file_hash|Hash of the imported file; refuses the same file twice
direction|Direction of the flow
requires_approval|Yes when the {e} needs an approval before posting
payee_name|Name of the payee
insured|Name of the insured
cession_percentage|Percentage of the risk ceded
invoice_list_id|Invoice list (invoice_lists.id)
customer_name|Name of the paying client
by_user|User who performed the action
note|Note entered with the change
claim_number|Claim number
settled_at|Date and time of settlement
credit_limit|Credit limit: the largest premium exposure allowed for the client
company_name|Company name (corporate client)
birth_date|Date of birth of an individual (gives the age)
gender|Gender of the person (individual clients and prospects)
state|Province of the address
preferred_name|Name the person prefers to be addressed by
house_no|House or building number
barangay|Barangay of the address
road|Street or road of the address
soi|Alley or side street (screen field soiAlley)
moo|Village or subdivision (screen field mooVillage)
lead_category|Customer category (Retail or Corporate)
extra|Further fields captured on the screen that have no column of their own (JSON)
action_by|User who took the action
commitment_date|Date by which the client committed to pay
withholding|Withholding tax amount
received_date|Date the money was received
applied_amount|Amount applied
product|Product name printed on the document
net_amount|Net amount after taxes and deductions
referrer_id|Referrer or sub-agent (commission_referrers.id)
discount_pct|Discount in percent
reversed_by|User who reversed the {e}
accrual_jv_id|Journal voucher that accrued the amount
payment_jv_id|Journal voucher that recorded the payment
exchange_rate|Exchange rate to PHP
payment_date|Date of payment
proof_key|Storage key of the uploaded proof of payment
proof_file_name|File name of the uploaded proof of payment
booking_jv_id|Journal voucher that booked the {e} in the ledger
payee_type|Type of payee (Insurer, Customer, Agent/Referrer)
bank_id|Bank (banks.id)
purpose|Purpose of the payment or request
city_id|City (cities.id)
storage_key|Key of the file in the file store
content_type|MIME type of the file
size_bytes|File size in bytes
endorsement_number|Endorsement number
sent_by|User who sent the {e}
completed_at|Date and time of completion
format|Output format (csv, xlsx or pdf)
totals|Totals of the {e} (JSON)
triggered_by|User or job that started the run
account_type|Type of account
adjustments|Adjustments applied (JSON)
short_name|Short name used on screens and reports
terms|Terms and conditions
attachment_key|Storage key of the attached file
attachment_name|File name of the attached file
rate_basis|Basis of the rate: percent, per mille or flat amount
minimum_premium|Minimum premium charged
deductible|Deductible applied to each loss, as printed on the policy
broker_type|Type of broker record matched (remittance line, debit note line or policy)
broker_id|Identifier of the broker record matched
fc_amount|Amount in foreign currency
lc_amount|Amount in local currency (PHP)
wht|Withholding tax amount
started_at|Date and time the run started
finished_at|Date and time the run ended
job_id|Scheduled job (scheduled_jobs.id)
account_code|GL account code (gl_accounts.code)
currency_code|Currency code (ISO 4217)
entry_type|Journal entry type (NEW_BUSINESS, PAYMENT_RECEIPT, REMITTANCE ...)
reference_id|Identifier of the source record
province|Province
screen|Front-end screen or menu path
message|Message text
bundle_id|Package bundle (package_bundles.id)
property|Risk or property details of the section (JSON)
benefits|Benefits or covers of the section (JSON)
customer_segment|Customer segment the product or bundle is offered to (retail, SME, corporate or both)
discount_percent|Discount in percent
auto_issue|Yes when the policy may be issued automatically once the premium is paid online
charges|Charges breakdown (JSON)
premium_tax|Premium tax amount
entity_type|Type of record the row belongs to
line|Line of business
password_hash|bcrypt hash of the password; the password itself is never stored
gateway_code|Payment gateway (payment_gateways.code)
provider_ref|Reference of the payment at the gateway provider
item_type|auto (checked by the system) or manual (signed off by a user)
severity|blocking (prevents the close) or warning
run_id|Close run (period_close_runs.id)
run_number|Run number from the document numbering series
request_id|Petty cash request (petty_cash_requests.id)
expense_account|GL expense account charged
receipt_number|Receipt number from the document numbering series
requester_name|Name of the person requesting the cash
premium_base|Premium before loadings, discounts and taxes
others|Other charges added to the premium
version|Version number of the {e}
frequency|How often the {e} recurs
applied_at|Date and time the {e} was applied
is_lead|Yes for the lead insurer of a co-insured risk
gross|Gross amount of this share
revoked_at|Date and time the {e} was revoked
reinsurer_id|Reinsurer (reinsurers.id)
resolution|How the item was resolved
capacity|Capacity (largest amount that can be accepted)
rating|Rating
net|Net amount
delegator_id|User who delegates the authority
delegate_id|User who receives the delegated authority
remittance_id|Remittance (remittances.id)
tax|Taxes included in the amount (VAT, DST, LGT)
cron|Schedule as a cron expression (minute hour day month weekday) in the business time zone
last_run_at|Date and time of the last run
last_status|Result of the last run
role_id|Role (roles.id)
designation|Job title printed with the name
gl_account|GL account code
insurance_company_id|Insurer (principal) concerned
owner_user_id|Account executive who owns the {e}
agent_user_id|Account executive credited with the {e}
"""
GCOL = {}
for line in G.strip().split('\n'):
    k, v = line.split('|', 1)
    GCOL[k] = v
