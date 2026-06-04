import { defineConfig, devices } from '@playwright/test';
import { dirname } from 'node:path';

import type { PluginOptions } from '@grafana/plugin-e2e';

const pluginE2eAuth = `${dirname(require.resolve('@grafana/plugin-e2e'))}/auth`;

export default defineConfig<PluginOptions>({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }]],
  // Seeds VictoriaLogs with test data before any test runs.
  globalSetup: require.resolve('./tests/global-setup'),
  use: {
    baseURL: process.env.GRAFANA_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    // Keep the browser in UTC so that absolute time ranges set in tests
    // match the UTC timestamps of the logs seeded into VictoriaLogs.
    timezoneId: 'UTC',
    // Use the e2e-only provisioning dir mounted by docker-compose.e2e.yaml.
    provisioningRootDir: 'tests/provisioning',
  },
  projects: [
    // Log in to Grafana with admin user and store the cookie on disk for use in other tests.
    {
      name: 'auth',
      testDir: pluginE2eAuth,
      testMatch: [/.*\.js/],
    },
    // Run all tests in parallel using user with admin role.
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/admin.json' },
      dependencies: ['auth'],
    },
  ],
});
