import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // lighthouse는 production build에 대고 측정해야 해서 별도 config(playwright.lighthouse.config.ts)로 분리
  testIgnore: ['**/lighthouse/**'],
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Alice/Bob 단일 계정을 공유하므로 워커 1개로 고정 (병렬 충돌 방지)
  workers: 1,
  reporter: [['html', { outputFolder: 'tests/report', open: 'never' }], ['line']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts$/,
    },
    {
      name: 'chromium',
      testMatch: /.*\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
});
