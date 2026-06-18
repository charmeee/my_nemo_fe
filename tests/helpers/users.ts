import type { TestUser } from './api';

export const ALICE: TestUser = { email: 'alice@e2e.test', nickname: 'Alice' };
export const BOB: TestUser = { email: 'bob@e2e.test', nickname: 'Bob' };
export const CAROL: TestUser = { email: 'carol@e2e.test', nickname: 'Carol' };

const AUTH_DIR = 'tests/.auth';
export const ALICE_AUTH = `${AUTH_DIR}/alice.json`;
export const BOB_AUTH = `${AUTH_DIR}/bob.json`;
export const CAROL_AUTH = `${AUTH_DIR}/carol.json`;
