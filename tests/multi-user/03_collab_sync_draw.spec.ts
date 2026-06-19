import path from 'node:path';
import { test, expect, gotoEditor } from '../helpers/multiUser';
import {
  acceptAllDialogs,
  addPage,
  drawTextAt,
  waitForSync,
} from '../helpers/scenarios';
import {
  addImageToCanvas,
  drawRect,
  expectCountConverges,
  selectAllAndDelete,
  waitCanvas,
} from '../helpers/canvas';

const IMAGE_FIXTURE = path.resolve(
  process.cwd(),
  'tests/asset/KakaoTalk_Photo_2026-06-15-14-32-14 002.jpeg',
);

test.describe('B-03 멀티유저 객체 생성/이미지/삭제 실시간 동기화', () => {
  test('페이지1·2 양쪽에서 사각형/텍스트/이미지/삭제가 양쪽 화면에 동기화', async ({ alice, bob, collabAlbum }) => {
    acceptAllDialogs(alice.page);
    acceptAllDialogs(bob.page);

    // 두 페이지 셋업 (Alice가 페이지 2 추가)
    await gotoEditor(alice.page, collabAlbum.albumId);
    await waitCanvas(alice.page);
    await addPage(alice.page);

    await gotoEditor(bob.page, collabAlbum.albumId);
    await waitCanvas(bob.page);
    await waitForSync(bob.page, 1500);

    // 페이지 1로 전환
    await alice.page.getByText('페이지 1').first().click();
    await bob.page.getByText('페이지 1').first().click();
    await waitCanvas(alice.page);
    await waitCanvas(bob.page);

    // Alice: 사각형
    await drawRect(alice.page, { offsetX: -100, offsetY: 0, tool: 'r' });
    await waitForSync(alice.page, 500);
    await expectCountConverges([alice.page, bob.page], 1, 6000);

    // Bob: 텍스트
    await drawTextAt(bob.page, 60, 60, 'BobText');
    await waitForSync(bob.page, 500);
    await expectCountConverges([alice.page, bob.page], 2, 6000);

    // Alice: 이미지 (excalidrawAPI 직접 주입)
    await addImageToCanvas(alice.page, IMAGE_FIXTURE);
    await waitForSync(alice.page, 1000);
    await expectCountConverges([alice.page, bob.page], 3, 8000);

    // Alice: 전체 삭제 동기화
    await selectAllAndDelete(alice.page);
    await waitForSync(alice.page, 500);
    await expectCountConverges([alice.page, bob.page], 0, 6000);

    // 페이지 2로 전환 후 동일 흐름 (사각형 생성/삭제)
    await alice.page.getByText('페이지 2').first().click();
    await bob.page.getByText('페이지 2').first().click();
    await waitCanvas(alice.page);
    await waitCanvas(bob.page);

    await drawRect(alice.page, { offsetX: 0, offsetY: 0, tool: 'r' });
    await waitForSync(alice.page, 500);
    await expectCountConverges([alice.page, bob.page], 1, 6000);

    await selectAllAndDelete(alice.page);
    await waitForSync(alice.page, 500);
    await expectCountConverges([alice.page, bob.page], 0, 6000);
  });
});
