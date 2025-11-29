import { defineConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const shouldRunE2E = process.env.RUN_E2E === 'true' || Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL,
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  // Keep playwright opt-in unless RUN_E2E or E2E_BASE_URL is provided.
  ...(shouldRunE2E ? {} : { forbidOnly: false }),
});
