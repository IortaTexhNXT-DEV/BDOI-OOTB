# Pending Translations – Other Pages (Non–Fire LOB)

This document lists **user-facing pages** that still have hardcoded English strings and should use `t()` for i18n. Use it to plan translation work before UAT.

---

## 1. **Approve Quote**  
**File:** `agentModule/ApproveQuote/index.js`

| Location | Current string | Suggested key |
|----------|----------------|---------------|
| Section title | `Quote Information` | `approveQuote.quoteInformation` (exists) |
| Section title | `Vehicle Information` | `approveQuote.vehicleInformation` (exists) |
| Section title | `Coverage Summary` | Add `approveQuote.coverageSummary` and use it |

**Action:** Use `t('approveQuote.quoteInformation')`, `t('approveQuote.vehicleInformation')`, and add + use `t('approveQuote.coverageSummary')`.

---

## 2. **Coverage Details Review**  
**File:** `agentModule/quoteModule/coverageDetailedVew/index.js`

Page has `useTranslation` but many labels and messages are still hardcoded.

| Type | Examples | Suggested approach |
|------|----------|--------------------|
| Page/table titles | "Coverage Details Review", "Coverage Details", "Policy Details", "Assured Details", "Insurance Vehicle Details", "Vehicle Photos", "Coverage Summary", "Coverage Breakdown", "Premium Breakdown", "Accessories", "Participant Details" | Add `coverageDetailsReview.*` (or `quoteDetail.*`) keys and use `t()` |
| Field labels | Insurance Company, Insurance Policy Type, Account Code, Policy Number, Production/Inception/Issued/Expiry Date, Name, Email ID, Contact Number, ID Card Number, Vehicle Brand, Model Year, Vehicle Model, Model Variant, Vehicle Color, Seating Capacity, Motor/Chassis/Plate Number, Certificate Number, MV File Number, Authentication Code, Mortgage, Aluminum, Air Bag, TNVS, Truck Type, Total Sum Insured, Own Damage coverage, Acts of Nature, Bodily Injury, Property Damage, Deductible, Towing, Repair Limit, NET Premium, DST, VAT, LGT, Others, Discount, Gross Premium, Policy Document | Same namespace, one key per label |
| Buttons | "Back", "Proceed to Payment", "Send to Insurance Company" | e.g. `coverageDetailsReview.back`, `proceedToPayment`, `sendToInsuranceCompany` |
| Toasts/messages | "Quotation Missing", "Sent to Insurance Company", "Error", "Failed to create client and policy", "Failed to send to insurance company" | Add keys and use in toast `summary`/`detail` |

---

## 3. **Endorsement – Personal Details Change**  
**File:** `agentModule/endorsementModule/personalDetails/SplitScreens/PersonalDetailsChange.jsx`

No `useTranslation`. All labels are hardcoded.

| Current string | Suggested key |
|----------------|---------------|
| Subtitle (section) | e.g. `endorsement.personalDetailsChange` or reuse from leadCreation |
| First Name*, Last Name, Preferred Name*, Contact Number | `leadCreation.firstName`, `lastName`, `preferredName`, `contactNumber` (or new `endorsement.*`) |
| House No / Unit No / Street , Barangay / Subd, Country, Province, City, ZIP Code | `leadCreation.houseNoStreet`, `barangaySubd`, `country`, `province`, `city`, `zipCode` |

**Action:** Add `useTranslation`, introduce an `endorsement` (or reuse `leadCreation`/`fireLead`) namespace, and replace every label/heading with `t()`.

---

## 4. **Endorsement – Motor Details Change**  
**File:** `agentModule/endorsementModule/personalDetails/SplitScreens/MotorDetailsChange.jsx`

Has `useTranslation`; many form labels still hardcoded.

| Current string | Suggested key |
|----------------|---------------|
| Subtitle | `endorsement.motorDetailsChange` |
| TNVS, Motor Number, Chassis Number, Mortgage, Cert Number, Plate Number, MV File Number, Authen Code, Vehicle Brand, Model Year, Model Variant, Vehicle Model, Vehicle Color, Seating Capacity | `endorsement.tnvs`, `motorNumber`, `chassisNumber`, etc. |

**Action:** Add keys under `endorsement` (or `policyDetail`/vehicle-related namespace) and replace all labels with `t()`.

---

## 5. **Endorsement – Coverage Change**  
**File:** `agentModule/endorsementModule/personalDetails/SplitScreens/CoverageChange.jsx`

