# Broker branding and e-signatures

Version 1.4, 09 October 2026, iorta TechNXT. Changes: `BRAND_PACK` enforces the pack at every start (applied again
when the screens differ from it, the e-mail and document layouts kept) and locks the look of the screens in the API
while set; the System Settings screen is withdrawn (display currency and language are on Master > Configuration); the
side bar shows the application name under the logo only when the theme asks for it (`logo.showName`); the Toyota
Insurance Services pack adds its favicon (section 3). 1.3: the Theme and Branding screen is withdrawn; the look of an
environment comes from its brand pack (`BRAND_PACK` of the deployment, or the brand pack API), and the e-mail and
document sections of the theme and the signature mapping have their own screens under Master > System Configuration
(E-mail Layout, Documents and Reports Layout, Document Signatures); brand packs are exported, imported, enabled and
reset through the API (section 3). 1.2.2: the `BRAND_PACK` deployment variable enables a bundled pack once at start-up (section 3); the theme's font, side bar colours and marker reach every screen (section 1). 1.2.1: client brand packs are used under the client's contract with iorta TechNXT (no separate permission letter); 1.2: bundled brand packs (shipped with the product, enabled on the
screen with the trademark acknowledgement, Back to default), their support procedure in section 5. Version 1.1:
section 5, support procedures for brand pack import and e-signature revocation.

How to brand a broker's BrokerVerse environment, what changes automatically, how signatures are captured and mapped
to documents, how brand packs move branding between environments, and the trademark rule for client brand packs.

**Short answer to "if I change the logo and theme for a broker, does everything change?"** Yes. Since this release the
theme is data (setting `branding.theme`), not compiled styles. Enabling or importing a brand pack (section 3), and
saving the e-mail or document layout on Master > System Configuration, changes, for every signed-in user on their next
navigation and without a rebuild or a reload:

| Area | What follows the theme |
| --- | --- |
| Screens | Colours (primary, hover, accent, header, side bar, active menu item, table headers, buttons, links, focus ring, field borders, page background, headings), header and side bar style (white / coloured, light / dark), density (comfortable / compact), corner radius, font (safe list), logo size, the application name under the logo of the side bar (`logo.showName`: off when the logo already carries the name), the browser tab title (application name) and icon (favicon) |
| Sign-in page | Logo, application name, picture (library, own upload or colour only, focal point, darkening, shown or not on phones), headline, tagline, "Powered by" line. Applied before sign-in (public `GET /api/branding`) |
| Printed documents | Logo (primary company), legal name, TIN, IC licence, address (Master > Company); colours of titles, headings, rules and table headers; footer line (e.g. "Authorized by the Insurance Commission to act as an Insurance Broker, Licence No. {{licence}}"); signatures |
| Report files | PDF: same as documents. Excel: header row colours; optionally the logo and a company banner above the table |
| E-mails | Branded layout at send time: header band with the logo (inline image), line colour, footer line with company placeholders |

Status colours (success, warning, error) stay the same on every brand. Statutory BIR form layouts (2307 and the other
BIR returns printed from Period End) are not restyled.

## 1. Brand a broker (onboarding)

1. **Company master** (Master > Company): the primary company's legal name, TIN, IC licence number, registered address
   and print logo. These print on every document and report.
2. **Brand pack** of the environment: the theme (colours, layout, font, sign-in page, documents, e-mail), the
   application name, the logo, the favicon and the sign-in picture. A client whose pack ships with the product gets it
   from the `BRAND_PACK` variable of its deployment; any other pack is imported through the API (section 3). Build a
   pack from a folder with `build-brand-pack.js` and check it with the dry run of the import before applying it.
3. **Layout screens** (Master > System Configuration, System Administrator or IT AppSupport, `write:settings`):
   - *E-mail Layout*: layout on/off, header colours, logo, footer. **Show a sample e-mail** renders it.
   - *Documents and Reports Layout*: print colours, footer line, extra report line, logo on documents, Excel header
     colours and the optional Excel logo / banner. **Sample document** opens a PDF printed with the unsaved values.
   - *Document Signatures*: the signature mapping (section 2).
   Each screen saves its own section of the theme and keeps the rest (preset, colours, sign-in page) as the brand pack
   set it; while `BRAND_PACK` is set the API refuses a save that changes anything else (section 3). Saving is refused when text on the document table header does not reach WCAG AA (4.5:1); the e-mail header
   and the document headings give a warning.

Validation also refuses: fonts outside the safe list (Google Fonts only from `fonts.googleapis.com`, through the list),
images from other web sites (images are uploaded), SVGs with scripts, event handlers or external references, unknown
settings, and texts with `<` or `>`.

### How it works (for support)

