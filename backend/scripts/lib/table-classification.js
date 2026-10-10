/**
 * Classification of every table of the database, shared by the data maintenance scripts:
 *   scripts/reset-transactions.js  (npm run reset:transactions)  removes the business transactions and keeps every
 *                                  master, configuration table and user (smoke test clean-up before go-live)
 *   scripts/purge-sample-data.js   (npm run purge:sample)        also removes the demo masters and users of the sample seed
 *
 * Every table created by a migration is in exactly one of the lists below. test/reset-transactions.test.js fails
 * when the database has a table that no list names, so a new migration cannot add a table that the reset forgets:
 * add it to the list that fits (and, for a transaction table, check its foreign keys from master tables).
 *
 *   TRANSACTION_TABLES     business records entered while working: emptied by both scripts
 *   SYSTEM_TABLES          technical records (audit, sessions, sign-in history, job runs, notifications, e-mail outbox,
 *                          generated reports, uploaded document records, number counters, opening balances, schema
 *                          history), each with what the reset does with it (SYSTEM_RESET_ACTIONS)
 *   MASTER_CONFIG_TABLES   masters, configuration, users and roles: kept by the reset as they are
 */

/** Business transactions: emptied completely (one TRUNCATE, so foreign keys among them are satisfied). */
export const TRANSACTION_TABLES = [
  // sales and policy administration
  'leads', 'clients', 'quotes', 'policies', 'endorsements', 'policy_payments',
  'broker_slips', 'insurer_offers', 'placements', 'risk_participants', 'quote_customer_responses',
  // receivables, receipts, collections, disbursements, petty cash movements (the funds themselves are masters)
  'receivables', 'receipts', 'receipt_lines', 'receipt_applications', 'unapplied_collections', 'unapplied_allocations', 'entry_matches', 'invoice_lists', 'receivable_participants', 'receivable_credits', 'remittance_allocations',
  'collection_items', 'collection_actions', 'disbursements', 'checkbooks', 'receipt_batches',
  'petty_cash_requests', 'petty_cash_request_lines', 'petty_cash_disbursements', 'petty_cash_receipts', 'petty_cash_replenishments',
  // commission, direct bill, remittance
  'commissions', 'commission_debit_notes', 'commission_debit_note_lines', 'commission_debit_note_collections', 'direct_bill_items',
  'remittances', 'remittance_lines', 'remittance_items', 'remittance_approvals', 'remittance_imports', 'remittance_import_rows', 'remittance_runs', 'insurer_billing_runs',
  // incentive results (programmes are masters)
  'incentive_calculations', 'incentive_results',
  // claims and renewals
  'claims', 'claim_history', 'claim_field_changes',
  'renewals', 'renewal_quotes', 'renewal_notices', 'renewal_activities', 'renewal_batches', 'renewal_batch_policies', 'winback_campaigns',
  // the ledger and period-end processing: journals, periods and fiscal years (regenerated open on demand), closes
  'journal_vouchers', 'journal_lines', 'accounting_periods', 'fiscal_years',
  'period_status_history', 'period_close_runs', 'period_close_run_checks', 'period_close_entries',
  'recurring_journals', 'recurring_journal_runs', 'year_end_runs', 'year_end_run_history', 'bir_2307_certificates',
  // bank reconciliation (statement formats, transaction types and match rules are configuration)
  'bank_statements', 'bank_statement_lines', 'bank_rec_matches', 'bank_rec_match_items', 'bank_reconciliations', 'bank_reconciliation_history',
  // comsub adjustments on return premium, claim settlement cash, refunds due from insurers, direct-bill client payments
  'commission_adjustments', 'claim_settlement_movements', 'insurer_refund_credits', 'direct_bill_client_payments',
  // insurer statement reconciliation (statement formats are configuration)
  'insurer_statements', 'insurer_statement_lines', 'insurer_statement_resolutions',
  // credit control (client credit limits are a column of clients)
  'premium_instalment_plans', 'premium_instalments', 'premium_warranty_extensions', 'premium_warranty_actions', 'client_credit_exceptions',
  // packaged products sold (bundles and insurer rate tables are configuration), payment links
  'package_endorsements', 'package_sections', 'package_quotes', 'payment_events', 'payment_links',
  // access reviews held, calendar events of users
  'access_review_items', 'access_reviews', 'agent_events',
  // consents (marketing and messaging) belong to the clients and leads that go
  'privacy_consents',
  // the work diary of Operations > My Work (tasks and follow-ups on the records that go)
  'work_tasks',
  // integrations: CTPL authentication of each cover, bank payment batches and their lines
  'ctpl_authentications', 'bank_payment_batches', 'bank_payment_batch_lines',
  // BIR forms and invoicing: return filing records, generated DAT files, sales invoices and their payments, EIS outbox,
  // loose-leaf book prints
  'bir_return_filings', 'bir_dat_files', 'sales_invoices', 'sales_invoice_lines', 'sales_invoice_payments', 'eis_submissions', 'cas_book_prints',
  // overriding commission from insurers: computations and settlements (the agreements are configuration)
  'override_computations', 'override_settlements',
  // due diligence of the clients: signatories, beneficial owners, KYC documents
  'client_signatories', 'client_beneficial_owners', 'client_kyc_documents',
  // operations and accounting (migrations 0290 to 0297): cover notes, post-dated cheques, claim document checklist and
  // reminders, motor claim repairs, accounts payable, fixed assets and their depreciation (masters are generic types)
  'cover_notes', 'post_dated_cheques', 'pdc_sets', 'pdc_transmittals', 'remittance_holds', 'claim_document_items', 'claim_document_reminders', 'claim_repair_estimates', 'claim_loas', 'claim_vehicle_releases',
  'supplier_invoices', 'supplier_invoice_lines', 'supplier_payments', 'supplier_payment_allocations', 'fixed_assets', 'fixed_asset_depreciation',
  // distribution and products: lead assignments, channel billing accounts, dealer sales, fleet schedules, marine open
  // covers, comparison reports, marketing campaigns (assignment rules, channels, programmes, segments, templates and
  // saved reports are masters)
  'lead_assignment_history', 'channel_billing_accounts', 'dealer_sales_batches', 'dealer_sales', 'fleet_schedules', 'fleet_vehicles',
  'open_covers', 'open_cover_declarations', 'open_cover_certificates',
  'comparison_reports', 'campaigns', 'campaign_recipients',
  // sales activities of account executives and fixed asset disposals (migrations 0320 and 0321)
  'sales_activities', 'fixed_asset_disposals',
];

