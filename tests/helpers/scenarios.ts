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
  await page.getByRole('button', { name: '만들기' }).click();
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
 * 활성 페이지 탭의 X 버튼 클릭 + confirm. 페이지가 2개 이상이어야 X가 보임.
 */
export async function deleteCurrentPage(page: Page): Promise<void> {
  // 활성 탭(bold) 옆 X svg → 가장 가까운 span 클릭
  const xIcon = page.locator('div').filter({ hasText: /^페이지 \d+$/ }).locator('svg').first();
  await xIcon.click();
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
  await page.getByText('초대 링크', { exact: false }).first().click();
  await page.waitForTimeout(500);
  const linkText = await page.locator('text=/\\/invite\\/[A-Za-z0-9]+/').first().innerText();
  const m = linkText.match(/\/invite\/([A-Za-z0-9]+)/);
  if (!m) throw new Error(`Invite URL not found in modal text: ${linkText}`);
  // 모달 닫기
  await page.keyboard.press('Escape');
  return m[1];
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
  await page.keyboard.press('t');
  await page.waitForTimeout(150);
  const canvas = page.locator('.excalidraw-wrapper canvas, .excalidraw canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not available for text');
  const cx = box.x + box.width / 2 + offsetX;
  const cy = box.y + box.height / 2 + offsetY;
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(200);
  await page.keyboard.type(text);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
}

/**
 * 자유 드로잉 (P 키 + 드래그)
 */
export async function drawFreeStroke(page: Page, offsetX: number, offsetY: number): Promise<void> {
  await page.keyboard.press('p');
  await page.waitForTimeout(150);
  const canvas = page.locator('.excalidraw-wrapper canvas, .excalidraw canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not available for freedraw');
  const cx = box.x + box.width / 2 + offsetX;
  const cy = box.y + box.height / 2 + offsetY;
  await page.mouse.move(cx - 30, cy - 20);
  await page.mouse.down();
  await page.mouse.move(cx, cy, { steps: 5 });
  await page.mouse.move(cx + 30, cy + 20, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

/**
 * 한 페이지에 도형 + 텍스트 + 그림 세트 추가 (Element 3개 기대).
 */
export async function fillPageWithThreeElements(page: Page, baseOffsetX = 0): Promise<void> {
  await drawRect(page, { offsetX: -100 + baseOffsetX, offsetY: -40, tool: 'r' });
  await drawTextAt(page, baseOffsetX, -40, 'hi');
  await drawFreeStroke(page, 100 + baseOffsetX, 60);
}
