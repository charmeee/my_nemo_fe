import { test, expect } from '@playwright/test';
import { injectAuth } from './helpers/auth';

/**
 * 시나리오 3: 앨범 생성 플로우
 * - "새 앨범" → 이름 입력 → "만들기" → 에디터로 이동
 */
test.describe('앨범 생성', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
  });

  test('앨범 생성 후 에디터로 자동 이동', async ({ page }) => {
    await page.goto('/albums');
    await page.locator('button', { hasText: '새 앨범' }).click();

    const input = page.locator('input[placeholder*="앨범 이름"]');
    await expect(input).toBeVisible({ timeout: 4000 });

    const albumName = `E2E 테스트_${Date.now()}`;
    await input.fill(albumName);

    await page.screenshot({ path: 'e2e/screenshots/03_album_name_input.png', fullPage: true });

    await page.locator('button', { hasText: '만들기' }).click();

    // 앨범 생성 후 에디터(/albums/:id)로 이동
    await page.waitForURL(/\/albums\/[a-f0-9-]+$/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/albums\/[a-f0-9-]+$/);

    await page.screenshot({ path: 'e2e/screenshots/03_after_create_editor.png', fullPage: true });
  });

  test('Enter키로 앨범 생성', async ({ page }) => {
    await page.goto('/albums');
    await page.locator('button', { hasText: '새 앨범' }).click();

    const input = page.locator('input[placeholder*="앨범 이름"]');
    await input.fill(`Enter키 앨범_${Date.now()}`);
    await input.press('Enter');

    await page.waitForURL(/\/albums\/[a-f0-9-]+$/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/albums\/[a-f0-9-]+$/);
  });

  test('취소 버튼으로 입력폼 닫기', async ({ page }) => {
    await page.goto('/albums');
    await page.locator('button', { hasText: '새 앨범' }).click();
    await expect(page.locator('input[placeholder*="앨범 이름"]')).toBeVisible({ timeout: 4000 });

    await page.locator('button', { hasText: '취소' }).click();
    await expect(page.locator('input[placeholder*="앨범 이름"]')).not.toBeVisible({ timeout: 4000 });
  });
});
