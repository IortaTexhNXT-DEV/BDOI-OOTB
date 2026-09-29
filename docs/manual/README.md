# BrokerVerse user manual

`BrokerVerse_User_Manual.docx` and `BrokerVerse_User_Manual.pdf` are the user manual of BrokerVerse OOTB by iorta
TechNXT, version 1.0, 29 September 2026 (199 pages, 189 figures). Both files have the same content. The manual is
written for the seven roles: System Administrator, Sales & Marketing, Processing Team, Operations, Claims,
Accounting and Accounting Manager.

| Path | What it is |
|---|---|
| `BrokerVerse_User_Manual.docx` / `.pdf` | The manual (A4, table of contents, headers and footers with page numbers). |
| `tools/manual_source.md` | The text of the manual. Edit this file to change the manual. |
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

Taken from a system with the sample data (`SEED_SAMPLE_DATA=true`) and one user per role: bea.admin (System
Administrator), maria.sales, jose.uw (Processing Team), ana.cs (Operations), carlo.claims, liza.finance
(Accounting) and rosa.acctmgr (Accounting Manager). Before capturing, a few flows were walked through the API so the
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
