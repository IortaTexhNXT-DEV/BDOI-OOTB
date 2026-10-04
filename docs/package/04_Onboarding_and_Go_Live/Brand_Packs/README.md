# Brand packs

A brand pack is the branding of one broker environment in one file: theme (colours, layout, font, sign-in page,
document and report colours and footer, e-mail layout), application name, logo, favicon, sign-in picture and print logo.
It is imported in Master > System Settings > Theme and Branding > Brand packs, and exported there to promote branding
from UAT to Production.

| Folder | Pack | Note |
| --- | --- | --- |
| `toyota-insurance-services/` | Toyota Insurance Services (Philippines) | Client pack, bundled with the product: optional, for that engagement only, under the client's contract with iorta TechNXT, which covers its marks |

## Bundled packs

A bundled pack ships with the product (`backend/assets/brand-packs/<id>/`: the pack folder plus a `manifest.json` with
`id`, `name`, `description`, `trademarkOwner`, `requiresAcknowledgement`, `permissionBasis`, `permissionNote` and `version`) and is
enabled from Master > System Settings > Theme and Branding > Brand packs > **Bundled packs**, not by uploading a file.
Nothing is enabled by default: a new environment runs the iorta TechNXT default. **Enable** checks the pack, states who
owns its marks, the contract that covers them, and asks the administrator to tick "This environment belongs to the client e
gagement whose contract with iorta TechNXT covers these marks" before it activates; the enablement is recorded (who, when, the acknowledgement) and audited, and **Back to default** returns
to the product default. The copy in this folder and the bundled copy must stay byte-identical: edit here, rebuild the
zip, then copy the folder to `backend/assets/brand-packs/<id>/` (`backend/test/bundled-brand-packs.test.js` compares
them).

Build an importable zip from a folder (theme.json + the image files it names):

```
cd backend
node scripts/build-brand-pack.js ../docs/package/04_Onboarding_and_Go_Live/Brand_Packs/<folder>
```

The script refuses a theme the application would refuse (unknown values, fonts outside the list, contrast below WCAG
AA on buttons, header and table headers). Full guide: `docs/onboarding/BRANDING_AND_SIGNATURES.md`.
