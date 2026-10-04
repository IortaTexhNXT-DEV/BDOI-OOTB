"""Builds the project control workbooks of the implementation:

    python3 build_project_templates_xlsx.py ../05_Delivery            both workbooks
    python3 build_project_templates_xlsx.py ../05_Delivery raid       only the RAID log
    python3 build_project_templates_xlsx.py ../05_Delivery fitgap     only the fit-gap register

  BrokerVerse_Fit_Gap_Register.xlsx   Instructions, Register, Product Gaps Closed, Lists
  BrokerVerse_RAID_Log_Template.xlsx  Instructions, Summary, Risks, Assumptions, Issues, Dependencies, Lists

The classes and fields follow the Implementation Approach and Plan (fit-gap classes Fit, Configure, Procedure, Gap;
RAID log fields; steering committee escalation of high items). Rows marked "Example" show how a line is filled in and
are deleted at mobilisation.
"""
import os
import sys
from openpyxl import Workbook
from openpyxl.formatting.rule import CellIsRule, FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '05_Delivery')
NAVY = '0B2A4A'
HEAD_FILL = PatternFill('solid', fgColor=NAVY)
HEAD_FONT = Font(name='Segoe UI', bold=True, color='FFFFFF', size=10)
BODY_FONT = Font(name='Segoe UI', size=10)
TITLE_FONT = Font(name='Segoe UI', bold=True, color=NAVY, size=14)
BOLD = Font(name='Segoe UI', bold=True, size=10, color=NAVY)
THIN = Side(style='thin', color='BFC7D1')
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical='top')
EXAMPLE_FILL = PatternFill('solid', fgColor='F3F6FA')
ROWS = 200  # rows prepared with validation and formulas


def table(ws, headers, widths, rows=(), start=1):
    for j, (h, w) in enumerate(zip(headers, widths), 1):
        c = ws.cell(row=start, column=j, value=h)
        c.font, c.fill, c.border = HEAD_FONT, HEAD_FILL, BOX
        c.alignment = Alignment(wrap_text=True, vertical='center')
        ws.column_dimensions[get_column_letter(j)].width = w
    ws.row_dimensions[start].height = 32
    for i, r in enumerate(rows, start + 1):
        for j, v in enumerate(r, 1):
            c = ws.cell(row=i, column=j, value=v)
            c.font, c.border, c.alignment = BODY_FONT, BOX, WRAP
    ws.freeze_panes = ws.cell(row=start + 1, column=1)
    ws.auto_filter.ref = f'A{start}:{get_column_letter(len(headers))}{start + max(len(rows), 1) + ROWS}'


def boxes(ws, first, last, cols):
    for r in range(first, last + 1):
        for j in range(1, cols + 1):
            c = ws.cell(row=r, column=j)
            c.border, c.alignment = BOX, WRAP
            if c.font != BODY_FONT and not c.font.bold:
                c.font = BODY_FONT


def listsheet(wb, lists):
    ws = wb.create_sheet('Lists')
    for j, (name, values) in enumerate(lists.items(), 1):
        c = ws.cell(row=1, column=j, value=name)
        c.font, c.fill = HEAD_FONT, HEAD_FILL
        ws.column_dimensions[get_column_letter(j)].width = 26
        for i, v in enumerate(values, 2):
            ws.cell(row=i, column=j, value=v).font = BODY_FONT
    ws.freeze_panes = 'A2'
    return {name: f"Lists!${get_column_letter(j)}$2:${get_column_letter(j)}${len(v) + 1}" for j, (name, v) in enumerate(lists.items(), 1)}


def validate(ws, ref, col, first, last):
    dv = DataValidation(type='list', formula1=f'={ref}', allow_blank=True)
    ws.add_data_validation(dv)
    dv.add(f'{col}{first}:{col}{last}')


def instructions(ws, title, intro, rows):
    ws['A1'] = title
    ws['A1'].font = TITLE_FONT
    ws['A2'] = intro
    ws['A2'].font, ws['A2'].alignment = BODY_FONT, WRAP
    ws.merge_cells('A2:B2')
    ws.row_dimensions[2].height = 60
    table(ws, ['Item', 'Guidance'], [28, 110], rows, start=4)
    ws.auto_filter.ref = None


