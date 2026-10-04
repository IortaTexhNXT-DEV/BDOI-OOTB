# BrokerVerse user manual

The user manual given to brokers is `docs/package/05_Delivery/BrokerVerse_User_Manual.docx` and `.pdf`, built from
`docs/package/source/user-manual.md` (see `docs/package/README.md`). This folder holds the earlier role-based manual
source, its screenshots and the capture tools. The role decks in `docs/decks` take their screens from `images/` and
their rules from `tools/manual_source.md`, so these are kept up to date. `build_manual.py` still writes
`BrokerVerse_User_Manual.docx` and `.pdf` here as a working copy for review; they are not kept in the repository
(`.gitignore`) and are not given to brokers.

| Path | What it is |
|---|---|
| `BrokerVerse_User_Manual.docx` / `.pdf` | Working copy written by `build_manual.py` (not kept in the repository). |
| `tools/manual_source.md` | The text of the role-based manual, read by the role decks. |
| `tools/build_manual.py` | Builds the .docx with python-docx, then uses LibreOffice to fill the table of contents and export the PDF. |
| `tools/capture.py`, `tools/scenes.py` | Take the screenshots from a running system with Playwright. |
| `tools/style_scan.py` | Checks the manual and the role decks for stock words, emojis, long dashes and names that must not appear. |
| `tools/install_fonts.py` | Installs the Nunito font for LibreOffice from `brokerverse/node_modules/@fontsource/nunito`. |
| `images/*.jpg` | The screenshots (JPEG quality 70, 1400 px wide). |

## Build

```
pip install python-docx pillow fonttools brotli
python3 docs/manual/tools/install_fonts.py            # once per machine
python3 docs/manual/tools/build_manual.py             # writes the .docx and the .pdf
python3 docs/manual/tools/style_scan.py               # manual and decks; exit code 1 when something is reported
```

Source format: `#`, `##`, `###` headings (chapters start on a new page); paragraphs; `1.` steps; `-` bullets;
`| a | b |` tables with an optional `{widths: 30,70}` line; `![Caption](image-name)`; `> **Tip:** text` call-outs
(Tip and Note blue, Important and Caution yellow); `\pagebreak`.

## Screenshots

Taken from a system with the sample data (`SEED_SAMPLE_DATA=true`) and one user per role: beatriz.lacson (System
Administrator), maria.rivera (Sales & Marketing), jose.bernardo (Processing Team), ana.buenaventura (Operations),
carlo.estrada (Claims), liza.quiambao (Accounting) and teresa.villaroman (Accounting Manager). `capture.py` signs in
through the current sign-in form (user ID and password fields, **Sign in**) and reads the passwords from
`ADMIN_PASSWORD` and `PERSONA_PASSWORD` only. Scenes that open a record by its number (for example LD-2026-95015)
need that record in the data set; the current screenshots of the broker manual are taken separately from
`docs/package/source/manual-images`. Before capturing, a few flows were walked through the API so the
screens show real records: offers on BS-2026-90002, Placement Slip PS-2026-00001 confirmed by both insurers and
issued as the co-insured policy POL-2026-00001, the lead confirmation on PS-2026-90001, month-end close run
MEC-2026-00001 for 2026-08, a recurring journal, auto-match and reconciliation BRC-2026-00001 on ACC-BDO-001, and
the settlement of CLM-2026-90007 paid through the broker with its funds received.

```
export WEB_BASE=http://127.0.0.1:5211 API=http://localhost:8211/api
export PERSONA_PASSWORD='<password of the role users>'     # from the environment only
export STATE_DIR=/tmp/bv-manual-state                        # cached sign-ins (sign-in is rate limited)
python3 docs/manual/tools/capture.py                         # every scene
python3 docs/manual/tools/capture.py bs-compare m-docnum     # only the named scenes
```

`quote-approval-page` runs only when named: send QT-2026-95009 for customer approval first; it reads the approval
link from the e-mail outbox (`DATABASE_URL`, read-only). The capture never saves: a guard refuses to click saving
buttons, and the sign-in security screens answer the sign-in calls in the browser.

The role decks in `docs/decks` use these screenshots.
