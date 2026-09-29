# BrokerVerse user manual

`BrokerVerse_User_Manual.docx` and `BrokerVerse_User_Manual.pdf` are the end-to-end user manual of BrokerVerse
(BIBS · BDOI Broker System), version 1.0, 29 September 2026. Both files have the same content.

| Path | What it is |
|---|---|
| `BrokerVerse_User_Manual.docx` / `.pdf` | The manual (A4, BDOI theme, table of contents, headers and footers with page numbers). |
| `tools/manual_source.md` | The text of the manual. Edit this file to change the manual. |
| `tools/build_manual.py` | Builds the .docx with python-docx, then uses LibreOffice to fill the table of contents and page numbers and to export the PDF. |
| `tools/capture.py`, `tools/scenes.py` | Take the screenshots from a running system with Playwright (read-only: a guard refuses to click save / submit / approve / post / send / delete / issue and similar controls). |
| `tools/install_fonts.py` | Installs the Nunito font for LibreOffice from `brokerverse/node_modules/@fontsource/nunito`. |
| `images/*.jpg` | The screenshots (JPEG quality 70, 1400 px wide). |

## Regenerate the manual

Requirements: Python 3 with `python-docx`, `pillow`, `playwright` (Chromium) and `fonttools`; LibreOffice with Writer
(`libreoffice-writer`, including its Python UNO bridge); optionally `poppler-utils` to check the PDF.

```
pip install python-docx pillow fonttools brotli
python3 docs/manual/tools/install_fonts.py            # once per machine (Nunito)
python3 docs/manual/tools/build_manual.py             # writes the .docx and the .pdf
```

The build takes the text from `tools/manual_source.md` and the pictures from `images/`. It prints the number of
figures and any screenshot that is missing.

### Source format (`tools/manual_source.md`)

| Write | Result |
|---|---|
| `# Chapter`, `## Section`, `### Subsection` | Numbered headings (chapters start on a new page) |
| a paragraph; `**bold**`, `*italic*`, `` `code` `` | Body text |
| `1. step` lines | Numbered steps |
| `- item` lines | Bullets |
| `\| a \| b \|` rows (first row = header) and an optional `{widths: 30,70}` line before the table | Table |
| `![Caption](image-name)` | Screenshot `images/image-name.jpg` with a numbered caption |
| `> **Tip:** text` (Tip / Note = blue box; Important / Caution / Known issue = yellow box) | Call-out |
| `\pagebreak` | Page break |

## Retake the screenshots

Run against a system loaded with the sample data (quotations QT-2026-00001 to 00011, policies POL-2026-00001 to 00003,
claims CLM-2026-00001/00002, endorsement END-2026-00003, debit note DN-2026-00001, vouchers PV-2026-00022/00023,
JV-2026-00117). Record ids are looked up by number through the API, so the scenes also work on a re-seeded database.

```
export WEB_BASE=http://127.0.0.1:5080 API=http://localhost:8000/api
export ADMIN_PASSWORD='<password of BrokerVerse and carmela.morfe>'
export PERSONA_PASSWORD='<password of the persona users>'
export STATE_DIR=/tmp/bv-manual-state      # cached sign-ins (sign-in is rate limited: 10 per 5 minutes)
python3 docs/manual/tools/capture.py                    # every scene (about 45 minutes)
python3 docs/manual/tools/capture.py quote-wizard m-users   # only the named scenes
```

The public quotation-approval page (`quote-approval-page`) needs read access to the database (`DATABASE_URL`) to
find the approval link that was e-mailed for QT-2026-00006. Set `TEXT_DIR` to also save the visible text of every
screen, which helps when updating the manual text.

Screens are captured in a 1600 x 1000 browser window; a few long forms use a taller window. Passwords are read from
the environment only and never appear in the manual.

## Notes

- `docs/manual/` is listed in `.git/info/exclude` in this checkout; use `git add -f docs/manual` to commit it.
- The manual documents the build that was running on 29 September 2026. Items observed not to work are listed in
  Appendix G of the manual.
