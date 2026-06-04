import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Tldraw } from '@tldraw/tldraw';
import { useSync } from '@tldraw/sync';
import '@tldraw/tldraw/tldraw.css';
import { albumsApi } from '../api/albums';
import { useAuthStore } from '../store/authStore';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080';

export default function AlbumEditorPage() {
  const { albumId } = useParams<{ albumId: string }>();
  const token = useAuthStore((s) => s.accessToken);

  const { data: album } = useQuery({
    queryKey: ['album', albumId],
    queryFn: () => albumsApi.get(albumId!),
    enabled: !!albumId,
  });

  const store = useSync({
    uri: `${WS_URL}/sync/albums/${albumId}?token=${token}`,
    assets: {
      upload: async (_asset, _file) => {
        throw new Error('File upload not supported via sync store directly');
      },
      resolve: async (asset) => asset.props.src ?? '',
    },
  });

  if (!albumId) return <div>앨범 ID가 없습니다.</div>;

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: '48px', padding: '0 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #eee', background: '#fff', flexShrink: 0 }}>
        <span style={{ fontWeight: '600' }}>{album?.name ?? '앨범'}</span>
        <a href="/albums" style={{ color: '#333', textDecoration: 'none', fontSize: '0.9rem' }}>← 앨범 목록</a>
      </div>
      <div style={{ flex: 1 }}>
        <Tldraw store={store} />
      </div>
    </div>
  );
}
