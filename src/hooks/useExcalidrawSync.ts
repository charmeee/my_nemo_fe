import { useEffect, useRef, useCallback, useState } from 'react';
import type { ExcalidrawElement, AppState, BinaryFiles } from '@excalidraw/excalidraw/types';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080';
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

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
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentPageIdRef = useRef(currentPageId);
  currentPageIdRef.current = currentPageId;

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

    const ws = new WebSocket(
      `${WS_URL}/sync/excalidraw/${albumId}?token=${token}`
    );
    wsRef.current = ws;
    setStatus('connecting');

    ws.onopen = () => {
      send({
        type: 'connect',
        lastClockByPage: lastClockByPageRef.current,
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
        setStatus('connected');
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
        setStatus('error');
      }

      if (msg.type === 'error') {
        console.warn('[ExcalidrawSync] server error:', msg.error);
      }
    };

    ws.onclose = () => {
      setStatus('offline');
      // Exponential backoff reconnect (3s)
      reconnectTimerRef.current = setTimeout(() => connect(), 3000);
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

  return { status, pushChanges, pushPresence, onPageSwitch };
}
