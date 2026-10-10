/**
 * Personal data catalogue of the client data masking tool (scripts/mask-data.js, docs/onboarding/DATA_MASKING.md).
 *
 * Starting point: the personal data classification of the data dictionary (Republic Act No. 10173, Data Privacy Act of
 * 2012): docs/package/tools/data-dictionary/pii.py, column "Personal data (RA 10173)" of the Columns sheet of
 * docs/package/07_Technical/BrokerVerse_Data_Dictionary.xlsx, completed from the migrations.
 *
 * Every column is handled in one of three ways:
 *   CATALOGUE        personal data: masked with the rule named (table.column -> rule)
 *   ALLOW_LIST       looks personal by its name (or is classified personal by the data dictionary) but is kept as it is,
 *                    with the reason
 *   anything else    text and JSON columns are swept ("scrub"): storage keys renamed, e-mail addresses, mobile numbers
 *                    and TINs replaced, and in transaction and system tables every known client name replaced by its
 *                    pseudonym (narrations, notification texts, references copied into descriptions)
 * TABLE_ACTIONS empties tables whose rows are only credentials, sessions or messages to real people.
 *
 * test/mask-data.test.js fails when a column of the database that the data dictionary classifies as personal, or whose
 * name looks personal (PERSONAL_NAME_RE), is in neither CATALOGUE nor ALLOW_LIST: a new migration that adds such a
 * column must classify it here.
 *
 * Rules (scripts/lib/pseudonyms.js):
 *   firstName / lastName / personName   names word by word from built-in Filipino name lists (same word, same pseudonym)
 *   companyName                         fake company name, legal form (Inc., Corp.) kept
 *   partyName                           person or company, whichever the value is
 *   email / emailList                   user<hash>@example.test
 *   phone                               mobile +63 900 ..., other numbers keep their first digits; format kept
 *   tin                                 999-###-###-000
 *   contact                             e-mail, phone or name, whichever the value is
 *   street / address / houseNo / barangay   fake street (one-line address: city / province part kept), fake barangay
 *   locality / province / postal        kept (fake with --mask-locality)
 *   dob                                 another day giving the same age on the masking date
 *   idNumber / plate / chassis / engine format-preserving replacement (letters stay letters, digits stay digits)
 *   bankAccount                         format-preserving, last 4 characters kept
 *   freeText                            "[masked]" (empty stays empty)
 *   fileName                            masked-<hash>.<extension>
 *   storageKey                          file part of a client file's storage key renamed (folder/<time>-<nonce>-masked-<hash>.<ext>),
 *                                       the same everywhere the key is referred to (every other *_key column and JSON too)
 *   ip                                  192.0.2.x (TEST-NET-1)
 *   secret                              cleared (a random value when the column may not be empty)
 *   blank                               cleared
 *   json                                walked: each key by its name (JSON_KEY_RULE), other strings scrubbed
 *   scrub                               the sweep described above, named explicitly for columns known to repeat names
 * Options of an entry: party 'staff' (names and e-mail addresses masked only with --mask-staff; other personal data of
 * staff always), where (SQL condition: rows the entry applies to, the others are swept), bareName (JSON key "name" is a
 * person's name).
 */

/** Rules a catalogue entry may name. */
export const RULES = ['firstName', 'lastName', 'personName', 'companyName', 'partyName', 'email', 'emailList', 'phone', 'tin', 'contact',
  'street', 'address', 'houseNo', 'barangay', 'locality', 'province', 'postal', 'dob', 'idNumber', 'plate', 'chassis', 'engine', 'bankAccount',
  'freeText', 'fileName', 'storageKey', 'ip', 'secret', 'blank', 'json', 'scrub'];

const party = (prefix, extra = {}) => ({
  [`${prefix}.first_name`]: 'firstName', [`${prefix}.last_name`]: 'lastName', [`${prefix}.company_name`]: 'companyName',
  [`${prefix}.display_name`]: 'partyName', [`${prefix}.preferred_name`]: 'firstName', [`${prefix}.email`]: 'email', [`${prefix}.phone`]: 'phone',
  [`${prefix}.birth_date`]: 'dob', [`${prefix}.address`]: 'street', [`${prefix}.house_no`]: 'houseNo', [`${prefix}.road`]: 'street',
  [`${prefix}.soi`]: 'street', [`${prefix}.moo`]: 'street', [`${prefix}.barangay`]: 'barangay', [`${prefix}.city`]: 'locality',
  [`${prefix}.state`]: 'province', [`${prefix}.postal_code`]: 'postal', [`${prefix}.extra`]: 'json', ...extra,
});

