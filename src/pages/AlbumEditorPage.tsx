import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Tldraw } from '@tldraw/tldraw';
import { useSync } from '@tldraw/sync';
import '@tldraw/tldraw/tldraw.css';
import { albumsApi } from '../api/albums';
import { useAuthStore } from '../store/authStore';
import { useRef, useCallback, useMemo } from 'react';
import type { Editor, TLCameraOptions, TLUiOverrides, TLAssetStore } from '@tldraw/tldraw';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080';

// GoodNotes 스타일 고정 캔버스 (1600×1100 — 가로형 페이지)
const CAMERA_OPTIONS: TLCameraOptions = {
  isLocked: false,
  panSpeed: 1,
  zoomSpeed: 1,
  wheelBehavior: 'zoom',
  zoomSteps: [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4],
  constraints: {
    bounds: { x: 0, y: 0, w: 1600, h: 1100 },
    padding: { x: 64, y: 64 },
    origin: { x: 0.5, y: 0.5 },
    initialZoom: 'fit-max',
    baseZoom: 'fit-max',
    behavior: 'contain',
  },
};

// 한국어 번역 누락 키 보완
const UI_OVERRIDES: TLUiOverrides = {
  translations: {
    ko: {
      'page-menu.max-pages-reached': '최대 페이지 수에 도달했습니다',
      'page-menu.resize': '페이지 크기 조절',
    },
    'ko-kr': {
      'page-menu.max-pages-reached': '최대 페이지 수에 도달했습니다',
      'page-menu.resize': '페이지 크기 조절',
    },
  },
};

