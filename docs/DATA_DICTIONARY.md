# Brokerverse – Complete Data Dictionary

This document consolidates all **data models** and **API endpoints** used in the Brokerverse project. Data models are sourced from feature specification JSONs under `jsons/`; API routes are from `src/routes/apiRoutes.js`.

---

## 1. Overview and sources

| Source type | Location | Description |
|------------|----------|-------------|
| **Incentive data models** | `jsons/incentive/s1-*.json`, `s3-*.json`, `s4-*.json` | Program, calculation, and report entities |
| **Renewal data models** | `jsons/renewal/h3-*.json`, `h4-*.json`, `h6-*.json`, `h7-*.json`, `h10-*.json` | Quote, retention, negotiation, lapse, performance |
| **API routes** | `src/routes/apiRoutes.js` | Backend endpoint paths (no request/response schemas in repo) |
| **Remittance / Reinsurance** | `jsons/remittance/*.json`, `jsons/reinsurance/*.json` | UI/screen field definitions only; no `data_model` blocks |

**Type conventions in data models:** `string`, `number`, `date`, `timestamp`, `boolean`, `enum`, `array`, `json`, `text`, `percentage`, `days`.

---

## 2. Incentive module – data models

### 2.1 Incentive programs (source: `jsons/incentive/s1-incentive-programs.json`)

**Entity: `incentive_program`**

| Field | Type | Description |
|-------|------|-------------|
| program_id | string | Primary key |
| program_code | string | Unique code |
| program_name | string | Display name |
| program_type | enum | Program classification |
| target_metric | string | Metric used for targets (e.g. Premium Volume, Policy Count) |
| base_target | number | Base target value |
| stretch_target | number | Stretch target value |
| start_date | date | Program start |
| end_date | date | Program end |
| status | enum | Program status |
| created_by | string | Creator user id |
| created_date | timestamp | Creation time |

**Entity: `program_assignment`**

| Field | Type | Description |
|-------|------|-------------|
| assignment_id | string | Primary key |
| program_id | string | FK to incentive_program |
| agent_id | string | Assigned agent |
| team_id | string | Assigned team |
| effective_date | date | Assignment effective date |
| status | enum | Assignment status |

---

### 2.2 Reward calculations (source: `jsons/incentive/s3-reward-calculations.json`)

**Entity: `calculation_batch`**

| Field | Type | Description |
|-------|------|-------------|
| batch_id | string | Primary key |
| period | string | Calculation period (e.g. month) |
| calculation_date | timestamp | When batch was run |
| programs_included | array | Program ids in batch |
| total_amount | number | Total incentive amount |
| status | enum | Batch status |
| approved_by | string | Approver user id |
| approval_date | timestamp | Approval time |

**Entity: `calculation_detail`**

| Field | Type | Description |
|-------|------|-------------|
| detail_id | string | Primary key |
| batch_id | string | FK to calculation_batch |
| agent_id | string | Agent |
| program_id | string | Program |
| target_value | number | Target for period |
| achieved_value | number | Actual achievement |
| achievement_percentage | number | % of target |
| base_incentive | number | Base incentive amount |
| adjustments | number | Adjustments (bonus/deduction) |
| final_amount | number | Final payout amount |
| status | enum | Detail status |

---

### 2.3 Incentive reports (source: `jsons/incentive/s4-incentive-reports.json`)

**Entity: `report_schedule`**

| Field | Type | Description |
|-------|------|-------------|
| schedule_id | string | Primary key |
| report_name | string | Report identifier/name |
| parameters | json | Report parameters |
| frequency | enum | Schedule frequency |
| recipients | array | Recipient list |
| format | enum | Output format |
| last_run | timestamp | Last run time |
| next_run | timestamp | Next scheduled run |
| status | enum | Schedule status |

**Entity: `report_history`**

| Field | Type | Description |
|-------|------|-------------|
| history_id | string | Primary key |
| report_name | string | Report name |
| generated_by | string | User id |
| generated_date | timestamp | Generation time |
| parameters_used | json | Parameters at run time |
| file_path | string | Output file path |

---

## 3. Renewal module – data models

### 3.1 Renewal quotes (source: `jsons/renewal/h3-renewal-quotes-generation.json`)

**Entity: `renewal_quote`**

