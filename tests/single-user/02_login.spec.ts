// spec: specs/nemo-e2e-test-plan.md
// seed: tests/auth.setup.ts

import { test, expect } from '@playwright/test';
import { ALICE_AUTH } from '../helpers/users';

test.use({ storageState: ALICE_AUTH });

test.describe('A. 단일 사용자 시나리오', () => {
  test('A-02: 헤더 닉네임/아이콘 버튼 + 다크모드 토글 + 로그아웃', async ({ page }) => {
    await page.goto('/albums');
    await expect(page).toHaveURL(/\/albums/);

    // nemo 로고
    await expect(page.getByText('nemo').first()).toBeVisible();

    // Alice 닉네임 배지 (title 속성에 이메일 포함)
    await expect(page.locator('[title*="alice@e2e.test"]')).toBeVisible();
    await expect(page.getByText('Alice').first()).toBeVisible();

    // 알림 벨 버튼 (title="알림")
    await expect(page.getByTitle('알림')).toBeVisible();

    // 다크 모드 토글 (title은 현재 모드 반대값)
    const darkBtn = page.getByTitle('다크 모드');
    await expect(darkBtn).toBeVisible();

    // 휴지통 / 새 앨범 / 로그아웃 (텍스트 버튼)
    await expect(page.getByRole('button', { name: /휴지통/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /\+ ?새 앨범/ })).toBeVisible();
    await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible();

    // 다크 모드 클릭 → 토글되어 title이 '라이트 모드'로 변경
    await darkBtn.click();
    await expect(page.getByTitle('라이트 모드')).toBeVisible();
    const themeAfter = await page.evaluate(() => localStorage.getItem('nemo-theme'));
    expect(themeAfter).toBe('dark');

    // 다시 클릭 → 라이트로 복귀
    await page.getByTitle('라이트 모드').click();
    await expect(page.getByTitle('다크 모드')).toBeVisible();

    // 로그아웃
    await page.getByRole('button', { name: '로그아웃' }).click();
    await expect(page).toHaveURL(/\/login/);

    // 로그아웃 후 보호 라우트 차단
    await page.goto('/albums');
    await expect(page).toHaveURL(/\/login/);
  });
});
