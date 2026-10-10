# Features and releases

The functions of the platform by release tier, the entitlements of this environment and their enabling by the iorta
TechNXT platform administrator. Routes are under `/features` (the tenant) and `/platform` (the vendor). How a screen
registers its feature: `docs/developer-guide/features.md`.

## Files

| File | What it does |
|---|---|
| `catalogue.js` | The catalogue: every feature with its tier (`PHASE_1`, `PLATFORM`, `PHASE_2`, `FUTURE`), requirement ids, dependencies, the decision TISPH still has to take, and what it controls (menus, routes, API paths, jobs, connectors, settings, sections, manual sections, reports, data tables, permissions). `catalogueProblems()` checks it. |
| `service.js` | State of the environment (cached per instance for `FEATURE_STATE_TTL_SECONDS`, default 15), signatures, the checks used by the rest of the system (`assertFeature`, `jobAllowed`, `connectorAllowed`, `reportAllowed`, `assertSettingsAllowed`), the impact preview, change requests and decisions, scheduled changes, notices, promotion between environments. |
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
- `read:features` (TIS IT AppSupport / Admin, General Manager, the System Administrator): the read-only catalogue.

## Routes

| Route | Permission | What |
|---|---|---|
| `GET /features/state` | signed in | Features not plainly on, with the menu entries and addresses they hide (menus, route guard, sections) |
| `GET /features/catalogue`, `/catalogue/export` | `read:features` | Catalogue with tier, status, requirement ids, enabled date, enabled by, release reference; Excel with the future releases |
| `GET /platform/features` | platform administrator | The catalogue with what each feature controls |
| `POST /platform/features/preview` | platform administrator | Impact of `{ action, features | tier }`: features with dependencies and dependents, read-only where records exist, menus, roles that gain access, jobs, connectors, settings to configure, sections |
| `GET/POST /platform/features/changes` | platform administrator | Change requests; a request needs `reasonCode` (context `feature_change`), `releaseRef` and `effective` (`immediate` or `scheduled` with `effectiveAt`) |
| `POST /platform/features/changes/:id/decision` | platform administrator, never the requester | Approve (immediate: applied at once; scheduled: applied on its date) or reject with a reason (context `feature_reject`) |
| `POST /platform/features/changes/:id/withdraw` | the requester; anyone for a scheduled change | Withdraw |
| `GET /platform/features/export`, `POST /platform/features/promote` | platform administrator | Promotion between environments |
| `GET/POST /platform/admins` | platform administrator | Platform administrator accounts |

An applied change writes `feature` audit entries (`enable`, `read-only`, `disable`) and tells the roles of the setting
`features.notify_roles` (TIS IT AppSupport / Admin and the General Manager) by notification and e-mail.

## Tables

`feature_entitlements`, `feature_changes` (migration 0550). Reasons: seed `93_feature_reasons.sql`.
