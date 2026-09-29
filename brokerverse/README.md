# BrokerVerse front end

React front end of BrokerVerse, the insurance broking platform of iorta TechNXT. It talks to the
API in `../backend`.

```bash
npm ci --legacy-peer-deps
REACT_APP_BASE_URL=http://localhost:8000/api npm start     # development server on port 3000
REACT_APP_BASE_URL=/api npm run build                      # production build in build/
CI=true npm test -- --watchAll=false                       # unit tests
npm run check:api                                          # front-end calls vs backend routes
npm run check:i18n                                         # translation keys missing from en.json
```

How the code is organised, how to trace a defect and how to add a screen:
[docs/developer-guide/frontend.md](../docs/developer-guide/frontend.md).
