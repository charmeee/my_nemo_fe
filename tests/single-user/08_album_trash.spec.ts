import { test, expect } from '@playwright/test';
import { ALICE_AUTH } from '../helpers/users';
import {
  acceptAllDialogs,
  createAlbumViaUI,
  deleteAlbumViaSettings,
  fillPageWithThreeElements,
  gotoTrash,
  restoreFirstInTrash,
} from '../helpers/scenarios';
import { drawRect, getSceneElementCount, waitCanvas } from '../helpers/canvas';

test.use({ storageState: ALICE_AUTH });

test.describe('A-08 앨범 삭제 → 복원 → 편집 가능', () => {
  test('앨범 휴지통 이동 후 복원 → 에디터 재진입 시 요소 유지 + 신규 편집', async ({ page }) => {
    acceptAllDialogs(page);
    const name = `AlbumTrash-A08-${Date.now()}`;
    await createAlbumViaUI(page, name);
    await fillPageWithThreeElements(page);
    const before = await getSceneElementCount(page);
    if (before >= 0) expect(before).toBe(3);

    // 앨범 삭제
    await deleteAlbumViaSettings(page);
    await expect(page).toHaveURL(/\/albums$/);
    await expect(page.getByText(name).first()).toBeHidden({ timeout: 5_000 });

    // 휴지통: TrashCard에 앨범 이름이 표시되지 않으므로 '앨범' 타입 카드 + 복원 버튼 존재만 검증
    await gotoTrash(page);
    await expect(page.getByText(/일 후 영구 삭제/).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: '복원' }).first()).toBeVisible();

    // 복원
    await restoreFirstInTrash(page);

    // 앨범 목록에서 이름 다시 노출
    await page.goto('/albums');
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 5_000 });

    // 에디터 재진입
    await page.getByText(name).first().click();
    await page.waitForURL(/\/albums\/[a-f0-9-]+$/, { timeout: 8_000 });
    await waitCanvas(page);

    const after = await getSceneElementCount(page);
    if (after >= 0) expect(after).toBe(3);

    await drawRect(page, { offsetX: 120, offsetY: 0, tool: 'r' });
    await page.waitForTimeout(400);
    const final = await getSceneElementCount(page);
    if (final >= 0) expect(final).toBe(4);
  });
});
