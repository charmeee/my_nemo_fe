import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { getPresenceColor } from '../utils/presenceColor';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080';

export type SyncStatus = 'connecting' | 'connected' | 'offline' | 'error';

export interface UseExcalidrawSyncOptions {
  albumId: string;
  currentPageId: string | null;
  currentUserId?: string;
  getToken: () => Promise<string | null>;
  onElements: (elements: readonly ExcalidrawElement[], pageId: string) => void;
  onPageEvent: (event: PageEvent) => void;
  onFile?: (fileId: string, url: string) => void;
}

export interface PageEvent {
  event: 'added' | 'deleted' | 'reordered';
  pageId: string;
  pageName: string;
  pageOrder: number;
}

export interface Collaborator {
  pointer?: { x: number; y: number; tool: 'pointer' };
  button?: 'up';
  selectedElementIds?: Record<string, boolean>;
  username?: string;
  color?: { background: string; stroke: string };
  isCurrentUser?: false;
}

export interface Participant {
  userId: string;
  userName: string;
  color: { background: string; stroke: string };
}

interface PushMessage {
  clientClock: number;
  pageId: string;
  elements: ExcalidrawElement[];
}

// Excalidraw WS sync 훅: 커스텀 WebSocket 연결 + push queue(LWW) + presence/participants 관리
export function useExcalidrawSync({
  albumId,
  currentPageId,
  currentUserId,
  getToken,
  onElements,
  onPageEvent,
  onFile,
}: UseExcalidrawSyncOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const localClockRef = useRef(0);
  const lastClockByPageRef = useRef<Record<string, number>>({});
  const lastSentVersionsRef = useRef<Record<string, number>>({});
  const pendingPushRef = useRef<PushMessage | null>(null);
  const queuedPushRef = useRef<PushMessage | null>(null);
  const [status, setStatus] = useState<SyncStatus>('connecting');
  const [forceCloseMessage, setForceCloseMessage] = useState<string | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const currentPageIdRef = useRef(currentPageId);
  currentPageIdRef.current = currentPageId;
  const onFileRef = useRef(onFile);
  onFileRef.current = onFile;

  type ParticipantData = { userName: string; color: { background: string; stroke: string } };
  type PresenceData = { pageId: string; cursor: { x: number; y: number } | null; selectedIds: string[] };
  const [participantsMap, setParticipantsMap] = useState<Map<string, ParticipantData>>(new Map());
  const [presenceMap, setPresenceMap] = useState<Map<string, PresenceData>>(new Map());
  const [myUserId, setMyUserId] = useState<string | null>(currentUserId ?? null);

  // WS OPEN 상태일 때만 JSON 메시지 전송
  const send = useCallback((data: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }, []);

  // 이전 push ack 도착 시 대기열에 쌓인 큐를 다음 push로 승격해서 전송
  const flushQueue = useCallback(() => {
    if (pendingPushRef.current === null && queuedPushRef.current !== null) {
      pendingPushRef.current = queuedPushRef.current;
      queuedPushRef.current = null;
      send({ type: 'push', ...pendingPushRef.current });
    }
  }, [send]);

  // WS 연결 + 초기 hydration + 모든 서버 메시지 핸들러 등록 + 끊김 시 exponential backoff
  const connect = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

    // JWT에서 자신의 userId 추출 (self-presence 필터링용)
    try {
      const sub = JSON.parse(atob(token.split('.')[1])).sub as string;
      if (sub) setMyUserId(sub);
    } catch {}


    // 토큰은 URL 쿼리 파라미터가 아닌 connect 메시지 본문으로 전달 (로그/프록시 노출 방지)
    const ws = new WebSocket(`${WS_URL}/sync/excalidraw/${albumId}`);
    wsRef.current = ws;
    setStatus('connecting');

    ws.onopen = () => {
      send({
        type: 'connect',
        token,
        lastClockByPage: lastClockByPageRef.current,
        currentPageId: currentPageIdRef.current,
        clientId: crypto.randomUUID(),
      });
    };

    ws.onmessage = (event) => {
      let msg: any;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === 'pong') return;

      if (msg.type === 'connected') {
        reconnectAttemptsRef.current = 0; // 연결 성공 시 backoff 카운터 초기화
        setStatus('connected');
        if (msg.roomMembers) {
          setParticipantsMap(() => {
            const next = new Map<string, ParticipantData>();
            for (const m of msg.roomMembers as { userId: string; userName: string }[]) {
              next.set(m.userId, { userName: m.userName, color: getPresenceColor(m.userId) });
            }
            return next;
          });
        }
        if (msg.hydrationType === 'full') {
          for (const page of msg.pages ?? []) {
            lastClockByPageRef.current[page.pageId] = page.serverClock;
            if (page.pageId === currentPageIdRef.current) {
              onElements(page.elements ?? [], page.pageId);
            }
          }
        } else {
          for (const [pageId, delta] of Object.entries<any>(msg.deltaByPage ?? {})) {
            lastClockByPageRef.current[pageId] = delta.serverClock;
            if (pageId === currentPageIdRef.current) {
              onElements(delta.elements ?? [], pageId);
            }
          }
        }
        // image fileId → url 매핑은 element와 별도로 전달됨 — onFile 콜백으로 binary 로드
        if (msg.files && typeof msg.files === 'object') {
          for (const [fileId, url] of Object.entries<string>(msg.files)) {
            onFileRef.current?.(fileId, url);
          }
        }
      }

      if (msg.type === 'user_joined') {
        setParticipantsMap((prev) => {
          const next = new Map(prev);
          next.set(msg.userId, { userName: msg.userName, color: getPresenceColor(msg.userId) });
          return next;
        });
      }

      if (msg.type === 'user_left') {
        setParticipantsMap((prev) => { const next = new Map(prev); next.delete(msg.userId); return next; });
        setPresenceMap((prev) => { const next = new Map(prev); next.delete(msg.userId); return next; });
      }

      if (msg.type === 'presence') {
        const p = msg.presence as { userId: string; userName: string; pageId: string; cursor: { x: number; y: number } | null; selectedIds: string[] };
        setParticipantsMap((prev) => {
          if (prev.has(p.userId)) return prev;
          const next = new Map(prev);
          next.set(p.userId, { userName: p.userName, color: getPresenceColor(p.userId) });
          return next;
        });
        setPresenceMap((prev) => {
          const next = new Map(prev);
          const existing = next.get(p.userId);
          // cursor 이벤트(cursor !== null)이면 기존 selectedIds 유지
          // selection 이벤트(cursor === null)이면 기존 cursor 유지
          const isCursorEvent = p.cursor !== null;
          next.set(p.userId, {
            pageId: p.pageId ?? existing?.pageId ?? '',
            cursor: isCursorEvent ? p.cursor : (existing?.cursor ?? null),
            selectedIds: isCursorEvent ? (existing?.selectedIds ?? []) : (Array.isArray(p.selectedIds) ? p.selectedIds : []),
          });
          return next;
        });
      }

      if (msg.type === 'patch') {
        lastClockByPageRef.current[msg.pageId] = msg.serverClock;
        onElements(msg.elements ?? [], msg.pageId);
      }

      if (msg.type === 'push_result') {
        pendingPushRef.current = null;
        if (msg.action === 'rebase') {
          // server is newer — rebuild queued push from current scene
          queuedPushRef.current = null; // reset, scene state will rebuild on next onChange
        }
        flushQueue();
      }

      if (msg.type === 'excalidraw_file') {
        onFileRef.current?.(msg.fileId, msg.url);
      }

      if (msg.type === 'page_event') {
        onPageEvent({
          event: msg.event,
          pageId: msg.pageId,
          pageName: msg.pageName,
          pageOrder: msg.pageOrder,
        });
      }

      if (msg.type === 'force-close') {
        ws.close();
        const reasonMessages: Record<string, string> = {
          kicked: '앨범에서 추방되었습니다.',
          'role-downgraded': '편집 권한이 변경되었습니다.',
          'album-locked': '앨범이 잠겼습니다.',
        };
        const message = reasonMessages[msg.reason] ?? '연결이 종료되었습니다.';
        setStatus('error');
        setForceCloseMessage(message);
      }

      if (msg.type === 'error') {
        console.warn('[ExcalidrawSync] server error:', msg.error);
      }
    };

    ws.onclose = () => {
      setStatus('offline');
      // Exponential backoff: 3s → 6s → 12s → ... 최대 60s
      const delay = Math.min(3000 * Math.pow(2, reconnectAttemptsRef.current), 60000);
      reconnectAttemptsRef.current += 1;
      reconnectTimerRef.current = setTimeout(() => connect(), delay);
    };

    ws.onerror = () => {
      setStatus('offline');
    };
  }, [albumId, getToken, send, flushQueue, onElements, onPageEvent]);

  // mount 시 WS 연결, unmount 시 재연결 타이머 + 소켓 정리
  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  // onChange에서 호출: lastSentVersions 비교로 변경된 elements만 push (pending이 있으면 큐에 머지)
  /** onChange에서 호출: 변경된 elements만 push */
  const pushChanges = useCallback(
    (elements: readonly ExcalidrawElement[], pageId: string) => {
      const changed = elements.filter((el) => {
        const lastVersion = lastSentVersionsRef.current[el.id] ?? -1;
        return el.version > lastVersion;
      });
      if (changed.length === 0) return;

      // 버전 기록 업데이트
      for (const el of changed) {
        lastSentVersionsRef.current[el.id] = el.version;
      }

      const msg: PushMessage = {
        clientClock: ++localClockRef.current,
        pageId,
        elements: changed as ExcalidrawElement[],
      };

      if (pendingPushRef.current === null) {
        pendingPushRef.current = msg;
        send({ type: 'push', ...msg });
      } else {
        // merge into queued
        if (queuedPushRef.current === null) {
          queuedPushRef.current = msg;
        } else {
          const merged: Record<string, ExcalidrawElement> = {};
          for (const el of [...queuedPushRef.current.elements, ...msg.elements]) {
            const prev = merged[el.id];
            if (!prev || el.version > prev.version) merged[el.id] = el;
          }
          queuedPushRef.current = {
            clientClock: msg.clientClock,
            pageId,
            elements: Object.values(merged),
          };
        }
      }
    },
    [send]
  );

  /** 이미지 파일 URL 전송 */
  const pushFile = useCallback(
    (fileId: string, url: string) => {
      send({ type: 'excalidraw_file', fileId, url });
    },
    [send]
  );

  /** presence 전송 */
  const pushPresence = useCallback(
    (pageId: string, cursor: { x: number; y: number } | null, selectedIds: string[]) => {
      send({ type: 'presence', pageId, cursor, selectedIds });
    },
    [send]
  );

  /** 페이지 전환 시 lastSentVersions 초기화 */
  const onPageSwitch = useCallback(() => {
    lastSentVersionsRef.current = {};
    pendingPushRef.current = null;
    queuedPushRef.current = null;
  }, []);

  // collaborators: 현재 페이지 유저만, 자기 자신 제외 (Excalidraw prop용 Map 변환)
  const collaborators = useMemo(() => {
    const map = new Map<string, Collaborator>();
    for (const [userId, presence] of Array.from(presenceMap.entries())) {
      if (userId === myUserId) continue;
      if (presence.pageId !== currentPageId) continue;
      const pData = participantsMap.get(userId);
      if (!pData) continue;
      map.set(userId, {
        pointer: presence.cursor ? { x: presence.cursor.x, y: presence.cursor.y, tool: 'pointer' } : undefined,
        button: 'up',
        selectedElementIds: Object.fromEntries(presence.selectedIds.map((id) => [id, true])),
        username: pData.userName,
        color: pData.color,
        isCurrentUser: false,
      });
    }
    return map;
  }, [presenceMap, participantsMap, currentPageId, myUserId]);

  const participants: Participant[] = useMemo(
    () => Array.from(participantsMap.entries())
      .map(([userId, data]) => ({
        userId,
        userName: data.userName,
        color: data.color,
      })),
    [participantsMap]
  );

  return { status, forceCloseMessage, pushChanges, pushPresence, pushFile, onPageSwitch, collaborators, participants, myUserId };
}
