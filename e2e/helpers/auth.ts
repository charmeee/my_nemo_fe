import { Page } from '@playwright/test';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'nemo-development-jwt-secret-key-change-in-production-min32chars';
const TEST_USER_ID = '2966da91-8999-4761-93dc-56a5d5cedc76';

/**
 * 테스트용 JWT 토큰 생성 (HS384 - 63자 시크릿 = 504bits)
 */
export function generateTestToken(): string {
  return jwt.sign(
    { sub: TEST_USER_ID, jti: `e2e-test-${Date.now()}` },
    JWT_SECRET,
    { algorithm: 'HS384', expiresIn: '1h' },
  );
}

/**
 * 브라우저 localStorage에 JWT 토큰 주입 (로그인 상태 시뮬레이션)
 */
export async function injectAuth(page: Page): Promise<string> {
  const token = generateTestToken();
  await page.goto('/');
  await page.evaluate((t) => {
    // Zustand persist store (ProtectedRoute가 읽음)
    const authState = { state: { accessToken: t, user: null, _hasHydrated: true }, version: 0 };
    localStorage.setItem('auth', JSON.stringify(authState));
    // Axios interceptor가 직접 읽는 키
    localStorage.setItem('accessToken', t);
  }, token);
  return token;
}
