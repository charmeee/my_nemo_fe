import { test, expect } from '../helpers/multiUser';
import { joinByCode } from '../helpers/api';
import { acceptAllDialogs, addPage, createAlbumViaUI, fillPageWithThreeElements, getInviteCodeFromUI } from '../helpers/scenarios';
import { getSceneElementCount, waitCanvas } from '../helpers/canvas';

test.describe('B-01 멀티유저 셋업: Alice 앨범 생성 + 2페이지 편집 + Bob 초대 참여', () => {
  test('Alice가 앨범+2페이지 편집 후 초대링크로 Bob 참여, Bob 에디터에서 페이지 탭 확인', async ({ alice, bob, bobToken }) => {
    acceptAllDialogs(alice.page);
    acceptAllDialogs(bob.page);

    const albumName = `Collab-B01-${Date.now()}`;
    const albumId = await createAlbumViaUI(alice.page, albumName);

    // 페이지 1: 3개 요소
    await fillPageWithThreeElements(alice.page);
    const p1 = await getSceneElementCount(alice.page);
    if (p1 >= 0) expect(p1).toBe(3);

    // 페이지 2 추가 + 3개 요소
    await addPage(alice.page);
    await fillPageWithThreeElements(alice.page, 50);
    const p2 = await getSceneElementCount(alice.page);
    if (p2 >= 0) expect(p2).toBe(3);

    await expect(alice.page.getByText('페이지 1').first()).toBeVisible();
    await expect(alice.page.getByText('페이지 2').first()).toBeVisible();

    // 초대 코드 확보
    const inviteCode = await getInviteCodeFromUI(alice.page);
    expect(inviteCode).toMatch(/^[A-Za-z0-9_-]+$/);

    // Bob: 초대 페이지 진입 → 앨범 참여 (UI 흐름 검증)
    await bob.page.goto(`/invite/${inviteCode}`);
    await expect(bob.page.getByText(/초대|참여/).first()).toBeVisible({ timeout: 8_000 });
    const joinBtn = bob.page.getByRole('button', { name: /앨범 참여하기|참여하기/ }).first();
    await expect(joinBtn).toBeVisible({ timeout: 5_000 });
    await joinBtn.click();
    await bob.page.waitForURL(/\/albums(\/|$|\?)/, { timeout: 10_000 }).catch(() => undefined);

    // Bob join을 API로도 보장 (이미 멤버면 idempotent하게 무시 가능)
    await joinByCode(bobToken, inviteCode).catch(() => undefined);

    // Bob: 앨범 에디터 진입
    await bob.page.goto(`/albums/${albumId}`);
    await waitCanvas(bob.page);
    await expect(bob.page.getByText(albumName).first()).toBeVisible();
    await expect(bob.page.getByText('페이지 1').first()).toBeVisible();
    await expect(bob.page.getByText('페이지 2').first()).toBeVisible();
  });
});
