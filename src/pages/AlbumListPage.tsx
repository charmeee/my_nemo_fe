import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { albumsApi, type Album } from '../api/albums';
import { useAuthStore } from '../store/authStore';

export default function AlbumListPage() {
  const { data: albums = [], isLoading } = useQuery({ queryKey: ['albums'], queryFn: albumsApi.list });
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const createMutation = useMutation({
    mutationFn: () => albumsApi.create(name),
    onSuccess: (album) => {
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      setCreating(false);
      setName('');
      navigate(`/albums/${album.id}`);
    },
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (isLoading) return <div style={{ padding: '2rem' }}>불러오는 중...</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>내 앨범</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setCreating(true)} style={{ padding: '8px 16px', background: '#333', color: '#fff', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
            + 새 앨범
          </button>
          <button onClick={handleLogout} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer' }}>
            로그아웃
          </button>
        </div>
      </div>

      {creating && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') createMutation.mutate(); if (e.key === 'Escape') setCreating(false); }}
            placeholder="앨범 이름"
            style={{ flex: 1, padding: '8px 12px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '1rem' }}
          />
          <button onClick={() => createMutation.mutate()} disabled={!name.trim()} style={{ padding: '8px 16px', background: '#333', color: '#fff', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
            만들기
          </button>
          <button onClick={() => setCreating(false)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer' }}>
            취소
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        {albums.map((album: Album) => (
          <Link key={album.id} to={`/albums/${album.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ border: '1px solid #eee', borderRadius: '12px', padding: '1.5rem', cursor: 'pointer', transition: 'box-shadow 0.2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📷</div>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>{album.name}</div>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>{album.memberCount}명</div>
            </div>
          </Link>
        ))}
        {albums.length === 0 && !creating && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#666', padding: '3rem' }}>
            아직 앨범이 없어요. 새 앨범을 만들어보세요!
          </div>
        )}
      </div>
    </div>
  );
}
