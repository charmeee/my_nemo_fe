import { test, chromium, type Page, type BrowserContext } from '@playwright/test';
import { playAudit } from 'playwright-lighthouse';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { testLogin, createAlbum } from '../helpers/api';
import { SOLO } from '../helpers/users';

const PORT = 9222;
const FRONT_BASE = process.env.E2E_FRONT_BASE ?? 'http://localhost:5173';
const REPORT_DIR = 'tests/lighthouse/reports';

mkdirSync(REPORT_DIR, { recursive: true });

// 폐쇄형 SNS라 SEO 점수는 의미 없음 → 측정 카테고리에서 제외
const CATEGORIES = ['performance', 'accessibility', 'best-practices'] as const;
const thresholds = {
  performance: 0,
  accessibility: 0,
  'best-practices': 0,
};

test.describe.configure({ mode: 'serial', timeout: 600_000 });

async function audit(page: Page, url: string, name: string) {
  await page.goto('about:blank');
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  await playAudit({
    page,
    port: PORT,
    thresholds,
    opts: { onlyCategories: [...CATEGORIES] },
    reports: {
      formats: { html: true, json: true },
      name: `${name}-${stamp}`,
      directory: REPORT_DIR,
    },
  });
}

async function injectAuth(page: Page, accessToken: string) {
  await page.goto(`${FRONT_BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ token }) => {
      localStorage.setItem('accessToken', token);
      localStorage.setItem(
        'auth',
        JSON.stringify({
          state: { accessToken: token, user: null, _hasHydrated: true },
          version: 0,
        }),
      );
      localStorage.setItem('nemo-theme', 'light');
    },
    { token: accessToken },
  );
}

test('lighthouse: all pages', async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'nemo-lh-'));
  let context: BrowserContext | undefined;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      args: [`--remote-debugging-port=${PORT}`],
      headless: true,
    });
    const page = context.pages()[0] ?? (await context.newPage());

    const { accessToken } = await testLogin(SOLO);
    const album = await createAlbum(accessToken, `Lighthouse-${Date.now()}`);
    await injectAuth(page, accessToken);

    await audit(page, `${FRONT_BASE}/albums`, 'albums');
    await audit(page, `${FRONT_BASE}/albums/${album.id}`, 'album-editor');
    await audit(page, `${FRONT_BASE}/trash`, 'trash');
    // /login under Vite dev + headless emits runtimeError NO_FCP because the
    // lazy-loaded LoginPage paints no FCP-eligible content before the chunk lands.
    await audit(page, `${FRONT_BASE}/login`, 'login');
  } finally {
    await context?.close();
    rmSync(userDataDir, { recursive: true, force: true });
  }
});
