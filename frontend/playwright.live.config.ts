import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/live-journey.spec.ts',
  workers: 1,
  retries: 1,
  timeout: 90000,
  use: {
    baseURL: 'http://127.0.0.1:4175',
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175',
    env: { VITE_SERVICE_MODE: 'http' },
    reuseExistingServer: false,
    timeout: 60000,
  },
})