export const CATALOGUE = {
  // ---------------------------------------------------------------- clients and prospects
  ...party('clients', { 'clients.tin': 'tin' }),
  ...party('leads', { 'leads.tax_number': 'tin', 'leads.notes': 'freeText' }),

  // ---------------------------------------------------------------- staff, referrers, signatories, insurer contacts
  'users.first_name': { rule: 'firstName', party: 'staff' },
  'users.last_name': { rule: 'lastName', party: 'staff' },
  'users.display_name': { rule: 'personName', party: 'staff' },
  'users.email': { rule: 'email', party: 'staff' },
  'users.phone': 'phone',
  'users.date_of_birth': 'dob',
  'users.address_line': 'street',
  'users.barangay': 'barangay',
  'users.city': 'locality',
  'users.province': 'province',
  'users.zip_code': 'postal',
  'users.totp_secret': 'secret',
  'users.totp_pending_secret': 'secret',
  'master_records.name': { rule: 'firstName', party: 'staff', where: "type_code = 'employee'" },
  'master_records.data': { rule: 'json', party: 'staff', where: "type_code IN ('employee', 'signatory')" },
  'signatories.name': { rule: 'personName', party: 'staff' },
  'signatories.signature_key': 'blank',
  'commission_referrers.name': 'partyName',
  'commission_referrers.email': 'email',
  'commission_referrers.phone': 'phone',
  'commission_referrers.tin': 'tin',
  'commission_referrers.bank_account_no': 'bankAccount',
  'insurance_companies.contact_person': 'personName',
  'insurance_companies.contact_email': 'email',
  'insurance_companies.contact_phone': 'phone',
  'report_schedules.recipients': { rule: 'emailList', party: 'staff' },

  // ---------------------------------------------------------------- sales, policies, placement
  'quotes.vehicle': 'json',
  'quotes.doc': 'json',
  'quotes.coverage': 'json',
  'quotes.approval_sent_to': 'contact',
  'quotes.approval_token': 'secret',
  'quotes.approval_token_hash': 'secret',
  'quotes.remarks': 'freeText',
  'work_tasks.title': 'freeText',
  'work_tasks.notes': 'freeText',
  'work_tasks.completion_note': 'freeText',
  'quote_customer_responses.remarks': 'freeText',
  'quote_customer_responses.attachment_name': 'fileName',
  'policies.insured_name': 'partyName',
  'policies.details': 'json',
  'policies.doc': 'json',
  'broker_slips.insured_name': 'partyName',
  'broker_slips.doc': 'json',
  'broker_slips.risk_details': 'json',
  'broker_slips.remarks': 'freeText',
  'placements.insured_name': 'partyName',
  'placements.doc': 'json',
  'placements.remarks': 'freeText',
  'placements.acknowledgement_remarks': 'freeText',
  'placements.epolicy': 'json',
  'placements.epolicy_document_name': 'fileName',
  'placements.check_result': 'json',
  'placements.check_reason': 'freeText',
  'insurer_offers.remarks': 'freeText',
  'insurer_offers.attachment_name': 'fileName',
  'endorsements.changes': 'json',
  'endorsements.completion': 'json',
  'endorsements.remarks': 'freeText',
  'package_quotes.insured_name': 'partyName',
  'package_quotes.doc': 'json',
  'package_quotes.location': 'address',
  'package_quotes.remarks': 'freeText',
  'package_endorsements.remarks': 'freeText',
  'risk_participants.remarks': 'freeText',
  'renewals.coverage_details': 'json',
  'renewals.accessories': 'json',
  'renewals.remarks': 'freeText',
  'renewals.approval_note': 'freeText',
  'renewal_notices.recipient': 'contact',
  'renewal_activities.description': 'freeText',
  'renewal_activities.details': 'json',
  'agent_events.description': 'freeText',

  // ---------------------------------------------------------------- claims
  'claims.driver': { rule: 'json', bareName: true },
  'claims.third_party': { rule: 'json', bareName: true },
  'claims.details': 'json',
  'claims.adjuster': 'json',
  'claims.settlement': 'json',
  'claims.policy_info': 'json',
  'claims.description': 'freeText',
  'claims.loss_address': 'street',
  'claims.loss_city': 'locality',
  'claims.loss_province': 'province',
  'claim_field_changes.old_value': 'freeText',
  'claim_field_changes.new_value': 'freeText',
  'claim_history.note': 'freeText',
  'claim_settlement_movements.payee': 'partyName',
  'claim_settlement_movements.bank_account': 'bankAccount',
  'claim_settlement_movements.remarks': 'freeText',
  'claim_settlement_movements.reversal_reason': 'freeText',
  'claims.insurer_handler': 'personName',
  'claims.insurer_handler_contact': 'contact',
  'claims.cancelled_reason': 'freeText',
  'claim_settlements.payee': 'partyName',
  'claim_settlements.decision_note': 'freeText',
  'claim_communications.subject': 'freeText',
  'claim_communications.message': 'freeText',
  'policy_lock_ins.tfs_loan_account': 'idNumber',
  'policy_lock_ins.loan_status_note': 'freeText',

  // ---------------------------------------------------------------- receivables, receipts, payments, disbursements
  'receipts.customer_name': 'partyName',
  'receipts.remarks': 'freeText',
  'checkbooks.customer_name': 'partyName',
  'disbursements.payee_name': 'partyName',
  'disbursements.referrer_name': 'partyName',
  'disbursements.remarks': 'freeText',
  'disbursements.transaction_description': 'scrub',
  'policy_payments.proof_file_name': 'fileName',
  'policy_payments.remarks': 'freeText',
  'direct_bill_client_payments.proof_file_name': 'fileName',
  'direct_bill_client_payments.remarks': 'freeText',
  'payment_links.payer_name': 'partyName',
  'payment_links.payer_email': 'email',
  'payment_links.payer_mobile': 'phone',
  'payment_links.token': 'secret',
  'payment_links.checkout_url': 'secret',
  'payment_links.outcome': 'json',
  'payment_events.payload': 'json',
  // integrations: CTPL vehicle identifiers, payee bank accounts, bank payment files, integration messages
  'ctpl_authentications.plate_number': 'plate',
  'ctpl_authentications.chassis_number': 'chassis',
  'ctpl_authentications.engine_number': 'engine',
  'ctpl_authentications.mv_file_number': 'idNumber',
  'payee_bank_accounts.payee_name': 'partyName',
  'payee_bank_accounts.account_name': 'partyName',
  'payee_bank_accounts.account_number': 'bankAccount',
  'payee_bank_accounts.email': 'email',
  'bank_payment_batch_lines.payee_name': 'partyName',
  'bank_payment_batch_lines.account_name': 'partyName',
  'bank_payment_batch_lines.account_number': 'bankAccount',
  'bank_payment_batch_lines.email': 'email',
  'bank_payment_batches.file_content': 'freeText',
  'bank_payment_batches.remarks': 'freeText',
  'integration_outbox.payload': 'json',
  'integration_outbox.response': 'json',
  'integration_inbox.payload': 'json',
  'integration_inbox.result': 'json',
  'petty_cash_requests.requester_name': { rule: 'personName', party: 'staff' },
  'petty_cash_receipts.requester_name': { rule: 'personName', party: 'staff' },
  'petty_cash_receipts.remarks': 'freeText',
  'petty_cash_disbursements.remarks': 'freeText',
  'petty_cash_replenishments.remarks': 'freeText',
  'bir_2307_certificates.payee_name': 'partyName',
  'bir_2307_certificates.payee_tin': 'tin',
  'bir_2307_certificates.payee_address': 'address',
  'bir_2307_certificates.payor_name': 'partyName',
  'bir_2307_certificates.payor_tin': 'tin',
  'bir_2307_certificates.payor_address': 'address',
  'bir_2307_certificates.lines': 'json',
  'bir_return_filings.remarks': 'freeText',
  'bir_return_filings.figures': 'json',
  'cas_documents.change_note': 'freeText',
  'cas_documents.reason': 'freeText',
  'cas_documents.approval_remarks': 'freeText',
  'cas_documents.rejection_remarks': 'freeText',
  'sales_invoices.buyer_name': 'partyName',
  'sales_invoices.buyer_tin': 'tin',
  'sales_invoices.buyer_address': 'address',
  'sales_invoices.buyer_business_style': 'partyName',
  'sales_invoices.remarks': 'freeText',
  'sales_invoice_lines.description': 'scrub',
  'eis_submissions.payload': 'json',
  'eis_submissions.response': 'json',
  'override_agreements.remarks': 'freeText',
  'override_computations.remarks': 'freeText',
  'override_computations.claims_note': 'freeText',
  'override_settlements.remarks': 'freeText',
  'commission_debit_note_lines.insured_name': 'partyName',
  'commission_debit_notes.remarks': 'freeText',
  'commission_debit_note_collections.remarks': 'freeText',
  'remittance_lines.insured_name': 'partyName',
  'remittances.agency_name': 'partyName',
  'remittances.remarks': 'freeText',
  'remittances.data': 'json',
  'remittance_items.data': 'json',
  'remittance_items.remarks': 'freeText',
  'remittance_imports.purpose_note': 'freeText',
  'remittance_imports.file_name': 'fileName',
  'remittance_approvals.remarks': 'freeText',
  'remittance_approvals.history': 'json',
  'insurer_statement_lines.insured_name': 'partyName',
  'insurer_statements.remarks': 'freeText',
  'insurer_statements.approval_remarks': 'freeText',
  'insurer_statement_resolutions.note': 'freeText',
  'bank_statement_lines.description': 'scrub',
  'bank_statement_lines.flag_remarks': 'freeText',
  'bank_statements.remarks': 'freeText',
  'bank_rec_matches.remarks': 'freeText',
  'bank_reconciliations.remarks': 'freeText',
  'bank_reconciliations.reopen_remarks': 'freeText',
  'bank_reconciliation_history.remarks': 'freeText',
  'journal_vouchers.description': 'scrub',
  'journal_lines.memo': 'scrub',
  'collection_actions.notes': 'freeText',
  'collection_items.commitment_reason': 'freeText',
  'client_credit_exceptions.remarks': 'freeText',
  'premium_instalment_plans.remarks': 'freeText',
  'premium_instalments.remarks': 'freeText',
  'premium_warranty_actions.notes': 'freeText',
  'premium_warranty_extensions.decision_remarks': 'freeText',
  'access_review_items.remarks': 'freeText',
  'sod_exceptions.reason': 'freeText',
  'user_delegations.end_reason': 'freeText',

  // ---------------------------------------------------------------- privacy, audit, messages, files, loads
  'privacy_consents.evidence': 'freeText',
  'privacy_consents.withdrawal_reason': 'freeText',
  'audit_log.before_data': 'json',
  'audit_log.after_data': 'json',
  'audit_log.ip': 'ip',
  'e_signatures.consent_ip': 'ip',
  'notifications.title': 'scrub',
  'notifications.message': 'scrub',
  'documents.file_name': 'fileName',
  'documents.storage_key': 'storageKey',
  'policy_payments.proof_key': 'storageKey',
  'direct_bill_client_payments.proof_key': 'storageKey',
  'quote_customer_responses.attachment_key': 'storageKey',
  'insurer_offers.attachment_key': 'storageKey',
  'endorsements.document_key': 'storageKey',
  'placements.epolicy_document_key': 'storageKey',
  'generated_reports.params': 'json',
  'data_load_rows.data': 'json',
  'data_load_rows.errors': 'json',
  'job_queue.payload': 'json',
  'job_queue.result': 'json',
  'job_runs.output': 'json',

  // ---------------------------------------------------------------- client due diligence (migration 0260)
  'clients.middle_name': 'firstName',
  'clients.suffix': 'blank',
  'clients.place_of_birth': 'locality',
  'clients.occupation': 'freeText',
  'clients.employer_name': 'companyName',
  'clients.source_of_funds': 'freeText',
  'clients.id_number': 'idNumber',
  'clients.trade_name': 'companyName',
  'clients.registration_number': 'idNumber',
  'clients.pep_details': 'freeText',
  'client_signatories.full_name': 'personName',
  'client_signatories.birth_date': 'dob',
  'client_signatories.id_number': 'idNumber',
  'client_beneficial_owners.full_name': 'personName',
  'client_beneficial_owners.birth_date': 'dob',
  'client_beneficial_owners.id_number': 'idNumber',
  'client_beneficial_owners.address': 'address',
  'client_beneficial_owners.pep_details': 'freeText',
  'client_kyc_documents.file_name': 'fileName',
  'client_kyc_documents.storage_key': 'storageKey',
  'client_kyc_documents.description': 'freeText',
  // ---------------------------------------------------------------- operations and accounting (migrations 0290 to 0297)
  'cover_notes.insured_name': 'partyName',
  'cover_notes.risk_description': 'scrub',
  'cover_notes.conditions': 'freeText',
  'post_dated_cheques.remarks': 'freeText',
  'claim_document_reminders.recipient_email': 'email',
  'claim_repair_estimates.adjuster_name': 'personName',
  'claim_repair_estimates.decision_remarks': 'freeText',
  'claim_loas.remarks': 'freeText',
  'claim_vehicle_releases.released_to': 'personName',
  'claim_vehicle_releases.remarks': 'freeText',
  'supplier_payments.remarks': 'freeText',
  'fixed_assets.custodian': { rule: 'personName', party: 'staff' },
  'fixed_assets.disposal_remarks': 'freeText',
  // ---------------------------------------------------------------- sales activities and asset disposals (0320, 0321)
  'sales_activities.subject': 'freeText',
  'sales_activities.notes': 'freeText',
  'sales_activities.contact_person': 'personName',
  'sales_activities.location': 'address',
  'sales_activities.next_step': 'freeText',
  'sales_activities.cancel_reason': 'freeText',
  'fixed_asset_disposals.buyer_name': 'partyName',
  'fixed_asset_disposals.buyer_tin': 'tin',
  'fixed_asset_disposals.buyer_address': 'address',
  'fixed_asset_disposals.reason': 'freeText',
  'fixed_asset_disposals.cancel_reason': 'freeText',
  // ---------------------------------------------------------------- distribution, programmes and products (0300 to 0308)
  'distribution_channels.contact_person': 'personName',
  'distribution_channels.contact_email': 'email',
  'distribution_channels.contact_phone': 'phone',
  'distribution_channels.tin': 'tin',
  'distribution_channels.address': 'address',
  'distribution_channels.notes': 'freeText',
  'motor_programmes.notes': 'freeText',
  'dealer_sales_batches.file_name': 'fileName',
  'dealer_sales.buyer_first_name': 'firstName',
  'dealer_sales.buyer_last_name': 'lastName',
  'dealer_sales.buyer_company_name': 'companyName',
  'dealer_sales.buyer_email': 'email',
  'dealer_sales.buyer_phone': 'phone',
  'dealer_sales.buyer_address': 'street',
  'dealer_sales.plate_number': 'plate',
  'dealer_sales.conduction_sticker': 'plate',
  'dealer_sales.chassis_number': 'chassis',
  'dealer_sales.engine_number': 'engine',
  'fleet_vehicles.plate_number': 'plate',
  'fleet_vehicles.conduction_sticker': 'plate',
  'fleet_vehicles.chassis_number': 'chassis',
  'fleet_vehicles.engine_number': 'engine',
  'open_cover_declarations.notes': 'freeText',
  'open_cover_certificates.consignee': 'partyName',
  'comparison_reports.prepared_for': 'partyName',
  'comparison_reports.sent_to': 'email',
  'campaigns.notes': 'freeText',
  // remarks given with the approval of an incentive batch (migration 0387)
  'incentive_calculations.approval_remarks': 'freeText',
  'campaign_recipients.party_name': 'partyName',
  'campaign_recipients.email': 'email',
};

