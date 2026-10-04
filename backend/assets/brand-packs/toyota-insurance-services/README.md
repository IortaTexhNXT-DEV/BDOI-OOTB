# Toyota Insurance Services: brand pack

Client brand pack for the **Toyota Insurance Services (Philippines)** engagement. It is an optional pack bundled with
the product that a System Administrator enables in one environment from Master > System Settings > Theme and Branding
> Brand packs > Bundled packs; it is not the BrokerVerse default, nothing enables it automatically, and it is not part
of the generic out-of-the-box seed that every broker receives.

## Trademark and permission

The Toyota name, the Toyota emblem and the Toyota Insurance Services logo are trademarks of their owners. Use this pack
only for the Toyota Insurance Services engagement and only after the client has confirmed in writing that iorta TechNXT
may use its marks in their BrokerVerse environments (UAT and Production). Do not use these files in demonstrations to
other prospects, in marketing material or in another broker's environment. Remove the pack from an environment when the
engagement or the permission ends (apply another brand pack or the iorta TechNXT preset).

## Contents

| File | What it is |
| --- | --- |
| `theme.json` | The brand pack manifest: theme (colours, font, radius, logo sizes, sign-in page, document colours and footer line) and the image file names |
| `logo.png` | Toyota Insurance Services logo (375 x 100 px, transparent PNG), used as the application logo and as the print logo |
| `toyota-insurance-services.brandpack.zip` | The importable pack (theme.json + logo.png + this README), built by `node backend/scripts/build-brand-pack.js <this folder>` |

The bundled copy of this folder is `backend/assets/brand-packs/toyota-insurance-services/`, with a `manifest.json`
(id, name, description, trademark owner, written permission required, version) that the Bundled packs list reads. The
two copies must stay identical (a test compares them).

## The theme

Following the client's web site style (shared by the product owner as screenshots; the site is not reachable from the
build environment): white header and side bar, near-black text and controls, light grey backgrounds, a clean
sans-serif, and Toyota red only as a small accent. No photographs of the client's web site are included (their
copyright): the broker uploads its own sign-in picture in Theme and Branding if it wants one.

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

Document footer line: "Authorized by the Insurance Commission to act as an Insurance Agent, Licence No. {{licence}}" (the
licence number comes from the primary company in Master > Company; the line is left out while it is empty). Excel report
files carry the logo and a banner. E-mails use a white header with the logo and a thin red line. The pack also sets
the application name to "Toyota Insurance Services" (untick "Also set the application name" on import to keep yours).

## Enabling it

1. Get the client's written permission (see above) and keep it with the engagement records.
2. Sign in as a System Administrator: Master > System Settings > Theme and Branding > Brand packs > Bundled packs.
3. On the Toyota Insurance Services card, check the preview (Sample document, Sample e-mail), then select Enable. The
   dialog names the owner of the marks and checks the pack; tick "We hold the owner's written permission to use these
   marks" (the button stays disabled until then). "Also use the logo on printed documents" sets the logo as the print
   logo of the primary company (Master > Company); "Also set the application name of the pack" sets the name.
4. Every signed-in user gets the new look on their next navigation; documents and reports printed from now on use it.
   The card shows "Enabled on <date> by <user>"; the enablement and the acknowledgement are in the audit trail.
5. Back to default on the card returns the environment to the iorta TechNXT default (theme, logo, favicon, and the
   application name and print logo as they were before the pack).

The zip remains importable (Theme and Branding > Brand packs > Import) for an environment that does not list bundled
packs. To promote the branding to another environment, enable the pack there the same way, or export the brand pack
from UAT and import that file in Production. See `docs/onboarding/BRANDING_AND_SIGNATURES.md`.
