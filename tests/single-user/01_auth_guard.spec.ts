// spec: specs/nemo-e2e-test-plan.md
// seed: tests/auth.setup.ts

import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('A. 단일 사용자 시나리오', () => {
  test('A-01: Auth 가드 — 미로그인 상태에서 보호된 라우트 접근 시 /login 리다이렉트', async ({ page }) => {
    // 1. 빈 storageState로 /albums 접근 → /login 리다이렉트 확인
    await page.goto('/albums');
    await expect(page).toHaveURL(/\/login/);

    // 2. /albums/some-uuid 접근 → /login 리다이렉트 확인
    await page.goto('/albums/some-uuid');
    await expect(page).toHaveURL(/\/login/);

    // 3. /trash 접근 → /login 리다이렉트 확인
    await page.goto('/trash');
    await expect(page).toHaveURL(/\/login/);

    // 4. 로그인 페이지 UI 검증 — nemo 로고, 태그라인, 소셜 로그인 탭, 카카오 버튼
    await expect(page.getByText('nemo')).toBeVisible();
    await expect(page.getByText('함께 찍고, 함께 꾸미고, 함께 간직하세요')).toBeVisible();
    // 소셜 로그인 탭이 기본 선택 상태
    const socialTab = page.getByRole('button', { name: '소셜 로그인' });
    await expect(socialTab).toBeVisible();
    // 카카오로 시작하기 링크 노출
    await expect(page.getByRole('link', { name: '카카오로 시작하기' })).toBeVisible();

    // 5. 이메일 로그인 탭 클릭 → email/password input, 로그인 버튼 확인
    await page.getByRole('button', { name: '이메일 로그인' }).click();
    await expect(page.getByRole('textbox', { name: '이메일' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /비밀번호/ })).toBeVisible();
    // 이메일 탭에서 로그인/회원가입 토글 버튼 노출
    await expect(page.getByRole('button', { name: '로그인' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '회원가입' })).toBeVisible();

    // 6. 회원가입 버튼 클릭 → 닉네임 필드 추가 확인
    await page.getByRole('button', { name: '회원가입' }).click();
    await expect(page.getByRole('textbox', { name: '닉네임' })).toBeVisible();

    // 7. 이메일 필드에 형식이 올바르지 않은 값 입력 후 가입하기 버튼 클릭 → HTML5 유효성 검사 (페이지 유지)
    await page.getByRole('textbox', { name: '이메일' }).fill('notanemail');
    await page.getByRole('button', { name: '가입하기' }).click();
    // HTML5 유효성 검사로 인해 여전히 로그인 페이지에 있어야 한다
    await expect(page).toHaveURL(/\/login/);
  });
});
