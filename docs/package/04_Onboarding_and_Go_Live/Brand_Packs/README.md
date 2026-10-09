# Brand packs

A brand pack is the branding of one broker environment in one file: theme (colours, layout, font, sign-in page,
document and report colours and footer, e-mail layout), application name, logo, favicon, sign-in picture and print logo.
It is imported and exported through the API (`POST` / `GET /api/branding/brand-pack`) to promote branding from UAT to
Production.

| Folder | Pack | Note |
| --- | --- | --- |
| `toyota-insurance-services/` | Toyota Insurance Services (Philippines) | Client pack, bundled with the product: optional, for that engagement only, under the client's contract with iorta TechNXT, which covers its marks |

## Bundled packs

A bundled pack ships with the product (`backend/assets/brand-packs/<id>/`: the pack folder plus a `manifest.json` with
`id`, `name`, `description`, `trademarkOwner`, `requiresAcknowledgement`, `permissionBasis`, `permissionNote` and `version`) and is
enforced by the `BRAND_PACK` variable of the deployment made for its client (deploy/REFERENCE.md, "Brand pack of the
deployment"), or enabled through the API (`POST /api/branding/packs/bundled/<id>/enable`), not by uploading a file.
Nothing is enabled by default: a new environment runs the iorta TechNXT default. Enabling checks the pack and requires
the acknowledgement "This environment belongs to the client engagement whose contract with iorta TechNXT covers these
marks"; the enablement is recorded (who, when, the acknowledgement) and audited. With `BRAND_PACK` set the API applies
the pack again at every start where the screens differ from it and refuses changes to the look of the screens;
without it, Back to default (`POST /api/branding/packs/reset-default`) returns to the product default. The copy in this folder and the bundled copy must stay byte-identical: edit here, rebuild the
zip, then copy the folder to `backend/assets/brand-packs/<id>/` (`backend/test/bundled-brand-packs.test.js` compares
them).

Build an importable zip from a folder (theme.json + the image files it names):

```
cd backend
node scripts/build-brand-pack.js ../docs/package/04_Onboarding_and_Go_Live/Brand_Packs/<folder>
```

The script refuses a theme the application would refuse (unknown values, fonts outside the list, contrast below WCAG
AA on buttons, header and table headers). Full guide: `docs/onboarding/BRANDING_AND_SIGNATURES.md`.
