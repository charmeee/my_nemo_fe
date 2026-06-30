import { defineConfig, devices } from '@playwright/test';

// Lighthouse 전용 config. Vite preview(production build)에 대고 측정하기 위해
// 일반 e2e config(dev server 5173)와 분리.
// 사전 단계: `vite build`로 dist 생성 → webServer 가 vite preview 4173 띄움.
export default defineConfig({
  testDir: './tests/lighthouse',
  timeout: 600_000,
  retries: 0,
  workers: 1,
  reporter: [['line']],
  use: {
    baseURL: 'http://localhost:4173',
  },
  webServer: {
    command: 'pnpm preview --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
