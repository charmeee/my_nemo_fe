// spec: specs/nemo-e2e-test-plan.md
// seed: tests/auth.setup.ts

import { test, expect } from '@playwright/test';
import { SOLO_AUTH } from '../helpers/users';

test.use({ storageState: SOLO_AUTH });

test.describe('A. 단일 사용자 시나리오', () => {
  test('A-03: 앨범 리스트 + 새 앨범 모달 + 카드 노출', async ({ page }) => {
    const albumName = `TestAlbum-A03-${Date.now()}`;

    await page.goto('/albums');
    await expect(page).toHaveURL(/\/albums/);

    // 모달 열기 → UI 검증
    await page.getByRole('button', { name: '+ 새 앨범' }).first().click();
    await expect(page.getByRole('heading', { name: '새 앨범 만들기' })).toBeVisible();
    await expect(page.getByText('앨범 이름을 입력하세요 (최대 30자)')).toBeVisible();

    const input = page.getByRole('textbox', { name: '앨범 이름' });
    await expect(input).toBeVisible();
    await expect(page.getByText('0/30')).toBeVisible();
    await expect(page.getByRole('button', { name: '취소' })).toBeVisible();
    await expect(page.getByRole('button', { name: '만들기', exact: true })).toBeDisabled();

    // maxLength 35자 입력 → 30자 cap
    await input.fill('1234567890'.repeat(4));
    await expect(input).toHaveValue('123456789012345678901234567890');
    await expect(page.getByText('30/30')).toBeVisible();

    // 취소
    await page.getByRole('button', { name: '취소' }).click();
    await expect(page.getByRole('heading', { name: '새 앨범 만들기' })).not.toBeVisible();

    // 다시 열고 unique 이름 입력 후 만들기
    await page.getByRole('button', { name: '+ 새 앨범' }).first().click();
    await page.getByRole('textbox', { name: '앨범 이름' }).fill(albumName);
    await page.getByRole('button', { name: '만들기', exact: true }).click();
    await expect(page).toHaveURL(/\/albums\/[a-f0-9-]+$/);
    await expect(page.getByText(albumName).first()).toBeVisible();

    // 목록 복귀
    await page.getByRole('button', { name: /목록/ }).click();
    await expect(page).toHaveURL(/\/albums$/);
    await expect(page.getByRole('heading', { name: '내가 만든 앨범' })).toBeVisible();

    // 방금 만든 앨범 카드 (unique 이름이라 정확히 1개)
    const card = page.getByRole('link', { name: new RegExp(albumName) });
    await expect(card).toBeVisible();
    await expect(card.getByText('내 앨범')).toBeVisible();
    await expect(card.getByText(/멤버 1\s*명?/)).toBeVisible();
    await card.hover();
  });
});
