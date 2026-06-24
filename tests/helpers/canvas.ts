import fs from 'node:fs';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';

const CANVAS_SELECTOR = '.excalidraw canvas, [class*="excalidraw"] canvas, canvas';

export async function waitCanvas(page: Page): Promise<void> {
  await page.waitForSelector(CANVAS_SELECTOR, { timeout: 15_000 });
  await page.waitForTimeout(800);
}

async function canvasBox(page: Page) {
  const canvas = page.locator(CANVAS_SELECTOR).first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas bounding box not available');
  return box;
}

/**
 * Excalidraw 캔버스의 (offsetX, offsetY) 좌표 부근에 사각형을 드래그로 그린다.
 * tool: 'r' (rectangle), 'o' (ellipse), 'd' (diamond), 't' (text)
 */
export async function drawRect(
  page: Page,
  opts: { offsetX: number; offsetY: number; w?: number; h?: number; tool?: string } = { offsetX: 0, offsetY: 0 },
): Promise<void> {
  const { offsetX, offsetY, w = 120, h = 80, tool = 'r' } = opts;
  const box = await canvasBox(page);
  // 캔버스 중심 클릭으로 focus 확보 (디폴트 selection 도구면 빈 영역 클릭은 선택 해제만 함).
  // 우하단·우상단은 Excalidraw zoom 컨트롤/Library 버튼이 있어 회피.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(120);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  await page.keyboard.press(tool);
  await page.waitForTimeout(250);
  const cx = box.x + box.width / 2 + offsetX;
  const cy = box.y + box.height / 2 + offsetY;

  await page.mouse.move(cx - w / 2, cy - h / 2);
  await page.waitForTimeout(50);
  await page.mouse.down();
  await page.waitForTimeout(80);
  await page.mouse.move(cx + w / 2, cy + h / 2, { steps: 15 });
  await page.waitForTimeout(80);
  await page.mouse.up();
  await page.waitForTimeout(400);
}

export async function selectAllAndDelete(page: Page): Promise<void> {
  // Mac은 Cmd+A(Meta), 그 외는 Ctrl+A.
  const selectAll = process.platform === 'darwin' ? 'Meta+a' : 'Control+a';
  const box = await canvasBox(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  await page.keyboard.press(selectAll);
  await page.waitForTimeout(250);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(200);
  // Backspace fallback (Excalidraw 일부 버전은 Backspace 사용)
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(300);
}

/**
 * Excalidraw 이미지 도구를 setActiveTool API로 활성화 → filechooser에 파일 주입 → 캔버스 중심 클릭으로 배치.
 * window.excalidrawAPI는 dev 빌드에서만 노출(ExcalidrawCanvas.tsx) — vite dev 서버 기준으로 동작.
 */
/**
 * Excalidraw 이미지 element를 캔버스에 직접 주입한다.
 * - 파일을 base64 dataURL로 인코딩하여 excalidrawAPI.addFiles로 BinaryFiles에 등록
 * - 새 image element를 updateScene으로 scene에 추가
 *
 * 이 방식은 toolbar/단축키/파일 다이얼로그를 우회하므로 환경 의존성 없이 안정적.
 * onChange가 트리거되어 백엔드 저장 + WS broadcast가 정상 발생한다.
 *
 * 수MB짜리 base64 문자열을 page.evaluate 인자로 직접 넘기면 Playwright trace가 그
 * 문자열을 매 호출마다 통째로 직렬화하면서 trace.zip이 부풀어 UI mode 로딩이 깨진다
 * (`file data stream has unexpected number of bytes` /
 * `End of central directory record signature not found`).
 * page.exposeBinding으로 한 번만 노출한 뒤 페이지 안에서 호출 → 반환값(base64)은
 * trace 액션 인자에 박히지 않는다.
 */
export async function addImageToCanvas(page: Page, imagePath: string): Promise<void> {
  const buffer = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/jpeg';

  const bindingName = `__nemoImage_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  const base64 = buffer.toString('base64');
  await page.exposeBinding(bindingName, () => base64);

  await page.evaluate(
    async ({ bindingName, mime }) => {
      const w = window as unknown as Record<string, unknown> & {
        excalidrawAPI?: {
          addFiles: (files: unknown[]) => void;
          getSceneElements: () => unknown[];
          updateScene: (update: unknown) => void;
        };
      };
      const api = w.excalidrawAPI;
      if (!api) throw new Error('excalidrawAPI not exposed (dev 빌드에서만 노출됨)');

      const getBase64 = w[bindingName] as () => Promise<string>;
      const base64 = await getBase64();
      const dataURL = `data:${mime};base64,${base64}`;

      const fileId = crypto.randomUUID().replace(/-/g, '');
      api.addFiles([
        {
          id: fileId,
          dataURL,
          mimeType: mime,
          created: Date.now(),
        },
      ]);

      const now = Date.now();
      const elementId = crypto.randomUUID();
      const imageElement = {
        type: 'image',
        id: elementId,
        x: 100,
        y: 100,
        width: 200,
        height: 200,
        angle: 0,
        strokeColor: 'transparent',
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 1,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: null,
        seed: Math.floor(Math.random() * 1_000_000),
        version: 1,
        versionNonce: Math.floor(Math.random() * 1_000_000),
        isDeleted: false,
        boundElements: null,
        updated: now,
        link: null,
        locked: false,
        fileId,
        scale: [1, 1],
        status: 'saved',
        index: null,
      };

      const elements = api.getSceneElements();
      api.updateScene({
        elements: [...elements, imageElement],
        captureUpdate: 'IMMEDIATELY',
      });
    },
    { bindingName, mime },
  );

  await page.waitForTimeout(1000);
}

/**
 * window.excalidrawAPI(있을 경우)로 element 개수 조회.
 * API 미노출 환경에서는 -1 반환.
 */
export async function getSceneElementCount(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const api = (window as unknown as { excalidrawAPI?: { getSceneElements: () => unknown[] } }).excalidrawAPI;
    if (!api) return -1;
    return api.getSceneElements().filter((el: unknown) => !(el as { isDeleted?: boolean }).isDeleted).length;
  });
}

/**
 * 양쪽 화면 element 카운트가 expected와 같아질 때까지 폴링 (최대 timeout ms).
 * API 미노출이면 그냥 timeout 대기 후 통과.
 */
export async function expectCountConverges(
  pages: Page[],
  expected: number,
  timeout = 5_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const counts = await Promise.all(pages.map(getSceneElementCount));
    if (counts.every((c) => c === -1)) {
      await pages[0].waitForTimeout(1_500);
      return;
    }
    if (counts.every((c) => c === expected)) return;
    await pages[0].waitForTimeout(250);
  }
  const final = await Promise.all(pages.map(getSceneElementCount));
  expect(final, `Scene element counts did not converge to ${expected}: got ${final.join(', ')}`).toEqual(
    pages.map(() => expected),
  );
}
