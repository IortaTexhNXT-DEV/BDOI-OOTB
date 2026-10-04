const brandVars = require('./scripts/postcss-brand-vars');

module.exports = {
  // Runtime broker theming: literal brand colours in the compiled CSS become CSS custom properties
  // (scripts/postcss-brand-vars.js; values set by src/theme/runtime/themeEngine.js).
  style: {
    postcss: {
      mode: 'extends',
      loaderOptions: (postcssLoaderOptions) => {
        const opts = postcssLoaderOptions.postcssOptions || {};
        const base = opts.plugins;
        const plugins = typeof base === 'function' ? base() : base || [];
        return { ...postcssLoaderOptions, postcssOptions: { ...opts, plugins: [...plugins, brandVars] } };
      },
    },
  },
  webpack: {
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
};
