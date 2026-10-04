-- Commission Rate Matrix (Master > Finance > Commission Rate Matrix): brokerage commission rate by insurer, product,
-- line of business and policy type (new / renewal / any) for a date range. resolveCommissionRate()
-- (src/modules/commission-rates/resolve.js) picks the most specific active row effective on the date:
-- insurer + product > insurer + LOB > insurer > product > LOB, an exact policy type before 'any'; without a matching
-- row the insurer's commission_rate (insurer master) and then commission.default_rate apply.
-- Overlap rule (enforced by the API): no two active rows with the same keys and overlapping dates.
CREATE TABLE IF NOT EXISTS commission_rates (
  id serial PRIMARY KEY,
  insurance_company_id int REFERENCES insurance_companies(id),
  product_id int REFERENCES products(id),
  line_of_business text,                                  -- product line / LOB code (motor, fire ...), compared case-insensitively
  policy_type text NOT NULL DEFAULT 'any' CHECK (policy_type IN ('new', 'renewal', 'any')),
  rate numeric(9,6) NOT NULL CHECK (rate >= 0 AND rate <= 1),  -- fraction: 0.15 = 15%
  effective_from date NOT NULL,
  effective_to date,                                      -- null: open-ended
  active boolean NOT NULL DEFAULT true,
  remarks text,
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commission_rates_dates_chk CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT commission_rates_key_chk CHECK (insurance_company_id IS NOT NULL OR product_id IS NOT NULL OR line_of_business IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS commission_rates_lookup ON commission_rates (insurance_company_id, product_id, active);
DROP TRIGGER IF EXISTS commission_rates_updated ON commission_rates;
CREATE TRIGGER commission_rates_updated BEFORE UPDATE ON commission_rates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