export default function AlbumEditorPage() {
  const { albumId } = useParams<{ albumId: string }>();
  const navigate = useNavigate();
  const editorRef = useRef<Editor | null>(null);

  // useRef keeps the same function object forever — it never changes between renders,
  // so useSync's effect never re-runs due to URI changes.
  // albumId is captured in a separate ref so the closure always reads the latest value.
  const albumIdRef = useRef(albumId);
  albumIdRef.current = albumId;
  const getUri = useRef(async () => {
    let token = useAuthStore.getState().accessToken;

    // Refresh the access token if it's missing or about to expire (within 60s)
    const needsRefresh = (() => {
      if (!token) return true;
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return (payload.exp - 60) * 1000 < Date.now();
      } catch {
        return true;
      }
    })();

    if (needsRefresh) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        const json = await res.json();
        if (json.success && json.data?.accessToken) {
          token = json.data.accessToken;
          useAuthStore.getState().setToken(token!);
        }
      } catch {
        // proceed with existing token
      }
    }

    return `${WS_URL}/sync/albums/${albumIdRef.current}?token=${token}`;
  }).current;

  const { data: album } = useQuery({
    queryKey: ['album', albumId],
    queryFn: () => albumsApi.get(albumId!),
    enabled: !!albumId,
  });

  const assets = useMemo<TLAssetStore>(() => ({
    upload: async (_asset, file) => {
      if (!albumIdRef.current) throw new Error('No albumId');
      const token = useAuthStore.getState().accessToken;
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`http://localhost:8080/albums/${albumIdRef.current}/images`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json();
      return json.data?.url ?? '';
    },
    resolve: async (asset) => asset.props.src ?? '',
  }), []);

  const storeWithStatus = useSync({ uri: getUri, assets });

  const handleExport = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;
    try {
      const shapeIds = [...editor.getCurrentPageShapeIds()];
      if (shapeIds.length === 0) { alert('캔버스에 내용이 없습니다.'); return; }
      const { blob } = await editor.toImage(shapeIds, { format: 'png', background: true, scale: 2 });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${album?.name ?? 'nemo'}.png`; a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('내보내기에 실패했습니다.');
    }
  }, [album?.name]);

  if (!albumId) return <div style={{ padding: '2rem', color: '#9C8BA6' }}>앨범 ID가 없습니다.</div>;

  const isOnline = storeWithStatus.status === 'synced-remote' && storeWithStatus.connectionStatus !== 'offline';
  const isOffline = storeWithStatus.status === 'synced-remote' && storeWithStatus.connectionStatus === 'offline';
  const isLoading = storeWithStatus.status === 'loading';

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#F7F3FF' }}>
      {/* Top Bar */}
      <header style={{
        height: '56px',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(132,94,247,0.12)',
        boxShadow: '0 1px 20px rgba(132,94,247,0.08)',
        flexShrink: 0,
        zIndex: 201,
        position: 'relative',
      }}>
        {/* Left: back + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
          <button
            onClick={() => navigate('/albums')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#845EF7', fontWeight: 600, fontSize: '0.82rem',
              padding: '6px 12px', borderRadius: '10px',
              transition: 'all 150ms ease',
              letterSpacing: '-0.01em',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = '#EDE9FF';
              (e.currentTarget as HTMLElement).style.color = '#6741D9';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'none';
              (e.currentTarget as HTMLElement).style.color = '#845EF7';
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M10 7H4M4 7l3-3M4 7l3 3" />
            </svg>
            목록
          </button>
          <div style={{ width: '1px', height: '22px', background: 'linear-gradient(to bottom, transparent, #D8C8F0, transparent)', margin: '0 8px' }} />
          {/* Brand dot */}
          <div style={{
            width: '28px', height: '28px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #FF6B9D, #845EF7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', marginRight: '10px',
            boxShadow: '0 2px 8px rgba(132,94,247,0.35)',
          }}>
            📷
          </div>
          <span style={{
            fontWeight: 700, fontSize: '0.97rem',
            background: 'linear-gradient(135deg, #1C1017, #3D2052)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {album?.name ?? '앨범'}
          </span>
        </div>

        {/* Right: status + export */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Connection status pill */}
          {isLoading && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '4px 10px', borderRadius: '20px',
              background: '#F3F0FF', border: '1px solid #D8C8F0',
              fontSize: '0.72rem', fontWeight: 600, color: '#845EF7',
            }}>
              <div style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: '#845EF7',
                animation: 'pulse 1.2s ease-in-out infinite',
              }} />
              연결 중
            </div>
          )}
          {isOnline && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '4px 10px', borderRadius: '20px',
              background: '#ECFDF5', border: '1px solid #A7F3D0',
              fontSize: '0.72rem', fontWeight: 600, color: '#059669',
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} />
              실시간 동기화
            </div>
          )}
          {isOffline && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '4px 10px', borderRadius: '20px',
              background: '#FFF1F2', border: '1px solid #FECDD3',
              fontSize: '0.72rem', fontWeight: 600, color: '#E11D48',
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#F43F5E' }} />
              오프라인
            </div>
          )}

          <button
            onClick={handleExport}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px',
              background: 'linear-gradient(135deg, #845EF7, #FF6B9D)',
              color: '#fff',
              border: 'none', borderRadius: '12px',
              fontSize: '0.8rem', fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 180ms ease',
              boxShadow: '0 2px 12px rgba(132,94,247,0.4)',
              letterSpacing: '-0.01em',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 18px rgba(132,94,247,0.5)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'none';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(132,94,247,0.4)';
            }}
          >
            <svg width="13" height="13" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 1a.5.5 0 0 1 .5.5v8.793l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 1 1 .708-.708L7.5 10.293V1.5A.5.5 0 0 1 8 1z"/>
              <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.1a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.1a.5.5 0 0 1 1 0v2.1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.1a.5.5 0 0 1 .5-.5z"/>
            </svg>
            PNG 저장
          </button>
        </div>
      </header>

      {/* Canvas area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Loading overlay */}
        {isLoading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #F7F3FF 0%, #FFF0F6 100%)',
            gap: '20px',
          }}>
            <div style={{ position: 'relative', width: '64px', height: '64px' }}>
              <div style={{
                position: 'absolute', inset: 0,
                borderRadius: '50%',
                border: '3px solid transparent',
                borderTopColor: '#845EF7',
                borderRightColor: '#FF6B9D',
                animation: 'spin 0.9s linear infinite',
              }} />
              <div style={{
                position: 'absolute', inset: '10px',
                borderRadius: '50%',
                border: '2px solid transparent',
                borderTopColor: '#FF6B9D',
                animation: 'spin 1.3s linear infinite reverse',
              }} />
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: '22px',
              }}>📷</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{
                color: '#3D2052', fontWeight: 700, fontSize: '1rem',
                margin: '0 0 4px',
              }}>캔버스 불러오는 중</p>
              <p style={{ color: '#9C8BA6', fontSize: '0.82rem', margin: 0 }}>
                서버와 연결하고 있어요...
              </p>
            </div>
            <style>{`
              @keyframes spin { to { transform: rotate(360deg); } }
              @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
            `}</style>
          </div>
        )}

        {/* Error overlay */}
        {storeWithStatus.status === 'error' && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #F7F3FF 0%, #FFF0F6 100%)',
          }}>
            <div style={{
              background: '#fff', borderRadius: '20px',
              padding: '40px 48px', textAlign: 'center',
              boxShadow: '0 8px 40px rgba(132,94,247,0.15)',
              border: '1px solid #F0E8F0',
              maxWidth: '360px',
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>😕</div>
              <h3 style={{ margin: '0 0 8px', fontWeight: 700, color: '#1C1017', fontSize: '1.1rem' }}>
                연결에 실패했어요
              </h3>
              <p style={{ margin: '0 0 24px', color: '#9C8BA6', fontSize: '0.88rem', lineHeight: 1.5 }}>
                서버와 연결할 수 없습니다.<br />페이지를 새로고침 해주세요.
              </p>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '10px 24px',
                  background: 'linear-gradient(135deg, #845EF7, #FF6B9D)',
                  color: '#fff', border: 'none', borderRadius: '12px',
                  fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
                }}
              >
                새로고침
              </button>
            </div>
          </div>
        )}

        {/* TLDraw canvas */}
        {storeWithStatus.status === 'synced-remote' && (
          <>
            <style>{`
              @keyframes spin { to { transform: rotate(360deg); } }
              @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
            `}</style>
            <Tldraw
              store={storeWithStatus.store}
              cameraOptions={CAMERA_OPTIONS}
              overrides={UI_OVERRIDES}
              onMount={(editor) => { editorRef.current = editor; }}
            />
          </>
        )}
      </div>
    </div>
  );
}
