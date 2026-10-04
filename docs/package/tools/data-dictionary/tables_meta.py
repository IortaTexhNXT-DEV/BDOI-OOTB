"""Functional area, owning module and description of every BrokerVerse table (data dictionary)."""
import sys
from ddpaths import ARCH_TOOLS
sys.path.insert(0, ARCH_TOOLS)
import table_catalog as tc

AREAS = [
    'Party and client',
    'Product and rating',
    'Sales and quotation',
    'Placement',
    'Policy and endorsement',
    'Billing, receipts and payments',
    'Remittance and insurer accounting',
    'Commission',
    'Claims',
    'Renewals',
    'General ledger and period end',
    'Bank and insurer reconciliation',
    'Credit control',
    'Reinsurance',
    'Incentives',
    'Security and audit',
    'Configuration and schedules',
    'Distribution and marketing',
    'Fleet, marine and motor claims',
    'Payables and fixed assets',
    'BIR returns and invoicing',
    'Compliance',
    'Integrations',
]

AREA_TABLES = {
    'Party and client': 'clients insurance_companies banks branches signatories countries regions states cities districts postal_codes '
                        'client_signatories client_beneficial_owners client_kyc_documents',
    'Product and rating': 'products policy_types coverages vehicle_brands vehicle_models vehicle_variants product_templates product_components '
                          'product_risk_mappings product_risk_sections premium_charge_rules lgu_tax_rates insurer_rate_tables package_bundles package_bundle_sections',
    'Sales and quotation': 'leads quotes quote_customer_responses package_quotes package_sections payment_gateways payment_links payment_events agent_events',
    'Placement': 'broker_slips insurer_offers placements risk_participants',
    'Policy and endorsement': 'policies endorsements package_endorsements policy_payments cover_notes',
    'Billing, receipts and payments': 'receivables receivable_participants receivable_credits receipts receipt_lines receipt_applications write_off_reasons '
                                      'disbursements invoice_lists checkbooks petty_cash_funds petty_cash_requests petty_cash_request_lines petty_cash_disbursements '
                                      'petty_cash_receipts petty_cash_replenishments post_dated_cheques',
    'Remittance and insurer accounting': 'remittances remittance_lines remittance_items remittance_allocations remittance_approvals remittance_delegations '
                                         'insurer_refund_credits direct_bill_items direct_bill_client_payments commission_debit_notes commission_debit_note_lines '
                                         'commission_debit_note_collections',
    'Commission': 'commissions commission_adjustments commission_rates commission_referrers override_agreements override_agreement_tiers '
                  'override_computations override_settlements',
    'Claims': 'claims claim_history claim_field_changes claim_settlement_movements claim_document_items claim_document_reminders',
    'Renewals': 'renewals renewal_quotes renewal_notices renewal_activities renewal_batches renewal_batch_policies winback_campaigns',
    'General ledger and period end': 'gl_accounts journal_vouchers journal_lines entry_matches posting_rules posting_rule_lines accounting_config_changes '
                                     'accounting_periods fiscal_years opening_balances period_close_checklist period_close_runs period_close_run_checks '
                                     'period_close_entries period_status_history recurring_journals recurring_journal_runs year_end_runs tax_codes bir_2307_certificates',
    'Bank and insurer reconciliation': 'bank_statement_formats bank_statements bank_statement_lines bank_transaction_types bank_match_rules bank_rec_matches '
                                       'bank_rec_match_items bank_reconciliations bank_reconciliation_history bank_account_links bank_book_lines '
                                       'insurer_statement_formats insurer_statements insurer_statement_lines insurer_statement_resolutions',
    'Credit control': 'collection_items collection_actions premium_instalment_plans premium_instalments premium_warranty_extensions premium_warranty_actions '
                      'client_credit_exceptions',
    'Reinsurance': 'reinsurers reinsurance_treaties cessions reinsurance_recoveries reinsurance_bordereaux reinsurance_reconciliations reinsurance_exceptions '
                   'fac_placements fac_placement_shares fac_settlements',
    'Incentives': 'incentive_programs incentive_calculations incentive_results',
    'Security and audit': 'users roles permissions role_permissions user_roles refresh_tokens password_resets password_history login_history audit_log '
                          'authority_transaction_types authority_limits sod_rules user_delegations access_reviews access_review_items',
    'Configuration and schedules': 'app_settings master_types master_records currencies document_numbering sequences scheduled_jobs job_runs job_queue '
                                   'notifications email_outbox documents report_definitions report_schedules generated_reports schema_migrations '
                                   'report_builder_reports bi_extract_runs data_load_batches data_load_rows data_load_comparisons work_tasks '
                                   'e_signatures document_signature_slots',
    'Distribution and marketing': 'lead_assignment_rules lead_assignment_history distribution_channels channel_billing_accounts motor_programmes '
                                  'dealer_sales_batches dealer_sales comparison_reports campaigns campaign_segments campaign_templates campaign_recipients '
                                  'sales_activities',
    'Fleet, marine and motor claims': 'fleet_schedules fleet_vehicles open_covers open_cover_certificates open_cover_declarations claim_repair_estimates '
                                      'claim_loas claim_vehicle_releases',
    'Payables and fixed assets': 'supplier_invoices supplier_invoice_lines supplier_payments supplier_payment_allocations fixed_assets '
                                 'fixed_asset_depreciation fixed_asset_disposals',
    'BIR returns and invoicing': 'bir_return_filings sales_invoices sales_invoice_lines sales_invoice_payments cas_book_prints eis_submissions',
    'Compliance': 'aml_risk_factors aml_risk_assessments aml_edd_reviews aml_screening_lists aml_list_versions aml_list_entries aml_screenings '
                  'aml_screening_hits aml_provider_requests aml_rules aml_alerts aml_cases aml_reports aml_report_items compliance_licences '
                  'compliance_licence_reminders compliance_fit_proper ic_statement_lines complaints complaint_reminders personal_data_breaches '
                  'personal_data_breach_reminders privacy_consents data_subject_requests',
    'Integrations': 'integration_connectors integration_outbox integration_attempts integration_inbox message_templates coc_series '
                    'ctpl_authentications insurer_api_mappings bank_file_layouts payee_bank_accounts bank_payment_batches bank_payment_batch_lines',
}
AREA_OF = {t: a for a, ts in AREA_TABLES.items() for t in ts.split()}