No `useTranslation`. Entire form is hardcoded.

| Current string | Suggested key |
|----------------|---------------|
| Subtitle | "Coverage Change" → `endorsement.coverageChange` |
| Own Damage coverage, Own Damage coverage Rate, Own Damage coverage premium | `endorsement.ownDamageCoverage`, `ownDamageCoverageRate`, `ownDamageCoveragePremium` |
| Acts of Nature Rate, Acts of Nature premium | `endorsement.actsOfNatureRate`, `actsOfNaturePremium` |
| CTPL Coverage Rate, Bodily Injury, Bodily Injury Coverage Premium, Property Damage, Property Damage Coverage Premium | Similar pattern |
| Auto passenger personal Accident, APPA Total Coverage, Total Sum Insured, NET premium, Others(Acc. premium), Discount, Others, Gross premium | Same namespace |

**Action:** Add `useTranslation`, add full set of `endorsement.*` keys for this screen, replace every label and subtitle.

---

## 6. **Endorsement – Policy Extend**  
**File:** `agentModule/endorsementModule/personalDetails/SplitScreens/PolicyExtend.jsx`

Has `useTranslation`; labels and subtitle still hardcoded.

| Current string | Suggested key |
|----------------|---------------|
| Subtitle | "Policy Extend" → `endorsement.policyExtend` |
| From, To, Number of Days, Own Damage coverage, Own Damage coverage Rate, Own Damage coverage premium, Acts Of Nature Rate, Acts of Nature premium, Bodily Injury, Bodily Injury Coverage Premium, Property Damage, Property Damage Coverage Premium, Title, Declaration | `endorsement.from`, `to`, `numberOfDays`, and same coverage labels as Coverage Change where applicable |

**Action:** Replace subtitle and all form labels with `t()` using `endorsement.*` (or shared keys with CoverageChange).

---

## 7. **Endorsement Summary**  
**File:** `agentModule/endorsementModule/personalDetails/endorsementSummary/EndorsementSummary.jsx`

Has `useTranslation`; some UI text and dialogs still hardcoded.

| Current string | Suggested key |
|----------------|---------------|
| "Leads", "Policy" (header_title) | e.g. `common.leads`, `common.policy` or `endorsementSummary.*` |
| "Refund" (span) | `endorsementSummary.refund` |
| Policy Details, Insurance Company, Co-Insurance, Insurance Policy Type, Account Code, Co-Insurance Participants | Reuse or add under `endorsementSummary` |
| `alert("Endorsement ID not found")` | Use toast with `t("endorsementSummary.endorsementIdNotFound")` |
| `window.confirm("Send this endorsement...")` | `t("endorsementSummary.confirmSendToInsurance")` |
| `alert("Failed to send...")` | Toast with translated message |

**Action:** Replace every user-visible string and alert/confirm with `t()` and optional toast.

---

## 8. **Lead Creation Card** (Motor/General)  
**File:** `agentModule/leadModule/leadCreation/leadCreationCard/index.js`

Partially translated; several strings still hardcoded.

| Current string | Suggested key |
|----------------|---------------|
| "Create Lead", "Edit Client", "Edit Lead" (card title) | `leadCreation.createLead`, `editClient`, `editLead` (add if missing) |
| "Select Category" | `leadCreation.selectCategory` or `fireLead.selectCategory` |
| "Individual", "Company" (radio labels) | `leadCreation.individual`, `company` or `fireLead.*` |
| "Select Gender" | `leadCreation.selectGender` or `fireLead.selectGender` |
| "Male", "Female" | `leadCreation.male`, `female` or `fireLead.*` |
| "Email ID*" | `leadCreation.emailId` (exists) |
| "Barangay / Subd*" | `leadCreation.barangaySubd` (exists) |
| "ZIP Code*" | `leadCreation.zipCode` (exists) |

**Action:** Replace all of the above with `t()`; add missing keys to `leadCreation` (or reuse `fireLead` where it fits).

---

## 9. **Lead Edit Card**  
**File:** `agentModule/leadModule/leadEdit/leadEditCard/index.js`

Many labels and buttons hardcoded.

| Current string | Suggested key |
|----------------|---------------|
| "Individual" (category__id) | `leadEdit.individual` or `leadCreation.individual` |
| First Name*, Last Name, Preferred Name*, Date of Birth, Select Gender, Email ID, Contact Number, House No / Unit No / Street , Barangay / Subd, Country, Province, City, ZIP Code | Same as leadCreation keys |
| "Cancel", "Update" (buttons) | `common.cancel`, `leadCreation.update` (or `leadEdit.update`) |

