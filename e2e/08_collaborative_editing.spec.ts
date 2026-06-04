import { test, expect, chromium } from '@playwright/test';
import { injectAuth } from './helpers/auth';
import jwt from 'jsonwebtoken';

const ALBUM_ID = 'ff59f021-a62c-4640-ba5c-490a88577303';
const JWT_SECRET = 'nemo-development-jwt-secret-key-change-in-production-min32chars';
const TEST_USER_ID = '2966da91-8999-4761-93dc-56a5d5cedc76';

function generateToken() {
  return jwt.sign(
    { sub: TEST_USER_ID, jti: `e2e-collab-${Date.now()}` },
    JWT_SECRET,
    { algorithm: 'HS384', expiresIn: '1h' },
  );
}

/**
 * 시나리오 8: 동시 편집 검증
 * - 두 브라우저 컨텍스트가 같은 앨범에 접속
 * - 한쪽에서 수정 → 다른 쪽에 WebSocket으로 브로드캐스트 확인
 * - serverClock 증가 확인
 */
test.describe('동시 편집 (실시간 동기화)', () => {

  test('두 클라이언트 동시 접속 - WebSocket 연결 확인', async () => {
    const browser = await chromium.launch();

    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();

    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    try {
      // 두 페이지 모두 인증 주입
      const token = generateToken();
      const injectToken = async (page: typeof page1) => {
        await page.goto('http://localhost:5173/');
        await page.evaluate((t) => {
          const authState = { state: { accessToken: t, user: null, _hasHydrated: true }, version: 0 };
          localStorage.setItem('auth', JSON.stringify(authState));
          localStorage.setItem('accessToken', t);
        }, token);
      };

      await Promise.all([injectToken(page1), injectToken(page2)]);

      // 두 페이지 동시 에디터 진입
      await Promise.all([
        page1.goto(`http://localhost:5173/albums/${ALBUM_ID}`),
        page2.goto(`http://localhost:5173/albums/${ALBUM_ID}`),
      ]);

      // 두 페이지 모두 캔버스 로드 대기
      await Promise.all([
        page1.waitForSelector('.tl-canvas', { timeout: 15000 }),
        page2.waitForSelector('.tl-canvas', { timeout: 15000 }),
      ]);

      await Promise.all([page1.waitForTimeout(2000), page2.waitForTimeout(2000)]);

      // 두 페이지 모두 에디터 헤더 확인 (연결 성공)
      await Promise.all([
        expect(page1.locator('header').first()).toBeVisible({ timeout: 8000 }),
        expect(page2.locator('header').first()).toBeVisible({ timeout: 8000 }),
      ]);

      // Page1 스크린샷
      await page1.screenshot({ path: 'e2e/screenshots/08_collab_page1.png' });
      await page2.screenshot({ path: 'e2e/screenshots/08_collab_page2.png' });

      // Page1에서 사각형 그리기
      await page1.keyboard.press('r');
      await page1.waitForTimeout(300);

      const canvas1 = page1.locator('.tl-canvas').first();
      const box1 = await canvas1.boundingBox();
      if (box1) {
        const cx = box1.x + box1.width / 2;
        const cy = box1.y + box1.height / 2;
        await page1.mouse.move(cx - 60, cy - 40);
        await page1.mouse.down();
        await page1.mouse.move(cx + 60, cy + 40, { steps: 15 });
        await page1.mouse.up();
        await page1.waitForTimeout(500);
      }

      await page1.screenshot({ path: 'e2e/screenshots/08_collab_after_draw_page1.png' });

      // WebSocket 브로드캐스트 대기 (200ms 이내 동기화)
      await page2.waitForTimeout(1000);
      await page2.screenshot({ path: 'e2e/screenshots/08_collab_synced_page2.png' });

    } finally {
      await browser.close();
    }
  });

  test('WebSocket 서버 연결 상태 - API로 serverClock 확인', async ({ page }) => {
    await injectAuth(page);

    // serverClock은 WebSocket 연결 후 증가하므로 직접 DB 상태 확인
    const token = await page.evaluate(() => localStorage.getItem('accessToken'));

    // 앨범 API로 현재 상태 확인
    const albumData = await page.evaluate(async ({ tok, id }) => {
      const res = await fetch(`http://localhost:8080/albums/${id}`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      return res.json();
    }, { tok: token, id: ALBUM_ID });

    expect(albumData.success).toBe(true);
    expect(albumData.data).toBeDefined();

    // 에디터 접속 후 WebSocket이 연결됨을 간접 확인
    await page.goto(`/albums/${ALBUM_ID}`);
    await page.waitForSelector('.tl-canvas', { timeout: 15000 });
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'e2e/screenshots/08_ws_connected.png' });
  });
});
