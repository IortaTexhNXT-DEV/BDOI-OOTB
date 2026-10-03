# BrokerVerse role guides

One PowerPoint deck (16:9, iorta TechNXT theme) for each of the seven roles of the broker role model. Each deck
explains BrokerVerse, the out-of-the-box insurance broking platform from iorta TechNXT for the Philippine market,
from that role's point of view. It covers the role, the exact menu map, the key functions with screens, the role's
part of the end-to-end flow, reports, schedules, notifications, known limitations and tips.

| Deck | Role (sample users) | Role code | Slides |
|---|---|---|---|
| [BrokerVerse_System_Administrator_Guide.pptx](BrokerVerse_System_Administrator_Guide.pptx) | System Administrator, Super Admin Access (bea.admin) | system-admin | 22 |
| [BrokerVerse_Sales_and_Marketing_Guide.pptx](BrokerVerse_Sales_and_Marketing_Guide.pptx) | Sales & Marketing, Account Executive (maria.sales) | sales | 18 |
| [BrokerVerse_Processing_Team_Guide.pptx](BrokerVerse_Processing_Team_Guide.pptx) | Processing Team, Placement & Policy Processing (jose.uw) | processing | 22 |
| [BrokerVerse_Operations_Guide.pptx](BrokerVerse_Operations_Guide.pptx) | Operations, Client Servicing (ana.cs) | operations | 19 |
| [BrokerVerse_Claims_Guide.pptx](BrokerVerse_Claims_Guide.pptx) | Claims (carlo.claims, lisa.claims2) | claims | 18 |
| [BrokerVerse_Accounting_Guide.pptx](BrokerVerse_Accounting_Guide.pptx) | Accounting (liza.finance; fe.approver and fin.approver as second users) | accounting | 22 |
| [BrokerVerse_Accounting_Manager_Guide.pptx](BrokerVerse_Accounting_Manager_Guide.pptx) | Accounting Manager (acct.manager), inherits Accounting | accounting-manager | 19 |

The System Administrator replaces the IT, Business and User Access administrators. The Agent / Referrer login is
withdrawn: referrers do not sign in, Sales & Marketing enters their business and they are paid from the referrer
master. The decks of those retired roles have been removed.

What the decks cover beyond the daily screens:

- Placement: Broker Slips, offer comparison, Quotation Slips, Placement Slips, direct placement, Record Issued Policy,
  the motor quotation that goes straight to policy, and the placement journey per line (Processing Team).
- Co-insurance participants: shares, the lead insurer and the split of premium, commission, remittance and claims
  (Processing Team, Accounting, Claims, Sales & Marketing).
- Document numbering, posting rules and account determination (System Administrator), and what each operational event
  posts to the ledger (Accounting).
- Month-end and year-end close, period control and bank reconciliation, prepared by Accounting and approved by the
  Accounting Manager.

## Sources

- Menus: `brokerverse/src/utils/menuPermissions.js` and `brokerverse/src/components/SideBar/list.js`
- Roles, names and inheritance: migrations `0115_role_inheritance.sql` and `0140_broker_roles.sql`
- Reports and the roles that can run them: `report_definitions` (39 reports)
- Schedules: `backend/src/db/seeds/jobs.json` and Master > Schedules (15 jobs). Business rules: Master > Configuration
- Screens opened per role: `docs/e2e/ROLE_WALK.md`
- Flows, rules and known limitations: the user manual (`docs/manual/tools/manual_source.md`, Appendix G)
- API: `backend/docs/api` (Postman collection, OpenAPI, touchpoints workbook)

## Screens

Every screen in the decks is a user manual screenshot (`docs/manual/images`, referenced as `manual:<name>` in
`tools/personas.py`), taken from the rebranded system with the sample data on 29 September 2026. Each caption names
the screen and the role the screen was captured with, read from `docs/manual/tools/scenes.py`. Some screens of a
deck were captured with another role that opens the same screen, and the caption says so. Screens of the Accounting
Manager were captured with the manual's Accounting Manager user.

`tools/capture_screens.py` and `tools/screens.json` can add live screens per role (read-only: the script only opens
screens). Reference them in `personas.py` as `<user>__<name>.png` and pass `--shots`.

## Rebuilding

```bash
# 1. retake the user manual screenshots first if the screens changed (docs/manual/README.md)
# 2. build the decks (python-pptx, Pillow)
python3 docs/decks/tools/build_decks.py
# 3. check the wording (stock words, long dashes, emojis, names)
python3 docs/manual/tools/style_scan.py docs/decks docs/decks/tools/personas.py
```

Optional live screens: `WEB_BASE=... PERSONA_PASSWORD=... python3 docs/decks/tools/capture_screens.py /tmp/deckshots
docs/decks/tools/screens.json`, then `build_decks.py --shots /tmp/deckshots`. Passwords come from the environment only.

The deck content lives in `tools/personas.py`, and the layout and theme are in `tools/build_decks.py`. The closing
slide gives the support levels of the user manual (Appendix H).