# Product gaps of the PH process fit assessment (catalogue IDs of build_fit_assessment_xlsx.py) and the module that
# closes each one in the release of 04 October 2026; 'In development' when the work is on its development branch.
CLOSED = [
    ('1.01', 'Client onboarding, KYC and AML', 'Individual client record with Philippine address, mobile and TIN', 'Client created only at first policy; location masters not the full PSGC list', 'Closed', 'Operations > Clients > Onboard client; PSGC masters (Master > Location)', 'BR-01-001, BR-15-011'),
    ('1.02', 'Client onboarding, KYC and AML', 'Corporate client with authorised signatories', 'No signatory or board resolution record', 'Closed', 'Onboard client > Add signatory (aml)', 'BR-01-002'),
    ('1.04', 'Client onboarding, KYC and AML', 'Risk-based CDD rating and EDD', 'No risk rating, EDD or KYC refresh', 'Closed', 'Compliance > Client Due Diligence, EDD Reviews, KYC Refresh (aml)', 'BR-01-005, BR-01-006, BR-01-011'),
    ('1.05', 'Client onboarding, KYC and AML', 'Beneficial ownership of juridical clients', 'No beneficial owner capture', 'Closed', 'Onboard client > Add beneficial owner (aml)', 'BR-01-004'),
    ('1.06', 'Client onboarding, KYC and AML', 'Sanctions, PEP and negative list screening', 'No screening', 'Closed', 'Compliance > Screening Lists, Screening Hits; provider adapter (aml)', 'BR-01-007, BR-01-008'),
    ('1.07', 'Client onboarding, KYC and AML', 'Covered and suspicious transaction monitoring and AMLC reporting', 'No rules, alerts or AMLC file', 'Closed', 'Compliance > Transaction Alerts, AML Cases, AMLC Reports (aml)', 'BR-01-009, BR-01-010'),
    ('2.04', 'Prospecting and sales pipeline', 'Sales activities on prospects', 'No activity log', 'In development', 'Sales activity log (in development); My Work tasks today', 'BR-02-010'),
    ('2.05', 'Prospecting and sales pipeline', 'Lead assignment and team view', 'No assignment rules, queue or team view', 'Closed', 'Operations > Sales & Marketing > Lead Assignment (leads)', 'BR-02-004, BR-02-005'),
    ('2.07', 'Prospecting and sales pipeline', 'Dealer, bank and affinity channels', 'No channel master or dealer report', 'Closed', 'Master > Insurance > Distribution Channels; Dealer Production report (channels)', 'BR-02-006'),
    ('2.08', 'Prospecting and sales pipeline', 'Marketing campaigns to consenting clients', 'No campaign module', 'Closed', 'Operations > Sales & Marketing > Campaigns (campaigns)', 'BR-02-007'),
    ('3.03', 'Quotation and insurer comparison', 'Client comparison and recommendation report', 'In development at assessment', 'Closed', 'Operations > Sales & Marketing > Comparison Reports (comparison-reports)', 'BR-03-008'),
    ('3.10', 'Quotation and insurer comparison', 'Electronic signature on documents', 'In development at assessment', 'Closed', 'E-signatures mapped to documents (e-signatures); client acceptance by approval link', 'BR-15-010, BR-03-006'),
    ('3.11', 'Quotation and insurer comparison', 'Product Configurator rules drive the quotation', 'Only the motor tariff fed quotations', 'Closed', 'Governing template, acceptance rules, rating factors, market mapping, document templates (product-configurator); quote wizard covers and risk fields in development', 'BR-03-004, BR-03-009, BR-03-010'),
    ('4.07', 'RFQ, placement and reinsurance', 'Cover note while the policy is pending', 'No cover note', 'Closed', 'Operations > Cover Notes (cover-notes)', 'BR-04-007'),
    ('4.08', 'RFQ, placement and reinsurance', 'Placement only with IC-authorised insurers', 'No certificate of authority check', 'Closed', 'Compliance > Insurance Commission > Insurer Authority; check at RFQ, firm order and issue (ic-compliance)', 'BR-04-008'),
    ('4.10', 'RFQ, placement and reinsurance', 'Facultative reinsurance placement', 'No facultative slip workflow', 'Closed', 'Reinsurance > Facultative Placements (reinsurance)', 'BR-04-010'),
    ('5.07', 'Policy issuance and motor', 'CTPL COC authentication and LTO', 'No provider or LTO integration', 'Closed', 'Operations > CTPL Authentication; connectors CTPL_AUTH, LTO_FEED (integrations)', 'BR-05-005'),
    ('5.08', 'Policy issuance and motor', 'Brand-new vehicle programme with dealers and banks', 'No programme, dealer upload or bank letter', 'Closed', 'Operations > Sales & Marketing > Dealer Programmes (motor-programmes)', 'BR-05-008'),
    ('5.09', 'Policy issuance and motor', 'Fleet schedules', 'No per-vehicle fleet policy', 'Closed', 'Operations > Fleet Schedules (fleet)', 'BR-05-009'),
    ('5.12', 'Policy issuance and motor', 'Marine open cover', 'No open cover or declarations', 'Closed', 'Operations > Marine Open Covers (marine)', 'BR-05-010'),
    ('6.04', 'Endorsements and cancellations', 'Computed return premium on cancellation', 'Return premium typed by the user', 'Closed', 'Operations > Policy Cancellation (cancellations)', 'BR-06-004, BR-06-005'),
    ('6.05', 'Endorsements and cancellations', 'Short-period rate scale', 'No short-period table', 'Closed', 'Master > Insurance > Short-Period Rates (cancellations)', 'BR-06-004'),
    ('7.07', 'Renewals and retention', 'Renewal notices by SMS or messaging app', 'No SMS or Viber gateway', 'Closed', 'Message Templates; SMS and Viber connectors (integrations)', 'BR-07-002'),
    ('8.09', 'Billing, collection and receipts', 'Separate instalment invoices', 'No invoice per instalment', 'Closed', 'Accounts > Credit Control > Instalment Plans > Issue instalment invoices (credit-control)', 'BR-08-007'),
    ('8.12', 'Billing, collection and receipts', 'Post-dated cheque register', 'PDCs not tracked', 'Closed', 'Accounts > Post-Dated Cheques (pdc)', 'BR-08-008'),
    ('9.05', 'Remittance and direct bill', 'Bank payment files', 'No bank upload file', 'Closed', 'Accounts > Bank Payment Files; Master > Finance > Bank File Layouts (integrations)', 'BR-09-004'),
    ('9.09', 'Remittance and direct bill', 'Insurer system integration by API', 'No insurer API connector', 'Closed', 'Master > System > Insurer Integration (integrations)', 'BR-09-008'),
    ('10.09', 'Commission and incentives', 'Licence check before paying commission', 'Commission payable without a licence', 'Closed', 'Compliance > Insurance Commission > Licence Register; referrer licence check (ic-compliance)', 'BR-10-005'),
    ('10.10', 'Commission and incentives', 'Overriding, profit and contingent commission', 'Booked by journal voucher', 'Closed', 'Commission > Insurer Overrides (insurer-overrides)', 'BR-10-007'),
    ('11.03', 'Claims assistance', 'Claim document checklist and reminders', 'No checklist or reminders', 'Closed', 'Operations > Claim Documents; Master > Insurance > Claim Document Checklist (claim-documents)', 'BR-11-003'),
    ('11.06', 'Claims assistance', 'Claims paid through the broker from the Accounting menu', 'Panel only on the claim screens', 'Closed', 'Accounts > Claims Settlements (claim-payments)', 'BR-11-007'),
    ('11.08', 'Claims assistance', 'Motor repair estimates and letters of authority', 'No estimate or LOA workflow', 'Closed', 'Operations > Motor Claim Repairs; Master > Insurance > Repair Shops (motor-claims)', 'BR-11-006'),
    ('12.10', 'Accounting and period end', 'Supplier invoices, input VAT and fixed assets', 'No AP sub-ledger or asset register', 'Closed', 'Accounts > Payables; Accounts > Fixed Assets (payables, fixed-assets); asset disposal and supplier 2307 in development', 'BR-12-006, BR-12-007'),
    ('13.04', 'Taxes and BIR', 'Percentage tax 2551Q', 'No working paper', 'Closed', 'Accounts > Tax > Percentage Tax 2551Q (bir)', 'BR-13-003'),
    ('13.07', 'Taxes and BIR', '0619-E and 1601-EQ returns', 'Not laid out as the BIR forms', 'Closed', 'Accounts > Tax > Withholding Returns (bir)', 'BR-13-005'),
    ('13.08', 'Taxes and BIR', 'Annual information return 1604-E', 'No 1604-E alphalist', 'Closed', 'Accounts > Tax > Annual Alphalist 1604-E (bir)', 'BR-13-006'),
    ('13.10', 'Taxes and BIR', 'Invoices under the EOPT Act', 'Registered invoice not fixed in the product', 'Closed', 'Accounts > Tax > Sales Invoices (bir)', 'BR-13-008'),
    ('13.11', 'Taxes and BIR', 'CAS registration support', 'No books print set or CAS pack', 'Closed', 'Accounts > Tax > CAS Books and Documents (bir)', 'BR-13-009'),
    ('13.12', 'Taxes and BIR', 'Electronic invoicing (EIS)', 'No EIS connector', 'Closed', 'Accounts > Tax > E-Invoicing (EIS) (bir); live after BIR certification', 'BR-13-010'),
    ('13.13', 'Taxes and BIR', 'BIR DAT files', 'No DAT file', 'Closed', 'Accounts > Tax > BIR DAT Files (bir)', 'BR-13-007'),
    ('14.02', 'IC and Data Privacy compliance', 'Licence renewal tracking', 'No licence calendar', 'Closed', 'Compliance > Insurance Commission > Licence Register (ic-compliance)', 'BR-14-001'),
    ('14.03', 'IC and Data Privacy compliance', 'Fit and proper records', 'Kept outside the system', 'Closed', 'Compliance > Insurance Commission > Fit and Proper (ic-compliance)', 'BR-14-002'),
    ('14.04', 'IC and Data Privacy compliance', 'IC annual statement in the IC format', 'No IC-format report', 'Closed', 'Compliance > Insurance Commission > IC Annual Statement (ic-compliance)', 'BR-14-003'),
    ('14.05', 'IC and Data Privacy compliance', 'IC production report', 'IC layout not produced', 'Closed', 'Compliance > Insurance Commission > IC Production Report (ic-compliance)', 'BR-14-004'),
    ('14.08', 'IC and Data Privacy compliance', 'Complaints handling (RA 11765)', 'No complaints register', 'Closed', 'Compliance > Insurance Commission > Complaints (ic-compliance)', 'BR-14-005'),
    ('14.11', 'IC and Data Privacy compliance', 'Breach register and 72-hour tracker', 'No breach register', 'Closed', 'Compliance > Data Privacy (NPC) > Breach Register (privacy)', 'BR-14-009'),
    ('14.12', 'IC and Data Privacy compliance', 'Masking of personal data by role', 'Identifiers shown in full', 'Closed', 'view:pii permission, privacy.masking_enabled; mask:data tool for copies', 'BR-14-010, BR-14-012'),
    ('14.13', 'IC and Data Privacy compliance', 'Encryption of personal identifiers', 'No field-level encryption', 'Closed', 'Field encryption of TIN, ID and bank numbers (PII_ENCRYPTION_KEY)', 'BR-14-011'),
    ('15.03', 'Reporting, administration and go-live', 'Ad hoc reporting and BI extract', 'No report designer or extract', 'Closed', 'Reports > Report Builder; BI extract (report-builder)', 'BR-15-003'),
    ('15.07', 'Reporting, administration and go-live', 'Audit trail screen', 'Reworked screen in development', 'Closed', 'Master > System > Audit Trail (audit)', 'BR-15-007'),
    ('15.08', 'Reporting, administration and go-live', 'Menu by role and task', 'Menu redesign in development', 'Closed', 'Enterprise side menu with Master sections; Help panel (F1)', 'BR-15-008'),
    ('15.09', 'Reporting, administration and go-live', 'My Work inbox', 'In development at assessment', 'Closed', 'Operations > My Work (my-work)', 'BR-02-009'),
    ('15.11', 'Reporting, administration and go-live', 'Branding, letterhead and e-signature', 'In development at assessment', 'Closed', 'Master > System Settings > Theme and Branding; e-signatures (branding, e-signatures)', 'BR-15-010'),
    ('15.12', 'Reporting, administration and go-live', 'Philippine reference masters', 'In development at assessment', 'Closed', 'PSGC geography, banks, ID types, salutations, holidays, IC insurer list (migration 0250, seeds 12 and 69)', 'BR-15-011'),
]


