import { test, expect } from '@playwright/test';
import { SOLO_AUTH } from '../helpers/users';
import { createAlbumViaUI, openAlbumSettings, openMembers, acceptAllDialogs } from '../helpers/scenarios';

test.use({ storageState: SOLO_AUTH });

test.describe('A-04 에디터 UI: 헤더 / 페이지탭 / 캔버스 / 모달', () => {
  test('에디터 진입 후 헤더·탭·캔버스·앨범설정·멤버모달 노출 검증', async ({ page }) => {
    acceptAllDialogs(page);
    const name = `EditorUI-A04-${Date.now()}`;
    await createAlbumViaUI(page, name);

    // 헤더
    await expect(page.getByRole('button', { name: /목록/ })).toBeVisible();
    await expect(page.getByText(name).first()).toBeVisible();
    await expect(page.getByText('나').first()).toBeVisible();
    await expect(
      page.getByText('실시간 동기화').or(page.getByText('연결 중')).first(),
    ).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTitle('멤버 관리')).toBeVisible();
    await expect(page.getByTitle('앨범 설정')).toBeVisible();

    // 페이지 탭
    await expect(page.getByText('페이지 1').first()).toBeVisible();
    await expect(page.getByRole('button', { name: '+ 페이지' })).toBeVisible();

    // 캔버스 로드 (이미 createAlbumViaUI에서 waitCanvas 실행됨)
    await expect(page.locator('canvas').first()).toBeVisible();

    // 앨범 설정 모달 (AlbumSettingsModal은 backdrop click으로만 닫힘 — Escape 미지원)
    await openAlbumSettings(page);
    await expect(page.getByRole('button', { name: /앨범 삭제/ })).toBeVisible();
    await expect(page.getByText(/잠금 시 편집이 제한/)).toBeVisible();
    // backdrop 클릭으로 닫기 (모달 박스 바깥 영역)
    await page.mouse.click(10, 10);
    await expect(page.getByRole('button', { name: /앨범 삭제/ })).toBeHidden({ timeout: 3_000 });

    // 멤버 모달
    await openMembers(page);
    await expect(page.getByText(/멤버 \(\d+\)/).first()).toBeVisible();
    await expect(page.getByText(/관리자/).first()).toBeVisible();

    // 초대 링크 탭
    await page.getByRole('button', { name: '초대 링크' }).click();
    const hasActive = await page.getByText(/\/invite\/[A-Za-z0-9_-]+/).first().isVisible().catch(() => false);
    const hasNone = await page.getByText('활성화된 초대 링크가 없습니다').isVisible().catch(() => false);
    expect(hasActive || hasNone).toBeTruthy();
    await expect(page.getByRole('button', { name: /새 링크 발급/ })).toBeVisible();

    // 멤버 모달 닫기 — 헤더 X 버튼 (lucide X size=18)
    await page.mouse.click(10, 10);
  });
});
