# Bespoke placements (non-packaged corporate risks)

The deal room of a complex corporate risk, next to the standard placement journey (`../placement`): the wording of
the slip, the market negotiation with several underwriters, the layered co-insurance of the placed risk and the
facultative reinsurance when local capacity is not enough. Screens: Operations > Placement (Slip Composer,
Underwriter Room, Layering & Co-insurance, Facultative RI) and Master > Clause Library, Master > Slip Templates.

Permissions (migration `0200`, granted again by `seeds/80_bespoke_permissions.sql` on a new database):

| Permission | Roles | Used for |
|---|---|---|
| `read:bespoke` | processing, operations, accounting (and the accounting manager through inheritance) | every read of the module |
| `write:bespoke` | processing, operations | composing slips, underwriter rooms, layers, claim split movements |
| `write:clause-library` | processing | clause library and slip templates |
| `write:bespoke-finance` | accounting | participant remittance reconciliation, facultative settlements |

The System Administrator holds all of them. Facultative binders are arranged with `write:reinsurance` (Processing Team).

## Files

| File | What it does |
|---|---|
| `router.js` | Mounts the routers below under `/bespoke/...`. |
| `clauses.js` | Clause library (`clause_library`, `clause_versions`) and slip templates (`slip_templates`, `slip_template_clauses`); placeholders. |
| `composer.js` | Composed slips (`CSL-`): blank or from a template, library or manuscript clauses, versions with snapshots. |
| `diff.js` | Differences between two versions of a slip (sections, clauses, values) with a word diff. |
| `printing.js` | Composed slip PDF and the composed wording added to the Broker Slip / Placement Slip prints. |
| `composerRouter.js` | `/bespoke/clauses`, `/bespoke/slip-templates`, `/bespoke/slips`. |
| `room.js` | Underwriter rooms (`UWR-`): invitations, statement of values, attachments, bid rounds (`BID-`), messages, timeline, external link, award. |
| `roomRouter.js` | `/bespoke/rooms` and the public `/bespoke/underwriter-link`. |

## 1. Clause library and slip composer

A clause has a type (`bespoke.clause_types`: clause, warranty, exclusion, endorsement, condition, deductible,
subjectivity), the lines of business it applies to (empty: all) and versioned wording. A new wording is a new version
effective from a date; the previous version ends the day before, so `GET /bespoke/clauses?date=` shows the wording in
force on any date. Placeholders are the `{name}` tokens of the wording; `bespoke.placeholders` lists the ones the editor
offers. Migration `0200` ships Philippine market clauses (typhoon / flood and earthquake / volcanic eruption deductibles,
SRCC, 72-hour clause, sprinkler leakage, fire extinguisher warranty, ICC A / B / C, CAR maintenance period, cyber
exclusion, premium payment warranty, survey subjectivity, mortgagee clause) and three templates; review the wording
before use.

A composed slip belongs to a Request for Quotation (broker slip) or a placement slip. It starts blank (the standard
sections of `bespoke.slip_sections`) or from a template, then clauses are added from the library, removed, reordered
or reworded for this slip only (manuscript: the slip keeps the library clause and version it came from, and shows
whether the text differs). Placeholder values come from the linked broker slip / placement (insured, sum insured,
currency, period, situation, premium) and can be overridden on the slip. Every save that changes something is a new
version with a snapshot, the list of changes and the user; `GET /bespoke/slips/:id/diff?from=&to=` compares any two.
Statuses: `draft`, `final` (no edits; reopen makes it a draft again), `cancelled`.

Prints: `GET /bespoke/slips/:id/pdf` (letterhead, sections, clauses grouped by type). The standard Broker Slip and
Placement Slip PDFs print the wording of the latest composed slip of that broker slip / placement.

## 2. Underwriter room

A room (`UWR-`, tables `uw_*`, migration `0202`) belongs to a Request for Quotation or a placement slip; the insurers of
the broker slip are invited by default and the latest composed slip is the wording shared. What happens in it:

- **Statement of values**: `POST /bespoke/rooms/:id/sov` (XLSX or CSV, one row per location). Headings are matched
  through `bespoke.sov_columns`; values are totalled per location and for the room; a given total that differs from
  the sum of its values is a warning. Each upload is a version; the file is kept as an attachment.
- **Attachments**: loss runs, surveys, slips (`shared` shows them to the underwriters).
- **Bids**: `bids/request` opens a round (a new round when the current one already has answers); a bid is
  `requested`, `quoted` (premium for 100%, rate, line %, deductibles, deviations from the slip, validity: default
  `bespoke.bid_validity_days`), `countered` (the broker's counter-offer asks the insurer again in the next round),
  `accepted` (for a share up to the line offered), `declined` or `withdrawn`. The comparison ranks the latest bid of
  each insurer by premium.
- **Messages** to one underwriter or all of them, and internal notes; **timeline** (`uw_events`) of every action by the
  broker, the underwriters and the system.
- **External link**: `POST /bespoke/rooms/:id/insurers/:insurerId/link` signs a token for one invited insurer (valid
  `bespoke.underwriter_link_ttl_hours`; a new link replaces the old one; e-mail template
  `email.template.underwriter_room_invite`). The public page `/underwriter-room?token=` calls
  `/bespoke/underwriter-link/view | bid | message` without signing in.
- **Award**: the accepted bids (shares must total 100%) become the insurer offers of the broker slip and then the
  Quotation Slip (`prepareQuotation`) or the Placement Slip (`createPlacement`) of the placement journey.

## Debugging

- A clause wording change is refused: the new version must start after the current version's effective date.
- A placeholder prints as `[name]`: no value on the slip and none derived from the broker slip / placement
  (`missingPlaceholders` on `GET /bespoke/slips/:id` lists them).
- A save returns "No changes to save": the composer sent the same state; no version is written.
- An underwriter link answers "replaced by a newer one": a later link was issued for that insurer (only the latest works);
  "withdrawn": the insurer was removed from the room; links stop working when the room is closed.
- The award is refused: the accepted shares do not total 100%, or the Request for Quotation is closed or cancelled.
