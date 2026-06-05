import { useEffect, useRef, useCallback, useState } from 'react';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { getPresenceColor } from '../utils/presenceColor';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080';

export type SyncStatus = 'connecting' | 'connected' | 'offline' | 'error';

export interface UseExcalidrawSyncOptions {
  albumId: string;
  currentPageId: string | null;
  getToken: () => Promise<string | null>;
  onElements: (elements: readonly ExcalidrawElement[], pageId: string) => void;
  onPageEvent: (event: PageEvent) => void;
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

export function useExcalidrawSync({
  albumId,
  currentPageId,
  getToken,
  onElements,
  onPageEvent,
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

  type ParticipantData = { userName: string; color: { background: string; stroke: string } };
  type PresenceData = { pageId: string; cursor: { x: number; y: number } | null; selectedIds: string[] };
  const [participantsMap, setParticipantsMap] = useState<Map<string, ParticipantData>>(new Map());
  const [presenceMap, setPresenceMap] = useState<Map<string, PresenceData>>(new Map());

  const send = useCallback((data: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }, []);

  const flushQueue = useCallback(() => {
    if (pendingPushRef.current === null && queuedPushRef.current !== null) {
      pendingPushRef.current = queuedPushRef.current;
      queuedPushRef.current = null;
      send({ type: 'push', ...pendingPushRef.current });
    }
  }, [send]);

  const connect = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

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
          next.set(p.userId, {
            pageId: p.pageId ?? '',
            cursor: p.cursor ?? null,
            selectedIds: Array.isArray(p.selectedIds) ? p.selectedIds : [],
          });
          return next;
        });
      }

      if (msg.type === 'patch') {
        lastClockByPageRef.current[msg.pageId] = msg.serverClock;
        if (msg.pageId === currentPageIdRef.current) {
          onElements(msg.elements ?? [], msg.pageId);
        }
      }

      if (msg.type === 'push_result') {
        pendingPushRef.current = null;
        if (msg.action === 'rebase') {
          // server is newer — rebuild queued push from current scene
          queuedPushRef.current = null; // reset, scene state will rebuild on next onChange
        }
        flushQueue();
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

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

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

  // collaborators: 현재 페이지 유저만 (Excalidraw prop용)
  const collaborators = new Map<string, Collaborator>();
  for (const [userId, presence] of Array.from(presenceMap.entries())) {
    if (presence.pageId !== currentPageId) continue;
    const pData = participantsMap.get(userId);
    if (!pData) continue;
    collaborators.set(userId, {
      pointer: presence.cursor ? { x: presence.cursor.x, y: presence.cursor.y, tool: 'pointer' } : undefined,
      button: 'up',
      selectedElementIds: Object.fromEntries(presence.selectedIds.map((id) => [id, true])),
      username: pData.userName,
      color: pData.color,
      isCurrentUser: false,
    });
  }

  const participants: Participant[] = Array.from(participantsMap.entries()).map(([userId, data]) => ({
    userId,
    userName: data.userName,
    color: data.color,
  }));

  return { status, forceCloseMessage, pushChanges, pushPresence, onPageSwitch, collaborators, participants };
}
