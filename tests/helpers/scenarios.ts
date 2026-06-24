import { expect, type Page } from '@playwright/test';
import { drawRect, waitCanvas } from './canvas';

/**
 * window.confirm/alert 자동 수락. 페이지 별로 1회 호출.
 */
export function acceptAllDialogs(page: Page): void {
  page.on('dialog', (d) => {
    void d.accept();
  });
}

export async function createAlbumViaUI(page: Page, name: string): Promise<string> {
  await page.goto('/albums');
  await page.getByRole('button', { name: /\+\s*새 앨범|새 앨범/ }).first().click();
  const input = page.locator('input[placeholder*="앨범 이름"]');
  await expect(input).toBeVisible({ timeout: 5_000 });
  await input.fill(name);
  // exact:true 필수 — 앨범 0개 빈 상태에선 본문에 '첫 앨범 만들기' 버튼도 같이 있어서 충돌.
  await page.getByRole('button', { name: '만들기', exact: true }).click();
  await page.waitForURL(/\/albums\/[a-f0-9-]+$/, { timeout: 10_000 });
  await waitCanvas(page);
  const m = page.url().match(/\/albums\/([a-f0-9-]+)/);
  if (!m) throw new Error(`Album URL not matched: ${page.url()}`);
  return m[1];
}

export async function addPage(page: Page): Promise<void> {
  await page.getByRole('button', { name: '+ 페이지' }).click();
  await page.waitForTimeout(500);
  await waitCanvas(page);
}

export async function selectPageByIndex(page: Page, index: number): Promise<void> {
  const tabs = page.locator('div').filter({ hasText: /^페이지 \d+$/ });
  await tabs.nth(index).click();
  await page.waitForTimeout(400);
}

/**
 * 활성 페이지 탭의 X 버튼 클릭 + confirm.
 * PageTabs는 활성 탭에만 자식 <span><svg X/></span>을 렌더링하므로,
 * 페이지 탭 div들 중 자식 span을 가진(=활성) 탭의 span을 직접 클릭한다.
 * 페이지가 2개 이상이어야 X가 노출된다.
 */
export async function deleteCurrentPage(page: Page): Promise<void> {
  const closeBtn = page
    .locator('div')
    .filter({ hasText: /^페이지 \d+$/ })
    .locator('> span')
    .first();
  await closeBtn.waitFor({ state: 'visible', timeout: 5_000 });
  await closeBtn.click();
  await page.waitForTimeout(800);
}

export async function openAlbumSettings(page: Page): Promise<void> {
  await page.getByTitle('앨범 설정').click();
  await expect(page.getByText('앨범 설정', { exact: true }).first()).toBeVisible({ timeout: 5_000 });
}

export async function deleteAlbumViaSettings(page: Page): Promise<void> {
  await openAlbumSettings(page);
  await page.getByRole('button', { name: /앨범 삭제/ }).click();
  // window.confirm → acceptAllDialogs가 처리
  await page.waitForURL(/\/albums$/, { timeout: 10_000 });
}

export async function openMembers(page: Page): Promise<void> {
  await page.getByTitle('멤버 관리').click();
  await expect(page.getByText('초대 링크', { exact: false }).first()).toBeVisible({ timeout: 5_000 });
}

export async function getInviteCodeFromUI(page: Page): Promise<string> {
  await openMembers(page);
  // 멤버 관리 모달의 '초대 링크' 탭 버튼 클릭 (멤버 탭과 구분되는 버튼 역할).
  await page.getByRole('button', { name: '초대 링크' }).click();

  // 활성 링크가 없으면 '새 링크 발급' 클릭하여 발급 후 다시 조회.
  const activeUrlLocator = page.getByText(/\/invite\/[A-Za-z0-9_-]+/).first();
  const noActiveText = page.getByText('활성화된 초대 링크가 없습니다');
  try {
    await activeUrlLocator.waitFor({ state: 'visible', timeout: 1_500 });
  } catch {
    if (await noActiveText.isVisible().catch(() => false)) {
      await page.getByRole('button', { name: /새 링크 발급/ }).click();
      await activeUrlLocator.waitFor({ state: 'visible', timeout: 5_000 });
    } else {
      throw new Error('Invite URL not found in MembersModal');
    }
  }

  const linkText = await activeUrlLocator.innerText();
  const m = linkText.match(/\/invite\/([A-Za-z0-9_-]+)/);
  if (!m) throw new Error(`Invite URL not parseable: ${linkText}`);
  await page.keyboard.press('Escape');
  return m[1];
}

