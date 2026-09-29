# Hardcoded Strings – Lead & Policy Pages

Audit of remaining **user-facing** hardcoded English strings in lead- and policy-related agent module pages. Use `t()` with keys from `en.json`/`th.json` to fix.

---

## Lead module

### 1. **Lead listing tables**

| File | String / location | Suggested key / action |
|------|-------------------|-------------------------|
| `LeadListingAllTable/index.js` | `Lead Id :` (row text) | `leadDetail.leadIdLabel` or new `leadListing.leadIdColon` |
| `LeadListingHomeTable/index.js` | `Lead Id :` (row text) | Same |
| `LeadListingHomeTable/index.js` | `placeholder="Search"` | `common.search` |
| `LeadListingHomeTable/index.js` | `placeholder="Search by"` | `quoteListing.searchBy` or `common.searchBy` |
| `LeadListingTravelTable/index.js` | `Lead Id :` (row text) | Same |
| `LeadListingTravelTable/index.js` | `placeholder="Search"` | `common.search` |
| `LeadListingTravelTable/index.js` | `placeholder="Search by"` | Same |

### 2. **Lead creation card** (`leadCreationCard/index.js`)

| Type | Example | Suggested key |
|------|---------|----------------|
| Toast / validation | "An unexpected error occurred while creating the lead" | `leadCreation.unexpectedErrorCreate` |
| Toast / validation | "An unexpected error occurred while updating the lead" | `leadCreation.unexpectedErrorUpdate` |
| Validation | "This field is required" (multiple) | `common.fieldRequired` or `leadCreation.fieldRequired` |
| Validation | "Email is required", "Invalid email address" | `leadCreation.emailRequired`, `leadCreation.emailInvalid` |
| Validation | "Phone Number is required" | `leadCreation.phoneRequired` |
| Toast | "Lead Updated Successfully" / "Lead Created Successfully" | `leadCreation.leadUpdatedSuccess`, `leadCreation.leadCreatedSuccess` |

*Note: Values like `"Individual"`, `"Company"`, `"Male"`, `"Female"` are form values; labels are already translated. Option labels in dropdowns (e.g. Country/Province/City) may still be from APIs.*

### 3. **Lead bulk upload modal** (`BulkUploadModal/index.js`)

| String | Suggested key |
|--------|----------------|
| "Instructions:" | `bulkUpload.instructions` (or reuse from quote bulk upload) |
| "Download Template" | `bulkUpload.downloadTemplate` |
| "Download the sample template file" | `bulkUpload.instruction1` |
| "Fill in the lead details in the Excel file" | `bulkUpload.instruction2Lead` |
| "Upload the completed file (max 10MB)" | `bulkUpload.instruction3` |
| "Only .xlsx files are supported" | `bulkUpload.instruction4` |
| "Select Excel file to upload" | `bulkUpload.selectExcelFile` |
| "Maximum file size: 10MB" | `bulkUpload.maxFileSize` |
| "Processing your file..." | `bulkUpload.processingFile` |
| "Cancel" | `common.cancel` |
| "Processing..." | `bulkUpload.processing` |
| "Close" | `common.close` |
| Toast messages (success/error) | Add `leadBulkUpload.*` or reuse bulk upload keys |

### 4. **Lead listing motor tables / cards**

| File | String | Suggested key |
|------|--------|----------------|
| `LeadListingMotorCards/index.js` | "All Countries", "All Provinces", "All Cities" | e.g. `leadListing.allCountries`, `allProvinces`, `allCities` |
| `LeadListingMotorTable/index.js` | Same + toast summary/detail | Same + toast keys |

---

## Policy module

### 1. **Policy detail view** (`PolicyDetailView/index.jsx`)

