-- Insurer system integration (Master > System Configuration > Insurer Integration).
--
--   insurer_api_mappings   per insurer: the connector of its API, the broker's code at the insurer, product codes,
--                          how a policy issuance request is built from a BrokerVerse policy (field -> source path or
--                          {{template}}), where the answer is read (response paths) and how the insurer's claim
--                          statuses read in BrokerVerse. One connector can serve several insurers (an aggregator).
--
-- Requests (policy issuance, policy / premium data, claim status) go through the integration outbox with message
-- types insurer.policy_issue, insurer.policy_data and insurer.claim_status. The file fallback is the insurer statement
-- import (Accounts > Insurer Reconciliation) for premium and policy data and the claim status file import of this
-- screen. Idempotent.

CREATE TABLE IF NOT EXISTS insurer_api_mappings (
  id serial PRIMARY KEY,
  insurance_company_id int NOT NULL UNIQUE REFERENCES insurance_companies(id),
  connector_code text NOT NULL REFERENCES integration_connectors(code),
  enabled boolean NOT NULL DEFAULT true,
  broker_code text,                                      -- the broker's intermediary / agent code at the insurer
  auto_issue_request boolean NOT NULL DEFAULT false,     -- send the issuance request when a policy of this insurer is issued
  product_map jsonb NOT NULL DEFAULT '{}',               -- { "MOTOR": "PC", "FIRE": "FI" }: line or product type -> insurer product code
  request_map jsonb NOT NULL DEFAULT '{}',               -- { "insuredName": "insuredName", "agentCode": "{{brokerCode}}", ... }
  response_map jsonb NOT NULL DEFAULT '{}',              -- { "policyNumber": "data.policyNo", "status": "data.status", "premium": "data.grossPremium" }
  claim_status_map jsonb NOT NULL DEFAULT '{}',          -- { "UNDER EVALUATION": "In review", "APPROVED": "Approved" }
  remarks text,
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('insurer_integration.premium_tolerance', '1', 'insurer_integration', 'Insurer policy data: a premium difference above this amount (PHP) is flagged on the request', 'number')
ON CONFLICT (key) DO NOTHING;
