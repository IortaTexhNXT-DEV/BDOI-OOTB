# Brand packs

A brand pack is the branding of one broker environment in one file: theme (colours, layout, font, sign-in page,
document and report colours and footer, e-mail layout), application name, logo, favicon, sign-in picture and print logo.
It is imported in Master > System Settings > Theme and Branding > Brand packs, and exported there to promote branding
from UAT to Production.

| Folder | Pack | Note |
| --- | --- | --- |
| `toyota-insurance-services/` | Toyota Insurance Services (Philippines) | Client pack: optional, for that engagement only, needs the client's written permission to use its marks |

Build an importable zip from a folder (theme.json + the image files it names):

```
cd backend
node scripts/build-brand-pack.js ../docs/package/04_Onboarding_and_Go_Live/Brand_Packs/<folder>
```

The script refuses a theme the application would refuse (unknown values, fonts outside the list, contrast below WCAG
AA on buttons, header and table headers). Full guide: `docs/onboarding/BRANDING_AND_SIGNATURES.md`.
