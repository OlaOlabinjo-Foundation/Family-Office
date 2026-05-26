import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./test/setup.js'],
    environment: 'node',
    include: ['src/**/*.test.js'],
    pool: 'forks',
    singleFork: true,
    testTimeout: 20_000,
  },
});
