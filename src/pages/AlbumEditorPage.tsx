import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Tldraw } from '@tldraw/tldraw';
import { useSync } from '@tldraw/sync';
import '@tldraw/tldraw/tldraw.css';
import { albumsApi } from '../api/albums';
import { useAuthStore } from '../store/authStore';
import { useRef, useState, useCallback } from 'react';
import type { Editor } from '@tldraw/tldraw';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080';

export default function AlbumEditorPage() {
  const { albumId } = useParams<{ albumId: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.accessToken);
  const editorRef = useRef<Editor | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data: album } = useQuery({
    queryKey: ['album', albumId],
    queryFn: () => albumsApi.get(albumId!),
    enabled: !!albumId,
  });

  const store = useSync({
    uri: `${WS_URL}/sync/albums/${albumId}?token=${token}`,
    assets: {
      upload: async (_asset, file) => {
        if (!albumId) throw new Error('No albumId');
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`http://localhost:8080/albums/${albumId}/images`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const json = await res.json();
        return json.data?.url ?? '';
      },
      resolve: async (asset) => asset.props.src ?? '',
    },
  });

  const handleExport = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;
    setExporting(true);
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
    } finally {
      setExporting(false);
    }
  }, [album?.name]);

  if (!albumId) return <div style={{ padding: '2rem', color: '#9C8BA6' }}>앨범 ID가 없습니다.</div>;

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Bar */}
      <header style={{
        height: '52px',
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #F0E8F0',
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(12px)',
        flexShrink: 0,
        zIndex: 201,
        position: 'relative',
      }}>
        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate('/albums')}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#845EF7', fontWeight: 600, fontSize: '0.85rem',
              padding: '6px 10px', borderRadius: '8px',
              transition: 'background 150ms ease',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#F0EBFF'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
          >
            ← 목록
          </button>
          <div style={{ width: '1px', height: '20px', background: '#F0E8F0' }} />
          <span style={{
            fontWeight: 700, fontSize: '0.95rem', color: '#1C1017',
            maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {album?.name ?? '앨범'}
          </span>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px',
              background: 'linear-gradient(135deg, #FF6B9D, #845EF7)',
              color: '#fff',
              border: 'none', borderRadius: '10px',
              fontSize: '0.8rem', fontWeight: 600,
              cursor: 'pointer',
              opacity: exporting ? 0.6 : 1,
              transition: 'opacity 150ms ease',
            }}
          >
            {exporting ? '저장 중...' : '↓ PNG 저장'}
          </button>
        </div>
      </header>

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Tldraw
          store={store}
          onMount={(editor) => { editorRef.current = editor; }}
        />
      </div>
    </div>
  );
}
