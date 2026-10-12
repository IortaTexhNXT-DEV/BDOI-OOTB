-- TAX-02: the BIR tax and VAT reports are Phase 1 and handled by TISPH Finance (decision of 12 October 2026).
-- Adds the tis-finance role to the five BIR report definitions; idempotent.
UPDATE report_definitions
   SET roles = array_append(roles, 'tis-finance')
 WHERE code IN ('bir-vat-summary', 'bir-sawt', 'bir-qap', 'bir-slsp-sales', 'bir-slsp-purchases')
   AND NOT ('tis-finance' = ANY(roles));