**Action:** Add `useTranslation` if missing in this file, then replace every label and button with `t()` using `leadCreation`/`leadEdit`/`common`.

---

## 10. **Quote Listing Card**  
**File:** `agentModule/quoteModule/quoteListing/quoteListingCard/index.js`

| Current string | Suggested key |
|----------------|---------------|
| Dropdown placeholder | "Add Quote" | `quoteListing.addQuote` (add and use) |

**Action:** Add `quoteListing.addQuote` in en/th and use `t("quoteListing.addQuote")` for the placeholder.

---

## 11. **Share Quote Modal**  
**File:** `agentModule/quoteModule/quoteDetailView/Modal/ShareOption.jsx`

Fire-specific strings are done; a few generic ones remain.

| Current string | Suggested key |
|----------------|---------------|
| Email placeholder | "client@example.com" | `shareOption.emailPlaceholder` |
| Message placeholder | "Add a personal message to the client..." | `shareOption.messagePlaceholder` |
| Button | "Use Standard Template Instead" | `shareOption.useStandardTemplate` |
| Button | "Cancel" | `common.cancel` |

**Action:** Add keys under `shareOption` (and `common.cancel` if needed), replace in JSX.

---

## 12. **Customer Info (Fire) – Upload caption**  
**File:** `agentModule/quoteModule/customerInfo/CustomerInfoFire.js`

| Current string | Suggested key |
|----------------|---------------|
| "Upload" (upload__caption) | `agent.upload` or `common.upload` |
| "Maximum 2 MB (PNG or JPEG Files Only)" | `agent.uploadMaxSize` or similar |

**Action:** Add keys and use `t()` for both lines.

---

## 13. **Quotation Audit Trail**  
**File:** `agentModule/quoteModule/quotationAuditTrail/index.jsx`

| Current string | Suggested key |
|----------------|---------------|
| Placeholder | "Select sort order" | `quotationAuditTrail.selectSortOrder` or `common.selectSortOrder` |

**Action:** Add key and use `t()` for placeholder.

---

## 14. **Payments / Tables**  
**Files:**  
- `agentModule/paymentsModule/PaymentTabel/PaidListTabelData/index.jsx`  
- `agentModule/paymentsModule/PaymentTabel/PendingListTabelData/index.jsx`  
- `agentModule/leadModule/leadListing/leadListingCard/LeadListingTravelTable/index.js`

| Current string | Suggested key |
|----------------|---------------|
| Placeholder | "Search" / "Search by" | `common.search` or `tables.search` / `tables.searchBy` |

**Action:** Use existing search key or add one and replace placeholders.

---

## Summary by priority

| Priority | Area | Files | Effort |
|----------|------|-------|--------|
| High | Endorsement split screens | PersonalDetailsChange, MotorDetailsChange, CoverageChange, PolicyExtend | Add useTranslation + full label set |
| High | Coverage Details Review | coverageDetailedVew/index.js | Many labels + toasts + buttons |
| Medium | Approve Quote | ApproveQuote/index.js | 3 section titles |
| Medium | Lead Creation / Lead Edit | leadCreationCard, leadEditCard | Remaining labels + category/gender |
| Medium | Endorsement Summary | EndorsementSummary.jsx | Headers, labels, alerts/confirms |
| Low | Share modal, Customer Info Fire, Quote listing, Audit trail, Payment tables | ShareOption, CustomerInfoFire, quoteListingCard, quotationAuditTrail, PaidList/PendingList, LeadListingTravelTable | Single placeholders/labels each |

---

## Namespace suggestions

- **approveQuote** – already exists; add `coverageSummary`.
- **endorsement** (or **endorsementMotor**) – new namespace for Personal Details, Motor Details, Coverage Change, Policy Extend labels and subtitles.
- **coverageDetailsReview** (or **quoteDetail**) – new namespace for Coverage Details Review page (labels, buttons, toasts).
- **leadCreation** / **leadEdit** – extend with `selectCategory`, `selectGender`, `individual`, `company`, `male`, `female`, `createLead`, `editClient`, `editLead` if not present.
- **shareOption** – add `emailPlaceholder`, `messagePlaceholder`, `useStandardTemplate`.
- **quoteListing** – add `addQuote`.
- **common** – use for Cancel, Back, Search, Upload where appropriate.

Use the same key names in **th.json** (and any other locale) with Thai (or local) translations.
