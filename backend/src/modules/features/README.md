# Features and releases

The functions of the platform by release tier, the entitlements of this environment and their enabling by the iorta
TechNXT platform administrator and, for Phase 2, by the enablers of TISPH (SUPERID by default). Routes are under
`/features` (the tenant) and `/platform` (the vendor). How a screen registers its feature:
`docs/developer-guide/features.md`.

## Files

| File | What it does |
|---|---|
| `catalogue.js` | The catalogue: every feature with its tier (`PHASE_1`, `PLATFORM`, `PHASE_2`, `FUTURE`), requirement ids, dependencies, the decision of TISPH (`decision`: id FT-Dnn, question, options and, once answered, `decided`), and what it controls (menus, routes, API paths, jobs, connectors, settings, sections, manual sections, reports, data tables, permissions). `catalogueProblems()` checks it, including that a decided answer is one of the options and matches the tier. |
| `tenant.js` | Enabling of Phase 2 by TISPH: the permission `enable:phase2-features`, the policy read from the settings `features.tenant_enable_*`, the middleware of the tenant routes, the check of the tiers of a plan and the validation of the settings. |
| `service.js` | State of the environment (cached per instance for `FEATURE_STATE_TTL_SECONDS`, default 15), signatures, the checks used by the rest of the system (`assertFeature`, `jobAllowed`, `connectorAllowed`, `reportAllowed`, `assertSettingsAllowed`), the impact preview, change requests and decisions of both channels (`platform`, `tenant`), scheduled changes, notices, promotion between environments. |
| `gate.js` | API gate mounted on `/api` before every module (`src/app.js`): 403 `FEATURE_NOT_ENABLED` or `FEATURE_READ_ONLY`. |
| `router.js` | Routes of both screens. |

## State

- Phase 1 and platform features are always on and have no row.
- A Phase 2 or future-release feature is on (`enabled`) or read-only (`read_only`) only while `feature_entitlements`
  holds a row whose effective date has come and whose signature is valid: HMAC-SHA256 with `ENTITLEMENT_SIGNING_KEY`
  over the key, status, effective date and change id. No row means off.
- A row edited outside an approved change (no valid signature) counts as off, is recorded once on the audit trail
  (`feature` / `signature-invalid`) and notified to the platform administrators; their screen marks it **Not trusted**.
- Read-only: a feature disabled while one of its `data` tables holds records keeps its menus and its reads (view and
  export); every change is refused with `FEATURE_READ_ONLY`, its jobs do not run and its connectors hold.
- Each environment keeps its own state. `GET /platform/features/export` gives it as JSON; `POST /platform/features/promote`
  with that file raises the change requests that bring another environment to it, still waiting for approval. The
  configuration workbook of the go-live workbench carries a sheet **Feature Entitlements**: the comparison of
  environments shows the differences; a different status is never loaded from the workbook.

## Who

- `iorta-platform-admin` (migration 0550) is the only role with `manage:feature-entitlements` (`src/lib/platform.js`).
  The permission is never offered on Role Permissions, never granted to a tenant role (the seed removes any such grant),
  and the administrator role of the tenant does not pass `requirePlatformAdmin`. The role is not assigned from User
  Management or the workbook; a platform account is changed only by a platform administrator; two-factor
  authentication is always required. The role holds no business permission.
- The first account comes from the environment only: `PLATFORM_ADMIN_EMAIL` (also the user name) and
  `PLATFORM_ADMIN_PASSWORD`; without both, none is created (`seedPlatformAdmin` in `src/db/seed.js`). The second one
  (the approver) is added on the platform screen with a temporary password.
- `read:features` (TIS IT AppSupport / Admin, General Manager, the System Administrator, SUPERID): the read-only catalogue.

## Enabling of Phase 2 by TISPH

TISPH decided on 11 October 2026 that fixed assets (FT-D01, with the asset master at requisition,
MOM-S5-AP-ASSET-MASTER) and the sales dashboard (FT-D02) are Phase 2, enabled by the SUPERID role. Besides the platform
administrator, a user of the tenant therefore requests, approves and withdraws the enabling and disabling of Phase 2
functions on Master > System Configuration > Features & Releases (`tenant.js`, migration 0597):

- **Who**: a user who holds `enable:phase2-features` through one of its roles and one of the roles of
  `features.tenant_enable_roles`. The administrator's bypass of `requirePermission` does not count: the System
  Administrator holds every tenant permission but is not an enabler unless its role is in the setting. The platform role
  is never an enabler of the tenant (it uses `/platform`).
