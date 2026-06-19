import { test, expect, gotoEditor } from '../helpers/multiUser';
import {
  acceptAllDialogs,
  addPage,
  deleteCurrentPage,
  fillPageWithThreeElements,
  gotoTrash,
  restoreFirstInTrash,
  waitForSync,
} from '../helpers/scenarios';
import { drawRect, expectCountConverges, getSceneElementCount, waitCanvas } from '../helpers/canvas';

test.describe('B-05 멀티유저 페이지 삭제/복원 동기화', () => {
  test('Alice가 페이지 삭제하면 Bob 화면도 사라지고, 복원 후 양쪽 모두 노출 + 편집 동기화', async ({ alice, bob, collabAlbum }) => {
    acceptAllDialogs(alice.page);
    acceptAllDialogs(bob.page);

    await gotoEditor(alice.page, collabAlbum.albumId);
    await waitCanvas(alice.page);

    await fillPageWithThreeElements(alice.page);
    await addPage(alice.page);
    await drawRect(alice.page, { offsetX: 0, offsetY: 0, tool: 'r' });
    await waitForSync(alice.page, 500);

    await gotoEditor(bob.page, collabAlbum.albumId);
    await waitCanvas(bob.page);
    await waitForSync(bob.page, 1500);

    // Alice: 페이지 2 활성 후 삭제
    await alice.page.getByText('페이지 2').first().click();
    await waitCanvas(alice.page);
    await deleteCurrentPage(alice.page);
    await waitForSync(alice.page, 500);

    // Bob 화면에서도 페이지 2 사라짐
    await expect.poll(async () =>
      await bob.page.getByText('페이지 2').first().isVisible().catch(() => false),
      { timeout: 6_000 },
    ).toBeFalsy();

    // Alice: 휴지통에서 복원
    await gotoTrash(alice.page);
    await expect(alice.page.getByText(/페이지/).first()).toBeVisible();
    await restoreFirstInTrash(alice.page);

    // Alice: 에디터로 복귀
    await gotoEditor(alice.page, collabAlbum.albumId);
    await waitCanvas(alice.page);
    await expect(alice.page.getByText('페이지 2').first()).toBeVisible({ timeout: 8_000 });

    // Bob: 새로고침 후 복원된 페이지 노출
    await bob.page.reload();
    await waitCanvas(bob.page);
    await expect(bob.page.getByText('페이지 2').first()).toBeVisible({ timeout: 8_000 });

    // 복원된 페이지에서 추가 편집 → 동기화
    await alice.page.getByText('페이지 2').first().click();
    await bob.page.getByText('페이지 2').first().click();
    await waitCanvas(alice.page);
    await waitCanvas(bob.page);
    const aliceBase = await getSceneElementCount(alice.page);
    await drawRect(alice.page, { offsetX: 100, offsetY: 0, tool: 'o' });
    await waitForSync(alice.page, 500);
    if (aliceBase >= 0) await expectCountConverges([alice.page, bob.page], aliceBase + 1, 6000);
  });
});
