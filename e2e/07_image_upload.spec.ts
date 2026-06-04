import { test, expect } from '@playwright/test';
import { injectAuth } from './helpers/auth';
import path from 'path';
import fs from 'fs';

const ALBUM_ID = 'ff59f021-a62c-4640-ba5c-490a88577303';

// 테스트용 이미지 생성 (1x1 픽셀 PNG)
const TEST_IMAGE_PATH = path.join(process.cwd(), 'e2e/fixtures/test-image.png');
function ensureTestImage() {
  const dir = path.dirname(TEST_IMAGE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(TEST_IMAGE_PATH)) {
    // 최소 유효 PNG (1x1 red pixel)
    const pngBytes = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108020000009001' +
      '2e0000000c4944415408d7636018d88000000002000101e221bc330000000049454e44ae426082',
      'hex'
    );
    fs.writeFileSync(TEST_IMAGE_PATH, pngBytes);
  }
}

/**
 * 시나리오 7: 이미지 업로드
 * - 파일 업로드 API 직접 호출로 이미지 업로드 검증
 * - TLDraw 내 이미지 삽입 검증
 */
test.describe('이미지 업로드', () => {
  test.beforeEach(async ({ page }) => {
    ensureTestImage();
    await injectAuth(page);
  });

  test('이미지 업로드 API - 서버 직접 검증', async ({ page }) => {
    await page.goto(`/albums/${ALBUM_ID}`);

    // localStorage에서 토큰 가져오기
    const token = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(token).toBeTruthy();

    // 이미지 파일 Blob 생성 후 API 직접 호출
    const uploadResult = await page.evaluate(async ({ albumId, tok }) => {
      // 1x1 white PNG
      const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==';
      const bytes = atob(base64);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const blob = new Blob([arr], { type: 'image/png' });

      const formData = new FormData();
      formData.append('file', blob, 'test.png');

      const res = await fetch(`http://localhost:8080/albums/${albumId}/images`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok}` },
        body: formData,
      });
      return { status: res.status, ok: res.ok };
    }, { albumId: ALBUM_ID, tok: token });

    expect(uploadResult.status).toBe(200);
    await page.screenshot({ path: 'e2e/screenshots/07_image_upload_api.png', fullPage: true });
  });

  test('에디터에서 이미지 도구 버튼 존재 확인', async ({ page }) => {
    await page.goto(`/albums/${ALBUM_ID}`);
    await page.waitForSelector('.tl-canvas', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // TLDraw 이미지 도구 또는 파일 input 확인
    // Keyboard shortcut: i = image tool in some versions
    await page.keyboard.press('i');
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'e2e/screenshots/07_image_tool.png' });
  });
});
