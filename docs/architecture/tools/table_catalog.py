"""Hand-maintained catalogue of the BrokerVerse tables: domain, owning backend module, one-line purpose and retention
class. The database facts (columns, keys, rows, sizes) come from data/db_snapshot.json; this file adds the meaning.

Retention classes (document 10 gives the recommended periods):
  FIN  financial record: ledger, billing, receipts, payments, commissions, remittances; keep for the statutory period
  TXN  business transaction record: leads, quotations, policies, endorsements, claims, renewals, reinsurance
  REF  reference data / configuration: masters, settings, product templates, roles
  LOG  log and audit trail: audit log, sign-in history, field-change history, job run history
  TMP  temporary / operational: tokens, reset codes, outbox, queues, generated files, counters
"""

DOMAINS = [
    ('security', 'Security and identity'),
    ('platform', 'Platform services'),
    ('reference', 'Reference masters'),
    ('product', 'Product configurator'),
    ('sales', 'Sales and policy'),
    ('claims', 'Claims'),
    ('renewals', 'Renewals'),
    ('billing', 'Billing, receipts and collections'),
    ('ledger', 'General ledger'),
    ('disbursement', 'Disbursements and petty cash'),
    ('commission', 'Commission'),
    ('remittance', 'Remittance and direct bill'),
    ('reinsurance', 'Reinsurance'),
    ('incentive', 'Incentive'),
    ('reporting', 'Reporting'),
]

RETENTION = {
    'FIN': 'Financial',
    'TXN': 'Transaction',
    'REF': 'Reference',
    'LOG': 'Log / audit',
    'TMP': 'Temporary',
}

