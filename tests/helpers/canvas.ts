import { expect, type Page } from '@playwright/test';

const CANVAS_SELECTOR = '.excalidraw canvas, [class*="excalidraw"] canvas, canvas';

export async function waitCanvas(page: Page): Promise<void> {
  await page.waitForSelector(CANVAS_SELECTOR, { timeout: 15_000 });
  await page.waitForTimeout(800);
}

async function canvasBox(page: Page) {
  const canvas = page.locator(CANVAS_SELECTOR).first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas bounding box not available');
  return box;
}

/**
 * Excalidraw 캔버스의 (offsetX, offsetY) 좌표 부근에 사각형을 드래그로 그린다.
 * tool: 'r' (rectangle), 'o' (ellipse), 'd' (diamond), 't' (text)
 */
export async function drawRect(
  page: Page,
  opts: { offsetX: number; offsetY: number; w?: number; h?: number; tool?: string } = { offsetX: 0, offsetY: 0 },
): Promise<void> {
  const { offsetX, offsetY, w = 120, h = 80, tool = 'r' } = opts;
  await page.keyboard.press(tool);
  await page.waitForTimeout(150);

  const box = await canvasBox(page);
  const cx = box.x + box.width / 2 + offsetX;
  const cy = box.y + box.height / 2 + offsetY;

  await page.mouse.move(cx - w / 2, cy - h / 2);
  await page.mouse.down();
  await page.mouse.move(cx + w / 2, cy + h / 2, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

export async function selectAllAndDelete(page: Page): Promise<void> {
  await page.keyboard.press('Control+a');
  await page.waitForTimeout(150);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(150);
}

/**
 * window.excalidrawAPI(있을 경우)로 element 개수 조회.
 * API 미노출 환경에서는 -1 반환.
 */
export async function getSceneElementCount(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const api = (window as unknown as { excalidrawAPI?: { getSceneElements: () => unknown[] } }).excalidrawAPI;
    if (!api) return -1;
    return api.getSceneElements().filter((el: unknown) => !(el as { isDeleted?: boolean }).isDeleted).length;
  });
}

/**
 * 양쪽 화면 element 카운트가 expected와 같아질 때까지 폴링 (최대 timeout ms).
 * API 미노출이면 그냥 timeout 대기 후 통과.
 */
export async function expectCountConverges(
  pages: Page[],
  expected: number,
  timeout = 5_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const counts = await Promise.all(pages.map(getSceneElementCount));
    if (counts.every((c) => c === -1)) {
      await pages[0].waitForTimeout(1_500);
      return;
    }
    if (counts.every((c) => c === expected)) return;
    await pages[0].waitForTimeout(250);
  }
  const final = await Promise.all(pages.map(getSceneElementCount));
  expect(final, `Scene element counts did not converge to ${expected}: got ${final.join(', ')}`).toEqual(
    pages.map(() => expected),
  );
}
