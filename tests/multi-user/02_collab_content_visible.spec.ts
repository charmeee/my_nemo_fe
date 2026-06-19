import { test, expect, gotoEditor } from '../helpers/multiUser';
import { acceptAllDialogs, addPage, fillPageWithThreeElements, waitForSync } from '../helpers/scenarios';
import { expectCountConverges, getSceneElementCount, waitCanvas } from '../helpers/canvas';

test.describe('B-02 멀티유저 콘텐츠 가시성', () => {
  test('Alice가 그린 페이지1/2 요소가 Bob 화면에 모두 보임', async ({ alice, bob, collabAlbum }) => {
    acceptAllDialogs(alice.page);
    acceptAllDialogs(bob.page);

    await gotoEditor(alice.page, collabAlbum.albumId);
    await waitCanvas(alice.page);

    // Alice 페이지 1에 요소 3개
    await fillPageWithThreeElements(alice.page);
    await waitForSync(alice.page, 800);

    // Alice 페이지 2 추가 + 요소 3개
    await addPage(alice.page);
    await fillPageWithThreeElements(alice.page, 50);
    await waitForSync(alice.page, 800);

    // Bob 에디터 진입
    await gotoEditor(bob.page, collabAlbum.albumId);
    await waitCanvas(bob.page);
    await waitForSync(bob.page, 1500);

    // 동기화 상태 필 확인
    await expect(
      bob.page.getByText('실시간 동기화').or(bob.page.getByText('연결 중')).first(),
    ).toBeVisible({ timeout: 8_000 });

    // Bob 페이지 1 element count
    const bobP1 = await getSceneElementCount(bob.page);
    if (bobP1 >= 0) expect(bobP1).toBe(3);

    // Bob 페이지 2로 전환 → element count
    await bob.page.getByText('페이지 2').first().click();
    await waitCanvas(bob.page);
    await waitForSync(bob.page, 1000);
    const bobP2 = await getSceneElementCount(bob.page);
    if (bobP2 >= 0) expect(bobP2).toBe(3);

    // 양쪽 페이지 1로 전환 → 카운트 일치
    await alice.page.getByText('페이지 1').first().click();
    await bob.page.getByText('페이지 1').first().click();
    await expectCountConverges([alice.page, bob.page], 3, 6000);
  });
});