# ------------------------------------------------------------------ fit-gap register
def fit_gap():
    wb = Workbook()
    ws = wb.active
    ws.title = 'Instructions'
    instructions(ws, 'BrokerVerse Fit-Gap Register',
                 'One line per requirement found in the discovery workshops. Each line is classed, owned and decided. '
                 'The register is signed by the process owners at the end of discovery (Small week 2, Medium week 3, '
                 'Large week 5) and is then kept up to date until hypercare exit. Lines marked Example show how a line is '
                 'filled in; delete them before the first workshop.',
                 [
                     ('Requirement ID', 'FG-<area code>-<number>, for example FG-ACC-012. Never reuse an ID; a dropped line keeps its ID with status Withdrawn.'),
                     ('Area', 'The process area of the discovery workshops (list on the Lists sheet).'),
                     ('Requirement', 'What the broker needs, in its own words, with the volume or rule that matters.'),
                     ('Classification', 'Fit: delivered as it is. Configure: met by a setting or master data. Procedure: the broker changes how it works (workaround). Gap: needs a change to the product.'),
                     ('Solution', 'For Fit and Configure: the screen, setting or master (for example Master > Configuration > Billing, Collections & Credit). For Procedure: the new way of working, which goes into training. For Gap: the proposed change.'),
                     ('CR reference', 'For a Gap only: the change request number (Change Request Procedure and Form). A Gap is not in the go-live scope unless the steering committee approves it.'),
                     ('Effort', 'For Configure: hours of configuration. For Gap: the estimate in person-days from the change request.'),
                     ('Priority', 'Must have for go-live, Should have, Could have (after go-live).'),
                     ('Owner', 'One named person of the broker or of iorta TechNXT who closes the line.'),
                     ('Status', 'Open, Under analysis, Decided, Configured, Closed, Withdrawn.'),
                     ('Decision date', 'The date the class and solution were agreed (workshop or steering committee).'),
                     ('Decided by', 'The process owner, or the steering committee for a Gap.'),
                     ('Summary', 'The counts at the top of the Register sheet update themselves; report them in the weekly status report.'),
                     ('Product Gaps Closed', 'The gaps of the product found in the PH process fit assessment (IDs of the PH Fit and ASEAN Rollout Assessment catalogue), with the module that now closes each one, or In development. Use it in discovery: a requirement on this sheet is Fit or Configure, not Gap. The BR column points to the Business Requirements Document.'),
                 ])
    reg = wb.create_sheet('Register')
    reg['A1'] = 'Lines by classification:'
    reg['A1'].font = BOLD
    for j, cls in enumerate(['Fit', 'Configure', 'Procedure', 'Gap'], 2):
        reg.cell(row=1, column=2 * j - 2, value=cls).font = BOLD
        reg.cell(row=1, column=2 * j - 1, value=f'=COUNTIF($D$4:$D${ROWS + 3},"{cls}")').font = BODY_FONT
    headers = ['Requirement ID', 'Area', 'Requirement', 'Classification', 'Solution', 'CR reference', 'Effort',
               'Priority', 'Owner', 'Status', 'Decision date', 'Decided by', 'Remarks']
    widths = [15, 18, 46, 15, 46, 13, 10, 14, 18, 14, 13, 18, 30]
    examples = [
        ('FG-ACC-001', 'Accounting and tax', 'Example. VAT-registered broker: output VAT on commission debit notes at 12%.', 'Fit',
         'Delivered: direct bill debit notes add VAT at the tax code direct_bill.commission_vat_code (VAT12-OUT).', '', '', 'Must have', '[Accounting Manager]', 'Decided', '', '[name]', 'Example: delete'),
        ('FG-BIL-002', 'Billing and collection', 'Example. Official receipts e-mailed to the client with the PDF when recorded.', 'Configure',
         'Switch on receipts.email_on_record (Master > Configuration > Billing, Collections & Credit > Receipts); SMTP mailbox set.', '', '1 hour', 'Should have', '[System Administrator]', 'Decided', '', '[name]', 'Example: delete'),
        ('FG-REG-003', 'Regulatory reporting', 'Example. BIR returns filed from the system straight into eFPS.', 'Gap',
         'BrokerVerse prepares the returns, DAT files and filing records; direct filing to eFPS or eBIRForms needs a change request.', 'CR-[number]', '[days]', 'Could have', '[Accounting Manager]', 'Under analysis', '', 'Steering committee', 'Example: delete'),
        ('FG-REM-004', 'Remittance', 'Example. Remittances above PHP 1,000,000.00 approved by the Accounting Manager.', 'Configure',
         'Authority Matrix, transaction type Remittance approval: Accounting PHP 1,000,000.00, Accounting Manager without limit (delivered default).', '', '0.5 hour', 'Must have', '[Accounting Manager]', 'Decided', '', '[name]', 'Example: delete'),
        ('FG-POL-005', 'Policy and servicing', 'Example. Brokers send the policy schedule by courier only.', 'Procedure',
         'Print from Operations > Policy > Policy detail > Policy schedule; procedure added to the Operations training.', '', '', 'Should have', '[Operations head]', 'Decided', '', '[name]', 'Example: delete'),
    ]
    table(reg, headers, widths, examples, start=3)
    boxes(reg, 4, ROWS + 3, len(headers))
    for r in range(4, 4 + len(examples)):
        for j in range(1, len(headers) + 1):
            reg.cell(row=r, column=j).fill = EXAMPLE_FILL
    for r in range(4, ROWS + 4):
        reg.cell(row=r, column=11).number_format = 'DD MMM YYYY'
    refs = listsheet(wb, {
        'Area': ['Organisation and users', 'Sales and quotation', 'Placement', 'Policy and servicing', 'Claims', 'Renewals',
                 'Billing and collection', 'Remittance', 'Commission and incentives', 'Accounting and tax', 'Period end',
                 'Bank and insurer reconciliation', 'Reinsurance', 'Reports and dashboards', 'Regulatory reporting',
                 'Data privacy', 'Integrations', 'Data migration', 'Security and access', 'Hosting and operations'],
        'Classification': ['Fit', 'Configure', 'Procedure', 'Gap'],
        'Priority': ['Must have', 'Should have', 'Could have'],
        'Status': ['Open', 'Under analysis', 'Decided', 'Configured', 'Closed', 'Withdrawn'],
    })
    for name, col in (('Area', 'B'), ('Classification', 'D'), ('Priority', 'H'), ('Status', 'J')):
        validate(reg, refs[name], col, 4, ROWS + 3)
    reg.conditional_formatting.add(f'D4:D{ROWS + 3}', CellIsRule(operator='equal', formula=['"Gap"'], fill=PatternFill('solid', fgColor='FCE4D6')))
    reg.freeze_panes = 'B4'
    pg = wb.create_sheet('Product Gaps Closed', 2)
    pg['A1'] = 'Product gaps closed in the release of 04 October 2026'
    pg['A1'].font = TITLE_FONT
    pg['A2'] = (f'{sum(r[4] == "Closed" for r in CLOSED)} of {len(CLOSED)} gaps of the PH process fit assessment are closed; '
                f'in development: {sum(r[4] != "Closed" for r in CLOSED)}. Module names in brackets are the backend modules.')
    pg['A2'].font = BODY_FONT
    table(pg, ['Fit ID', 'Area', 'Requirement', 'Gap as assessed', 'Status', 'Closed by (screen and module)', 'BR reference'],
          [8, 24, 36, 32, 13, 52, 20], CLOSED, start=4)
    pg.auto_filter.ref = f'A4:G{4 + len(CLOSED)}'
    pg.conditional_formatting.add(f'E5:E{4 + len(CLOSED)}', CellIsRule(operator='equal', formula=['"Closed"'], fill=PatternFill('solid', fgColor='DCEFE3')))
    pg.conditional_formatting.add(f'E5:E{4 + len(CLOSED)}', CellIsRule(operator='equal', formula=['"In development"'], fill=PatternFill('solid', fgColor='FFF2CC')))
    pg.freeze_panes = 'A5'
    wb.active = 1
    wb.save(os.path.join(OUT, 'BrokerVerse_Fit_Gap_Register.xlsx'))


