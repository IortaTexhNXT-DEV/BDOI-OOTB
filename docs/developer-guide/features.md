# Features and release tiers

Every function of the TISPH build belongs to a feature of the catalogue, and every feature to a release tier. The
tier decides whether the function runs in an environment; nothing is switched off through menus or settings any more.

| Tier | Meaning | State |
|---|---|---|
| `PHASE_1` | Core TISPH scope (BRD v2.2, FRS) | Always on; cannot be switched off from the tenant |
| `PLATFORM` | Supporting functions: users and roles, configuration, audit, jobs, organisation masters | Always on |
| `PHASE_2` | Built, delivered off | Enabled by the iorta TechNXT platform administrator ("Enable Phase 2") or by the enablers of TISPH (SUPERID by default) |
| `FUTURE` | In the platform but outside the BRD and FRS | Off until enabled for a later release |

The catalogue is code: `backend/src/modules/features/catalogue.js`. The state of an environment is the table
`feature_entitlements` (migration 0550), changed only through an approved change request: by two platform
administrators (maker-checker) on Master > Platform > Features & Releases, or, for Phase 2, by an enabler of TISPH on
Master > System Configuration > Features & Releases approved by a second enabler or a platform administrator
(`modules/features/tenant.js`, migration 0597; settings `features.tenant_enable_roles`, `features.tenant_enable_tiers`,
`features.tenant_enable_approval`). See `backend/src/modules/features/README.md` for the API, the signature and the
enabling flow.

## Decisions of TISPH

A feature whose release TISPH has to confirm carries a `decision` (`id` FT-Dnn of the feature catalogue document,
`question`, `options`). The screens flag it **Decision pending** until the answer is recorded in the catalogue as
`decided: { answer, by, on, note }`; the answer must be one of the options and match the tier (`catalogueProblems()`).

| ID | Feature | Decision |
|---|---|---|
| FT-D01 | Fixed assets (with the asset master at requisition, MOM-S5-AP-ASSET-MASTER) | Phase 2, decided by TISPH on 11 October 2026; enabled by SUPERID or the platform administrator |
| FT-D02 | Sales dashboard | Phase 2, decided by TISPH on 11 October 2026; enabled by SUPERID or the platform administrator |

The other decisions (FT-D03 to FT-D16, future releases) are still pending.

## Registering a new screen

A new screen of a TISPH requirement is Phase 1: add its menu entry to the feature of its module.

1. Add the entry to the menu (`brokerverse/src/components/SideBar/list.js`) and grant it to the roles
   (`brokerverse/src/utils/menuPermissions.js`) as usual.
2. In `backend/src/modules/features/catalogue.js`, add the menu path to `menus` of the feature of the module, written
   as the names of the menu from the top-level group down:

   ```js
   feature({
     key: 'receipts', name: 'Receipts and post-dated cheques', module: 'Accounts', tier: P1,
     ...
     menus: ['Accounts > Receipts', 'Accounts > Post-Dated Cheques', 'Accounts > Receipt Batches'],
   }),
   ```

3. Run `npx vitest run test/feature-entitlements.test.js` in `backend/`. The test "maps every menu entry of the front end
   to exactly one feature" names every entry without a feature and every entry registered twice.

Until the catalogue lists it, a new entry is shown (a menu entry of no feature counts as on), so a stream that merges
a screen without registering it breaks only the test, never the screen.

A screen of a new module gets a feature of its own: `key` (lower case with dashes, never renamed: entitlements and
manual marks refer to it), `name` and `description` in business words, `module` (the menu area), `tier`,
`requirements` (requirement ids only) and `dependsOn` (features it cannot work without).

## Functions outside the BRD and FRS

A function that is not in scope is a `FUTURE` feature (a Phase 2 requirement is `PHASE_2`). List everything it
controls, so that switching it off leaves nothing behind:

| Control | What the system does while the feature is off |
|---|---|
| `menus` | The entries leave the side menu; their addresses open "Not available in this edition" |
| `routes` | Other addresses (wizard steps, public pages) open "Not available in this edition" |
| `api` | API paths answer 403 `FEATURE_NOT_ENABLED` (`modules/features/gate.js`); a read-only feature refuses changes with `FEATURE_READ_ONLY`. Patterns match whole segments, `*` is one segment, a trailing `$` asks for the exact path. List a path only when no in-scope screen calls it |
| `jobs` | The scheduler skips the job and Master > System > Schedules does not list it |
| `connectors` | The connector cannot be enabled, holds its messages and refuses inbound messages |
| `settings` | Master > Configuration refuses a change of the setting |
| `sections` | Describes the parts of in-scope screens wrapped in `<Feature name="key">` (impact preview) |
| `documents` | Manual sections (heading ids) left out of the help, the Word and the PDF manual |
| `reports` | Report codes left out of Reports > All Reports |
| `data` | Tables whose records keep the feature read-only after a disable |
| `permissions` | Permission codes used to list the roles that gain access when the feature is enabled |

A function that cannot be reached by a path alone (more than one insurer on a risk, a migration kit chosen in a form)
calls `assertFeature(key, { write: true })` from `modules/features/service.js` where the rule is applied.

## Parts of a screen

```jsx
import Feature, { useFeature } from "../../features/Feature";

<Feature name="coinsurance"><ParticipantsGrid /></Feature>          // shown while the feature is on

const eis = useFeature("bir-eis");                                   // { status, on, readOnly, visible }
{eis.visible ? <Column header={t("birTax.eisStatus")} ... /> : null}
```

Outside a component (an event handler) use `isFeatureOn(key)` from `features/entitlements.js`.

## The manual

The help build (`npm run help:build`) leaves out what belongs to the features the delivered edition does not run:
the sections of `documents`, the passages marked in a chapter, and the table rows, list items and links that only
lead to them:

```markdown
::: feature ctpl-authentication
A CTPL certificate is authenticated on [CTPL Authentication](#ctpl-authentication).
:::
```

The role facts (`npm run manual:role-facts`, on a freshly seeded database) list the menus of the enabled features.

## Tests of a feature that is off

A suite that tests a Phase 2 or future-release function enables it through the API, never by weakening a check:

```js
import { setup, enableFeatures } from './helpers.js';

beforeAll(async () => {
  ({ app, api } = await setup());
  await enableFeatures(app, ['payables']);        // or { tier: 'PHASE_2' }
});
```

`enableFeatures` signs in two platform administrators (maker and checker) and requests and approves the change.
`test/feature-tenant-enabling.test.js` covers the enabling of Phase 2 by SUPERID.
