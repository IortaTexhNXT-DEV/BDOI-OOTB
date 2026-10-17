# docs/architecture

The generic BrokerVerse architecture set has been retired from this repository. The TISPH architecture is described
in the TISPH document pack (index: [`docs/TISPH/README.md`](../TISPH/README.md)), in particular
`docs/TISPH/pack/TISPH_Solution_Architecture.docx`, `TISPH_Data_Architecture.docx`, `TISPH_Operations_and_Support.docx`
and `TISPH_NFR_Compliance.docx`. The performance test method is in `docs/TISPH/testing/TISPH_Test_Strategy.docx`
(section 3).

What stays here, and why:

| File | Why it stays |
|---|---|
| `tools/loadtest.mjs`, `tools/loadtest-results-c10.json`, `tools/loadtest-results-c50.json` | Indicative load test and its results, cited by the TISPH NFR compliance matrix and the TISPH test strategy |
| `tools/table_catalog.py` | Domain, purpose, owner module and retention class of every table; used by the data dictionary tool (`docs/package/tools/data-dictionary/tables_meta.py`) and cited by the TISPH data architecture |
| `tools/check_style.py` | Wording check of Markdown, Word and PDF files (`python3 docs/architecture/tools/check_style.py <files>`) |

To repeat the indicative load test (starts an in-process API instance on a free local port and sends read-only
requests; it does not touch a running API):

```
cd backend && DATABASE_URL=postgres://... LOG_LEVEL=warn node ../docs/architecture/tools/loadtest.mjs 15 10
cd backend && DATABASE_URL=postgres://... LOG_LEVEL=warn node ../docs/architecture/tools/loadtest.mjs 15 50
```

After new migrations, add every new table to `tools/table_catalog.py`.
