import { defineConfig } from 'vitest/config';

// E2E tests need PostgreSQL. They use TEST_DATABASE_URL (default: the local
// news_hoster_test database) and wipe its schema on every run.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
