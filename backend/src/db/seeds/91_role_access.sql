-- Segregation of duties on access (Master > Users and Access > Segregation of Duties): the access rules (kind access,
-- migration 0393), two sets of permissions a role or a person should not combine. They warn; none is broken by the
-- access of a TISPH role on its own (RBAC v4), only by a person holding two roles or by a change of a role's access.
--
-- Idempotent: a rule is added only when its code is missing, so administrator changes are kept.

INSERT INTO sod_rules(code, name, kind, access_a, access_b, action, reason)
VALUES
 ('SOD-ACC-RCPT-SELL', 'Receipting and selling', 'access', '{write:receipts}', '{write:quotations,write:policies}', 'warn',
  'The person who issues receipts and posts cash should not also sell or issue the policies paid for'),
 ('SOD-ACC-PLACE-PAY', 'Placing and paying insurers', 'access', '{write:quotations,write:policies}', '{write:remittance,write:disbursements}', 'warn',
  'The person who places business with an insurer should not also prepare the payments to insurers'),
 ('SOD-ACC-CLAIM-PAY', 'Claims and payment', 'access', '{write:claims}', '{write:disbursements}', 'warn',
  'The claims handler should not also prepare the claim payments'),
 ('SOD-ACC-ADMIN-TXN', 'Administration and transactions', 'access', '{write:users,write:roles,write:access-control}',
  '{write:receipts,write:collections,write:disbursements,write:journal-vouchers,write:remittance,write:policies,write:quotations,write:claims}', 'warn',
  'The person who administers users and access should not enter business or accounting transactions')
ON CONFLICT (code) DO NOTHING;
