import { defineConfig } from '@playwright/test'

// Live E2E suite targets the assembled Docker Compose app with PostgreSQL.
export default defineConfig({
  testDir: './e2e/features',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90000,
  expect: { timeout: 10000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:8000',
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
