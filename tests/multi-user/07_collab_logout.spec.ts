import { test, expect } from '../helpers/multiUser';
import { logoutFromList } from '../helpers/scenarios';

test.describe('B-07 두 사용자 로그아웃', () => {
  test('Alice와 Bob 둘 다 로그아웃 후 보호 라우트 차단', async ({ alice, bob }) => {
    await logoutFromList(alice.page);
    await expect(alice.page).toHaveURL(/\/login/);

    await logoutFromList(bob.page);
    await expect(bob.page).toHaveURL(/\/login/);

    // 로그아웃 후 보호 라우트 시도
    await alice.context.clearCookies();
    await bob.context.clearCookies();

    await alice.page.goto('/albums');
    await expect(alice.page).toHaveURL(/\/login/);

    await bob.page.goto('/albums');
    await expect(bob.page).toHaveURL(/\/login/);
  });
});
