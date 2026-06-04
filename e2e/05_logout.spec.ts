import { test, expect } from '@playwright/test';
import { injectAuth } from './helpers/auth';

/**
 * 시나리오 5: 로그아웃 플로우
 * - 앨범 목록 → 로그아웃 버튼 클릭 → /login 리다이렉트
 * - localStorage 토큰 제거 확인
 */
test.describe('로그아웃', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
  });

  test('로그아웃 후 /login 리다이렉트', async ({ page }) => {
    await page.goto('/albums');
    await expect(page.locator('button', { hasText: '로그아웃' })).toBeVisible({ timeout: 8000 });

    await page.screenshot({ path: 'e2e/screenshots/05_before_logout.png', fullPage: true });

    await page.locator('button', { hasText: '로그아웃' }).click();
    await page.waitForURL('**/login', { timeout: 8000 });

    await expect(page).toHaveURL(/\/login/);
    await page.screenshot({ path: 'e2e/screenshots/05_after_logout.png', fullPage: true });
  });

  test('로그아웃 후 /albums 재접근 시 /login으로 돌아옴', async ({ page }) => {
    await page.goto('/albums');
    await page.locator('button', { hasText: '로그아웃' }).click();
    await page.waitForURL('**/login', { timeout: 8000 });

    // 토큰 없이 /albums 재시도
    await page.goto('/albums');
    await page.waitForURL('**/login', { timeout: 8000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('로그아웃 후 localStorage accessToken 제거 확인', async ({ page }) => {
    await page.goto('/albums');
    await page.locator('button', { hasText: '로그아웃' }).click();
    await page.waitForURL('**/login', { timeout: 8000 });

    const token = await page.evaluate(() => {
      const auth = localStorage.getItem('auth');
      if (!auth) return null;
      return JSON.parse(auth)?.state?.accessToken ?? null;
    });
    expect(token).toBeNull();
  });
});