- **What**: the features of the tiers of `features.tenant_enable_tiers`. Only `PHASE_2` may be listed: future releases
  are always the platform administrator's, and a plan that reaches a future release (through a dependency or a
  dependent) is refused as a whole with `FEATURE_TIER_NOT_ALLOWED`. An empty list switches the enabling by TISPH off
  (`TENANT_ENABLING_OFF`).
- **Approval**: `features.tenant_enable_approval`. `four-eyes` (default): a second enabler of the tenant or a platform
  administrator approves; the requester never does. `single`: the request is approved by its requester at once and
  recorded with approval `single`; for a development environment only, it falls back to `four-eyes` on a database
  marked `production` (`system.environment`). An enabler of the tenant decides and withdraws only the changes of the
  tenant (`PLATFORM_CHANGE` otherwise); a platform administrator decides both.
- **Controls kept**: the same `service.js` functions as the platform screen: impact preview, dependencies, reason
  (context `feature_change`, e.g. `FTR-DECISION` Decision of TISPH) and release reference, effective date, signed
  entitlements, read-only on a disable with records, audit trail (`feature_change` request / approve / reject /
  withdraw; `feature` enable / read-only / disable with `by: tenant` and the screen of the tenant), notices to the other
  enablers and the platform administrators on a request, and to `features.notify_roles` when a change applies.
  Catalogue rows enabled by a change of the tenant show the approver as **Enabled By**.
- **Go-live**: SUPERID is for UAT and set inactive before go-live; an inactive role gives no permission, so in
  Production the platform administrator stays the enabler, unless TISPH names another role in
  `features.tenant_enable_roles` and grants it `enable:phase2-features` on Role Permissions (with its maker-checker).

| Setting | Default | Meaning |
|---|---|---|
| `features.tenant_enable_roles` | `["tis-superid"]` | Roles whose holders of `enable:phase2-features` enable Phase 2 (never `iorta-platform-admin`) |
| `features.tenant_enable_tiers` | `["PHASE_2"]` | Tiers TISPH switches itself: `PHASE_2` or nothing |
| `features.tenant_enable_approval` | `"four-eyes"` | `four-eyes` or `single` (development only; ignored in production) |

The values are checked on Master > Configuration and in the configuration workbook (`tenantSettingErrors`, called from
`localizationErrors` of `system-settings/service.js`).

## Routes

| Route | Permission | What |
|---|---|---|
| `GET /features/state` | signed in | Features not plainly on, with the menu entries and addresses they hide (menus, route guard, sections) |
| `GET /features/catalogue`, `/catalogue/export` | `read:features` | Catalogue with tier, status, requirement ids, enabled date, enabled by, release reference; Excel with the future releases |
| `GET /features/enabling` | `read:features` | Whether the user enables Phase 2 for TISPH, with the policy in force (roles, tiers, approval) |
| `POST /features/preview` | enabler of the tenant | Impact preview of a Phase 2 change (as `/platform/features/preview`); a future release is refused |
| `GET/POST /features/changes` | enabler of the tenant | Change requests (both channels, with `channel`); a request of the tenant within its tiers |
| `POST /features/changes/:id/decision` | enabler of the tenant, never the requester | Approve or reject a change of the tenant |
| `POST /features/changes/:id/withdraw` | the requester; an enabler for a scheduled change | Withdraw a change of the tenant |
| `GET /platform/features` | platform administrator | The catalogue with what each feature controls |
| `POST /platform/features/preview` | platform administrator | Impact of `{ action, features | tier }`: features with dependencies and dependents, read-only where records exist, menus, roles that gain access, jobs, connectors, settings to configure, sections |
| `GET/POST /platform/features/changes` | platform administrator | Change requests; a request needs `reasonCode` (context `feature_change`), `releaseRef` and `effective` (`immediate` or `scheduled` with `effectiveAt`) |
| `POST /platform/features/changes/:id/decision` | platform administrator, never the requester | Approve (immediate: applied at once; scheduled: applied on its date) or reject with a reason (context `feature_reject`); also a change of the tenant |
| `POST /platform/features/changes/:id/withdraw` | the requester; anyone for a scheduled change | Withdraw |
| `GET /platform/features/export`, `POST /platform/features/promote` | platform administrator | Promotion between environments |
| `GET/POST /platform/admins` | platform administrator | Platform administrator accounts |

An applied change writes `feature` audit entries (`enable`, `read-only`, `disable`) and tells the roles of the setting
`features.notify_roles` (TIS IT AppSupport / Admin and the General Manager) by notification and e-mail.

## Tables

`feature_entitlements`, `feature_changes` (migration 0550; `channel` platform / tenant and `approval` four-eyes /
single, migration 0597). Reasons: seed `93_feature_reasons.sql`.
