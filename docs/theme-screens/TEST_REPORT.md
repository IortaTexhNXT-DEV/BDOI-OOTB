# BDOI theme: screen-by-screen test

Themed production build of `brokerverse/` served locally, signed in as the dev test agent against the dev API with every write request blocked. The walk replays the user-manual inventory: each screen, each tab, each create/add form, its validation state and the first record view.

| | |
|---|---|
| Screens (menu entries) | 116 |
| States captured | 391 |
| Write requests sent | 0 (blocked: 1 read-only presigned-URL lookups) |
| Horizontal overflow | 0 |
| JavaScript errors | 1 |

Contact sheets `screens-01.jpg` onward show every screen's main state: live dev site on the left, themed build on the right.

## Automatic checks on every captured state

Each state was scanned for: old palette colours (indigo, the old dark sidebar, the old BDO blues) in computed styles; text not set in Nunito; text whose colour equals its background; page overflow; uncaught JavaScript errors.

### Old colours still on screen

- indigo #4f46e5 as backgroundColor: 1 element(s) on `master-system-settings--add-company-logo--validation.png`
- indigo #4f46e5 as backgroundColor: 1 element(s) on `master-system-settings--add-company-logo.png`
- indigo #4f46e5 as backgroundColor: 1 element(s) on `master-system-settings.png`
- indigo #6366f1 as backgroundColor: 2 element(s) on `master-system-settings--add-company-logo--validation.png`
- indigo #6366f1 as backgroundColor: 2 element(s) on `master-system-settings--add-company-logo.png`
- indigo #6366f1 as backgroundColor: 2 element(s) on `master-system-settings.png`

All of these are the colour values saved on the dev server for System Settings (Primary / Secondary colour), shown back as swatches. They are data, not styling, and change when the BDO presets are saved there.

### Text not in Nunito

- `sans, Arial, sans-serif`: Reports > Financial Reports > Collection Report, Reports > Financial Reports > Journal, Reports > Financial Reports > Payables, Reports > Financial Reports > SOA/Premium Receivable, Reports > Financial Reports > Trail Balance, Reports > Operational Reports > Broker Commission

### Text with the same colour as its background

- `card-title: Total Bill Amount` on accounts-remittance-direct-bill-processing--tab-2-bill-details.png, accounts-remittance-direct-bill-processing--validation.png
- `card-value: ₱0.00` on accounts-remittance-direct-bill-processing--tab-2-bill-details.png, accounts-remittance-direct-bill-processing--validation.png
- `main__btn__action p-button p-component: Add Program` on master-finance-incentive-programs--add-program--validation.png, master-finance-incentive-programs--add-program.png, master-finance-incentive-programs--record--tab-incentive-structure.png, master-finance-incentive-programs--record--tab-target-configuration.png
- `main__btn__action p-button p-component: New Calculation` on accounts-incentive-calculations--new-calculation.png, accounts-incentive-calculations--record--tab-agent-details-3.png, accounts-incentive-calculations--record--tab-execution-log.png, accounts-incentive-calculations--record.png
- `rank-icon: 🥈` on operations-renewals-performance--tab-agent-performance.png
- `theme-preview: Theme preview` on master-system-settings--add-company-logo--validation.png, master-system-settings--add-company-logo.png, master-system-settings.png

### JavaScript errors

- `Cannot read properties of undefined (reading 'state')` on master-generals-insurance-management-insurance-company--record.png

## Not reachable in the walk (same on the live dev site)

These routes render an empty page on the live dev site as well, so they are outside the theme:

- Sign in / form:New Quote: `/quotes/new`
- Dashboard > Executive Dashboard / form:New Quote: `/quotes/new`
- Dashboard > Claims Dashboard / record: `/claims/view/CLAIM-2026-MOTOR-868300`
- Dashboard > Underwriting Dashboard / form:New Submission: `/underwriting/new`
- Dashboard > Underwriting Dashboard / record: `/underwriting/case/SUB938416DM`
- Master > Generals > Insurance Management > Insurance Company / record: `/master/generals/insurancemanagement/insurancecompany/view/1`
- Operations > Payments / record: `/agent/policydetailedviewonly`

Tabs and buttons the walker could not activate (also failed on the live walk): 21. Accounts > Incentive > Calculations / form:New Calculation:validation, Accounts > Remittance > Adjustments / tab:Adjustment History, Accounts > Remittance > Approval Workflow / tab:remittance.approvalHistory, Accounts > Remittance > Approval Workflow / tab:remittance.delegation, Accounts > Remittance > Bulk Processing / tab:2 Validate, Accounts > Remittance > Bulk Processing / tab:3 Process, Accounts > Remittance > Bulk Processing / tab:4 Complete, Accounts > Remittance > History / tab:Archive History, Accounts > Remittance > History / tab:Audit Trails, Accounts > Remittance > History / tab:Data Lineage, Accounts > Remittance > History / tab:System Logs, Accounts > Remittance > Notifications / tab:Analytics, Accounts > Remittance > Notifications / tab:Sent, Accounts > Remittance > Notifications / tab:Templates, Accounts > Remittance > Statements / tab:2 remittance.preview, Accounts > Remittance > Statements / tab:3 remittance.generate, Master > Generals > Employee Management > Designation / form:Add:validation, Master > Generals > User Management > User / form:Add:validation, Operations > Renewals > Lapse Management / tab:Win-back Campaigns, Operations > Renewals > Negotiations / form:Request Approval, Reinsurance > Cession Tracking / tab:Line of Business Breakdown

## Review of the flagged items

Every flagged state was opened and checked by eye. None is a theme regression:

- **Indigo on System Settings** and the **Theme preview** text: the swatches and the preview gradient are drawn from the Primary / Secondary colours saved on the dev server (currently Indigo). That is stored data; saving the BDO Blue / BDO Navy presets there turns them blue.
- **`sans, Arial` on the report validation states**: the report screens still open a hard-coded Google Drive PDF when Generate is pressed; the text is Chrome's own "site can't be reached" page for that link, not the app. The same happens on the live dev site.
- **Add Program / New Calculation buttons** and the **Total Bill Amount card**: white text on a blue gradient. The check compares text colour with the nearest background *colour*; a gradient is a background *image*, so the check sees the white page behind it. The screenshots show the text clearly.
- **Rank icon**: an emoji, drawn in its own colours.
- **JavaScript error** on the Insurance Company record view: the same error is raised on the live dev site (the view reads navigation state that the list does not pass).

## Compared with the first run

| Check | First run | This run |
|---|---|---|
| Text not in Nunito (element count) | 133 | 36 |
| Fonts other than Nunito | 3 | 1 |
| Same-colour text (distinct items) | 14 | 6 |
| Page overflow | 0 | 0 |

The Arial buttons, the Segoe UI text and the hidden table-head text found in the first run are gone.

