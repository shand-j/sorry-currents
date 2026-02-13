import { PlaywrightTestConfig } from '@playwright/test';

/**
 * Baseline config — no sorry-currents reporter.
 * Used by the playwright-baseline.yml workflow for comparison.
 */
const config: PlaywrightTestConfig = {
  testDir: 'src/scenarios',
  timeout: 120000,
  retries: 2,
  use: {
    trace: 'on',
    locale: 'pt-BR',
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    screenshot: 'on',
    video: 'off',
  },
  expect: {
    timeout: 30000,
  },
  reporter: [
    ['html', { outputFolder: 'artifacts/report', open: 'never' }],
  ],
};
export default config;
