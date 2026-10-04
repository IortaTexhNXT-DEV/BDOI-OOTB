import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    // only this package's tests: never the agent worktrees under .claude or installed packages
    include: ['test/**/*.test.js'],
    exclude: ['**/node_modules/**', '**/.claude/**'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgres://brokerverse:brokerverse@127.0.0.1:5432/brokerverse_test', LOG_LEVEL: 'silent', ADMIN_PASSWORD: 'Test-Admin#2026' },
  },
});
