# BDOI theme for the BrokerVerse front end

The front end in `brokerverse/` is the `brokerverse-dev.zip` snapshot from this repository (the branch
the dev site is built from) with the BDOI theme applied: the look of iNXT BrokerVerse from `IortaTexhNXT-DEV/FinVerse`
(`frontend/src/components/layout` and `frontend/src/styles/tokens.css`, from the BDO Style Guide).

Styling only. Every screen, route, form and API call is as it was. The `build/` output that the zip
carried is left out; `npm run build` produces it. `.env` is left out as well; copy it from `dev`.

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
- `brokerverse/scripts/apply-bdoi-palette.js` (`npm run theme:palette`): the codemod that rewrote the
  hard-coded indigo / old BDO blue hexes and Poppins/Inter font declarations across `src` (second
  commit, 455 files). It is idempotent: run it again after merging other branches into `dev`.
- The dev System Settings screen keeps working: the sidebar and sign-in show the logo chosen there,
  its Primary / Secondary colour still drive `--bv-primary` / `--bv-secondary`, and the two BDO presets
  now carry the BDOI values (#0072d8 / #004ea8). Defaults in `src/utility/systemCurrencies.js` match.

`bdoi-theme.patch` at the repository root holds the same changes as two git commits on top of the
snapshot, for the live repository.

## Applying it to `iortatechnxt-technology/brokerverse` (branch `dev`)

The site at brokerverse-dev.inxtuniverse.com is built from `dev` by `.github/workflows/deploy.yml`
(push to `dev` builds and syncs `build/` to S3, then invalidates CloudFront). The patch was made on the
`brokerverse-dev.zip` snapshot, so on a `dev` checkout of the same state it applies cleanly:

```bash
git checkout -b bdoi-theme dev
git am --3way bdoi-theme.patch      # resolve any conflict in the files listed above
npm install --legacy-peer-deps      # adds @fontsource/nunito
npm run theme:bdoi                  # regenerate if primereact differs from the snapshot
npm run theme:palette               # re-run the codemod if dev moved on since the snapshot
CI=false npm run build
```

Merging that branch into `dev` triggers the deploy, and the sign-in URL then opens the BDOI version.

After the deploy, open Master > System Settings on the dev site: the saved Primary / Secondary
colour there (currently Indigo #6366f1 / #4f46e5) still applies to the sign-in gradient behind the photo
and to `--bv-primary`; pick the BDO Blue / BDO Navy presets and save to line it up with the theme.

## Checks done

- Production build (`CI=false npm run build`) compiles; the only warnings are pre-existing lint warnings.
- The built app was served locally, signed in against the dev API (read-only; every write request was
  blocked) and the sign-in, Executive Dashboard, Clients, Create Lead, Currency list / add /
  validation, System Settings, Quotation, Remittance Tracking, Reports and Product Templates screens
  were captured. Before / after sheets are in `docs/theme-screens/`.

## Seen in the snapshot but not changed (not styling)

- The Remittance screens show raw text keys (`remittance.approvalHistory`) as labels: the i18n
  entries are missing.
- `brokerverse-be-main.zip` in this repository holds only a README.