/**
 * 멀티유저 동기화 대기. 의도(WS 이벤트 도달 기대)를 명확히 하기 위한 래퍼.
 * 기본 1500ms.
 */
export async function waitForSync(page: Page, ms = 1500): Promise<void> {
  await page.waitForTimeout(ms);
}

export async function gotoTrash(page: Page): Promise<void> {
  await page.goto('/trash');
  await expect(page.getByText('휴지통', { exact: false }).first()).toBeVisible({ timeout: 5_000 });
}

export async function restoreFirstInTrash(page: Page): Promise<void> {
  await page.getByRole('button', { name: '복원' }).first().click();
  // confirm 자동 수락
  await page.waitForTimeout(800);
}

export async function permanentDeleteFirstInTrash(page: Page): Promise<void> {
  await page.getByRole('button', { name: '영구 삭제' }).first().click();
  await page.waitForTimeout(800);
}

export async function expectTrashEmpty(page: Page): Promise<void> {
  await expect(page.getByText('휴지통이 비어 있습니다')).toBeVisible({ timeout: 5_000 });
}

export async function logoutFromList(page: Page): Promise<void> {
  await page.goto('/albums');
  await page.getByRole('button', { name: '로그아웃' }).click();
  await page.waitForURL(/\/login/, { timeout: 8_000 });
}

/**
 * 캔버스 중앙 근처에 텍스트 박스 추가. T 키 → 클릭 → 타이핑 → Escape.
 */
export async function drawTextAt(page: Page, offsetX: number, offsetY: number, text: string): Promise<void> {
  const canvas = page.locator('.excalidraw-wrapper canvas, .excalidraw canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not available for text');
  // 캔버스 중심 클릭으로 focus 확보 (drawRect와 동일 패턴).
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(120);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  await page.keyboard.press('t');
  await page.waitForTimeout(200);

  const cx = box.x + box.width / 2 + offsetX;
  const cy = box.y + box.height / 2 + offsetY;
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(250);
  await page.keyboard.type(text);
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

/**
 * 자유 드로잉 (P 키 + 드래그)
 */
export async function drawFreeStroke(page: Page, offsetX: number, offsetY: number): Promise<void> {
  const canvas = page.locator('.excalidraw-wrapper canvas, .excalidraw canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not available for freedraw');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(120);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  await page.keyboard.press('p');
  await page.waitForTimeout(200);

  const cx = box.x + box.width / 2 + offsetX;
  const cy = box.y + box.height / 2 + offsetY;
  await page.mouse.move(cx - 30, cy - 20);
  await page.waitForTimeout(50);
  await page.mouse.down();
  await page.waitForTimeout(80);
  await page.mouse.move(cx, cy, { steps: 8 });
  await page.mouse.move(cx + 30, cy + 20, { steps: 8 });
  await page.waitForTimeout(80);
  await page.mouse.up();
  await page.waitForTimeout(400);
}

/**
 * 한 페이지에 안정적으로 도형 3개(rect / ellipse / diamond)를 추가한다.
 * 텍스트·자유드로잉은 Excalidraw에서 타이밍·focus 이슈가 잦아서 별도 헬퍼(drawTextAt/drawFreeStroke)로 분리해 사용.
 */
export async function fillPageWithThreeElements(page: Page, baseOffsetX = 0): Promise<void> {
  await drawRect(page, { offsetX: -100 + baseOffsetX, offsetY: -40, tool: 'r' });
  await drawRect(page, { offsetX: 50 + baseOffsetX, offsetY: -40, tool: 'o' });
  await drawRect(page, { offsetX: 0 + baseOffsetX, offsetY: 60, tool: 'd' });
}
