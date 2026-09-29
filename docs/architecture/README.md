# BrokerVerse Solution Architecture

Eleven stand-alone architecture documents for BrokerVerse, the out-of-the-box insurance broking platform of iorta
TechNXT. Version 1.0, 29 September 2026, prepared by iorta TechNXT. Every document is provided as `.docx` (editable)
and `.pdf` (same content). Each one has its own cover, document control, table of contents, related documents and
glossary.

| No. | Document | Files |
|---|---|---|
| 01 | Solution Component Diagram and Application Architecture | `01_BrokerVerse_Solution_Component_Diagram_Application_Architecture.docx` / `.pdf` |
| 02 | Database Design | `02_BrokerVerse_Database_Design.docx` / `.pdf` |
| 03 | Database Inventory | `03_BrokerVerse_Database_Inventory.docx` / `.pdf` |
| 04 | Technology Stack | `04_BrokerVerse_Technology_Stack.docx` / `.pdf` |
| 05 | Shared Service Components | `05_BrokerVerse_Shared_Service_Components.docx` / `.pdf` |
| 06 | Capacity and Performance | `06_BrokerVerse_Capacity_and_Performance.docx` / `.pdf` |
| 07 | High Availability and Resiliency | `07_BrokerVerse_High_Availability_and_Resiliency.docx` / `.pdf` |
| 08 | RTO and RPO | `08_BrokerVerse_RTO_and_RPO.docx` / `.pdf` |
| 09 | Backup and Recovery | `09_BrokerVerse_Backup_and_Recovery.docx` / `.pdf` |
| 10 | Data Archival, Housekeeping and Restoration | `10_BrokerVerse_Data_Archival_Housekeeping_and_Restoration.docx` / `.pdf` |
| 11 | Monitoring | `11_BrokerVerse_Monitoring.docx` / `.pdf` |

Facts are taken from the code, configuration and database of branch `brokerverse-platform`. Targets, sizes,
retention periods and thresholds that are not facts of the code are marked "Recommended / to be confirmed by the
business and DevOps"; defects found while writing are marked "Gap".

## Folder layout

```
docs/architecture/
  NN_BrokerVerse_<title>.docx / .pdf   the eleven documents (generated)
  diagrams/
    d01_*.dot, d05_*.dot, d07_*.dot,    Graphviz sources (component, deployment, topology, lifecycle, monitoring)
    d09_*.dot, d10_*.dot, d11_*.dot
    seq_*.seq                           sequence diagrams (small text format, see tools/render_diagrams.py)
    er_*.dot                            ER diagrams, generated from tools/data/db_snapshot.json (do not edit)
    *.png, *.svg                        rendered diagrams (PNG used in the documents, SVG for the web)
  tools/
    src/NN_*.md                         document sources (one per document) and src/glossary.md (master glossary)
    build_architecture.py               builds all documents: python-docx + LibreOffice (table of contents, PDF)
    render_diagrams.py                  renders diagrams/*.dot and *.seq, generates the ER diagrams
    collect_db_inventory.py             read-only database snapshot -> tools/data/db_snapshot.json
    table_catalog.py                    domain, purpose, owner module and retention class of every table
    loadtest.mjs                        indicative load test (document 06)
    loadtest-results-c10.json, -c50.json  load-test results used by document 06
    data/db_snapshot.json               database snapshot used by documents 02 and 03 and the ER diagrams
```

## Regenerating the documents

Prerequisites (once):

```
pip install python-docx fonttools brotli pillow
apt-get install -y graphviz                 # the dot binary
python3 docs/manual/tools/install_fonts.py  # Nunito font for LibreOffice (from brokerverse/node_modules/@fontsource/nunito)
# LibreOffice (soffice) with its Python UNO bridge must be installed
```

From the repository root:

```
# 1. Optional: refresh the database facts (read-only) from the database the documents should describe
DATABASE_URL=postgres://brokerverse:brokerverse@127.0.0.1:5432/brokerverse \
  python3 docs/architecture/tools/collect_db_inventory.py

# 2. Render the diagrams (regenerates the ER diagrams from the snapshot)
python3 docs/architecture/tools/render_diagrams.py

# 3. Build the eleven .docx and .pdf files (about 30 seconds); pass numbers to build only some, e.g. 03 06
python3 docs/architecture/tools/build_architecture.py
```

Optional, to repeat the indicative load test of document 06 (starts an in-process API instance on a free local port
and sends read-only requests; it does not touch a running API):

```
cd backend && DATABASE_URL=postgres://... LOG_LEVEL=warn node ../docs/architecture/tools/loadtest.mjs 15 10
cd backend && DATABASE_URL=postgres://... LOG_LEVEL=warn node ../docs/architecture/tools/loadtest.mjs 15 50
```

## Editing

- Change text in `tools/src/NN_*.md`; the format is described at the top of `tools/build_architecture.py`
  (headings, tables with `{widths: ...}` and `{size: ...}`, `![Caption](diagram)`, call-outs `> **Note:**`,
  `> **Recommended:**`, `> **Gap:**`, and `{generate: name}` blocks filled from the snapshot or the load-test results).
- Add glossary terms to `tools/src/glossary.md`; each document lists only the terms it uses.
- Version, date and author are constants at the top of `tools/build_architecture.py`; update the version history
  there for a new issue.
- Table descriptions, owner modules and retention classes of document 03 are in `tools/table_catalog.py`. After new
  migrations, re-run the collector: the build prints a warning for every table missing from the catalogue; add it
  there and to an ER group in `tools/render_diagrams.py` (`ER_GROUPS`).
