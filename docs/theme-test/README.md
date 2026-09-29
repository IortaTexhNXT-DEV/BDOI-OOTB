# Screen-by-screen theme test

Tooling used to test the themed build against every screen in the user-manual inventory
(116 screens, about 415 states: main view, tabs, create/add forms, validation, first record).

- `inventory.json`: the screen list and the live-site states (from the FinVerse user manual walk).
- `walk.py`, `capture.py`, `common.py`: the walker (read-only: every non-GET API call is aborted).
- `theme_walk.py`: serves the production build on 127.0.0.1:5051, bridges `http://localhost:8000/api`
  to the dev API, signs in, replays the walk and audits each state (old palette colours, non-Nunito
  text, text with the colour of its background, overflow, JS errors).
- `theme_report.py`: writes `../theme-screens/TEST_REPORT.md` and the contact sheets `screens-NN.jpg`
  (live screenshots come from the FinVerse repo, `tools/user-manual/screens`, when present).
- `audit-run1.json`, `inventory-run1.json`: results of the first run, before the fixes in the commit
  "Fix findings from the screen-by-screen theme test".

Run (Playwright for Python and Chromium needed; the dev test account password goes in `BV_PW`):

```bash
cd brokerverse && npm install --legacy-peer-deps
CI=false GENERATE_SOURCEMAP=false BUILD_PATH=/tmp/devbuild REACT_APP_BASE_URL=http://localhost:8000/api npm run build
cd ../docs/theme-test
BUILD_DIR=/tmp/devbuild BV_PW=... python3 theme_walk.py   # about 45 minutes
python3 theme_report.py
```
