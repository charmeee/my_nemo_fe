import { test, expect } from '@playwright/test';

/**
 * 시나리오 1: 비인증 사용자 접근 보호
 * - 토큰 없이 /albums 진입 시 /login으로 리다이렉트
 * - 로그인 페이지 UI 확인
 */
test.describe('인증 가드', () => {
  test('비인증 사용자 → /albums 접근 시 /login 리다이렉트', async ({ page }) => {
    await page.goto('/albums');
    await page.waitForURL('**/login', { timeout: 8000 });
    await expect(page).toHaveURL(/\/login/);
    await page.screenshot({ path: 'e2e/screenshots/01_login_redirect.png', fullPage: true });
  });

  test('로그인 페이지 - 카카오 로그인 버튼 노출', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=카카오').or(page.locator('[class*=kakao]')).or(page.locator('a[href*=kakao]'))).toBeVisible({ timeout: 8000 });
    await page.screenshot({ path: 'e2e/screenshots/01_login_page.png', fullPage: true });
  });
});
