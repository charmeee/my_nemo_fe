const API_BASE = process.env.E2E_API_BASE ?? 'http://localhost:8080';

type ApiResponse<T> = { data: T } | T;

function unwrap<T>(body: unknown): T {
  const b = body as { data?: T };
  return (b && typeof b === 'object' && 'data' in b ? (b.data as T) : (body as T));
}

async function request<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, headers, ...rest } = init;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path} failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as ApiResponse<T>;
  return unwrap<T>(json);
}

export type TestUser = { email: string; nickname: string };

export async function testLogin(user: TestUser): Promise<{ accessToken: string; userId: string }> {
  const data = await request<{ accessToken: string }>('/auth/test-login', {
    method: 'POST',
    body: JSON.stringify(user),
  });
  const userId = decodeJwtSub(data.accessToken);
  return { accessToken: data.accessToken, userId };
}

function decodeJwtSub(token: string): string {
  const payload = token.split('.')[1];
  const json = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8')) as { sub: string };
  return json.sub;
}

export async function createAlbum(token: string, name: string): Promise<{ id: string }> {
  return request<{ id: string }>('/albums', {
    method: 'POST',
    token,
    body: JSON.stringify({ name }),
  });
}

export async function getInviteCode(
  token: string,
  albumId: string,
  opts: { role?: 'EDITOR' | 'VIEWER'; approvalRequired?: boolean } = {},
): Promise<string> {
  const links = await request<Array<{ code: string; isActive: boolean }>>(
    `/albums/${albumId}/invite`,
    { token },
  );
  const active = links.find((l) => l.isActive);
  if (active) return active.code;

  const created = await request<{ code: string }>(
    `/albums/${albumId}/invite`,
    {
      method: 'POST',
      token,
      body: JSON.stringify({
        role: opts.role ?? 'EDITOR',
        approvalRequired: opts.approvalRequired ?? false,
      }),
    },
  );
  return created.code;
}

export async function joinByCode(token: string, code: string): Promise<void> {
  await request<unknown>(`/invite/${code}/join`, { method: 'POST', token });
}
