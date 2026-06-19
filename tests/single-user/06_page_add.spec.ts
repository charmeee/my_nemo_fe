import { test, expect } from '@playwright/test';
import { ALICE_AUTH } from '../helpers/users';
import {
  acceptAllDialogs,
  addPage,
  createAlbumViaUI,
  drawTextAt,
  fillPageWithThreeElements,
  selectPageByIndex,
} from '../helpers/scenarios';
import { drawRect, getSceneElementCount, waitCanvas } from '../helpers/canvas';

test.use({ storageState: ALICE_AUTH });

test.describe('A-06 새 페이지 생성 & 페이지별 내용 분리', () => {
  test('페이지1(3개) + 페이지2(2개) 추가 후 탭 전환 시 내용 분리, 새로고침 시 유지', async ({ page }) => {
    acceptAllDialogs(page);
    await createAlbumViaUI(page, `PageAdd-A06-${Date.now()}`);

    await fillPageWithThreeElements(page);
    const p1Before = await getSceneElementCount(page);
    if (p1Before >= 0) expect(p1Before).toBe(3);

    await addPage(page);
    await expect(page.getByText('페이지 2').first()).toBeVisible();
    const newCount = await getSceneElementCount(page);
    if (newCount >= 0) expect(newCount).toBe(0);

    await drawRect(page, { offsetX: 0, offsetY: 0, tool: 'd' });
    await drawTextAt(page, 0, 80, 'Page2Text');
    const p2 = await getSceneElementCount(page);
    if (p2 >= 0) expect(p2).toBe(2);

    // 페이지 1로 전환 → 요소 3개 유지 확인
    await selectPageByIndex(page, 0);
    await waitCanvas(page);
    const p1After = await getSceneElementCount(page);
    if (p1After >= 0) expect(p1After).toBe(3);

    // 새로고침 후 페이지 탭 유지 확인
    await page.reload();
    await waitCanvas(page);
    await expect(page.getByText('페이지 1').first()).toBeVisible();
    await expect(page.getByText('페이지 2').first()).toBeVisible();
  });
});
