import { test, expect } from '@playwright/test';
import { SOLO_AUTH } from '../helpers/users';
import {
  acceptAllDialogs,
  createAlbumViaUI,
  deleteAlbumViaSettings,
  gotoTrash,
  permanentDeleteFirstInTrash,
} from '../helpers/scenarios';

test.use({ storageState: SOLO_AUTH });

test.describe('A-09 앨범 재삭제 → 휴지통 영구 삭제', () => {
  test('앨범 휴지통 이동 후 영구 삭제 → 옛 URL 직접 접근 차단', async ({ page }) => {
    acceptAllDialogs(page);
    const albumId = await createAlbumViaUI(page, `Perm-A09-${Date.now()}`);

    // 휴지통 이동
    await deleteAlbumViaSettings(page);

    // 휴지통 진입: 앨범 타입 카드가 적어도 1개 존재
    await gotoTrash(page);
    const cardCountBefore = await page.getByRole('button', { name: '영구 삭제' }).count();
    expect(cardCountBefore).toBeGreaterThanOrEqual(1);

    // 첫 카드 영구 삭제
    await permanentDeleteFirstInTrash(page);
    await page.waitForTimeout(500);

    // 카드 개수 감소 또는 빈 휴지통
    const cardCountAfter = await page.getByRole('button', { name: '영구 삭제' }).count();
    expect(cardCountAfter).toBe(cardCountBefore - 1);

    // 옛 albumId 직접 접근 → 404/리다이렉트/에러 (에디터로 정상 진입은 안 됨)
    await page.goto(`/albums/${albumId}`);
    await page.waitForTimeout(2000);
    // 에디터 진입 표시인 '+ 페이지' 버튼이 보이면 실패
    await expect(page.getByRole('button', { name: '+ 페이지' })).toBeHidden({ timeout: 3_000 });
  });
});