# ------------------------------------------------------------------ RAID log
def raid():
    wb = Workbook()
    ws = wb.active
    ws.title = 'Instructions'
    instructions(ws, 'BrokerVerse RAID Log',
                 'One shared log of risks, assumptions, issues and dependencies, kept by the iorta TechNXT project manager '
                 'and reviewed in every weekly status meeting. Items rated High go to the steering committee. The risks, '
                 'assumptions and dependencies pre-filled from the Implementation Approach and Plan and the Dependency Map '
                 'and Critical Path (version 1.1, 04 October 2026) are typical of a BrokerVerse implementation: partner '
                 'certification, screening list licences, tax adviser confirmations, regulatory registrations, encryption key '
                 'custody and the data quality of the migration. Keep, change or close them at mobilisation, and replace '
                 '[owner] with a named person.',
                 [
                     ('ID', 'R-nnn, A-nnn, I-nnn or D-nnn with a running number. Never reuse an ID.'),
                     ('Probability (risks)', '1 Rare (under 10%), 2 Unlikely (10 to 30%), 3 Possible (30 to 50%), 4 Likely (50 to 80%), 5 Almost certain (over 80%).'),
                     ('Impact (risks and issues)', '1 Negligible, 2 Minor (a task slips), 3 Moderate (a milestone slips up to one week), 4 Major (go-live or budget at risk), 5 Severe (go-live missed, compliance or data loss).'),
                     ('Score and rating', 'Score = probability x impact. High: 15 to 25. Medium: 8 to 14. Low: 1 to 7. Calculated on the sheet; do not type over the formula.'),
                     ('Issue priority', 'An issue has happened. Priority follows impact: 4 or 5 High, 3 Medium, 1 or 2 Low.'),
                     ('Assumptions', 'Each assumption has a date by which it must be validated; an assumption found false becomes an issue or a risk.'),
                     ('Dependencies', 'What the project needs from someone outside the team (the broker, a regulator, an insurer, a bank, a provider, the hosting provider), by when (W = week from kick-off, for Small / Medium / Large / Enterprise), its float to go-live in working days, what happens if it is late, and its state. A float of 0 means the go-live moves day for day.'),
                     ('Escalation', 'A dependency on the critical path late by 3 working days, or any dependency late by more than its float, goes to the steering committee.'),
                     ('Status', 'Open, In progress, Closed. Fill the closure date and keep closed items on the sheet.'),
                     ('Summary', 'The Summary sheet counts open items by type and rating for the status report and the steering committee.'),
                 ])
    refs_data = {
        'Status': ['Open', 'In progress', 'Closed'],
        'Score': ['1', '2', '3', '4', '5'],
        'Category': ['Scope', 'Schedule', 'Data', 'People', 'Technical', 'Integration', 'Partner', 'Compliance', 'Regulatory', 'Security', 'Commercial', 'Hosting'],
        'Priority': ['High', 'Medium', 'Low'],
        'Dependency state': ['On track', 'At risk', 'Late', 'Delivered'],
    }
    rating = lambda r: f'=IF(OR(G{r}="",H{r}=""),"",IF(G{r}*H{r}>=15,"High",IF(G{r}*H{r}>=8,"Medium","Low")))'
    score = lambda r: f'=IF(OR(G{r}="",H{r}=""),"",G{r}*H{r})'

    # risks
    rk = wb.create_sheet('Risks')
    rh = ['ID', 'Risk', 'Cause', 'Effect', 'Category', 'Owner', 'Probability', 'Impact', 'Score', 'Rating',
          'Mitigation', 'Due date', 'Status', 'Raised on', 'Closed on']
    rw = [8, 38, 28, 30, 13, 18, 11, 9, 8, 10, 46, 12, 12, 12, 12]
    pre = [
        ('Client data for the configuration kit arrives late or incomplete', 'Insurer agreements, rates, products or the chart of accounts not ready', 'Configuration and every later phase slip day for day (critical path)', 'Data', 4, 4,
         'Data request and blank kits at kick-off; data readiness tracked weekly; escalation after 3 working days of delay'),
        ('Poor data quality of the migration', 'Duplicates, missing fields, old balances, addresses that do not match the PSGC masters', 'Rows in error; open items or balances do not reconcile; rehearsal fails', 'Data', 4, 4,
         'Mock loads on fresh extracts; errors workbook after each validation; the broker cleanses at source; reconciliation signed per load'),
        ('Migrated clients lack identification and KYC details', 'Old system without ID, TIN, birth date or beneficial owners', 'KYC status Incomplete; High-risk clients without EDD cannot be issued or renewed', 'Compliance', 3, 4,
         'Identify gaps in mock load 1; compliance officer plans the KYC completion and EDD reviews before the first renewals'),
        ('Requests for customisation', 'Old system habits; new wishes', 'Scope and timeline grow', 'Scope', 3, 4,
         'Configure-first principle; fit-gap classes; change request process with steering committee approval'),
        ('Key users unavailable', 'Business as usual takes priority', 'Decisions late; weak UAT and training', 'People', 3, 3,
         'Named key users with committed time; backups named; workshops scheduled at kick-off'),
        ('Opening balances and open items do not agree', 'Cut-off differences', 'Ledger wrong from day one', 'Data', 2, 5,
         'Reconciliation of every load: premiums receivable control account equals the open items; Due to Insurers reconciled to insurer statements; Accounting Manager signs off'),
        ('Tax adviser confirmations late', 'Adviser not engaged in time', 'Wrong VAT, withholding, ATC or invoice wording; UAT sign-off held', 'Compliance', 3, 4,
         'Adviser review booked in the configuration phase; written confirmation is a predecessor of UAT sign-off'),
        ('BIR ATP or CAS registration not in place', 'New registration started late; serial range not confirmed', 'Sales invoices cannot be issued from BrokerVerse; release to Production held', 'Regulatory', 2, 5,
         'Confirm existing registration or start on the kick-off day; manual invoices under the old ATP only with the tax adviser\'s written agreement'),
        ('BIR EIS enrolment not available by go-live', 'BIR enrolment and certification timetable', 'EIS connector stays off', 'Regulatory', 3, 2,
         'Go live with the connector off; Queue earlier invoices once enrolled; Export payloads for a manual upload'),
        ('AMLC registration or portal access not ready', 'Registration not started or institution code missing', 'Covered transactions cannot be filed within 5 working days', 'Regulatory', 2, 4,
         'Confirm at mobilisation; CTR test file before go/no-go; go/no-go criterion'),
        ('Screening list licences not obtained', 'PEP list provider not contracted; lists not downloaded', 'Clients not screened at onboarding, issue and payout; compliance officer cannot sign the go/no-go', 'Compliance', 3, 4,
         'UN and AMLC lists loaded first; PEP licence started after the compliance workshop; full rescreen before go-live'),
        ('IC licence data incomplete', 'Agents\' or officers\' licences not collected', 'Commission payouts to agents refused (licence check block)', 'Compliance', 3, 3,
         'Collect licences in weeks 1 to 3; licence register filled before the first commission run; warn mode only by decision of the compliance officer'),
        ('Insurer certificates of authority missing', 'Certificate numbers and validity not entered', 'Warnings at quotation, firm order and issue; block mode not possible', 'Compliance', 3, 2,
         'Enter certificates from the IC list; keep warn until complete, then switch to block'),
        ('NPC registration or DPO not confirmed', 'Registration not updated for the new system', 'Personal data processed without the registration updated; go/no-go criterion not met', 'Regulatory', 2, 4,
         'DPO named in week 1; registration confirmed before go/no-go'),
        ('Partner certification of bank payment files late', 'Bank specification changes; bank test cycle', 'Payments by cheque and manual transfers at go-live', 'Partner', 3, 3,
         'Bank contacts in week 1; starter layouts validated early; fallback agreed at go/no-go'),
        ('CTPL authentication provider not live at go-live', 'Accreditation or COC series not ready', 'Every COC keyed in from the provider portal; extra work in Operations', 'Partner', 3, 4,
         'Provider contract in week 1 to 2; COC series loaded with the configuration kit; manual code entry rehearsed in UAT'),
        ('Insurer API certification late', 'Insurer test environments and mapping cycles', 'Policies recorded with Record Issued Policy; claim status by file', 'Partner', 4, 2,
         'Prioritise the insurers with the largest volume; go live insurer by insurer'),
        ('SMS or Viber provider not live', 'Sender name registration; contract', 'Renewal notices and reminders by e-mail only', 'Partner', 3, 2,
         'Contract early; SMS jobs stay off until live; consent rules checked in UAT'),
        ('Encryption key lost or not escrowed', 'No key custody record; key only on one server', 'Backups unreadable; TIN, ID and bank numbers lost', 'Security', 1, 5,
         'Key custody record before Production is provisioned; escrow copy under dual control kept with the backups; rotation procedure'),
        ('Personal data exposed in a non-production copy', 'Pre-Prod or a training copy opened to people without production access', 'Breach of the Data Privacy Act; NPC notification', 'Security', 2, 5,
         'mask:data before anyone signs in; DPO approves each refresh; Pre-Prod removed after hypercare'),
        ('Release pipeline cannot reach a server', 'Network rule or deploy key (SSH from the GitHub runners)', 'Deployments skipped or failing; release to Production late', 'Hosting', 3, 3,
         'GitHub Environments and reachability tested with the first deployment; self-hosted runner or SSM as alternative'),
        ('Client marks used without permission', 'Client brand pack applied before permission is on file', 'Trademark exposure', 'Compliance', 2, 3,
         'Client brand pack applied only with written permission on the engagement file'),
        ('Users not ready at go-live', 'Training too early or skipped', 'Errors and slow work', 'People', 2, 3,
         'Role-based training, assessment before production access, floor walkers in the first week'),
        ('Book larger than one import file', 'More than 20,000 rows of a sheet', 'Longer loads; cutover window too short', 'Data', 2, 3,
         'Split into several files; time the loads in the rehearsal'),
        ('First month-end close outside hypercare', 'Go-live late in the month', 'Close issues found late', 'Schedule', 2, 3,
         'Hypercare extends to the first close'),
    ]
    rows = [(f'R-{i:03d}', r[0], r[1], r[2], r[3], '[owner]', r[4], r[5], None, None, r[6], None, 'Open', None, None) for i, r in enumerate(pre, 1)]
    table(rk, rh, rw, rows)
    boxes(rk, 2, ROWS + 1, len(rh))
    for r in range(2, ROWS + 2):
        rk.cell(row=r, column=9, value=score(r))
        rk.cell(row=r, column=10, value=rating(r))
        for c in (12, 14, 15):
            rk.cell(row=r, column=c).number_format = 'DD MMM YYYY'
    for name, cols in (('Score', 'GH'), ('Category', 'E'), ('Status', 'M')):
        for col in cols:
            dv = DataValidation(type='whole', operator='between', formula1='1', formula2='5', allow_blank=True) if name == 'Score' else None
            if dv:
                rk.add_data_validation(dv); dv.add(f'{col}2:{col}{ROWS + 1}')
    rk.conditional_formatting.add(f'J2:J{ROWS + 1}', CellIsRule(operator='equal', formula=['"High"'], fill=PatternFill('solid', fgColor='F8CBAD')))
    rk.conditional_formatting.add(f'J2:J{ROWS + 1}', CellIsRule(operator='equal', formula=['"Medium"'], fill=PatternFill('solid', fgColor='FFE699')))
    rk.conditional_formatting.add(f'J2:J{ROWS + 1}', CellIsRule(operator='equal', formula=['"Low"'], fill=PatternFill('solid', fgColor='C6E0B4')))

    # assumptions
    asn = wb.create_sheet('Assumptions')
    ah = ['ID', 'Assumption', 'Basis', 'Effect if false', 'Owner', 'Validate by', 'Validated', 'Status', 'Remarks']
    aw = [8, 44, 30, 34, 18, 13, 11, 12, 30]
    arows = [
        ('A-001', 'The size of the implementation (Small, Medium, Large or Enterprise) agreed at mobilisation stays valid once the data volumes are known.', 'Implementation Approach and Plan, sizes', 'Plan and price re-baselined', '[PM]', None, '', 'Open', ''),
        ('A-002', 'The broker already holds, or obtains within the lead times of the Dependency Map, its BIR ATP or CAS registration, AMLC registration and NPC registration.', 'Dependency Map, regulatory registrations', 'Go-live moves; becomes a dependency late', '[Broker PM]', None, '', 'Open', ''),
        ('A-003', 'The delivered chart of accounts is used with the accountant\'s mapping, not replaced.', 'Configure-first principle', 'Posting rules, account determination and IC account mapping redone', '[Accounting Manager]', None, '', 'Open', ''),
        ('A-004', 'The delivered tax codes, ATC and rates apply, subject to the tax adviser\'s confirmation.', 'Delivered tax set-up', 'Tax set-up and UAT tax scenarios redone', '[Accounting Manager]', None, '', 'Open', ''),
        ('A-005', 'The delivered AML values (thresholds, working days, match score, refresh months) apply, subject to the compliance officer\'s confirmation against the AMLC\'s current issuances.', 'AML Settings as delivered', 'AML settings and monitoring rules changed before UAT', '[Compliance officer]', None, '', 'Open', ''),
        ('A-006', 'The broker contracts its partners (banks for payment files, SMS provider, CTPL authentication provider, insurers for APIs, payment gateway) in weeks 1 to 2.', 'Integration workshop', 'Features go live after go-live with their fallback', '[IT head]', None, '', 'Open', ''),
        ('A-007', 'The broker provides its SMTP mailbox before the integrations phase.', 'Dependencies on the broker', 'E-mails stay queued in the outbox; go-live held', '[IT head]', None, '', 'Open', ''),
        ('A-008', 'One legal entity and one fiscal year are migrated, at a single cutover date.', 'Statement of Work', 'Migration scope and plan re-baselined', '[PM]', None, '', 'Open', ''),
        ('A-009', 'Users work with the delivered roles, including Compliance Officer (AML/CFT); view:pii is granted only to the roles that need it.', 'Delivered roles', 'Role design and training redone', '[System Administrator]', None, '', 'Open', ''),
        ('A-010', 'The broker\'s own brand (or a delivered preset) is used; a client brand pack is used only with written permission.', 'Branding workshop', 'Branding delayed until permission', '[Sponsor]', None, '', 'Open', ''),
    ]
    table(asn, ah, aw, arows)
    boxes(asn, 2, ROWS + 1, len(ah))
    for r in range(2, ROWS + 2):
        asn.cell(row=r, column=6).number_format = 'DD MMM YYYY'

    # issues
    iss = wb.create_sheet('Issues')
    ih = ['ID', 'Issue', 'Effect', 'Category', 'Owner', 'Impact', 'Priority', 'Action', 'Due date', 'Status', 'Raised on', 'Closed on', 'From risk']
    iw = [8, 40, 32, 13, 18, 8, 10, 44, 12, 12, 12, 12, 10]
    table(iss, ih, iw, [
        ('I-001', '[Example: bank statement export of one bank does not match the delivered formats]', '[Bank reconciliation not testable in SIT]', 'Integration', '[owner]', 3, None, '[Adjust the columns in Master > Finance > Bank Statement Formats]', None, 'Open', None, None, ''),
        ('I-002', '[Example: mock load 1 rejected 8% of client rows: city and barangay names do not match the PSGC masters]', '[Clients and policies not loaded; reconciliation fails]', 'Data', '[owner]', 4, None, '[Map addresses to PSGC codes in the extract; correct with the errors workbook; validate again]', None, 'Open', None, None, 'R-002'),
        ('I-003', '[Example: PEP list licence not signed; only UN and AMLC lists loaded]', '[Screening incomplete for go/no-go]', 'Compliance', '[owner]', 4, None, '[Escalate to the sponsor; agree interim internal list; sign licence before go/no-go]', None, 'Open', None, None, 'R-011'),
    ])
    boxes(iss, 2, ROWS + 1, len(ih))
    for r in range(2, ROWS + 2):
        iss.cell(row=r, column=7, value=f'=IF(F{r}="","",IF(F{r}>=4,"High",IF(F{r}=3,"Medium","Low")))')
        for c in (9, 11, 12):
            iss.cell(row=r, column=c).number_format = 'DD MMM YYYY'
    iss.conditional_formatting.add(f'G2:G{ROWS + 1}', CellIsRule(operator='equal', formula=['"High"'], fill=PatternFill('solid', fgColor='F8CBAD')))

    # dependencies
    dep = wb.create_sheet('Dependencies')
    dh = ['ID', 'Dependency', 'Provided by', 'Needed for', 'Needed by (S / M / L / E)', 'Owner', 'State', 'Remarks',
          'Float to go-live, days (S / M / L / E)', 'If late']
    dw = [8, 46, 20, 26, 18, 18, 12, 24, 16, 40]
    dpre = [
        ('Named PM, key users, Accounting Manager, System Administrator, compliance officer and DPO', 'Broker', 'Workshops, decisions', 'W1 / W1 / W1 / W1', '10 / 14 / 24 / 30', 'Workshops and decisions late'),
        ('Hosting option, environment set and data location decision', 'Broker', 'Environments', 'W1 / W1 / W1 / W1', '4 / 8 / 12 / 17', 'Environments and the configuration load late'),
        ('Insurer list and agreements, commission and referrer rates, product list', 'Broker', 'Configuration kit', 'W1 / W2 / W3 / W4', '0 / 0 / 0 / 0', 'Go-live moves day for day (critical path)'),
        ('Chart of accounts and the accountant\'s mapping decisions', 'Broker', 'Configuration kit', 'W1 / W2 / W3 / W4', '0 / 0 / 0 / 0', 'Go-live moves day for day (critical path)'),
        ('User list with roles, branches and reporting lines', 'Broker', 'Configuration kit; My Team; approvals', 'W1 / W2 / W3 / W3', '0 / 1 / 2 / 3', 'Go-live moves; approvals misrouted'),
        ('SMTP mailbox and credentials', 'Broker', 'E-mail test', 'W1 / W2 / W2 / W2', '23 / 36 / 60 / 90', 'E-mails stay queued; go-live held at the end'),
        ('Bank accounts, one statement export per account, payee bank accounts', 'Broker', 'Statement formats; bank payment files', 'W2 / W2 / W3 / W3', '19 / 30 / 51 / 77', 'Bank imports and payment files late'),
        ('Encryption key custody record (PII_ENCRYPTION_KEY, DATA_ENCRYPTION_KEY), signed by the broker IT head and iorta TechNXT', 'Broker and iorta TechNXT', 'Production provisioning', 'W1 / W2 / W2 / W2', '5 / 9 / 14 / 20', 'Production not provisioned'),
        ('GitHub Environments with reviewers and secrets; server reachable from the pipeline', 'iorta TechNXT (repository owner)', 'First deployment', 'W1 / W2 / W2 / W2', '4 / 8 / 13 / 19', 'Configuration load late'),
        ('Production environment provisioned, backups and restore test', 'Hosting provider', 'Release to Production', 'W2 / W3 / W4 / W5', '13 / 23 / 42 / 67', 'Release to Production and rehearsal late'),
        ('BIR ATP or CAS registration; invoice serial range; last numbers used', 'Broker (BIR)', 'Numbering; release to Production', 'W4 / W5 / W6 / W6', '2 / 12 / 31 / 58', 'Go-live moves; invoices not issued from BrokerVerse'),
        ('BIR EIS enrolment and credentials (when covered)', 'Broker (BIR)', 'EIS connector live', 'Go-live week', 'Feature only', 'Connector off; earlier invoices queued later'),
        ('AMLC registration, portal access, institution code', 'Broker (AMLC)', 'AMLC report file; go/no-go', 'W3 / W4 / W4 / W4', '12 / 22 / 46 / 76', 'Go-live held; CTR filing not possible'),
        ('IC licence data of the firm, officers and agents; insurer certificates of authority', 'Broker', 'Compliance set-up', 'W2 / W2 / W3 / W3', '10 / 14 / 31 / 48', 'Commission payouts blocked; authority warnings'),
        ('NPC registration of the DPO and data processing systems', 'Broker (NPC)', 'Go/no-go', 'W4 / W5 / W6 / W6', '8 / 18 / 38 / 68', 'Go-live held'),
        ('Screening lists (UN, AMLC) and the PEP list licence', 'Broker; list provider', 'Screening; go/no-go', 'W3 / W4 / W4 / W5', '15 / 26 / 47 / 76', 'Go-live held; clients not screened'),
        ('Tax adviser written confirmation of tax codes, ATC, rates, invoice and receipt wording', 'Broker (tax adviser)', 'UAT sign-off', 'W4 / W6 / W9 / W12', '8 / 14 / 23 / 42', 'UAT sign-off held'),
        ('Partner contracts and credentials: SMS provider, CTPL authentication provider, payment gateway, insurer API access', 'Broker', 'Partner certifications', 'W2 / W3 / W4 / W6', 'Feature only', 'Features go live later with their fallback'),
        ('COC number series from each insurer', 'Insurers', 'CTPL authentication', 'W2 / W2 / W3 / W3', 'Feature only', 'COC numbers entered by hand'),
        ('Bank acceptance of each payment file layout (test file)', 'Banks', 'Bank payment files live', 'W5 / W7 / W10 / W13', 'Feature only', 'Cheques and manual transfers'),
        ('CTPL authentication provider: accreditation and live test', 'CTPL authentication provider', 'Authentication at issue; LTO feed', 'W4 / W6 / W9 / W11', 'Feature only', 'Enter code from the provider portal'),
        ('Insurer API test cycles', 'Insurers', 'Insurer API connectors', 'W5 / W8 / W11 / W13', 'Feature only', 'Record Issued Policy; claim status file'),
        ('Written permission to use client marks (client brand pack only)', 'Broker; mark owner', 'Client brand pack', 'W1 / W2 / W2 / W2', 'Feature only', 'Broker theme or delivered preset'),
        ('Migration extracts of clients, in-force policies, open items, open claims and trial balance, cleansed', 'Broker', 'Each mock load and cutover', 'W2 / W3 / W5 / W6', '10 / 20 / 31 / 47', 'Mock loads and rehearsal late'),
        ('User list for training, training rooms and devices', 'Broker', 'End-user training', 'W2 / W2 / W2 / W2', '17 / 28 / 52 / 75', 'Training late; production access held'),
        ('UAT testers and sign-off authority', 'Broker', 'UAT', 'W1 / W1 / W2 / W2', '18 / 31 / 53 / 72', 'UAT late'),
        ('Freeze of the old system and final extract at cutover', 'Broker', 'Cutover', 'Cutover week', '0 / 0 / 0 / 0', 'Go-live moves'),
    ]
    table(dep, dh, dw, [(f'D-{i:03d}', d[0], d[1], d[2], d[3], '[owner]', 'On track', '', d[4], d[5]) for i, d in enumerate(dpre, 1)])
    boxes(dep, 2, ROWS + 1, len(dh))

    refs = listsheet(wb, refs_data)
    for ws_, col in ((rk, 'E'), (iss, 'D')):
        validate(ws_, refs['Category'], col, 2, ROWS + 1)
    for ws_, col in ((rk, 'M'), (asn, 'H'), (iss, 'J')):
        validate(ws_, refs['Status'], col, 2, ROWS + 1)
    validate(dep, refs['Dependency state'], 'G', 2, ROWS + 1)
    dv = DataValidation(type='whole', operator='between', formula1='1', formula2='5', allow_blank=True)
    iss.add_data_validation(dv); dv.add(f'F2:F{ROWS + 1}')
    dep.conditional_formatting.add(f'G2:G{ROWS + 1}', CellIsRule(operator='equal', formula=['"Late"'], fill=PatternFill('solid', fgColor='F8CBAD')))
    dep.conditional_formatting.add(f'G2:G{ROWS + 1}', CellIsRule(operator='equal', formula=['"At risk"'], fill=PatternFill('solid', fgColor='FFE699')))

    # summary
    sm = wb.create_sheet('Summary', 1)
    sm['A1'] = 'RAID summary (open and in progress items)'
    sm['A1'].font = TITLE_FONT
    N = ROWS + 1
    open_ = lambda sheet, col: f'COUNTIFS({sheet}!$A$2:$A${N},"<>",{sheet}!${col}$2:${col}${N},"<>Closed")'
    rows = [
        ('Risks', f'=COUNTIFS(Risks!$J$2:$J${N},"High",Risks!$M$2:$M${N},"<>Closed")', f'=COUNTIFS(Risks!$J$2:$J${N},"Medium",Risks!$M$2:$M${N},"<>Closed")', f'=COUNTIFS(Risks!$J$2:$J${N},"Low",Risks!$M$2:$M${N},"<>Closed")', '=' + open_('Risks', 'M')),
        ('Issues', f'=COUNTIFS(Issues!$G$2:$G${N},"High",Issues!$J$2:$J${N},"<>Closed")', f'=COUNTIFS(Issues!$G$2:$G${N},"Medium",Issues!$J$2:$J${N},"<>Closed")', f'=COUNTIFS(Issues!$G$2:$G${N},"Low",Issues!$J$2:$J${N},"<>Closed")', '=' + open_('Issues', 'J')),
        ('Assumptions', '', '', '', '=' + open_('Assumptions', 'H')),
        ('Dependencies late or at risk', '', '', '', f'=COUNTIFS(Dependencies!$G$2:$G${N},"Late")+COUNTIFS(Dependencies!$G$2:$G${N},"At risk")'),
    ]
    table(sm, ['Type', 'High', 'Medium', 'Low', 'Open total'], [30, 12, 12, 12, 14], rows, start=3)
    sm.auto_filter.ref = None
    sm['A10'] = 'Risk matrix: open risks by probability (rows) and impact (columns)'
    sm['A10'].font = BOLD
    sm.cell(row=11, column=1, value='Probability \\ Impact').font = HEAD_FONT
    sm.cell(row=11, column=1).fill = HEAD_FILL
    for i in range(1, 6):
        c = sm.cell(row=11, column=i + 1, value=i); c.font, c.fill, c.border = HEAD_FONT, HEAD_FILL, BOX
    for p in range(5, 0, -1):
        r = 12 + (5 - p)
        c = sm.cell(row=r, column=1, value=p); c.font, c.border = BOLD, BOX
        for i in range(1, 6):
            cell = sm.cell(row=r, column=i + 1, value=f'=COUNTIFS(Risks!$G$2:$G${N},{p},Risks!$H$2:$H${N},{i},Risks!$M$2:$M${N},"<>Closed")')
            cell.border, cell.font = BOX, BODY_FONT
            cell.alignment = Alignment(horizontal='center')
            cell.fill = PatternFill('solid', fgColor='F8CBAD' if p * i >= 15 else ('FFE699' if p * i >= 8 else 'C6E0B4'))
    sm.freeze_panes = 'A4'
    wb.active = 1
    wb.save(os.path.join(OUT, 'BrokerVerse_RAID_Log_Template.xlsx'))


if __name__ == '__main__':
    which = sys.argv[2] if len(sys.argv) > 2 else 'both'
    if which in ('both', 'fitgap'):
        fit_gap()
    if which in ('both', 'raid'):
        raid()
    print('written to', OUT)
