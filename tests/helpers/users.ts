import type { TestUser } from './api';

// SOLO: single-user 시나리오 전용. Alice/Bob 멀티유저 잔여물과 격리하기 위해 분리.
export const SOLO: TestUser = { email: 'solo@e2e.test', nickname: 'Solo' };
export const ALICE: TestUser = { email: 'alice@e2e.test', nickname: 'Alice' };
export const BOB: TestUser = { email: 'bob@e2e.test', nickname: 'Bob' };
export const CAROL: TestUser = { email: 'carol@e2e.test', nickname: 'Carol' };

const AUTH_DIR = 'tests/.auth';
export const SOLO_AUTH = `${AUTH_DIR}/solo.json`;
export const ALICE_AUTH = `${AUTH_DIR}/alice.json`;
export const BOB_AUTH = `${AUTH_DIR}/bob.json`;
export const CAROL_AUTH = `${AUTH_DIR}/carol.json`;