/** Tables emptied: credentials, sign-in sessions and history, and messages addressed to real people. */
export const TABLE_ACTIONS = {
  email_outbox: 'delete: queued and sent e-mails to real clients (addresses, bodies, attachments); a masked copy sends none',
  refresh_tokens: 'delete: sign-in sessions of production',
  password_resets: 'delete: password reset codes',
  password_history: 'delete: hashes of production passwords (every password is reset)',
  login_history: 'delete: sign-in history (IP addresses, devices) of production',
};

/**
 * Columns kept as they are although their name looks personal or the data dictionary classifies them as personal.
 * "table.*" keeps every column of a table (configuration and master tables without personal data).
 */
export const ALLOW_LIST = {
  // people tables: what testing needs and is not personal once names, contacts and identifiers are masked
  'users.username': 'sign-in name kept so testers can sign in with the roles of production (owners, approvers, scoping)',
  'users.password_hash': 'replaced by the masking step itself (every password reset, or sign-in disabled except the named administrator)',
  'users.employee_code': 'internal staff code, needed for approvals and reports; not personal once names are masked',
  'users.department': 'organisational unit, needed for scoping and approvals',
  'users.designation': 'job title, needed for the authority matrix and approvals',
  'users.reporting_to': 'reference to another user (reporting line), needed for approvals',
  'users.branch_code': 'organisational unit',
  'users.gender': 'kept for testing; not identifying once names, contacts and identifiers are masked',
  'users.country': 'country only',
  'clients.gender': 'kept for rating and statistics tests; not identifying once names, contacts and identifiers are masked',
  'leads.gender': 'kept for rating and statistics tests; not identifying once names, contacts and identifiers are masked',
  'clients.country': 'country only',
  'clients.nationality': 'nationality only; not identifying once names, contacts and identifiers are masked',
  'clients.civil_status': 'civil status category; not identifying once names, contacts and identifiers are masked',
  'client_signatories.nationality': 'nationality only',
  'client_beneficial_owners.nationality': 'nationality only',
  'leads.country': 'country only',
  'clients.anonymised_by': 'username of the staff member who anonymised the record',
  'leads.anonymised_by': 'username of the staff member who anonymised the record',
  'signatories.designation': 'job title printed under the signature',
  'commission_referrers.bank_name': 'name of the bank (an institution), not of the person; the account number is masked',
  'access_review_items.last_login_at': 'date and time only; the user is identified by the kept username',
  'access_review_items.apply_note': 'written by the system: account already inactive, or role codes no longer held',
  'users.last_login_at': 'date and time only',
  'feature_entitlements.signature': 'HMAC signature of a feature entitlement (modules/features); no personal data, and the entitlement is void without it',
  'feature_changes.remarks': 'decision remarks of the platform administrators on a feature change; about releases, never about clients',
  'login_history.*': 'table emptied (TABLE_ACTIONS)',
  'refresh_tokens.*': 'table emptied (TABLE_ACTIONS)',
  'password_resets.*': 'table emptied (TABLE_ACTIONS)',
  'password_history.*': 'table emptied (TABLE_ACTIONS)',
  'email_outbox.*': 'table emptied (TABLE_ACTIONS)',
  'brand_pack_enablements.trademark_owner': 'owner of the trademarks of a bundled brand pack (a company named in the pack manifest, not a person)',
  'audit_log.username': 'staff username (kept like users.username)',
  'claim_field_changes.username': 'staff username (kept like users.username)',
  'claim_field_changes.field_name': 'name of the field changed, not a value',
  'insurance_companies.name': 'insurer (a company), business data',
  'insurance_companies.short_name': 'insurer (a company), business data',
  'insurance_companies.address': 'business address of an insurer',
  'insurance_companies.tin': 'TIN of an insurer (a company); like every text column it is swept, so it becomes a masked TIN',
  'disbursements.insurer_name': 'insurer (a company), business data',
  'disbursements.payee_type': 'kind of payee, not a name',
  'disbursements.payee_id': 'reference to the payee record',
  'invoice_lists.payee_type': 'kind of payee, not a name',
  'bir_2307_certificates.payee_key': 'reference to the payee record',
  'sales_invoice_payments.bank_account': 'the broker\'s own bank account (chart of accounts code)',
  'override_settlements.bank_account': 'the broker\'s own bank account (chart of accounts code)',
  'eis_submissions.signature_alg': 'name of the signing algorithm',
  'eis_submissions.signature': 'signature of the e-invoice payload (a hash, not a person\'s signature)',
  'sales_invoices.seller': 'the broker\'s own registered details (snapshot)',
  'bank_statements.file_name': 'bank statement file name chosen by the broker (bank and period)',
  'bank_statements.bank_account_code': 'the broker\'s own bank account (chart of accounts code)',
  'bank_reconciliations.bank_account_code': 'the broker\'s own bank account (chart of accounts code)',
  'bank_payment_batches.bank_account_code': 'the broker\'s own bank account (bank account master code)',
  'bank_payment_batches.file_name': 'file name built from the bank, batch number and value date',
  'bir_dat_files.file_name': 'file name built from the broker\'s TIN, branch code, period and form',
  'sap_gl_export_files.file_name': 'file name built from the SAP layout and the export date',
  'bank_file_layouts.file_name_pattern': 'configuration: pattern of a bank file name',
  'coc_series.remarks': 'remarks on a COC number series received from an insurer (business data)',
  'insurer_api_mappings.remarks': 'remarks on an insurer API mapping (configuration)',
  'receipts.bank_account_code': 'the broker\'s own bank account (chart of accounts code)',
  'payment_gateways.*': 'payment gateway configuration (the broker\'s own accounts)',
  'petty_cash_funds.*': 'petty cash fund configuration',
  'insurer_statements.file_name': 'insurer statement file name (insurer and period)',
  'data_load_batches.file_name': 'go-live workbook file name chosen by the project team',
  'data_load_comparisons.file_name': 'comparison workbook file name chosen by the project team (environment and date)',
  'generated_reports.file_name': 'system-generated report file name (report and period)',
  'generated_reports.name': 'report name',
  'commissions.receipt_no': 'document number',
  'petty_cash_receipts.receipt_number': 'document number',
  'petty_cash_receipts.receipt_date': 'document date',
  'receipts.receipt_number': 'document number',
  'quotes.broker_slip_id': 'reference',
  'placements.broker_slip_id': 'reference',
  'insurer_offers.broker_slip_id': 'reference',
  'broker_slips.slip_number': 'document number',
  'renewal_quotes.rating': 'rating factors (JSON of numbers)',
  'premium_warranty_actions.email_id': 'reference to an e-mail outbox row',
  'renewal_notices.email_id': 'reference to an e-mail outbox row',
  'claim_communications.email_id': 'reference to an e-mail outbox row',
  'collection_actions.email_id': 'reference to an e-mail outbox row',
  'bank_statements.bank_account_id': 'the broker\'s own bank account (reference)',
  'bank_statement_lines.bank_account_id': 'the broker\'s own bank account (reference)',
  'bank_rec_matches.bank_account_id': 'the broker\'s own bank account (reference)',
  'bank_reconciliations.bank_account_id': 'the broker\'s own bank account (reference)',
  'access_reviews.name': 'name of the access review campaign',
  'winback_campaigns.name': 'name of the campaign',
  // configuration and masters without personal data (names here are of products, accounts, places, rules, roles)
  'app_settings.*': 'configuration; swept for e-mail addresses, mobile numbers and TINs',
  'authority_limits.*': 'configuration', 'authority_transaction_types.*': 'configuration', 'bank_match_rules.*': 'configuration',
  'bank_statement_formats.*': 'configuration', 'bank_transaction_types.*': 'configuration', 'banks.*': 'master of banks (institutions)',
  'branches.*': 'branches of the broker (business addresses)', 'cities.*': 'places', 'countries.*': 'places', 'states.*': 'places',
  'districts.*': 'places', 'postal_codes.*': 'places', 'currencies.*': 'configuration', 'document_numbering.*': 'configuration',
  'gl_accounts.*': 'chart of accounts', 'incentive_programs.*': 'configuration', 'insurer_statement_formats.*': 'configuration',
  'insurer_rate_tables.*': 'configuration', 'lgu_tax_rates.*': 'configuration', 'package_bundles.*': 'configuration',
  'package_bundle_sections.*': 'configuration', 'package_sections.*': 'cover sections of a package sold (no personal data)',
  'permissions.*': 'configuration', 'policy_types.*': 'configuration', 'posting_rules.*': 'configuration', 'posting_rule_lines.*': 'configuration',
  'premium_charge_rules.*': 'configuration', 'product_components.*': 'configuration', 'product_risk_mappings.*': 'configuration',
  'product_risk_sections.*': 'configuration', 'product_templates.*': 'configuration', 'products.*': 'configuration', 'coverages.*': 'configuration',
  'recurring_journals.*': 'configuration of recurring entries',
  'report_definitions.*': 'configuration', 'report_schedules.name': 'name of the schedule', 'roles.*': 'configuration',
  'scheduled_jobs.*': 'configuration', 'schema_migrations.*': 'schema history', 'sequences.*': 'number counters', 'sod_rules.*': 'configuration',
  'tax_codes.*': 'configuration', 'vehicle_brands.*': 'vehicle catalogue', 'vehicle_models.*': 'vehicle catalogue',
  'vehicle_variants.*': 'vehicle catalogue', 'write_off_reasons.*': 'configuration', 'master_types.*': 'configuration',
  'commission_rates.*': 'configuration', 'period_close_checklist.*': 'configuration', 'master_records.*': 'generic masters; employee and signatory records are catalogued (where)',
  'accounting_config_changes.*': 'configuration change requests (accounts and rules)',
  'journal_lines.account_name': 'account name of the chart of accounts', 'journal_lines.main_account_description': 'account description',
  'journal_lines.sub_account_description': 'account description', 'journal_lines.branch_description': 'branch name',
  'journal_lines.department_description': 'department name',
  // accounting and period-end remarks: operational notes of the accounting team, swept like other text
  'accounting_periods.remarks': 'period-end note of the accounting team (swept)', 'fiscal_years.remarks': 'year-end note of the accounting team (swept)',
  'period_close_runs.remarks': 'period-end note (swept)', 'period_close_run_checks.remarks': 'period-end check note (swept)',
  'period_status_history.remarks': 'period-end note (swept)', 'year_end_runs.remarks': 'year-end note (swept)',
  'year_end_run_history.remarks': 'year-end reason or approval remark (swept)',
  'accounting_periods.*': 'accounting calendar', 'incentive_calculations.description': 'description of the calculation run (swept)',
  'bank_statement_lines.line_hash': 'hash of the statement line (duplicate detection)', 'bank_statements.file_hash': 'hash of the file',
  'insurer_statements.file_hash': 'hash of the file', 'renewal_activities.outcome': 'outcome code', 'quote_customer_responses.outcome': 'outcome code',
  'collection_actions.call_outcome': 'outcome code',
  'payment_links.description': 'what is paid (policy, bill), swept', 'payment_links.receipt_id': 'reference',
  'receipt_applications.receipt_id': 'reference', 'receipt_applications.receipt_line_id': 'reference', 'receipt_lines.receipt_id': 'reference',
  'invoice_lists.receipt_id': 'reference', 'policy_payments.receipt_id': 'reference', 'commission_debit_note_lines.debit_note_id': 'reference',
  'commission_debit_note_collections.debit_note_id': 'reference', 'direct_bill_items.debit_note_id': 'reference',
  'email_outbox.template': 'template code',
  'signatories.*': 'signatory master: name and signature catalogued',
  'remittance_approvals.description': 'description of the approval step (swept)',
  'petty_cash_requests.requester_user_id': 'reference',
  'claim_document_reminders.email_id': 'reference to the e-mail outbox row',
  'distribution_channels.letter_addressee': 'a position at a bank ("The Manager, Auto Loans"), not a person',
  'motor_programmes.subsidy_payer': 'code: none, dealer or bank',
  'fixed_asset_disposals.bank_account': 'code of the broker\'s own bank account the sale proceeds were received into (Bank Account master)',
  // blind indexes of the encrypted identifiers (migration 0277): keyed hashes, recomputed by the encryption trigger when the
  // identifier is masked
  'clients.tin_bidx': 'blind index (keyed hash) of the encrypted TIN, recomputed when the TIN is masked',
  'leads.tax_number_bidx': 'blind index (keyed hash) of the encrypted TIN, recomputed when the TIN is masked',
  'commission_referrers.tin_bidx': 'blind index (keyed hash) of the encrypted TIN, recomputed when the TIN is masked',
  'commission_referrers.bank_account_no_bidx': 'blind index (keyed hash) of the encrypted bank account number, recomputed when it is masked',
};

