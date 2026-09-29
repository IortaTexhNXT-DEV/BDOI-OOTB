module.exports = {
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
