# Talkbot call lists

Talkbot, the outbound calling service of TIS Sales, calls Motor clients before their policy expires and asks whether
they will renew (TIS-BRD-LEAD-09, CR-02, FRS LEAD-09). Talkbot is not connected to BrokerVerse: files move by hand.
Routes are under `/talkbot` (Operations > Renewals > Talkbot Calls, `/renewal/talkbot`).

Permissions: `read:talkbot-calls` opens the call lists and shows the Talkbot outcome on Renewal Queue and Renewal Batch;
`write:talkbot-calls` creates, downloads, sends, cancels and closes lists, uploads the call results and records
outcomes. Create renewal batch also needs `write:renewals`. TISPH grants (migration 0460, `seed.js`): the Sales personas
and the General Manager maintain the lists; the Operations personas view them and create the renewal batch.

## Files

| File | What it does |
|---|---|
| `router.js` | Options, preview, lists, lines (remove, put back, attempts, outcome), download, send, cancel, close, results upload and template, uploads, renewal batches. |
| `service.js` | Call lists: default expiry window on the working calendar, eligibility rules, creation, removal of accounts, the Contact Import file, Mark as sent, cancel / close, renewal batches of the confirmed accounts, the two daily jobs. |
| `results.js` | Call records upload: header check, matching by Contact ID then Contact Number, Call ID loaded once, outcome derivation, manual outcome, the Talkbot Call activity on the renewal timeline, the uploaded files. |
| `outcomes.js` | The outcome rules (setting `talkbot.outcome_rules`) and the derivation of one outcome per account from its attempts. |
| `status.js` | The latest Talkbot outcome of policies and the Talkbot confirmation, read by Renewal Batch, Generate Renewal Quotes and Renewal Queue. |
| `columns.js` | The 13 columns read from the Call Records export (upload and template). |

## Main tables

`talkbot_call_lists` (TCL-yyyy-nnnnn, status draft, sent, results-loaded, closed, cancelled), `talkbot_call_lines`
(one per policy: contact data of the file, removal, outcome, renewal batch and quote), `talkbot_call_uploads` (the file
kept with the list), `talkbot_call_attempts` (one row of a call records file, unique Call ID).
`renewal_batch_policies.quote_status` has the value `Skipped` with `skip_reason`.

## Rules

- Eligibility (creation and again at download): Motor, renewable (due; with expired policies the grace period and lapsed
  renewable ones), no renewal already quoted, not under lock-in (`details.lockIn` / `details.scheme2` of the policy until
  the lock-in record of SCHM-03 exists), marketing calls not refused (latest marketing consent), not on another open list
  or confirmed within `talkbot.confirmation_valid_days`, not called `talkbot.max_lists_per_policy` times without being
  reached, an 11-digit mobile number (09..., +639 converted).
- Default expiry dates: today + `talkbot.days_before_expiry`; on the last working day before days off (weekends and
  national holidays of the Holiday master, `lib/workingCalendar.js`) up to the dates of the next working day's list.
- Contact Import: sheet Contact Import, the Talkbot notes on row 1, 12 headers on row 2 (required ones in red), cells of at
  most 200 characters; Sum_Insured_AMOUNT = expiring sum insured less `talkbot.sum_insured_depreciation_pct`, Premium_AMOUNT
  = the renewal rating of that sum insured (renewals `rate()`), both in whole pesos.
- Outcome of an account: the best-ranked attempt under the rules; a manual outcome stays until an attempt of a better rank
  is loaded. A changed outcome adds a Talkbot Call activity to the renewal (opened when there is none); Call back with a
  Date of Callback becomes the follow-up date.
- Generate Renewal Quotes (`renewals/batches.js`): with `talkbot.bulk_quote_filter` on, a Motor policy not confirmed by
  Talkbot (or confirmed longer ago than `talkbot.confirmation_valid_days`) is Skipped with the reason; other lines are
  quoted as before. A single renewal from Renewal Policy is not affected.

## Jobs

`talkbot-call-list` (working days 06:10, delivered off): the Draft list of the day. `talkbot-call-list-close` (daily
01:50): closes lists `talkbot.auto_close_days` after their last upload and removes call records files older than
`talkbot.file_retention_days`.

## Audit

Entities `talkbot_call_list` (create, download with the rows, mark-sent, upload-results with the counts, cancel, close,
create-renewal-batch) and `talkbot_call_line` (remove, restore, record-outcome with the old and the new outcome).
