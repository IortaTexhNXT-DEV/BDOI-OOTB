# Persona access (step 21)

> Roles renamed since this run (broker terminology, migration 0140): underwriting -> processing (Processing Team),
> customer-services -> operations, finance -> accounting, finance-manager -> accounting-manager; it-admin, ba and
> user-access-admin merged into system-admin; the agent login role withdrawn (its users are Sales & Marketing). The
> Underwriting Dashboard is now the Processing Dashboard (/processing/dashboard). The results below are as recorded.

| User | Persona | Menu shown | Forbidden screen | Blocked | Forbidden API call | Status |
|---|---|---|---|---|---|---|
| bea.admin | Business Administrator | Dashboard, Product Configurator, Master, Operations, Accounts, Commission, Reinsurance, Reports | - | - | - | - |
| maria.sales | Sales / Relationship Manager | Dashboard, Product Configurator, Operations, Commission, Reports | /accounts/journalvoucher | yes | POST /journal-vouchers | 403 |
| ramon.agent | Agent / Referrer | Dashboard, Operations, Commission | /accounts/receipts | yes | GET /receipts | 403 |
| jose.uw | Underwriter | Dashboard, Product Configurator, Operations, Reinsurance, Reports | /accounts/paymentvoucher | yes | POST /journal-vouchers | 403 |
| ana.cs | Customer Services | Dashboard, Product Configurator, Operations, Reports | /master/configuration/settings | yes | POST /journal-vouchers | 403 |
| carlo.claims | Claims Officer | Dashboard, Operations, Reinsurance, Reports | /accounts/paymentvoucher | yes | POST /disbursements | 403 |
| liza.finance | Finance / Accounts | Dashboard, Operations, Accounts, Commission, Reinsurance, Reports | /master/configuration/settings | yes | POST /users | 403 |
| carmela.morfe | User Access Administrator | Master | /accounts/receipts | yes | GET /policies | 403 |
