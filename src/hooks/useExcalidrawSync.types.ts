import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

// ─────────────────────────────────────────────────────────────
// 훅 공개 타입 (useExcalidrawSync 의 입력/출력)
// ─────────────────────────────────────────────────────────────

/** WS 연결 상태 */
export type SyncStatus = 'connecting' | 'connected' | 'offline' | 'error';

/** useExcalidrawSync 훅 옵션 */
export interface UseExcalidrawSyncOptions {
  albumId: string;
  currentPageId: string | null;
  currentUserId?: string;
  /** WS connect 메시지에 실어 보낼 JWT 를 반환 */
  getToken: () => Promise<string | null>;
  /** 서버로부터 받은 elements 를 현재 씬에 반영하는 콜백 */
  onElements: (elements: readonly ExcalidrawElement[], pageId: string) => void;
  /** 페이지 추가/삭제/순서변경 이벤트 콜백 */
  onPageEvent: (event: PageEvent) => void;
  /** 이미지 fileId → url 매핑 수신 콜백 */
  onFile?: (fileId: string, url: string) => void;
}

/** 페이지 추가/삭제/순서변경 이벤트 */
export interface PageEvent {
  event: 'added' | 'deleted' | 'reordered';
  pageId: string;
  pageName: string;
  pageOrder: number;
}

/** Excalidraw <Excalidraw collaborators> prop 에 넘길 협업자 표현 */
export interface Collaborator {
  pointer?: { x: number; y: number; tool: 'pointer' };
  button?: 'up';
  selectedElementIds?: Record<string, boolean>;
  username?: string;
  color?: { background: string; stroke: string };
  isCurrentUser?: false;
}

/** 참여자 목록(UI용) 항목 */
export interface Participant {
  userId: string;
  userName: string;
  color: { background: string; stroke: string };
}

// ─────────────────────────────────────────────────────────────
// 내부 상태 타입
// ─────────────────────────────────────────────────────────────

/** participantsMap 값: 이름 + presence 색상 */
export type ParticipantData = { userName: string; color: { background: string; stroke: string } };

/** presenceMap 값: 현재 페이지 + 커서 + 선택된 element */
export type PresenceData = { pageId: string; cursor: { x: number; y: number } | null; selectedIds: string[] };

// ─────────────────────────────────────────────────────────────
// 클라이언트 → 서버 메시지 타입
// ─────────────────────────────────────────────────────────────

/** push 메시지(변경된 elements 전송) */
export interface PushMessage {
  clientClock: number;
  pageId: string;
  elements: ExcalidrawElement[];
}

// ─────────────────────────────────────────────────────────────
// 서버 → 클라이언트 메시지 타입
// ─────────────────────────────────────────────────────────────

export type ConnectedRoomMember = { userId: string; userName: string };
export type ConnectedFullPage = { pageId: string; serverClock: number; elements?: ExcalidrawElement[] };
export type ConnectedDeltaPage = { serverClock: number; elements?: ExcalidrawElement[] };
export type PresencePayload = {
  userId: string;
  userName: string;
  pageId: string;
  cursor: { x: number; y: number } | null;
  selectedIds: string[];
};

/** 서버가 보내는 모든 메시지의 합집합(type 필드로 분기) */
export type ServerMessage = {
  type?: string;
  roomMembers?: ConnectedRoomMember[];
  hydrationType?: 'full' | 'delta';
  pages?: ConnectedFullPage[];
  deltaByPage?: Record<string, ConnectedDeltaPage>;
  files?: Record<string, string>;
  userId?: string;
  userName?: string;
  presence?: PresencePayload;
  pageId?: string;
  serverClock?: number;
  elements?: ExcalidrawElement[];
  action?: string;
  fileId?: string;
  url?: string;
  event?: 'added' | 'deleted' | 'reordered';
  pageName?: string;
  pageOrder?: number;
  reason?: string;
  error?: unknown;
};
