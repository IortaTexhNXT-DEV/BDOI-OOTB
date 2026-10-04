-- Access control of a broker's staff (Master > User Management): the authority matrix (approval limits per role or user
-- and transaction type), delegation of authority, segregation-of-duties rules, periodic access reviews, and the controls
-- on dormant accounts. The user and role screens themselves already exist (users, roles, role_permissions).

-- Transactions that need an approver and are limited by amount (or percent for discounts). Labels are editable.
CREATE TABLE IF NOT EXISTS authority_transaction_types (
  code text PRIMARY KEY,
  name text NOT NULL,
  measure text NOT NULL DEFAULT 'amount' CHECK (measure IN ('amount', 'percent')),
  description text,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);

INSERT INTO authority_transaction_types(code, name, measure, description, sort_order) VALUES
 ('quotation_discount', 'Quotation discount', 'percent', 'Discount given on a quotation, as a percent of the premium', 10),
 ('policy_issue', 'Policy issuance', 'amount', 'Gross premium of a policy issued or bound', 20),
 ('return_premium', 'Return premium / refund to client', 'amount', 'Return premium on an endorsement or cancellation, and client refunds', 30),
 ('claim_settlement', 'Claim settlement approval', 'amount', 'Settlement amount of a claim approved for release', 40),
 ('payment_voucher', 'Payment voucher and cheque release', 'amount', 'Cheque or payment released on a payment voucher (insurer remittances, payouts, expenses)', 50),
 ('journal_voucher', 'Journal voucher approval', 'amount', 'Total debits of a manual journal voucher approved for posting', 60),
 ('write_off', 'Write-off', 'amount', 'Residual write-off when open items are matched', 70),
 ('commission_payout', 'Commission payout', 'amount', 'Sub-agent (comsub) commission paid out on a voucher', 80),
 ('petty_cash', 'Petty cash disbursement', 'amount', 'Petty cash request approved and paid', 90)
ON CONFLICT (code) DO NOTHING;

-- One limit per role or per user and transaction type. max_amount NULL = no limit. A limit takes effect once another
-- administrator approves it (status pending -> active); an edit creates a new pending row and retires the old one on approval.
CREATE TABLE IF NOT EXISTS authority_limits (
  id bigserial PRIMARY KEY,
  transaction_type text NOT NULL REFERENCES authority_transaction_types(code),
  role_code text REFERENCES roles(code) ON DELETE CASCADE,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  max_amount numeric(18, 2),
  currency text NOT NULL DEFAULT 'PHP',
  remarks text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected', 'retired')),
  replaces_id bigint REFERENCES authority_limits(id),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  requested_by text REFERENCES users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_by text REFERENCES users(id),
  decided_at timestamptz,
  decision_note text,
  CHECK ((role_code IS NOT NULL) <> (user_id IS NOT NULL)),
  CHECK (max_amount IS NULL OR max_amount >= 0)
);
CREATE INDEX IF NOT EXISTS authority_limits_lookup ON authority_limits(transaction_type, status);

-- Out-of-office cover: the delegate may approve with the delegator's authority for the listed types (empty = all) and dates.
CREATE TABLE IF NOT EXISTS user_delegations (
  id bigserial PRIMARY KEY,
  delegator_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delegate_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_types text[] NOT NULL DEFAULT '{}',
  date_from date NOT NULL,
  date_to date NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_by text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_by text REFERENCES users(id),
  revoked_at timestamptz,
  CHECK (delegator_id <> delegate_id),
  CHECK (date_to >= date_from)
);
CREATE INDEX IF NOT EXISTS user_delegations_delegate ON user_delegations(delegate_id, status);

-- Roles one person should not hold together (e.g. placing business and releasing the money for it).
CREATE TABLE IF NOT EXISTS sod_rules (
  id bigserial PRIMARY KEY,
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  role_a text NOT NULL REFERENCES roles(code) ON DELETE CASCADE,
  role_b text NOT NULL REFERENCES roles(code) ON DELETE CASCADE,
  action text NOT NULL DEFAULT 'block' CHECK (action IN ('block', 'warn')),
  reason text,
  active boolean NOT NULL DEFAULT true,
  CHECK (role_a <> role_b)
);

-- The default rules are in seeds/66_authority_matrix.sql (the roles exist only after the seed on a new database).

-- Periodic access review (recertification): each user's roles are confirmed or revoked by a reviewer.
CREATE TABLE IF NOT EXISTS access_reviews (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_by text REFERENCES users(id),
  closed_at timestamptz
);
CREATE TABLE IF NOT EXISTS access_review_items (
  id bigserial PRIMARY KEY,
  review_id bigint NOT NULL REFERENCES access_reviews(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  roles text[] NOT NULL DEFAULT '{}',
  last_login_at timestamptz,
  decision text NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending', 'keep', 'revoke')),
  remarks text,
  decided_by text REFERENCES users(id),
  decided_at timestamptz,
  UNIQUE (review_id, user_id)
);

INSERT INTO permissions(code, module, description) VALUES
 ('read:access-control', 'users', 'View the user access matrix, authority matrix, delegations, segregation-of-duties rules and access reviews'),
 ('write:access-control', 'users', 'Propose authority limits, record delegations, maintain segregation-of-duties rules and run access reviews'),
 ('approve:access-control', 'users', 'Approve authority limits proposed by another administrator (maker-checker)')
ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE (r.code = 'system-admin' AND p.code IN ('read:access-control', 'write:access-control', 'approve:access-control'))
   OR (r.code = 'accounting-manager' AND p.code = 'read:access-control')
ON CONFLICT DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('access.authority_enforced', 'true', 'access', 'Check the authority matrix when a transaction is approved', 'boolean'),
 ('access.authority_without_limit', '"allow"', 'access', 'When none of the approver''s roles has a limit for the transaction type: allow or refuse', 'string'),
 ('access.sod_enforced', 'true', 'access', 'Check segregation-of-duties rules when roles are assigned to a user', 'boolean'),
 ('access.dormant_days', '90', 'access', 'Days without a sign-in after which an active account is deactivated by the daily job (0 = never)', 'number')
ON CONFLICT (key) DO NOTHING;