* Backend: `backend/src/modules/branding/` (presets, schema, contrast, service, router). `GET /api/branding` is public,
  cached with an ETag (`If-None-Match` answers 304); images are served by `GET /api/branding/assets/:name?v=` (public,
  versioned, sandbox CSP).
* Front end: `brokerverse/src/theme/runtime/`: `themeEngine.js` sets the `--bv-*` CSS custom properties on `<html>`,
  `BrandingProvider.jsx` revalidates the branding on every navigation (at most every 15 s), when the tab becomes
  visible and every 5 minutes. No screen is drawn in a look that is not the environment's, also during a refresh: the
  browser keeps the last branding it received; `public/branding-boot.js` applies its colours, tab title and favicon
  before the application loads and the provider uses its logo and name at once. A browser with nothing kept (first
  visit, cleared data) shows a plain white page until `GET /api/branding` answers (at most 8 seconds). The page head
  carries no icon, title or colour of its own, and the front end never falls back to the product's default logo or
  name (the "Powered by" line of the sign-in page shows when the theme's `login.showPoweredBy` is on, as in the
  Toyota Insurance Services pack). `tokens.scss` defines the defaults (the iorta TechNXT preset, so the app looks exactly
  as before when no theme is loaded). A PostCSS step (`brokerverse/scripts/postcss-brand-vars.js`, wired in
  `craco.config.js`) turns every literal brand colour in the compiled CSS into `var(--bv-..., <same colour>)`, so screen
  stylesheets follow the theme without being edited. Older stylesheets use other blues (#0066cc, #001e60, #1976d2 ...): saturated blues are mapped
  by lightness to `--bv-alt-*` variables that only a brand theme sets, so the default theme keeps every original
  shade. The same step makes the default font named literally in screen stylesheets (`"Nunito", Arial, sans-serif`)
  follow the theme's font, and a rule of `bdoi.scss` does it for inline styles naming it. The side bar reads the
  side bar colours of the theme (`--bv-sidebar-*`); the current menu item and the active tab are marked in
  `--bv-marker` (the accent of a brand theme, the primary colour of the default). Not themed: colours written inline
  in JavaScript (chart series, a few status chips) and status colours.
* Documents: every PDF goes through `lib/pdf` `printContext()` (letterhead of the primary company + `documentBranding()`
  of the theme). A backend test fails when a module builds a PDF without it.

## 2. E-signatures

### Capture

* **Company signatories** (Master > Generals > Insurance Management > Signatories, pencil icon "E-signature",
  `write:masters`): draw on screen or upload a PNG / JPEG (up to 512 KB), choose the date it takes effect, accept the
  consent statement ("... has authorised ... and their written consent is on file"), save.
* **Users** (approvers, account executives): **My Profile > My e-signature**. Only the user can capture their own
  signature (an administrator cannot); an administrator can revoke it.
* Every capture is a new **version** with an effective period; the previous version ends the day before. Reprints of
  older documents use the version in force on the document date. **Revoke** (reason required) stops a version from
  printing on any document.
* **Storage and access**: images are kept in the uploads storage under `e-signatures/`, never through public or signed
  file links (`/api/s3/object` refuses them, also for signed links). Only `GET /api/e-signatures/:id/image` serves them:
  signatories to `write:masters`, a user's own signature to that user or an administrator; not cached.
* **Audit**: capture, replacement and revocation are in the audit trail (entity `e-signature`) with the version,
  effective dates, a SHA-256 of the image, the consent statement accepted and the IP address (never the image).
  Consent texts are settings (`signatures.consent_text_user`, `signatures.consent_text_signatory`).

### Mapping to documents

Master > System Configuration > **Document Signatures**: per document type, its slots: label, who signs (signatory chosen on
the document, a named signatory, the default signatory `documents.default_signatory`, the approving user, the issuing
user) and when it prints (once issued, once approved, always).

| Document | Default slots |
| --- | --- |
| Quotation slip (and package quotation) | For <company>: signatory chosen on the quotation; Account executive (issuing user, off by default) |
| Policy schedule (and package schedule) | For <company>: default signatory |
| Endorsement | For <company>: default signatory |
| Official receipt | Authorized signature: default signatory |
| Acknowledgement receipt | Received by: the staff member who recorded the payment |
| Payment voucher | Prepared by (issuing user), Approved by (approving user, once approved); Checked by / Received by stay blank lines |
| Commission debit note | Prepared by (issuing user), Approved by (default signatory) |
| Billing statement / invoice / statement of account | For <company>: default signatory, always |
| Journal voucher | Prepared by (issuing user), Approved by (approving user, once posted) |
| Claim settlement letter | For <company>: default signatory, once approved (`{{signature:authorized}}` in the letter template) |

A **draft** (or a document not yet approved, for slots that need approval) prints the slots with names but no image
and an **UNSIGNED DRAFT** watermark (setting `signatures.draft_watermark`); a cancelled receipt prints **CANCELLED**.
Issued documents print each signer's image with name, designation and date.

**Templates with placeholders**: a text template (claim letters in `claims.documents`; uploaded templates of
Product Configurator > Document Manager once they render placeholders) places a mapped signature with
`{{signature:<slot>}}`, e.g. `{{signature:authorized}}`. The helper for template renderers is
`renderSignatureBlock(documentType, slot, ctx)` in `backend/src/modules/e-signatures/service.js` (returns label, name,
designation, date and the image, or nothing when the slot is not mapped).

## 3. Brand packs (onboarding and promotion between environments)

A brand pack is the whole branding of an environment in one file: the theme (all sections), the application name,
the logo, the favicon, the sign-in picture and the print logo.

* **Export**: `GET /api/branding/brand-pack?format=zip` (theme.json + images) or `format=json` (images embedded).
* **Import**: `POST /api/branding/brand-pack?dryRun=true` with the file (multipart `file`) checks it first (theme rules,
  contrast, image types and SVG safety) and returns the colours and contents; the same call with `dryRun=false` saves
  it. Options (form fields): `applyDocumentLogo` (also set the print logo of the primary company, Master > Company) and
  `applySystemName` (also set the application name).
* **Promotion**: brand UAT, export the pack, import it in Production (with the configuration workbook of the go-live
  data load: the workbook carries settings and masters; the brand pack carries the branding and its images). The
  import is audited (entity `branding`, action `import`).
* **Build a pack from files**: `node backend/scripts/build-brand-pack.js <folder>` validates `<folder>/theme.json` and
  writes `<folder>/<name>.brandpack.zip`. Format: `{ "format": "brokerverse-brand-pack", "version": 1, "name", "systemName",
  "theme": { ... }, "assets": { "logo", "favicon", "loginPanel", "documentLogo" } }`.

Brand packs live in `docs/package/04_Onboarding_and_Go_Live/Brand_Packs/`.

### Bundled packs (shipped with the product)

A bundled pack is a brand pack folder delivered with the product under `backend/assets/brand-packs/<id>/`: the usual
`theme.json` and images, plus `manifest.json` with the pack's identity and trademark terms (`id`, `name`,
`description`, `trademarkOwner`, `requiresWrittenPermission`, `permissionNote`, `version`). The documentation copy in
`Brand_Packs/<id>/` and the bundled copy must be byte-identical (`backend/test/bundled-brand-packs.test.js` compares
them and checks that the built zip is in step with the folder); change the docs copy, rebuild the zip with
`build-brand-pack.js`, then copy the folder to `backend/assets/brand-packs/<id>/`.

