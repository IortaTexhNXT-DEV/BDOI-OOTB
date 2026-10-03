"""Table-specific column descriptions (table.column|description)."""
T = r"""
access_review_items.review_id|Access review the item belongs to
access_review_items.decision|Reviewer's decision on the user's access
access_review_items.decided_by|Reviewer who recorded the decision
access_review_items.roles|Roles the user held when the review was opened
access_review_items.last_login_at|Last successful sign-in of the user when the review was opened
access_reviews.closed_by|User who closed the review
accounting_config_changes.rule_id|Posting rule version concerned: the pending version, or the version to activate or deactivate
accounting_config_changes.before|Value in force when the change was requested (JSON)
accounting_config_changes.target|What is changed: event code, rule id, account role, map name or commission-taxes
accounting_periods.period|Accounting period key (YYYY-MM); period 13 of a fiscal year is the year-end adjustment period
accounting_periods.period_no|Period number within the fiscal year (1 to 12, 13 for the adjustment period)
accounting_periods.is_adjustment|Yes for the adjustment period 13 used by the year-end close
accounting_periods.soft_closed_by|User who soft-closed the period (only authorised users may still post)
accounting_periods.soft_closed_at|Date and time the period was soft-closed
accounting_periods.locked_at|Date and time the period was locked by the year-end close; a locked period cannot be reopened
agent_events.event_date|Calendar date of the event or reminder
agent_events.start_time|Start time of the event (HH:MM)
agent_events.end_time|End time of the event (HH:MM)
app_settings.key|Setting key in the form group.name (for example tax.vat_rate, general.timezone)
app_settings.value|Value of the setting (JSON: number, text, boolean, list or object)
app_settings.group|Settings group shown as a section of System Settings or Master > Configuration
app_settings.label|Explanation of the setting shown on the settings screen
app_settings.type|Data type of the value, which selects the input control
app_settings.editable|Yes when an administrator may change the value on screen; no for values maintained by the system (for example numbering prefixes)
audit_log.before_data|Record values before the change (JSON)
audit_log.after_data|Record values after the change (JSON)
audit_log.action|Action audited (create, update, approve, post, sign-in ...)
audit_log.entity|Type of record changed (policy, quote, receipt, user ...)
audit_log.entity_id|Identifier of the record changed
audit_log.user_id|User who performed the action
authority_limits.role_code|Role the limit applies to; exactly one of role and user is set
authority_limits.user_id|User the limit applies to; exactly one of role and user is set
authority_limits.replaces_id|Limit this row replaces; the old limit is retired when the new one is approved
authority_limits.requested_by|Administrator who proposed the limit
authority_limits.decided_by|Second administrator who approved or rejected the limit
authority_limits.decision_note|Note entered with the approval or rejection
authority_limits.transaction_type|Transaction type limited (authority_transaction_types.code)
authority_limits.max_amount|Largest amount (or percent for discounts) the role or user may approve; empty means no limit
authority_transaction_types.measure|Whether the limit is an amount (PHP) or a percent (discounts)
bank_account_links.bank_account_id|Bank account master record (master_records.id, type bank-account)
bank_account_links.bank_account_code|Code of the bank account master record
bank_account_links.bank_account_name|Name of the bank account
bank_account_links.bank_code|Bank code of the account (from the master record)
bank_account_links.bank_name|Bank name of the account
bank_account_links.account_number|Bank account number
bank_account_links.currency|Currency of the account (PHP when not set)
bank_account_links.gl_account_code|GL cash account linked to the bank account
bank_account_links.statement_format|Default bank statement format for imports
bank_account_links.status|Status of the bank account master record
bank_account_links.reconcile_from|Date from which the account is reconciled (earlier lines are ignored)
bank_book_lines.line_id|Journal line (journal_lines.id)
bank_book_lines.bank_account_id|Bank account master record whose GL cash account the line is on
bank_book_lines.bank_account_code|Code of the bank account
bank_book_lines.account_code|GL cash account of the line
bank_book_lines.jv_id|Journal voucher of the line
bank_book_lines.jv_number|Journal voucher number
bank_book_lines.txn_date|Journal date
bank_book_lines.jv_status|Status of the journal (posted or reversed)
bank_book_lines.source|Source of the journal (receipt, disbursement, bank-reconciliation ...)
bank_book_lines.reference_type|Type of the source document of the journal
bank_book_lines.reference_id|Identifier of the source document
bank_book_lines.transaction_code|Transaction code of the journal
bank_book_lines.reversal_of|Journal reversed by this journal
bank_book_lines.reversed_by_jv|Journal that reversed this journal
bank_book_lines.description|Line memo, else the journal description
bank_book_lines.debit|Debit amount on the cash account (money in)
bank_book_lines.credit|Credit amount on the cash account (money out)
bank_book_lines.amount|Debit minus credit
bank_book_lines.doc_type|Document type shown in matching (Official Receipt, Cheque, Payment Voucher, Bank Adjustment, Petty Cash, Journal Voucher, Reversal)
bank_book_lines.doc_number|Receipt, voucher or journal number of the document
bank_book_lines.cheque_no|Cheque number when the payment was made by cheque
bank_book_lines.checkbook_id|Cheque record (checkbooks.id)
bank_book_lines.cheque_status|Status of the cheque
bank_book_lines.receipt_id|Official receipt (receipts.id)
bank_book_lines.party|Payer or payee name
bank_book_lines.payment_reference|Payment or cheque reference
bank_book_lines.match_id|Active bank match of the line, if matched
bank_book_lines.cleared_date|Date the line cleared the bank (from its match)
bank_book_lines.match_type|How the line was matched (auto, manual, adjustment, contra)
bank_book_lines.locked_by_rec|Approved reconciliation that locks the match
bank_match_rules.code|Rule code
bank_match_rules.rule_type|Matching method of the rule
bank_match_rules.params|Rule parameters such as date window and amount tolerance (JSON)
bank_match_rules.confidence|Confidence given to matches found by the rule (1 to 100)
bank_rec_match_items.match_id|Match the item belongs to
bank_rec_match_items.bank_line_id|Bank statement line in the match (bank side)
bank_rec_match_items.journal_line_id|Journal line on the cash account in the match (book side)
bank_rec_match_items.side|bank for a statement line, book for a journal line
bank_rec_match_items.amount|Amount of the line taken into the match
bank_rec_matches.bank_account_id|Bank account master record (master_records.id, type bank-account)
bank_rec_matches.match_type|How the match was made
bank_rec_matches.rule_code|Matching rule that proposed the match (automatic matches)
bank_rec_matches.bank_total|Sum of the bank lines (credit positive)
bank_rec_matches.book_total|Sum of the journal lines (debit positive)
bank_rec_matches.difference|Bank total minus book total
bank_rec_matches.difference_treatment|How a non-zero difference is treated in the reconciliation: bank error or book error
bank_rec_matches.cleared_date|Latest date among the matched lines; the items count as cleared from this date
bank_rec_matches.locked_by_rec|Approved reconciliation that locks the match; it cannot be undone
bank_rec_matches.unmatch_reason|Reason given when the match was undone
bank_reconciliation_history.rec_id|Bank reconciliation whose status changed
bank_reconciliations.rec_number|Reconciliation number (BRC series)
bank_reconciliations.bank_account_id|Bank account master record reconciled
bank_reconciliations.bank_account_code|Code of the bank account reconciled
bank_reconciliations.as_of_date|Date the reconciliation is made at (normally the period end)
bank_reconciliations.snapshot|Bank reconciliation statement as prepared or approved (JSON)
bank_reconciliations.bank_balance|Balance per bank statement at the as-of date
bank_reconciliations.deposits_in_transit|Receipts in the books not yet on the bank statement
bank_reconciliations.outstanding_cheques|Payments in the books not yet on the bank statement
bank_reconciliations.bank_errors|Differences treated as bank errors
bank_reconciliations.adjusted_bank_balance|Bank balance after deposits in transit, outstanding cheques and bank errors
bank_reconciliations.book_balance|Balance of the GL cash account at the as-of date
bank_reconciliations.unbooked_credits|Bank credits not yet recorded in the books
bank_reconciliations.unbooked_debits|Bank debits (charges) not yet recorded in the books
bank_reconciliations.book_errors|Differences treated as book errors
bank_reconciliations.adjusted_book_balance|Book balance after unbooked items and book errors; must equal the adjusted bank balance
bank_reconciliations.unmatched_bank_lines|Number of statement lines not matched at computation
bank_reconciliations.unmatched_book_lines|Number of journal lines not matched at computation
bank_reconciliations.computed_at|Date and time the figures were last computed
bank_reconciliations.reopen_remarks|Reason given when an approved reconciliation was reopened
bank_statement_formats.bank_code|Bank master code the layout belongs to (BDO, BPI, MBT ...); informational
bank_statement_formats.amount_sign|Sign convention of a single amount column
bank_statement_formats.is_example|Yes for sample layouts shipped with the system; verify against the bank's actual export
bank_statement_lines.statement_id|Bank statement the line was imported or keyed with
bank_statement_lines.bank_account_id|Bank account master record; empty for remittance-only lines imported without a bank account
bank_statement_lines.txn_number|Bank transaction number (BNK series) of lines imported through the remittance screen
bank_statement_lines.txn_date|Posting date on the bank statement
bank_statement_lines.value_date|Value date on the bank statement
bank_statement_lines.description|Transaction description from the bank
bank_statement_lines.debit|Money out of the account
bank_statement_lines.credit|Money into the account
bank_statement_lines.amount|Signed amount (credit positive)
bank_statement_lines.running_balance|Running balance printed on the statement
bank_statement_lines.line_hash|Duplicate detection hash (account, date, amount, reference, description, occurrence)
bank_statement_lines.type_code|Bank transaction type assigned to the line (bank_transaction_types.code)
bank_statement_lines.flag|Marks the line as a bank-side reconciling item (bank error) without a journal
bank_statement_lines.flag_remarks|Explanation of the flag
bank_statement_lines.adjustment_jv_id|Journal posted from the line (bank charges, interest, direct credits)
bank_statement_lines.rem_status|Matching status of the line against insurer remittances
bank_statement_lines.rem_remittance_id|Remittance the line was matched to
bank_statement_lines.rem_reference|Reference used for the remittance match
bank_statement_lines.rem_difference|Difference between the line and the matched remittance
bank_statement_lines.status|active, or deleted when the line was removed
bank_statement_lines.source|How the line was created
bank_statements.bank_account_id|Bank account master record (master_records.id, type bank-account)
bank_statements.bank_account_code|Code of the bank account
bank_statements.opening_balance|Opening balance per statement
bank_statements.closing_balance|Closing balance per statement
bank_statements.total_debits|Total of the debit lines
bank_statements.total_credits|Total of the credit lines
bank_statements.deleted_by|User who deleted the statement
bank_transaction_types.code|Transaction type code
bank_transaction_types.account_role|Account determination role (accounting.account.<role>) of the counter account, for example bank_charges or suspense
bank_transaction_types.gl_account_code|Fixed GL counter account, used instead of the role when set
bank_transaction_types.allow_account_override|The user may pick the counter account (direct credits)
bank_transaction_types.match_pattern|Regular expression on the bank description that suggests this type
bank_transaction_types.action|journal (post an adjustment journal) or returned-cheque (reverse the receipt)
bank_transaction_types.direction|Whether the type applies to debits or credits on the statement
banks.swift_code|SWIFT / BIC code of the bank
banks.code|Bank code
banks.name|Bank name
bir_2307_certificates.cert_number|Certificate number (CWT series)
bir_2307_certificates.direction|issued (the broker withheld tax) or received (tax was withheld from the broker)
bir_2307_certificates.payee_key|Payee type and id (issued) or payor type and id (received)
bir_2307_certificates.payee_name|Name of the payee on the certificate
bir_2307_certificates.payee_tin|TIN of the payee
bir_2307_certificates.payee_address|Registered address of the payee
bir_2307_certificates.payor_name|Name of the payor (withholding agent)
bir_2307_certificates.payor_tin|TIN of the payor
bir_2307_certificates.payor_address|Registered address of the payor
bir_2307_certificates.year|Calendar year of the certificate
bir_2307_certificates.quarter|Quarter of the year (1 to 4)
bir_2307_certificates.lines|Income payments and tax withheld per ATC and month (JSON)
bir_2307_certificates.total_income|Total income payments on the certificate
bir_2307_certificates.total_tax|Total tax withheld on the certificate
branches.code|Branch code used on documents, numbering and ledger lines
broker_slips.slip_number|Broker slip number (BS series)
broker_slips.risk_details|Risk description (location, occupancy, cargo, project ...) (JSON)
broker_slips.requested_covers|Covers requested from the insurers: cover, sum insured, limit, deductible, remarks (JSON)
broker_slips.response_due_date|Date by which the insurers are asked to respond
broker_slips.owner_user_id|Account executive who owns the slip
broker_slips.quote_id|Quotation slip prepared from the selected offers
cessions.ceded_sum|Sum insured ceded to the reinsurer
cessions.ceded_premium|Premium ceded to the reinsurer
cessions.cession_number|Cession number from the document numbering series
cessions.cession_type|Treaty (automatic under a treaty) or Facultative (risk by risk)
cessions.facultative_reinsurer_id|Reinsurer of a facultative cession
cessions.cession_date|Date of the cession
cessions.bordereau_ref|Bordereau that reported the cession
cessions.insured|Name of the insured
checkbooks.instrument_book_id|Cheque book the cheque was taken from
checkbooks.instrument_no|Cheque number
checkbooks.instrument_date|Date on the cheque
checkbooks.totale_amount|Amount of the cheque
checkbooks.main_account|GL bank account the cheque is drawn on
checkbooks.printed_by|User who printed the cheque
checkbooks.printed_at|Date and time the cheque was printed
cities.state_id|Province the city belongs to
claim_field_changes.field_name|Field that changed
claim_field_changes.old_value|Value before the change
claim_field_changes.new_value|Value after the change
claim_field_changes.action|Claim event that caused the change
claim_history.by_user|User who changed the status
claim_settlement_movements.kind|funds-received (from an insurer) or paid-to-claimant
claim_settlement_movements.movement_date|Date of the receipt or payment
claim_settlement_movements.insurance_company_id|Insurer that paid the funds (funds received)
claim_settlement_movements.bank_account|Bank account master code, or cash GL code, used
claim_settlement_movements.payee|Claimant or other payee paid
claims.claim_number|Claim number from the document numbering series
claims.loss_date|Date of loss
claims.reported_date|Date the loss was reported to the broker
claims.loss_type|Description of the cause of loss
claims.estimate_amount|Estimated amount of the loss
claims.approved_amount|Amount approved for settlement
claims.settled_amount|Amount settled to the claimant
claims.handler_user_id|Claims handler assigned
claims.claim_type|Claim type (Motor, Accident, Property ...)
claims.loss_time|Time of loss
claims.loss_address|Address where the loss occurred
claims.loss_city|City where the loss occurred
claims.loss_province|Province where the loss occurred
claims.insurer_claim_number|Claim number given by the insurer
claims.is_holder_driver|Yes when the policyholder was driving (motor claims)
claims.driver|Driver details: name, licence, contact (JSON)
claims.third_party|Third-party details: persons, vehicles, property involved (JSON)
claims.policy_info|Policy details copied at registration (JSON)
claims.adjuster|Adjuster assigned and the adjuster report (JSON)
claims.settlement|Settlement breakdown and payment details (JSON)
claims.rejected_reason|Reason the claim was rejected
claims.lead_id|Lead linked to the claim (sample and migrated data)
claims.quote_id|Quotation linked to the claim (sample and migrated data)
claims.details|Loss details captured on the claim screens (JSON)
claims.settlement_requested_by|User who submitted the settlement for approval
claims.settlement_approved_by|User who approved the settlement
claims.settlement_approved_at|Date and time the settlement was approved
claims.settlement_jv_id|Journal posted for the settlement
claims.priority|Handling priority (Low, Medium, High)
client_credit_exceptions.credit_limit|Credit limit of the client when the policy was issued
client_credit_exceptions.exposure_before|Open premium exposure of the client before the new policy
client_credit_exceptions.new_amount|Premium of the new policy
client_credit_exceptions.exposure_after|Exposure after the new policy, above the credit limit
client_credit_exceptions.acknowledged_by|Accounting user who acknowledged the exception
client_credit_exceptions.acknowledged_at|Date and time of the acknowledgement
clients.client_code|Client code (unique), shown on documents and used in searches
clients.client_type|Individual or corporate client
clients.lead_id|Lead the client was converted from
clients.owner_user_id|Account executive who owns the client
clients.credit_limit_updated_by|User who last set the credit limit
clients.credit_limit_updated_at|Date and time the credit limit was last set
clients.source|How the client was acquired (walk-in, referral, bank tie-up, bulk upload ...)
clients.tin|Tax identification number (BIR TIN) of the client
collection_actions.collection_id|Collection item the action belongs to
collection_actions.action_type|Type of follow-up action
collection_actions.action_date|Date and time of the action
collection_actions.call_outcome|Outcome of a call
collection_items.receivable_id|Open premium bill followed up
collection_items.commitment_reason|Reason or condition given with the payment commitment
collection_items.escalated_at|Date and time the item was escalated
collection_items.escalated_by|User who escalated the item
collection_items.last_follow_up_at|Date and time of the last follow-up action
collection_items.last_reminder_at|Date and time of the last reminder sent
collection_items.assigned_to|User responsible for the follow-up
commission_adjustments.commission_id|Commission line adjusted
commission_adjustments.endorsement_id|Endorsement that returned the premium
commission_adjustments.ratio|Returned premium divided by policy premium (capped at 1)
commission_adjustments.line_status|Status of the commission line when it was adjusted
commission_adjustments.amount|Commission (comsub) reduced, reversed or clawed back
commission_adjustments.withholding|Withholding tax on the adjusted amount
commission_debit_note_collections.collection_number|Collection number from the document numbering series
commission_debit_note_collections.cash_amount|Cash received from the insurer
commission_debit_note_collections.ewt_amount|Expanded withholding tax deducted by the insurer (supported by BIR Form 2307)
commission_debit_note_collections.cash_account|GL cash account the money was received into
commission_debit_note_collections.form_2307_no|Number of the BIR Form 2307 received for the withholding
commission_debit_note_collections.applied_amount|Cash plus EWT applied to the debit note
commission_debit_note_lines.debit_note_id|Debit note the line belongs to
commission_debit_note_lines.item_id|Direct-bill commission item billed on the line
commission_debit_notes.dn_number|Debit note number (DN series)
commission_debit_notes.dn_date|Date of the debit note
commission_debit_notes.insurance_company_id|Insurer billed
commission_debit_notes.commission|Commission net of VAT
commission_debit_notes.ewt_rate|Expanded withholding tax rate the insurer deducts on the commission
commission_debit_notes.expected_ewt|Withholding tax the insurer is expected to deduct
commission_debit_notes.collected_cash|Cash collected so far
commission_debit_notes.collected_ewt|Withholding tax accepted so far
commission_debit_notes.balance|Amount still to collect: amount minus collected cash and collected EWT
commission_debit_notes.sent_to|E-mail address the debit note was sent to
commission_rates.insurance_company_id|Insurer the rate applies to; empty means any insurer
commission_rates.product_id|Product the rate applies to; empty means any product
commission_rates.policy_type|Applies to new business, renewals or both
commission_rates.rate|Commission rate as a fraction (0.15 = 15%)
commission_referrers.id|Unique identifier of the referrer; a readable slug used in addresses (for example ref-dcruz)
commission_referrers.referrer_type|Type of referrer
commission_referrers.level|Level in the referral hierarchy
commission_referrers.parent_referrer_id|Referrer above this one in the hierarchy
commission_referrers.user_id|User account of the referrer, when the referrer also signs in
commission_referrers.wht_rate|Withholding tax rate on the referrer's commission; empty means the rate set for the referrer type
commission_referrers.wht_applicable|Yes when withholding tax is deducted from the referrer's commission
commission_referrers.bank_name|Bank of the referrer's payout account
commission_referrers.bank_account_no|Payout bank account number of the referrer
commissions.agent_user_id|Account executive credited with the commission
commissions.referrer_id|Referrer or sub-agent paid the commission
commissions.basis_amount|Premium on which the commission is computed
commissions.rate|Commission rate applied (fraction)
commissions.amount|Commission (comsub) payable to the referrer: fixed amount plus net premium times the comsub percent
commissions.withholding|Withholding tax deducted from the commission
commissions.net_amount|Commission payable after withholding tax
commissions.product_label|Product name shown on the commission statement
commissions.insurer_label|Insurer name shown on the commission statement
commissions.cycle_date|Date of the commission cycle the line falls in
commissions.brokerage_pct|Brokerage (broker commission from the insurer) in percent of net premium
commissions.brokerage_amount|Brokerage earned by the broker on the policy
commissions.comsub_fixed|Fixed part of the referrer commission
commissions.comsub_pct|Referrer commission in percent of net premium
commissions.wht_pct|Withholding tax rate in percent
commissions.receipt_no|Official receipt that made the line eligible
commissions.voucher_no|Payment voucher that paid the line
commissions.accrued_at|Date and time the commission was accrued
commissions.eligible_at|Date and time the line became eligible (premium collected)
commissions.eligible_by|User or job that made the line eligible
commissions.paid_by|User who recorded the payment
commissions.clawback|Yes when the line was reversed after payment and the amount is recovered from the referrer
commissions.chain_position|Position of the referrer in the referral chain (0 = direct referrer)
commissions.disbursement_id|Payment voucher that paid the commission
commissions.period|Commission period (YYYY-MM)
countries.code|Country code (ISO 3166)
coverages.policy_type_id|Policy type the cover option belongs to
coverages.kind|Cover type: bi (bodily injury), pd (property damage) or pa (personal accident)
coverages.amount|Limit of the cover option
coverages.premium|Premium of the cover option
currencies.code|Currency code (ISO 4217)
currencies.symbol|Currency symbol shown on screens and documents
currencies.decimals|Number of decimal places of amounts in the currency
currencies.is_base|Yes for the base (functional) currency, PHP
currencies.exchange_rate|Exchange rate to the base currency
direct_bill_client_payments.insurance_company_id|Insurer the client paid
direct_bill_client_payments.void_reason|Reason the record was voided
direct_bill_client_payments.voided_by|User who voided the record
direct_bill_client_payments.voided_at|Date and time the record was voided
direct_bill_items.insurance_company_id|Insurer that owes the commission
direct_bill_items.debit_note_id|Debit note the item was billed on
direct_bill_items.booked_on|Date the commission receivable was booked
direct_bill_items.amount|Commission plus VAT due from the insurer
disbursements.voucher_number|Payment voucher number (PV series)
disbursements.voucher_date|Date of the payment voucher
disbursements.payee_id|Identifier of the payee record (insurer, client or referrer)
disbursements.insurance_company_id|Insurer paid (insurer remittances)
disbursements.transaction_description|Description printed on the voucher
disbursements.referrer_name|Name of the referrer paid
disbursements.insurer_name|Name of the insurer paid
disbursements.instrument_currency|Currency of the payment instrument
disbursements.gross_amount|Amount before withholding tax
disbursements.wht_amount|Withholding tax deducted
disbursements.amount|Net amount paid
districts.city_id|City the district belongs to
document_numbering.code|Series code used by the application (for example policy, receipt, journal)
document_numbering.prefix|Prefix of the document number (for example POL, OR, JV)
document_numbering.pattern|Number pattern with the tokens {PREFIX} {YYYY} {YY} {MM} {FY} {BRANCH} {LOB} {SEQ}
document_numbering.seq_width|Number of digits of the running number (zero-padded)
document_numbering.reset_rule|When the running number restarts
document_numbering.start_number|First running number of a new period, or the number to continue from at go-live
documents.entity|Type of record the file belongs to (policy, claim, quotation ...)
documents.entity_id|Identifier of the record the file belongs to
documents.uploaded_by|User who uploaded the file
documents.category|Kind of document (vehicle photos, ID cards, payment proofs, claim documents ...)
email_outbox.to_address|Recipient e-mail addresses
email_outbox.cc|Copy recipients
email_outbox.subject|Subject line
email_outbox.body_html|Message body (HTML)
email_outbox.template|E-mail template used
endorsements.endorsement_number|Endorsement number from the document numbering series
endorsements.endorsement_type|Type of change
endorsements.changes|Field changes and re-pricing of the endorsement (JSON)
endorsements.premium_delta|Change in premium: positive for additional premium, negative for return premium
endorsements.endorsement_type_ids|Endorsement types selected on the screen (JSON)
endorsements.is_cancel|Yes when the endorsement cancels the policy
endorsements.cancellation_type|Type of cancellation (for example FULL)
endorsements.document_key|Storage key of the endorsement document
endorsements.completion|Completion details: issued document, billing and notes (JSON)
endorsements.completed_by|User who completed the endorsement
endorsements.receivable_id|Bill raised for the additional premium
entry_matches.debit_line_id|Debit journal line of the open-item match
entry_matches.credit_line_id|Credit journal line of the open-item match
entry_matches.matched_amount|Amount matched between the two lines
entry_matches.adjustment_amount|Small difference written off with the match
entry_matches.document_ref|Document reference the lines were matched on
entry_matches.write_off_code|Write-off reason used for the difference
entry_matches.write_off_jv_id|Journal that wrote off the difference
fiscal_years.code|Fiscal year code (FY2026)
generated_reports.code|Report code (report_definitions.code)
generated_reports.row_count|Number of data rows in the file
generated_reports.generated_by|User or schedule that generated the report
generated_reports.schedule_id|Report schedule that produced the file
gl_accounts.code|GL account code
gl_accounts.name|Account name
gl_accounts.parent_code|Parent account in the chart of accounts hierarchy
gl_accounts.account_type|Account type, which decides the statement and the normal balance
gl_accounts.is_open_item|Yes when lines on the account take part in open-item matching (receivables and payables)
gl_accounts.allow_manual|Yes when the account may be used on manual journal vouchers
gl_accounts.fs_group|Financial statement group the account is reported under
gl_accounts.normal_balance|Normal balance side, derived from the account type
gl_accounts.category|Account category (Cash and Cash Equivalents, Premiums Receivable, Payables ...)
incentive_calculations.batch_id|Calculation batch number (for example CALC-2026-00001)
incentive_calculations.programs_included|Incentive programmes included in the batch (JSON)
incentive_calculations.agent_count|Number of participants in the batch
incentive_calculations.submitted_date|Date and time the batch was submitted for approval
incentive_calculations.approval_date|Date and time the batch was approved
incentive_calculations.rejection_date|Date and time the batch was rejected
incentive_calculations.payment_reference|Payment reference of the payout
incentive_calculations.created_by|User who ran the calculation
incentive_calculations.submitted_by|User who submitted the batch
incentive_calculations.approved_by|User who approved the batch
incentive_calculations.rejected_by|User who rejected the batch
incentive_programs.metric|Measure the programme rewards (premium, policies, conversion)
incentive_programs.reward|Reward description
incentive_programs.program_code|Programme code
incentive_programs.program_type|Programme type (for example Target Based)
incentive_programs.applicable_to|Roles, teams or users eligible for the programme (JSON)
incentive_programs.target|Target value of the measure
incentive_programs.target_metric|Measure the target is set on
incentive_programs.stretch_target|Stretch target value
incentive_programs.calculation_frequency|How often results are calculated (Monthly, Quarterly ...)
incentive_programs.structure|Tiers and payout structure (JSON)
incentive_programs.eligibility|Eligibility conditions (JSON)
incentive_results.program_id|Incentive programme
incentive_results.agent_user_id|Participant (user)
incentive_results.calculation_id|Calculation batch that produced the result
incentive_results.target|Target of the participant for the period
incentive_results.achieved|Value achieved in the period
incentive_results.achievement_percent|Achievement in percent of target
incentive_results.base_incentive|Incentive before adjustments
incentive_results.payout|Incentive payable
incentive_results.adjustment_reason|Reason for a manual adjustment
incentive_results.tier|Tier reached
insurance_companies.code|Insurer code
insurance_companies.name|Insurer name
insurance_companies.contact_person|Contact person at the insurer
insurance_companies.contact_email|E-mail address of the contact
insurance_companies.contact_phone|Telephone number of the contact
insurance_companies.commission_rate|Default commission rate of the insurer (fraction), used when the rate matrix has no rate
insurance_companies.premium_warranty_days|Days after inception within which the premium must be paid (premium payment warranty)
insurance_companies.remittance_terms_days|Days after collection within which premium must be remitted to the insurer
insurance_companies.default_billing_mode|Default billing mode for the insurer's policies (broker or direct)
insurance_companies.tin|Tax identification number of the insurer
insurer_offers.broker_slip_id|Broker slip answered by the offer
insurer_offers.insurance_company_id|Insurer that made the offer or declined
insurer_offers.offer_number|Offer number (OFR series)
insurer_offers.premium|Premium offered
insurer_offers.rate|Rate offered
insurer_offers.deductibles|Deductibles of the offer
insurer_offers.validity_date|Date until which the offer is valid
insurer_offers.offered_share|Share of the risk the insurer writes, in percent
insurer_offers.decline_reason|Reason the insurer declined
insurer_offers.responded_at|Date and time the insurer's answer was recorded
insurer_offers.selected|Yes when the offer was selected for the quotation or placement slip
insurer_offers.terms|Special terms, conditions, warranties and exclusions
insurer_rate_tables.insurance_company_id|Insurer whose rate this is
insurer_rate_tables.product_id|Product rated
insurer_rate_tables.rate|Rate on the stated basis
insurer_rate_tables.deductible_amount|Deductible amount
insurer_rate_tables.key_benefits|Key benefits shown in the quick quote comparison (JSON)
insurer_rate_tables.commission_rate|Commission rate for this insurer and product (fraction)
insurer_refund_credits.insurance_company_id|Insurer that owes the refund
insurer_refund_credits.endorsement_id|Endorsement that returned the premium
insurer_refund_credits.split|Split of the amount into due to insurer, VAT, DST and LGT (JSON)
insurer_refund_credits.applications|Remittances or vouchers the credit was netted against: voucher, amount, journal, date (JSON)
insurer_refund_credits.balance|Part of the credit not yet applied
insurer_refund_credits.reference|Endorsement or policy number
insurer_refund_credits.kind|Return premium or cancellation
insurer_statement_formats.insurance_company_id|Insurer whose layout this is; empty means any insurer
insurer_statement_lines.statement_id|Insurer statement the line belongs to
insurer_statement_lines.row_no|Row number in the imported file
insurer_statement_lines.amount_paid|Amount the insurer reports as paid or due
insurer_statement_lines.match_status|Result of matching the line to the broker's records
insurer_statement_lines.match_source|Whether the match was found automatically or made by a user
insurer_statement_lines.broker_gross|Gross premium per the broker's record
insurer_statement_lines.broker_commission|Commission per the broker's record
insurer_statement_lines.broker_taxes|Taxes per the broker's record
insurer_statement_lines.broker_amount|Net amount per the broker's record
insurer_statement_lines.taxes|Taxes per the insurer's line
insurer_statement_resolutions.statement_id|Insurer statement the resolution belongs to
insurer_statement_resolutions.line_id|Insurer line resolved (unmatched or with a difference)
insurer_statement_resolutions.broker_id|Broker record missing on the statement that was resolved
insurer_statement_resolutions.kind|note (explained only) or adjustment (adjustment journal on approval)
insurer_statement_resolutions.premium_adjustment|Premium adjustment; positive means more premium due to the insurer
insurer_statement_resolutions.commission_adjustment|Commission adjustment; positive means less commission for the broker
insurer_statement_resolutions.commission_side|Account adjusted for the commission: commission receivable or due to insurer
insurer_statement_resolutions.note|Explanation of the resolution
insurer_statements.insurance_company_id|Insurer that sent the statement
insurer_statements.statement_type|premium (remittance confirmation) or commission statement
insurer_statements.tolerance|Largest difference (PHP) still treated as matched
insurer_statements.total_gross|Total gross premium on the statement
insurer_statements.total_commission|Total commission on the statement
insurer_statements.total_taxes|Total taxes on the statement
insurer_statements.total_paid|Total amount paid or due on the statement
insurer_statements.approval_remarks|Remarks of the approver
insurer_statements.statement_number|Statement reconciliation number (ISR series)
invoice_lists.invoice_number|Invoice list number (IL series)
invoice_lists.payables|Amount payable to the payee
invoice_lists.outstanding|Amount still unpaid
invoice_lists.excess|Amount paid in excess
invoice_lists.bal_amount|Balance after this payment
invoice_lists.comsub|Commission deducted (insurer remittances net of commission)
invoice_lists.bank_code|Bank the payment is made from
invoice_lists.bank_amount|Amount paid through the bank
invoice_lists.is_invoice_paid|Yes when the client has paid the premium
invoice_lists.fc_amount|Amount in the foreign currency of the invoice
invoice_lists.lc_amount|Amount in PHP
invoice_lists.disbursement_id|Payment voucher that settles the invoice list
job_queue.queue|Queue name
job_queue.job_type|Kind of background work (for example a renewal notice batch)
job_queue.payload|Input of the job (JSON)
job_queue.progress|Progress reported by the job (JSON)
job_queue.result|Result of the job (JSON)
job_runs.output|Output or summary of the run (JSON)
job_runs.job_id|Scheduled job that ran
journal_lines.jv_id|Journal voucher the line belongs to
journal_lines.account_code|GL account debited or credited
journal_lines.account_name|Account name at posting time
journal_lines.memo|Line narrative
journal_lines.main_account_description|Main account name (as on the legacy voucher layout)
journal_lines.sub_account_description|Sub account name
journal_lines.branch_description|Branch name
journal_lines.department_description|Department name
journal_lines.foreign_amount|Amount in foreign currency
journal_lines.insurance_company_id|Insurer the line is tagged to (co-insurance splits, due to insurer)
journal_lines.debit|Debit amount (PHP); a line has either a debit or a credit
journal_lines.credit|Credit amount (PHP); a line has either a debit or a credit
journal_vouchers.jv_number|Journal voucher number (JV series)
journal_vouchers.jv_date|Accounting date of the journal; decides the period
journal_vouchers.total_debit|Sum of the debit lines
journal_vouchers.total_credit|Sum of the credit lines; must equal total debit to post
journal_vouchers.entry_sub_type|Sub type of the entry (for example CO_INSURANCE, POLICY)
journal_vouchers.reference_type|Type of the source document (Policy, Receipt, Disbursement, Commission ...)
journal_vouchers.reference_id|Identifier of the source document
journal_vouchers.posted_by|User who posted the journal
journal_vouchers.posted_at|Date and time of posting
journal_vouchers.reversal_of|Journal this journal reverses
journal_vouchers.reversed_by_jv|Journal that reversed this journal
journal_vouchers.correction_of|Journal this journal corrects
journal_vouchers.posting_rule_id|Posting rule version the journal was built from
journal_vouchers.source|Module that created the journal (booking, receipt, disbursement, manual ...)
journal_vouchers.kind|standard, reversal or correction
journal_vouchers.requires_approval|Yes when the journal needs a checker before posting (manual journals above the limit)
leads.lead_number|Lead number from the document numbering series
leads.lead_type|Individual or corporate prospect
leads.product_interest|Product the prospect is interested in
leads.tax_number|Tax identification number given by the prospect
leads.owner_user_id|Account executive who owns the lead
leads.product_id|Product of interest
leads.source|How the lead was obtained (walk-in, referral, Facebook page, bank tie-up ...)
login_history.user_agent|Browser and device of the attempt
login_history.success|Yes when the sign-in succeeded
login_history.reason|Reason a sign-in failed (wrong password, locked, second factor ...)
login_history.method|Sign-in method (password, password-change ...)
master_records.type_code|Master type the record belongs to
master_records.code|Business code of the record (unique within the type)
master_records.name|Name or label of the record
master_records.data|Field values of the record as defined by its master type (JSON)
master_types.code|Master type code (for example bank-account, line-of-business)
master_types.storage|Where the records are kept: generic (master_records) or table (a reference table of its own)
master_types.table_name|Reference table when storage is table
master_types.code_field|Field holding the business code (unique per type)
master_types.label_field|Field used as the option label in drop-downs
master_types.fields|Field definitions of the master screen: name, label, type, required, options (JSON)
master_types.unique_keys|Field combinations that must be unique (JSON)
master_types.allow_extra|Keep fields not declared in the definition (nested configuration)
master_types.screen|Front-end route of the master screen
notifications.title|Notification title
notifications.message|Notification text
notifications.link|Screen the notification opens
notifications.audience|Permission code whose holders all see the notification; empty for a personal notification
notifications.is_read|Yes when the user has read the notification
notifications.read_at|Date and time the notification was read
opening_balances.account_code|GL account
opening_balances.balance|Opening balance, debit positive
opening_balances.source_run|Origin of the balance: the year-end run that carried it forward, or go-live:<date> for an imported trial balance
package_bundle_sections.default_sum_insured|Default sum insured proposed for the section
package_bundle_sections.optional|Yes when the client may leave the section out
package_bundle_sections.insurer_ids|Insurers allowed for the section (the first is the default carrier)
package_bundle_sections.product_id|Product of the section
package_bundles.term_months|Policy term in months
package_bundles.discount_percent|Bundle discount in percent, applied proportionally to the sections
package_endorsements.sum_insured_before|Sum insured of the section before the change
package_endorsements.sum_insured_after|Sum insured of the section after the change
package_endorsements.prorata_factor|Pro-rata factor for the remaining term
package_endorsements.bill_number|Bill raised for the additional premium
package_endorsements.insurance_company_id|Insurer of the section changed
package_endorsements.receivable_id|Bill raised for the additional premium
package_quotes.quote_number|Bundle quotation number
package_quotes.location|Location of the insured property
package_quotes.lgu_code|Local government unit whose LGT rate applies (lgu_tax_rates.code)
package_quotes.renewal_of|Package policy this quotation renews
package_quotes.owner_user_id|Account executive who owns the quotation
package_sections.insurance_company_id|Insurer (carrier) of the section
package_sections.rate_table_id|Insurer rate table used to price the section
package_sections.entity_id|Bundle quotation or policy the section belongs to
password_resets.code_hash|HMAC hash of the one-time reset code; the code itself is not stored
password_resets.used_at|Date and time the code was used
payment_events.link_id|Payment link the notification refers to
payment_events.event_type|Event type reported by the gateway
payment_events.signature_valid|Yes when the gateway signature was verified
payment_events.received_at|Date and time the notification was received
payment_gateways.code|Gateway code
payment_gateways.provider|Payment service provider
payment_gateways.mode|sandbox (test) or live
payment_gateways.methods|Payment methods offered (card, GCash, Maya, GrabPay, online banking, over the counter)
payment_gateways.fee_handling|absorb (the broker pays the fee) or pass_on (added to the client's payment)
payment_gateways.fee_percent|Gateway fee in percent of the amount
payment_gateways.fee_fixed|Fixed gateway fee per payment
payment_gateways.credentials_prefix|Prefix of the environment variables holding the merchant credentials (for example PAYMONGO)
payment_gateways.link_validity_hours|Hours a payment link stays valid
payment_gateways.bank_account_code|Bank account the gateway settlements are deposited to (used on the receipt)
payment_links.link_number|Payment link number
payment_links.token|Random token in the public checkout address
payment_links.target_type|What is paid: package quotation, quotation or policy
payment_links.target_id|Identifier of the record paid
payment_links.target_number|Number of the record paid
payment_links.payer_name|Name of the payer
payment_links.payer_email|E-mail address of the payer
payment_links.payer_mobile|Mobile number of the payer
payment_links.amount|Premium amount requested
payment_links.fee|Gateway fee (charged to the client when passed on)
payment_links.total|Amount the gateway charges
payment_links.checkout_url|Checkout address at the gateway
payment_links.paid_amount|Amount confirmed as paid
payment_links.apply_status|Whether the payment has been turned into a receipt (and policy issue)
payment_links.apply_error|Error when applying the payment failed
payment_links.receipt_id|Official receipt created from the payment
payment_links.method|Payment method chosen by the payer
period_close_checklist.code|Checklist item code
period_close_checklist.label|Checklist item shown on the close screen
period_close_entries.step|Close step that created the journal
period_close_entries.jv_id|Journal created by the close run
period_close_entries.auto_reverse_on|Date on which the journal is reversed automatically (accruals)
period_close_entries.undo_jv_ids|Journals that undid the entry when the run was reopened
period_close_entries.recurring_run_id|Recurring journal run behind the entry
period_close_run_checks.code|Checklist item checked
period_close_run_checks.item_count|Number of exceptions found
period_close_run_checks.detail|Exceptions found (JSON)
period_close_run_checks.checked_at|Date and time of the check
period_close_run_checks.signed_by|User who signed off a manual item
period_close_run_checks.signed_at|Date and time of the sign-off
period_close_runs.period|Accounting period closed
period_close_runs.target_status|Period status to reach: soft_closed or closed
period_close_runs.steps|Progress of the close steps (JSON)
period_close_runs.execution_count|Number of times the run was executed
period_status_history.source|What changed the status: manual, close-run, year-end, year-end-reversal or job
period_status_history.reference_id|Close run or year-end run behind the change
period_status_history.period|Accounting period changed
petty_cash_disbursements.fund_id|Petty cash fund paid from
petty_cash_disbursements.vat_account|GL account for input VAT
petty_cash_disbursements.wht_account|GL account for the withholding tax payable
petty_cash_disbursements.disbursement_date|Date of payment
petty_cash_disbursements.transaction_number|Petty cash transaction number
petty_cash_funds.fund_size|Imprest amount of the fund
petty_cash_funds.max_limit|Largest single payment allowed from the fund
petty_cash_funds.minimum_cashbox|Cash level that triggers replenishment
petty_cash_funds.available_cash|Cash currently available in the fund
petty_cash_funds.custodian_user_id|Custodian of the fund
petty_cash_funds.transaction_date|Date the fund was established
petty_cash_funds.bank_code|Bank the fund is replenished from
petty_cash_funds.bank_account_code|Bank account the fund is replenished from
petty_cash_receipts.fund_id|Fund that received the cash
petty_cash_receipts.bank_code|Bank related to the receipt
petty_cash_receipts.credit_account|GL account credited
petty_cash_receipts.receipt_date|Date the cash was received
petty_cash_replenishments.fund_id|Fund replenished
petty_cash_replenishments.bank_code|Bank the replenishment was drawn from
petty_cash_replenishments.replenish_date|Date of replenishment
petty_cash_requests.request_number|Request number
petty_cash_requests.fund_id|Fund the cash is requested from
petty_cash_requests.requester_user_id|User who requested the cash
petty_cash_requests.request_date|Date of the request
placements.placement_number|Placement slip number (PS series)
placements.insurance_company_id|Lead insurer
placements.bound_at|Date and time all participants had bound the risk
placements.issued_at|Date and time the policy was issued from the placement
placements.owner_user_id|Account executive who owns the placement
placements.policy_id|Policy issued from the placement
placements.quote_id|Quotation the placement was prepared from
placements.source|Origin of the placement: a quotation or a direct policy
policies.bill_number|Number of the first premium bill of the policy
policies.renewed_from|Expiring policy this policy renews
policies.renewed_to|Policy that renewed this policy
policies.payment_status|Premium payment status of the policy
policies.payment_method|Payment method recorded on the policy
policies.issued_date|Date the policy was issued
policies.insurance_company_id|Insurer (lead insurer when co-insured)
policies.owner_user_id|Account executive who owns the policy
policies.placement_id|Placement slip the policy was issued from
policies.quote_id|Quotation the policy was converted from
policies.details|Risk and party details of the policy and the renewal link (JSON)
policies.doc|Policy document data carried from the quotation or placement (JSON)
policy_payments.submitted_by|Front-office user who captured the payment
policy_payments.confirmed_by|Accounting user who confirmed the payment
policy_payments.rejected_by|Accounting user who rejected the payment
policy_payments.paid_on|Date the client paid
policy_payments.reject_reason|Reason the payment was rejected
policy_payments.ar_number|Acknowledgement receipt number issued to the client
policy_payments.receipt_id|Official receipt issued on confirmation
postal_codes.country_code|Country code
postal_codes.district|District or barangay of the postal code
postal_codes.code|Postal (ZIP) code
posting_rule_lines.rule_id|Posting rule version the line belongs to
posting_rule_lines.side|Dr (debit) or Cr (credit)
posting_rule_lines.account_type|How the account is found: role (account determination), gl (fixed account), resolver (computed) or context (supplied by the operation)
posting_rule_lines.account|Account role, GL code, resolver name or context key, according to the account type
posting_rule_lines.fallback_role|Role used when a context or resolver line receives no account
posting_rule_lines.amount_key|Amount supplied by the business event that the line posts (for example grossPremium, commission)
posting_rule_lines.per_participant|Yes to post one line per co-insurer with its share of the amount
posting_rules.event_code|Business event the rule posts (for example policy.issue.broker_billed, receipt.apply)
posting_rules.branch_source|Where the branch of the lines comes from
posting_rules.approval_status|Maker-checker status of the version; only approved versions post
posting_rules.change_note|Explanation of the version
premium_charge_rules.unit_amount|Per unit: amount per unit; flat: the amount
premium_charge_rules.unit_size|Per unit: premium per unit (for example 4.00 for DST)
premium_charge_rules.fraction_rule|Treatment of a part unit: round up or prorate
premium_charge_rules.regimes|Product tax regimes the rule applies to; empty means all
premium_charge_rules.minimum_amount|Minimum charge
premium_charge_rules.rate|Rate in percent (percent method)
premium_instalment_plans.receivable_id|Premium bill split into instalments
premium_instalment_plans.down_payment|Down payment due first
premium_instalment_plans.instalment_count|Number of instalments (1 to 60)
premium_instalment_plans.first_due_date|Due date of the first instalment
premium_instalments.plan_id|Instalment plan
premium_instalments.seq|Instalment number within the plan
premium_instalments.due_date|Due date of the instalment
premium_warranty_actions.extension_id|Warranty extension request the action relates to
premium_warranty_actions.endorsement_id|Cancellation endorsement raised for Operations
premium_warranty_extensions.current_deadline|Premium warranty deadline before the extension
premium_warranty_extensions.requested_deadline|New deadline requested
product_components.template_id|Product template the component belongs to
product_components.kind|Component type (coverages, rating factors, taxes, underwriting rules, documents ...)
product_components.data|Content of the component: covers, rating tables, rules (JSON)
product_risk_mappings.product_code|Product code the mapping applies to
product_risk_mappings.lob_code|Line of business code
product_risk_mappings.product_name|Product name
product_risk_mappings.definition_type|Kind of risk definition (vehicle details, property risk fields, risk sections ...)
product_risk_mappings.definition_label|Label of the definition shown on screens
product_risk_mappings.configuration|Risk fields and their rules (JSON)
product_risk_sections.mapping_id|Risk mapping the section belongs to
product_risk_sections.section_code|Section code
product_risk_sections.section_label|Section name
product_risk_sections.default_rate_percent|Default premium rate of the section in percent
product_risk_sections.is_active|Yes when the section is offered
product_templates.config|Rating parameters, taxes, commission, limits and wording (JSON)
product_templates.template_code|Template code (unique per version)
product_templates.version_label|Readable version label
product_templates.base_rate|Base premium rate
product_templates.min_premium|Minimum premium
product_templates.max_premium|Maximum premium
product_templates.features|Product features (JSON)
product_templates.insurers|Insurers offering the product (JSON)
product_templates.tags|Search tags (JSON)
product_templates.parent_id|Template this version was derived from
product_templates.retired_at|Date and time the version was retired
product_templates.retired_reason|Reason for retirement
product_templates.product_id|Product the template prices
products.line|Line of business of the product
products.business_type|package (multi-line bundle) or non_package
products.premium_tax_regime|Tax regime of the premium: VAT, premium tax or exempt
quote_customer_responses.channel|How the customer answered (phone, Viber/WhatsApp, meeting, signed form, e-mail)
quote_customer_responses.response_date|Date of the customer's answer
quote_customer_responses.recorded_by|Staff member who recorded the answer
quote_customer_responses.outcome|Customer's answer
quotes.quote_number|Quotation number (QT series)
quotes.agent_user_id|Account executive who prepared the quotation
quotes.insurance_company_id|Insurer quoted (lead insurer when co-insured)
quotes.signatory_id|Signatory printed on the quotation
quotes.broker_slip_id|Broker slip the quotation was prepared from
quotes.policy_id|Policy the quotation was converted into
quotes.vehicle|Vehicle details: make, model, variant, year, plate, chassis and engine numbers (JSON)
quotes.coverage|Selected covers: bodily injury, property damage, personal accident and add-ons (JSON)
quotes.ncd|No-claim discount
quotes.approval_token_hash|Hash of the token in the customer approval link
quotes.approval_token|Token of the customer approval link (older quotations; new links keep only the hash)
quotes.approval_sent_to|E-mail address the approval link was sent to
quotes.approval_sent_at|Date and time the approval link was sent
quotes.customer_accepted_at|Date and time the customer accepted
quotes.submitted_to_insurer_at|Date and time the quotation was submitted to the insurer
receipt_applications.receipt_id|Official receipt applied; empty for payments recorded without a receipt
receipt_applications.receipt_line_id|Receipt line applied
receipt_applications.receivable_id|Bill paid
receipt_applications.remitted_invoice_id|Invoice list that remitted the insurer share
receipt_applications.applied_by|User who applied the payment
receipt_applications.collected_on|Date the money was collected
receipt_lines.paid|Amount paid on the line
receipt_lines.un_paid|Amount still unpaid on the policy after the line
receipt_lines.discounts|Discount allowed
receipt_lines.ewt|Expanded withholding tax deducted by the client
receipt_lines.other|Other deductions
receipt_lines.applied_amount|Amount applied to bills
receipts.receipt_number|Official receipt number (OR series)
receipts.receipt_type|Type of receipt (Payment)
receipts.receipt_status|Status shown on the receipt list
receipts.external_ref|Number supplied by the calling system (kept for reference)
receipts.bank_account_code|Bank account the money was deposited to
receipts.bank_id|Bank of the cheque or transfer
receipts.customer_name|Name of the payer printed on the receipt
receivable_credits.refund_amount|Part of the credit payable back to the client (premium already paid)
receivable_credits.kind|Return premium or cancellation
receivable_participants.due_to_insurer|Amount due to the insurer for its share (gross less commission and taxes)
receivable_participants.gross|Gross premium of the insurer's share
receivables.bill_number|Bill number (INV series)
receivables.age_days|Days since the due date
receivables.ageing_bucket|Ageing bucket of the bill (for example 0-30, 31-60)
receivables.last_payment_at|Date and time of the last payment
receivables.go_live_date|Go-live date of a bill imported as an opening balance
receivables.source|What raised the bill: policy, endorsement, renewal, receipt or manual
recurring_journal_runs.recurring_id|Recurring journal template
recurring_journal_runs.occurrence_date|Date of the occurrence posted
recurring_journal_runs.jv_id|Journal created for the occurrence
recurring_journal_runs.close_run_id|Close run that created the journal
recurring_journals.auto_post|Yes to post the generated journal without approval
recurring_journals.auto_reverse|Yes to reverse the journal on day 1 of the next period (accruals)
recurring_journals.next_run_date|Date of the next occurrence
recurring_journals.last_run_date|Date of the last occurrence
recurring_journals.last_jv_id|Journal of the last occurrence
recurring_journals.lines|Journal lines of the template: account, debit, credit, memo (JSON)
refresh_tokens.jti|Unique id of the refresh token (JWT id)
refresh_tokens.device_id|Device the token was issued to
refresh_tokens.family_id|Token family: rotated tokens share it, and reuse of an old token revokes the family
refresh_tokens.revoked_reason|Why the token was revoked
refresh_tokens.replaced_by|Token that replaced this one on rotation
reinsurance_bordereaux.entries|Number of entries in the bordereau
reinsurance_bordereaux.file_key|Storage key of the bordereau file
reinsurance_bordereaux.file_url|Download address of the file
reinsurance_bordereaux.confirmation_date|Date the reinsurer confirmed the bordereau
reinsurance_bordereaux.type|Premium or claims bordereau
reinsurance_exceptions.reconciliation_id|Reinsurance reconciliation the exception belongs to
reinsurance_exceptions.date|Date of the exception
reinsurance_reconciliations.our_amount|Amount per the broker's records
reinsurance_reconciliations.their_amount|Amount per the reinsurer's statement
reinsurance_reconciliations.items|Number of items reconciled
reinsurance_recoveries.recovery_number|Recovery number from the document numbering series
reinsurance_recoveries.date_of_loss|Date of loss
reinsurance_recoveries.cause_of_loss|Cause of loss
reinsurance_recoveries.gross_claim|Gross claim amount
reinsurance_recoveries.recoverable_amount|Amount recoverable from the reinsurer
reinsurance_recoveries.settlement_amount|Amount settled by the reinsurer
reinsurance_recoveries.recovery_date|Date the recovery was received
reinsurance_recoveries.expected_settlement|Expected settlement date
reinsurance_recoveries.cash_call|Cash call request to the reinsurer (JSON)
reinsurance_recoveries.documents|Supporting documents (JSON)
reinsurance_treaties.reinsurer|Reinsurer name
reinsurance_treaties.security_rating|Security rating of the reinsurer
reinsurance_treaties.treaty_type|Treaty type (for example Quota Share)
reinsurance_treaties.share|Share ceded under the treaty
reinsurance_treaties.treaty_number|Treaty number
reinsurance_treaties.reinsurer_ids|Reinsurers participating in the treaty (JSON)
reinsurance_treaties.retention|Retention kept before cession
reinsurance_treaties.capacity|Treaty capacity
reinsurers.rating_agency|Agency that issued the rating
reinsurers.contact|Contact details (JSON)
reinsurers.type|Local or foreign reinsurer
remittance_allocations.receipt_application_id|Receipt application (collection) split
remittance_allocations.invoice_list_id|Invoice list that remitted the allocation
remittance_approvals.transaction_type|Transaction approved (Settlement, Insurer Remittance ...)
remittance_approvals.entity_id|Record approved
remittance_approvals.sla_hours|Target hours to decide
remittance_approvals.current_level|Approval level reached
remittance_approvals.required_levels|Number of approval levels required
remittance_approvals.initiator_id|User who raised the request
remittance_approvals.delegated_to|User the request was delegated to
remittance_approvals.action_by|User who took the last action
remittance_approvals.action_at|Date and time of the last action
remittance_approvals.history|Actions taken at each level (JSON)
remittance_delegations.trans_types|Transaction types delegated (JSON)
remittance_delegations.amount_limit|Largest amount the delegate may approve
remittance_delegations.from_date|First day of the delegation
remittance_delegations.to_date|Last day of the delegation
remittance_items.created_by|User who created the item
remittance_lines.remittance_id|Remittance the line belongs to
remittance_lines.premium|Premium of the policy included
remittance_lines.commission|Commission deducted
remittance_lines.net|Net amount remitted for the policy
remittance_lines.tax|Taxes included
remittances.remittance_number|Remittance number (REM series)
remittances.insurance_company_id|Insurer paid
remittances.kind|Remittance kind (direct-bill or agency-bill)
remittances.gross_premium|Gross premium collected for the insurer
remittances.commission|Commission retained by the broker
remittances.net_due|Net amount due to the insurer
remittances.tax|Taxes included
remittances.bill_number|Remittance bill number sent to the insurer
remittances.remittance_date|Date of the remittance bill
remittances.policy_count|Number of policies included
remittances.agent_user_id|Account executive of the remittance
remittances.agency_code|Agency code of the remittance (screen filter)
remittances.agency_name|Agency name
remittances.previous_balance|Unpaid balance brought forward; the bill amount is net due plus previous balance
remittances.config_code|Remittance configuration (master record) applied
remittances.batch_ref|Approval batch the remittance was submitted in
remittances.delivery_method|How the bill is delivered to the insurer (JSON list)
remittances.settled_at|Date and time the remittance was settled
renewal_activities.activity_type|Kind of activity (notice, reminder, quote generated, approval, renewed, lapsed ...)
renewal_activities.next_action|Next action planned
renewal_activities.follow_up_date|Date of the next follow-up
renewal_activities.details|Details of the activity (JSON)
renewal_batch_policies.batch_id|Renewal batch
renewal_batch_policies.is_selected|Yes when the policy is selected for the batch run
renewal_batch_policies.notice_status|Status of the renewal notice of the policy in the batch
renewal_batch_policies.notice_sent_at|Date and time the notice was sent
renewal_batch_policies.quote_status|Status of the renewal quotation of the policy in the batch
renewal_batch_policies.quote_number|Renewal quotation number
renewal_batch_policies.quoted_premium|Premium quoted for the renewal
renewal_batch_policies.quoted_at|Date and time of the quotation
renewal_batches.batch_number|Batch number
renewal_batches.criteria|Selection criteria of the batch (expiry window, product, insurer) (JSON)
renewal_notices.batch_id|Renewal batch that sent the notice
renewal_notices.stage|Notice stage: 1 first, 2 second, 3 final
renewal_notices.notice_type|Notice type
renewal_notices.recipient|E-mail address or number the notice was sent to
renewal_quotes.quote_number|Renewal quotation number
renewal_quotes.previous_premium|Premium of the expiring policy
renewal_quotes.claims_loading|Loading for the claims experience
renewal_quotes.loyalty_discount|Loyalty discount
renewal_quotes.total_premium|Total renewal premium
renewal_quotes.variance|Difference to the previous premium
renewal_quotes.variance_pct|Difference to the previous premium in percent
renewal_quotes.rating|Rating details (JSON)
renewals.policy_id|Expiring policy
renewals.new_policy_id|Renewal policy issued
renewals.owner_user_id|Account executive responsible for the renewal
renewals.premium_old|Premium of the expiring policy
renewals.premium_new|Premium of the renewal
renewals.renewal_number|Renewal number from the document numbering series
renewals.coverage_details|Covers proposed for the renewal (JSON)
renewals.accessories|Vehicle accessories declared (JSON)
renewals.order_summary|Premium summary of the renewal order (JSON)
renewals.policy_limits|Limits of the renewal policy (JSON)
renewals.premium_breakdown|Premium breakdown: net premium, taxes, charges (JSON)
renewals.notice_stage|Last renewal notice stage sent
renewals.last_notice_at|Date and time of the last notice
renewals.contact_attempts|Number of contact attempts
renewals.last_contact_at|Date and time of the last contact
renewals.lapse_reason|Reason the renewal lapsed
renewals.lapsed_at|Date and time the case was marked lapsed
renewals.renewed_at|Date and time the policy was renewed
renewals.approval_note|Note of the approver
renewals.renewal_type|regular, grace (renewed in the grace period) or lapsed (renewed after lapse)
report_definitions.code|Report code
report_definitions.parameters|Filter form of the report (JSON schema)
report_definitions.query_name|Key of the report query in the reports module
report_definitions.default_columns|Columns shown by default: key, label, type, total (JSON)
report_definitions.permission|Permission needed to run the report
report_definitions.category|operational or financial report
report_schedules.report_code|Report sent
report_schedules.recipients|E-mail addresses that receive the report
report_schedules.last_report_id|Last file generated
report_schedules.job_id|Scheduled job that runs the schedule
risk_participants.entity_type|Record the participant belongs to: broker slip, quotation, placement or policy
risk_participants.entity_id|Identifier of that record
risk_participants.insurance_company_id|Participating insurer
risk_participants.premium|Premium of the share
risk_participants.commission|Commission on the share
risk_participants.taxes|VAT, DST, LGT and FST of the share (JSON)
risk_participants.confirmed_by|User who recorded the insurer's binding confirmation
risk_participants.confirmed_at|Date and time the insurer bound its share
roles.code|Role code used in the code and settings (for example accounting-manager)
roles.inherits|Roles whose permissions this role inherits
scheduled_jobs.code|Job code
scheduled_jobs.handler|Name of the job function run
scheduled_jobs.next_run_at|Date and time of the next run
signatories.signature_key|Storage key of the signature image printed on documents
sod_rules.role_a|First role of the conflicting pair
sod_rules.role_b|Second role of the conflicting pair
sod_rules.action|block (refuse the assignment) or warn
states.country_id|Country the province belongs to
states.name|Province name
tax_codes.code|Tax code
tax_codes.tax_type|Kind of tax
tax_codes.atc|BIR alphanumeric tax code (ATC), for example WC158
tax_codes.nature_of_payment|Nature of income payment printed on BIR Form 2307 and the alphalists
tax_codes.applies_to|Whether the code applies to sales, purchases or both
tax_codes.payee_kind|Payee the rate applies to: individual, corporate or any
tax_codes.rate|Tax rate in percent
tax_codes.gl_account|GL account the tax is booked to
user_delegations.transaction_types|Transaction types delegated; empty means all
user_delegations.date_from|First day of the delegation
user_delegations.date_to|Last day of the delegation
user_delegations.created_by|User who set up the delegation
user_delegations.revoked_by|User who revoked the delegation
users.username|Sign-in name (unique)
users.employee_code|Employee number
users.department|Department
users.reporting_to|Manager the user reports to
users.branch_code|Branch of the user
users.must_change_password|Yes when the user must change the password at the next sign-in
users.failed_logins|Consecutive failed sign-ins; the account locks at the limit in the security settings
users.password_changed_at|Date and time the password was last changed
users.totp_secret|Secret of the enabled second factor (TOTP), stored encrypted
users.totp_pending_secret|Second-factor secret issued during set-up, until confirmed
users.totp_enabled|Yes when two-factor sign-in is enabled
users.totp_enabled_at|Date and time two-factor sign-in was enabled
users.totp_last_step|Last accepted time step, so a code cannot be used twice
users.token_version|Version carried in every access token; raising it ends all sessions of the user
vehicle_models.brand_id|Vehicle make
vehicle_variants.model_id|Vehicle model
vehicle_variants.body_type|Body type (Sedan, SUV, Pickup, MPV, Van)
vehicle_variants.seating|Seating capacity
winback_campaigns.campaign_number|Campaign number
winback_campaigns.target_segment|Customer segment targeted
winback_campaigns.budget|Campaign budget
winback_campaigns.offers|Offers made in the campaign (JSON)
year_end_runs.run_number|Year-end run number (YEC series)
year_end_runs.fiscal_year|Fiscal year closed
year_end_runs.next_fiscal_year|Fiscal year that receives the opening balances
year_end_runs.checks|Pre-close checks and their results (JSON)
year_end_runs.closing_jv_id|Closing journal that clears income and expense accounts (period 13)
year_end_runs.transfer_jv_id|Journal that transfers the net income to retained earnings
year_end_runs.reversal_jv_ids|Journals that reversed the close
year_end_runs.net_income|Net income of the year closed
year_end_runs.opening_accounts|Number of accounts carried forward as opening balances
year_end_runs.reverse_reason|Reason the year-end close was reversed
quotes.approval_token|Token of the latest customer approval link, kept so staff can copy the link again (for Viber or WhatsApp); the public page checks the hash
password_resets.code|Clear-text reset code of the first version; no longer filled (codes issued before migration 0090 were withdrawn)
password_resets.attempts|Number of wrong codes entered
sequences.name|Counter name (series code of the document numbering master)
sequences.period|Counter period: the year (2026), fiscal year (FY2027), month (2026-09) or ALL, according to the reset rule
sequences.value|Last running number allocated in the period
schema_migrations.name|File name of the applied migration
schema_migrations.applied_at|Date and time the migration was applied
claim_field_changes.user_id|User who made the change
claim_field_changes.username|Sign-in name of the user who made the change
audit_log.username|Sign-in name of the user who performed the action
remittance_items.kind|Kind of work item (settlement, adjustment, transfer, batch, exception)
remittance_items.data|Item details entered on the remittance screens (JSON)
remittances.data|Further remittance bill details (JSON)
period_close_run_checks.amount|Amount of the exceptions found, where the check measures an amount
period_close_run_checks.label|Checklist item label
period_close_run_checks.message|Result message of the check
coverages.label|Label of the cover option shown on the quotation
master_types.label|Name of the master screen
product_templates.category|Product category (Motor, Property, Marine, Travel, Health, Employee Benefits)
generated_reports.name|File name shown in the report history
report_schedules.name|Name of the schedule
reinsurers.capacity|Capacity the reinsurer accepts
reinsurers.rating|Security rating of the reinsurer (security-rating master)
reinsurance_treaties.capacity|Treaty capacity (largest sum that can be ceded)
renewal_activities.method|Contact method (Email, SMS, Phone, Letter)
renewal_notices.method|How the notice was sent (Email, SMS, Phone, Letter)
renewal_activities.outcome|Outcome of the contact
payment_links.outcome|Result reported by the gateway
remittance_allocations.gross|Gross premium of the insurer's share of the collection
remittance_allocations.net|Net amount due to the insurer for its share
remittance_allocations.commission|Commission on the insurer's share
receivable_participants.commission|Commission on the insurer's share
receivable_participants.taxes|Taxes of the insurer's share (JSON)
receivables.balance|Amount still unpaid on the bill
receivables.amount|Amount billed: gross premium including taxes and charges
receipts.amount|Total amount received on the receipt
policy_payments.amount|Amount the client paid
receipt_applications.amount|Amount of the receipt applied to the bill
document_numbering.module|Application module that uses the series
permissions.module|Module the permission protects
posting_rules.module|Module that raises the business event
posting_rules.source|Default journal source of the rule
posting_rules.entry_type|Default journal entry type (the operation may override it)
lgu_tax_rates.rate|Tax rate in percent of the premium (0.2 = 0.2%)
lgu_tax_rates.code|LGU code (province or city)
package_sections.rate|Rate applied to the section's sum insured
package_sections.line|Line of business of the section
incentive_results.period|Period of the result (YYYY-MM)
remittances.period|Period the remittance covers (YYYY-MM)
journal_vouchers.period|Accounting period of the journal (YYYY-MM), from the journal date
reinsurance_bordereaux.period|Period reported (YYYY-MM)
reinsurance_reconciliations.period|Period reconciled (YYYY-MM)
bank_reconciliations.period|Month reconciled (YYYY-MM)
period_close_entries.period|Accounting period of the close-run journal
recurring_journal_runs.period|Accounting period of the occurrence
package_bundle_sections.property|Yes when the section is a property risk that attracts fire service tax; empty means decided by the product line
package_sections.property|Yes when the section is a property risk that attracts fire service tax; empty means decided by the product line
premium_charge_rules.lines|Product lines the rule applies to; empty means all lines
disbursements.payee_type|Type of payee (Insurer, Customer, Agent/Referrer, Supplier)
roles.code|Role code used in the code and settings. Delivered roles: system-admin, sales, processing, operations, claims, accounting, accounting-manager
leads.status|Current status of the lead. Values: New, Contacted, Qualified, QuoteGenerated, Converted, Lost
quotes.status|Current status of the quotation (stored code; screen label in brackets). Values: draft (Draft), sent (PendingCustomer), accepted (CustomerAccepted), submitted (SubmittedToInsurer), approved (Approved), converted (ConvertedToPolicy), rejected (Rejected), dropped (Dropped), expired (Expired)
policies.status|Current status of the policy. Values: active (shown as Active; issued is also shown as Active), expired, cancelled, renewed, suspended, draft
endorsements.status|Current status of the endorsement (stored code; screen label in brackets). Values: draft (Draft), submitted (PendingCustomer), cancel-initiated (InitiateCancel), approved (Approved), completed (Completed), cancelled (Cancelled), rejected (Rejected)
endorsements.endorsement_type|Type of change (for example coverage, cancellation, address, vehicle, fire-details)
commissions.status|Status of the commission line. Values: Accrued, Eligible (premium collected), Approved (maker-checker), Paid; a reversal sets reversed_at and, after payment, the clawback flag
product_templates.status|Status of the template version. Values: Draft, Active, Retired
claim_field_changes.action|Claim event that caused the change (for example Claim Registered, Status Changed, Settlement Submitted, Settlement Approved, Claim Settled, Claim Rejected)
receivables.status|Status of the bill. Values: open, partial, paid, credited, written-off, cancelled
journal_vouchers.status|Status of the journal. Values: draft, for-approval, approved, posted, rejected, reversed; only posted and reversed journals count in the ledger
renewals.status|Stage of the renewal case. Values: pipeline, notice-1, notice-2, final-notice, quoted, pending-approval, renewed, lapsed
claims.status|Current status of the claim. Values: registered, in-review, pending-approval, approved, settled, closed, rejected
login_history.method|Sign-in method (password, 2fa, forgot-password, password-change)
receipts.payment_mode|How the money was paid (cash, check, bank-transfer, online, card, gcash)
reinsurers.id|Unique identifier of the reinsurer, a readable code (for example RE001)
banks.code|Short bank code used by bank account masters and statement formats (for example BDO, BPI)
banks.name|Bank name as printed on vouchers and receipts
insurance_companies.code|Short insurer code used on documents, imports and reports
insurance_companies.name|Registered name of the insurer printed on documents
insurance_companies.address|Business address of the insurer
branches.address|Address of the branch printed on documents
postal_codes.country_code|Country of the postal code (ISO code)
postal_codes.province|Province of the postal code
lgu_tax_rates.province|Province of the local government unit
states.name|Name of the province
signatories.designation|Job title printed under the signature
insurer_rate_tables.deductible_amount|Deductible as an amount, used in the comparison
premium_charge_rules.minimum_amount|Smallest charge applied, whatever the premium
product_risk_mappings.product_name|Name of the product the mapping applies to
product_risk_sections.section_code|Code of the risk section (unique within the mapping)
product_risk_sections.section_label|Name of the risk section shown on screens
payment_gateways.code|Gateway code used in payment links and environment variable names
insurer_offers.rate|Premium rate offered, in percent of the sum insured
package_endorsements.endorsement_number|Number of the section endorsement
checkbooks.instrument_no|Cheque number printed on the instrument
invoice_lists.lc_amount|Amount in local currency (PHP)
petty_cash_requests.request_number|Number of the petty cash request
remittances.agency_name|Agency name shown on the remittance bill
claims.loss_date|Date the loss occurred
claims.loss_time|Time the loss occurred
renewal_batches.batch_number|Number of the renewal batch
renewal_notices.notice_type|Notice type (first, second, final)
renewal_quotes.loyalty_discount|Discount for a loyal client
winback_campaigns.campaign_number|Number of the win-back campaign
gl_accounts.name|Account name shown on journals and financial statements
journal_lines.memo|Narrative of the line
journal_lines.branch_description|Branch name of the line
tax_codes.code|Tax code used on transactions and in account determination
bank_book_lines.txn_date|Journal date (book date of the movement)
bank_match_rules.code|Code of the matching rule
reinsurance_recoveries.claim_number|Claim number of the recovered claim
reinsurance_recoveries.date_of_loss|Date the loss occurred
reinsurance_recoveries.cause_of_loss|Cause of the loss
reinsurance_treaties.reinsurer|Name of the lead reinsurer
reinsurance_treaties.treaty_number|Treaty reference number
reinsurers.country|Country of domicile of the reinsurer
incentive_programs.program_code|Code of the incentive programme
incentive_results.tier|Tier of the programme structure reached
users.department|Department the user works in
email_outbox.subject|Subject line of the e-mail
job_queue.queue|Name of the work queue
report_definitions.code|Report code used in addresses and schedules
scheduled_jobs.code|Job code (for example renewal-notices, housekeeping)
permissions.code|Permission code in the form read:<module>, write:<module> or approve:<area>
claim_history.note|Note entered with the status change
"""
TCOL = {}
for line in T.strip().split('\n'):
    k, v = line.split('|', 1)
    TCOL[k] = v