| Field | Type | Description |
|-------|------|-------------|
| quote_id | string | Primary key |
| policy_id | string | FK to policy |
| quote_number | string | Display quote number |
| expiry_date | date | Policy expiry |
| current_premium | number | Current premium |
| quoted_premium | number | Quoted premium |
| discounts_applied | array | Discounts |
| coverage_changes | array | Coverage change details |
| status | enum | Quote status |
| created_date | timestamp | Creation time |
| valid_until | date | Quote validity end |
| approval_status | enum | Approval status |

**Entity: `retention_strategy`**

| Field | Type | Description |
|-------|------|-------------|
| strategy_id | string | Primary key |
| client_segment | string | Segment name |
| retention_score | number | Score for segment |
| recommended_discount | percentage | Suggested discount |
| special_offers | array | Special offer refs |
| follow_up_schedule | array | Follow-up schedule |

---

### 3.2 Retention analytics (source: `jsons/renewal/h4-retention-analytics.json`)

**Entity: `retention_metrics`**

| Field | Type | Description |
|-------|------|-------------|
| metric_id | string | Primary key |
| period | string | Reporting period |
| retention_rate | percentage | Retention rate |
| policies_renewed | number | Count renewed |
| policies_lapsed | number | Count lapsed |
| premium_retained | number | Premium retained |
| premium_lost | number | Premium lost |
| average_discount | percentage | Average discount given |

**Entity: `at_risk_policy`**

| Field | Type | Description |
|-------|------|-------------|
| policy_id | string | Primary key |
| risk_score | number | Lapse risk score |
| risk_factors | array | Risk factor codes/descriptions |
| probability_of_lapse | percentage | Estimated lapse probability |
| recommended_actions | array | Action recommendations |
| assigned_agent | string | Agent id |
| action_status | enum | Status of retention action |

**Entity: `retention_action`**

| Field | Type | Description |
|-------|------|-------------|
| action_id | string | Primary key |
| policy_id | string | FK to policy |
| action_type | string | Type of action |
| action_date | date | When performed |
| outcome | enum | Outcome of action |
| notes | text | Free text notes |

---

### 3.3 Negotiation tracking (source: `jsons/renewal/h6-negotiation-tracking.json`)

**Entity: `negotiation`**

| Field | Type | Description |
|-------|------|-------------|
| negotiation_id | string | Primary key |
| policy_id | string | FK to policy |
| start_date | date | Start of negotiation |
| current_stage | enum | Current stage |
| assigned_agent | string | Agent id |
| original_quote | number | Original quote amount |
| current_offer | number | Current offer |
| client_counter | number | Client counter-offer |
| special_terms | array | Special terms |
| competitor_quotes | array | Competitor quote refs |
| status | enum | Negotiation status |
| outcome | enum | Final outcome |
| close_date | date | Close date |

**Entity: `negotiation_event`**

| Field | Type | Description |
|-------|------|-------------|
| event_id | string | Primary key |
| negotiation_id | string | FK to negotiation |
| event_type | enum | Type of event |
| event_date | timestamp | Event time |
| performed_by | string | User id |
| details | json | Event payload |
| attachments | array | Attachment refs |

**Entity: `special_approval`**

| Field | Type | Description |
|-------|------|-------------|
| approval_id | string | Primary key |
| negotiation_id | string | FK to negotiation |
| requested_terms | json | Terms requested |
| justification | text | Justification text |
| approval_level | string | Approval level |
| status | enum | Approval status |
| approved_by | string | Approver user id |
| conditions | text | Conditions if any |

---

### 3.4 Lapse management (source: `jsons/renewal/h7-lapse-management.json`)

**Entity: `lapsed_policy`**

| Field | Type | Description |
|-------|------|-------------|
| policy_id | string | Primary key |
| lapse_date | date | Lapse date |
| lapse_reason | enum | Reason for lapse |
| premium_lost | number | Premium lost |
| grace_period_end | date | End of grace period |
| reinstatement_eligible | boolean | Eligible for reinstatement |
| win_back_attempts | number | Win-back attempts count |
| final_status | enum | Final status |

**Entity: `win_back_campaign`**

| Field | Type | Description |
|-------|------|-------------|
| campaign_id | string | Primary key |
| campaign_name | string | Campaign name |
| target_policies | array | Policy ids |
| offer_details | json | Offer configuration |
| start_date | date | Start date |
| end_date | date | End date |
| responses | number | Response count |
| conversions | number | Conversion count |
| revenue_recovered | number | Revenue recovered |

**Entity: `reinstatement`**