/**
 * A column whose name suggests personal data. The test requires each such column to be in CATALOGUE or ALLOW_LIST.
 */
export const PERSONAL_NAME_RE = new RegExp([
  '(^|_)(first|last|middle|maiden|display|preferred|full|given|family)_name$',
  '(^|_)(insured|payee|payer|payor|requester|referrer|driver|customer|beneficiary|claimant|contact|holder|owner|witness|recipient)(_name|_person)?$',
  'e_?mail', 'phone', 'mobile', '(^|_)fax($|_)', 'address', 'street', 'barangay', '(^|_)house_no$', '(^|_)zip', 'postal',
  '(^|_)tin($|_)', 'tax_number', 'tax_id', 'birth', '(^|_)dob$', 'passport', 'licen[cs]e_(no|number)', 'id_number', '(^|_)id_no$',
  'account_no$', 'account_number', 'bank_account', 'plate', 'chassis', 'engine_no', 'engine_number', 'recipients?$',
  'remarks', '(^|_)notes?$', 'comment', '(^|_)ip$', 'user_agent', 'password', 'secret', 'token', 'gender', 'nationality', 'occupation',
  'civil_status', 'signature', 'username', 'employee_code', 'file_name', 'attachment_name', '(^|_)requester_contact$', '(^|_)insured$',
].join('|'));

