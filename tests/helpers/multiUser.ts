import {
  test as base,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { createAlbum, getInviteCode, joinByCode, type TestUser } from './api';
import { ALICE, ALICE_AUTH, BOB, BOB_AUTH, CAROL } from './users';

export { ALICE, BOB, CAROL };

const FRONT_BASE = process.env.E2E_FRONT_BASE ?? 'http://localhost:5173';
const WINDOW_W = 960;
const WINDOW_H = 800;

export type UserSession = {
  context: BrowserContext;
  page: Page;
  user: TestUser;
};

type Fixtures = {
  alice: UserSession;
  bob: UserSession;
  collabAlbum: { albumId: string };
  aliceToken: string;
  bobToken: string;
};

async function openContext(
  browser: Browser,
  storageStatePath: string,
  user: TestUser,
  x: number,
): Promise<UserSession> {
  const context = await browser.newContext({
    baseURL: FRONT_BASE,
    viewport: { width: WINDOW_W, height: WINDOW_H },
    storageState: storageStatePath,
  });
  const page = await context.newPage();
  await tryPositionWindow(context, page, x);
  return { context, page, user };
}

/**
 * Headed 모드에선 CDP로 윈도우를 좌(0) / 우(WINDOW_W)에 배치.
 * Headless / 미지원 환경에선 조용히 통과.
 */
async function tryPositionWindow(context: BrowserContext, page: Page, x: number): Promise<void> {
  try {
    const cdp = await context.newCDPSession(page);
    const { windowId } = await cdp.send('Browser.getWindowForTarget');
    await cdp.send('Browser.setWindowBounds', {
      windowId,
      bounds: { left: x, top: 0, width: WINDOW_W, height: WINDOW_H, windowState: 'normal' },
    });
    await cdp.detach();
  } catch {
    /* best-effort */
  }
}

/**
 * Playwright auth 패턴 + Medium "multi-user the right way":
 *   - 로그인은 tests/auth.setup.ts에서 한 번만 (testLogin → storageState 파일 저장)
 *   - 각 fixture는 builtin browser를 받아 newContext({ storageState }) → 세션 격리
 *   - JWT 토큰은 storageState에 영구 저장된 localStorage에서 읽어 백엔드 호출용으로 노출
 */
export const test = base.extend<Fixtures>({
  alice: async ({ browser }, use) => {
    const session = await openContext(browser, ALICE_AUTH, ALICE, 0);
    await use(session);
    await session.context.close();
  },
  bob: async ({ browser }, use) => {
    const session = await openContext(browser, BOB_AUTH, BOB, WINDOW_W);
    await use(session);
    await session.context.close();
  },
  aliceToken: async ({ alice }, use) => {
    const token = await alice.page.evaluate(() => localStorage.getItem('accessToken'));
    if (!token) throw new Error('Alice storageState missing accessToken — re-run setup');
    await use(token);
  },
  bobToken: async ({ bob }, use) => {
    const token = await bob.page.evaluate(() => localStorage.getItem('accessToken'));
    if (!token) throw new Error('Bob storageState missing accessToken — re-run setup');
    await use(token);
  },
  collabAlbum: async ({ aliceToken, bobToken }, use) => {
    const album = await createAlbum(aliceToken, `[TC] collab ${Date.now()}`);
    const code = await getInviteCode(aliceToken, album.id);
    await joinByCode(bobToken, code);
    await use({ albumId: album.id });
  },
});

export { expect };

export async function gotoEditor(page: Page, albumId: string): Promise<void> {
  await page.goto(`/albums/${albumId}`);
  await page.waitForURL(new RegExp(`/albums/${albumId}`));
}