| Field | Type | Description |
|-------|------|-------------|
| reinstatement_id | string | Primary key |
| policy_id | string | FK to policy |
| request_date | date | Request date |
| eligibility_status | boolean | Eligibility flag |
| terms | json | Reinstatement terms |
| approval_status | enum | Approval status |
| effective_date | date | Effective date |

---

### 3.5 Performance tracking (source: `jsons/renewal/h10-performance-tracking.json`)

**Entity: `performance_metric`**

| Field | Type | Description |
|-------|------|-------------|
| metric_id | string | Primary key |
| agent_id | string | Agent id |
| team_id | string | Team id |
| period | string | Reporting period |
| renewal_rate | percentage | Renewal rate |
| policies_renewed | number | Count renewed |
| revenue_retained | number | Revenue retained |
| avg_cycle_time | days | Average cycle time |
| customer_satisfaction | number | Satisfaction score |
| productivity_score | number | Productivity score |

**Entity: `performance_target`**

| Field | Type | Description |
|-------|------|-------------|
| target_id | string | Primary key |
| entity_type | enum | agent, team, branch, company |
| entity_id | string | Entity id |
| metric | string | Metric name |
| target_value | number | Target value |
| period | string | Period |
| status | enum | Target status |

**Entity: `performance_insight`**

| Field | Type | Description |
|-------|------|-------------|
| insight_id | string | Primary key |
| type | enum | Insight type |
| description | text | Description |
| impact | text | Impact description |
| recommendation | text | Recommendation |
| priority | enum | Priority |
| date_identified | date | When identified |

---

## 4. API routes reference

Endpoints are defined in `src/routes/apiRoutes.js`. Paths are relative to the base API URL. Request/response schemas are not defined in the frontend repo.

| Domain | Key | Endpoint path |
|--------|-----|----------------|
| **Login** | POST_LOGIN | `user/user-login` |
| | POST_SIGNUP | `admin-signup` |
| **Dashboard** | GET_DETAILS | `agent/get-dashboard-details` |
| **Quote** | GET_VEHICLE_BRAND | `master/vehicle/get-brands` |
| | GET_VEHICLE_TYPE | `master/vehicle/get-vehicle-types` |
| | GET_VEHICLE_VARIANT | `master/vehicle/get-variants?model=` |
| | GET_VEHICLE_MODEL | `master/vehicle/get-models?brand=` |
| | GET_VEHICLE_SEATING_CAPACTITY | `master/vehicle/get-seating-capacity` |
| | GET_INSURANCE_COMPANY | `master/insurancecompany/get-insurance-companies` |
| | GET_BODILY_INJURY | `biCoverage/get-bi-coverage?PolicyTypeId=` |
| | GET_PROPERTY_DEMAGE | `pdCoverage/get-pd-coverages?PolicyTypeId=` |
| | GET_PERSONAL_ACCIDENT | `paCoverage/get-pa-coverages?PolicyTypeId=` |
| | POST_QUOTE_CREATE | `quote/create-quote` |
| | GET_POLICY_TYPE | `master/policyType/policy-type?productId=` |
| | GET_ACCOUNT_TYPE | `agent/get-sub-agents` |
| | GET_SIGNATURE | `master/signatory/get-all-signatory` |
| | GET_QUOTE_LIST | `quote/get-all-quote?LeadId=` |
| | DELETE_DELETE | `quote/delete-quote?quoteId=` |
| | POST_QUOTE_CALCULATION | `quote/calculate-premium-quote` |
| **Lead** | GET_COUNTRIES | `master/country/get-countries` |
| | GET_CITIES | `master/cities/get-cities` |
| | GET_STATES | `master/states/get-states` |
| | GET_ALL_LEAD | `lead/get-all-lead` |
| | GET_LEAD_BY_NAME | `lead/search-lead` |
| | POST_CREATE_LEAD | `leads` |
| | PUT_UPDATE_LEAD | `leads` |
| | GET_LEAD_BY_ID | `leads` |
| | SEARCH_LEADS | `leads/search` |
| **Vehicle** | PATCH_VECHILE_FORM3 | `quote/update-policy-details` |
| | GET_VECHILE_FORM3 | `quote/get-quote-details` |
| **Quote detail** | GET_QUOTE_DETAIL | `quote/get-quote-details?quoteId=` |
| | GET_MORTAGES | `master/banks/get-all-banks` |
| | GET_UPLODEURL | `upload/get-url/vehicle?quoteId=` |
| | PATCH_VEHICLEDETAIL | `vehicalDetails/update-vehicle-details` |
| | PATCH_VEHICLEUPLOAD | `vehicalDetails/update-vehicle-images/` |
| **Client** | CLIENT_MANAGEMENT | `client/get-all-client` |
| | GET_SEARCH_ALL_CLIENT | `client/search-all-client` |
| | POST_DOCUMENT_UPLOADE | `client/create-client` |
| | GET_DOCUMENT_UPLOAD_URL | `upload/get-url/document` |
| | GET_CLIENT_PROFILE | `Client/get-client-profileDetails` |
| | GET_CLIENT_DETAILS | `Client/get-client-by-id` |
| **Policy** | GET_POLICY_DETAIL | `quote/get-quote-details?quoteId=` |
| | GET_BILL_NO | `billing/get-bill-no` |
| | POST_POLICYDETAIL | `policy/create-policy` |
| | GET_POLICY_LIST | `policy/get-policy-list` |
| | GET_SEARCH_POLICY_LIST | `policy/search-policy-list` |
| | GET_POLICY_DETAILS_VIEW | `policy/get-indidual-policy-details?PolicyId=` |
| | GET_POLICY_DOCUMENT_VIEW | `policy/view-policy-documents?policyId=` |
| **Endorsement** | GET_ENDROSEMENT_LIST | `endorsements/get-All-Endorsements?clientId=13&endorsementId=&perPage=5&pageNo=1` |
| | POST_ENDROSEMENT_FORM | `endorsements/create-endorsement` |
| | GET_ENDROSEMENT_FORM | `policy/get-indidual-policy-details?PolicyId=4` |
| | GET_UPLOADURL_ENDROSEMENT | `upload/get-url/endorsement?endorsementId=` |
| | POST_ENDROSEMENT_DATA | `endorsements/complete-endorsement` |
| | POST_PREMIUMCALCULATION | `quote/calculate-premium-quote` |
| **Claims** | GET_CLAIM_LIST | `claims/get-all-claim-search` |
| | GET_CLAIM_DETAILS | `policy/policy-details-for-claims` |
| | POST_CLAIM_DETAILS | `claims/create-claim` |
| | GET_CLAIM_DOCUMENT_UPLOAD_URL | `upload/get-url/claims?policyId=` |
| | GET_SETTLEMENT_UPLOAD | `upload/get-url/settlement?claimId=` |
| | POST_SETTLEMENT_DETAIL | `claims/complete-claim?claimId=` |
| **Journal voucher** | POST_APPROVE_JOURNAL_VOUCHER | `journal-vouchers` |
| | GET_JOURNAL_VOUCHER_HISTORY | `journal-vouchers/history` |
| | GET_JOURNAL_VOUCHER_DETAILS | `journal-vouchers` |