/** The entry for a column ({ rule, party, where, bareName }) or null. */
export function catalogueEntry(table, column) {
  const e = CATALOGUE[`${table}.${column}`];
  if (!e) return null;
  return typeof e === 'string' ? { rule: e } : e;
}

/** The reason a column is kept as it is, or null. */
export function allowReason(table, column) {
  return ALLOW_LIST[`${table}.${column}`] || ALLOW_LIST[`${table}.*`] || (TABLE_ACTIONS[table] ? `table emptied: ${TABLE_ACTIONS[table]}` : null);
}

/** Split a JSON key into lower-case words: insuredName, insured_name, Insured Name -> ['insured', 'name']. */
export const keyWords = (k) => String(k).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
  .split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w.toLowerCase());

const set = (s) => new Set(s.split(/\s+/));
const FIRST_KEYS = set('firstname givenname');
const LAST_KEYS = set('lastname surname familyname middlename maidenname');
const PARTY_KEYS = set(`fullname displayname insuredname assuredname clientname customername policyholdername holdername drivername
  driversname thirdpartyname payeename payername payorname requestername partyname participantname beneficiary policybeneficiary contactperson
  witnessname agentname referrername leadname signatoryname assignedtoname approvedbyname reportedbyname preparedbyname registeredname insured
  claimant claimantname ownername preferredname employeename beneficiaryname bankaccountname nameofinsured insuredperson
  adjustername`);
