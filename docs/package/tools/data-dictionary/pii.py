"""Columns holding personal information (Republic Act No. 10173, Data Privacy Act of 2012)."""
P = 'Personal information'
S = 'Sensitive personal information'
C = 'Credential / security secret'
J = 'May contain personal information (free text, JSON or file)'

_party = {
    'first_name': P, 'last_name': P, 'display_name': P, 'preferred_name': P, 'birth_date': S, 'gender': P,
    'email': P, 'phone': P, 'address': P, 'house_no': P, 'road': P, 'soi': P, 'moo': P, 'barangay': P, 'city': P,
    'state': P, 'postal_code': P, 'country': P, 'tin': S, 'tax_number': S, 'extra': J, 'company_name': P, 'notes': J,
}
PII = {}
for t in ('clients', 'leads'):
    for c, k in _party.items():
        PII[(t, c)] = k
for c, k in {'username': P, 'display_name': P, 'first_name': P, 'last_name': P, 'email': P, 'phone': P, 'employee_code': P,
             'department': P, 'designation': P, 'reporting_to': P, 'password_hash': C, 'totp_secret': C,
             'totp_pending_secret': C, 'last_login_at': P}.items():
    PII[('users', c)] = k
PII.update({
    ('login_history', 'ip'): P, ('login_history', 'user_agent'): P, ('login_history', 'username'): P,
    ('audit_log', 'ip'): P, ('audit_log', 'username'): P, ('audit_log', 'before_data'): J, ('audit_log', 'after_data'): J,
    ('password_history', 'password_hash'): C, ('password_resets', 'code_hash'): C, ('password_resets', 'code'): C,
    ('refresh_tokens', 'jti'): C, ('refresh_tokens', 'device_id'): P,
    ('commission_referrers', 'name'): P, ('commission_referrers', 'email'): P, ('commission_referrers', 'phone'): P,
    ('commission_referrers', 'tin'): S, ('commission_referrers', 'bank_name'): P, ('commission_referrers', 'bank_account_no'): P,
    ('claims', 'driver'): S, ('claims', 'third_party'): S, ('claims', 'details'): J, ('claims', 'loss_address'): P,
    ('claims', 'adjuster'): J, ('claims', 'settlement'): J, ('claims', 'policy_info'): J, ('claims', 'description'): J,
    ('claim_field_changes', 'old_value'): J, ('claim_field_changes', 'new_value'): J,
    ('quotes', 'vehicle'): P, ('quotes', 'doc'): J, ('quotes', 'approval_sent_to'): P, ('quotes', 'approval_token'): C,
    ('policies', 'details'): J, ('policies', 'doc'): J, ('broker_slips', 'doc'): J, ('placements', 'doc'): J,
    ('broker_slips', 'insured_name'): P, ('endorsements', 'changes'): J,
    ('renewals', 'coverage_details'): J, ('renewal_notices', 'recipient'): P,
    ('receipts', 'customer_name'): P, ('checkbooks', 'customer_name'): P, ('disbursements', 'payee_name'): P,
    ('disbursements', 'referrer_name'): P, ('petty_cash_requests', 'requester_name'): P, ('petty_cash_receipts', 'requester_name'): P,
    ('bir_2307_certificates', 'payee_name'): P, ('bir_2307_certificates', 'payee_tin'): S, ('bir_2307_certificates', 'payee_address'): P,
    ('bir_2307_certificates', 'payor_name'): P, ('bir_2307_certificates', 'payor_tin'): S, ('bir_2307_certificates', 'payor_address'): P,
    ('payment_links', 'payer_name'): P, ('payment_links', 'payer_email'): P, ('payment_links', 'payer_mobile'): P,
    ('payment_links', 'token'): C, ('payment_events', 'payload'): J,
    ('email_outbox', 'to_address'): P, ('email_outbox', 'cc'): P, ('email_outbox', 'body_html'): J,
    ('signatories', 'name'): P, ('signatories', 'signature_key'): P, ('signatories', 'designation'): P,
    ('documents', 'storage_key'): J, ('documents', 'file_name'): J,
    ('policy_payments', 'proof_key'): J, ('direct_bill_client_payments', 'proof_key'): J,
    ('quote_customer_responses', 'attachment_key'): J, ('quote_customer_responses', 'remarks'): J,
    ('insurer_statement_lines', 'insured_name'): P, ('commission_debit_note_lines', 'insured_name'): P,
    ('package_quotes', 'insured_name'): P, ('cessions', 'insured'): P, ('reinsurance_recoveries', 'insured'): P,
    ('collection_actions', 'notes'): J, ('renewal_activities', 'notes'): J, ('agent_events', 'description'): J,
    ('access_review_items', 'last_login_at'): P, ('commission_referrers', 'address'): P,
    ('email_outbox', 'attachments'): J,
    ('privacy_consents', 'evidence'): J, ('privacy_consents', 'withdrawal_reason'): J,
    ('data_subject_requests', 'requester_name'): P, ('data_subject_requests', 'requester_contact'): P,
    ('data_subject_requests', 'description'): J, ('data_subject_requests', 'outcome'): J, ('data_subject_requests', 'response_notes'): J,
})


# Columns added after this list was written are classified from the personal data catalogue of the client data
# masking tool (backend/scripts/lib/pii-catalogue.js, kept complete by test/mask-data.test.js): the masking rule gives
# the class. DD_PII_CATALOGUE names further copies of that file (branches being merged), separated by ":".
import os as _os
import re as _re
from ddpaths import ROOT as _ROOT

_RULE_CLASS = {'tin': S, 'dob': S, 'idNumber': S, 'secret': C, 'json': J, 'freeText': J, 'fileName': J, 'storageKey': J,
               'scrub': J, 'blank': J}


def _catalogue():
    files = [_os.path.join(_ROOT, 'backend', 'scripts', 'lib', 'pii-catalogue.js')]
    files += [f for f in _os.environ.get('DD_PII_CATALOGUE', '').split(':') if f]
    out = {}
    for f in files:
        if not _os.path.exists(f):
            continue
        txt = open(f).read().split('export const TABLE_ACTIONS')[0]
        for m in _re.finditer(r"\.\.\.party\('([a-z_0-9]+)'", txt):
            for col, rule in (('first_name', 'firstName'), ('last_name', 'lastName'), ('company_name', 'companyName'),
                              ('display_name', 'partyName'), ('email', 'email'), ('phone', 'phone'), ('birth_date', 'dob'),
                              ('address', 'street'), ('barangay', 'barangay'), ('city', 'locality'), ('state', 'province'),
                              ('postal_code', 'postal'), ('extra', 'json')):
                out.setdefault((m.group(1), col), rule)
        for m in _re.finditer(r"'([a-z_0-9]+)\.([a-z_0-9]+)':\s*(?:'([A-Za-z]+)'|\{\s*rule:\s*'([A-Za-z]+)')", txt):
            out.setdefault((m.group(1), m.group(2)), m.group(3) or m.group(4))
    return {k: _RULE_CLASS.get(v, P) for k, v in out.items()}


CATALOGUE = _catalogue()


def classify(t, c, cols_of_table):
    if (t, c) in PII and c in cols_of_table:
        return PII[(t, c)]
    if (t, c) in CATALOGUE and c in cols_of_table:
        return CATALOGUE[(t, c)]
    if c in ('insured_name', 'customer_name', 'payee_name', 'payer_name', 'insured', 'requester_name'):
        return P
    return ''
