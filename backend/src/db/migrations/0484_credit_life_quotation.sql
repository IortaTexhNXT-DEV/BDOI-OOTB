-- Credit Life quotation rules (TIS-BRD-QUOT-01, QUOT-06, PJRN-01, PJRN-03; CR-03, CR-04).
--
-- Credit Life new business (CL-COMP, the complimentary year-1 cover of a TFS motor loan) is placed without a quotation;
-- the quotation is raised at renewal, on the voluntary product (CL-VOL). A Credit Life quotation:
--   * is for an individual borrower (no corporate account), with no agent, one open quotation per loan account;
--   * excludes a borrower aged credit_life.rules.maxAge or more, with more than maxAccounts TFS accounts or a pending
--     balance;
--   * is priced at ratePerThousand per 1,000 of sum insured (default defaultSumInsured); the rate is not edited;
--   * runs termYears (from-to) years, the loan tenor;
--   * a sum insured below defaultSumInsured (following the outstanding balance) is referred for approval by a user of
--     siReductionRoles other than the raiser before the quotation is sent or issued.
-- The products the rules apply to are credit_life.rules.products. The journey of CL-COMP (no quotation) and CL-VOL
-- (quotation required) is set by seed 95_tisph_quote_policy.sql. Idempotent.

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('credit_life.rules', $j${"products": ["CL-VOL"], "maxAge": 65, "maxAccounts": 6, "ratePerThousand": 3.68, "defaultSumInsured": 1000000, "termYears": {"min": 1, "max": 5},
   "siReductionRoles": ["tis-sales-officer", "tis-sales-unit-head", "tis-ops-unit-head", "tis-general-manager"]}$j$, 'quotations',
  'Credit Life quotation rules: products, age and account limits, rate per 1,000, default sum insured, term, approvers of a reduced sum insured', 'json')
ON CONFLICT (key) DO NOTHING;
