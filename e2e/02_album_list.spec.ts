import { test, expect } from '@playwright/test';
import { injectAuth } from './helpers/auth';

/**
 * 시나리오 2: 인증된 사용자의 앨범 목록 조회
 * - JWT 주입 → /albums 진입
 * - 기존 앨범 "첫 번째 앨범" 노출 확인
 * - 새 앨범 버튼 확인
 */
test.describe('앨범 목록', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
  });

  test('앨범 목록 페이지 정상 진입', async ({ page }) => {
    await page.goto('/albums');
    await expect(page.getByText('내 앨범', { exact: false })).toBeVisible({ timeout: 8000 });
    await page.screenshot({ path: 'e2e/screenshots/02_album_list.png', fullPage: true });
  });

  test('기존 앨범 "첫 번째 앨범" 노출', async ({ page }) => {
    await page.goto('/albums');
    await expect(page.locator('text=첫 번째 앨범')).toBeVisible({ timeout: 8000 });
  });

  test('"새 앨범" 버튼 노출 및 클릭 시 입력폼 표시', async ({ page }) => {
    await page.goto('/albums');
    const newAlbumBtn = page.locator('button', { hasText: '새 앨범' });
    await expect(newAlbumBtn).toBeVisible({ timeout: 8000 });

    await newAlbumBtn.click();
    await expect(page.locator('input[placeholder*="앨범 이름"]')).toBeVisible({ timeout: 4000 });
    await page.screenshot({ path: 'e2e/screenshots/02_album_create_form.png', fullPage: true });
  });
});
