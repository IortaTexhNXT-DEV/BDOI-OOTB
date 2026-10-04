const path = require('path');
const { version } = require('./package.json');

// Shown in Help > About BrokerVerse: the version of the web application and when it was built.
process.env.REACT_APP_VERSION = process.env.REACT_APP_VERSION || version;
process.env.REACT_APP_BUILD_DATE = process.env.REACT_APP_BUILD_DATE || new Date().toISOString();

// Every `import { DataTable } from "primereact/datatable"` gets the application's DataTable (components/DataTable):
// the PrimeReact table with skeleton rows while the first rows load. The wrapper itself imports the PrimeReact
// module by its file name, which this alias does not match.
const DATATABLE_WRAPPER = path.resolve(__dirname, 'src/components/DataTable/index.jsx');

module.exports = {
  webpack: {
    alias: {
      'primereact/datatable$': DATATABLE_WRAPPER,
    },
    configure: (webpackConfig) => {
      const oneOfRule = webpackConfig.module.rules.find((rule) => rule.oneOf);
      if (oneOfRule?.oneOf) {
        oneOfRule.oneOf.forEach((rule) => {
          if (rule.enforce === 'pre' && rule.use?.some((u) => u.loader?.includes('source-map-loader'))) {
            const existing = rule.exclude;
            rule.exclude = Array.isArray(existing)
              ? [...existing, /@testing-library\/dom/]
              : [existing, /@testing-library\/dom/].filter(Boolean);
          }
        });
      }
      return webpackConfig;
    },
  },
  jest: {
    configure: (jestConfig) => ({
      ...jestConfig,
      moduleNameMapper: {
        ...(jestConfig.moduleNameMapper || {}),
        '^primereact/datatable$': '<rootDir>/src/components/DataTable/index.jsx',
        // Jest runs the CommonJS build of PrimeReact
        '^primereact/datatable/datatable\\.esm\\.js$': 'primereact/datatable/datatable.cjs.js',
      },
    }),
  },
};
