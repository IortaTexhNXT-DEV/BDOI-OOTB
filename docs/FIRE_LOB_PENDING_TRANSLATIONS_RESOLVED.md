# Fire & Allied Perils LOB – Pending Translations (Resolved)

This document lists all Fire LOB pages that were audited and the pending translations that were **implemented** (no items left on hold). Use it as a checklist for UAT.

---

## 1. **Fire Lead Creation** (`agentModule/leadModule/FireLeadCreation/FireLeadCreationCard.js`)

| Item | Key / Change |
|------|----------------|
| Occupancy Type label | `fireLead.occupancyType` |
| Latitude/Longitude placeholders & labels | `fireLead.latitudePlaceholder`, `longitudePlaceholder`, `latitudeLabel`, `longitudeLabel` |
| Latitude/Longitude validation messages | `fireLead.latitudeInvalid`, `longitudeInvalid`, `latitudeRange`, `longitudeRange` |
| Back buttons (all steps) | `fireLead.back` |
| SI & Premium: Sum Insured (SI) heading | `fireLead.sumInsuredSi` |
| At least one SI required message & validation | `fireLead.atLeastOneSiRequired`, `fireLead.atLeastOneSiValidation` |
| Cover & Premium section title | `fireLead.coverAndPremium` |
| SI table header | `fireLead.si` |
| Sprinkler / Fire Extinguisher discount cards | `fireLead.sprinklerDiscountOptional`, `sprinklerDiscountRange`, `fireExtinguisherDiscountOptional`, `fireExtinguisher05`, `min0Max15`, `max15`, `min0Max5` |
| Discount range validation errors | `fireLead.sprinklerDiscountRangeError`, `fireExtinguisherDiscountRangeError` (with `{{max}}`) |
| Toasts: quotation not created, creating policy, proceeding to upload, failed to create policy, policy no ID | `fireLead.quotationNotCreated`, `creatingPolicyAndUpload`, `proceedingToUploadPolicy`, `failedToCreatePolicy`, `policyCreatedNoId` |
| Toasts: quote sent, already sent waiting, failed to send | `fireLead.quoteSentToCustomer`, `quoteAlreadySentWaiting`, `failedToSendQuote` |
| Preview: Lead ID label | `fireLead.leadIdColon` |
| Preview: Contact Number label | `fireLead.contactNumber` |
| Preview: Coverage & Premium section | `fireLead.coverageAndPremium` |
| Preview: Waiting for customer approval | `fireLead.waitingForCustomerApproval` |
| Preview: Send to Customer button | `fireLead.sendToCustomer` |
| Preview: Next (Upload Policy) tooltip & button title | `fireLead.nextUploadPolicyTooltip`, `nextUploadPolicyAvailable` |
| Preview: Refresh status button | `fireLead.refreshStatus` |
| Step 4 toasts: quotation created / failed | `fireLead.quotationCreatedSuccess`, `fireLead.quotationCreateFailed` |
| Fallback “Customer” for insured name | `fireLead.individual` |
| N/A in preview where applicable | `policyDetail.nA` |

---

## 2. **Fire Endorsement – Regular/Premium Change** (`agentModule/endorsementModule/personalDetails/SplitScreens/FireDetailsChange.jsx`)

| Item | Key / Change |
|------|----------------|
| Subtitle | `fireEndorsement.fireRegularPremiumChangeSubtitle` |
| First Name, Last Name, Email, Contact Number | `fireEndorsement.firstName`, `lastName`, `email`, `contactNumber` |
| Location Address, Nature of Business | `fireEndorsement.locationAddress`, `natureOfBusiness` |
| Construction Type, Building Type, Earthquake Zone, Occupancy Type, Fire Protection | `fireEndorsement.constructionType`, `buildingType`, `earthquakeZone`, `occupancyType`, `fireProtection` |
| No of Floors | `fireEndorsement.noOfFloors` |
| Total Premium (₱), Value Added Tax (₱), Premium Delta (₱), placeholder | `fireEndorsement.totalPremiumPhp`, `valueAddedTaxPhp`, `premiumDeltaPhp`, `premiumDeltaPlaceholder` |
| Effective Date | `fireEndorsement.effectiveDate` |

---

## 3. **Fire Endorsement – Policy Cancellation** (`agentModule/endorsementModule/personalDetails/SplitScreens/FireCancellation.jsx`)

