# BrokerVerse front end

React front end of BrokerVerse, the insurance broking platform of iorta TechNXT. It talks to the
API in `../backend`.

```bash
npm ci --legacy-peer-deps
REACT_APP_BASE_URL=http://localhost:8000/api npm start     # development server on port 3000
npm run build                                              # one production build for every environment, in build/
API_UPSTREAM=http://127.0.0.1:8000 ENVIRONMENT_NAME=UAT npm run serve   # serve build/ like the web server (port 3000)
npm run lint                                               # ESLint (errors fail)
CI=true npm test -- --watchAll=false                       # unit tests
npm run check:api                                          # front-end calls vs backend routes
npm run check:i18n                                         # translation keys missing from en.json
```

The build holds no environment settings. `/env-config.js`, written by the web server when it starts
(`scripts/env-config.sh`), gives the API address (empty: same origin `/api`, proxied to the backend) and the
environment name shown next to the logo outside production. The app reads them only through
`src/config/runtimeConfig.js`. Deployment: [deploy/RELEASE_PIPELINE.md](../deploy/RELEASE_PIPELINE.md).

How the code is organised, how to trace a defect and how to add a screen:
[docs/developer-guide/frontend.md](../docs/developer-guide/frontend.md).
