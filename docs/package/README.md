# iNXT BrokerVerse OOTB documentation pack

## How to use this index

The BrokerVerse OOTB documentation pack holds every document iorta TechNXT uses to sell, contract, implement, run and support iNXT BrokerVerse OOTB for a Philippine non-life broker. This index lists each file with its purpose, its audience and the stage of the customer lifecycle in which it is used.

- **Client-facing** files may be given to the broker, normally from the stage shown.
- **INTERNAL** files are for iorta TechNXT staff only. They hold pricing logic, discount limits, competitor positioning or internal strategy and are never sent to a broker or attached to a proposal. Their file names end in `_INTERNAL` where the document is a sales tool.
- Audiences: Sales (account managers and presales), Delivery (implementation project managers and consultants), Development (product engineering), Support (L2 and L3 application support), Management (iorta TechNXT management, and the broker's management for client-facing files).
- Lifecycle stages: Pre-sales, Contracting, Implementation, Go-live, Support.

Documents are kept in `docs/package`: `out/` holds the built Word, PDF and Excel files, `out/contracts/` the contract pack, `sales/` the sales kit (with copies of the sales documents built in `out/`), `source/` the text sources and `tools/` the builders.

## Index by audience

| Audience | Start with |
|---|---|
| Sales (25 files) | Product Functionality, Demo Script, FAQ and Objection Handling, Rate Card, Battlecard (INTERNAL), Negotiation Playbook (INTERNAL) |
| Delivery (30 files) | Implementation Approach and Plan, Discovery Workbook Guide, Fit-Gap Register, RAID Log, Data Migration and Cutover Plan, User Manual |
| Development (9 files) | Technical Reference, API and Dependency Catalogue, Data Dictionary, Release Notes Template |
| Support (20 files) | Production Support Approach and Standards, Schedules and Batch Jobs, Business Continuity and Disaster Recovery Plan, Communication Templates |
| Management (37 files) | OOTB Strategy and Playbook (INTERNAL), Commercial Proposal Note (INTERNAL), Release Notes and Roadmap, Architecture, Infrastructure, Security and Data Privacy |

## Index by lifecycle stage

| Stage | Documents used |
|---|---|
| Pre-sales | Brochure; One Page Brochure; Client Presentation; Product Functionality; Demo Script; FAQ and Objection Handling; Prospect Email Templates; Prospect Email Templates; Commercial Proposal Rate Card; ROI Calculator; Price Book (INTERNAL); Competitive Battlecard INTERNAL (INTERNAL); OOTB Strategy and Playbook (INTERNAL); Commercial Proposal Note (INTERNAL); Commercials and Pricing (INTERNAL); Security Due Diligence Questionnaire; Architecture Infrastructure Security and Privacy; Philippine Regulatory Compliance Matrix; Release Notes and Roadmap; Mutual Non Disclosure Agreement; Implementation Approach and Plan; Test Summary Report; OOTB Documentation Pack Index |
| Contracting | Prospect Email Templates; Prospect Email Templates; Commercial Proposal Rate Card; Price Book (INTERNAL); Negotiation Playbook INTERNAL (INTERNAL); OOTB Strategy and Playbook (INTERNAL); Commercial Proposal Note (INTERNAL); Commercials and Pricing (INTERNAL); Security Due Diligence Questionnaire; Architecture Infrastructure Security and Privacy; Contract Pack Index and Cover Letter; Letter of Award and Proposal Acceptance; Master Services Agreement; Order Form; Perpetual Software Licence Agreement; Software Subscription Agreement; Implementation Statement of Work; Annual Maintenance Support and SLA; Hosting and Infrastructure Services Agreement; Data Processing Agreement; Service Catalogue and Rate Annex; Customer Responsibilities and RACI Annex; Change Request Procedure and Form; Source Code Escrow Agreement; Exit and Transition Plan; Production Support Approach and Standards; Business Continuity and Disaster Recovery Plan; OOTB Documentation Pack Index |
| Implementation | OOTB Strategy and Playbook (INTERNAL); Architecture Infrastructure Security and Privacy; Philippine Regulatory Compliance Matrix; Implementation Statement of Work; Customer Responsibilities and RACI Annex; Change Request Procedure and Form; Implementation Approach and Plan; Implementation Plan; Discovery Workbook Guide; Discovery and Configuration Workbook; Fit Gap Register; RAID Log Template; Project Status Report Template; Data Migration and Cutover Plan; Data Dictionary; Privacy Impact Assessment and Records of Processing Templates; Training Plan; User Manual; Reports Book; Communication Templates and Touchpoints; Communication Touchpoints; Schedules and Batch Jobs; Test Cases; Technical Reference; API and Dependency Catalogue; OOTB Documentation Pack Index |
| Go-live | OOTB Strategy and Playbook (INTERNAL); Release Notes and Roadmap; UAT and Go Live Acceptance Certificates; Hypercare Exit and Handover Certificate; RAID Log Template; Project Status Report Template; Data Migration and Cutover Plan; Privacy Impact Assessment and Records of Processing Templates; User Manual; Schedules and Batch Jobs; Test Cases; Test Summary Report; Production Support Approach and Standards; OOTB Documentation Pack Index |
| Support | OOTB Strategy and Playbook (INTERNAL); Release Notes and Roadmap; Annual Maintenance Support and SLA; Hosting and Infrastructure Services Agreement; Service Catalogue and Rate Annex; Change Request Procedure and Form; Exit and Transition Plan; Hypercare Exit and Handover Certificate; Data Dictionary; User Manual; Reports Book; Communication Templates and Touchpoints; Communication Touchpoints; Schedules and Batch Jobs; Technical Reference; API and Dependency Catalogue; Release Notes Template; Production Support Approach and Standards; Business Continuity and Disaster Recovery Plan; OOTB Documentation Pack Index |

## File list

### Sales and pre-sales

| File | Formats | Purpose | Audience | Distribution | Used in |
|---|---|---|---|---|---|
| `iNXT_BrokerVerse_Brochure` | docx, pdf | Two-page product brochure | Sales | Client-facing | Pre-sales |
| `iNXT_BrokerVerse_One_Page_Brochure` | docx, pdf, png | One-page summary for a first e-mail or a trade event | Sales | Client-facing | Pre-sales |
| `iNXT_BrokerVerse_Client_Presentation` | pptx, pdf | Client presentation deck for the first meeting | Sales | Client-facing | Pre-sales |
| `iNXT_BrokerVerse_Product_Functionality` | docx, pdf | What the product does, module by module, with the vendor comparison checklist | Sales, Delivery | Client-facing | Pre-sales |
| `iNXT_BrokerVerse_Demo_Script` | docx, pdf | Scripted product demonstration with personas, data and timings | Sales | Client-facing | Pre-sales |
| `iNXT_BrokerVerse_FAQ_and_Objection_Handling` | docx, pdf | Answers to common questions and objections; known limits to disclose | Sales | Client-facing | Pre-sales |
| `iNXT_BrokerVerse_Prospect_Email_Templates` | docx, pdf | E-mails from first contact to the welcome after signing | Sales | Client-facing | Pre-sales, Contracting |
| `Prospect_Email_Templates` | txt | Plain-text copy of the prospect e-mails for pasting into a mail client | Sales | Client-facing | Pre-sales, Contracting |
| `iNXT_BrokerVerse_Commercial_Proposal_Rate_Card` | docx, pdf | Rate card and commercial proposal given to the broker | Sales, Management | Client-facing | Pre-sales, Contracting |
| `iNXT_BrokerVerse_ROI_Calculator` | xlsx | Return on investment calculator filled in with the broker | Sales | Client-facing | Pre-sales |
| `iNXT_BrokerVerse_Price_Book` **INTERNAL** | xlsx | Price book with quick quote, packages and negotiation limits | Sales, Management | **INTERNAL** | Pre-sales, Contracting |
| `iNXT_BrokerVerse_Competitive_Battlecard_INTERNAL` **INTERNAL** | docx, pdf | Competitor positioning and proof points | Sales | **INTERNAL** | Pre-sales |
| `iNXT_BrokerVerse_OOTB_Strategy_and_Playbook` **INTERNAL** | docx, pdf | How iorta TechNXT sells, delivers, supports and evolves the OOTB product | Management, Sales, Delivery, Development, Support | **INTERNAL** | Pre-sales, Contracting, Implementation, Go-live, Support |
| `BrokerVerse_Commercial_Proposal_Note` **INTERNAL** | docx, pdf | Pricing rationale, market positioning and commercial assumptions | Management, Sales | **INTERNAL** | Pre-sales, Contracting |
| `BrokerVerse_Commercials_and_Pricing` **INTERNAL** | xlsx | Formula-driven pricing model behind the rate card | Management, Sales | **INTERNAL** | Pre-sales, Contracting |
| `BrokerVerse_Security_Due_Diligence_Questionnaire` | docx, pdf, xlsx | Pre-answered security and outsourcing due diligence questionnaire | Sales, Delivery, Management | Client-facing | Pre-sales, Contracting |
| `BrokerVerse_Architecture_Infrastructure_Security_and_Privacy` | docx, pdf | Architecture, hosting options, security controls and data privacy | Delivery, Development, Support, Management | Client-facing | Pre-sales, Contracting, Implementation |
| `BrokerVerse_Philippine_Regulatory_Compliance_Matrix` | docx, pdf | How the product supports IC, BIR, premium tax, CTPL, DPA and AMLA obligations | Sales, Delivery, Management | Client-facing | Pre-sales, Implementation |
| `BrokerVerse_Release_Notes_and_Roadmap` | docx, pdf | What release 1.0 delivers, known limitations, versioning policy and indicative roadmap | Sales, Delivery, Support, Management | Client-facing | Pre-sales, Go-live, Support |
| `BrokerVerse_Implementation_Approach_and_Plan` | docx, pdf | Method, phases, plans by size, roles, governance and risks | Delivery, Management | Client-facing | Pre-sales, Implementation |
| `BrokerVerse_Test_Summary_Report` | docx, pdf | Results of the release test | Delivery, Development, Management | Client-facing | Pre-sales, Go-live |
| `BrokerVerse_OOTB_Documentation_Pack_Index` | docx, pdf | This index | Sales, Delivery, Development, Support, Management | Client-facing | Pre-sales, Contracting, Implementation, Go-live, Support |

### Contracting

| File | Formats | Purpose | Audience | Distribution | Used in |
|---|---|---|---|---|---|
| `iNXT_BrokerVerse_Contract_Pack_Index_and_Cover_Letter` | docx, pdf | Index of the contract pack and cover letter to the broker | Sales, Management | Client-facing | Contracting |
| `iNXT_BrokerVerse_Mutual_Non_Disclosure_Agreement` | docx, pdf | Mutual NDA before detailed discussions | Sales, Management | Client-facing | Pre-sales |
| `iNXT_BrokerVerse_Letter_of_Award_and_Proposal_Acceptance` | docx, pdf | Broker letter of award and acceptance of the proposal | Sales, Management | Client-facing | Contracting |
| `iNXT_BrokerVerse_Master_Services_Agreement` | docx, pdf | Master Services Agreement | Management | Client-facing | Contracting |
| `iNXT_BrokerVerse_Order_Form` | docx, pdf | Order Form: size, model, prices, hosting and dates | Sales, Management | Client-facing | Contracting |
| `iNXT_BrokerVerse_Perpetual_Software_Licence_Agreement` | docx, pdf | Licence schedule for the perpetual model | Management | Client-facing | Contracting |
| `iNXT_BrokerVerse_Software_Subscription_Agreement` | docx, pdf | Subscription schedule for the SaaS model | Management | Client-facing | Contracting |
| `iNXT_BrokerVerse_Implementation_Statement_of_Work` | docx, pdf | Implementation scope, milestones, acceptance and governance | Delivery, Management | Client-facing | Contracting, Implementation |
| `iNXT_BrokerVerse_Annual_Maintenance_Support_and_SLA` | docx, pdf | Annual maintenance, support and service levels | Support, Management | Client-facing | Contracting, Support |
| `iNXT_BrokerVerse_Hosting_and_Infrastructure_Services_Agreement` | docx, pdf | Hosting services, data location, backups and recovery objectives | Support, Management | Client-facing | Contracting, Support |
| `iNXT_BrokerVerse_Data_Processing_Agreement` | docx, pdf | Data processing agreement under the Data Privacy Act | Management, Support | Client-facing | Contracting |
| `iNXT_BrokerVerse_Service_Catalogue_and_Rate_Annex` | docx, pdf | Optional services and day rates | Sales, Management | Client-facing | Contracting, Support |
| `iNXT_BrokerVerse_Customer_Responsibilities_and_RACI_Annex` | docx, pdf | What the broker provides and who does what | Delivery, Management | Client-facing | Contracting, Implementation |
| `iNXT_BrokerVerse_Change_Request_Procedure_and_Form` | docx, pdf | Change request procedure and form | Delivery, Management | Client-facing | Contracting, Implementation, Support |
| `iNXT_BrokerVerse_Source_Code_Escrow_Agreement` | docx, pdf | Optional source code escrow with the perpetual licence | Management | Client-facing | Contracting |
| `iNXT_BrokerVerse_Exit_and_Transition_Plan` | docx, pdf | Data return and transition at the end of the contract | Management, Support | Client-facing | Contracting, Support |
| `iNXT_BrokerVerse_UAT_and_Go_Live_Acceptance_Certificates` | docx, pdf | UAT and go-live acceptance certificates | Delivery, Management | Client-facing | Go-live |
| `iNXT_BrokerVerse_Hypercare_Exit_and_Handover_Certificate` | docx, pdf | Hypercare exit and handover to support | Delivery, Support, Management | Client-facing | Go-live, Support |

### Implementation and go-live

| File | Formats | Purpose | Audience | Distribution | Used in |
|---|---|---|---|---|---|
| `BrokerVerse_Implementation_Plan` | xlsx | Gantt plans for the three sizes and the RACI matrix | Delivery | Client-facing | Implementation |
| `BrokerVerse_Discovery_Workbook_Guide` | docx, pdf | How to run the discovery and configuration workshops | Delivery | Client-facing | Implementation |
| `BrokerVerse_Discovery_and_Configuration_Workbook` | xlsx | Configuration decisions captured in discovery | Delivery | Client-facing | Implementation |
| `BrokerVerse_Fit_Gap_Register` | xlsx | Register of requirements classed Fit, Configure, Procedure or Gap | Delivery, Management | Client-facing | Implementation |
| `BrokerVerse_RAID_Log_Template` | xlsx | Risks, assumptions, issues and dependencies with scoring and summary | Delivery, Management | Client-facing | Implementation, Go-live |
| `BrokerVerse_Project_Status_Report_Template` | docx, pdf | Weekly or fortnightly status and steering committee report | Delivery, Management | Client-facing | Implementation, Go-live |
| `BrokerVerse_Data_Migration_and_Cutover_Plan` | docx, pdf | Go-live data, templates, mock loads, reconciliation and cutover | Delivery | Client-facing | Implementation, Go-live |
| `BrokerVerse_Data_Dictionary` | docx, pdf, xlsx | Tables, columns, relationships, personal data and retention | Delivery, Development, Support | Client-facing | Implementation, Support |
| `BrokerVerse_Privacy_Impact_Assessment_and_Records_of_Processing_Templates` | docx, pdf | PIA and records of processing pre-filled for the broker DPO | Delivery, Management | Client-facing | Implementation, Go-live |
| `BrokerVerse_Training_Plan` | docx, pdf | Training and change management by role | Delivery | Client-facing | Implementation |
| `BrokerVerse_User_Manual` | docx, pdf | User manual for the seven roles | Delivery, Support | Client-facing | Implementation, Go-live, Support |
| `BrokerVerse_Reports_Book` | docx, pdf, xlsx | Every report, dashboard and export with its columns and rules | Delivery, Support | Client-facing | Implementation, Support |
| `BrokerVerse_Communication_Templates_and_Touchpoints` | docx, pdf | Every e-mail, notification and printed document the system sends | Delivery, Support | Client-facing | Implementation, Support |
| `BrokerVerse_Communication_Touchpoints` | xlsx | Companion workbook of the communication templates | Delivery, Support | Client-facing | Implementation, Support |
| `BrokerVerse_Schedules_and_Batch_Jobs` | docx, pdf | Scheduled jobs, batch processes and the operational run book | Delivery, Support | Client-facing | Implementation, Go-live, Support |
| `BrokerVerse_Test_Cases` | xlsx | Release test cases, traceability and defects | Delivery, Development | Client-facing | Implementation, Go-live |
| `BrokerVerse_Technical_Reference` | docx, pdf | Code base, modules, security implementation and how to extend | Development, Support | Client-facing | Implementation, Support |
| `BrokerVerse_API_and_Dependency_Catalogue` | xlsx | Every API route with its permission and the screens that call it | Development, Support | Client-facing | Implementation, Support |

### Development and support

| File | Formats | Purpose | Audience | Distribution | Used in |
|---|---|---|---|---|---|
| `iNXT_BrokerVerse_Negotiation_Playbook_INTERNAL` **INTERNAL** | docx, pdf | Discount limits, trade-offs and approval rules in negotiation | Sales, Management | **INTERNAL** | Contracting |
| `BrokerVerse_Release_Notes_Template` | docx, pdf | Release notes for each patch, minor or major release | Development, Support | Client-facing | Support |
| `BrokerVerse_Production_Support_Approach_and_Standards` | docx, pdf | Support model, severities, change and release management, monitoring | Support, Management | Client-facing | Contracting, Go-live, Support |
| `BrokerVerse_Business_Continuity_and_Disaster_Recovery_Plan` | docx, pdf | Backups, recovery objectives, scenarios and DR tests | Support, Management | Client-facing | Contracting, Support |

## INTERNAL documents

These files never leave iorta TechNXT:

- `sales/iNXT_BrokerVerse_Price_Book` (xlsx): Price book with quick quote, packages and negotiation limits.
- `out/iNXT_BrokerVerse_Competitive_Battlecard_INTERNAL` (docx, pdf): Competitor positioning and proof points.
- `out/iNXT_BrokerVerse_Negotiation_Playbook_INTERNAL` (docx, pdf): Discount limits, trade-offs and approval rules in negotiation.
- `out/iNXT_BrokerVerse_OOTB_Strategy_and_Playbook` (docx, pdf): How iorta TechNXT sells, delivers, supports and evolves the OOTB product.
- `out/BrokerVerse_Commercial_Proposal_Note` (docx, pdf): Pricing rationale, market positioning and commercial assumptions.
- `out/BrokerVerse_Commercials_and_Pricing` (xlsx): Formula-driven pricing model behind the rate card.

## Building the documents

Each Word and PDF document is built from its text source in `source/` into the iorta TechNXT template:

```
cd docs/package/tools
python3 build_doc.py ../source/<name>.md ../out/<File_Name>.docx
python3 refresh.py ../out/<File_Name>.docx      (contents page and PDF)
```

The Product Functionality document also needs `python3 brochure/widths.py` on the .docx before `refresh.py`. The workbooks have their own builders (`build_project_templates_xlsx.py` for the Fit-Gap Register and the RAID Log, `build_plan_xlsx.py`, `build_discovery_workbook.py`, `build_pricing.py`, `build_price_book.py`, `build_roi.py`, `build_questionnaire_xlsx.py`). After rebuilding a sales document, copy the .docx and .pdf to `sales/`. Writing rules: `tools/WRITING_RULES.md`. This index is generated by `build_pack_index.py`.
