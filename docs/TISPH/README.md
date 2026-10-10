# BrokerVerse for TISPH: documents

Documents written for Toyota Insurance Services Philippines (TISPH). They describe the system built on this
branch line (`TISPH-DEV`) and take precedence over the generic BrokerVerse product documents elsewhere under `docs/`.
Classification: Confidential, TISPH and iorta TechNXT.

Start with the Document Register (`pack/TISPH_Document_Register.docx`): it lists every document TISPH requires,
where it is held, its owner, its approver and its status.

| Folder | Contents |
|---|---|
| [`frs/`](frs/) | Functional Requirement Specifications, one per BRD build item (the TISPH SRS): personas, functional requirements with acceptance criteria, traceability to test cases |
| [`pack/`](pack/) | Non-functional, technical, operational and governance documents (list below) |
| [`testing/`](testing/) | Test strategy and test pack |
| [`proposals/`](proposals/) | Design proposals and answers awaiting TISPH decisions |

## `frs/`: Functional Requirement Specifications

| File | Build item |
|---|---|
| `FRS_TIS-BRD-COLL-05_PDC_Lifecycle_v1.0.docx` | COLL-05 Post-dated cheque lifecycle |
| `FRS_TIS-BRD-COMM-06_Remittance_Commission_v1.0.docx` | COMM-06 Remittance commission |
| `FRS_TIS-BRD-COMM-08_Telesales_Incentive_v1.0.docx` | COMM-08 Telesales incentive |
| `FRS_TIS-BRD-LEAD-09_Talkbot_Renewal_Filter_v1.0.docx` | LEAD-09 Talkbot renewal filter |
| `FRS_TIS-BRD-PJRN-09_Parcel_Courier_v1.0.docx` | PJRN-09 Parcel and courier |
| `FRS_TIS-BRD-PROD-15_Promotions_v1.2.docx` | PROD-15 Promotions |
| `FRS_TIS-BRD-PROD-16_Commission_Rules_v1.0.docx` | PROD-16 Commission rules |
| `FRS_TIS-BRD-SCHM-01_Scheme_Issuance_v1.0.docx` | SCHM-01 Scheme issuance |
| `FRS_TIS-BRD-SCHM-02_Scheme_Master_v1.0.docx` | SCHM-02 Scheme master |
| `FRS_TIS-BRD-SCHM-03_Lock-in_Handling_v1.0.docx` | SCHM-03 Lock-in handling |

## `pack/`: document pack

| File | Document |
|---|---|
| `TISPH_Document_Register.docx` | Document Register: every required document, its location, owner, approver and status |
| `TISPH_NFR_Compliance.docx` | Non-Functional Requirements and Compliance Matrix |
| `TISPH_Solution_Architecture.docx` | Solution, Application, Integration and Deployment Architecture |
| `TISPH_Security_Architecture.docx` | Security Architecture and Threat Model |
| `TISPH_Data_Architecture.docx` | Data Architecture, Data Model, Lineage and Governance |
| `TISPH_Environments_and_Release.docx` | Environment Strategy, CI/CD, Release, Promotion and Rollback |
| `TISPH_Data_Migration_and_Cutover.docx` | Data Migration and Cutover Plan |
| `TISPH_Operations_and_Support.docx` | Operations, Support Model, Runbooks, DR/BCP and Service Levels |
| `TISPH_Delivery_Governance.docx` | Delivery Governance, RACI, Risks, ADRs, Production Readiness, Go-Live and Hypercare |
| `TISPH_Documentation_Cleanup.docx` | Documentation clean-up: generic documents retired from this repository and their replacements |

## `testing/`: test strategy and test pack

| File | Contents |
|---|---|
| `TISPH_Test_Strategy.docx` | Test strategy: scope, test levels, environments, entry and exit criteria, roles, tools |
| [`TISPH_Test_Pack.xlsx`](testing/TISPH_Test_Pack.xlsx) | Requirements, scenarios, positive and negative conditions and gaps, traced to the BRD and FRS identifiers |

## `proposals/`: design proposals

| File | Contents |
|---|---|
| `TISPH_Remittance_Redesign_Specification.docx` | Remittance redesign: menu, status model, controls, screens, flows and phased build plan |
| `TISPH_Agents_Referrer_Commission_and_Reports.docx` | Agents and referrer commission process, Reports screen and overriding commission panel |
| `TISPH_Platform_Features_Proposal.docx` | Environment promotion, copy of transactions, master uploads, TISPH manual, risk details and personal data |

All documents use the iorta TechNXT document template and are issued as Word files.

## Related folders

* `docs/onboarding/`: procedures used by the code (data masking, go-live data set-up, smoke test and reset, support).
* `docs/developer-guide/`, `backend/docs/`, `deploy/AZURE.md`, `deploy/REFERENCE.md`: developer and runtime reference.
* `docs/archive/`: generic product documents retired from this repository, with what replaced each one.

Client source documents (the signed BRD and the discovery and gap-analysis material) are not held in this
repository.
