import { test, expect, gotoEditor } from '../helpers/multiUser';
import { acceptAllDialogs, addPage, fillPageWithThreeElements, waitForSync } from '../helpers/scenarios';
import { drawRect, expectCountConverges, waitCanvas } from '../helpers/canvas';

test.describe('B-04 멀티유저 새 페이지 생성 동기화', () => {
  test('Alice가 새 페이지 추가 시 Bob 탭에도 노출 + 페이지 내 요소 동기화', async ({ alice, bob, collabAlbum }) => {
    acceptAllDialogs(alice.page);
    acceptAllDialogs(bob.page);

    await gotoEditor(alice.page, collabAlbum.albumId);
    await waitCanvas(alice.page);
    await gotoEditor(bob.page, collabAlbum.albumId);
    await waitCanvas(bob.page);

    // 현재 페이지 탭 수 기준점 (collabAlbum은 페이지 1만 있을 수 있음)
    await addPage(alice.page);
    await waitForSync(alice.page, 800);

    // Bob 탭 목록에 새 페이지 노출
    await waitForSync(bob.page, 1500);
    const aliceTabsCount = await alice.page.locator('div').filter({ hasText: /^페이지 \d+$/ }).count();
    await expect.poll(async () =>
      bob.page.locator('div').filter({ hasText: /^페이지 \d+$/ }).count(),
      { timeout: 6_000 },
    ).toBeGreaterThanOrEqual(aliceTabsCount);

    // Alice 새 페이지에 3개 요소
    await fillPageWithThreeElements(alice.page);
    await waitForSync(alice.page, 500);

    // Bob: 최신 탭으로 전환
    const bobNewTab = bob.page.locator('div').filter({ hasText: /^페이지 \d+$/ }).last();
    await bobNewTab.click();
    await waitCanvas(bob.page);
    await waitForSync(bob.page, 1500);
    await expectCountConverges([alice.page, bob.page], 3, 6000);

    // Bob 새 그림 추가
    await drawRect(bob.page, { offsetX: 150, offsetY: 0, tool: 'r' });
    await waitForSync(bob.page, 500);
    await expectCountConverges([alice.page, bob.page], 4, 6000);
  });
});
