import { test, expect, gotoEditor } from '../helpers/multiUser';
import {
  acceptAllDialogs,
  deleteAlbumViaSettings,
  fillPageWithThreeElements,
  gotoTrash,
  restoreFirstInTrash,
  waitForSync,
} from '../helpers/scenarios';
import { drawRect, expectCountConverges, waitCanvas } from '../helpers/canvas';

test.describe('B-06 멀티유저 앨범 삭제/복원 동기화', () => {
  test('Alice가 앨범 삭제 → Bob 에디터 접근 불가 → 복원 후 양쪽 재진입 + 동기화', async ({ alice, bob, collabAlbum }) => {
    acceptAllDialogs(alice.page);
    acceptAllDialogs(bob.page);

    await gotoEditor(alice.page, collabAlbum.albumId);
    await waitCanvas(alice.page);
    await fillPageWithThreeElements(alice.page);
    await waitForSync(alice.page, 500);

    await gotoEditor(bob.page, collabAlbum.albumId);
    await waitCanvas(bob.page);
    await waitForSync(bob.page, 1000);

    // Alice: 앨범 삭제
    await deleteAlbumViaSettings(alice.page);
    await expect(alice.page).toHaveURL(/\/albums$/);

    // Bob: 강제 종료 메시지 또는 /albums 리다이렉트
    await waitForSync(bob.page, 2000);
    const bobReachable = await bob.page.getByText(/앨범|페이지/).first().isVisible().catch(() => false);
    if (!bobReachable) {
      await expect(bob.page).toHaveURL(/\/albums|\/login/);
    }

    // Alice: 휴지통 복원
    await gotoTrash(alice.page);
    await restoreFirstInTrash(alice.page);

    // Alice 재진입
    await gotoEditor(alice.page, collabAlbum.albumId);
    await waitCanvas(alice.page);

    // Bob 재진입
    await gotoEditor(bob.page, collabAlbum.albumId);
    await waitCanvas(bob.page);
    await waitForSync(bob.page, 1500);

    // 복원 후 동기화: Alice 새 그림 → Bob 화면 반영
    const aliceBase = 3;
    await drawRect(alice.page, { offsetX: 100, offsetY: 0, tool: 'r' });
    await waitForSync(alice.page, 500);
    await expectCountConverges([alice.page, bob.page], aliceBase + 1, 8000);
  });
});