const PHONE_KEYS = set('phone mobile telephone landline fax contactnumber contactno mobileno phoneno telno phonenumber mobilenumber faxnumber cellphone cellno');
const TIN_KEYS = set('tin tinno tinnumber taxnumber taxid taxidentificationnumber payeetin payortin');
const DOB_KEYS = set('birthdate dateofbirth dob birthday');
const ID_KEYS = set(`idnumber idno idcardnumber idcardno governmentidno umidnumber philsysnumber passport passportno passportnumber licenseno licensenumber licencenumber licenceno driverslicense driverslicenseno
  driverslicensenumber mvfilenumber mvfileno sss sssno sssnumber gsis gsisno philhealth philhealthno pagibig pagibigno umid umidno governmentid
  governmentidnumber nationalid philsys philsysno crno policeclearance`);
const BANK_KEYS = set('accountnumber accountno bankaccount bankaccountno bankaccountnumber iban cardnumber');
const PLATE_KEYS = set('platenumber plateno plate thirdpartyplatenumber conductionsticker conductionstickerno plateormvfile');
const CHASSIS_KEYS = set('chassisnumber chassisno vin vinnumber serialnumber serialno');
const ENGINE_KEYS = set('enginenumber engineno motorno motornumber');
const STREET_KEYS = set('street streetaddress houseno housenumber road soi moo building unitno blocklot');
const LOCALITY_KEYS = set('city cityname municipality');
const PROVINCE_KEYS = set('province state statename');
const POSTAL_KEYS = set('zip zipcode postalcode pincode postcode');
const FREE_KEYS = set(`remarks remark notes note comment comments narrative observations resolutionnotes responsenotes approveremarks
  decisionremarks approvalnote withdrawalreason evidence`);