# table: (domain, owning module(s), purpose, retention class)
TABLES = {
    # Security and identity
    'roles': ('security', 'users', 'Role catalogue (it-admin, ba, sales, underwriting, customer-services, claims, finance, agent, user-access-admin and custom roles)', 'REF'),
    'permissions': ('security', 'users', 'Permission codes read:<module> / write:<module> (25 modules x 2)', 'REF'),
    'role_permissions': ('security', 'users', 'Grant of permissions to roles', 'REF'),
    'users': ('security', 'users, auth', 'User accounts: bcrypt password hash, status, lockout counter, 2FA (encrypted TOTP secret), token version', 'REF'),
    'user_roles': ('security', 'users', 'Assignment of roles to users', 'REF'),
    'refresh_tokens': ('security', 'auth', 'Refresh-token register (jti, family, expiry, rotation / revocation reason)', 'TMP'),
    'password_resets': ('security', 'auth', 'One-time password reset codes (HMAC hash only), expiry and attempts', 'TMP'),
    'password_history': ('security', 'auth', 'Previous password hashes for the history rule (last N kept)', 'LOG'),
    'login_history': ('security', 'auth', 'Every sign-in attempt: user, IP, user agent, success, reason, method', 'LOG'),
    # Platform services
    'app_settings': ('platform', 'settings, system-settings', 'Configuration keys (JSONB value, group, label, type); every business parameter', 'REF'),
    'audit_log': ('platform', 'all (lib/audit.js)', 'Who did what to which record, with before / after JSON and IP', 'LOG'),
    'notifications': ('platform', 'notifications', 'In-app notifications per user or per permission audience', 'TMP'),
    'email_outbox': ('platform', 'lib/mailer.js', 'Queued e-mails (to, subject, HTML body, status, attempts, error)', 'TMP'),
    'scheduled_jobs': ('platform', 'schedules, jobs', 'Cron jobs (code, cron, handler, params, enabled, last status)', 'REF'),
    'job_runs': ('platform', 'jobs', 'Run history of scheduled and manual job runs (status, output, error)', 'LOG'),
    'job_queue': ('platform', 'renewals', 'Background work queue (renewal notice batches); status, progress, attempts', 'TMP'),
    'documents': ('platform', 'uploads and file writers', 'Registry of stored files: storage key, name, type, size, owning entity, uploader', 'TXN'),
    'sequences': ('platform', 'all (next_number())', 'Document-number counters per name and year (QT-, POL-, OR-, JV- ...)', 'REF'),
    'schema_migrations': ('platform', 'db/migrate.js', 'Applied migration files', 'REF'),
    'master_types': ('platform', 'masters', 'Master screen registry: fields, storage table, keys of each configurable master', 'REF'),
    'master_records': ('platform', 'masters', 'Generic master records (JSONB data) for masters without their own table', 'REF'),
    'agent_events': ('platform', 'payments (open items)', 'Agent calendar events / reminders', 'TXN'),
    # Reference masters
    'countries': ('reference', 'masters', 'Countries', 'REF'),
    'states': ('reference', 'masters', 'Provinces / states', 'REF'),
    'cities': ('reference', 'masters', 'Cities and municipalities', 'REF'),
    'districts': ('reference', 'addresses', 'Districts / barangays with postal code', 'REF'),
    'postal_codes': ('reference', 'addresses', 'Postal code lookup (province, city, district)', 'REF'),
    'currencies': ('reference', 'masters', 'Currencies (base flag, decimals, exchange rate)', 'REF'),
    'banks': ('reference', 'masters', 'Banks and mortgagees', 'REF'),
    'insurance_companies': ('reference', 'masters', 'Insurers (principals): contact, commission rate, remittance attributes', 'REF'),
    'products': ('reference', 'masters', 'Insurance products / lines', 'REF'),
    'policy_types': ('reference', 'masters', 'Policy types per product', 'REF'),
    'vehicle_brands': ('reference', 'quotations', 'Vehicle makes', 'REF'),
    'vehicle_models': ('reference', 'quotations', 'Vehicle models per make', 'REF'),
    'vehicle_variants': ('reference', 'quotations', 'Vehicle variants (body type, seating)', 'REF'),
    'coverages': ('reference', 'quotations', 'BI / PD / PA cover options with amount and premium', 'REF'),
    'signatories': ('reference', 'masters', 'Authorised signatories for documents', 'REF'),
    'branches': ('reference', 'masters', 'Broker branches', 'REF'),
    # Product configurator
    'product_templates': ('product', 'product-configurator', 'Versioned product templates (config JSONB, rates, limits, insurers)', 'REF'),
    'product_components': ('product', 'product-configurator', 'Template components: covers, rating tables, rules, documents (JSONB data)', 'REF'),
    'product_risk_mappings': ('product', 'product-configurator', 'Product / line-of-business risk definitions', 'REF'),
    'product_risk_sections': ('product', 'product-configurator', 'Risk sections of a mapping with default rates', 'REF'),
    # Sales and policy
    'leads': ('sales', 'leads', 'Leads / prospects (individual or corporate), owner, status', 'TXN'),
    'clients': ('sales', 'clients', 'Clients (insured parties) with KYC fields and owner', 'TXN'),
    'quotes': ('sales', 'quotations', 'Quotations: vehicle / coverage JSONB, premium, taxes, commission, approval token hash', 'TXN'),
    'policies': ('sales', 'policies', 'Issued policies: term, premium, insurer, billing mode, details / doc JSONB', 'TXN'),
    'endorsements': ('sales', 'endorsements', 'Policy endorsements and cancellations, premium delta, billing link', 'TXN'),
    'policy_payments': ('sales', 'policies', 'Premium payments captured on a policy, awaiting finance confirmation', 'FIN'),
    # Claims
    'claims': ('claims', 'claims', 'Claims: loss details, estimate, approved and settled amounts, handler, lifecycle status', 'TXN'),
    'claim_history': ('claims', 'claims', 'Claim status history', 'LOG'),
    'claim_field_changes': ('claims', 'claims', 'Field-level audit trail of claim edits', 'LOG'),
    # Renewals
    'renewals': ('renewals', 'renewals', 'Renewal cases of expiring policies (status, notices, contact, premium old / new)', 'TXN'),
    'renewal_quotes': ('renewals', 'renewals', 'Renewal quotations (loading, discount, variance)', 'TXN'),
    'renewal_notices': ('renewals', 'renewals', 'Renewal notices sent (stage, method, recipient, status)', 'LOG'),
    'renewal_activities': ('renewals', 'renewals', 'Contact and follow-up activities on a renewal', 'LOG'),
    'renewal_batches': ('renewals', 'renewals', 'Batch renewal notice runs', 'TXN'),
    'renewal_batch_policies': ('renewals', 'renewals', 'Policies in a renewal batch and their notice status', 'TXN'),
    'winback_campaigns': ('renewals', 'renewals', 'Win-back campaigns for lapsed business', 'TXN'),
    # Billing, receipts and collections
    'receivables': ('billing', 'receipts', 'Premium bills (INV-) per policy / endorsement / renewal with balance and ageing', 'FIN'),
    'receipts': ('billing', 'receipts', 'Official receipts (OR-) header: payer, amount, mode, status', 'FIN'),
    'receipt_lines': ('billing', 'receipts', 'Receipt lines per policy (premium, taxes, EWT, discounts)', 'FIN'),
    'receipt_applications': ('billing', 'receipts', 'Application of receipt lines to bills, with journal link', 'FIN'),
    'collection_items': ('billing', 'collections', 'Collection follow-up items for open bills (commitment, escalation, assignee)', 'TXN'),
    'collection_actions': ('billing', 'collections', 'Collection actions: calls, e-mails, commitments', 'LOG'),
    # General ledger
    'gl_accounts': ('ledger', 'accounting', 'Chart of accounts (type, statement group, normal balance, open-item flag)', 'REF'),
    'accounting_periods': ('ledger', 'accounting', 'Accounting period open / closed status', 'FIN'),
    'journal_vouchers': ('ledger', 'journal-vouchers, accounting', 'Journal vouchers (JV-): source, status, maker-checker, reversal / correction links', 'FIN'),
    'journal_lines': ('ledger', 'journal-vouchers, accounting', 'Journal lines: account, debit / credit, branch, department, client / policy tags', 'FIN'),
    'entry_matches': ('ledger', 'accounting', 'Open-item matching of debit and credit journal lines', 'FIN'),
    # Disbursements and petty cash
    'disbursements': ('disbursement', 'disbursements', 'Payment vouchers (PV-) to insurers, agents, clients; approval and payment', 'FIN'),
    'invoice_lists': ('disbursement', 'disbursements', 'Invoice lists (IL-) settled by a disbursement', 'FIN'),
    'checkbooks': ('disbursement', 'disbursements', 'Cheques issued (instrument, approval, printing)', 'FIN'),
    'petty_cash_funds': ('disbursement', 'payments', 'Petty cash funds (size, limits, custodian, available cash)', 'FIN'),
    'petty_cash_requests': ('disbursement', 'payments', 'Petty cash requests and approval', 'FIN'),
    'petty_cash_request_lines': ('disbursement', 'payments', 'Lines of a petty cash request', 'FIN'),
    'petty_cash_disbursements': ('disbursement', 'payments', 'Petty cash payments (VAT, WHT, journal)', 'FIN'),
    'petty_cash_receipts': ('disbursement', 'payments', 'Receipts into a petty cash fund', 'FIN'),
    'petty_cash_replenishments': ('disbursement', 'payments', 'Fund replenishments from bank', 'FIN'),
    # Commission
    'commissions': ('commission', 'commission, policies', 'Commission lines per policy / endorsement and referrer: accrual, eligibility, approval, payment', 'FIN'),
    'commission_referrers': ('commission', 'commission', 'Agents / referrers: hierarchy, WHT rate, bank account', 'REF'),
    # Remittance and direct bill
    'remittances': ('remittance', 'remittance', 'Premium remittances / bills to insurers (REM-): gross, commission, net due, approval, settlement', 'FIN'),
    'remittance_lines': ('remittance', 'remittance', 'Policies included in a remittance', 'FIN'),
    'remittance_items': ('remittance', 'remittance', 'Remittance work items (settlements, adjustments, transfers, exceptions)', 'FIN'),
    'remittance_approvals': ('remittance', 'remittance', 'Multi-level approval requests with SLA and history', 'LOG'),
    'remittance_delegations': ('remittance', 'remittance', 'Approval delegations (period, transaction types, amount limit)', 'REF'),
    'commission_debit_notes': ('remittance', 'remittance (direct bill)', 'Commission debit notes (DN-) to insurers for direct-billed policies', 'FIN'),
    'commission_debit_note_lines': ('remittance', 'remittance (direct bill)', 'Policies / items on a debit note', 'FIN'),
    'commission_debit_note_collections': ('remittance', 'remittance (direct bill)', 'Insurer payments against a debit note (cash, EWT, Form 2307)', 'FIN'),
    'direct_bill_items': ('remittance', 'remittance (direct bill)', 'Commission receivable items booked for direct-billed policies', 'FIN'),
    # Reinsurance
    'reinsurers': ('reinsurance', 'reinsurance', 'Reinsurers (rating, capacity, contact)', 'REF'),
    'reinsurance_treaties': ('reinsurance', 'reinsurance', 'Treaties (type, capacity, share, retention, approval)', 'TXN'),
    'cessions': ('reinsurance', 'reinsurance', 'Cessions of policies to treaties / facultative reinsurers', 'TXN'),
    'reinsurance_recoveries': ('reinsurance', 'reinsurance', 'Claim recoveries from reinsurers', 'FIN'),
    'reinsurance_bordereaux': ('reinsurance', 'reinsurance', 'Premium / claims bordereaux (entries JSONB, file)', 'TXN'),
    'reinsurance_reconciliations': ('reinsurance', 'reinsurance', 'Reinsurer statement reconciliations', 'FIN'),
    'reinsurance_exceptions': ('reinsurance', 'reinsurance', 'Reconciliation exceptions and resolution', 'LOG'),
    # Incentive
    'incentive_programs': ('incentive', 'incentive', 'Agent incentive programmes (metric, targets, tiers, eligibility)', 'REF'),
    'incentive_calculations': ('incentive', 'incentive', 'Incentive calculation batches with maker-checker and payment', 'FIN'),
    'incentive_results': ('incentive', 'incentive', 'Per-agent incentive results and payouts', 'FIN'),
    # Reporting
    'report_definitions': ('reporting', 'reports', 'Report catalogue (parameters, query, columns, roles, permission)', 'REF'),
    'report_schedules': ('reporting', 'reports', 'E-mailed report schedules (cron, format, recipients)', 'REF'),
    'generated_reports': ('reporting', 'reports', 'Generated report files (code, parameters, format, storage key, rows)', 'TMP'),
}