* **Nothing is enabled by default**: a fresh database runs the iorta TechNXT default theme, name and images; the
  bundled packs are only listed. The generic seed does not name any client.
* **List**: `GET /api/branding/packs/bundled` gives each pack with its owner, description, colour preview and status
  (enabled / available), the enablement in force and the history.
* **Enable** = the import logic (`importBrandPack()`), preceded by a dry run (`POST .../bundled/<id>/check`) and by the
  acknowledgement: the call states that the environment belongs to the client engagement whose contract with iorta
  TechNXT covers the marks. The API refuses it without `acknowledgedPermission: true`
  (`POST /api/branding/packs/bundled/<id>/enable`), so the acknowledgement cannot be skipped.
* **Record**: table `brand_pack_enablements` (pack, version, owner, the acknowledgement text, who, when, what was
  applied, the branding before the pack; status enabled / replaced / reverted) and the audit trail (entity `branding`,
  action `enable-pack`, entity id `bundled-pack:<id>`).
* **Back to default** (`POST /api/branding/packs/reset-default`): the default theme, logo and favicon; when a pack is
  enabled, also the application name and the print logo of the primary company as they were before it; the
  enablement row becomes `reverted` and the audit trail carries `reset-default`.
* **API**: `GET /api/branding/packs/bundled` (list with status and history), `POST .../bundled/<id>/check` (dry run),
  `POST .../bundled/<id>/enable`, `POST /api/branding/packs/reset-default`. All need the settings permission.