---

## 5. Remittance and reinsurance

- **Remittance:** `jsons/remittance/*.json` describe **screens and form fields** (e.g. `fieldName`, `fieldId`, `type`, `options`). They do **not** define a `data_model` with entities and attributes. For UI field-level reference, use those JSONs directly (e.g. `k1-k4-admin-master.json`, `k1-k4-user-transaction.json`, etc.).
- **Reinsurance:** `jsons/reinsurance/*.json` describe features, screens, and treaty types; they do **not** include `data_model` blocks. Entity definitions for reinsurance would need to be added (e.g. in backend docs or new spec JSONs) and then reflected here.

---

## 6. Source file index

| File | Data model entities |
|------|---------------------|
| `jsons/incentive/s1-incentive-programs.json` | incentive_program, program_assignment |
| `jsons/incentive/s3-reward-calculations.json` | calculation_batch, calculation_detail |
| `jsons/incentive/s4-incentive-reports.json` | report_schedule, report_history |
| `jsons/renewal/h3-renewal-quotes-generation.json` | renewal_quote, retention_strategy |
| `jsons/renewal/h4-retention-analytics.json` | retention_metrics, at_risk_policy, retention_action |
| `jsons/renewal/h6-negotiation-tracking.json` | negotiation, negotiation_event, special_approval |
| `jsons/renewal/h7-lapse-management.json` | lapsed_policy, win_back_campaign, reinstatement |
| `jsons/renewal/h10-performance-tracking.json` | performance_metric, performance_target, performance_insight |

---

*Last consolidated from spec JSONs and `apiRoutes.js`. For enum values and business rules, see the corresponding `business_rules` and UI spec sections in each source JSON.*