# module, description, retention class for the tables added after the architecture catalogue was written,
# and corrected descriptions for a few catalogue entries.
NEW = {
    'access_reviews': ('access-control', 'Periodic access review (recertification) campaign: scope, reviewer, due date and closure', 'LOG'),
    'access_review_items': ('access-control', "One user in an access review: the roles held, last sign-in and the reviewer's decision to keep or revoke", 'LOG'),
    'accounting_config_changes': ('posting-rules', 'Pending, approved or rejected changes to posting rules and account determination (maker-checker); a change takes effect only on approval by a different user', 'LOG'),
    'authority_limits': ('access-control', 'Authority matrix: approval limit per role or per user and transaction type, effective once approved by another administrator', 'REF'),
    'authority_transaction_types': ('access-control', 'Transactions that need an approver and are limited by amount or percent (authority matrix rows)', 'REF'),
    'sod_rules': ('access-control', 'Segregation-of-duties rules: pairs of roles one person should not hold together, with block or warn', 'REF'),
    'user_delegations': ('access-control', "Out-of-office delegation: the delegate may approve with the delegator's authority for the listed transaction types and dates", 'REF'),
    'client_credit_exceptions': ('credit-control', "Policies issued beyond a client's credit limit: exposure before and after, and Accounting's acknowledgement", 'LOG'),
    'premium_instalment_plans': ('credit-control', 'Instalment plan of a premium bill: frequency, number of instalments, first due date and down payment', 'FIN'),
    'premium_instalments': ('credit-control', 'Instalments of a plan: sequence, due date and amount', 'FIN'),
    'premium_warranty_extensions': ('credit-control', 'Requests to extend the premium payment warranty deadline of a policy (maker-checker)', 'TXN'),
    'premium_warranty_actions': ('credit-control', 'Premium warranty monitor actions: reminders, extension decisions and cancellation requests', 'LOG'),
    'direct_bill_client_payments': ('remittance (direct bill)', "Client's premium payment made directly to the insurer on a direct-billed policy, with the insurer's receipt reference and proof; no journal is posted", 'FIN'),
    'insurer_statement_formats': ('insurer-reconciliation', "Column mapping of an insurer's statement export (CSV or XLSX)", 'REF'),
    'insurer_statements': ('insurer-reconciliation', 'Imported insurer statement of account (ISR): premium remittance confirmation or commission statement, totals, sign-off', 'FIN'),
    'insurer_statement_lines': ('insurer-reconciliation', "Lines of an insurer statement with their match to the broker's remittance line, debit note line or policy and the differences", 'FIN'),
    'insurer_statement_resolutions': ('insurer-reconciliation', 'How a statement difference, or a broker record missing on the statement, was settled: note or adjustment journal', 'FIN'),
    'insurer_rate_tables': ('packages', 'Insurer rates per product for the quick quote comparison of packaged products: rate basis, minimum premium, deductible, commission', 'REF'),
    'lgu_tax_rates': ('premium-charges', 'Local government (LGT) tax rates per province or city with effective dates', 'REF'),
    'premium_charge_rules': ('premium-charges', 'Premium charge rules (VAT, premium tax, DST, FST, LGT, other): method, rate, unit size, minimum and effective dates', 'REF'),
    'package_bundles': ('packages', 'Packaged product bundles (for example a multi-line SME cover): segment, term, discount, online issue', 'REF'),
    'package_bundle_sections': ('packages', 'Sections of a bundle: product, default sum insured, rate, minimum premium and the insurers that may carry it', 'REF'),
    'package_quotes': ('packages', 'Bundle quotations: client, location, premium, discount, taxes, commission and status', 'TXN'),
    'package_sections': ('packages', 'Priced sections of a bundle quotation or package policy, each with its insurer, premium, taxes and commission', 'TXN'),
    'package_endorsements': ('packages', 'Endorsements of one section of a package policy: change of sum insured and the additional premium billed', 'TXN'),
    'payment_gateways': ('payment-gateway', 'Online payment gateways (Dragonpay, PayMongo, sandbox): mode, methods, fee handling, link validity; credentials stay in the environment', 'REF'),
    'payment_links': ('payment-gateway', 'Payment links sent to a client to pay a package quotation, quotation or policy premium online, and the result', 'FIN'),
    'payment_events': ('payment-gateway', 'Every notification received from a payment gateway (or simulated), valid or not: the payments log', 'LOG'),
    'quote_customer_responses': ('quotations', "Customer responses to a quotation recorded by staff (phone, Viber, meeting, signed form) as evidence of the status change", 'LOG'),
    'bank_account_links': ('bank-reconciliation', 'View: bank account masters with their GL cash account', 'REF'),
    'bank_book_lines': ('bank-reconciliation', 'View: posted journal lines on bank cash accounts, the book side of bank matching', 'FIN'),
    'privacy_consents': ('privacy', 'Consent given, refused or withdrawn by a client or prospect per purpose (processing, marketing, sharing), with channel, notice version and evidence; never deleted', 'LOG'),
    'data_subject_requests': ('privacy', 'Register of data subject requests (DSR-): type, requester, party, date received, due date, status, assignee, outcome and the exports and anonymisation done', 'LOG'),
    'roles': ('users', 'Role catalogue: System Administrator, Sales & Marketing, Processing Team, Operations, Claims, Accounting, Accounting Manager and custom roles; a role may inherit another', 'REF'),
    'permissions': ('users', 'Permission codes read:<module>, write:<module> and approve:<area> granted to roles', 'REF'),
}

RET = {'FIN': 'Financial', 'TXN': 'Transaction', 'REF': 'Reference', 'LOG': 'Log / audit', 'TMP': 'Temporary'}


def table_info(t):
    if t in NEW:
        mod, desc, ret = NEW[t]
    elif t in tc.TABLES:
        _, mod, desc, ret = tc.TABLES[t]
    else:
        raise KeyError(t)
    return AREA_OF[t], mod, desc, RET[ret]
