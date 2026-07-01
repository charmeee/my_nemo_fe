import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { getPresenceColor } from '../utils/presenceColor';
import type {
  SyncStatus,
  PushMessage,
  ServerMessage,
  ParticipantData,
  PresenceData,
  Collaborator,
  Participant,
  UseExcalidrawSyncOptions,
} from './useExcalidrawSync.types';

export type {
  SyncStatus,
  PageEvent,
  Collaborator,
  Participant,
  UseExcalidrawSyncOptions,
} from './useExcalidrawSync.types';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080';

// JWT payload 의 sub(=userId) 추출. self-presence 필터링에 사용
const extractJwtSub = (token: string): string | null => {
  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return null;
    const payload = JSON.parse(atob(payloadBase64)) as { sub?: unknown };
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
};

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
  // ── 연결/소켓 ────────────────────────────────────────────
  // 현재 WebSocket 인스턴스 (재연결 시 교체됨)
  const wsRef = useRef<WebSocket | null>(null);

  // ── 클록/버전 (LWW 동기화용) ───────────────────────────────
  // 로컬 논리 클록. push 마다 ++ 하여 clientClock 으로 전송
  const localClockRef = useRef(0);
  // 페이지별 마지막으로 수신한 serverClock. 재연결 시 delta hydration 기준점
  const lastClockByPageRef = useRef<Record<string, number>>({});
  // element id → 마지막으로 서버에 보낸 version. 변경분만 골라내는 데 사용
  const lastSentVersionsRef = useRef<Record<string, number>>({});

  // ── push 큐 (한 번에 하나만 in-flight) ─────────────────────
  // 서버 ack(push_result) 대기 중인 push. null 이면 즉시 전송 가능
  const pendingPushRef = useRef<PushMessage | null>(null);
  // pending 이 있는 동안 쌓이는 다음 push. ack 도착 시 승격되어 전송됨
  const queuedPushRef = useRef<PushMessage | null>(null);

  // ── 연결 상태 ─────────────────────────────────────────────
  // 현재 WS 연결 상태 (UI 표시용)
  const [status, setStatus] = useState<SyncStatus>('connecting');
  // 강제 종료(추방/권한변경/잠금) 사유 메시지. null 이면 정상
  const [forceCloseMessage, setForceCloseMessage] = useState<string | null>(null);

  // ── 재연결 (exponential backoff) ───────────────────────────
  // 예약된 재연결 setTimeout 핸들 (unmount 시 정리)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 연속 재연결 시도 횟수. backoff 지연 계산 및 연결 성공 시 0으로 리셋
  const reconnectAttemptsRef = useRef(0);

  // ── 콜백/props 의 최신값 ref (stale closure 방지) ──────────
  // 현재 페이지 id 의 최신값. 안정적인 콜백(빈 deps) 내부에서 참조
  const currentPageIdRef = useRef(currentPageId);
  // onFile 콜백의 최신값 ref
  const onFileRef = useRef(onFile);

  // ── presence/participants 상태 ─────────────────────────────
  // userId → 이름·색상. 방에 접속한 전체 참여자
  const [participantsMap, setParticipantsMap] = useState<Map<string, ParticipantData>>(new Map());
  // userId → 현재 페이지·커서·선택. 실시간 커서/선택 표시용
  const [presenceMap, setPresenceMap] = useState<Map<string, PresenceData>>(new Map());
  // 자기 자신의 userId (collaborators 에서 self 제외용)
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
  const connect = useCallback(async function connectInternal() {
    const token = await getToken();
    if (!token) return;

    // JWT에서 자신의 userId 추출 (self-presence 필터링용)
    const sub = extractJwtSub(token);
    if (sub) setMyUserId(sub);


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

    // ── 서버 메시지 타입별 핸들러 ─────────────────────────────

    // connected: 최초 hydration (참여자 목록 + 페이지 elements + 파일)
    const handleConnected = (msg: ServerMessage) => {
      reconnectAttemptsRef.current = 0; // 연결 성공 시 backoff 카운터 초기화
      setStatus('connected');
      const roomMembers = msg.roomMembers ?? [];
      if (roomMembers.length > 0) {
        setParticipantsMap(() => {
          const next = new Map<string, ParticipantData>();
          for (const m of roomMembers) {
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
        for (const [pageId, delta] of Object.entries(msg.deltaByPage ?? {})) {
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
    };

    // user_joined: 참여자 추가
    const handleUserJoined = (msg: ServerMessage) => {
      const userId = msg.userId;
      const userName = msg.userName;
      if (!userId || !userName) return;
      setParticipantsMap((prev) => {
        const next = new Map(prev);
        next.set(userId, { userName, color: getPresenceColor(userId) });
        return next;
      });
    };

    // user_left: 참여자 + presence 제거
    const handleUserLeft = (msg: ServerMessage) => {
      const userId = msg.userId;
      if (!userId) return;
      setParticipantsMap((prev) => { const next = new Map(prev); next.delete(userId); return next; });
      setPresenceMap((prev) => { const next = new Map(prev); next.delete(userId); return next; });
    };

    // presence: 커서/선택 갱신 (cursor 이벤트 vs selection 이벤트 병합)
    const handlePresence = (msg: ServerMessage) => {
      const p = msg.presence;
      if (!p) return;
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
    };

    // patch: 다른 클라이언트의 element 변경 반영
    const handlePatch = (msg: ServerMessage) => {
      if (!msg.pageId || typeof msg.serverClock !== 'number') return;
      lastClockByPageRef.current[msg.pageId] = msg.serverClock;
      onElements(msg.elements ?? [], msg.pageId);
    };

    // push_result: 내 push 에 대한 서버 ack. 큐에 쌓인 다음 push 전송
    const handlePushResult = (msg: ServerMessage) => {
      pendingPushRef.current = null;
      if (msg.action === 'rebase') {
        // server is newer — rebuild queued push from current scene
        queuedPushRef.current = null; // reset, scene state will rebuild on next onChange
      }
      flushQueue();
    };

    // excalidraw_file: 이미지 fileId → url 수신
    const handleExcalidrawFile = (msg: ServerMessage) => {
      if (!msg.fileId || !msg.url) return;
      onFileRef.current?.(msg.fileId, msg.url);
    };

    // page_event: 페이지 추가/삭제/순서변경
    const handlePageEvent = (msg: ServerMessage) => {
      if (!msg.event || !msg.pageId || !msg.pageName || typeof msg.pageOrder !== 'number') return;
      onPageEvent({
        event: msg.event,
        pageId: msg.pageId,
        pageName: msg.pageName,
        pageOrder: msg.pageOrder,
      });
    };

    // force-close: 서버 강제 종료(추방/권한변경/잠금)
    const handleForceClose = (msg: ServerMessage) => {
      ws.close();
      const reasonMessages: Record<string, string> = {
        kicked: '앨범에서 추방되었습니다.',
        'role-downgraded': '편집 권한이 변경되었습니다.',
        'album-locked': '앨범이 잠겼습니다.',
      };
      const reason = msg.reason;
      const message = reason ? (reasonMessages[reason] ?? '연결이 종료되었습니다.') : '연결이 종료되었습니다.';
      setStatus('error');
      setForceCloseMessage(message);
    };

    // 수신 메시지를 파싱 후 type 별 핸들러로 디스패치
    ws.onmessage = (event) => {
      let msg: ServerMessage;
      try {
        const parsed: unknown = JSON.parse(event.data);
        if (!parsed || typeof parsed !== 'object') return;
        msg = parsed as ServerMessage;
      } catch {
        return;
      }

      switch (msg.type) {
        case 'pong': break;
        case 'connected': handleConnected(msg); break;
        case 'user_joined': handleUserJoined(msg); break;
        case 'user_left': handleUserLeft(msg); break;
        case 'presence': handlePresence(msg); break;
        case 'patch': handlePatch(msg); break;
        case 'push_result': handlePushResult(msg); break;
        case 'excalidraw_file': handleExcalidrawFile(msg); break;
        case 'page_event': handlePageEvent(msg); break;
        case 'force-close': handleForceClose(msg); break;
        case 'error': console.warn('[ExcalidrawSync] server error:', msg.error); break;
      }
    };

    ws.onclose = () => {
      setStatus('offline');
      // Exponential backoff: 3s → 6s → 12s → ... 최대 60s
      const delay = Math.min(3000 * Math.pow(2, reconnectAttemptsRef.current), 60000);
      reconnectAttemptsRef.current += 1;
      reconnectTimerRef.current = setTimeout(() => {
        void connectInternal();
      }, delay);
    };

    ws.onerror = () => {
      setStatus('offline');
    };
  }, [albumId, getToken, send, flushQueue, onElements, onPageEvent]);

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

  // ─────────────────────────────────────────────────────────────
  // Effects (한곳에 모음 — 무엇이 무엇을 트리거하는지 파악용)
  // ─────────────────────────────────────────────────────────────

  // currentPageId prop 변경 → 안정 콜백에서 참조할 ref 갱신
  useEffect(() => {
    currentPageIdRef.current = currentPageId;
  }, [currentPageId]);

  // onFile prop 변경 → ref 갱신
  useEffect(() => {
    onFileRef.current = onFile;
  }, [onFile]);

  // connect 변경(=mount) → WS 연결 / unmount → 재연결 타이머 + 소켓 정리
  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { status, forceCloseMessage, pushChanges, pushPresence, pushFile, onPageSwitch, collaborators, participants, myUserId };
}
