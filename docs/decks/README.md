# BrokerVerse persona guides

One PowerPoint deck (16:9, iorta TechNXT theme) per persona. Each deck explains BrokerVerse, the out-of-the-box
insurance-broking platform from iorta TechNXT for the Philippine market, from that persona's point of view. It
covers the role, the exact menu map, the key functions with screens, the persona's part of the end-to-end flow,
reports, schedules, notifications, known limitations and tips.

| Deck | Persona (users) | Role code | Slides |
|---|---|---|---|
| [BrokerVerse_IT_Administrator_Guide.pptx](BrokerVerse_IT_Administrator_Guide.pptx) | IT Administrator (BrokerVerse) | it-admin | 19 |
| [BrokerVerse_Business_Administrator_Guide.pptx](BrokerVerse_Business_Administrator_Guide.pptx) | Business Administrator (bea.admin) | ba | 17 |
| [BrokerVerse_Sales_Relationship_Manager_Guide.pptx](BrokerVerse_Sales_Relationship_Manager_Guide.pptx) | Sales / Relationship Manager (maria.sales) | sales | 16 |
| [BrokerVerse_Agent_Referrer_Guide.pptx](BrokerVerse_Agent_Referrer_Guide.pptx) | Agent / Referrer (ramon.agent) | agent | 15 |
| [BrokerVerse_Underwriter_Guide.pptx](BrokerVerse_Underwriter_Guide.pptx) | Underwriter (jose.uw) | underwriting | 17 |
| [BrokerVerse_Customer_Services_Guide.pptx](BrokerVerse_Customer_Services_Guide.pptx) | Customer Services (ana.cs) | customer-services | 16 |
| [BrokerVerse_Claims_Officer_Guide.pptx](BrokerVerse_Claims_Officer_Guide.pptx) | Claims Officer (carlo.claims, lisa.claims2) | claims | 16 |
| [BrokerVerse_Finance_Accounts_Guide.pptx](BrokerVerse_Finance_Accounts_Guide.pptx) | Finance / Accounts (liza.finance, fe.approver) | finance | 17 |
| [BrokerVerse_User_Access_Administrator_Guide.pptx](BrokerVerse_User_Access_Administrator_Guide.pptx) | User Access Administrator (carmela.morfe) | user-access-admin | 15 |

## Sources

- Menus: `brokerverse/src/utils/menuPermissions.js` and `brokerverse/src/components/SideBar/list.js`
- Reports and the roles that can see them: `report_definitions` (`backend/src/db/seeds/60_reports.sql`)
- Schedules: `backend/src/db/seeds/jobs.json`. Business rules: `app_settings` (Master > Configuration)
- Flows and the money trail: `docs/e2e/E2E_REPORT.md`. Known limitations: user manual, Appendix G (every item of
  `docs/e2e/DEFECTS.md` is fixed)
- API: `backend/docs/api` (Postman collection, OpenAPI, touchpoints workbook)

## Screens

All screens are live screens of the rebranded system (BrokerVerse name, iorta TechNXT logo) with the sample data,
captured on 29 September 2026. Captions say where each screen comes from:

- **"Live screen … signed in as <user>"**: captured signed in as that persona, either by
  `tools/capture_screens.py` (screens opened by address) or taken from the user manual's screenshots
  (`docs/manual/images`, referenced as `manual:<name>` in `tools/personas.py`) for screens that need clicks:
  dialogs, the quotation wizard, report preview, account actions.
- **"Live screen — sign-in, …"**: the sign-in security screens of the user manual (example values, nothing sent to
  the server).

## Rebuilding

```bash
# 1. retake the user manual screenshots first if the screens changed (docs/manual/README.md)
# 2. capture the persona screens (passwords from the environment only; read-only)
WEB_BASE=http://127.0.0.1:5080 PERSONA_PASSWORD=... ADMIN_PASSWORD=... \
    python3 docs/decks/tools/capture_screens.py /tmp/deckshots docs/decks/tools/screens.json
# 3. build the decks (python-pptx)
python3 docs/decks/tools/build_decks.py --shots /tmp/deckshots
```

The deck content lives in `tools/personas.py`, and the layout and theme are in `tools/build_decks.py`. The
support contacts on the closing slide are placeholders until the service desk is confirmed.