const SECRET_KEYS = set('password passwd secret token accesstoken refreshtoken otp approvaltoken pin');
const IP_KEYS = set('ip ipaddress remoteaddr');

/**
 * Masking rule of a JSON key (scripts/mask-data.js walks JSON documents): one of the rules above, 'keep' (identifiers,
 * codes, usernames, URLs: left alone except storage keys) or null (the string is scrubbed). parentWords: words of the
 * enclosing key (a "name" inside "driver" is a person's name), bareName: a bare "name" is a person's name.
 */
export function jsonKeyRule(key, { parentWords = [], bareName = false } = {}) {
  const w = keyWords(key);
  if (!w.length) return null;
  const j = w.join('');
  const last = w[w.length - 1];
  if (IP_KEYS.has(j) || (last === 'ip')) return 'ip';
  if (j.includes('email') && !j.includes('template') && !j.includes('enabled') && !j.includes('sent') && !j.includes('status')) return 'emailList';
  if (['recipients', 'emailedto', 'cc', 'bcc', 'to'].includes(j)) return 'emailList';
  if (FIRST_KEYS.has(j)) return 'firstName';
  if (LAST_KEYS.has(j)) return 'lastName';
  if (PARTY_KEYS.has(j)) return 'partyName';
  if (j === 'name' && (bareName || parentWords.some((p) => ['driver', 'insured', 'customer', 'client', 'lead', 'claimant', 'witness', 'payer',
    'payee', 'owner', 'beneficiary', 'contact', 'holder', 'requester', 'party', 'person', 'third', 'employee', 'referrer', 'customerinfo'].includes(p)))) return 'partyName';
  if (PHONE_KEYS.has(j) || w.includes('phone') || w.includes('mobile') || (last === 'number' && w.includes('contact'))) return 'phone';
  if (TIN_KEYS.has(j) || last === 'tin') return 'tin';
  if (DOB_KEYS.has(j) || (w.includes('birth') && !w.includes('place'))) return 'dob';
  if (ID_KEYS.has(j) || (w.includes('license') && (last === 'number' || last === 'no')) || w.includes('passport')) return 'idNumber';
  if (BANK_KEYS.has(j) || (w.includes('account') && ['number', 'no'].includes(last) && !w.includes('gl'))) return 'bankAccount';
  if (PLATE_KEYS.has(j) || w.includes('plate')) return 'plate';
  if (CHASSIS_KEYS.has(j) || w.includes('chassis')) return 'chassis';
  if (ENGINE_KEYS.has(j) || (w.includes('engine') && ['number', 'no'].includes(last))) return 'engine';
  if (j === 'barangay' || j === 'brgy') return 'barangay';
  if (w.includes('address') && !w.includes('email') && !w.includes('ip')) return 'address';
  if (/^addressline\d*$/.test(j)) return 'address';
  if (STREET_KEYS.has(j)) return 'street';
  if (LOCALITY_KEYS.has(j)) return 'locality';
  if (PROVINCE_KEYS.has(j)) return 'province';
  if (POSTAL_KEYS.has(j)) return 'postal';
  if (j === 'contact' || last === 'contact') return 'contact';
  if (FREE_KEYS.has(j)) return 'freeText';
  if (SECRET_KEYS.has(j) || last === 'token' || last === 'secret' || last === 'password') return 'secret';
  if (j === 'id' || last === 'id' || last === 'ids' || last === 'by' || j === 'by' || j === 'username' || last === 'username'
    || last === 'code' || last === 'url' || last === 'key' || last === 'path' || last === 'link' || j === 'status' || last === 'type') return 'keep';
  return null;
}
