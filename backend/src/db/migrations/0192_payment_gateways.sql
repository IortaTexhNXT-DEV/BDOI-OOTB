-- Online premium payments (Master > Packaged Products > Payment Gateways, Sales & Marketing > Payment Links).
--
-- A payment link asks a client to pay a package quotation, a quotation or a policy's open premium through a gateway:
-- Dragonpay, PayMongo (GCash, Maya, GrabPay, cards) or the SANDBOX provider, which simulates success or failure
-- locally for training and UAT. The gateway confirms the payment on a webhook (signature verified per provider); the
-- confirmed payment creates the official receipt and, when allowed, issues the package policy.
-- Merchant credentials and webhook secrets are NEVER stored here: they are read from the environment (secret store)
-- under the gateway's credentials prefix, e.g. PAYMONGO_SECRET_KEY, PAYMONGO_WEBHOOK_SECRET, DRAGONPAY_MERCHANT_ID,
-- DRAGONPAY_PASSWORD (see modules/payment-gateway/README.md).

CREATE TABLE IF NOT EXISTS payment_gateways (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z][A-Z0-9_]*$'),
  name text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('sandbox', 'paymongo', 'dragonpay')),
  enabled boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'sandbox' CHECK (mode IN ('sandbox', 'live')),
  methods text[] NOT NULL DEFAULT '{}',                         -- card, gcash, maya, grabpay, online_banking, otc
  fee_handling text NOT NULL DEFAULT 'absorb' CHECK (fee_handling IN ('absorb', 'pass_on')),
  fee_percent numeric(7,4) NOT NULL DEFAULT 0 CHECK (fee_percent >= 0 AND fee_percent < 100),
  fee_fixed numeric(14,2) NOT NULL DEFAULT 0 CHECK (fee_fixed >= 0),
  credentials_prefix text NOT NULL CHECK (credentials_prefix ~ '^[A-Z][A-Z0-9_]*$'),
  link_validity_hours int CHECK (link_validity_hours IS NULL OR link_validity_hours BETWEEN 1 AND 2160),
  auto_issue boolean NOT NULL DEFAULT true,                      -- issue package policies once paid
  bank_account_code text,                                        -- bank account the settlements are deposited to (receipt)
  sort_order int NOT NULL DEFAULT 100,
  remarks text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (provider <> 'sandbox' OR mode = 'sandbox'));
DROP TRIGGER IF EXISTS payment_gateways_updated ON payment_gateways;
CREATE TRIGGER payment_gateways_updated BEFORE UPDATE ON payment_gateways FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO payment_gateways(code, name, provider, enabled, mode, methods, fee_handling, fee_percent, fee_fixed, credentials_prefix, sort_order, remarks) VALUES
 ('SANDBOX', 'Sandbox (simulated payments)', 'sandbox', true, 'sandbox', ARRAY['card', 'gcash', 'maya', 'grabpay'], 'absorb', 0, 0, 'PAYMENT_SANDBOX', 90,
  'Simulates success or failure locally; no money moves. Switch off in production.'),
 ('PAYMONGO', 'PayMongo (GCash, Maya, GrabPay, cards)', 'paymongo', false, 'sandbox', ARRAY['gcash', 'maya', 'grabpay', 'card'], 'absorb', 2.5, 0, 'PAYMONGO', 10,
  'Checkout sessions; webhook checkout_session.payment.paid. Needs PAYMONGO_SECRET_KEY and PAYMONGO_WEBHOOK_SECRET in the environment.'),
 ('DRAGONPAY', 'Dragonpay (online banking, over the counter, e-wallets)', 'dragonpay', false, 'sandbox', ARRAY['online_banking', 'otc', 'gcash'], 'absorb', 0, 20, 'DRAGONPAY', 20,
  'Payment switch; postback with SHA1 digest. Needs DRAGONPAY_MERCHANT_ID and DRAGONPAY_PASSWORD in the environment.')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS payment_links (
  id text PRIMARY KEY DEFAULT ('pl_' || encode(gen_random_bytes(8), 'hex')),
  link_number text NOT NULL UNIQUE,
  token text NOT NULL UNIQUE,                                    -- random, in the public checkout address
  target_type text NOT NULL CHECK (target_type IN ('package_quote', 'quote', 'policy')),
  target_id text NOT NULL,
  target_number text,
  client_id text REFERENCES clients(id),
  payer_name text, payer_email text, payer_mobile text,
  description text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),              -- premium to collect (receipt amount)
  fee numeric(14,2) NOT NULL DEFAULT 0,                          -- gateway fee (charged to the client when passed on)
  total numeric(14,2) NOT NULL CHECK (total > 0),                -- amount the gateway charges
  currency text NOT NULL DEFAULT 'PHP',
  gateway_code text NOT NULL REFERENCES payment_gateways(code),
  method text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'expired', 'cancelled', 'review')),
  provider_ref text,
  checkout_url text,
  expires_at timestamptz NOT NULL,
  paid_at timestamptz,
  paid_amount numeric(14,2),
  apply_status text NOT NULL DEFAULT 'not_applied' CHECK (apply_status IN ('not_applied', 'applied', 'awaiting_issue', 'error')),
  apply_error text,
  receipt_id text REFERENCES receipts(id),
  policy_id text REFERENCES policies(id),
  outcome jsonb NOT NULL DEFAULT '{}',
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS payment_links_target_idx ON payment_links(target_type, target_id);
CREATE INDEX IF NOT EXISTS payment_links_provider_ref_idx ON payment_links(gateway_code, provider_ref);
CREATE INDEX IF NOT EXISTS payment_links_status_idx ON payment_links(status, created_at);
DROP TRIGGER IF EXISTS payment_links_updated ON payment_links;
CREATE TRIGGER payment_links_updated BEFORE UPDATE ON payment_links FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Every notification received from a gateway (and every simulated one), valid or not: the payments log.
CREATE TABLE IF NOT EXISTS payment_events (
  id bigserial PRIMARY KEY,
  link_id text REFERENCES payment_links(id),
  gateway_code text,
  event_type text NOT NULL,
  provider_ref text,
  signature_valid boolean NOT NULL DEFAULT false,
  status text,                                                   -- paid | failed | pending | ignored | rejected
  amount numeric(14,2),
  payload jsonb NOT NULL DEFAULT '{}',
  error text,
  received_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS payment_events_link_idx ON payment_events(link_id);
CREATE INDEX IF NOT EXISTS payment_events_received_idx ON payment_events(received_at);

INSERT INTO document_numbering(code, name, module, prefix, description, created_by) VALUES
 ('payment_link', 'Payment Link', 'finance', 'PL', 'Online payment link sent to a client', 'migration')
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('payments.link_validity_hours', '72', 'payments', 'Hours a payment link stays valid (a gateway can set its own)', 'number'),
 ('payments.auto_receipt', 'true', 'payments', 'Create the official receipt when a gateway confirms a payment', 'boolean'),
 ('payments.auto_issue_package_policies', 'true', 'payments', 'Issue the policy of a paid package quotation (or package product quotation) automatically, when the gateway and the bundle allow it', 'boolean'),
 ('payments.payment_modes', '{"card": "card", "gcash": "gcash", "default": "online"}', 'payments', 'Receipt payment mode per payment method of a gateway', 'json'),
 ('payments.notify_roles_on_error', '["accounting"]', 'payments', 'Roles notified when a confirmed payment could not be applied automatically', 'json')
ON CONFLICT (key) DO NOTHING;
