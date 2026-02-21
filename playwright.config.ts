import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for JARVIS
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Visual testing configuration
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Enable visual testing
        screenshot: 'only-on-failure',
      },
    },
    // Mobile testing
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    // Tablet testing
    {
      name: 'Tablet',
      use: { ...devices['iPad Mini'] },
    },
    // Visual regression testing (desktop)
    {
      name: 'visual-regression',
      testMatch: /visual\.spec\.ts/,
      use: { 
        ...devices['Desktop Chrome'],
        screenshot: 'on',
      },
    },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  // Snapshot directory for visual regression tests
  snapshotDir: './tests/e2e/snapshots',
  // Output directory for test results
  outputDir: './test-results',
});
