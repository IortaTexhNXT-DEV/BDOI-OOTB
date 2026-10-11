# Schemes (Scheme Master)

The Scheme 1 and Scheme 2 bundling schemes agreed with TFSPH, the Toyota dealers and the insurers, and the scheme rating
used by Scheme Issuance and the renewals of scheme policies (TIS-BRD-SCHM-02, FRS SCHM-02 FR-SCM-001 to 031). Route:
`/schemes` (Operations > Sales & Marketing > Scheme Master). Access: `read:schemes`, `write:schemes`, `approve:schemes`.
Migration 0600; reason contexts `dealer_scheme_return` and `dealer_scheme_status` (seed 97_dealer_schemes.sql). TISPH decision of
11 Oct 2026 (GAP-SALES-17, migration 0687): the TIS Sales Unit Head, the General Manager and IT AppSupport make and
approve schemes (never their own); every other persona reads them.

## Files

| File | What it does |
|---|---|
| `router.js` | The `/schemes` routes: list with counts, choices, Excel export, vehicle lines template and upload, the Scheme panel of a policy, one scheme, premium preview, create, change, delete, copy, submit, recall, approve, return, suspend, resume, withdraw, amend, discard. |
| `service.js` | Scheme versions and their checks (General, Products & perils, Commission & term, Vehicle lines), the maker-checker, the life cycle and the job `schemeStatus`, the vehicle lines upload (`SCHEME_LINE_COLUMNS`), the export. |
| `rating.js` | `findSchemeAndLine` (the scheme in force, its dealers, insurers and the most specific vehicle line), `priceYear` and `previewPremiums` (the premium of a policy year), `recordPolicyScheme` (`policy_schemes`), `renewalYear` (the renewal of a scheme policy), `schemeDoc`. |
| `panel.js` | The read-only Scheme panel of Policy detail. |

## Rules

- **Versions.** `schemes` holds one row per version (`scheme_no`, `version`); one version of a Scheme No. is in Draft or
  Pending approval at a time (unique index on upper(scheme_no)). An approved version is never changed: Amend copies it
  as the next Draft, kept until it is approved (the version in force becomes `superseded`) or discarded. The scheme type
  cannot change after approval. Copy makes a new Scheme No. as a Draft with every tab.
- **Checks.** Scheme No. `^[A-Z0-9-]{3,20}$`; not starting before today; period at most `schemes.max_period_months`;
  financing bank: an active financing bank of Distribution Channels (not a branch); All dealers or at least one dealer;
  Motor products; the mandatory covers of the product's template stay in; an included peril needs its rate, premium or
  limit; a rate above the standard (`promotions.standard_rates`) is a warning (`schemes.warn_rate_above_standard`);
  commission % and dealer share % 0 to 100; term 1 to `schemes.max_term_years`; sum insured % not rising year on year;
  vehicle lines: ranges, classes of the scheme, no overlap at the same level (a variant line beside an All variants line
  is allowed: the most specific wins).
- **Maker-checker.** The user who created, changed or submitted a version never approves it, whatever their permissions
  (403). A return needs a remark.
- **Life cycle.** Approve: Scheduled (starts later) or Active; job `scheme-status` (00:10) activates and expires;
  suspend / resume / withdraw by `approve:schemes` with a remark. A suspended or expired scheme rates no new loan.
- **Rating.** The premium of a policy year is the Create Quote premium (`premiumBreakdown` with `keep`: CTPL and APPA
  kept, no underwriting referral) at the scheme rates on the year's sum insured (invoice price x the year's %). CTPL of
  year 1 is the 3-year tariff (`schemes.year1_three_year_ctpl`), years 2 and 3 none, then annual; the preview shows it
  every year, the application schedule only when `schemes.application_schedule_ctpl` (FRS conflict, delivered off).
  Commission = net premium x commission %; dealer share = commission x dealer %; TISPH share the rest.
- **Policy and renewal.** `policy_schemes` keeps the scheme, version, line, year, rates, commission and shares of each
  policy term; the commission basis of the policy is `scheme` (commission/breakdown.js) and the dealer share goes to the
  referrer of the dealer branch (or its group), held with a warning when it has none. A renewal of a scheme policy is
  priced at the next year of the scheme; a premium other than the scheme premium needs a reason (MSG-SCM-060).

## Settings

`schemes.max_period_months` (24), `schemes.max_term_years` (5), `schemes.default_term_years` (5),
`schemes.default_schedule` ([100, 90, 80, 70, 60]), `schemes.max_rows` (2000, vehicle lines per upload),
`schemes.year1_three_year_ctpl` (true), `schemes.warn_rate_above_standard` (true).
