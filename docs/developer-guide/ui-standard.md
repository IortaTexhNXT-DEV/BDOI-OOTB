# UI standard

Back-office screens look like an enterprise insurance system (Guidewire, Sapiens, SAP Fiori). One rule per line; **Do** / **Don't**. The guard `brokerverse/src/utils/uiStandard.test.js` checks the rules a machine can check; justified exceptions go in `src/utils/uiStandard.allow.json` with a reason.

## Page header
- Do: every screen uses `components/PageHeader`, breadcrumb ending in the screen name (`trail={[title]}`).
- Do: explanation only behind the title's info icon (`help`), one sentence at most.
- Don't: paragraphs, intro banners, `pc-usage` / subtitle / note blocks under the title; no own `<h1>` (guarded).

## Controls
- Do: uploads through `components/ImportDialog`, opened from one outlined "Upload …" button; "Download template" as a text button.
- Do: a single file field in a form uses `components/FileField`.
- Don't: a visible `<input type="file">` ("Choose File / No file chosen"), native `type="date"` or `<select>` (guarded); use `DateField` and `Dropdown`.

## Buttons
- Do: one primary (filled) button per header and per dialog footer; others outlined.
- Do: dialog footers through `components/DialogFooter`: Close / Cancel as a text button on the left, destructive actions (withdraw, cancel, delete) red outlined and set apart, three or more secondary actions in the "More actions" menu.
- Don't: a disabled primary as an instruction ("Select … to batch"); use a normal outlined button with a tooltip.
- Don't: rounded pill buttons with labels (rounded is for icon-only buttons).

## Dialogs
- Do: record dialog title = number + version + status chip (`RecordTitle`); descriptions in the body.
- Do: details in `KeyValueGrid` grouped into `DetailSection`s, long values `span: "full"`, no holes in the grid.
- Do: long details in the side panel pattern (`RecordPage` / side dialog), not a tall centred dialog.

## Tables
- Do: the shared `DataTable` (the paginator hides itself when the rows fit one page).
- Do: numbers right-aligned (`bv-num`), dates on one line (`bv-nowrap`), codes and record numbers bold in link colour.
- Do: status only through `StatusChip`; lists of codes through `TableCells` `ListCell` (+n more).
- Do: row actions as icon buttons with tooltips (`RowActions`); a narrow last column, never sticky over data.
- Do: the empty state is one short line naming the next step ("No uploads yet. Upload the day's file.").
- Don't: raw technical codes as primary text (`policy.issue.broker_billed`, `{{policyNumber}}`, `clm_crs_08`); show business names, keep codes in `TechnicalDetails`.
- Don't: a table wider than its card at 1366px; merge related columns (gross with net + taxes as a muted second line).

## Copy
- Do: sentence case labels; consistent terms: Policy, Quotation, Request for Quotation, Placement Slip, Insurer, Client.
- Don't: emojis, exclamation marks, marketing adjectives (seamless, powerful, easily, simply, effortlessly, smart), chatty phrases (Let's, Oops, Great!, Here you can), em-dash flourishes (guarded in en.json).

## Visual
- Do: spacing, colours, radii and font sizes from the theme tokens (`theme/bdoi/tokens.scss`, `enterprise.scss`).
- Don't: gradients, coloured card backgrounds, large icons in headers or cards, shadows beyond the theme tokens.
