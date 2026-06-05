import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { albumsApi } from '../api/albums';
import { useAuthStore } from '../store/authStore';
import { useRef, useCallback, useState, useEffect } from 'react';
import AlbumSettingsModal from '../components/AlbumSettingsModal';
import MembersModal from '../components/MembersModal';
import type { ExcalidrawElement, AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
import ExcalidrawCanvas, { type ExcalidrawAPI } from '../components/ExcalidrawCanvas';
import PageTabs, { type PageInfo } from '../components/PageTabs';
import { useExcalidrawSync } from '../hooks/useExcalidrawSync';
import api from '../api/client';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

export default function AlbumEditorPage() {
  const { albumId } = useParams<{ albumId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [pages, setPages] = useState<PageInfo[]>([]);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [pageElements, setPageElements] = useState<Record<string, readonly ExcalidrawElement[]>>({});
  const [remoteElements, setRemoteElements] = useState<readonly ExcalidrawElement[] | null>(null);

  const excalidrawApiRef = useRef<ExcalidrawAPI | null>(null);
  const currentPageIdRef = useRef(currentPageId);
  currentPageIdRef.current = currentPageId;

  // Album info
  const { data: album } = useQuery({
    queryKey: ['album', albumId],
    queryFn: () => albumsApi.get(albumId!),
    enabled: !!albumId,
  });

  const isViewer = album?.myRole === 'VIEWER';

  // Load pages
  useEffect(() => {
    if (!albumId) return;
    api.get<{ data: PageInfo[] }>(`/albums/${albumId}/pages`)
      .then((r) => {
        const ps = r.data.data;
        setPages(ps);
        if (ps.length > 0 && !currentPageId) {
          setCurrentPageId(ps[0].pageId);
        }
      })
      .catch(console.error);
  }, [albumId]);

  // Token getter (refresh if expiring)
  const getToken = useCallback(async (): Promise<string | null> => {
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
  }, []);

  // Excalidraw sync hook
  const { status, pushChanges, pushPresence, onPageSwitch } = useExcalidrawSync({
    albumId: albumId ?? '',
    currentPageId,
    getToken,
    onElements: useCallback((elements: readonly ExcalidrawElement[], pageId: string) => {
      if (pageId === currentPageIdRef.current) {
        setRemoteElements(elements);
      }
      setPageElements((prev) => ({ ...prev, [pageId]: elements }));
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
          if (currentPageIdRef.current === event.pageId && next.length > 0) {
            setCurrentPageId(next[0].pageId);
          }
          return next;
        });
      } else if (event.event === 'reordered') {
        setPages((prev) => prev.map((p) => p.pageId === event.pageId ? { ...p, pageOrder: event.pageOrder, name: event.pageName } : p));
      }
    }, []),
  });

  // Page switch
  const handlePageSelect = useCallback((pageId: string) => {
    if (pageId === currentPageId) return;
    onPageSwitch();
    setCurrentPageId(pageId);
    setRemoteElements(null);
    // Fetch page elements if not cached
    if (!pageElements[pageId]) {
      api.get<{ data: { elements: ExcalidrawElement[] } }>(`/albums/${albumId}/pages/${pageId}/elements`)
        .then((r) => {
          const els = r.data.data?.elements ?? [];
          setPageElements((prev) => ({ ...prev, [pageId]: els }));
          setRemoteElements(els);
        })
        .catch(() => {});
    } else {
      setRemoteElements(pageElements[pageId] as ExcalidrawElement[]);
    }
  }, [albumId, currentPageId, pageElements, onPageSwitch]);

  // Add page
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

  // Delete page
  const deletePageMutation = useMutation({
    mutationFn: (pageId: string) =>
      api.delete(`/albums/${albumId}/pages/${pageId}`),
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

  // onChange: detect changed elements and push
  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], _appState: AppState, _files: BinaryFiles) => {
      if (!currentPageId || isViewer) return;
      pushChanges(elements, currentPageId);
    },
    [currentPageId, isViewer, pushChanges]
  );

  const isOnline = status === 'connected';
  const isOffline = status === 'offline';
  const isConnecting = status === 'connecting';

  if (!albumId) return <div style={{ padding: '2rem' }}>앨범 ID가 없습니다.</div>;

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#F7F3FF' }}>
      {/* Top Bar */}
      <header style={{
        height: '56px', padding: '0 20px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(132,94,247,0.12)',
        boxShadow: '0 1px 20px rgba(132,94,247,0.08)', flexShrink: 0, zIndex: 201, position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
          <button
            onClick={() => navigate('/albums')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none',
              cursor: 'pointer', color: '#845EF7', fontWeight: 600, fontSize: '0.82rem',
              padding: '6px 12px', borderRadius: '10px', transition: 'all 150ms ease',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#EDE9FF'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
          >
            ← 목록
          </button>
          <div style={{ width: '1px', height: '22px', background: '#D8C8F0', margin: '0 8px' }} />
          <span style={{ fontWeight: 700, fontSize: '0.97rem', color: '#3D2052', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {album?.name ?? '앨범'}
          </span>
          {isViewer && (
            <span style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '8px', background: '#F3F0FF', color: '#845EF7', fontSize: '0.72rem', fontWeight: 600 }}>
              읽기 전용
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Status pill */}
          {isConnecting && <StatusPill color="#845EF7" bg="#F3F0FF" border="#D8C8F0" label="연결 중" pulse />}
          {isOnline && <StatusPill color="#059669" bg="#ECFDF5" border="#A7F3D0" label="실시간 동기화" />}
          {isOffline && <StatusPill color="#E11D48" bg="#FFF1F2" border="#FECDD3" label="오프라인" />}
          <button
            onClick={() => setShowMembers(true)}
            title="멤버 관리"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '4px 6px', borderRadius: '8px', lineHeight: 1 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#F0EBFF'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
          >👥</button>
          {album?.myRole === 'ADMIN' && (
            <button
              onClick={() => setShowSettings(true)}
              title="앨범 설정"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '4px 6px', borderRadius: '8px', lineHeight: 1 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#F0EBFF'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
            >⚙️</button>
          )}
        </div>
      </header>

      {/* Page Tabs */}
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

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {currentPageId ? (
          <ExcalidrawCanvas
            pageId={currentPageId}
            initialElements={pageElements[currentPageId] ?? []}
            remoteElements={remoteElements}
            onAPI={(api) => { excalidrawApiRef.current = api; }}
            onChange={handleChange}
            isReadonly={isViewer}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '16px', color: '#9C8BA6' }}>
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
