import { test, expect } from '@playwright/test';
import { injectAuth } from './helpers/auth';

const EXISTING_ALBUM_ID = 'ff59f021-a62c-4640-ba5c-490a88577303';

/**
 * 시나리오 4: 앨범 에디터 (TLDraw)
 * - 기존 앨범 에디터 직접 진입
 * - TLDraw 캔버스 로드 확인
 * - 에디터 헤더 (앨범명, 목록으로 이동) 확인
 */
test.describe('앨범 에디터', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
  });

  test('에디터 진입 - 헤더에 앨범명 노출', async ({ page }) => {
    await page.goto(`/albums/${EXISTING_ALBUM_ID}`);
    await expect(page.locator('text=첫 번째 앨범')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=← 앨범 목록')).toBeVisible({ timeout: 4000 });
    await page.screenshot({ path: 'e2e/screenshots/04_editor_header.png', fullPage: true });
  });

  test('TLDraw 캔버스 렌더링', async ({ page }) => {
    await page.goto(`/albums/${EXISTING_ALBUM_ID}`);
    // TLDraw는 canvas 또는 .tl-canvas 컨테이너를 렌더링
    const canvas = page.locator('canvas, .tl-canvas, [class*="tldraw"]').first();
    await expect(canvas).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'e2e/screenshots/04_editor_tldraw.png', fullPage: true });
  });

  test('"← 앨범 목록" 클릭 시 /albums로 이동', async ({ page }) => {
    await page.goto(`/albums/${EXISTING_ALBUM_ID}`);
    await expect(page.locator('text=← 앨범 목록')).toBeVisible({ timeout: 10000 });
    await page.locator('text=← 앨범 목록').click();
    await expect(page).toHaveURL(/\/albums$/, { timeout: 8000 });
  });
});
