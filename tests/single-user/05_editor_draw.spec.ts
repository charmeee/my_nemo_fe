import path from 'node:path';
import { test, expect } from '@playwright/test';
import { SOLO_AUTH } from '../helpers/users';
import { createAlbumViaUI, acceptAllDialogs } from '../helpers/scenarios';
import {
  addImageToCanvas,
  drawRect,
  selectAllAndDelete,
  getSceneElementCount,
  waitCanvas,
} from '../helpers/canvas';

test.use({ storageState: SOLO_AUTH });

const IMAGE_FIXTURE = path.resolve(
  process.cwd(),
  'tests/asset/KakaoTalk_Photo_2026-06-15-14-32-13 001.jpeg',
);

test.describe('A-05 캔버스 도형 + 새로고침 유지 + 이미지 업로드', () => {
  test('도형 4종(rect/ellipse/diamond/rect) 추가 후 새로고침 시 요소 유지', async ({ page }) => {
    acceptAllDialogs(page);
    await createAlbumViaUI(page, `Draw-A05-${Date.now()}`);

    await drawRect(page, { offsetX: -120, offsetY: -40, tool: 'r' });
    await drawRect(page, { offsetX: 60, offsetY: -40, tool: 'o' });
    await drawRect(page, { offsetX: -60, offsetY: 60, tool: 'd' });
    await drawRect(page, { offsetX: 120, offsetY: 60, tool: 'r' });

    const before = await getSceneElementCount(page);
    if (before >= 0) expect(before).toBe(4);

    await page.waitForTimeout(800);
    await page.reload();
    await waitCanvas(page);
    await page.waitForTimeout(2000);

    const after = await getSceneElementCount(page);
    if (after >= 0) {
      expect(after).toBe(4);
    } else {
      await expect(page.locator('canvas').first()).toBeVisible();
    }
  });

  test('이미지 업로드 → 캔버스 삽입 + 전체 선택 삭제', async ({ page }) => {
    acceptAllDialogs(page);
    await createAlbumViaUI(page, `Image-A05-${Date.now()}`);

    await drawRect(page, { offsetX: -100, offsetY: -40, tool: 'r' });
    const baseCount = await getSceneElementCount(page);

    await addImageToCanvas(page, IMAGE_FIXTURE);

    const after = await getSceneElementCount(page);
    if (baseCount >= 0 && after >= 0) {
      expect(after).toBeGreaterThanOrEqual(baseCount + 1);
    }

    await selectAllAndDelete(page);
    await page.waitForTimeout(400);
    const final = await getSceneElementCount(page);
    if (final >= 0) expect(final).toBe(0);
  });
});
