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
  const currentPageIdRef = useRef(currentPageId);
  currentPageIdRef.current = currentPageId;
  const uploadedFileIdsRef = useRef<Set<string>>(new Set());

  const { data: album } = useQuery({
    queryKey: ['album', albumId],
    queryFn: () => albumsApi.get(albumId!),
    enabled: !!albumId,
  });

  const isViewer = isGuest || album?.myRole === 'VIEWER';

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

  const { status, forceCloseMessage, pushChanges, pushPresence, pushFile, onPageSwitch, collaborators, participants, myUserId } = useExcalidrawSync({
    albumId: albumId ?? '',
    currentPageId,
    getToken,
    onFile: useCallback(async (fileId: string, url: string) => {
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
        (excalidrawApiRef.current as any)?.updateScene({
          files: { [fileId]: { id: fileId, dataURL, mimeType: blob.type, created: Date.now() } },
        });
      } catch {}
    }, []),
    onElements: useCallback((elements: readonly ExcalidrawElement[], pageId: string) => {
      if (pageId === currentPageIdRef.current) setRemoteElements(elements);
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
    api.get<{ data: { elements: ExcalidrawElement[] } }>(`/albums/${albumId}/pages/${pageId}/elements`)
      .then((r) => {
        const els = r.data.data?.elements ?? [];
        setPageElements((prev) => ({ ...prev, [pageId]: els }));
        setRemoteElements(els);
      })
      .catch(() => {});
  }, [albumId, currentPageId, pageElements, onPageSwitch]);

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

  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], _appState: AppState, files: BinaryFiles) => {
      if (!currentPageId || isViewer) return;
      pushChanges(elements, currentPageId);

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
  const handlePointerUpdate = useCallback((payload: { pointer: { x: number; y: number } }) => {
    const now = Date.now();
    if (now - lastCursorPushRef.current < 50) return;
    lastCursorPushRef.current = now;
    const pid = currentPageIdRef.current;
    if (!pid || isViewerRef.current) return;
    pushPresenceRef.current(pid, payload.pointer, []);
  }, []);

  const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

function StatusPill({ color, bg, border, label, pulse }: { color: string; bg: string; border: string; label: string; pulse?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', background: bg, border: `1px solid ${border}`, fontSize: '0.72rem', fontWeight: 600, color }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, ...(pulse ? { animation: 'pulse 1.2s ease-in-out infinite' } : {}) }} />
      {label}
    </div>
  );
}