* **Deployment** (`BRAND_PACK`, deploy/REFERENCE.md): an environment made for the client names its pack in the API's
  `BRAND_PACK` variable (`toyota-insurance-services` in the TISPH environments). The variable **enforces** the pack.
  At every start, after the migrations and the seed, the API compares the branding with the pack and applies the pack
  again through the same logic when it is not the enablement in force or when anything differs: the theme of the
  screens (name, preset, colours, layout, font, radius, sign-in page, logo sizes), the application name, the logo, the
  favicon, or a missing print logo of the primary company. The e-mail and document sections of the theme and the
  logo height on documents are kept as the broker set them on the layout screens (a section still at the iorta
  TechNXT default takes the pack's); the signature mapping is not touched. Images already stored with the pack's
  bytes are reused, so a start with nothing to apply stores nothing and logs `Brand pack <name> in force`. The first
  application is recorded against the user `system` with the acknowledgement and the note "Given by the deployment
  configuration (BRAND_PACK)" (action `enable-pack`); a later one is audited as `reapply-pack` with the reasons, and
  both log one line saying what differed. An unknown id logs a warning and the API starts with the branding it has.
* **Locked while set**: with `BRAND_PACK` set the API refuses, with a message naming the variable, a theme save that
  changes anything but the e-mail and document sections, the branding image uploads and resets, a brand pack import
  (the dry run is still accepted), enabling a pack, Back to default, and the logo, favicon, colours and application
  name of `PUT /api/system-settings`. To take a pack out of an environment, remove the variable, restart the API and
  go back to the default.

## 4. Client brand packs and trademarks

A client brand pack (for example `Brand_Packs/toyota-insurance-services/`) carries a third party's name and marks. It
is **not** the default, is **not** in the generic seed of every broker, and is applied only in that client's
environments: every such client is a client of iorta TechNXT, and **its contract with iorta TechNXT covers the use of
its marks** there (keep the contract reference with the engagement records). Do not use it in demonstrations to other
prospects. Do not copy photographs from a client's web site into the repository; the
broker uploads its own sign-in picture.

The Toyota Insurance Services pack is delivered as a bundled pack (section 3): it is enabled by the `BRAND_PACK`
variable of a TISPH deployment, or through the API with the acknowledgement that the environment belongs to that
engagement, and never by default. The
importable zip in `Brand_Packs/` remains for an environment that cannot reach the bundled list (an older release).

The Toyota Insurance Services pack: white header and side bar, near-black text and buttons, light grey backgrounds,
Toyota red only as a small accent (active marker, document rule, e-mail line), links in a darker red that
passes AA, Inter font, the TIS logo on screens and documents, footer "Authorized by the Insurance Commission to act as
an Insurance Agent, Licence No. {{licence}}". See its README.

## 5. Support procedures

### Brand pack import in an environment in use

1. **Before**: export the current pack (`GET /api/branding/brand-pack?format=zip`) and keep it with the change
   record. In Production the import is a normal change approved by the broker.
2. **Check** the new pack with the dry run of the import: nothing is saved; the answer gives the colours, the contents
   and any refusal (contrast below WCAG AA on buttons, primary colour, header, table header or document table header;
   unsafe SVG; unknown image type).
3. **Apply** it (`dryRun=false`) with the options chosen (print logo of the primary company, application name). The import is in the
   audit trail (entity `branding`, action `import`).
4. **Check** the sign-in page, one screen, **Sample document** (Documents and Reports Layout) and **Show a sample
   e-mail** (E-mail Layout). Users see the new theme on
   their next navigation; no reload or rebuild is needed.
5. **Rollback**: import the pack exported in step 1.

A client brand pack is applied only in that client's environments, under its contract with iorta TechNXT (section 4).
Support refuses the change in any other environment.

### Enabling a bundled brand pack

1. **Engagement**: confirm the environment belongs to that client's engagement, whose contract covers its marks
   (section 4). The administrator who enables the pack acknowledges it in the call; the acknowledgement is stored with
   the enablement and in the audit trail, so the record must be true. A TISPH deployment does this through
   `BRAND_PACK`, which also brings the pack back at the next start whenever the branding was changed.
2. **Before**: export the current pack (`GET /api/branding/brand-pack?format=zip`) and keep it with the change
   record, as for an import. Back to default does not restore a custom theme saved before the pack (it restores the product default),
   so the export is the way back to a custom theme.
3. **Enable**: check the pack (`POST /api/branding/packs/bundled/<id>/check`), then enable it with the
   acknowledgement and the options (print logo, application name). The list shows it enabled with who and when.
4. **Check** the sign-in page, one screen, Sample document and Sample e-mail, as after an import.
5. **Rollback**: Back to default (`POST /api/branding/packs/reset-default`: the product default, the name and print
   logo as before the pack), or import the pack exported in step 2 to return to a custom theme. Both are audited.

### Revoking an e-signature

1. The request comes in writing from the broker's System Administrator or the signatory, with the reason (signatory
   left, captured in error, suspected misuse).
2. **Company signatory**: Master > Generals > Insurance Management > Signatories, pencil "E-signature", **Revoke**,
   reason. **User**: the administrator revokes it from the user; only the user can capture a new one.
3. The version stops printing at once on every document, including reprints of older documents. A slot mapped to that
   signatory prints the name without an image until a new version is captured or the slot is mapped to someone else
   (Master > System Configuration > Document Signatures).
4. Check the audit trail (entity `e-signature`, action `revoke`). For suspected misuse, open a security incident and
   list the documents issued with the version since the suspected date.

