# Environment Promotion

Master > Environment Promotion (TIS IT AppSupport / Admin; permissions `read:data-load`, `write:data-load`). The menu
moves the configuration of one environment to the next with the **Setup Workbook** (the configuration kit of the
`data-load` module: download with the current data, upload, validate in a rolled-back transaction, load), compares
environments (**Compare Environments**, `POST /data-load/compare`) and shows the **Promotion Path**.

| Route | Purpose |
|---|---|
| `GET /environment-promotion` | position of this environment on `promotion.path`, release identity (versions, commit, schema), go-live state, last export, load and comparison |
| `GET /environment-promotion/history` | loads of the configuration workbook into this environment |
| `PUT /environment-promotion/environment` | mark this database as an environment (`system.environment`); refused on a locked database unless production; audited `environment / mark` |

Settings: `promotion.path` (order of the environment codes), `promotion.environment_labels`. `system.environment` is
owned by this screen (`lib/settingOwners.js`) and is never exported or loaded by a workbook
(`data-load/configuration.js`, `NOT_LOADED`).

Requirements: TIS-BRD-NFR-08, TIS-BRD-NFR-8.2, Pre-BSM M17. Test: `test/environment-promotion.test.js`.
