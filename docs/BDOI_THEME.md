# BDOI theme for the BrokerVerse front end

The front end in `brokerverse/` is the `brokerverse-main.zip` snapshot from this repository with the
BDOI theme applied: the look of iNXT BrokerVerse from `IortaTexhNXT-DEV/FinVerse`
(`frontend/src/components/layout` and `frontend/src/styles/tokens.css`, from the BDO Style Guide).

Styling only. Every screen, route, form and API call is as it was. The `build/` output that the zip
carried is left out; `npm run build` produces it.

## What changed

| Area | Before | After |
|---|---|---|
| Colours | PrimeReact indigo (#6366f1), dark sidebar (#1c2536) | BDO Style Guide: Header Blue #004ea8, CTA Blue #0072d8, Background Blue #e5f5ff, Text Field Blue #99c1e7, Yellow #fdb913, greys, Dirty White page |
| Font | Inter and Poppins | Nunito (bundled with `@fontsource/nunito`), Arial fallback |
| Sidebar | Dark, white text, iNXT logo | White, Header Blue navigation, BDO Insure logo with "BIBS · BDOI Broker System" |
| Top bar | Translucent | White with a divider |
| Tables | Grey heads | Header Blue head row with white text, alternate rows in Background Blue |
| Tabs | Indigo underline | CTA Blue text with a yellow top bar on the active tab |
| Controls | Indigo, 6 px radius | CTA Blue, 8 px radius, Text Field Blue input borders; cards 12 px |
| Sign-in | Blue banner and tagline | Photo panel, BDO Insure logo, "Welcome to BIBS / BDOI Broker System", "Powered by" iorta TechNXT |

## Files

- `brokerverse/scripts/build-bdoi-theme.js`: generates `src/theme/bdoi/primereact-bdoi.css` from the
  PrimeReact `lara-light-indigo` theme with the BDOI palette and Nunito substituted. Run
  `npm run theme:bdoi` after a PrimeReact upgrade and commit the result.
- `brokerverse/src/theme/bdoi/tokens.scss`: the design tokens.
- `brokerverse/src/theme/bdoi/bdoi.scss`: shell, sign-in and component styles. It is imported last in
  `src/index.js` so it wins over the component stylesheets.
- `brokerverse/public/bdoi/`: BDO Insure logo, sign-in photo and the iorta TechNXT logo.
- `brokerverse/src/Color.scss`, `src/components/SideBar/*`, `src/agentModule/authModule/Login/index.js`,
  `src/locales/{en,th}.json`, `public/index.html`: brand and colour edits.
- Mechanical replacement across `src` of the hard-coded indigo hexes and Poppins/Inter font
  declarations (one commit, `Replace the hard-coded indigo palette ...`, 449 files).

`bdoi-theme.patch` at the repository root holds the same changes as two git commits on top of the
snapshot, for the live repository.

## Applying it to `iortatechnxt-technology/brokerverse` (branch `dev`)

The site at brokerverse-dev.inxtuniverse.com is built from `dev` by `.github/workflows/deploy.yml`
(push to `dev` builds and syncs `build/` to S3, then invalidates CloudFront). The snapshot here is
`main`, which differs from `dev`, so apply the patch on a branch from `dev` and check the result before
merging:

```bash
git checkout -b bdoi-theme dev
git am --3way bdoi-theme.patch      # resolve any conflict in the files listed above
npm install --legacy-peer-deps      # adds @fontsource/nunito
npm run theme:bdoi                  # regenerate if primereact differs from the snapshot
CI=false npm run build
```

Known differences between `main` and `dev` to check after the patch:

- `dev` shows `/bdo.png` in the sidebar and `/bdologinbanner.png` on sign-in; `main` used
  `SvgFinalLogo`, `/iorta.png` and `/iortaloginbanner.gif`. The patch replaces the `main` references;
  on `dev` point the same two places at `/bdoi/bdo-insure.png` and `/bdoi/login-photo.jpg`.
- `dev` has a System Settings screen (Master > System Settings) with a Logo Preset and Primary /
  Secondary Colour. Those runtime settings sit on top of the theme; set them to the BDOI colours
  (#0072d8 / #004ea8) or leave them at their defaults.
- `src/utility/constant.js` in the snapshot points `BASE_URL` at `http://localhost:8000/api`; `dev`
  points at the dev API. The patch does not touch it.

## Checks done

- Production build (`CI=false npm run build`) compiles; the only warnings are pre-existing lint warnings.
- The built app was served locally, signed in against the dev API (read-only; every write request was
  blocked) and the sign-in, Executive Dashboard, Clients, Create Lead, Currency list / add /
  validation, Quotation, Remittance Tracking, Reports and Product Templates screens were captured.
  Before / after sheets are in `docs/theme-screens/`.

## Seen in the snapshot but not changed (not styling)

- `src/agentModule/authModule/Login/index.js` pre-fills a real user ID and password in the form
  (`initialValue`). Remove before any release.
- The snapshot shows amounts with `$`; the dev site shows `₱` (display currency from `dev`'s
  System Settings).
- The Remittance screens show raw text keys (`remittance.approvalHistory`) as labels: the i18n
  entries are missing.
