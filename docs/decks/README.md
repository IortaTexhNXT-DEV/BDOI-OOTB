# BrokerVerse persona guides

One PowerPoint deck (16:9, iorta TechNXT theme) per persona. Each deck explains the out-of-the-box BrokerVerse
insurance-broking platform for the BDO Insure (BDOI) Philippine market from that persona's point of view. It
covers the role, the exact menu map, the key functions with screens, the persona's part of the end-to-end flow,
reports, schedules, notifications, known limitations and tips.

| Deck | Persona (users) | Role code | Slides |
|---|---|---|---|
| [BrokerVerse_IT_Administrator_Guide.pptx](BrokerVerse_IT_Administrator_Guide.pptx) | IT Administrator (BrokerVerse) | it-admin | 18 |
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
- Flows and the money trail: `docs/e2e/E2E_REPORT.md`. Open items: `docs/e2e/DEFECTS.md`, in neutral wording
- API: `backend/docs/api` (Postman collection, OpenAPI, touchpoints workbook)

## Screens

Captions say where each screen comes from:

- **"Live screen … signed in as <user>"**: captured on a private copy of the database, signed in as that
  persona.
- **"Screen from the recorded end-to-end run"**: reused from `docs/e2e/evidence`.
- **"Same screen as the access administrator sees (captured as BrokerVerse)"**: the User Access Administrator
  deck shows the User, Role and Audit Trail screens captured as BrokerVerse.
- **"Step by step"** panels in the Agent deck take the place of screens that could not be captured.

## Rebuilding

```bash
# 1. capture screens against your own stack (passwords from the environment only)
PERSONA_PASSWORD=... ADMIN_PASSWORD=... python3 docs/decks/tools/capture_screens.py /tmp/deckshots docs/decks/tools/screens.json
# 2. build the decks (python-pptx)
python3 docs/decks/tools/build_decks.py --shots /tmp/deckshots
```

The deck content lives in `tools/personas.py`, and the layout and theme are in `tools/build_decks.py`. The
support contact on the closing slide is a placeholder until BDOI confirms it.