/**
 * System tables and what the transaction reset does with each:
 *   remove     emptied
 *   partial    some rows go (see the reset script: documents by storage folder, sequences by series)
 *   optional   removed unless an option keeps it (opening balances: --keep-opening-balances; audit: kept unless --purge-audit)
 *   keep       left as is
 */
export const SYSTEM_RESET_ACTIONS = {
  notifications: 'remove',
  email_outbox: 'remove',
  generated_reports: 'remove',
  job_runs: 'remove',
  job_queue: 'remove',
  login_history: 'remove',
  refresh_tokens: 'remove', // sign-in sessions: everyone signs in again
  password_resets: 'remove',
  data_load_batches: 'remove', // go-live data load history: the loads of a smoke test go with the records they created
  data_load_rows: 'remove',
  data_load_comparisons: 'remove', // environment comparisons go with the load history (compare again after the reset)
  documents: 'partial', // uploaded and generated file records of transaction folders (TRANSACTION_FILE_FOLDERS)
  sequences: 'partial', // document number counters: transaction series restart (MASTER_SERIES keep their counter)
  opening_balances: 'optional', // go-live opening balances: removed unless --keep-opening-balances
  audit_log: 'optional', // kept unless --purge-audit; the reset is recorded in it either way
  integration_outbox: 'remove', // integration messages (SMS, CTPL, insurer requests, bank files) go with the records they were about
  integration_attempts: 'remove',
  integration_inbox: 'remove',
  password_history: 'keep', // part of the user accounts (password reuse rule)
  schema_migrations: 'keep',
  bi_extract_runs: 'remove', // BI extract history (the CSV files in the storage folder stay)
  // SAP GL file runs and their file copies: they describe journals the reset removes (the files in the SAP folder stay)
  sap_gl_exports: 'remove',
  sap_gl_export_files: 'remove',
};
export const SYSTEM_TABLES = Object.keys(SYSTEM_RESET_ACTIONS);

