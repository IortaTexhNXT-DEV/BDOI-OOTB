import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'uploads/**', 'docs/**', 'coverage/**'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.node } },
    rules: {
      'no-console': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
    },
  },
  // Command-line scripts (migrate, seed, API export, purge) report progress on the console.
  { files: ['src/db/*.js', 'src/tools/*.js', 'scripts/*.js'], rules: { 'no-console': 'off' } },
  { files: ['test/**'], languageOptions: { globals: { ...globals.node } } },
];
