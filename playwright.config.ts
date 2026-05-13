import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  use: {
    ...devices['Desktop Chrome'],
    // On some Windows setups Vite binds IPv6 localhost but not 127.0.0.1.
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    // Use npm script; Playwright injects env below so this is cross-platform.
    command: 'npm run dev:e2e',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      FAMILY_OFFICE_SQLITE: ':memory:',
      SKIP_WORKBOOK_BOOTSTRAP: '1',
    },
  },
})
