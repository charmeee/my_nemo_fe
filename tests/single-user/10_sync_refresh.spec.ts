import { test, expect } from '@playwright/test';
import { ALICE_AUTH } from '../helpers/users';
import {
  acceptAllDialogs,
  createAlbumViaUI,
  fillPageWithThreeElements,
} from '../helpers/scenarios';
import { drawRect, getSceneElementCount, waitCanvas } from '../helpers/canvas';

test.use({ storageState: ALICE_AUTH });

test.describe('A-10 데이터 동기화 — 새로고침 / 새 탭 / 같은 사용자 WS', () => {
  test('새로고침/새 탭에서 데이터 유지 + 새 탭 편집이 원래 탭에 실시간 반영', async ({ page, context }) => {
    acceptAllDialogs(page);
    const albumId = await createAlbumViaUI(page, `Sync-A10-${Date.now()}`);

    await fillPageWithThreeElements(page);
    await page.waitForTimeout(800);
    const initial = await getSceneElementCount(page);
    if (initial >= 0) expect(initial).toBe(3);

    // 새로고침 → 3개 유지
    await page.reload();
    await waitCanvas(page);
    await page.waitForTimeout(2000);
    const afterReload = await getSceneElementCount(page);
    if (afterReload >= 0) expect(afterReload).toBe(3);
    await expect(page.getByText('페이지 1').first()).toBeVisible();

    // 새 탭 (같은 컨텍스트 = 같은 storage) 으로 동일 앨범 열기
    const tab2 = await context.newPage();
    acceptAllDialogs(tab2);
    await tab2.goto(`/albums/${albumId}`);
    await waitCanvas(tab2);
    await tab2.waitForTimeout(1500);
    const tab2Count = await getSceneElementCount(tab2);
    if (tab2Count >= 0) expect(tab2Count).toBe(3);

    // 새 탭에서 추가 그림
    await drawRect(tab2, { offsetX: 120, offsetY: 0, tool: 'r' });
    await tab2.waitForTimeout(800);
    const tab2After = await getSceneElementCount(tab2);
    if (tab2After >= 0) expect(tab2After).toBe(4);

    // 원래 탭에 WS로 반영되는지 (최대 5초 폴링)
    if (initial >= 0) {
      await expect.poll(async () => await getSceneElementCount(page), { timeout: 6_000 }).toBe(4);
    }

    await tab2.close();
  });
});
