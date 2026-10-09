# Toyota Insurance Services: brand pack

Client brand pack for the **Toyota Insurance Services (Philippines)** engagement. It is an optional pack bundled with
the product that a TISPH deployment enables with `BRAND_PACK=toyota-insurance-services` (or a System Administrator
through the bundled pack API); it is not the BrokerVerse default, nothing enables it without one of these, and it is
not part of the generic out-of-the-box seed that every broker receives.

## Trademark and contract

The Toyota name, the Toyota emblem and the Toyota Insurance Services logo are trademarks of their owners. Toyota
Insurance Services (Philippines) is a client of iorta TechNXT, and the contract between them covers the use of these
marks in the BrokerVerse environments of that engagement (UAT and Production). Use this pack in those environments
only: not in demonstrations to other prospects, in marketing material or in another client's environment. Keep the
contract reference with the engagement records and remove the pack from an environment when the engagement ends
(apply another brand pack or the iorta TechNXT preset).

## Contents

| File | What it is |
| --- | --- |
| `theme.json` | The brand pack manifest: theme (colours, font, radius, logo sizes, sign-in page, document colours and footer line) and the image file names |
| `logo.png` | Toyota Insurance Services logo (375 x 100 px, PNG), used as the application logo and as the print logo |
| `favicon.png` | The Toyota emblem of the logo on a square (64 x 64 px, PNG), the icon of the browser tab |
| `toyota-insurance-services.brandpack.zip` | The importable pack (theme.json + logo.png + this README), built by `node backend/scripts/build-brand-pack.js <this folder>` |

The bundled copy of this folder is `backend/assets/brand-packs/toyota-insurance-services/`, with a `manifest.json`
(id, name, description, trademark owner, the contract covering the marks, version) that the Bundled packs list reads. The
two copies must stay identical (a test compares them).

## The theme

Following the client's web site style (shared by the product owner as screenshots; the site is not reachable from the
build environment): white header and side bar, near-black text and controls, light grey backgrounds, a clean
sans-serif, and Toyota red only as a small accent. No photographs of the client's web site are included (their
copyright): the broker supplies its own sign-in picture (branding image upload of the API) if it wants one.

| Role | Colour | Note |
| --- | --- | --- |
| Primary, buttons | Near black `#1A1A1A` (hover `#000000`), white text | 17.4:1 |
| Header and side bar | White, near-black text; active menu item light grey `#F2F2F2` with black text | |
| Table headers on screen | Light grey `#EEEEEE`, near-black text | |
| Page background | Light grey `#F5F5F5` | |
| Accent (active menu and tab marker, document rule, e-mail header line) | Toyota red `#EB0A1E` | Decorative only, never text; the focus ring is near black so a focused field never looks like an error |
| Links | Dark red `#B40514` | 7.06:1 on white (Toyota red as text would be only 4.57:1) |
| Document and Excel table headers | Near black `#1A1A1A`, white text | |
| Font | Inter (Google Fonts, falls back to Arial) | Toyota's corporate typeface is licensed |
| Radius | 4 / 8 / 12 px, buttons 4 px | |
| Sign-in page | Library picture "Motor" on a dark gradient (`#2B2B2B` to `#0D0D0D`), headline "Welcome to Toyota Insurance Services" | |
| Side bar | The logo only: it carries the name, so the application name is not repeated under it (`logo.showName` false) | |

Document footer line: "Authorized by the Insurance Commission to act as an Insurance Agent, Licence No. {{licence}}" (the
licence number comes from the primary company in Master > Company; the line is left out while it is empty). Excel report
files carry the logo and a banner. E-mails use a white header with the logo and a thin red line. The pack also sets
the application name to "Toyota Insurance Services" (untick "Also set the application name" on import to keep yours).

## Enabling it

1. Confirm the environment belongs to the Toyota Insurance Services engagement (see above) and keep the contract
   reference with the engagement records.
2. Set `BRAND_PACK=toyota-insurance-services` on the API of the environment (deploy/REFERENCE.md, "Brand pack of the
   deployment"). The variable enforces the pack: at every start the API checks that the screens show it (theme, logo,
   favicon, application name, the print logo of the primary company in Master > Company) and applies it again when
   anything differs, keeping the e-mail and document sections of the theme as they were set on their screens. The
   first application records the acknowledgement of the deployment. While the variable is set, the API refuses
   changes to the look of the screens (theme colours, logo, favicon, application name, another brand pack, Back to
   default). Without the variable, a System Administrator enables the pack through the API:
   `POST /api/branding/packs/bundled/toyota-insurance-services/check`, then `.../enable` with
   `acknowledgedPermission: true` (the call is refused without it).
3. Every signed-in user gets the new look on their next navigation; documents and reports printed from now on use it.
   `GET /api/branding/packs/bundled` shows the enablement with who and when; it, the acknowledgement and every
   application at start-up are in the audit trail.
4. To take the pack out of an environment, remove `BRAND_PACK` and restart the API, then go back to the iorta TechNXT
   default (`POST /api/branding/packs/reset-default`: theme, logo, favicon, and the application name and print logo as
   they were before the pack).

The e-mail layout, the documents and reports layout and the signature mapping are adjusted on Master > System
Configuration (E-mail Layout, Documents and Reports Layout, Document Signatures). The zip remains importable
(`POST /api/branding/brand-pack`) for an environment that does not list bundled packs. To promote the branding to
another environment, set the same `BRAND_PACK` there. See `docs/onboarding/BRANDING_AND_SIGNATURES.md`.
