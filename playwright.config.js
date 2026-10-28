import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.BASE64_TEST_PORT || 4173)
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  fullyParallel: true,
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: `npm run preview -- --port ${port}`, url: baseURL, reuseExistingServer: false },
})