| Item | Key / Change |
|------|----------------|
| Subtitle | `fireEndorsement.firePolicyCancellationSubtitle` |
| Cancellation Type label | `fireEndorsement.cancellationType` |
| Cancellation options | `fireEndorsement.fullCancellation`, `partialCancellation`, `proRataRefund`, `proRataPartialRefund` (replacing hardcoded `FIRE_CANCELLATION_TYPES`) |

---

## 4. **Share Quote (Fire-specific)** (`agentModule/quoteModule/quoteDetailView/Modal/ShareOption.jsx`)

| Item | Key / Change |
|------|----------------|
| WhatsApp Fire quote prefix | `shareOption.productFireAndAlliedPerils` (+ " Quote - ") |
| Quote summary: Product, Location, Building Type, Sum Insured (Building) | `shareOption.productFireAndAlliedPerils`, `locationLabel`, `buildingTypeLabel`, `sumInsuredBuildingLabel` |

---

## 5. **Policy Details – Fire & Endorsements** (`agentModule/policyModule/PolicyDetailView/index.jsx`)

| Item | Key / Change |
|------|----------------|
| Endorsement type labels (Motor 1–5, Fire regular/cancel) | `policyDetail.endorsementTypePersonalDetails`, `endorsementTypeMotorDetails`, `endorsementTypeCoverageChange`, `endorsementTypePolicyExtend`, `endorsementTypePolicyCancel`, `endorsementTypeFireRegular`, `endorsementTypeFireCancel` |
| Type/Types label and “N/A” in endorsement list | `policyDetail.typeLabel`, `typesLabel`, `nA` |
| `formatEndorsementTypes` | Now takes `t` and returns translated strings |
| Endorsement ID row in endorsement list | `policyDetail.endorsementId` |

*(Risk Details, Sum Insured & Coverage, Coverage Details, and all Fire risk/SUM labels on this page were already translated in the previous pass.)*

---

## 6. **Customer Info (Fire)** (`agentModule/quoteModule/customerInfo/CustomerInfoFire.js`)

Already using `t("agent.quoteIdFireAllied")`, `t("agent.convertPolicyFireAllied")`, and `t("agent.*")` for risk/SUM labels and “N/A”. **No pending items.**

---

## 7. **Locale keys added**

- **fireLead**: `back`, `leadIdColon`, `si`, `latitudeInvalid`, `longitudeInvalid`, `latitudeRange`, `longitudeRange`, `sprinklerDiscountRangeError`, `fireExtinguisherDiscountRangeError`, `quotationNotCreated`, `creatingPolicyAndUpload`, `proceedingToUploadPolicy`, `failedToCreatePolicy`, `policyCreatedNoId`, `quoteSentToCustomer`, `quoteAlreadySentWaiting`, `failedToSendQuote`, `nextUploadPolicyTooltip`, `nextUploadPolicyAvailable`, `quotationCreatedSuccess`, `quotationCreateFailed`.
- **fireEndorsement**: New namespace with all labels above (subtitle, form fields, cancellation options).
- **shareOption**: `productFireAndAlliedPerils`, `locationLabel`, `buildingTypeLabel`, `sumInsuredBuildingLabel`.
- **policyDetail**: `endorsementTypePersonalDetails`, `endorsementTypeMotorDetails`, `endorsementTypeCoverageChange`, `endorsementTypePolicyExtend`, `endorsementTypePolicyCancel`, `endorsementTypeFireRegular`, `endorsementTypeFireCancel`, `endorsementId`, `typeLabel`, `typesLabel`.

All keys added in both **en.json** and **th.json**.

---

## 8. **Intentionally not translated (data/constants)**

- **fireRiskConstants.js**: Option sets (`CONSTRUCTION_TYPES`, `BUILDING_TYPES`, `LOCATION_CODE_OPTIONS`, `EARTHQUAKE_ZONES`, `OCCUPANCY_TYPES`, `FIRE_PROTECTION_OPTIONS`, `SMI_ENTRY_FIELDS`, `COVER_CONFIG`) – values are stored in API/display as-is; translating would require mapping keys in UI and keeping values for submit. Can be a later enhancement.
- **ENDORSEMENT_TYPE_KEYS** in PolicyDetailView: Only translation keys are used; display is via `t(key)`.

---

**Status:** All listed pending translations for Fire & Allied Perils LOB have been implemented. Ready for UAT.
