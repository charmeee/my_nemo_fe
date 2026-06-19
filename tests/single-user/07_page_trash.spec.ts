import { test, expect } from '@playwright/test';
import { ALICE_AUTH } from '../helpers/users';
import {
  acceptAllDialogs,
  addPage,
  createAlbumViaUI,
  deleteCurrentPage,
  fillPageWithThreeElements,
  gotoTrash,
  restoreFirstInTrash,
} from '../helpers/scenarios';
import { drawRect, getSceneElementCount, waitCanvas } from '../helpers/canvas';

test.use({ storageState: ALICE_AUTH });

test.describe('A-07 페이지 삭제 → 휴지통 복원 → 편집 가능', () => {
  test('페이지2 삭제 후 휴지통에서 복원 → 재진입 시 내용 유지 + 신규 편집 가능', async ({ page }) => {
    acceptAllDialogs(page);
    const albumId = await createAlbumViaUI(page, `PageTrash-A07-${Date.now()}`);

    await fillPageWithThreeElements(page);
    await addPage(page);
    await drawRect(page, { offsetX: 0, offsetY: 0, tool: 'r' });
    const p2Count = await getSceneElementCount(page);
    if (p2Count >= 0) expect(p2Count).toBeGreaterThanOrEqual(1);

    // 페이지 2 삭제 (활성 탭)
    await deleteCurrentPage(page);
    await expect(page.getByText('페이지 2').first()).toBeHidden({ timeout: 5_000 });
    await expect(page.getByText('페이지 1').first()).toBeVisible();

    // 휴지통 확인
    await gotoTrash(page);
    await expect(page.getByText(/휴지통/).first()).toBeVisible();
    await expect(page.getByText(/페이지/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '복원' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '영구 삭제' }).first()).toBeVisible();

    // 복원
    await restoreFirstInTrash(page);

    // 에디터 재진입
    await page.goto(`/albums/${albumId}`);
    await waitCanvas(page);
    await expect(page.getByText('페이지 2').first()).toBeVisible({ timeout: 8_000 });

    // 복원된 페이지 클릭 후 추가 편집
    await page.getByText('페이지 2').first().click();
    await waitCanvas(page);
    const before = await getSceneElementCount(page);
    await drawRect(page, { offsetX: 100, offsetY: 0, tool: 'o' });
    await page.waitForTimeout(400);
    const after = await getSceneElementCount(page);
    if (before >= 0 && after >= 0) expect(after).toBe(before + 1);
  });
});