| Location | Hardcoded string | Suggested key |
|----------|------------------|----------------|
| Section title | "Vehicle Details" | `policyDetail.vehicleDetails` |
| Section title | "Premium Breakdown" | `policyDetail.premiumBreakdown` (if not already) |
| Subtitle | "Calculated from gross premium" | `policyDetail.calculatedFromGross` (exists in quoteDetail – reuse or alias) |
| Section title | "Endorsements" | `policyDetail.endorsements` |
| Subtitle | "Latest endorsement activity for this policy." | `policyDetail.latestEndorsementActivity` |
| Empty state | "No endorsements recorded for this policy yet." | `policyDetail.noEndorsementsYet` |
| Button | "View Details" | `common.viewDetails` or `policyDetail.viewDetails` |
| Button | "View Document" | `policyDetail.viewDocument` |
| Sidebar | "Payment Required" | `policyDetail.paymentRequired` |
| Sidebar | "This policy requires payment to become active. You can proceed to payment now or pay later." | `policyDetail.paymentRequiredDescription` |
| Button | "Pay Later" | `policyDetail.payLater` |
| Button | "Proceed to Payment" | `policyDetail.proceedToPayment` or `coverageDetailsReview.proceedToPayment` |
| Sidebar | "Documents & Billing" | `policyDetail.documentsAndBilling` |
| Button | "Premium Accounting Entries" | `policyDetail.premiumAccountingEntries` |
| Meta text | "Generated from policy data" | `policyDetail.generatedFromPolicyData` |
| Button | "Preview" | `common.preview` or `policyDetail.preview` |
| Button | "Open" | `common.open` or `policyDetail.open` |
| Document title | "Insurance Placing Slip" | `policyDetail.insurancePlacingSlip` |
| Meta | "Available on request" | `policyDetail.availableOnRequest` |
| Sidebar | "Related Records" | `policyDetail.relatedRecords` |
| Dialog | "Document Preview" (header/title) | `policyDetail.documentPreview` |
| Empty state | "No document to preview." | `policyDetail.noDocumentToPreview` |
| Toast summary/detail | "No Document", "No policy document available to download" | `policyDetail.noDocument`, `policyDetail.noPolicyDocumentAvailable` |
| Toast | "Opening Document", "Document Opened", "Failed to Open Document" | `policyDetail.openingDocument`, `policyDetail.documentOpened`, `policyDetail.failedToOpenDocument` |
| Toast | "Policy ID is required", "Error" | `policyDetail.policyIdRequired`, `common.error` |
| Toast | "Insurance Placing Slip has been opened...", "Document Loaded", "Failed to Load" | `policyDetail.*` |
| Toast | "Invoice Generated", "Invoice Generation Failed" | `policyDetail.invoiceGenerated`, `policyDetail.invoiceGenerationFailed` |
| Toast | "Endorsement Unavailable", "Policy Reference Missing" | `policyDetail.endorsementUnavailable`, `policyDetail.policyReferenceMissing` |
| Breadcrumb | "Policy", "Detail View", "Home" | `common.policy` / `policyDetail.detailView` / `common.home` (if not already) |
| Sidebar labels | "Client ID", "Policy Number", "Payment Status", "Product Type", "Policy Issued", "Policy Expiry", "Production Date", "Inception Date", "Client Name", "Email", "Contact Number" | Reuse existing `policyDetail.*` or `leadDetail.*` where they exist |

### 2. **Policy bulk upload modal** (`policyModule/BulkUploadModal/index.jsx`)

Same pattern as lead bulk upload: "Instructions:", "Download Template", "Fill in the **policy** details in the Excel file", "Upload the completed file (max 10MB)", "Only .xlsx files are supported", "Select Excel file to upload", "Maximum file size: 10MB", "Processing your file...", "Cancel", "Processing...", "Close". Reuse or add `policyBulkUpload.*` / shared `bulkUpload.*` keys.

### 3. **Policy table** (`policyTable/index.jsx`)

| String | Suggested key |
|--------|----------------|
| `aria-label="View Policy"` | `policyDetail.viewPolicy` or `common.view` |
| `aria-label="More Actions"` | `common.moreActions` |

### 4. **Batch renewal / batch table** (`BatchRenewal/BatchTable.jsx`)

Placeholders: "Select Date", "Select Company", "Select Product", "Enter client name", "Select Status". Buttons: "Clear", "Generate Policy List", "Generate Report", "Retry Failed", "Send Renewal Notices". Text: "Total". Add e.g. `batchRenewal.*` or reuse common keys.

---

## Summary

- **Lead:** Lead Id label and Search placeholders in listing tables; lead creation toasts and validation messages; bulk upload modal copy; "All Countries/Provinces/Cities" in motor tables.
- **Policy:** Policy detail view section titles, subtitles, buttons, sidebar text, dialog header, empty states, and all toast messages; policy bulk upload modal; policy table aria-labels; batch renewal placeholders and button labels.

Constants used only as **option values** (e.g. "Individual", "Company") can stay in code if the **display labels** are translated; validation and toast messages should use `t()`.
