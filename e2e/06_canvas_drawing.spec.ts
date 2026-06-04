import { test, expect } from '@playwright/test';
import { injectAuth } from './helpers/auth';

const ALBUM_ID = 'ff59f021-a62c-4640-ba5c-490a88577303';

/**
 * 시나리오 6: 캔버스 도형 그리기
 * - TLDraw에서 연필 도구로 드로잉
 * - 도형(사각형) 그리기
 */
test.describe('캔버스 편집 - 도형 그리기', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await page.goto(`/albums/${ALBUM_ID}`);
    // TLDraw 캔버스가 로드될 때까지 대기
    await page.waitForSelector('.tl-canvas, canvas, [data-testid="canvas"]', { timeout: 15000 });
    // 추가 안정화 대기
    await page.waitForTimeout(2000);
  });

  test('TLDraw 툴바 렌더링 확인', async ({ page }) => {
    // TLDraw 하단 툴바 확인
    const toolbar = page.locator('.tlui-toolbar, [class*="toolbar"]').first();
    await expect(toolbar).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'e2e/screenshots/06_canvas_toolbar.png' });
  });

  test('연필 도구로 자유 드로잉', async ({ page }) => {
    // D 키 단축키로 드로우 도구 선택
    await page.keyboard.press('d');
    await page.waitForTimeout(500);

    // 캔버스에서 드래그하여 그리기
    const canvas = page.locator('.tl-canvas').first();
    const box = await canvas.boundingBox();
    if (!box) { test.skip(); return; }

    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.mouse.move(cx - 80, cy - 40);
    await page.mouse.down();
    await page.mouse.move(cx, cy, { steps: 5 });
    await page.mouse.move(cx + 80, cy + 40, { steps: 5 });
    await page.mouse.up();

    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/06_canvas_draw_stroke.png' });
  });

  test('사각형 도구로 도형 생성', async ({ page }) => {
    // R 키로 사각형 도구 선택
    await page.keyboard.press('r');
    await page.waitForTimeout(300);

    const canvas = page.locator('.tl-canvas').first();
    const box = await canvas.boundingBox();
    if (!box) { test.skip(); return; }

    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // 사각형 그리기 (드래그)
    await page.mouse.move(cx - 60, cy - 40);
    await page.mouse.down();
    await page.mouse.move(cx + 60, cy + 40, { steps: 15 });
    await page.mouse.up();

    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/06_canvas_rectangle.png' });
  });

  test('선택 후 삭제', async ({ page }) => {
    // 먼저 사각형 그리기
    await page.keyboard.press('r');
    await page.waitForTimeout(200);

    const canvas = page.locator('.tl-canvas').first();
    const box = await canvas.boundingBox();
    if (!box) { test.skip(); return; }

    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.mouse.move(cx - 50, cy - 30);
    await page.mouse.down();
    await page.mouse.move(cx + 50, cy + 30, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    // Ctrl+A 로 전체 선택 후 Delete
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(200);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);

    await page.screenshot({ path: 'e2e/screenshots/06_canvas_after_delete.png' });
  });
});
