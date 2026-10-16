import { defineConfig, devices } from '@playwright/test';

// Test credentials live in web/.env.test.local (git-ignored), written by the user.
try {
  process.loadEnvFile('.env.test.local');
} catch {
  // Credentials can also come from the environment.
}

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  // With E2E_BASE_URL set (e.g. the docker compose `web` service), the server
  // already runs elsewhere: do not start a local one.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000/connexion',
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
