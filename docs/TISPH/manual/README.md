# TISPH user manual

Source of the Toyota Insurance Services Philippines edition of the user manual: the in-app Help page
(`/help/user-manual.html`), its Word file and its PDF. The product manual (`docs/package/source/user-manual.md`) stays
the base edition for other clients; `brokerverse/help.config.json` names the edition a branch ships (`tisph` here).

| Path | Contents |
|---|---|
| `manual.json` | The edition: title, version, date, status, document control, Toyota Insurance Services brand pack, file names, the chapter files in order, the forbidden terms |
| `chapters/` | One file per chapter: about, getting started, the TISPH process, one chapter per role (`role-<role>.md`), the screen reference (`screens-*.md`), reports, glossary |
| `generated/role-facts.json`, `generated/roles/` | Per role: menus, access, approvals, limits, segregation of duties. Written by `npm run manual:role-facts` in `backend/`, never by hand |
| `generated/TISPH_User_Manual.md` | The assembled source of the Word file, written by `npm run help:build` |
| `images/<chapter>/` | Screenshots, taken from a local system of the TISPH build with fictional sample data |
| `TISPH_User_Manual.docx`, `.pdf` | Word and PDF, written by `npm run help:word` with `../tools/md2docx.py` and the document template, in the manual layout and the Toyota Insurance Services brand pack (cover, header, footer, colours and font of the pack; no template artwork) |

## Build

```bash
cd backend && DATABASE_URL=<freshly migrated and seeded database> npm run manual:role-facts   # after a change to roles, grants, menus, limits or SoD rules
cd brokerverse && npm run help:build              # public/help (commit it)
cd brokerverse && npm run help:word               # Word and PDF, then public/help again
cd brokerverse && npm run help:build -- --check   # the checks only
cd brokerverse && npm run help:build -- --edition base --out /tmp/base-manual   # the product edition, for review
```

`npm run help:word` needs python3 with python-docx and Pillow, and LibreOffice.

## Chapter syntax

| Syntax | Result |
|---|---|
| `## Prospects {#prospects}` | A heading with a stable id. Chapter and section headings must have one; the Help panel links to them (`brokerverse/src/components/HelpPanel/helpRoutes.js`). |
| `{{include:generated/roles/<role>.md}}` | The generated facts of a role: menus, access, approvals, segregation of duties |
| `{{role-summary:<role>}}` | Department and summary of a role (Master > Configuration, access role groups) |
| `{{screen:/agent/leadlisting}}` | The menu path of a screen and the roles that open it, with their access |
| `{{menu:/agent/leadlisting}}` | The menu path of a screen as the side bar shows it |
| `{{roles:approve:quotations}}` | The roles holding a permission, by name |
| `::: draft` ... `:::` | Text still being written: shown as "In preparation" |
| `<!-- ... -->` | A note for the writers, never published |
| `![Caption](images/<chapter>/<file>.png)` | A screenshot |
| `[Prospects](#prospects)` | A link to a heading of the manual |

## Numbers, figures and cross-references

The chapters are numbered from 1 in the order of `manual.json` (the document control has no number), in the same way
on the help page and in the Word and PDF files. Every screenshot is numbered by chapter ("Figure 4.2: <caption>") by
the build; write the caption only. In the Word and PDF files a link to a heading is a link to that heading with its
section number, and the screenshots carry their caption as alternative text and are listed in the list of figures.

Screenshots are cropped to the area of interest: a page without the side bar and the header, a dialog without the
greyed screen behind it.

## What stops the build

- a forbidden term of `manual.json`: generic roles, withdrawn screens, product and vendor wording, internal project
  wording (version tags, set-up wording), environment names, capture test accounts, AI wording;
- a permission code, role code or setting key in the text;
- a heading without an id, an id used twice, a link to no heading;
- a role without its chapter, or a chapter without the generated facts of its role;
- a screen of a TISPH menu without a section, or a `{{screen:}}` of a screen no TISPH role opens;
- role facts that no longer match the menus (`npm run manual:role-facts`);
- a missing image or include.

`backend/test/manual-role-facts.test.js` fails when the generated files differ from the delivered configuration.

## Status

The edition shows **Draft** until TISPH signs it off. To show Approved, `manual.json` needs `approved`, `approvalRef`
and `approvedHash` (the `sourceHash` of `public/help/sections.json` of the signed-off build) and no text in
preparation; any later change to the text shows Draft again.
