import { test as setup, expect } from '@playwright/test';
import { testLogin, type TestUser } from './helpers/api';
import { ALICE, ALICE_AUTH, BOB, BOB_AUTH } from './helpers/users';

const FRONT_BASE = process.env.E2E_FRONT_BASE ?? 'http://localhost:5173';

async function seedAuth(
  page: import('@playwright/test').Page,
  context: import('@playwright/test').BrowserContext,
  user: TestUser,
  storagePath: string,
) {
  const { accessToken } = await testLogin(user);

  await page.goto(`${FRONT_BASE}/login`);
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

  await page.goto(`${FRONT_BASE}/albums`);
  await expect(page).toHaveURL(/\/albums(\?|$)/, { timeout: 8_000 });

  await context.storageState({ path: storagePath });
}

setup('seed alice auth', async ({ page, context }) => {
  await seedAuth(page, context, ALICE, ALICE_AUTH);
});

setup('seed bob auth', async ({ page, context }) => {
  await seedAuth(page, context, BOB, BOB_AUTH);
});
