import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Users, Settings, Moon, Sun } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { albumsApi } from '../api/albums';
import { useAuthStore } from '../store/authStore';
import { useRef, useCallback, useState, useEffect } from 'react';
import AlbumSettingsModal from '../components/AlbumSettingsModal';
import MembersModal from '../components/MembersModal';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
import ExcalidrawCanvas, { type ExcalidrawAPI } from '../components/ExcalidrawCanvas';
import PageTabs, { type PageInfo } from '../components/PageTabs';
import { useExcalidrawSync } from '../hooks/useExcalidrawSync';
import { useTheme } from '../context/ThemeContext';
import api from '../api/client';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

// 앨범 에디터 페이지: Excalidraw 캔버스 + WS sync + 멀티페이지 + 게스트 read-only 지원
export default function AlbumEditorPage() {
  const { albumId } = useParams<{ albumId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isGuest = location.pathname.endsWith('/guest');
  const { isDark, toggle } = useTheme();

  const [pages, setPages] = useState<PageInfo[]>([]);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [pageElements, setPageElements] = useState<Record<string, readonly ExcalidrawElement[]>>({});
  const [remoteElements, setRemoteElements] = useState<readonly ExcalidrawElement[] | null>(null);

  const excalidrawApiRef = useRef<ExcalidrawAPI | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const currentPageIdRef = useRef(currentPageId);
  currentPageIdRef.current = currentPageId;
  // pages 도 ref 로 노출 — onElements 콜백이 stable(deps [])이어야 해서 직접 못 씀
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  // 현재 페이지에서 인덱스 차이가 이 값 이하인 페이지만 캐시 유지
  const PAGE_CACHE_RADIUS = 2;
  const uploadedFileIdsRef = useRef<Set<string>>(new Set());
  // 페이지 전환 시 동일 fileId 재다운로드 방지 (in-flight 도 dedup)
  const loadedFileIdsRef = useRef<Set<string>>(new Set());
  const inFlightFileIdsRef = useRef<Map<string, Promise<void>>>(new Map());

  // 외부 scroll-area 가 스크롤되면 Excalidraw 의 캐시된 offsetLeft/offsetTop 이
  // stale 해진다 (자기 컨테이너 내부 scroll 만 onScroll 로 잡음). 그 결과
  // event.clientX - state.offsetLeft 로 계산한 포인터 좌표가 outer scroll 만큼
  // 어긋난다. outer scroll/resize 에서 refresh() 를 호출해 다시 측정시킨다.
  //
  // refresh() 는 getBoundingClientRect + setState 이라 캔버스 re-render 를 유발.
  // Excalidraw 자체도 자기 onScroll 을 100ms debounce 한다(SCROLL_TIMEOUT).
  // 그에 맞춰 trailing throttle 80ms 로 묶고, 윈도우가 닫힌 뒤 한 번 더 호출해
  // 마지막 위치를 보장한다 (scroll 멈춘 직후 클릭이 어긋나지 않게).
  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const THROTTLE_MS = 80;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let queued = false;
    const fireRefresh = () => (excalidrawApiRef.current as any)?.refresh?.();
    const onScroll = () => {
      if (timerId !== null) {
        queued = true;
        return;
      }
      fireRefresh();
      timerId = setTimeout(function tail() {
        timerId = null;
        if (queued) {
          queued = false;
          fireRefresh();
          timerId = setTimeout(tail, THROTTLE_MS);
        }
      }, THROTTLE_MS);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (timerId !== null) clearTimeout(timerId);
    };
  }, []);

  const { data: album } = useQuery({
    queryKey: ['album', albumId],
    queryFn: () => albumsApi.get(albumId!),
    enabled: !!albumId,
  });

  const isViewer = isGuest || album?.myRole === 'VIEWER';

  // 페이지 목록 로드: 게스트는 invite code, 로그인 유저는 REST로 첫 페이지를 currentPageId로 세팅
  useEffect(() => {
    if (!albumId) return;
    if (isGuest) {
      const code = sessionStorage.getItem('guestInviteCode');
      if (!code) return;
      const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';
      fetch(`${baseUrl}/invite/${code}/pages`)
        .then((r) => r.json())
        .then((j) => {
          const ps: PageInfo[] = j.data ?? [];
          setPages(ps);
          if (ps.length > 0 && !currentPageId) setCurrentPageId(ps[0].pageId);
        })
        .catch(console.error);
    } else {
      api.get<{ data: PageInfo[] }>(`/albums/${albumId}/pages`)
        .then((r) => {
          const ps = r.data.data;
          setPages(ps);
          if (ps.length > 0 && !currentPageId) setCurrentPageId(ps[0].pageId);
        })
        .catch(console.error);
    }
  }, [albumId, isGuest]);

  // WS 접속용 토큰 발급: 만료 60초 전이면 미리 /auth/refresh 호출 (게스트는 sessionStorage 토큰 사용)
  const getToken = useCallback(async (): Promise<string | null> => {
    if (isGuest) return sessionStorage.getItem('guestToken');
    let token = useAuthStore.getState().accessToken;
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if ((payload.exp - 60) * 1000 < Date.now()) {
        const res = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
        const json = await res.json();
        if (json.success && json.data?.accessToken) {
          token = json.data.accessToken;
          useAuthStore.getState().setToken(token!);
        }
      }
    } catch {}
    return token;
  }, [isGuest]);

  // 이미지 파일 URL → blob → dataURL → Excalidraw API에 등록 (addFiles로 ShapeCache 무효화까지)
  // 동일 fileId 가 이미 로드됐거나 in-flight 면 fetch 스킵
  const loadExcalidrawFile = useCallback(async (fileId: string, url: string) => {
    if (loadedFileIdsRef.current.has(fileId)) return;
    const existing = inFlightFileIdsRef.current.get(fileId);
    if (existing) return existing;

    const p = (async () => {
      try {
        const token = useAuthStore.getState().accessToken;
        const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';
        const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
        const res = await fetch(fullUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const blob = await res.blob();
        const dataURL = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        const api: any = excalidrawApiRef.current;
        if (!api) return;
        const fileEntry = { id: fileId, dataURL, mimeType: blob.type, created: Date.now() };
        // addFiles 는 files 등록뿐 아니라 ShapeCache 무효화 + imageCache 갱신 + scene
        // triggerUpdate 까지 같이 해서 placeholder 가 풀린다. updateScene({files}) 는
        // file map 만 merge 해서 첫 render 때 캐시된 placeholder 가 그대로 남는다.
        if (typeof api.addFiles === 'function') {
          api.addFiles([fileEntry]);
        } else {
          api.updateScene({ files: { [fileId]: fileEntry } });
        }
        loadedFileIdsRef.current.add(fileId);
      } catch {}
      finally {
        inFlightFileIdsRef.current.delete(fileId);
      }
    })();
    inFlightFileIdsRef.current.set(fileId, p);
    return p;
  }, []);

  const { status, forceCloseMessage, pushChanges, pushPresence, pushFile, onPageSwitch, collaborators, participants, myUserId } = useExcalidrawSync({
    albumId: albumId ?? '',
    currentPageId,
    getToken,
    onFile: loadExcalidrawFile,
    // 서버에서 받은 elements를 페이지별 캐시에 LWW 머지 (현재 페이지면 remoteElements도 업데이트)
    // CRITICAL: deps 비워두기 — 불안정하면 WS 재연결 루프 발생, 페이지 ID는 ref로 접근
    onElements: useCallback((elements: readonly ExcalidrawElement[], pageId: string) => {
      if (pageId === currentPageIdRef.current) setRemoteElements(elements);
      // 현재 페이지에서 ±PAGE_CACHE_RADIUS 밖이면 캐시 머지 skip (메모리/리렌더 절약)
      const ps = pagesRef.current;
      const curIdx = ps.findIndex((p) => p.pageId === currentPageIdRef.current);
      const tgtIdx = ps.findIndex((p) => p.pageId === pageId);
      if (curIdx < 0 || tgtIdx < 0 || Math.abs(curIdx - tgtIdx) > PAGE_CACHE_RADIUS) return;
      setPageElements((prev) => {
        const existing = prev[pageId];
        if (!existing || existing.length === 0) return { ...prev, [pageId]: elements };
        const map = new Map(existing.map((el) => [(el as ExcalidrawElement).id, el as ExcalidrawElement]));
        for (const el of elements as ExcalidrawElement[]) {
          const cur = map.get(el.id);
          if (!cur || el.version > cur.version) map.set(el.id, el);
        }
        return { ...prev, [pageId]: Array.from(map.values()) };
      });
    }, []),
    // 다른 클라이언트의 페이지 추가/삭제/재정렬 이벤트 반영 (added는 dedup으로 중복 추가 방지)
    onPageEvent: useCallback((event) => {
      if (event.event === 'added') {
        setPages((prev) => {
          if (prev.some((p) => p.pageId === event.pageId)) return prev;
          return [...prev, { pageId: event.pageId, name: event.pageName, pageOrder: event.pageOrder }];
        });
      } else if (event.event === 'deleted') {
        setPages((prev) => {
          const next = prev.filter((p) => p.pageId !== event.pageId);
          if (currentPageIdRef.current === event.pageId && next.length > 0) setCurrentPageId(next[0].pageId);
          return next;
        });
      } else if (event.event === 'reordered') {
        setPages((prev) => prev.map((p) => p.pageId === event.pageId ? { ...p, pageOrder: event.pageOrder, name: event.pageName } : p));
      }
    }, []),
  });

  // 현재 페이지 / pages 순서 변경 시 ±PAGE_CACHE_RADIUS 밖 캐시 정리
  // 캐시는 페이지 전환 직후 깜빡임 방지용 — 멀리 있는 페이지는 어차피 REST refetch 하므로 버려도 됨
  useEffect(() => {
    if (!currentPageId) return;
    const curIdx = pages.findIndex((p) => p.pageId === currentPageId);
    if (curIdx < 0) return;
    const keepIds = new Set(
      pages
        .filter((_, idx) => Math.abs(idx - curIdx) <= PAGE_CACHE_RADIUS)
        .map((p) => p.pageId)
    );
    setPageElements((prev) => {
      const cachedIds = Object.keys(prev);
      if (cachedIds.every((id) => keepIds.has(id))) return prev;
      const next: Record<string, readonly ExcalidrawElement[]> = {};
      for (const id of cachedIds) if (keepIds.has(id)) next[id] = prev[id];
      return next;
    });
  }, [currentPageId, pages]);

  // 페이지 전환: 캐시 즉시 표시(UX) + REST로 최신 elements/files 다시 받아 동기화 보장
  const handlePageSelect = useCallback((pageId: string) => {
    if (pageId === currentPageId) return;
    onPageSwitch();
    setCurrentPageId(pageId);
    setRemoteElements(null);
    // 캐시가 있으면 즉시 표시 (UX: 빠른 전환)
    if (pageElements[pageId]) {
      setRemoteElements(pageElements[pageId] as ExcalidrawElement[]);
    }
    // 항상 REST API로 최신 데이터 fetch (동기화 보장)
    api.get<{ data: { elements: ExcalidrawElement[]; files?: Record<string, string> } }>(`/albums/${albumId}/pages/${pageId}/elements`)
      .then((r) => {
        const els = r.data.data?.elements ?? [];
        const files = r.data.data?.files ?? {};
        setPageElements((prev) => ({ ...prev, [pageId]: els }));
        setRemoteElements(els);
        for (const [fileId, url] of Object.entries(files)) {
          loadExcalidrawFile(fileId, url);
        }
      })
      .catch(() => {});
  }, [albumId, currentPageId, pageElements, onPageSwitch, loadExcalidrawFile]);

  // 새 페이지 생성 (성공 시 onPageEvent와 중복되지 않게 dedup, 바로 해당 페이지로 전환)
  const addPageMutation = useMutation({
    mutationFn: () =>
      api.post<{ data: PageInfo }>(`/albums/${albumId}/pages`, { name: `페이지 ${pages.length + 1}` })
        .then((r) => r.data.data),
    onSuccess: (page) => {
      setPages((prev) => prev.some((p) => p.pageId === page.pageId) ? prev : [...prev, page]);
      setCurrentPageId(page.pageId);
      onPageSwitch();
    },
  });

  // 페이지 삭제 (현재 페이지면 첫 번째 페이지로 자동 전환)

  const deletePageMutation = useMutation({
    mutationFn: (pageId: string) => api.delete(`/albums/${albumId}/pages/${pageId}`),
    onSuccess: (_, pageId) => {
      setPages((prev) => {
        const next = prev.filter((p) => p.pageId !== pageId);
        if (currentPageId === pageId && next.length > 0) {
          setCurrentPageId(next[0].pageId);
          onPageSwitch();
        }
        return next;
      });
    },
  });

  const pushFileRef = useRef(pushFile);
  pushFileRef.current = pushFile;

  // drag 중에는 120ms trailing throttle 로 묶어 보내고, drag/edit/resize 가 끝나는
  // 순간(상태가 truthy → falsy) 마지막 elements 를 즉시 commit 한다.
  // → WS push 빈도가 1/100 수준으로 떨어져 rate-limit drop 으로 인한 divergence 가 사라진다.
  const PUSH_THROTTLE_MS = 120;
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingElementsRef = useRef<readonly ExcalidrawElement[] | null>(null);
  const wasInteractingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, []);

  // Excalidraw onChange: drag/edit/resize 중엔 120ms throttle, 끝나는 순간 즉시 flush + 신규 이미지 업로드
  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
      if (!currentPageId || isViewer) return;
      pendingElementsRef.current = elements;

      const a = appState as any;
      const isInteracting = !!(a.draggingElement || a.newElement || a.editingElement || a.resizingElement || a.multiElement);

      if (wasInteractingRef.current && !isInteracting) {
        // drag/edit/resize 종료 → 즉시 마지막 상태 commit
        wasInteractingRef.current = false;
        if (pushTimerRef.current) {
          clearTimeout(pushTimerRef.current);
          pushTimerRef.current = null;
        }
        const els = pendingElementsRef.current;
        pendingElementsRef.current = null;
        if (els) pushChanges(els, currentPageId);
      } else {
        wasInteractingRef.current = isInteracting;
        // throttle 윈도우가 비어 있으면 시작 — 그 사이 onChange 는 pendingElementsRef 로 누적
        if (pushTimerRef.current === null) {
          pushTimerRef.current = setTimeout(() => {
            pushTimerRef.current = null;
            const els = pendingElementsRef.current;
            pendingElementsRef.current = null;
            const pid = currentPageIdRef.current;
            if (els && pid && !isViewer) pushChanges(els, pid);
          }, PUSH_THROTTLE_MS);
        }
      }

      // 새로 삽입된 이미지 파일 감지 → 백엔드 업로드 후 WS로 URL 공유
      for (const [fileId, file] of Object.entries(files)) {
        if (uploadedFileIdsRef.current.has(fileId)) continue;
        uploadedFileIdsRef.current.add(fileId);

        const supportedMimes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!supportedMimes.includes(file.mimeType)) continue;

        (async () => {
          try {
            const [, b64] = file.dataURL.split(',');
            const binary = atob(b64);
            const arr = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
            const blob = new Blob([arr], { type: file.mimeType });
            const ext = file.mimeType === 'image/jpeg' ? 'jpg' : file.mimeType.split('/')[1];
            const formData = new FormData();
            formData.append('file', blob, `excalidraw-${fileId}.${ext}`);
            formData.append('excalidrawFileId', fileId);
            const res = await api.post<{ data: { url: string } }>(`/albums/${albumId}/images`, formData);
            pushFileRef.current(fileId, res.data.data.url);
          } catch {
            uploadedFileIdsRef.current.delete(fileId);
          }
        })();
      }
    },
    [currentPageId, isViewer, pushChanges, albumId]
  );

  const pushPresenceRef = useRef(pushPresence);
  pushPresenceRef.current = pushPresence;
  const isViewerRef = useRef(isViewer);
  isViewerRef.current = isViewer;

  const lastCursorPushRef = useRef(0);
  // 커서 presence 전송 (50ms throttle로 네트워크 부하 제한)
  const handlePointerUpdate = useCallback((payload: { pointer: { x: number; y: number } }) => {
    const now = Date.now();
    if (now - lastCursorPushRef.current < 50) return;
    lastCursorPushRef.current = now;
    const pid = currentPageIdRef.current;
    if (!pid || isViewerRef.current) return;
    pushPresenceRef.current(pid, payload.pointer, []);
  }, []);

  const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 선택 변경 presence 전송 (100ms debounce)
  const handleSelectionChange = useCallback((selectedIds: string[]) => {
    if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
    selectionTimerRef.current = setTimeout(() => {
      const pid = currentPageIdRef.current;
      if (!pid || isViewerRef.current) return;
      pushPresenceRef.current(pid, null, selectedIds);
    }, 100);
  }, []);

  const isOnline = status === 'connected';
  const isOffline = status === 'offline';
  const isConnecting = status === 'connecting';

  if (!albumId) return <div style={{ padding: '2rem' }}>앨범 ID가 없습니다.</div>;

  if (forceCloseMessage) {
    return (
      <div style={{
        width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--editor-bg-app)', gap: '16px',
      }}>
        <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--editor-title-color)' }}>{forceCloseMessage}</p>
        <button
          onClick={() => navigate('/albums')}
          style={{
            background: 'linear-gradient(135deg, #845EF7, #FF6B9D)',
            color: '#fff', border: 'none', borderRadius: '10px',
            padding: '10px 24px', fontWeight: 700, cursor: 'pointer',
          }}
        >
          앨범 목록으로
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--editor-bg-app)' }}>
      {/* 게스트 배너 */}
      {isGuest && (
        <div style={{
          background: 'linear-gradient(90deg, #845EF7, #FF6B9D)',
          color: '#fff', padding: '8px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: '0.82rem', fontWeight: 600, flexShrink: 0,
        }}>
          <span>지금은 읽기 전용으로 보고 있어요. 로그인하면 함께 편집할 수 있어요!</span>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.5)',
              color: '#fff', borderRadius: '8px', padding: '4px 14px',
              cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem',
            }}
          >
            로그인
          </button>
        </div>
      )}

      {/* Top Bar */}
      <header style={{
        height: '56px', padding: '0 20px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--editor-header-bg)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--editor-header-border)',
        boxShadow: 'var(--editor-header-shadow)',
        flexShrink: 0, zIndex: 201, position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
          <button
            onClick={() => navigate('/albums')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--editor-back-color)', fontWeight: 600, fontSize: '0.82rem',
              padding: '6px 12px', borderRadius: '10px', transition: 'all 150ms ease',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--editor-back-hover)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
          >
            <ArrowLeft size={15} style={{ flexShrink: 0 }} /> 목록
          </button>
          <div style={{ width: '1px', height: '22px', background: 'var(--editor-border)', margin: '0 8px' }} />
          <span style={{ fontWeight: 700, fontSize: '0.97rem', color: 'var(--editor-title-color)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {album?.name ?? '앨범'}
          </span>
          {isViewer && (
            <span style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '8px', background: 'var(--editor-back-hover)', color: 'var(--editor-back-color)', fontSize: '0.72rem', fontWeight: 600 }}>
              읽기 전용
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {participants.filter((p) => p.userId !== myUserId).map((p) => (
            <div
              key={p.userId}
              title={p.userName}
              style={{
                padding: '3px 10px', borderRadius: '20px',
                background: p.color.background, color: '#fff',
                fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {p.userName.length > 8 ? p.userName.slice(0, 8) + '...' : p.userName}
            </div>
          ))}
          {myUserId && (
            <div
              title="나"
              style={{
                padding: '3px 10px', borderRadius: '20px',
                background: '#6B7280', color: '#fff',
                fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              나
            </div>
          )}
          {isConnecting && <StatusPill color="#845EF7" bg="var(--editor-back-hover)" border="var(--editor-border)" label="연결 중" pulse />}
          {isOnline && <StatusPill color="#059669" bg="#ECFDF5" border="#A7F3D0" label="실시간 동기화" />}
          {isOffline && <StatusPill color="#E11D48" bg="#FFF1F2" border="#FECDD3" label="오프라인" />}

          {/* 다크 모드 토글 */}
          <button
            onClick={toggle}
            title={isDark ? '라이트 모드' : '다크 모드'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: '8px', display: 'flex', alignItems: 'center', color: 'var(--editor-icon-color)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--editor-icon-hover)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {!isGuest && (
            <button
              onClick={() => setShowMembers(true)}
              title="멤버 관리"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: '8px', display: 'flex', alignItems: 'center', color: 'var(--editor-icon-color)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--editor-icon-hover)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
            ><Users size={20} /></button>
          )}
          {!isGuest && album?.myRole === 'ADMIN' && (
            <button
              onClick={() => setShowSettings(true)}
              title="앨범 설정"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: '8px', display: 'flex', alignItems: 'center', color: 'var(--editor-icon-color)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--editor-icon-hover)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
            ><Settings size={20} /></button>
          )}
        </div>
      </header>

      {/* Canvas scroll area — PageTabs + Canvas */}
      <div
        ref={scrollAreaRef}
        className="editor-scroll-area"
        style={{
          flex: 1,
          overflow: 'auto',
          background: 'var(--editor-canvas-margin-bg)',
          padding: '32px 40px 40px',
          display: 'flex',
          alignItems: currentPageId ? 'flex-start' : 'center',
        }}
      >
        {currentPageId ? (
          <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, margin: '0 auto' }}>
            <PageTabs
              pages={pages}
              currentPageId={currentPageId}
              onSelect={handlePageSelect}
              onAdd={() => addPageMutation.mutate()}
              onDelete={(pageId) => {
                if (window.confirm('이 페이지를 삭제하시겠습니까?')) {
                  deletePageMutation.mutate(pageId);
                }
              }}
              canEdit={!isViewer}
            />
            <ExcalidrawCanvas
              pageId={currentPageId}
              initialElements={pageElements[currentPageId] ?? []}
              remoteElements={remoteElements}
              onAPI={(api) => { excalidrawApiRef.current = api; }}
              onChange={handleChange}
              isReadonly={isViewer}
              isDark={isDark}
              collaborators={collaborators}
              onPointerUpdate={handlePointerUpdate}
              onSelectionChange={handleSelectionChange}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', color: 'var(--nemo-text-3)' }}>
            <p>페이지가 없습니다.</p>
            {!isViewer && (
              <button
                onClick={() => addPageMutation.mutate()}
                style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #845EF7, #FF6B9D)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}
              >
                + 첫 번째 페이지 추가
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

      {showSettings && album && (
        <AlbumSettingsModal album={album} onClose={() => setShowSettings(false)} />
      )}
      {showMembers && album && (
        <MembersModal albumId={albumId!} myRole={album.myRole ?? 'VIEWER'} onClose={() => setShowMembers(false)} />
      )}
    </div>
  );
}

// WS 연결 상태 표시 pill (연결 중/실시간/오프라인)
function StatusPill({ color, bg, border, label, pulse }: { color: string; bg: string; border: string; label: string; pulse?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', background: bg, border: `1px solid ${border}`, fontSize: '0.72rem', fontWeight: 600, color }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, ...(pulse ? { animation: 'pulse 1.2s ease-in-out infinite' } : {}) }} />
      {label}
    </div>
  );
}