/** Masters, configuration, users and roles: never touched by the transaction reset (petty_cash_funds: see the script). */
export const MASTER_CONFIG_TABLES = [
  // settings, numbering series, users, roles and access
  'app_settings', 'document_numbering', 'users', 'user_roles', 'roles', 'role_permissions', 'permissions',
  'authority_limits', 'authority_transaction_types', 'sod_rules', 'sod_exceptions', 'user_delegations', 'remittance_delegations',
  // generic and dedicated masters
  'master_types', 'master_records', 'branches', 'signatories', 'e_signatures', 'document_signature_slots', 'brand_pack_enablements', 'banks', 'insurance_companies', 'commission_referrers',
  'countries', 'regions', 'states', 'cities', 'districts', 'postal_codes', 'currencies',
  'vehicle_brands', 'vehicle_models', 'vehicle_variants', 'write_off_reasons',
  // products and pricing: product configurator, covers, commission rate matrix, taxes and charges, packages
  'products', 'policy_types', 'coverages', 'product_templates', 'product_components', 'product_risk_mappings', 'product_risk_sections',
  'commission_rates', 'tax_codes', 'lgu_tax_rates', 'premium_charge_rules', 'package_bundles', 'package_bundle_sections', 'insurer_rate_tables',
  'incentive_programs', 'payment_gateways',
  // accounting configuration: chart of accounts, posting rules and their change requests, period-end checklist, petty cash funds
  'gl_accounts', 'fs_versions', 'fs_version_lines', 'posting_rules', 'posting_rule_lines', 'accounting_config_changes', 'period_close_checklist', 'petty_cash_funds',
  'bank_statement_formats', 'bank_transaction_types', 'bank_match_rules', 'insurer_statement_formats',
  // reports and scheduled jobs
  'report_definitions', 'report_schedules', 'scheduled_jobs',
  // integrations: connectors, message templates, insurer API mappings, COC series, bank file layouts, payee bank accounts
  'integration_connectors', 'message_templates', 'insurer_api_mappings', 'coc_series', 'bank_file_layouts', 'payee_bank_accounts',
  // overriding / contingent commission agreements with insurers and their tiers
  'override_agreements', 'override_agreement_tiers',
  // distribution and reporting configuration: lead assignment rules, distribution channels, brand-new vehicle
  // programmes, campaign segments and templates, Report Builder saved reports
  'lead_assignment_rules', 'distribution_channels', 'motor_programmes', 'campaign_segments', 'campaign_templates', 'report_builder_reports',
  // CAS registration documents (system description, backup procedure): approved versions kept as the system's documentation
  'cas_documents',
];

/**
 * Document numbering series whose counter numbers master records. The counter is kept by the reset because the
 * records it numbered stay (restarting it would issue a code that already exists):
 *   petty_cash_fund     Petty Cash Code (petty_cash_funds, Accounts > Petty Cash > Initiate)
 *   product_template    product template codes (Product Configurator)
 *   incentive_program   incentive programme numbers (incentive_programs)
 *   commission_master   Commission Code of the retired commission master (records kept, inactive)
 *   employee            Employee Code of the retired employee master (records kept, inactive)
 * Every other series numbers transactions and restarts at its configured start number.
 */
export const MASTER_SERIES = ['petty_cash_fund', 'product_template', 'incentive_program', 'commission_master', 'employee'];

/**
 * Storage folders (first segment of a storage key, uploads/storage.js) that hold transaction files: policy, quotation,
 * endorsement, claim and payment attachments, printed receipts and vouchers, generated reports.
 * Their documents rows are removed by the reset, the files themselves with --purge-files.
 */
export const TRANSACTION_FILE_FOLDERS = [
  'vehicle-photos', 'id-cards', 'policy-documents', 'quotation-responses', 'insurer-offers', 'endorsement', 'endorsement-documents',
  'claim', 'claims', 'payment-proofs', 'direct-bill-payments', 'print', 'generated', 'reports',
  'incentive-reports', 'remittance-statements', 'remittance-bulk', 'remittance-imports',
  // KYC documents of the clients (onboarding)
  'kyc',
  'bi-extract',
];
/** Configuration folders, never touched: logos and favicons (System Settings, Company master), product documents, e-signatures. */
export const CONFIG_FILE_FOLDERS = ['logo', 'favicon', 'company-logo', 'product-documents', 'e-signatures'];

/**
 * Tables the sample-data purge (scripts/purge-sample-data.js) also empties: technical records, and configuration the
 * sample seed fills with demo rows (bundles, insurer rate tables, petty cash funds, delegations).
 */
export const PURGE_SYSTEM_TABLES = ['notifications', 'email_outbox', 'generated_reports', 'job_runs', 'job_queue', 'sequences', 'documents', 'opening_balances',
  'integration_outbox', 'integration_attempts', 'integration_inbox'];
export const PURGE_DEMO_CONFIG_TABLES = ['petty_cash_funds', 'package_bundles', 'package_bundle_sections', 'insurer_rate_tables',
  'user_delegations', 'remittance_delegations', 'sod_exceptions',
  // demo COC series, payee bank accounts and insurer API mapping of seeds/sample/98_integrations.sql
  'coc_series', 'payee_bank_accounts', 'insurer_api_mappings'];

/** Every classified table. */
export const CLASSIFIED_TABLES = [...TRANSACTION_TABLES, ...SYSTEM_TABLES, ...MASTER_CONFIG_TABLES];

/** Tables of the database (names) that no list classifies, and names classified twice. */
export function classificationGaps(databaseTables) {
  const seen = new Map();
  for (const t of CLASSIFIED_TABLES) seen.set(t, (seen.get(t) || 0) + 1);
  return {
    unclassified: databaseTables.filter((t) => !seen.has(t)).sort(),
    duplicated: [...seen].filter(([, n]) => n > 1).map(([t]) => t).sort(),
    unknown: CLASSIFIED_TABLES.filter((t) => !databaseTables.includes(t)).sort(),
  };
}
